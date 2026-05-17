/**
 * LLM Client for G-Stack Tools
 * 
 * Provides:
 * - Model pricing tables (Anthropic, OpenAI)
 * - Token counting and cost tracking
 * - Standardized LLM call interface
 * - Multi-tier model selection
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { encoding_for_model, get_encoding } from 'tiktoken';
import { createLogger } from '@gstack/shared/core';
import * as fs from 'fs';
import * as path from 'path';
import { logger as coreLogger } from './logger.js';
import { getDefaultSecretManager } from './security.js';

export interface ModelPricing {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** Average latency in ms. */
  avg_latency_ms: number;
}

export interface LLMCallResult {
  content: string;
  input_tokens: number;
  output_tokens: number;
  model_id: string;
  cost_usd: number;
  latency_ms: number;
}

export interface LLMClientConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  defaultModel?: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** Hook called after each LLM call with cost info (for BudgetLedger integration) */
  onSpend?: (modelId: string, inputTokens: number, outputTokens: number, costUsd: number) => Promise<void>;
  /** Optional JSON file used to persist aggregate cost metrics across process restarts. */
  metricsPersistencePath?: string;
}

/** Anthropic model pricing (as of 2026-05-01) */
export const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-7': { input: 5.00, output: 25.00, avg_latency_ms: 5000 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, avg_latency_ms: 2000 },
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00, avg_latency_ms: 500 },
  'claude-opus-4-6': { input: 5.00, output: 25.00, avg_latency_ms: 5000 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00, avg_latency_ms: 2000 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00, avg_latency_ms: 500 },
};

/** OpenAI model pricing (as of 2026-05-01) */
export const OPENAI_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { input: 2.50, output: 10.00, avg_latency_ms: 1500 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, avg_latency_ms: 300 },
  'gpt-4-turbo': { input: 10.00, output: 30.00, avg_latency_ms: 3000 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50, avg_latency_ms: 800 },
};

/** Combined pricing map */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  ...ANTHROPIC_PRICING,
  ...OPENAI_PRICING,
};

/** Model tier configurations */
export const MODEL_TIERS = {
  tier1: 'claude-haiku-4-5-20251001',
  tier2: 'claude-sonnet-4-6',
  tier3: 'claude-opus-4-7',
};

/**
 * Estimate cost for a model call
 */
export function estimateCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) {
    coreLogger.warn('No pricing for model', { model_id: modelId });
    return 0;
  }
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

/**
 * Get pricing for a model
 */
export function getModelPricing(modelId: string): ModelPricing | null {
  return MODEL_PRICING[modelId] || null;
}

/**
 * Token counter using tiktoken for accurate token counting
 * Falls back to general-purpose tokenizer if model-specific one fails
 */
export function estimateTokens(text: string, model: string = 'gpt-4o'): number {
  try {
    const encoding = encoding_for_model(model as any);
    const tokens = encoding.encode(text);
    encoding.free();
    return tokens.length;
  } catch (error) {
    coreLogger.warn('tiktoken failed, falling back to cl100k_base', {
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      const fallback = get_encoding('cl100k_base');
      const tokens = fallback.encode(text);
      fallback.free();
      return tokens.length;
    } catch (e) {
      return Math.ceil(text.length / 4);
    }
  }
}

/**
 * LLM Client class
 */
export class LLMClient {
  private config: LLMClientConfig;
  private totalCostUsd: number = 0;
  private totalTokens: number = 0;
  private callCount: number = 0;
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private logger = createLogger('gmirror');
  private metricsPersistencePath?: string;

  constructor(config: LLMClientConfig = {}) {
    const secrets = getDefaultSecretManager();
    this.config = {
      defaultModel: 'claude-sonnet-4-6',
      maxTokens: 4096,
      timeoutMs: 30000,
      anthropicApiKey: config.anthropicApiKey || secrets.get('anthropic_api_key'),
      openaiApiKey: config.openaiApiKey || secrets.get('openai_api_key'),
      ...config,
    };
    this.metricsPersistencePath = this.config.metricsPersistencePath;
    this.loadPersistedMetrics();

    if (this.config.anthropicApiKey) {
      this.anthropicClient = new Anthropic({
        apiKey: this.config.anthropicApiKey,
        timeout: this.config.timeoutMs,
      });
    }

    if (this.config.openaiApiKey) {
      this.openaiClient = new OpenAI({
        apiKey: this.config.openaiApiKey,
        timeout: this.config.timeoutMs,
      });
    }
  }

  /**
   * Call an LLM with the given prompt
   */
  async call(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<LLMCallResult> {
    const model = options.model || this.config.defaultModel || 'claude-sonnet-4-6';
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const startTime = Date.now();

    let inputTokens: number;
    let content: string;
    let outputTokens: number;

    if (this.anthropicClient && model.startsWith('claude-')) {
      const result = await this.callAnthropic(prompt, model, maxTokens, options.temperature ?? 0.7);
      content = result.content;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    } else if (this.openaiClient && model.startsWith('gpt-')) {
      const result = await this.callOpenAI(prompt, model, maxTokens, options.temperature ?? 0.7);
      content = result.content;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    } else {
      throw new Error(`No API client available for model: ${model}`);
    }

    if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
      inputTokens = estimateTokens(prompt, model);
      outputTokens = estimateTokens(content, model);
    }

    const latency = Date.now() - startTime;
    const cost = estimateCostUsd(model, inputTokens, outputTokens);

    // Track metrics
    this.totalCostUsd += cost;
    this.totalTokens += inputTokens + outputTokens;
    this.callCount++;
    this.persistMetrics();

    // Call onSpend hook if configured (for BudgetLedger integration)
    if (this.config.onSpend) {
      await this.config.onSpend(model, inputTokens, outputTokens, cost);
    }

    return {
      content,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model_id: model,
      cost_usd: cost,
      latency_ms: latency,
    };
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    const message = await this.anthropicClient.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    return {
      content: message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text as string)
        .join('\n'),
      inputTokens: message.usage?.input_tokens ?? Number.NaN,
      outputTokens: message.usage?.output_tokens ?? Number.NaN,
    };
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const completion = await this.openaiClient.chat.completions.create({
      model,
      messages: [{
        role: 'user',
        content: prompt,
      }],
      max_tokens: maxTokens,
      temperature,
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      inputTokens: completion.usage?.prompt_tokens ?? Number.NaN,
      outputTokens: completion.usage?.completion_tokens ?? Number.NaN,
    };
  }

  /**
   * Get total cost incurred
   */
  getTotalCostUsd(): number {
    return this.totalCostUsd;
  }

  /**
   * Get total tokens used
   */
  getTotalTokens(): number {
    return this.totalTokens;
  }

  /**
   * Get call count
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.totalCostUsd = 0;
    this.totalTokens = 0;
    this.callCount = 0;
    this.persistMetrics();
  }

  /**
   * Get model by tier
   */
  getModelByTier(tier: 'tier1' | 'tier2' | 'tier3'): string {
    return MODEL_TIERS[tier];
  }

  private loadPersistedMetrics(): void {
    if (!this.metricsPersistencePath || !fs.existsSync(this.metricsPersistencePath)) {
      return;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.metricsPersistencePath, 'utf-8'));
      this.totalCostUsd = typeof parsed.totalCostUsd === 'number' ? parsed.totalCostUsd : 0;
      this.totalTokens = typeof parsed.totalTokens === 'number' ? parsed.totalTokens : 0;
      this.callCount = typeof parsed.callCount === 'number' ? parsed.callCount : 0;
    } catch (error) {
      this.logger.warn('Failed to load persisted LLM metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private persistMetrics(): void {
    if (!this.metricsPersistencePath) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(this.metricsPersistencePath), { recursive: true });
      fs.writeFileSync(this.metricsPersistencePath, JSON.stringify({
        totalCostUsd: this.totalCostUsd,
        totalTokens: this.totalTokens,
        callCount: this.callCount,
        updatedAt: new Date().toISOString(),
      }, null, 2));
    } catch (error) {
      this.logger.warn('Failed to persist LLM metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
