import Anthropic from '@anthropic-ai/sdk';
import * as crypto from 'node:crypto';
import { NormalizedMessage, OrchestratorResult } from '@dyad/shared';
import { buildReframePrompt } from './reframe-prompt.js';
import { DetectorType } from './brief-prompt.js';

export interface ReframeGeneratorOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 400;

/**
 * ReframeGenerator — produces a compassionate alternative interpretation
 * of a detected pattern. Designed to be called only when the user requests
 * it (not auto-displayed), separate from the brief.
 *
 * Cached by hash of `(detectorType, result, brief)`.
 */
export class ReframeGenerator {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private cache = new Map<string, string>();

  constructor(options: ReframeGeneratorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ReframeGenerator: ANTHROPIC_API_KEY is required');
    }
    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async generate(
    detectorType: DetectorType,
    result: OrchestratorResult,
    brief: string,
    recentMessages: NormalizedMessage[]
  ): Promise<string | null> {
    const key = this.cacheKey(detectorType, result, brief);
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: buildReframePrompt(detectorType, result, brief, recentMessages) }],
      });
      const block = response.content[0];
      const text = block.type === 'text' ? block.text.trim() : '';
      if (text) this.cache.set(key, text);
      return text || null;
    } catch (err) {
      console.error('[ReframeGenerator] generate failed:', (err as Error).message);
      return null;
    }
  }

  getCached(detectorType: DetectorType, result: OrchestratorResult, brief: string): string | undefined {
    return this.cache.get(this.cacheKey(detectorType, result, brief));
  }

  clearCache(): void {
    this.cache.clear();
  }

  private cacheKey(detectorType: DetectorType, result: OrchestratorResult, brief: string): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify({ detectorType, brief, payload: this.relevant(detectorType, result) }))
      .digest('hex');
  }

  private relevant(detectorType: DetectorType, result: OrchestratorResult): unknown {
    switch (detectorType) {
      case 'bid_asymmetry': return result.bid_asymmetry;
      case 'predictive_divergence': return result.predictive_divergence;
      case 'phantom_third_party': return result.phantom_third_party;
      case 'primary_secondary': return result.primary_secondary;
    }
  }
}
