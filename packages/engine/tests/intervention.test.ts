import { describe, it, expect } from 'bun:test';
import { buildBriefPrompt } from '../src/intervention/brief-prompt.js';
import { buildReframePrompt } from '../src/intervention/reframe-prompt.js';
import { BriefGenerator } from '../src/intervention/brief-generator.js';
import { ReframeGenerator } from '../src/intervention/reframe-generator.js';
import type { OrchestratorResult, NormalizedMessage } from '@dyad/shared';

function emptyResult(): OrchestratorResult {
  return {
    result_id: 'r', dyad_id: 'd', generated_at: new Date().toISOString(), analyzed_at: Date.now(),
    ethical_refusal: { safe: true, should_refuse: false, triggers: [], category: null, confidence: 0, referral_resources: [], crisis_resources: [] },
    detectors: { ethical_refusal: { safe: true, should_refuse: false, triggers: [], category: null, confidence: 0, referral_resources: [], crisis_resources: [] } },
    summary: '', recommended_actions: [], citations: [], confidence: 0,
  };
}

function msg(id: string, text: string, isFromMe: boolean): NormalizedMessage {
  return { message_id: id, participant_id: isFromMe ? 'me' : 'p', is_from_me: isFromMe, text, timestamp: new Date().toISOString(), chat_id: 'c' };
}

describe('issue #32: brief prompt', () => {
  it('includes the 3-line output format', () => {
    const p = buildBriefPrompt('bid_asymmetry', emptyResult(), [msg('a', 'hi', true)]);
    expect(p).toContain("[What's happening]");
    expect(p).toContain('[Why it matters]');
    expect(p).toContain('[Observation]');
  });

  it('includes a detector-specific few-shot', () => {
    const p = buildBriefPrompt('phantom_third_party', emptyResult(), []);
    expect(p).toContain('phantom_third_party');
  });

  it('forbids blame in system prompt', () => {
    const p = buildBriefPrompt('bid_asymmetry', emptyResult(), []);
    expect(p).toContain('No blame');
    expect(p).toContain('No clinical labels');
  });
});

describe('issue #34: reframe prompt', () => {
  it('takes brief as input and includes it', () => {
    const brief = "[What's happening]: x\n[Why it matters]: y\n[Observation]: z";
    const p = buildReframePrompt('primary_secondary', emptyResult(), brief, []);
    expect(p).toContain(brief);
  });

  it('forbids assigning motive', () => {
    const p = buildReframePrompt('bid_asymmetry', emptyResult(), 'brief', []);
    expect(p).toContain('exploratory');
    expect(p).toContain('only what they might');
  });
});

describe('issue #33: BriefGenerator config', () => {
  it('throws without API key', () => {
    const before = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new BriefGenerator()).toThrow(/ANTHROPIC_API_KEY/);
    if (before !== undefined) process.env.ANTHROPIC_API_KEY = before;
  });

  it('uses claude-sonnet-4-6 and max_tokens=256 by default', () => {
    const g = new BriefGenerator({ apiKey: 't' });
    expect((g as unknown as { model: string }).model).toBe('claude-sonnet-4-6');
    expect((g as unknown as { maxTokens: number }).maxTokens).toBe(256);
  });

  it('caches by hash of (detectorType, result)', () => {
    const g = new BriefGenerator({ apiKey: 't' });
    expect(g.getCached('bid_asymmetry', emptyResult())).toBeUndefined();
  });
});

describe('issue #35: ReframeGenerator config', () => {
  it('uses max_tokens=400 by default', () => {
    const g = new ReframeGenerator({ apiKey: 't' });
    expect((g as unknown as { maxTokens: number }).maxTokens).toBe(400);
  });

  it('has a separate cache namespace from BriefGenerator (different key inputs)', () => {
    const g = new ReframeGenerator({ apiKey: 't' });
    expect(g.getCached('bid_asymmetry', emptyResult(), 'brief')).toBeUndefined();
  });
});
