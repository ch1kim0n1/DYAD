import * as Sentry from '@sentry/node';
import { createLogger } from '../logger';

const logger = createLogger('sentry');

/**
 * Sentry error monitoring integration
 * Captures errors, performance data, and user feedback
 */
export class SentryIntegration {
  private initialized: boolean = false;
  private dsn: string;
  private environment: string;
  private release: string;

  constructor(options: {
    dsn: string;
    environment: string;
    release: string;
  }) {
    this.dsn = options.dsn;
    this.environment = options.environment;
    this.release = options.release;
  }

  /**
   * Initialize Sentry
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('Sentry already initialized');
      return;
    }

    try {
      Sentry.init({
        dsn: this.dsn,
        environment: this.environment,
        release: this.release,
        tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
        beforeSend(event, hint) {
          // Filter out sensitive data
          if (event.request) {
            delete event.request.cookies;
            delete event.request.headers;
          }
          
          // Add custom context
          event.tags = {
            ...event.tags,
            service: 'gbrain',
          };
          
          return event;
        },
      });

      this.initialized = true;
      logger.info('Sentry initialized');
    } catch (error) {
      logger.error('Failed to initialize Sentry:', error);
    }
  }

  /**
   * Capture exception
   */
  captureException(error: Error, context?: Record<string, any>): void {
    if (!this.initialized) {
      logger.error('Sentry not initialized, logging to console:', error);
      return;
    }

    Sentry.captureException(error, {
      contexts: {
        app: context,
      },
    });
  }

  /**
   * Capture message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.initialized) {
      logger.log(level, message);
      return;
    }

    Sentry.captureMessage(message, {
      level,
    });
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setUser(user);
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setUser(null);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: {
    category: string;
    message: string;
    level?: 'info' | 'warning' | 'error';
    data?: Record<string, any>;
  }): void {
    if (!this.initialized) {
      return;
    }

    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Start transaction for performance monitoring
   */
  startTransaction(name: string, op: string): Sentry.Transaction | undefined {
    if (!this.initialized) {
      return undefined;
    }

    return Sentry.startTransaction({
      name,
      op,
    });
  }

  /**
   * Capture feedback from user
   */
  captureFeedback(feedback: {
    email?: string;
    name?: string;
    comments: string;
  }): void {
    if (!this.initialized) {
      logger.info('User feedback:', feedback);
      return;
    }

    Sentry.captureEvent({
      message: 'User feedback',
      user: {
        email: feedback.email,
        username: feedback.name,
      },
      extra: {
        comments: feedback.comments,
      },
    });
  }
}

/**
 * LLM cost tracking and rate limiting
 */
export class LLMCostTracker {
  private costs: Map<string, { totalCost: number; requestCount: number; lastReset: number }> = new Map();
  private dailyLimit: number;
  private monthlyLimit: number;

  constructor(dailyLimit: number = 10, monthlyLimit: number = 100) {
    this.dailyLimit = dailyLimit;
    this.monthlyLimit = monthlyLimit;
  }

  /**
   * Track LLM request cost
   */
  trackRequest(userId: string, cost: number): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const dayStart = now - (now % 86400000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const userCosts = this.costs.get(userId) || {
      totalCost: 0,
      requestCount: 0,
      lastReset: now,
    };

    // Reset counters if needed
    if (userCosts.lastReset < dayStart || userCosts.lastReset < monthStart) {
      userCosts.totalCost = 0;
      userCosts.requestCount = 0;
      userCosts.lastReset = Math.max(dayStart, monthStart);
    }

    // Check daily limit
    const dailyCost = this.getCostSince(userId, dayStart);
    if (dailyCost + cost > this.dailyLimit) {
      return {
        allowed: false,
        reason: 'Daily cost limit exceeded',
      };
    }

    // Check monthly limit
    const monthlyCost = this.getCostSince(userId, monthStart);
    if (monthlyCost + cost > this.monthlyLimit) {
      return {
        allowed: false,
        reason: 'Monthly cost limit exceeded',
      };
    }

    // Update costs
    userCosts.totalCost += cost;
    userCosts.requestCount += 1;
    this.costs.set(userId, userCosts);

    return { allowed: true };
  }

  /**
   * Get cost since timestamp
   */
  private getCostSince(userId: string, since: number): number {
    // In production, this would query a database with timestamped records
    const userCosts = this.costs.get(userId);
    if (!userCosts) {
      return 0;
    }
    return userCosts.totalCost;
  }

  /**
   * Get user cost summary
   */
  getCostSummary(userId: string): {
    dailyCost: number;
    monthlyCost: number;
    requestCount: number;
    dailyLimit: number;
    monthlyLimit: number;
  } {
    const now = Date.now();
    const dayStart = now - (now % 86400000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const userCosts = this.costs.get(userId) || {
      totalCost: 0,
      requestCount: 0,
      lastReset: now,
    };

    return {
      dailyCost: this.getCostSince(userId, dayStart),
      monthlyCost: this.getCostSince(userId, monthStart),
      requestCount: userCosts.requestCount,
      dailyLimit: this.dailyLimit,
      monthlyLimit: this.monthlyLimit,
    };
  }

  /**
   * Set limits
   */
  setLimits(dailyLimit: number, monthlyLimit: number): void {
    this.dailyLimit = dailyLimit;
    this.monthlyLimit = monthlyLimit;
  }
}

// Global instances
let sentryIntegration: SentryIntegration | null = null;
export const llmCostTracker = new LLMCostTracker();

export function initSentry(options: {
  dsn: string;
  environment: string;
  release: string;
}): SentryIntegration {
  if (!sentryIntegration) {
    sentryIntegration = new SentryIntegration(options);
    sentryIntegration.initialize();
  }
  return sentryIntegration;
}

export function getSentry(): SentryIntegration | null {
  return sentryIntegration;
}
