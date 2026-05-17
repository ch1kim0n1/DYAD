import { describe, it, expect } from 'bun:test';
import { HawkesPoller, HawkesPollerTimeout } from '../src/nous/hog/hawkes-poller';
import type { HogOperationResult } from '@dyad/shared';

/** Deterministic clock + sleep that just advances the virtual clock. */
function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms; },
    advance: (ms: number) => { t += ms; },
    current: () => t,
  };
}

function res(status: HogOperationResult['status'], creditsSpent = 0): HogOperationResult {
  return { operation_id: 'op_t', status, credits_spent: creditsSpent };
}

describe('HawkesPoller', () => {
  it('returns immediately when first poll is terminal', async () => {
    const clock = fakeClock();
    let calls = 0;
    const poller = new HawkesPoller(
      { getOperation: async () => { calls += 1; return res('completed'); }, now: clock.now, sleep: clock.sleep },
      { baseRateMs: 800 },
    );
    const { result, trace } = await poller.poll('op_t');
    expect(calls).toBe(1);
    expect(result.status).toBe('completed');
    expect(trace.ticks).toHaveLength(1);
    expect(trace.ticks[0].t_ms).toBe(0);
  });

  it('polls multiple times until terminal status, recording every tick', async () => {
    const clock = fakeClock();
    const sequence: HogOperationResult['status'][] = ['pending', 'pending', 'running', 'completed'];
    let i = 0;
    const poller = new HawkesPoller(
      { getOperation: async () => res(sequence[i++]!), now: clock.now, sleep: clock.sleep },
      { baseRateMs: 800, minIntervalMs: 100, maxIntervalMs: 2000 },
    );
    const { result, trace } = await poller.poll('op_t');
    expect(result.status).toBe('completed');
    expect(trace.ticks).toHaveLength(4);
    // Last tick has delay 0 (terminal).
    expect(trace.ticks[3].delay_ms).toBe(0);
    // First non-terminal delay should be near the baseline 800ms but clamped to [100, 2000].
    expect(trace.ticks[0].delay_ms).toBeGreaterThanOrEqual(100);
    expect(trace.ticks[0].delay_ms).toBeLessThanOrEqual(2000);
  });

  it('intensity increases monotonically while operation is pending (excitation)', async () => {
    const clock = fakeClock();
    // Stay non-terminal for 6 ticks so excitation can stack.
    const statuses: HogOperationResult['status'][] = ['pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'completed'];
    let i = 0;
    const poller = new HawkesPoller(
      { getOperation: async () => res(statuses[i++]!), now: clock.now, sleep: clock.sleep },
      { baseRateMs: 1000, excitationMu: 0.01, decayBeta: 0.0001, minIntervalMs: 50, maxIntervalMs: 5000 },
    );
    const { trace } = await poller.poll('op_t');
    // Compare consecutive non-terminal ticks' lambda — must be non-decreasing
    // (decay over the short fake-sleep window is negligible vs excitation jump).
    const lambdas = trace.ticks.slice(0, -1).map((t) => t.lambda);
    for (let k = 1; k < lambdas.length; k++) {
      expect(lambdas[k]).toBeGreaterThanOrEqual(lambdas[k - 1] - 1e-9);
    }
  });

  it('respects minIntervalMs lower bound on delay', async () => {
    const clock = fakeClock();
    const statuses: HogOperationResult['status'][] = ['pending', 'pending', 'completed'];
    let i = 0;
    const poller = new HawkesPoller(
      { getOperation: async () => res(statuses[i++]!), now: clock.now, sleep: clock.sleep },
      { baseRateMs: 50, excitationMu: 10, decayBeta: 0, minIntervalMs: 200, maxIntervalMs: 5000 },
    );
    const { trace } = await poller.poll('op_t');
    for (const tick of trace.ticks.slice(0, -1)) {
      expect(tick.delay_ms).toBeGreaterThanOrEqual(200);
    }
  });

  it('throws HawkesPollerTimeout when terminal status never reached', async () => {
    const clock = fakeClock();
    const poller = new HawkesPoller(
      { getOperation: async () => res('running'), now: clock.now, sleep: clock.sleep },
      { baseRateMs: 100, minIntervalMs: 50, maxIntervalMs: 200, timeoutMs: 1000 },
    );
    try {
      await poller.poll('op_t');
      throw new Error('expected timeout');
    } catch (e) {
      expect(e).toBeInstanceOf(HawkesPollerTimeout);
      expect((e as HawkesPollerTimeout).operationId).toBe('op_t');
    }
  });

  it('failed status is terminal', async () => {
    const clock = fakeClock();
    const poller = new HawkesPoller(
      { getOperation: async () => res('failed'), now: clock.now, sleep: clock.sleep },
      {},
    );
    const { result } = await poller.poll('op_t');
    expect(result.status).toBe('failed');
  });
});
