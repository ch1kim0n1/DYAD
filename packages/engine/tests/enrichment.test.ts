import { describe, it, expect } from 'bun:test';
import { BriefGenerator, ReframeGenerator } from '../src/index.js';
import type { OrchestratorResult } from '@dyad/shared';

function emptyResult(): OrchestratorResult {
  return {
    result_id: 'r', dyad_id: 'd', generated_at: new Date().toISOString(), analyzed_at: Date.now(),
    ethical_refusal: { safe: true, should_refuse: false, triggers: [], category: null, confidence: 0, referral_resources: [], crisis_resources: [] },
    detectors: { ethical_refusal: { safe: true, should_refuse: false, triggers: [], category: null, confidence: 0, referral_resources: [], crisis_resources: [] } },
    summary: '', recommended_actions: [], citations: [], confidence: 0,
  };
}

describe('enrichmentContext threading (#45/#46)', () => {
  it('BriefGenerator.getCached partitions cache by enrichmentContext', () => {
    const g = new BriefGenerator({ apiKey: 't' });
    // Both should be undefined before generation, but the keys must be distinct
    const a = g.getCached('bid_asymmetry', emptyResult(), 'hog: partner is stressed');
    const b = g.getCached('bid_asymmetry', emptyResult(), 'hog: partner is happy');
    expect(a).toBeUndefined();
    expect(b).toBeUndefined();
    // Indirect test: cache implementation hashes the enrichment input, so
    // these two keys differ. We confirm by accessing the private cacheKey.
    const keyA = (g as unknown as { cacheKey: (a: string, b: OrchestratorResult, c?: string) => string })
      .cacheKey('bid_asymmetry', emptyResult(), 'hog: partner is stressed');
    const keyB = (g as unknown as { cacheKey: (a: string, b: OrchestratorResult, c?: string) => string })
      .cacheKey('bid_asymmetry', emptyResult(), 'hog: partner is happy');
    expect(keyA).not.toBe(keyB);
  });

  it('ReframeGenerator.getCached partitions cache by enrichmentContext', () => {
    const g = new ReframeGenerator({ apiKey: 't' });
    const keyA = (g as unknown as { cacheKey: (a: string, b: OrchestratorResult, c: string, d?: string) => string })
      .cacheKey('bid_asymmetry', emptyResult(), 'brief', 'extra-A');
    const keyB = (g as unknown as { cacheKey: (a: string, b: OrchestratorResult, c: string, d?: string) => string })
      .cacheKey('bid_asymmetry', emptyResult(), 'brief', 'extra-B');
    expect(keyA).not.toBe(keyB);
  });
});
