import { createLogger } from '../logger';

const logger = createLogger('audit-log');

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXPORT = 'export',
  LOGIN = 'login',
  LOGOUT = 'logout',
  AUTH_FAILURE = 'auth_failure',
  DATA_ACCESS = 'data_access',
  CONFIG_CHANGE = 'config_change',
}

export enum AuditResource {
  USER = 'user',
  SESSION = 'session',
  MESSAGE = 'message',
  CARE_BRIEF = 'care_brief',
  RUN = 'run',
  RECEIPT = 'receipt',
  OBSERVATION = 'observation',
  COGNITIVE_STATE = 'cognitive_state',
  DRIFT_METRIC = 'drift_metric',
  SYSTEM = 'system',
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

/**
 * Audit logging for data access and system events
 * Meets compliance requirements for audit trails
 */
export class AuditLogger {
  private entries: AuditLogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Log an audit event
   */
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const auditEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...entry,
    };

    this.entries.push(auditEntry);

    // Keep only the most recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Log to console for now (in production, send to secure audit log storage)
    logger.info('AUDIT', JSON.stringify(auditEntry));
  }

  /**
   * Log a data access event
   */
  logDataAccess(params: {
    userId?: string;
    sessionId?: string;
    resource: AuditResource;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, any>;
  }): void {
    this.log({
      action: AuditAction.DATA_ACCESS,
      resource: params.resource,
      resourceId: params.resourceId,
      userId: params.userId,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: params.details,
      success: true,
    });
  }

  /**
   * Log a failed authentication attempt
   */
  logAuthFailure(params: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    reason: string;
  }): void {
    this.log({
      action: AuditAction.AUTH_FAILURE,
      resource: AuditResource.USER,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: { reason: params.reason },
      success: false,
      errorMessage: params.reason,
    });
  }

  /**
   * Log a configuration change
   */
  logConfigChange(params: {
    userId?: string;
    configKey: string;
    oldValue?: any;
    newValue?: any;
  }): void {
    this.log({
      action: AuditAction.CONFIG_CHANGE,
      resource: AuditResource.SYSTEM,
      userId: params.userId,
      details: {
        configKey: params.configKey,
        oldValue: params.oldValue,
        newValue: params.newValue,
      } as Record<string, any>,
      success: true,
    });
  }

  /**
   * Query audit logs
   */
  query(filters: {
    userId?: string;
    action?: AuditAction;
    resource?: AuditResource;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): AuditLogEntry[] {
    let results = [...this.entries];

    if (filters.userId) {
      results = results.filter(e => e.userId === filters.userId);
    }
    if (filters.action) {
      results = results.filter(e => e.action === filters.action);
    }
    if (filters.resource) {
      results = results.filter(e => e.resource === filters.resource);
    }
    if (filters.resourceId) {
      results = results.filter(e => e.resourceId === filters.resourceId);
    }
    if (filters.startDate) {
      results = results.filter(e => e.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      results = results.filter(e => e.timestamp <= filters.endDate!);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Export audit logs for compliance reporting
   */
  export(filters?: Parameters<typeof this.query>[0]): string {
    const entries = filters ? this.query(filters) : this.entries;
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Clear old audit logs (for maintenance)
   */
  clearOlderThan(date: Date): number {
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.timestamp >= date);
    return before - this.entries.length;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Global audit logger instance
export const auditLogger = new AuditLogger();
