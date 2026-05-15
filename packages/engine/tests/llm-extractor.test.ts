import { describe, it, expect } from 'bun:test';
import { LlmExtractor } from '../src/llm-extractor.js';

describe('issue #17: LlmExtractor configuration', () => {
  it('throws clearly if no API key is provided', () => {
    const before = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new LlmExtractor()).toThrow(/ANTHROPIC_API_KEY/);
    if (before !== undefined) process.env.ANTHROPIC_API_KEY = before;
  });

  it('uses claude-haiku-4-5 by default', () => {
    const e = new LlmExtractor({ apiKey: 'test' });
    // Accessing private via cast is acceptable in tests
    expect((e as unknown as { model: string }).model).toBe('claude-haiku-4-5');
  });

  it('uses max_tokens=512 by default', () => {
    const e = new LlmExtractor({ apiKey: 'test' });
    expect((e as unknown as { maxTokens: number }).maxTokens).toBe(512);
  });

  it('accepts model and max_tokens overrides', () => {
    const e = new LlmExtractor({ apiKey: 't', model: 'custom-model', maxTokens: 256 });
    expect((e as unknown as { model: string }).model).toBe('custom-model');
    expect((e as unknown as { maxTokens: number }).maxTokens).toBe(256);
  });
});
