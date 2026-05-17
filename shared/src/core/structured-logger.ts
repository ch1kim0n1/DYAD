/**
 * Structured Logger
 * 
 * Provides:
 * - Structured logging with levels (debug, info, warn, error)
 * - JSON output for log aggregation
 * - Context-aware logging with metadata
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  tool?: string;
  operation?: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
  };
}

export class StructuredLogger {
  private tool: string;
  private minLevel: LogLevel;

  constructor(tool: string, options: {
    minLevel?: LogLevel;
  } = {}) {
    this.tool = tool;
    this.minLevel = options.minLevel || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private format(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private output(entry: LogEntry): void {
    if (this.shouldLog(entry.level)) {
      const formatted = this.format(entry);
      console.log(formatted);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.output({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      tool: this.tool,
      context,
    });
  }

  info(message: string, context?: Record<string, any>): void {
    this.output({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      tool: this.tool,
      context,
    });
  }

  warn(message: string, context?: Record<string, any>): void {
    this.output({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      tool: this.tool,
      context,
    });
  }

  error(message: string, errorOrContext?: Error | Record<string, any>, context?: Record<string, any>): void {
    const isError = errorOrContext instanceof Error;
    this.output({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      tool: this.tool,
      context: isError ? context : (errorOrContext as Record<string, any> | undefined),
      error: isError ? {
        message: (errorOrContext as Error).message,
        stack: (errorOrContext as Error).stack,
      } : undefined,
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): StructuredLogger {
    const childLogger = new StructuredLogger(this.tool, { minLevel: this.minLevel });
    childLogger.info = (message: string, additionalContext?: Record<string, any>) => {
      this.info(message, { ...context, ...additionalContext });
    };
    childLogger.warn = (message: string, additionalContext?: Record<string, any>) => {
      this.warn(message, { ...context, ...additionalContext });
    };
    childLogger.error = (message: string, error?: Error, additionalContext?: Record<string, any>) => {
      this.error(message, error, { ...context, ...additionalContext });
    };
    childLogger.debug = (message: string, additionalContext?: Record<string, any>) => {
      this.debug(message, { ...context, ...additionalContext });
    };
    return childLogger;
  }
}

/**
 * Create a logger instance for a tool
 */
export function createLogger(tool: string, options?: {
  minLevel?: LogLevel;
}): StructuredLogger {
  return new StructuredLogger(tool, options);
}
