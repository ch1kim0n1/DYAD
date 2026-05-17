/**
 * Simple structured logger for GBrain
 * Follows the same interface as shared/src/core/structured-logger
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

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.output({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      tool: this.tool,
      context,
      error: error ? {
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }
}

export function createLogger(tool: string, options?: {
  minLevel?: LogLevel;
}): StructuredLogger {
  return new StructuredLogger(tool, options);
}
