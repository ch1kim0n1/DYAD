import { v4 as uuidv4 } from 'uuid';
import { VerdictAggregator } from '../src/core/verdict.js';
import { RunRecord, TestRequest, ExecutionReceipt } from '../src/types/index.js';
import { ReceiptRegistry } from '../src/core/receipt-registry.js';
import { GMIRROR_RUBRIC_V1 } from '../src/core/gmirror-rubric.js';
import { evaluateRegressionGates, loadRegressionBaselines } from '../src/core/regression-gates.js';

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

describe('VerdictAggregator Baseline Regression Tests', () => {
  let aggregator: VerdictAggregator;
  let registry: ReceiptRegistry;
  const TOLERANCE = 0.05;

  beforeEach(() => {
    aggregator = new VerdictAggregator();
    registry = new ReceiptRegistry('gmirror');
  });

  it('generates receipt with correct rubric metadata', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded'),
      makeRunRecord('succeeded'),
    ]);

    expect(verdict.execution_receipt).toBeDefined();
    expect(verdict.execution_receipt?.rubric_name).toBe('gmirror_v1');
    expect(verdict.execution_receipt?.project).toBe('gmirror');
    expect(verdict.execution_receipt?.schema_version).toBe(1);
  });

  it('receipt scores match rubric dimensions', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded'),
      makeRunRecord('succeeded'),
    ]);

    const receipt = verdict.execution_receipt;
    expect(receipt).toBeDefined();
    
    const dimNames = GMIRROR_RUBRIC_V1.dimensions.map(d => d.name);
    for (const dim of dimNames) {
      expect(receipt?.scores[dim]).toBeDefined();
      expect(receipt?.scores[dim].score).toBeGreaterThanOrEqual(0);
      expect(receipt?.scores[dim].score).toBeLessThanOrEqual(1);
    }
  });

  it('baseline comparison: current verdict scores within tolerance of baseline', async () => {
    // Generate current verdict
    const currentVerdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded'),
      makeRunRecord('succeeded'),
      makeRunRecord('abandoned'),
    ]);

    const receipt = currentVerdict.execution_receipt as ExecutionReceipt | undefined;
    expect(receipt).toBeDefined();

    const baselines = await loadRegressionBaselines('test/baselines/regression-baselines.jsonl');
    const gate = evaluateRegressionGates(receipt!, baselines);
    const scoreGate = gate.results.find(result => result.dimension === 'overall_score');
    expect(scoreGate).toBeDefined();
    expect(scoreGate?.wilson_95_ci).toBeDefined();
    expect(gate.results.find(result => result.dimension === 'correctness')?.tolerance).toBeGreaterThanOrEqual(TOLERANCE);
    expect(gate.passed).toBe(true);
  });

  it('receipt is persisted to registry', async () => {
    const testRegistry = new ReceiptRegistry('gmirror');
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded'),
    ]);

    const receipt = verdict.execution_receipt;
    expect(receipt).toBeDefined();

    // Verify receipt was appended
    const latest = await testRegistry.getLatest();
    expect(latest).toBeDefined();
    expect(latest?.receipt_id).toBe(receipt?.receipt_id);
  });

  it('hard gates passed reflects in receipt', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded'),
      makeRunRecord('succeeded'),
    ]);

    const receipt = verdict.execution_receipt;
    expect(receipt?.hard_gates_passed).toBe(true);

    const harmfulVerdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('harmful'),
    ]);

    const harmfulReceipt = harmfulVerdict.execution_receipt;
    expect(harmfulReceipt?.hard_gates_passed).toBe(false);
  });

  it('verdict and receipt overall verdict match', async () => {
    const verdict = await aggregator.aggregateVerdict(makeRequest(), [
      makeRunRecord('succeeded'),
      makeRunRecord('succeeded'),
    ]);

    expect(verdict.execution_receipt?.verdict).toBe(verdict.overall);
  });
});
