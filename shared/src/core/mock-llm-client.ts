/**
 * A deterministic LLMClient substitute for testing and development without an API key.
 * Cycles through the provided responses array on each call().
 */

import { LLMCallResult } from './llm-client.js';

export class MockLLMClient {
  private responses: string[];
  private index: number = 0;

  constructor(responses?: string[]) {
    this.responses = responses && responses.length > 0 ? responses : ['[Mock response]'];
  }

  async call(
    _prompt: string,
    _options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<LLMCallResult> {
    const content = this.responses[this.index % this.responses.length];
    this.index++;
    return {
      content,
      input_tokens: 0,
      output_tokens: 0,
      model_id: 'mock',
      cost_usd: 0,
      latency_ms: 0,
    };
  }

  getTotalCostUsd(): number {
    return 0;
  }

  getTotalTokens(): number {
    return 0;
  }

  getCallCount(): number {
    return this.index;
  }

  resetMetrics(): void {
    this.index = 0;
  }
}
