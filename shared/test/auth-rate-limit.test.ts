import { AuthRateLimiter } from '../src/core/auth-rate-limit';

describe('AuthRateLimiter', () => {
  let limiter: AuthRateLimiter;

  beforeEach(() => {
    // Low limits for testing
    limiter = new AuthRateLimiter({ rpm: 3, rph: 100 });
  });

  it('check() allows first request (creates token and checks rate limit)', async () => {
    const tokenInfo = limiter.createToken(['read']);
    const result = await limiter.checkRateLimit(tokenInfo.token);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it('check() allows up to max requests within window', async () => {
    const tokenInfo = limiter.createToken(['read']);
    for (let i = 0; i < 3; i++) {
      const result = await limiter.checkRateLimit(tokenInfo.token);
      expect(result.allowed).toBe(true);
    }
  });

  it('check() blocks request over max (rpm=3, 4th request blocked)', async () => {
    const tokenInfo = limiter.createToken(['read']);
    // Consume all 3 slots
    await limiter.checkRateLimit(tokenInfo.token);
    await limiter.checkRateLimit(tokenInfo.token);
    await limiter.checkRateLimit(tokenInfo.token);
    // 4th should be blocked
    const result = await limiter.checkRateLimit(tokenInfo.token);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('check() returns reset_at timestamp when blocked', async () => {
    const tokenInfo = limiter.createToken(['read']);
    for (let i = 0; i < 3; i++) {
      await limiter.checkRateLimit(tokenInfo.token);
    }
    const result = await limiter.checkRateLimit(tokenInfo.token);
    expect(result.allowed).toBe(false);
    expect(typeof result.reset_at).toBe('string');
    expect(new Date(result.reset_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('different tokens tracked independently', async () => {
    const t1 = limiter.createToken(['read']);
    const t2 = limiter.createToken(['read']);
    // Exhaust t1
    for (let i = 0; i < 3; i++) await limiter.checkRateLimit(t1.token);
    const blockedResult = await limiter.checkRateLimit(t1.token);
    expect(blockedResult.allowed).toBe(false);
    // t2 should still be allowed
    const t2Result = await limiter.checkRateLimit(t2.token);
    expect(t2Result.allowed).toBe(true);
  });

  it('validateToken returns authorized=true for valid non-expired token', () => {
    const tokenInfo = limiter.createToken(['read', 'write']);
    const result = limiter.validateToken(tokenInfo.token);
    expect(result.authorized).toBe(true);
    expect(result.token_info).not.toBeNull();
    expect(result.token_info!.scopes).toContain('read');
  });

  it('validateToken returns authorized=false for unknown token', () => {
    const result = limiter.validateToken('nonexistent-token');
    expect(result.authorized).toBe(false);
    expect(result.token_info).toBeNull();
  });

  it('revokeToken removes token from store', () => {
    const tokenInfo = limiter.createToken(['read']);
    expect(limiter.getTokenCount()).toBe(1);
    limiter.revokeToken(tokenInfo.token);
    expect(limiter.getTokenCount()).toBe(0);
    const result = limiter.validateToken(tokenInfo.token);
    expect(result.authorized).toBe(false);
  });
});
