/**
 * Shared LLM Client for G-Stack Tools
 *
 * Provides:
 * - Model pricing tables (Anthropic, OpenAI)
 * - Token counting and cost tracking
 * - Standardized LLM call interface
 * - Multi-tier model selection
 * - Budget reservation and commitment via BudgetLedger
 */

import { BudgetLedger, BudgetReservation } from './budget-ledger.js';

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
  reservation_id?: string;
}

export interface LLMClientConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  defaultModel?: string;
  maxTokens?: number;
  timeoutMs?: number;
  budgetLedger?: BudgetLedger;
  budgetScope?: string;
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
    console.warn(`[LLMClient] No pricing for model: ${modelId}`);
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
 * Simple token counter (approximate)
 * In production, use provider-specific tokenizers
 */
export function estimateTokens(text: string): number {
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * LLM Client class
 */
export class LLMClient {
  private config: LLMClientConfig;
  private totalCostUsd: number = 0;
  private totalTokens: number = 0;
  private callCount: number = 0;
  private budgetLedger?: BudgetLedger;
  private budgetScope?: string;

  constructor(config: LLMClientConfig = {}) {
    this.config = {
      defaultModel: 'claude-sonnet-4-6',
      maxTokens: 4096,
      timeoutMs: 30000,
      ...config,
    };
    this.budgetLedger = config.budgetLedger;
    this.budgetScope = config.budgetScope || 'default';
  }

  /**
   * Call an LLM with the given prompt
   *
   * Note: This is a simplified implementation.
   * In production, use actual Anthropic/OpenAI SDKs.
   *
   * Budget tracking: If budgetLedger is configured, reserves budget before
   * the call and commits actual cost after completion.
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

    // Estimate input tokens
    const inputTokens = estimateTokens(prompt);

    // Estimate cost for budget reservation
    const estimatedOutputTokens = maxTokens;
    const estimatedCost = estimateCostUsd(model, inputTokens, estimatedOutputTokens);

    // Reserve budget if ledger is configured
    let reservationId: BudgetReservation | undefined;
    if (this.budgetLedger) {
      try {
        reservationId = this.budgetLedger.reserve(this.budgetScope || 'default', estimatedCost);
      } catch (error) {
        throw new Error(`Budget reservation failed: ${error}`);
      }
    }

    try {
      // In production, this would make an actual API call
      // For now, simulate the response
      const simulatedResponse = await this.simulateLLMCall(prompt, model, options.temperature);

      const outputTokens = estimateTokens(simulatedResponse);
      const latency = Date.now() - startTime;
      const actualCost = estimateCostUsd(model, inputTokens, outputTokens);

      // Commit actual cost if reservation was made
      if (this.budgetLedger && reservationId) {
        this.budgetLedger.commit(reservationId.id, actualCost);
      }

      // Track metrics
      this.totalCostUsd += actualCost;
      this.totalTokens += inputTokens + outputTokens;
      this.callCount++;

      return {
        content: simulatedResponse,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        model_id: model,
        cost_usd: actualCost,
        latency_ms: latency,
        reservation_id: reservationId?.id,
      };
    } catch (error) {
      // Release reservation on error
      if (this.budgetLedger && reservationId) {
        try {
          this.budgetLedger.release(reservationId.id);
        } catch (releaseError) {
          console.error(`Failed to release reservation ${reservationId.id}:`, releaseError);
        }
      }
      throw error;
    }
  }

  /**
   * Simulate an LLM call (placeholder for production implementation)
   */
  private async simulateLLMCall(
    prompt: string,
    model: string,
    temperature?: number
  ): Promise<string> {
    // Simulate network latency
    const pricing = MODEL_PRICING[model];
    const latency = pricing?.avg_latency_ms || 1000;
    await new Promise(resolve => setTimeout(resolve, latency / 10));

    // Generate a simulated response based on prompt keywords
    if (prompt.toLowerCase().includes('action') || prompt.toLowerCase().includes('what would you do')) {
      return JSON.stringify({
        action: 'navigate_to_page',
        reasoning: 'User needs to proceed to the next step',
        confidence: 0.85
      });
    }

    if (prompt.toLowerCase().includes('trust') || prompt.toLowerCase().includes('frustration')) {
      return JSON.stringify({
        trust_delta: 0.05,
        frustration_delta: -0.02,
        reasoning: 'Positive interaction experience'
      });
    }

    return JSON.stringify({
      response: 'Acknowledged',
      confidence: 0.7
    });
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
  }

  /**
   * Get model by tier
   */
  getModelByTier(tier: 'tier1' | 'tier2' | 'tier3'): string {
    return MODEL_TIERS[tier];
  }

  /**
   * Set budget ledger for cost tracking
   */
  setBudgetLedger(ledger: BudgetLedger, scope: string = 'default'): void {
    this.budgetLedger = ledger;
    this.budgetScope = scope;
  }

  /**
   * Get current budget ledger
   */
  getBudgetLedger(): BudgetLedger | undefined {
    return this.budgetLedger;
  }
}
