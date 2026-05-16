/**
 * Exponential-backoff retry for Anthropic (and any other) HTTP calls (#94).
 *
 * - Retries only on 429 / 529 (rate limit / overload) and network errors.
 * - 4xx other than 429 is non-retryable (auth, bad request).
 * - Delay: `min(baseDelay * 2^attempt + jitter, maxDelay)`.
 * - Calls the optional `onRetry` hook so loggers can record each attempt.
 */
export interface RetryOptions {
  maxAttempts?: number;       // total attempts including the first
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

const DEFAULTS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
};

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode;
  if (status === 429 || status === 529) return true;
  if (typeof status === 'number' && status >= 500) return true;
  // Network failures (no status set)
  const msg = (err as Error)?.message ?? '';
  return /ECONNRESET|ETIMEDOUT|fetch failed|network|socket hang up/i.test(msg);
}

function delayFor(attempt: number, base: number, max: number): number {
  const exp = base * Math.pow(2, attempt);
  const jitter = Math.random() * base;
  return Math.min(exp + jitter, max);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULTS, ...options };
  let lastErr: unknown;
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === opts.maxAttempts - 1) break;
      if (!isRetryable(err)) break;
      const d = delayFor(attempt, opts.baseDelayMs, opts.maxDelayMs);
      options.onRetry?.({ attempt: attempt + 1, delayMs: d, error: err });
      await new Promise(r => setTimeout(r, d));
    }
  }
  throw lastErr;
}
