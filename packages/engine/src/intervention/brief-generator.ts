import Anthropic from '@anthropic-ai/sdk';
import * as crypto from 'node:crypto';
import { NormalizedMessage, OrchestratorResult } from '@dyad/shared';
import { buildBriefPrompt, DetectorType } from './brief-prompt.js';

export interface BriefGeneratorOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 256;

/**
 * BriefGenerator — produces a 3-sentence empathetic insight for a detected
 * pattern. Results are cached by hash of `(detectorType, result)` to avoid
 * redundant API calls when the same pattern persists across polls.
 *
 * Use `getCached(detectorType, result)` to check the cache without calling
 * the API. `clearCache()` invalidates the entire cache (rare; typically not
 * needed since the cache is scoped to a process lifetime).
 */
export class BriefGenerator {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private cache = new Map<string, string>();

  constructor(options: BriefGeneratorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('BriefGenerator: ANTHROPIC_API_KEY is required');
    }
    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async generate(
    detectorType: DetectorType,
    result: OrchestratorResult,
    recentMessages: NormalizedMessage[]
  ): Promise<string | null> {
    const key = this.cacheKey(detectorType, result);
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: buildBriefPrompt(detectorType, result, recentMessages) }],
      });
      const block = response.content[0];
      const text = block.type === 'text' ? block.text.trim() : '';
      if (text) this.cache.set(key, text);
      return text || null;
    } catch (err) {
      console.error('[BriefGenerator] generate failed:', (err as Error).message);
      return null;
    }
  }

  getCached(detectorType: DetectorType, result: OrchestratorResult): string | undefined {
    return this.cache.get(this.cacheKey(detectorType, result));
  }

  clearCache(): void {
    this.cache.clear();
  }

  private cacheKey(detectorType: DetectorType, result: OrchestratorResult): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify({ detectorType, result: this.relevant(detectorType, result) }))
      .digest('hex');
  }

  /** Strip volatile fields (analyzed_at, generated_at) from the cache key. */
  private relevant(detectorType: DetectorType, result: OrchestratorResult): unknown {
    switch (detectorType) {
      case 'bid_asymmetry':
        return result.bid_asymmetry;
      case 'predictive_divergence':
        return result.predictive_divergence;
      case 'phantom_third_party':
        return result.phantom_third_party;
      case 'primary_secondary':
        return result.primary_secondary;
    }
  }
}
