import { SyntheticUserRunner } from '../src/core/runner.js';
import { SyntheticUser, Scenario } from '../src/types/index.js';
import { LLMClient } from '../src/core/llm-client.js';

function makeUser(overrides: Partial<SyntheticUser> = {}): SyntheticUser {
  return {
    user_id: '00000000-0000-0000-0000-000000000001',
    persona_label: 'test_user',
    big_five: {
      openness: 0.6,
      conscientiousness: 0.7,
      extraversion: 0.5,
      agreeableness: 0.8,
      neuroticism: 0.3,
    },
    cognitive_load_baseline: 0.2,
    dual_process_bias: 0.1,
    trust_baseline: 0.8,
    frustration_threshold: 0.7,
    expertise: { typescript: 0.9, react: 0.7 },
    goals: [{ goal_id: 'g1', description: 'Complete form', priority: 0.9, success_criteria: ['form_submitted'] }],
    constraints: [],
    history_seed: 'test',
    derivation: 'synthetic',
    source_evidence: [],
    created_at: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}

function makeScenario(): Scenario {
  return {
    scenario_id: '00000000-0000-0000-0000-000000000010',
    goal: { goal_id: 'g1', description: 'Submit registration form', priority: 0.9, success_criteria: ['submitted'] },
    starting_state: { page: 'registration' },
    success_criterion: 'form_submitted',
    failure_criteria: ['timeout', 'abandon'],
    tags: ['registration', 'form'],
    version: 1,
    derivation: 'baseline',
    created_at: new Date().toISOString(),
  };
}

describe('SyntheticUserRunner', () => {
  let runner: SyntheticUserRunner;

  beforeEach(() => {
    runner = new SyntheticUserRunner();
  });

  it('runScenario returns a RunRecord with required fields', async () => {
    const record = await runner.runScenario(makeUser(), makeScenario(), {});
    expect(record.run_id).toBeDefined();
    expect(record.synthetic_user_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(record.scenario_id).toBe('00000000-0000-0000-0000-000000000010');
    expect(['succeeded', 'abandoned', 'errored', 'harmful']).toContain(record.outcome);
    expect(record.behavior_trace).toBeInstanceOf(Array);
    expect(record.subjective_trace.trust).toBeInstanceOf(Array);
    expect(record.subjective_trace.frustration).toBeInstanceOf(Array);
    expect(record.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('high-trust user with low neuroticism does not always abandon on step 1', async () => {
    const user = makeUser({ trust_baseline: 0.95, frustration_threshold: 0.9 });
    const record = await runner.runScenario(user, makeScenario(), {});
    // A very trusting user should not immediately abandon
    expect(record.behavior_trace.length).toBeGreaterThan(0);
  });

  it('low-trust user (trust=0.1) abandons due to frustration threshold', async () => {
    const user = makeUser({ trust_baseline: 0.1, frustration_threshold: 0.1 });
    const record = await runner.runScenario(user, makeScenario(), { hasErrors: true, hasUnexpectedModal: true });
    expect(['abandoned', 'errored']).toContain(record.outcome);
  });

  it('runPanel runs all users and returns one record per user', async () => {
    const users = [makeUser(), makeUser({ user_id: '00000000-0000-0000-0000-000000000002' })];
    const records = await runner.runPanel(users, makeScenario(), {});
    expect(records).toHaveLength(2);
  });

  it('subjective_trace arrays grow with each step', async () => {
    const record = await runner.runScenario(makeUser(), makeScenario(), {});
    expect(record.subjective_trace.trust.length).toBeGreaterThan(1);
    expect(record.subjective_trace.cognitive_load.length).toBeGreaterThan(1);
  });

  it('cost is non-negative', async () => {
    const record = await runner.runScenario(makeUser(), makeScenario(), {});
    expect(record.cost.total_cost_usd).toBeGreaterThanOrEqual(0);
  });

  it('conditions LLM step decisions on explicit Big Five traits', async () => {
    const call = jest.fn().mockResolvedValue({
      content: JSON.stringify({ action: 'submit_form', reasoning: 'ready' }),
      input_tokens: 12,
      output_tokens: 5,
      model_id: 'claude-haiku-4-5-20251001',
      cost_usd: 0.001,
      latency_ms: 1,
    });
    const fakeClient = {
      call,
      getModelByTier: jest.fn().mockReturnValue('claude-haiku-4-5-20251001'),
      getTotalCostUsd: jest.fn().mockReturnValue(0.001),
      getTotalTokens: jest.fn().mockReturnValue(17),
      getCallCount: jest.fn().mockReturnValue(1),
    } as unknown as LLMClient;

    const llmRunner = new SyntheticUserRunner({ llmClient: fakeClient });
    await llmRunner.runScenario(makeUser(), makeScenario(), {});

    const prompt = call.mock.calls[0][0] as string;
    expect(prompt).toContain('- Big Five personality:');
    expect(prompt).toContain('- openness: 0.6');
    expect(prompt).toContain('- conscientiousness: 0.7');
    expect(prompt).toContain('- extraversion: 0.5');
    expect(prompt).toContain('- agreeableness: 0.8');
    expect(prompt).toContain('- neuroticism: 0.3');
  });
});
