import {
  TokenAuth,
  MCPAuthMiddleware,
  AuthToken,
  AuthConfig,
  createTokenAuth,
  createAuthMiddleware,
} from '../src/core/token-auth';

const baseConfig: AuthConfig = {
  secret: 'test-secret-key',
  tool: 'test-tool',
  tokenExpiration: 60 * 60 * 1000, // 1 hour
  defaultRoles: ['read', 'write'],
};

describe('TokenAuth', () => {
  let auth: TokenAuth;

  beforeEach(() => {
    auth = createTokenAuth(baseConfig);
  });

  describe('generateToken', () => {
    it('returns token with expiresAt, roles, and tool fields', () => {
      const token = auth.generateToken();
      expect(typeof token.token).toBe('string');
      expect(token.token.length).toBeGreaterThanOrEqual(32);
      expect(typeof token.expiresAt).toBe('string');
      expect(Array.isArray(token.roles)).toBe(true);
      expect(token.tool).toBe('test-tool');
    });

    it('expiresAt is in the future', () => {
      const token = auth.generateToken();
      expect(new Date(token.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('uses defaultRoles when no custom roles provided', () => {
      const token = auth.generateToken();
      expect(token.roles).toEqual(['read', 'write']);
    });

    it('uses custom roles when provided', () => {
      const token = auth.generateToken(['admin']);
      expect(token.roles).toEqual(['admin']);
    });
  });

  describe('validateToken', () => {
    it('returns valid for a properly formatted fresh token', () => {
      const token = auth.generateToken();
      const result = auth.validateToken(token.token);
      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
    });

    it('returns invalid for a short token', () => {
      const result = auth.validateToken('short');
      expect(result.valid).toBe(false);
    });

    it('returns invalid for empty string', () => {
      const result = auth.validateToken('');
      expect(result.valid).toBe(false);
    });

    it('returns invalid for token with invalid characters', () => {
      const result = auth.validateToken('a'.repeat(32) + '!@#$');
      expect(result.valid).toBe(false);
    });
  });

  describe('isTokenExpired', () => {
    it('returns false for future expiry', () => {
      const token = auth.generateToken();
      expect(auth.isTokenExpired(token)).toBe(false);
    });

    it('returns true for past expiry', () => {
      const expiredToken: AuthToken = {
        token: 'a'.repeat(64),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        roles: ['read'],
        tool: 'test-tool',
      };
      expect(auth.isTokenExpired(expiredToken)).toBe(true);
    });
  });

  describe('hasRole', () => {
    it('returns true when token has the role', () => {
      const token = auth.generateToken(['admin', 'read']);
      // validateToken returns defaultRoles for valid tokens in MVP
      expect(auth.hasRole(token.token, 'read')).toBe(true);
    });

    it('returns false for invalid token', () => {
      expect(auth.hasRole('bad', 'admin')).toBe(false);
    });
  });

  describe('extractToken', () => {
    it('extracts token from valid Bearer header', () => {
      const result = auth.extractToken('Bearer mytoken12345');
      expect(result).toBe('mytoken12345');
    });

    it('returns null for missing header', () => {
      expect(auth.extractToken('')).toBeNull();
    });

    it('returns null for non-Bearer scheme', () => {
      expect(auth.extractToken('Basic abc123')).toBeNull();
    });
  });

  describe('rotateToken (via generateToken re-call)', () => {
    it('generates a different token on successive calls', () => {
      const t1 = auth.generateToken();
      const t2 = auth.generateToken();
      expect(t1.token).not.toBe(t2.token);
    });
  });
});

describe('MCPAuthMiddleware', () => {
  let middleware: MCPAuthMiddleware;

  beforeEach(() => {
    middleware = createAuthMiddleware(baseConfig);
  });

  describe('authenticate', () => {
    it('succeeds with a valid Bearer header containing a well-formed token', () => {
      const innerAuth = middleware.getAuth();
      const token = innerAuth.generateToken();
      const result = middleware.authenticate(`Bearer ${token.token}`);
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('fails with missing header', () => {
      const result = middleware.authenticate(undefined);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/missing/i);
    });

    it('fails with wrong token format (short)', () => {
      const result = middleware.authenticate('Bearer short');
      expect(result.success).toBe(false);
    });

    it('fails with invalid header format (no Bearer)', () => {
      const result = middleware.authenticate('InvalidToken');
      expect(result.success).toBe(false);
    });
  });

  describe('requireRole', () => {
    it('passes for a role that the token has', () => {
      const innerAuth = middleware.getAuth();
      const token = innerAuth.generateToken();
      // MVP validateToken returns defaultRoles which includes 'read' and 'write'
      const result = middleware.requireRole(`Bearer ${token.token}`, 'read');
      expect(result.success).toBe(true);
    });

    it('fails for a role the token does not have', () => {
      const innerAuth = middleware.getAuth();
      const token = innerAuth.generateToken();
      // Default roles are ['read', 'write'], 'superadmin' is not included
      const result = middleware.requireRole(`Bearer ${token.token}`, 'superadmin');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insufficient/i);
    });

    it('fails when auth header is missing', () => {
      const result = middleware.requireRole(undefined, 'read');
      expect(result.success).toBe(false);
    });
  });
});
