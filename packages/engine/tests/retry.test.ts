import { describe, it, expect } from 'bun:test';
import { withRetry } from '../src/utils/retry.js';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

describe('issue #94: withRetry', () => {
  it('returns immediately on first-attempt success', async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls++; return 42; }, { maxAttempts: 3, baseDelayMs: 1 });
    expect(r).toBe(42);
    expect(calls).toBe(1);
  });

  it('retries on 429 and eventually succeeds', async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new HttpError(429, 'rate limit');
      return 'ok';
    }, { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 5 });
    expect(r).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry on 401', async () => {
    let calls = 0;
    await expect(withRetry(async () => {
      calls++;
      throw new HttpError(401, 'unauthorised');
    }, { maxAttempts: 5, baseDelayMs: 1 })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it('gives up after maxAttempts on persistent 5xx', async () => {
    let calls = 0;
    await expect(withRetry(async () => {
      calls++;
      throw new HttpError(503, 'overloaded');
    }, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 })).rejects.toThrow();
    expect(calls).toBe(3);
  });

  it('calls onRetry hook between attempts', async () => {
    const seen: number[] = [];
    await expect(withRetry(
      async () => { throw new HttpError(429, 'rate'); },
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5, onRetry: ({ attempt }) => seen.push(attempt) },
    )).rejects.toThrow();
    // Two retries between three attempts
    expect(seen).toEqual([1, 2]);
  });
});
