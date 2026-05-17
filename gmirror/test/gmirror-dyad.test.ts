import { v4 as uuidv4 } from 'uuid';
import { GMirror } from '../src/core/gmirror';
import { RunRecord } from '../src/types/index';

function makeRun(frustration: number[]): RunRecord {
  return {
    run_id: uuidv4(),
    request_id: uuidv4(),
    synthetic_user_id: uuidv4(),
    scenario_id: uuidv4(),
    outcome: 'succeeded',
    behavior_trace: [],
    subjective_trace: {
      cognitive_load: [0.2],
      trust: [0.8],
      frustration,
    },
    duration_ms: 1,
    cost: { model_cost_usd: 0, compute_cost_usd: 0, total_cost_usd: 0 },
    created_at: new Date().toISOString(),
  };
}

describe('GMirror DYAD workflows', () => {
  it('generates at least three relational scenarios with pass criteria', async () => {
    const gmirror = new GMirror();
    const scenarios = await gmirror.generateRelationalScenarios({
      insight_type: 'emotion_label',
      insight_text: 'It seems like one emotion may be sadness.',
      confidence: 0.7,
    });

    expect(scenarios.length).toBeGreaterThanOrEqual(3);
    expect(scenarios.every(scenario => scenario.goal.description.length > 0)).toBe(true);
    expect(scenarios.every(scenario => scenario.success_criterion.length > 0)).toBe(true);
    expect(scenarios.every(scenario => (scenario as any).pass_criteria.length > 0)).toBe(true);
  });

  it('varies relational scenario content by insight type', async () => {
    const gmirror = new GMirror();
    const emotion = await gmirror.generateRelationalScenarios({
      insight_type: 'emotion_label',
      insight_text: 'Emotion label',
      confidence: 0.7,
    });
    const labor = await gmirror.generateRelationalScenarios({
      insight_type: 'labor_asymmetry',
      insight_text: 'Labor asymmetry',
      confidence: 0.7,
    });

    expect(emotion[0].goal.description).not.toBe(labor[0].goal.description);
    expect(emotion[0].tags).toContain('emotion_label');
    expect(labor[0].tags).toContain('labor_asymmetry');
  });

  it('records frustration after each synthetic user run', () => {
    const gmirror = new GMirror();
    const recordFrustration = jest.fn();
    (gmirror as any).populationManager = { recordFrustration };

    (gmirror as any).recordRunFrustration(makeRun([0.2, 0.4]));

    expect(recordFrustration.mock.calls[0][0]).toBeCloseTo(0.3);
  });

  it('does not fire drift for a low frustration panel', () => {
    const gmirror = new GMirror();
    const record = jest.fn();
    const getFrustrationTrend = jest.fn(() => ({
      drifted: false,
      current: 0.2,
      threshold: 0.6,
      metric: 'panel_frustration',
    }));
    (gmirror as any).populationManager = { getFrustrationTrend };
    (gmirror as any).driftDetector = { record };
    (gmirror as any).auditLogger = { logDecision: jest.fn() };

    (gmirror as any).checkPanelFrustrationTrend(10);

    expect(getFrustrationTrend).toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('fires drift and audit logging for a high frustration panel', () => {
    const gmirror = new GMirror();
    const record = jest.fn();
    const logDecision = jest.fn();
    (gmirror as any).populationManager = {
      getFrustrationTrend: jest.fn(() => ({
        drifted: true,
        current: 0.9,
        threshold: 0.65,
        metric: 'panel_frustration',
      })),
    };
    (gmirror as any).driftDetector = { record };
    (gmirror as any).auditLogger = { logDecision };

    (gmirror as any).checkPanelFrustrationTrend(10);

    expect(record).toHaveBeenCalledWith('panel_frustration', 0.9);
    expect(logDecision).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'frustration_trend_alert',
    }));
  });

  it('does not record drift for fewer than ten panel runs', () => {
    const gmirror = new GMirror();
    const record = jest.fn();
    (gmirror as any).populationManager = {
      getFrustrationTrend: jest.fn(() => ({
        drifted: true,
        current: 0.9,
        threshold: 0.65,
        metric: 'panel_frustration',
      })),
    };
    (gmirror as any).driftDetector = { record };

    (gmirror as any).checkPanelFrustrationTrend(3);

    expect(record).not.toHaveBeenCalled();
  });
});
