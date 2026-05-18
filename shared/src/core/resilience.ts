/**
 * Resilience utilities: retry logic, circuit breakers, and timeout handling
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
  monitoringPeriodMs?: number;
  onStateChange?: (state: 'closed' | 'open' | 'half-open') => void;
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryableErrors = [],
    onRetry,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxAttempts) {
        break;
      }

      // Check if error is retryable
      const isRetryable =
        retryableErrors.length === 0 ||
        retryableErrors.includes(lastError.name) ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('rate limit') ||
        lastError.message.includes('429') ||
        lastError.message.includes('503') ||
        lastError.message.includes('502');

      if (!isRetryable) {
        throw lastError;
      }

      onRetry?.(attempt, lastError);
      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw new RetryError(
    `Operation failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastError!
  );
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private options: CircuitBreakerOptions = {}
  ) {
    const {
      failureThreshold = 5,
      recoveryTimeoutMs = 60000,
      monitoringPeriodMs = 10000,
    } = options;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.recoveryTimeoutMs!) {
        this.setState('half-open');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= 2) {
        this.setState('closed');
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold!) {
      this.setState('open');
    }
  }

  private setState(state: CircuitBreakerState): void {
    if (this.state !== state) {
      this.state = state;
      this.failureCount = 0;
      this.successCount = 0;
      this.options.onStateChange?.(state);
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.setState('closed');
    this.failureCount = 0;
    this.successCount = 0;
  }
}

/**
 * Timeout wrapper for async operations
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful degradation: return fallback value on error
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  shouldFallback?: (error: Error) => boolean
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (shouldFallback && !shouldFallback(err)) {
      throw err;
    }
    return fallback;
  }
}

/**
 * Execute multiple operations with graceful degradation
 */
export async function executeAllWithFallback<T>(
  operations: Array<{
    fn: () => Promise<T>;
    fallback: T;
    name?: string;
  }>,
  shouldFallback?: (error: Error) => boolean
): Promise<Array<{ success: boolean; value: T; name?: string }>> {
  return Promise.all(
    operations.map(async ({ fn, fallback, name }) => {
      try {
        const value = await fn();
        return { success: true, value, name };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (shouldFallback && !shouldFallback(err)) {
          throw err;
        }
        return { success: false, value: fallback, name };
      }
    })
  );
}
