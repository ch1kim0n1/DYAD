/**
 * LLM call telemetry (#85). One process-wide sink that every wrapper
 * (LlmExtractor, BriefGenerator, ReframeGenerator, PrimarySecondary,
 * EthicalRefusal) registers durations + failures with. Aggregated
 * per-operation counts and rates are exposed via `getTelemetry().summary()`
 * and the sidecar's `/debug` endpoint.
 *
 * Cost is *not* tracked here — that's the cost-meter (#65) — but
 * telemetry includes token counts so a consumer can correlate the two.
 */
import { child } from './logger.js';
import { getCostMeter } from './cost-meter.js';

const log = child('telemetry');

export type Operation =
  | 'l2_extraction'
  | 'ethical_refusal'
  | 'secondary_emotion'
  | 'brief'
  | 'reframe';

interface CallRecord {
  operation: Operation;
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  errorType?: string;
  cacheHit?: boolean;
  at: number;
}

export interface OperationSummary {
  operation: Operation;
  count: number;
  failures: number;
  avgMs: number;
  p95Ms: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface TelemetrySummary {
  totalCalls: number;
  totalFailures: number;
  avgMs: number;
  estCostUsd: number;
  byOperation: OperationSummary[];
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

export class Telemetry {
  private records: CallRecord[] = [];

  record(r: CallRecord): void {
    this.records.push(r);
    log.debug(r, 'llm call');
  }

  /** Aggregate per-operation stats + a global summary. */
  summary(): TelemetrySummary {
    const meter = getCostMeter();
    const ops = ['l2_extraction','ethical_refusal','secondary_emotion','brief','reframe'] as const;
    const byOperation: OperationSummary[] = ops.map((op): OperationSummary => {
      const slice = this.records.filter(r => r.operation === op);
      const durations = slice.map(r => r.durationMs);
      return {
        operation: op,
        count: slice.length,
        failures: slice.filter(r => !r.success).length,
        avgMs: slice.length ? durations.reduce((a, b) => a + b, 0) / slice.length : 0,
        p95Ms: percentile(durations, 0.95),
        totalInputTokens: slice.reduce((s, r) => s + r.inputTokens, 0),
        totalOutputTokens: slice.reduce((s, r) => s + r.outputTokens, 0),
      };
    });
    return {
      totalCalls: this.records.length,
      totalFailures: this.records.filter(r => !r.success).length,
      avgMs: this.records.length
        ? this.records.reduce((s, r) => s + r.durationMs, 0) / this.records.length
        : 0,
      estCostUsd: meter.totalUsd(),
      byOperation,
    };
  }

  /** One-line summary for shutdown / 30-minute interval logs. */
  oneLine(): string {
    const s = this.summary();
    return `LLM Summary: ${s.totalCalls} calls | avg ${Math.round(s.avgMs)}ms | ${s.totalFailures} failures | est cost $${s.estCostUsd.toFixed(4)}`;
  }

  reset(): void { this.records = []; }
}

let _t: Telemetry | null = null;
export function getTelemetry(): Telemetry {
  if (!_t) _t = new Telemetry();
  return _t;
}

/**
 * `tracedLlmCall` — wrap an Anthropic call to (a) time it, (b) record
 * success/failure to telemetry, and (c) capture token counts from
 * `response.usage`.
 *
 * The `fn` returns the Anthropic response so the wrapper can read
 * `usage` itself; the unwrapped return is whatever the caller does
 * with the response.
 */
export async function tracedLlmCall<R extends { usage?: { input_tokens?: number; output_tokens?: number } }>(
  operation: Operation,
  model: string,
  fn: () => Promise<R>,
): Promise<R> {
  const t = getTelemetry();
  const t0 = Date.now();
  try {
    const r = await fn();
    t.record({
      operation, model,
      durationMs: Date.now() - t0,
      inputTokens: r.usage?.input_tokens ?? 0,
      outputTokens: r.usage?.output_tokens ?? 0,
      success: true,
      at: t0,
    });
    return r;
  } catch (err) {
    t.record({
      operation, model,
      durationMs: Date.now() - t0,
      inputTokens: 0,
      outputTokens: 0,
      success: false,
      errorType: (err as Error)?.name ?? 'Error',
      at: t0,
    });
    throw err;
  }
}
