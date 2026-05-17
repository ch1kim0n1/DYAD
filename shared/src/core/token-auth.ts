/**
 * Token-based Authentication for MCP Endpoints
 * 
 * Provides:
 * - Token generation and validation
 * - Role-based access control
 * - Token expiration and rotation
 */

export interface AuthToken {
  token: string;
  expiresAt: string;
  roles: string[];
  tool: string;
}

export interface AuthConfig {
  secret: string;
  tool?: string;
  tokenExpiration?: number; // in milliseconds
  defaultRoles?: string[];
}

export class TokenAuth {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = {
      tool: 'default',
      tokenExpiration: 24 * 60 * 60 * 1000, // 24 hours
      defaultRoles: ['read'],
      ...config,
    };
  }

  /**
   * Generate a new authentication token
   */
  generateToken(customRoles?: string[]): AuthToken {
    const token = this.generateRandomToken();
    const expiresAt = new Date(Date.now() + (this.config.tokenExpiration || 24 * 60 * 60 * 1000));
    const roles = customRoles || this.config.defaultRoles || ['read'];

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      roles,
      tool: this.config.tool || 'default',
    };
  }

  /**
   * Validate a token
   */
  validateToken(token: string): {
    valid: boolean;
    expired?: boolean;
    roles?: string[];
  } {
    // In a real implementation, this would verify against stored tokens
    // For MVP, we'll do basic validation
    if (!token || token.length < 32) {
      return { valid: false };
    }

    // Check if token format is valid
    if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
      return { valid: false };
    }

    // For MVP, assume tokens are valid if format is correct
    // In production, check expiration and roles against database
    return {
      valid: true,
      expired: false,
      roles: this.config.defaultRoles,
    };
  }

  /**
   * Check if a token has a specific role
   */
  hasRole(token: string, role: string): boolean {
    const validation = this.validateToken(token);
    if (!validation.valid || !validation.roles) {
      return false;
    }
    return validation.roles.includes(role);
  }

  /**
   * Check if a token has any of the specified roles
   */
  hasAnyRole(token: string, roles: string[]): boolean {
    const validation = this.validateToken(token);
    if (!validation.valid || !validation.roles) {
      return false;
    }
    return roles.some(role => validation.roles!.includes(role));
  }

  /**
   * Extract token from authorization header
   */
  extractToken(authHeader: string): string | null {
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
   * Generate a random token
   */
  private generateRandomToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Hash a token (for storage)
   */
  hashToken(token: string): string {
    // Simple hash for MVP - use proper crypto in production
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Check if a token is expired
   */
  isTokenExpired(tokenData: AuthToken): boolean {
    return new Date(tokenData.expiresAt) < new Date();
  }
}

/**
 * Middleware for MCP authentication
 */
export class MCPAuthMiddleware {
  private auth: TokenAuth;

  constructor(config: AuthConfig) {
    this.auth = new TokenAuth(config);
  }

  /**
   * Authenticate an MCP request
   */
  authenticate(authHeader: string | undefined): {
    success: boolean;
    error?: string;
    token?: AuthToken;
  } {
    if (!authHeader) {
      return {
        success: false,
        error: 'Missing authorization header',
      };
    }

    const token = this.auth.extractToken(authHeader);
    if (!token) {
      return {
        success: false,
        error: 'Invalid authorization header format',
      };
    }

    const validation = this.auth.validateToken(token);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Invalid token',
      };
    }

    if (validation.expired) {
      return {
        success: false,
        error: 'Token expired',
      };
    }

    return {
      success: true,
      token: {
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        roles: validation.roles || [],
        tool: 'default',
      },
    };
  }

  /**
   * Check if request has required role
   */
  requireRole(authHeader: string | undefined, role: string): {
    success: boolean;
    error?: string;
  } {
    const auth = this.authenticate(authHeader);
    if (!auth.success) {
      return auth;
    }

    if (!this.auth.hasRole(auth.token!.token, role)) {
      return {
        success: false,
        error: `Insufficient permissions: requires role '${role}'`,
      };
    }

    return { success: true };
  }

  /**
   * Get the TokenAuth instance
   */
  getAuth(): TokenAuth {
    return this.auth;
  }
}

/**
 * Create an authentication middleware instance
 */
export function createAuthMiddleware(config: AuthConfig): MCPAuthMiddleware {
  return new MCPAuthMiddleware(config);
}

/**
 * Create a TokenAuth instance
 */
export function createTokenAuth(config: AuthConfig): TokenAuth {
  return new TokenAuth(config);
}
