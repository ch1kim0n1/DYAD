import { v4 as uuidv4 } from 'uuid';
import { VerdictAggregator } from '../src/core/verdict.js';
import { FailureMode, MultiModelConfig, RunRecord, TestRequest } from '../src/types/index.js';
import { LLMClient } from '../src/core/llm-client.js';
import { GMIRROR_DYAD_RUBRIC_V1 } from '../src/core/gmirror-dyad-rubric.js';
import { RubricFrameworkSchema } from '../src/types/quality-rubric.js';

function makeRunRecord(outcome: RunRecord['outcome'], frustration: number[] = [0.1, 0.2]): RunRecord {
  return {
    run_id: uuidv4(),
    request_id: uuidv4(),
    synthetic_user_id: uuidv4(),
    scenario_id: uuidv4(),
    outcome,
    behavior_trace: [
      { timestamp: new Date().toISOString(), action: 'click', state: {}, trust: 0.8, frustration: frustration[0] },
    ],
    subjective_trace: {
      cognitive_load: [0.2, 0.3],
      trust: [0.8, 0.75],
      frustration,
    },
    duration_ms: 1000,
    cost: { model_cost_usd: 0.001, compute_cost_usd: 0.0001, total_cost_usd: 0.0011 },
    created_at: new Date().toISOString(),
  };
}

function makeRequest(): TestRequest {
  return {
    request_id: '00000000-0000-0000-0000-000000000001',
    mode: 'change',
    payload: {},
    context: {},
    budget: { max_cost_usd: 1.0, max_latency_ms: 30000, max_panel_size: 10 },
    caller: { source: 'test', ref: 'test' },
    created_at: new Date().toISOString(),
  };
}

function makeDyadRequest(scores: Record<string, number>, ethicalRefusal = false): TestRequest {
  return {
    ...makeRequest(),
    scoring_mode: 'dyad_insight',
    ethical_refusal_triggered: ethicalRefusal,
    payload: {
      insight_type: 'bid_classification',
      insight_text: 'It seems like a bid for connection may benefit from a small acknowledgment, grounded in Johnson EFT attachment bids.',
      confidence: 0.8,
      supporting_evidence: ['redacted excerpt'],
      ethical_refusal_triggered: ethicalRefusal,
    },
    context: {
      scoring_mode: 'dyad_insight',
      dyad_scores: scores,
      ethical_refusal_triggered: ethicalRefusal,
    },
  };
}

describe('VerdictAggregator', () => {
  let aggregator: VerdictAggregator;

  beforeEach(() => {
    aggregator = new VerdictAggregator();
  });

  it('aggregateVerdict returns a Verdict with all required fields', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded'),
      makeRunRecord('succeeded'),
      makeRunRecord('abandoned'),
    ]);
    expect(verdict.verdict_id).toBeDefined();
    expect(verdict.request_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(['pass', 'pass_with_warnings', 'risky', 'fail']).toContain(verdict.overall);
    expect(verdict.scores.correctness.score.point).toBeGreaterThanOrEqual(0);
    expect(verdict.scores.correctness.score.point).toBeLessThanOrEqual(1);
    expect(verdict.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('correctness score is 1.0 when all runs succeed', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded'),
      makeRunRecord('succeeded'),
      makeRunRecord('succeeded'),
    ]);
    expect(verdict.scores.correctness.score.point).toBe(1.0);
  });

  it('correctness score is 0 when all runs fail', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('abandoned'),
      makeRunRecord('abandoned'),
    ]);
    expect(verdict.scores.correctness.score.point).toBe(0);
  });

  it('overall is fail when harmful runs trigger safety hard gate', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('harmful'),
      makeRunRecord('harmful'),
    ]);
    expect(verdict.overall).toBe('fail');
  });

  it('overall is pass or pass_with_warnings when all succeed with low frustration', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded', [0.1, 0.1]),
      makeRunRecord('succeeded', [0.05, 0.1]),
      makeRunRecord('succeeded', [0.1, 0.05]),
    ]);
    expect(['pass', 'pass_with_warnings']).toContain(verdict.overall);
  });

  it('empty run list returns a valid verdict with 0 correctness score', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), []);
    expect(verdict.scores.correctness.score.point).toBe(0);
  });

  it('generates execution receipt with valid structure', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded'),
      makeRunRecord('succeeded'),
    ]);
    expect(verdict.execution_receipt).toBeDefined();
    expect(verdict.execution_receipt?.receipt_id).toBeDefined();
    expect(verdict.execution_receipt?.rubric_name).toBe('gmirror_v1');
    expect(verdict.execution_receipt?.scores).toBeDefined();
  });

  it('detects increasing frustration trend', () => {
    const records = [
      makeRunRecord('succeeded', [0.1, 0.1]),
      makeRunRecord('succeeded', [0.3, 0.3]),
      makeRunRecord('succeeded', [0.5, 0.5]),
      makeRunRecord('succeeded', [0.7, 0.7]),
      makeRunRecord('succeeded', [0.9, 0.9]),
    ];
    const trend = aggregator.detectFrustrationTrend(records);
    expect(trend.trend).toBe('increasing');
    expect(trend.at_risk).toBe(true);
  });

  it('detects decreasing frustration trend', () => {
    const records = [
      makeRunRecord('succeeded', [0.9, 0.9]),
      makeRunRecord('succeeded', [0.7, 0.7]),
      makeRunRecord('succeeded', [0.5, 0.5]),
      makeRunRecord('succeeded', [0.3, 0.3]),
      makeRunRecord('succeeded', [0.1, 0.1]),
    ];
    const trend = aggregator.detectFrustrationTrend(records);
    expect(trend.trend).toBe('decreasing');
    expect(trend.at_risk).toBe(false);
  });

  it('detects stable frustration trend', () => {
    const records = [
      makeRunRecord('succeeded', [0.3, 0.3]),
      makeRunRecord('succeeded', [0.3, 0.3]),
      makeRunRecord('succeeded', [0.3, 0.3]),
      makeRunRecord('succeeded', [0.3, 0.3]),
      makeRunRecord('succeeded', [0.3, 0.3]),
    ];
    const trend = aggregator.detectFrustrationTrend(records);
    expect(trend.trend).toBe('stable');
    expect(trend.at_risk).toBe(false);
  });

  it('returns stable trend for insufficient data', () => {
    const records = [
      makeRunRecord('succeeded', [0.3, 0.3]),
      makeRunRecord('succeeded', [0.5, 0.5]),
    ];
    const trend = aggregator.detectFrustrationTrend(records);
    expect(trend.trend).toBe('stable');
    expect(trend.confidence).toBe(0);
  });

  it('uses Tier 2 LLM refinement when confidence is below the escalation threshold', async () => {
    const call = jest.fn().mockImplementation(async (prompt: string, options: { model?: string }) => {
      if (prompt.includes('Review this GMirror verdict aggregation')) {
        return {
          content: JSON.stringify({
            correctness: 0.42,
            user_outcome: 0.44,
            robustness: 0.46,
            risk: 0.30,
            confidence: 0.55,
            reasoning: 'low sample size with a repeated navigation failure',
          }),
          input_tokens: 40,
          output_tokens: 20,
          model_id: options.model,
          cost_usd: 0.002,
          latency_ms: 1,
        };
      }

      return {
        content: JSON.stringify({ verdict: 'pass_with_warnings' }),
        input_tokens: 20,
        output_tokens: 8,
        model_id: options.model,
        cost_usd: 0.001,
        latency_ms: 1,
      };
    });
    const fakeClient = {
      call,
    } as unknown as LLMClient;
    const config: MultiModelConfig = {
      default_tier: 'tier1',
      escalation_enabled: true,
      escalation_triggers: {
        min_confidence: 0.99,
        min_quality_score: 0.5,
        max_ambiguity: 0.5,
      },
      consensus_threshold: 0.8,
      cost_budget_usd_per_hour: 15,
      allow_tier3: false,
    };
    const mode: FailureMode = {
      failure_mode_id: uuidv4(),
      description: 'Users repeatedly land on settings with no visible next step.',
      trigger_pattern: 'navigate->back->abandon',
      affected_personas: [uuidv4()],
      affected_scenarios: [uuidv4()],
      severity: 'high',
      first_observed: new Date().toISOString(),
      observation_count: 3,
      scenarios_that_catch_it: [uuidv4()],
    };

    const llmAggregator = new VerdictAggregator(undefined, config, fakeClient);
    const verdict = await llmAggregator.aggregateVerdict(makeRequest(), [makeRunRecord('abandoned')], [mode]);

    expect(call).toHaveBeenCalledWith(
      expect.stringContaining('Review this GMirror verdict aggregation'),
      expect.objectContaining({ model: 'claude-sonnet-4-6' })
    );
    expect(verdict.scores.correctness.score.point).toBe(0.42);
    expect(verdict.scores.risk.score.point).toBe(0.30);
    expect(verdict.scores.confidence.evidence).toContain('Tier LLM refinement applied');
  });

  it('GMIRROR_DYAD_RUBRIC_V1 validates against the rubric schema', () => {
    expect(() => RubricFrameworkSchema.parse(GMIRROR_DYAD_RUBRIC_V1)).not.toThrow();
  });

  it('passes DYAD insight scoring when all dimensions pass', async () => {
    const verdict = await aggregator.aggregateVerdict(makeDyadRequest({
      research_grounding: 0.8,
      non_harm: 0.95,
      calibration: 0.7,
      actionability: 0.7,
      privacy_safe: 1,
    }), [makeRunRecord('succeeded')]);

    expect(verdict.overall).toBe('pass');
    expect(verdict.execution_receipt?.rubric_name).toBe('gmirror_dyad_v1');
  });

  it('fails DYAD insight scoring when non_harm is below the hard gate floor', async () => {
    const verdict = await aggregator.aggregateVerdict(makeDyadRequest({
      research_grounding: 1,
      non_harm: 0.85,
      calibration: 1,
      actionability: 1,
      privacy_safe: 1,
    }), [makeRunRecord('succeeded')]);

    expect(verdict.overall).toBe('fail');
    expect((verdict.scores as any).non_harm.score.point).toBe(0.85);
    expect(verdict.hard_gate_results.find(gate => gate.gate_name === 'dyad_non_harm')?.passed).toBe(false);
  });

  it('fails DYAD insight scoring when privacy_safe is below the hard gate floor', async () => {
    const verdict = await aggregator.aggregateVerdict(makeDyadRequest({
      research_grounding: 1,
      non_harm: 1,
      calibration: 1,
      actionability: 1,
      privacy_safe: 0.99,
    }), [makeRunRecord('succeeded')]);

    expect(verdict.overall).toBe('fail');
    expect(verdict.hard_gate_results.find(gate => gate.gate_name === 'dyad_privacy_safe')?.passed).toBe(false);
  });

  it('fails DYAD insight scoring when all dimensions fail', async () => {
    const verdict = await aggregator.aggregateVerdict(makeDyadRequest({
      research_grounding: 0,
      non_harm: 0,
      calibration: 0,
      actionability: 0,
      privacy_safe: 0,
    }), [makeRunRecord('abandoned')]);

    expect(verdict.overall).toBe('fail');
  });

  it('ethical refusal short-circuits to fail with zero DYAD scores', async () => {
    const verdict = await aggregator.aggregateVerdict(makeDyadRequest({
      research_grounding: 1,
      non_harm: 1,
      calibration: 1,
      actionability: 1,
      privacy_safe: 1,
    }, true), [makeRunRecord('succeeded')]);

    expect(verdict.overall).toBe('fail');
    expect((verdict as any).reason).toBe('ethical_refusal');
    expect(Object.values(verdict.scores as any).every((bundle: any) => bundle.score.point === 0)).toBe(true);
    expect(verdict.hard_gate_results[0].gate_name).toBe('ethical_refusal');
  });
});
