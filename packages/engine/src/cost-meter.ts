/**
 * Session-wide LLM call counter + cost estimator (#65).
 *
 * One instance per process: every wrapper (LlmExtractor, BriefGenerator,
 * ReframeGenerator, PrimarySecondaryDetector, EthicalRefusalClassifier)
 * registers its model name + token usage here so we can:
 *   1. Enforce `MAX_LLM_CALLS_PER_SESSION` (env-configurable, default 500)
 *   2. Print a running cost estimate for cost audits
 *   3. Surface a > $1.00 warning in the UI via `getSession().alertThreshold`
 *
 * Pricing as of 2025-05 (per 1M tokens, USD):
 *   - claude-haiku-4-5:   input $0.80, output $4.00
 *   - claude-sonnet-4-6:  input $3.00, output $15.00
 *
 * Pricing is intentionally hard-coded — the meter is a guardrail, not an
 * exact accountancy tool. Refresh values when Anthropic prices change.
 */

interface ModelPrice { input: number; output: number }

const PRICES: Record<string, ModelPrice> = {
  'claude-haiku-4-5':       { input: 0.80, output: 4.00 },
  'claude-haiku-4-20250514':{ input: 0.80, output: 4.00 },
  'claude-sonnet-4-6':      { input: 3.00, output: 15.00 },
};
const DEFAULT_PRICE: ModelPrice = { input: 3.00, output: 15.00 };

export interface CostRecord {
  model: string;
  input_tokens: number;
  output_tokens: number;
  usd: number;
  at: number;
  caller: string;
}

const MAX_CALLS_DEFAULT = 500;
const ALERT_THRESHOLD_USD_DEFAULT = 1.0;

export class CostMeter {
  private records: CostRecord[] = [];
  private maxCalls: number;
  private alertThresholdUsd: number;
  private alerted = false;

  constructor(opts: { maxCalls?: number; alertThresholdUsd?: number } = {}) {
    this.maxCalls = opts.maxCalls ?? Number(process.env.MAX_LLM_CALLS_PER_SESSION ?? MAX_CALLS_DEFAULT);
    this.alertThresholdUsd = opts.alertThresholdUsd ?? Number(process.env.DYAD_COST_ALERT_USD ?? ALERT_THRESHOLD_USD_DEFAULT);
  }

  /**
   * Call BEFORE issuing an LLM request. Throws when the configured cap is
   * exceeded — the LLM wrapper is expected to surface this as a normal
   * error to the orchestrator, which surfaces it to the UI.
   */
  guard(caller: string): void {
    if (this.records.length >= this.maxCalls) {
      throw new Error(
        `[cost-meter] MAX_LLM_CALLS_PER_SESSION (${this.maxCalls}) reached while attempting ${caller}. ` +
        `Raise the cap or restart the session.`
      );
    }
  }

  record(caller: string, model: string, inputTokens: number, outputTokens: number): void {
    const price = PRICES[model] ?? DEFAULT_PRICE;
    const usd =
      (inputTokens / 1_000_000) * price.input +
      (outputTokens / 1_000_000) * price.output;
    const rec: CostRecord = { caller, model, input_tokens: inputTokens, output_tokens: outputTokens, usd, at: Date.now() };
    this.records.push(rec);
    if (process.env.DYAD_LOG_COSTS === '1') {
      console.log(`[cost-meter] ${caller} ${model} in=${inputTokens} out=${outputTokens} $${usd.toFixed(5)} (running $${this.totalUsd().toFixed(4)})`);
    }
    if (!this.alerted && this.totalUsd() > this.alertThresholdUsd) {
      this.alerted = true;
      console.warn(`[cost-meter] session cost crossed $${this.alertThresholdUsd.toFixed(2)} threshold (now $${this.totalUsd().toFixed(2)})`);
    }
  }

  totalCalls(): number { return this.records.length; }
  totalUsd(): number { return this.records.reduce((s, r) => s + r.usd, 0); }
  perModel(): Record<string, { calls: number; usd: number; in: number; out: number }> {
    const out: Record<string, { calls: number; usd: number; in: number; out: number }> = {};
    for (const r of this.records) {
      const e = out[r.model] ?? (out[r.model] = { calls: 0, usd: 0, in: 0, out: 0 });
      e.calls++; e.usd += r.usd; e.in += r.input_tokens; e.out += r.output_tokens;
    }
    return out;
  }
  reset(): void { this.records = []; this.alerted = false; }
  isAlerted(): boolean { return this.alerted; }
  getMaxCalls(): number { return this.maxCalls; }
}

// Process-wide singleton. The CLI scripts and the engine sidecar share it.
let _meter: CostMeter | null = null;
export function getCostMeter(): CostMeter {
  if (!_meter) _meter = new CostMeter();
  return _meter;
}
export function setCostMeter(m: CostMeter): void { _meter = m; }
