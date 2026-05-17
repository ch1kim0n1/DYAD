/**
 * Audit Log
 * 
 * Provides structured logging for security events and compliance.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export type AuditEventType = 
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'DATA_ACCESS'
  | 'DATA_MODIFICATION'
  | 'CONFIGURATION_CHANGE'
  | 'SECURITY_EVENT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_INPUT'
  | 'SUSPICIOUS_ACTIVITY';

export interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: AuditEventType;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  actor_id?: string;
  actor_type?: 'user' | 'service' | 'system';
  resource_id?: string;
  resource_type?: string;
  action: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  success: boolean;
  error_message?: string;
}

export class AuditLogger {
  private logPath: string;
  private enableConsole: boolean;

  constructor(logPath?: string, enableConsole: boolean = false) {
    this.logPath = logPath || path.join(process.cwd(), '.gstack', 'audit.log');
    this.enableConsole = enableConsole;
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Apply PII redaction to details
    if (fullEvent.details) {
      fullEvent.details = this.redactPII(fullEvent.details);
    }

    // Write to file
    await this.appendToFile(fullEvent);

    // Console output if enabled
    if (this.enableConsole) {
      this.logToConsole(fullEvent);
    }
  }

  /**
   * Redact PII from event details
   */
  private redactPII(details: Record<string, any>): Record<string, any> {
    const redacted = { ...details };
    
    for (const key in redacted) {
      if (typeof redacted[key] === 'string') {
        // Redact emails
        if (redacted[key].includes('@')) {
          redacted[key] = '[REDACTED_EMAIL]';
        }
        // Redact API keys (32+ char alphanumeric)
        if (redacted[key].length >= 32 && /^[a-zA-Z0-9]+$/.test(redacted[key])) {
          redacted[key] = '[REDACTED_KEY]';
        }
      }
    }
    
    return redacted;
  }

  /**
   * Append event to audit log file
   */
  private async appendToFile(event: AuditEvent): Promise<void> {
    const dir = path.dirname(this.logPath);
    await fs.mkdir(dir, { recursive: true });
    
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(this.logPath, line, 'utf8');
  }

  /**
   * Log event to console
   */
  private logToConsole(event: AuditEvent): void {
    const prefix = `[AUDIT][${event.severity}][${event.event_type}]`;
    const message = `${prefix} ${event.action}`;
    
    switch (event.severity) {
      case 'INFO':
        console.info(message, event);
        break;
      case 'WARNING':
        console.warn(message, event);
        break;
      case 'ERROR':
      case 'CRITICAL':
        console.error(message, event);
        break;
    }
  }

  /**
   * Query audit events by date range
   */
  async queryEvents(startDate: string, endDate: string, filters?: {
    event_type?: AuditEventType;
    actor_id?: string;
    resource_id?: string;
  }): Promise<AuditEvent[]> {
    const content = await fs.readFile(this.logPath, 'utf8');
    const lines = content.trim().split('\n').filter((l: string) => l);
    
    const events: AuditEvent[] = [];
    for (const line of lines) {
      const event = JSON.parse(line) as AuditEvent;
      
      // Filter by date range
      const eventDate = event.timestamp;
      if (eventDate < startDate || eventDate > endDate) {
        continue;
      }
      
      // Apply additional filters
      if (filters?.event_type && event.event_type !== filters.event_type) {
        continue;
      }
      if (filters?.actor_id && event.actor_id !== filters.actor_id) {
        continue;
      }
      if (filters?.resource_id && event.resource_id !== filters.resource_id) {
        continue;
      }
      
      events.push(event);
    }
    
    return events;
  }

  /**
   * Get recent audit events
   */
  async getRecentEvents(limit: number = 100): Promise<AuditEvent[]> {
    const content = await fs.readFile(this.logPath, 'utf8');
    const lines = content.trim().split('\n').filter((l: string) => l);
    
    const events = lines
      .slice(-limit)
      .map(line => JSON.parse(line) as AuditEvent);
    
    return events;
  }

  /**
   * Convenience methods for common audit events
   */
  async logAuthentication(actorId: string, success: boolean, details?: Record<string, any>): Promise<void> {
    await this.logEvent({
      event_type: 'AUTHENTICATION',
      severity: success ? 'INFO' : 'WARNING',
      actor_id: actorId,
      actor_type: 'user',
      action: 'authentication_attempt',
      success,
      details,
      error_message: success ? undefined : 'Authentication failed',
    });
  }

  async logAuthorization(actorId: string, resourceType: string, resourceId: string, action: string, success: boolean): Promise<void> {
    await this.logEvent({
      event_type: 'AUTHORIZATION',
      severity: success ? 'INFO' : 'WARNING',
      actor_id: actorId,
      actor_type: 'user',
      resource_type: resourceType,
      resource_id: resourceId,
      action: `authorization_${action}`,
      success,
      error_message: success ? undefined : 'Authorization denied',
    });
  }

  async logDataAccess(actorId: string, resourceType: string, resourceId: string, details?: Record<string, any>): Promise<void> {
    await this.logEvent({
      event_type: 'DATA_ACCESS',
      severity: 'INFO',
      actor_id: actorId,
      actor_type: 'user',
      resource_type: resourceType,
      resource_id: resourceId,
      action: 'data_access',
      success: true,
      details,
    });
  }

  async logDataModification(actorId: string, resourceType: string, resourceId: string, action: string, details?: Record<string, any>): Promise<void> {
    await this.logEvent({
      event_type: 'DATA_MODIFICATION',
      severity: 'INFO',
      actor_id: actorId,
      actor_type: 'user',
      resource_type: resourceType,
      resource_id: resourceId,
      action: `data_${action}`,
      success: true,
      details,
    });
  }

  async logSecurityEvent(severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL', action: string, details?: Record<string, any>): Promise<void> {
    await this.logEvent({
      event_type: 'SECURITY_EVENT',
      severity,
      actor_type: 'system',
      action,
      success: severity === 'INFO',
      details,
    });
  }

  async logRateLimitExceeded(identifier: string, details?: Record<string, any>): Promise<void> {
    await this.logEvent({
      event_type: 'RATE_LIMIT_EXCEEDED',
      severity: 'WARNING',
      actor_id: identifier,
      actor_type: 'user',
      action: 'rate_limit_exceeded',
      success: false,
      details,
    });
  }

  async logInvalidInput(actorId: string, fieldName: string, reason: string, details?: Record<string, any>): Promise<void> {
    await this.logEvent({
      event_type: 'INVALID_INPUT',
      severity: 'WARNING',
      actor_id: actorId,
      actor_type: 'user',
      action: 'invalid_input',
      success: false,
      details: { field: fieldName, reason, ...details },
      error_message: `Invalid input: ${fieldName} - ${reason}`,
    });
  }
}

/**
 * Global audit logger instance
 */
let globalAuditLogger: AuditLogger | null = null;

export function getAuditLogger(logPath?: string, enableConsole?: boolean): AuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new AuditLogger(
      logPath || process.env.GSTACK_AUDIT_LOG_PATH,
      enableConsole || process.env.GSTACK_AUDIT_LOG_CONSOLE === 'true'
    );
  }
  return globalAuditLogger;
}

export function resetAuditLogger(): void {
  globalAuditLogger = null;
}
