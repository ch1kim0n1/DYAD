/**
 * NOUS Hawkes-process adaptive poller.
 *
 * Polls `/api/operations/:id` until a terminal status using a self-exciting
 * intensity model:
 *
 *   λ(t) = λ₀ + Σ_i μ·exp(-β(t - t_i))
 *
 * where:
 *   - λ₀  = baseline arrival rate (1/baseRateMs)
 *   - μ   = excitation jump on each non-terminal observation
 *   - β   = decay rate (1/ms)
 *   - t_i = timestamps of past observations
 *
 * Next-poll delay is `clamp(1/λ, [minIntervalMs, maxIntervalMs])`. Records
 * every tick for the UI sparkline. `now` and `sleep` are injectable for
 * deterministic tests.
 */
import type { HawkesPollTrace, HogOperationResult } from '@dyad/shared';

export interface HawkesPollerOptions {
  /** Initial baseline interval, ms. λ₀ = 1/baseRateMs. Default 800. */
  baseRateMs?: number;
  /** Excitation jump on each non-terminal observation. Default 1/500ms = 0.002. */
  excitationMu?: number;
  /** Decay rate (per ms). Default 0.0008. */
  decayBeta?: number;
  /** Minimum sleep between polls, ms. Default 250. */
  minIntervalMs?: number;
  /** Maximum sleep between polls, ms. Default 5000. */
  maxIntervalMs?: number;
  /** Hard timeout — abandon op after this many ms. Default 30000. */
  timeoutMs?: number;
}

export interface HawkesPollerDeps {
  /** Returns a terminal HogOperationResult once available. */
  getOperation: <T>(id: string) => Promise<HogOperationResult<T>>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class HawkesPollerTimeout extends Error {
  constructor(public readonly operationId: string, public readonly elapsedMs: number) {
    super(`Hawkes poller timed out after ${elapsedMs}ms (op ${operationId})`);
    this.name = 'HawkesPollerTimeout';
  }
}

export class HawkesPoller {
  private readonly baseRateMs: number;
  private readonly mu: number;
  private readonly beta: number;
  private readonly minIntervalMs: number;
  private readonly maxIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly deps: HawkesPollerDeps,
    opts: HawkesPollerOptions = {},
  ) {
    this.baseRateMs = opts.baseRateMs ?? 800;
    this.mu = opts.excitationMu ?? 0.002;
    this.beta = opts.decayBeta ?? 0.0008;
    this.minIntervalMs = opts.minIntervalMs ?? 250;
    this.maxIntervalMs = opts.maxIntervalMs ?? 5_000;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  /**
   * Poll until terminal. Returns `{ result, trace }` where `trace` records every
   * tick so the UI sparkline can render real intensity.
   */
  async poll<T = unknown>(operationId: string): Promise<{ result: HogOperationResult<T>; trace: HawkesPollTrace }> {
    const start = this.now();
    const eventTimes: number[] = [];
    const ticks: HawkesPollTrace['ticks'] = [];
    let idx = 0;

    while (true) {
      const tNow = this.now();
      const elapsed = tNow - start;
      if (elapsed >= this.timeoutMs) {
        throw new HawkesPollerTimeout(operationId, elapsed);
      }

      const result = await this.deps.getOperation<T>(operationId);
      const isTerminal = result.status === 'completed' || result.status === 'failed';

      // Record this tick.
      const lambda = this.intensityAt(tNow, eventTimes);
      const proposedDelay = 1 / Math.max(lambda, 1 / this.maxIntervalMs);
      const delayMs = clamp(proposedDelay, this.minIntervalMs, this.maxIntervalMs);
      ticks.push({ idx, t_ms: elapsed, delay_ms: isTerminal ? 0 : delayMs, lambda });

      if (isTerminal) {
        return { result, trace: { operation_id: operationId, ticks } };
      }

      // Self-excite on the non-terminal observation.
      eventTimes.push(tNow);
      idx += 1;

      // Avoid blowing past the timeout — clamp the sleep.
      const remaining = this.timeoutMs - elapsed;
      const actualSleep = Math.min(delayMs, Math.max(0, remaining - 10));
      if (actualSleep > 0) {
        await this.sleep(actualSleep);
      }
    }
  }

  /** λ(t) = λ₀ + Σ μ·exp(-β·(t - t_i)) for all past event times t_i. */
  private intensityAt(t: number, eventTimes: number[]): number {
    const baseline = 1 / this.baseRateMs;
    let excited = 0;
    for (const ti of eventTimes) {
      const dt = t - ti;
      if (dt < 0) continue;
      excited += this.mu * Math.exp(-this.beta * dt);
    }
    return baseline + excited;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
