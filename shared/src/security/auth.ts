/**
 * Authentication Utility
 *
 * Provides token-based authentication for MCP endpoints and other protected APIs.
 * Supports Bearer token validation, scope-based access control, and token rotation.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Access scope levels
 */
export enum AccessScope {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
}

/**
 * Token information
 */
export interface TokenInfo {
  tokenHash: string;
  scopes: AccessScope[];
  createdAt: number;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

/**
 * Authentication result
 */
export interface AuthResult {
  valid: boolean;
  scopes?: AccessScope[];
  error?: string;
}

/**
 * Token-based authenticator
 */
export class TokenAuthenticator {
  private tokens: Map<string, TokenInfo>;
  private secretKey: string;

  constructor(secretKey: string = process.env.AUTH_SECRET_KEY || randomBytes(32).toString('hex')) {
    this.secretKey = secretKey;
    this.tokens = new Map();
  }

  /**
   * Generate a new token with specified scopes
   */
  generateToken(scopes: AccessScope[], expiresIn?: number): string {
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    
    const tokenInfo: TokenInfo = {
      tokenHash: this.hashToken(token),
      scopes,
      createdAt: now,
      expiresAt: expiresIn ? now + expiresIn : undefined,
    };

    this.tokens.set(tokenHashToKey(tokenInfo.tokenHash), tokenInfo);
    return token;
  }

  /**
   * Validate a token and return its scopes if valid
   */
  validateToken(token: string): AuthResult {
    const tokenHash = this.hashToken(token);
    const key = tokenHashToKey(tokenHash);
    const tokenInfo = this.tokens.get(key);

    if (!tokenInfo) {
      return { valid: false, error: 'Invalid token' };
    }

    // Check expiration
    if (tokenInfo.expiresAt && Date.now() > tokenInfo.expiresAt) {
      this.tokens.delete(key);
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      scopes: tokenInfo.scopes,
    };
  }

  /**
   * Check if a token has a specific scope
   */
  hasScope(token: string, scope: AccessScope): boolean {
    const result = this.validateToken(token);
    if (!result.valid || !result.scopes) {
      return false;
    }
    return result.scopes.includes(scope);
  }

  /**
   * Revoke a token
   */
  revokeToken(token: string): boolean {
    const tokenHash = this.hashToken(token);
    const key = tokenHashToKey(tokenHash);
    return this.tokens.delete(key);
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, tokenInfo] of this.tokens.entries()) {
      if (tokenInfo.expiresAt && now > tokenInfo.expiresAt) {
        this.tokens.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Hash a token for storage
   */
  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token + this.secretKey)
      .digest('hex');
  }

  /**
   * Get token statistics
   */
  getStats(): { totalTokens: number; expiredTokens: number } {
    const now = Date.now();
    let expired = 0;

    for (const tokenInfo of this.tokens.values()) {
      if (tokenInfo.expiresAt && now > tokenInfo.expiresAt) {
        expired++;
      }
    }

    return {
      totalTokens: this.tokens.size,
      expiredTokens: expired,
    };
  }
}

/**
 * Convert token hash to storage key
 */
function tokenHashToKey(hash: string): string {
  return hash;
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Extract token from query parameter
 */
export function extractQueryToken(query: any): string | null {
  if (typeof query !== 'object' || query === null) {
    return null;
  }

  return query.token || query.api_key || null;
}

/**
 * Scope-based access control checker
 */
export class AccessControl {
  private authenticator: TokenAuthenticator;

  constructor(authenticator: TokenAuthenticator) {
    this.authenticator = authenticator;
  }

  /**
   * Check if a request has the required scope
   */
  checkScope(token: string, requiredScope: AccessScope): boolean {
    return this.authenticator.hasScope(token, requiredScope);
  }

  /**
   * Check if a request has any of the required scopes
   */
  checkAnyScope(token: string, requiredScopes: AccessScope[]): boolean {
    const result = this.authenticator.validateToken(token);
    if (!result.valid || !result.scopes) {
      return false;
    }
    return requiredScopes.some(scope => result.scopes!.includes(scope));
  }

  /**
   * Check if a request has all of the required scopes
   */
  checkAllScopes(token: string, requiredScopes: AccessScope[]): boolean {
    const result = this.authenticator.validateToken(token);
    if (!result.valid || !result.scopes) {
      return false;
    }
    return requiredScopes.every(scope => result.scopes!.includes(scope));
  }
}

/**
 * Express.js middleware for token authentication
 */
export function authMiddleware(authenticator: TokenAuthenticator, requiredScopes?: AccessScope[]) {
  return (req: any, res: any, next: any) => {
    // Try to extract token from Authorization header
    let token = extractBearerToken(req.headers.authorization);
    
    // Fall back to query parameter
    if (!token) {
      token = extractQueryToken(req.query);
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token',
      });
    }

    const result = authenticator.validateToken(token);

    if (!result.valid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: result.error || 'Invalid token',
      });
    }

    // Check scopes if required
    if (requiredScopes && requiredScopes.length > 0) {
      const accessControl = new AccessControl(authenticator);
      
      if (!accessControl.checkAllScopes(token, requiredScopes)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
          required: requiredScopes,
          provided: result.scopes,
        });
      }
    }

    // Attach token info to request
    req.auth = {
      token,
      scopes: result.scopes,
    };

    next();
  };
}

/**
 * Pre-configured authenticator singleton
 */
let defaultAuthenticator: TokenAuthenticator | null = null;

export function getDefaultAuthenticator(): TokenAuthenticator {
  if (!defaultAuthenticator) {
    defaultAuthenticator = new TokenAuthenticator();
  }
  return defaultAuthenticator;
}

/**
 * Initialize default authenticator with environment tokens
 */
export function initializeAuthFromEnv(): void {
  const authenticator = getDefaultAuthenticator();
  
  // Read tokens from environment variable
  const tokensEnv = process.env.AUTH_TOKENS;
  if (tokensEnv) {
    try {
      const tokenConfigs = JSON.parse(tokensEnv);
      for (const config of tokenConfigs) {
        if (config.token && config.scopes) {
          const tokenHash = authenticator['hashToken'](config.token);
          const key = tokenHashToKey(tokenHash);
          authenticator['tokens'].set(key, {
            tokenHash,
            scopes: config.scopes,
            createdAt: Date.now(),
            expiresAt: config.expiresIn ? Date.now() + config.expiresIn : undefined,
            metadata: config.metadata,
          });
        }
      }
    } catch (error) {
      console.warn('[Auth] Failed to parse AUTH_TOKENS environment variable');
    }
  }

  // Schedule cleanup
  setInterval(() => {
    const cleaned = authenticator.cleanupExpiredTokens();
    if (cleaned > 0) {
      console.log(`[Auth] Cleaned up ${cleaned} expired tokens`);
    }
  }, 3600000); // Every hour
}
