import { v4 as uuidv4 } from 'uuid';
import { FailureModeExtractor } from '../src/core/failure-mode.js';
import { RunRecord } from '../src/types/index.js';
import { LLMClient } from '../src/core/llm-client.js';

function makeRunRecord(outcome: RunRecord['outcome'], lastActions: string[]): RunRecord {
  return {
    run_id: uuidv4(),
    request_id: uuidv4(),
    synthetic_user_id: uuidv4(),
    scenario_id: uuidv4(),
    outcome,
    behavior_trace: lastActions.map(action => ({
      timestamp: new Date().toISOString(),
      action,
      state: {},
      trust: 0.5,
      frustration: 0.3,
    })),
    subjective_trace: { cognitive_load: [0.3], trust: [0.5], frustration: [0.3] },
    duration_ms: 500,
    cost: { model_cost_usd: 0.001, compute_cost_usd: 0.0001, total_cost_usd: 0.0011 },
    created_at: new Date().toISOString(),
  };
}

describe('FailureModeExtractor', () => {
  let extractor: FailureModeExtractor;

  beforeEach(() => {
    extractor = new FailureModeExtractor();
  });

  it('getLibrary returns at least 3 default failure modes', async () => {
    const library = extractor.getLibrary();
    expect(library.length).toBeGreaterThanOrEqual(3);
  });

  it('extractFromRuns returns empty array when all runs succeed', async () => {
    const runs = [
      makeRunRecord('succeeded', ['navigate', 'click', 'submit_form']),
      makeRunRecord('succeeded', ['navigate', 'fill_form', 'submit_form']),
    ];
    const modes = await extractor.extractFromRuns(runs);
    expect(Array.isArray(modes)).toBe(true);
    // succeeded runs produce no failure modes
    expect(modes.length).toBe(0);
  });

  it('extractFromRuns detects repeated abandon pattern as a failure mode', async () => {
    const runs = [
      makeRunRecord('abandoned', ['navigate', 'scroll', 'abandon']),
      makeRunRecord('abandoned', ['navigate', 'scroll', 'abandon']),
      makeRunRecord('abandoned', ['navigate', 'scroll', 'abandon']),
    ];
    const modes = await extractor.extractFromRuns(runs);
    expect(modes.length).toBeGreaterThan(0);
    expect(modes[0].failure_mode_id).toBeDefined();
    expect(modes[0].trigger_pattern).toBeDefined();
    expect(modes[0].observation_count).toBeGreaterThanOrEqual(3);
  });

  it('extracted failure modes have valid severity', async () => {
    const runs = Array(5).fill(null).map(() =>
      makeRunRecord('abandoned', ['wait', 'back', 'abandon'])
    );
    const modes = await extractor.extractFromRuns(runs);
    for (const m of modes) {
      expect(['low', 'medium', 'high', 'critical']).toContain(m.severity);
    }
  });

  it('uses the LLM to identify failure modes across failed traces', async () => {
    const runs = [
      makeRunRecord('abandoned', ['navigate', 'help', 'back', 'abandon']),
      makeRunRecord('errored', ['navigate', 'settings', 'retry', 'abandon']),
    ];
    const call = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        failure_modes: [{
          description: 'Users cannot recover from a dead-end support path.',
          trigger_pattern: 'support_dead_end',
          severity: 'high',
          observation_count: 2,
          affected_personas: runs.map(run => run.synthetic_user_id),
          affected_scenarios: runs.map(run => run.scenario_id),
          scenarios_that_catch_it: [runs[0].scenario_id],
        }],
      }),
      input_tokens: 80,
      output_tokens: 30,
      model_id: 'claude-haiku-4-5-20251001',
      cost_usd: 0.001,
      latency_ms: 1,
    });
    const fakeClient = {
      call,
      getModelByTier: jest.fn().mockReturnValue('claude-haiku-4-5-20251001'),
    } as unknown as LLMClient;
    const llmExtractor = new FailureModeExtractor({ llmClient: fakeClient });

    const modes = await llmExtractor.extractFromRuns(runs);

    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][0]).toContain('Group semantically similar failures');
    expect(modes).toHaveLength(1);
    expect(modes[0].trigger_pattern).toBe('support_dead_end');
    expect(modes[0].observation_count).toBe(2);
  });
});
