import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { createLogger } from '../logger';
import { auditLogger, AuditAction, AuditResource } from './audit-log';

const logger = createLogger('auth');

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

/**
 * Authentication and user management
 * Implements secure password hashing, session management, and multi-user support
 */
export class AuthService {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private sessionTimeout: number; // milliseconds
  private maxSessionsPerUser: number;

  constructor(sessionTimeout: number = 24 * 60 * 60 * 1000, maxSessionsPerUser: number = 5) {
    this.sessionTimeout = sessionTimeout;
    this.maxSessionsPerUser = maxSessionsPerUser;
  }

  /**
   * Register a new user
   */
  async register(params: {
    email: string;
    password: string;
    name: string;
    role?: 'admin' | 'user' | 'viewer';
  }): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existing = this.findByEmail(params.email);
      if (existing) {
        return {
          success: false,
          error: 'User already exists',
        };
      }

      // Generate salt and hash password
      const salt = randomBytes(16).toString('hex');
      const passwordHash = this.hashPassword(params.password, salt);

      const user: User = {
        id: this.generateId(),
        email: params.email.toLowerCase(),
        passwordHash,
        salt,
        name: params.name,
        role: params.role || 'user',
        createdAt: new Date(),
        isActive: true,
      };

      this.users.set(user.id, user);

      auditLogger.log({
        action: AuditAction.CREATE,
        resource: AuditResource.USER,
        resourceId: user.id,
        details: { email: user.email, role: user.role },
        success: true,
      });

      logger.info(`User registered: ${user.email}`);
      
      return {
        success: true,
        user,
      };
    } catch (error) {
      logger.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed',
      };
    }
  }

  /**
   * Authenticate user
   */
  async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResult> {
    try {
      const user = this.findByEmail(params.email);
      if (!user) {
        auditLogger.logAuthFailure({
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          reason: 'User not found',
        });
        
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      if (!user.isActive) {
        auditLogger.logAuthFailure({
          userId: user.id,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          reason: 'Account inactive',
        });
        
        return {
          success: false,
          error: 'Account inactive',
        };
      }

      const passwordHash = this.hashPassword(params.password, user.salt);
      if (!timingSafeEqual(Buffer.from(passwordHash), Buffer.from(user.passwordHash))) {
        auditLogger.logAuthFailure({
          userId: user.id,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          reason: 'Invalid password',
        });
        
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Create session
      const session = this.createSession(user.id, params.ipAddress, params.userAgent);
      this.sessions.set(session.id, session);

      // Update last login
      user.lastLoginAt = new Date();
      this.users.set(user.id, user);

      auditLogger.log({
        action: AuditAction.LOGIN,
        resource: AuditResource.USER,
        resourceId: user.id,
        userId: user.id,
        sessionId: session.id,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: true,
      });

      logger.info(`User logged in: ${user.email}`);
      
      return {
        success: true,
        user,
        session,
      };
    } catch (error) {
      logger.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed',
      };
    }
  }

  /**
   * Logout user
   */
  async logout(sessionId: string, userId?: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return false;
      }

      if (userId && session.userId !== userId) {
        return false;
      }

      this.sessions.delete(sessionId);

      auditLogger.log({
        action: AuditAction.LOGOUT,
        resource: AuditResource.SESSION,
        resourceId: sessionId,
        userId: session.userId,
        sessionId,
        success: true,
      });

      logger.info(`User logged out: ${session.userId}`);
      
      return true;
    } catch (error) {
      logger.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Validate session
   */
  async validateSession(sessionId: string): Promise<{ valid: boolean; user?: User }> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return { valid: false };
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        this.sessions.delete(sessionId);
        return { valid: false };
      }

      const user = this.users.get(session.userId);
      if (!user || !user.isActive) {
        this.sessions.delete(sessionId);
        return { valid: false };
      }

      // Extend session expiry
      session.expiresAt = new Date(Date.now() + this.sessionTimeout);
      this.sessions.set(sessionId, session);

      return {
        valid: true,
        user,
      };
    } catch (error) {
      logger.error('Session validation error:', error);
      return { valid: false };
    }
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  /**
   * Get all users (admin only)
   */
  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    updates: Partial<Pick<User, 'name' | 'role' | 'isActive'>>
  ): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return false;
      }

      const updated = { ...user, ...updates };
      this.users.set(userId, updated);

      auditLogger.logConfigChange({
        userId,
        configKey: 'user',
        oldValue: user,
        newValue: updated,
      });

      return true;
    } catch (error) {
      logger.error('User update error:', error);
      return false;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return false;
      }

      // Delete all sessions for user
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.userId === userId) {
          this.sessions.delete(sessionId);
        }
      }

      this.users.delete(userId);

      auditLogger.log({
        action: AuditAction.DELETE,
        resource: AuditResource.USER,
        resourceId: userId,
        success: true,
      });

      logger.info(`User deleted: ${user.email}`);
      
      return true;
    } catch (error) {
      logger.error('User deletion error:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Hash password
   */
  private hashPassword(password: string, salt: string): string {
    return createHash('sha256')
      .update(password + salt)
      .digest('hex');
  }

  /**
   * Find user by email
   */
  private findByEmail(email: string): User | null {
    const lowerEmail = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === lowerEmail) {
        return user;
      }
    }
    return null;
  }

  /**
   * Create session
   */
  private createSession(userId: string, ipAddress?: string, userAgent?: string): Session {
    const token = randomBytes(32).toString('hex');
    const session: Session = {
      id: this.generateId(),
      userId,
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTimeout),
      ipAddress,
      userAgent,
    };

    // Enforce max sessions per user
    const userSessions = Array.from(this.sessions.values()).filter(s => s.userId === userId);
    if (userSessions.length >= this.maxSessionsPerUser) {
      // Remove oldest session
      userSessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      this.sessions.delete(userSessions[0].id);
    }

    return session;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Get auth statistics
   */
  getStats(): {
    totalUsers: number;
    activeUsers: number;
    totalSessions: number;
    activeSessions: number;
  } {
    const totalUsers = this.users.size;
    const activeUsers = Array.from(this.users.values()).filter(u => u.isActive).length;
    const totalSessions = this.sessions.size;
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.expiresAt > new Date()).length;

    return {
      totalUsers,
      activeUsers,
      totalSessions,
      activeSessions,
    };
  }
}

// Global auth service instance
export const authService = new AuthService();
