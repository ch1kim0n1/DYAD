/**
 * MCP Scope-Based Auth and Rate Limiting
 * 
 * Provides:
 * - Scope-based authorization (read, write, admin scopes)
 * - Token-based authentication with JWT-like tokens
 * - Rate limiting per scope and token
 * - Token revocation support
 */

export interface TokenInfo {
  token: string;
  scopes: string[];
  rate_limit: {
    requests_per_minute: number;
    requests_per_hour: number;
  };
  expires_at: string;
  created_at: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
}

export interface AuthResult {
  authorized: boolean;
  token_info: TokenInfo | null;
  error?: string;
}

export class AuthRateLimiter {
  private tokens: Map<string, TokenInfo>;
  private usage: Map<string, { count: number; window_start: number }>;
  private defaultRateLimit: { rpm: number; rph: number };

  constructor(defaultRateLimit: { rpm: number; rph: number } = { rpm: 60, rph: 1000 }) {
    this.tokens = new Map();
    this.usage = new Map();
    this.defaultRateLimit = defaultRateLimit;
  }

  /**
   * Create a new token
   */
  createToken(scopes: string[], expiresInHours: number = 24): TokenInfo {
    const token = this.generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

    const tokenInfo: TokenInfo = {
      token,
      scopes,
      rate_limit: {
        requests_per_minute: this.defaultRateLimit.rpm,
        requests_per_hour: this.defaultRateLimit.rph,
      },
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    };

    this.tokens.set(token, tokenInfo);
    return tokenInfo;
  }

  /**
   * Revoke a token
   */
  revokeToken(token: string): boolean {
    return this.tokens.delete(token);
  }

  /**
   * Validate a token
   */
  validateToken(token: string): AuthResult {
    const tokenInfo = this.tokens.get(token);

    if (!tokenInfo) {
      return { authorized: false, token_info: null, error: 'Invalid token' };
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(tokenInfo.expires_at);
    if (now > expiresAt) {
      this.tokens.delete(token);
      return { authorized: false, token_info: null, error: 'Token expired' };
    }

    return { authorized: true, token_info: tokenInfo };
  }

  /**
   * Check if a token has required scopes
   */
  hasScopes(token: string, requiredScopes: string[]): boolean {
    const result = this.validateToken(token);
    if (!result.authorized || !result.token_info) {
      return false;
    }

    const tokenScopes = result.token_info.scopes;
    return requiredScopes.every(scope => tokenScopes.includes(scope));
  }

  /**
   * Check rate limit for a token
   */
  async checkRateLimit(token: string): Promise<RateLimitResult> {
    const result = this.validateToken(token);
    if (!result.authorized || !result.token_info) {
      return { allowed: false, remaining: 0, reset_at: new Date().toISOString() };
    }

    const tokenInfo = result.token_info;
    const now = Date.now();
    const minuteWindow = 60 * 1000;
    const hourWindow = 60 * 60 * 1000;

    const usageKey = `${token}_minute`;
    const hourlyUsageKey = `${token}_hour`;

    // Get or create minute usage
    let minuteUsage = this.usage.get(usageKey);
    if (!minuteUsage || now - minuteUsage.window_start > minuteWindow) {
      minuteUsage = { count: 0, window_start: now };
      this.usage.set(usageKey, minuteUsage);
    }

    // Get or create hour usage
    let hourlyUsage = this.usage.get(hourlyUsageKey);
    if (!hourlyUsage || now - hourlyUsage.window_start > hourWindow) {
      hourlyUsage = { count: 0, window_start: now };
      this.usage.set(hourlyUsageKey, hourlyUsage);
    }

    // Check limits
    const minuteLimit = tokenInfo.rate_limit.requests_per_minute;
    const hourLimit = tokenInfo.rate_limit.requests_per_hour;

    if (minuteUsage.count >= minuteLimit || hourlyUsage.count >= hourLimit) {
      const resetTime = Math.max(
        minuteUsage.window_start + minuteWindow,
        hourlyUsage.window_start + hourWindow
      );
      return {
        allowed: false,
        remaining: 0,
        reset_at: new Date(resetTime).toISOString(),
      };
    }

    // Increment counters
    minuteUsage.count++;
    hourlyUsage.count++;

    const remaining = Math.min(
      minuteLimit - minuteUsage.count,
      hourLimit - hourlyUsage.count
    );

    return {
      allowed: true,
      remaining,
      reset_at: new Date(minuteUsage.window_start + minuteWindow).toISOString(),
    };
  }

  /**
   * Authorize and check rate limit in one call
   */
  async authorize(token: string, requiredScopes: string[]): Promise<{
    authorized: boolean;
    rate_limit: RateLimitResult;
    error?: string;
  }> {
    const authResult = this.validateToken(token);
    if (!authResult.authorized) {
      return {
        authorized: false,
        rate_limit: { allowed: false, remaining: 0, reset_at: new Date().toISOString() },
        error: authResult.error,
      };
    }

    if (!this.hasScopes(token, requiredScopes)) {
      return {
        authorized: false,
        rate_limit: { allowed: false, remaining: 0, reset_at: new Date().toISOString() },
        error: 'Insufficient scopes',
      };
    }

    const rateLimitResult = await this.checkRateLimit(token);
    return {
      authorized: rateLimitResult.allowed,
      rate_limit: rateLimitResult,
    };
  }

  /**
   * Get usage statistics for a token
   */
  getUsageStats(token: string): {
    minute_requests: number;
    hour_requests: number;
  } {
    const minuteUsage = this.usage.get(`${token}_minute`);
    const hourlyUsage = this.usage.get(`${token}_hour`);

    return {
      minute_requests: minuteUsage?.count || 0,
      hour_requests: hourlyUsage?.count || 0,
    };
  }

  /**
   * Clean up expired tokens and old usage data
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    // Clean expired tokens
    for (const [token, tokenInfo] of this.tokens.entries()) {
      const expiresAt = new Date(tokenInfo.expires_at).getTime();
      if (now > expiresAt) {
        this.tokens.delete(token);
        this.usage.delete(`${token}_minute`);
        this.usage.delete(`${token}_hour`);
        cleaned++;
      }
    }

    // Clean old usage data (older than 1 hour)
    const hourWindow = 60 * 60 * 1000;
    for (const [key, usage] of this.usage.entries()) {
      if (now - usage.window_start > hourWindow) {
        this.usage.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Generate a random token
   */
  private generateToken(): string {
    const crypto = require('node:crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get all active tokens
   */
  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokens.values());
  }

  /**
   * Get token count
   */
  getTokenCount(): number {
    return this.tokens.size;
  }
}
