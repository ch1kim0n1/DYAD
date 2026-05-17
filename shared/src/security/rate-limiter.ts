/**
 * Rate Limiter Utility
 *
 * Provides rate limiting for public endpoints to prevent abuse and DoS attacks.
 * Uses a sliding window algorithm with configurable limits per scope/key.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

/**
 * In-memory rate limiter using sliding window algorithm
 */
export class RateLimiter {
  private store: Map<string, RateLimitEntry>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.store = new Map();
    
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), this.config.windowMs);
  }

  /**
   * Check if a request should be rate limited
   * @returns true if request is allowed, false if rate limited
   */
  check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      // First request in window
      this.store.set(key, {
        count: 1,
        windowStart: now,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
      };
    }

    // Check if window has expired
    if (now - entry.windowStart >= this.config.windowMs) {
      // Reset window
      this.store.set(key, {
        count: 1,
        windowStart: now,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.windowStart + this.config.windowMs,
      };
    }

    // Increment counter
    entry.count += 1;
    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.windowStart + this.config.windowMs,
    };
  }

  /**
   * Record a successful request (if skipSuccessfulRequests is false)
   */
  recordSuccess(key: string): void {
    if (!this.config.skipSuccessfulRequests) {
      // Already counted in check(), this is a no-op for the default implementation
    }
  }

  /**
   * Record a failed request (if skipFailedRequests is true)
   */
  recordFailure(key: string): void {
    if (this.config.skipFailedRequests) {
      const entry = this.store.get(key);
      if (entry && entry.count > 0) {
        entry.count -= 1;
        this.store.set(key, entry);
      }
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart >= this.config.windowMs) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get current statistics
   */
  getStats(): { totalKeys: number; activeKeys: number } {
    const now = Date.now();
    let activeKeys = 0;
    
    for (const entry of this.store.values()) {
      if (now - entry.windowStart < this.config.windowMs) {
        activeKeys++;
      }
    }

    return {
      totalKeys: this.store.size,
      activeKeys,
    };
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const RateLimitPresets = {
  strict: new RateLimiter({ maxRequests: 10, windowMs: 60000 }), // 10 req/min
  moderate: new RateLimiter({ maxRequests: 100, windowMs: 60000 }), // 100 req/min
  lenient: new RateLimiter({ maxRequests: 1000, windowMs: 60000 }), // 1000 req/min
  burst: new RateLimiter({ maxRequests: 5, windowMs: 1000 }), // 5 req/sec burst protection
};

/**
 * Rate limiter for Express.js middleware
 */
export function expressRateLimiter(limiter: RateLimiter, keyExtractor: (req: any) => string) {
  return (req: any, res: any, next: any) => {
    const key = keyExtractor(req);
    const result = limiter.check(key);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limiter['config'].maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
    }

    // Track success/failure
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      if (res.statusCode < 400) {
        limiter.recordSuccess(key);
      } else {
        limiter.recordFailure(key);
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Key extractors for common use cases
 */
export const KeyExtractors = {
  byIP: (req: any) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  byAPIKey: (req: any) => {
    return req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || 'anonymous';
  },
  byUser: (req: any) => {
    return req.user?.id || req.session?.userId || 'anonymous';
  },
  byRoute: (req: any) => {
    return `${req.ip}:${req.method}:${req.path}`;
  },
};

/**
 * Distributed rate limiter interface (for future Redis implementation)
 */
export interface DistributedRateLimiter {
  check(key: string, config: RateLimitConfig): Promise<{ allowed: boolean; remaining: number; resetTime: number }>;
  reset(key: string): Promise<void>;
}

/**
 * Simple in-memory rate limiter factory
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}
