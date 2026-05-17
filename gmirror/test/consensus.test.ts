import { VerdictAggregator } from '../src/core/verdict';
import { LLMClient } from '../src/core/llm-client';
import { MultiModelConfig, ScoreBundle } from '../src/types/index';

function bundle(point: number): ScoreBundle {
  return {
    score: { point, lower: Math.max(0, point - 0.1), upper: Math.min(1, point + 0.1) },
    confidence: 0.8,
    evidence: ['test evidence'],
  };
}

function vote(verdict: string, dimensions?: Record<string, number>): string {
  return JSON.stringify({
    verdict,
    dimensions: dimensions || {
      correctness: 0.9,
      user_outcome: 0.85,
      robustness: 0.8,
      risk: 0.2,
    },
    reasoning: 'test vote',
  });
}

function makeAggregatorWithResponses(responses: string[], allowTier3 = true) {
  const calls: string[] = [];
  const fakeClient = {
    call: jest.fn(async (_prompt: string, options: { model?: string }) => {
      const content = responses[calls.length];
      calls.push(options.model || '');
      return {
        content,
        input_tokens: 20,
        output_tokens: 10,
        model_id: options.model,
        cost_usd: 0.001,
        latency_ms: 1,
      };
    }),
  } as unknown as LLMClient;
  const config: MultiModelConfig = {
    default_tier: 'tier1',
    escalation_enabled: true,
    escalation_triggers: {
      min_confidence: 0.7,
      min_quality_score: 0.5,
      max_ambiguity: 0.5,
    },
    consensus_threshold: 0.8,
    cost_budget_usd_per_hour: 15,
    allow_tier3: allowTier3,
  };

  return { aggregator: new VerdictAggregator(undefined, config, fakeClient), calls };
}

const hardGates: any[] = [];
const correctness = bundle(0.9);
const userOutcome = bundle(0.85);
const risk = bundle(0.2);

describe('VerdictAggregator multi-model consensus', () => {
  it('invokes tier3 when tier1 and tier2 disagree', async () => {
    const { aggregator, calls } = makeAggregatorWithResponses([
      vote('pass'),
      vote('risky'),
      vote('pass'),
    ]);

    const verdict = await (aggregator as any).judgeVerdictWithLLM(hardGates, correctness, userOutcome, risk);
    const consensus = (aggregator as any).lastConsensusSummary;

    expect(verdict).toBe('pass');
    expect(calls).toEqual(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6']);
    expect(consensus.tier3_invoked).toBe(true);
    expect(consensus.agreement_ratio).toBeCloseTo(2 / 3);
    expect(consensus.per_dimension_agreement.correctness.wilson_95_ci.lower).toBeGreaterThanOrEqual(0);
    expect(consensus.small_sample_note).toBe(true);
  });

  it('early-stops when tier1 and tier2 agree', async () => {
    const { aggregator, calls } = makeAggregatorWithResponses([
      vote('pass_with_warnings'),
      vote('pass_with_warnings'),
      vote('fail'),
    ]);

    const verdict = await (aggregator as any).judgeVerdictWithLLM(hardGates, correctness, userOutcome, risk);
    const consensus = (aggregator as any).lastConsensusSummary;

    expect(verdict).toBe('pass_with_warnings');
    expect(calls).toEqual(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6']);
    expect(consensus.early_stopped).toBe(true);
    expect(consensus.tier3_invoked).toBe(false);
  });

  it('disqualifies votes missing required dimensions', async () => {
    const { aggregator } = makeAggregatorWithResponses([
      vote('pass', { correctness: 0.9, user_outcome: 0.8, robustness: 0.8 }),
      vote('risky'),
      vote('risky'),
    ]);

    const verdict = await (aggregator as any).judgeVerdictWithLLM(hardGates, correctness, userOutcome, risk);
    const consensus = (aggregator as any).lastConsensusSummary;

    expect(verdict).toBe('risky');
    expect(consensus.votes[0].disqualified).toBe(true);
    expect(consensus.votes[0].disqualification_reason).toContain('missing dimensions: risk');
    expect(consensus.valid_votes).toBe(2);
  });
});
