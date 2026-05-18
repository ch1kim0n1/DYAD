/**
 * Log Aggregation and Analysis
 * 
 * Provides log aggregation, filtering, and analysis capabilities
 * for centralized log management across G-Stack tools.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  tool?: string;
  trace_id?: string;
  request_id?: string;
  metadata?: Record<string, unknown>;
}

export interface LogFilter {
  level?: string[];
  tool?: string[];
  startTime?: string;
  endTime?: string;
  traceId?: string;
  requestId?: string;
  search?: string;
}

export interface LogAnalysis {
  totalLogs: number;
  levelCounts: Record<string, number>;
  toolCounts: Record<string, number>;
  errorRate: number;
  topErrors: Array<{ message: string; count: number }>;
  timeRange: { start: string; end: string };
}

export class LogAggregator {
  private logFiles: string[] = [];
  private maxFileSize: number = 100 * 1024 * 1024; // 100MB

  constructor(logDirectory: string) {
    this.initialize(logDirectory);
  }

  private async initialize(logDirectory: string): Promise<void> {
    try {
      const files = await fs.readdir(logDirectory);
      this.logFiles = files
        .filter(f => f.endsWith('.log') || f.endsWith('.json'))
        .map(f => path.join(logDirectory, f));
    } catch (error) {
      console.warn('Failed to initialize log aggregator:', error);
    }
  }

  async queryLogs(filter: LogFilter = {}, limit = 1000): Promise<LogEntry[]> {
    const allLogs: LogEntry[] = [];

    for (const logFile of this.logFiles) {
      try {
        const content = await fs.readFile(logFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const entry: LogEntry = JSON.parse(line);
            if (this.matchesFilter(entry, filter)) {
              allLogs.push(entry);
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      } catch (error) {
        console.warn(`Failed to read log file ${logFile}:`, error);
      }
    }

    // Sort by timestamp descending
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return allLogs.slice(0, limit);
  }

  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    if (filter.level && !filter.level.includes(entry.level)) {
      return false;
    }

    if (filter.tool && filter.tool.length > 0 && !filter.tool.includes(entry.tool)) {
      return false;
    }

    if (filter.startTime && new Date(entry.timestamp) < new Date(filter.startTime)) {
      return false;
    }

    if (filter.endTime && new Date(entry.timestamp) > new Date(filter.endTime)) {
      return false;
    }

    if (filter.traceId && entry.trace_id !== filter.traceId) {
      return false;
    }

    if (filter.requestId && entry.request_id && entry.request_id !== filter.requestId) {
      return false;
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const searchable = [
        entry.message,
        JSON.stringify(entry.metadata || {}),
        entry.trace_id || '',
        entry.request_id || '',
      ].join(' ').toLowerCase();
      
      if (!searchable.includes(searchLower)) {
        return false;
      }
    }

    return true;
  }

  async analyzeLogs(filter: LogFilter = {}): Promise<LogAnalysis> {
    const logs = await this.queryLogs(filter, 10000); // Analyze up to 10k logs

    const levelCounts: Record<string, number> = {};
    const toolCounts: Record<string, number> = {};
    const errorMessages: Map<string, number> = new Map();

    let startTime: Date | null = null;
    let endTime: Date | null = null;

    for (const log of logs) {
      // Count by level
      levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;

      // Count by tool
      if (log.tool) {
        toolCounts[log.tool] = (toolCounts[log.tool] || 0) + 1;
      }

      // Track errors
      if (log.level === 'error') {
        errorMessages.set(log.message, (errorMessages.get(log.message) || 0) + 1);
      }

      // Track time range
      const logTime = new Date(log.timestamp);
      if (!startTime || logTime < startTime) {
        startTime = logTime;
      }
      if (!endTime || logTime > endTime) {
        endTime = logTime;
      }
    }

    // Get top errors
    const topErrors = Array.from(errorMessages.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate error rate
    const totalLogs = logs.length;
    const errorCount = levelCounts['error'] || 0;
    const errorRate = totalLogs > 0 ? errorCount / totalLogs : 0;

    return {
      totalLogs,
      levelCounts,
      toolCounts,
      errorRate,
      topErrors,
      timeRange: {
        start: startTime?.toISOString() || new Date().toISOString(),
        end: endTime?.toISOString() || new Date().toISOString(),
      },
    };
  }

  async getLogsByTraceId(traceId: string): Promise<LogEntry[]> {
    return this.queryLogs({ traceId });
  }

  async getLogsByRequestId(requestId: string): Promise<LogEntry[]> {
    return this.queryLogs({ requestId });
  }

  async getErrorLogs(limit = 100): Promise<LogEntry[]> {
    return this.queryLogs({ level: ['error'] }, limit);
  }

  async searchLogs(searchTerm: string, limit = 100): Promise<LogEntry[]> {
    return this.queryLogs({ search: searchTerm }, limit);
  }

  async tailLogs(lines = 100): Promise<LogEntry[]> {
    const allLogs: LogEntry[] = [];

    for (const logFile of this.logFiles) {
      try {
        const content = await fs.readFile(logFile, 'utf8');
        const logLines = content.split('\n').filter(l => l.trim()).slice(-lines);

        for (const line of logLines) {
          try {
            allLogs.push(JSON.parse(line));
          } catch {
            // Skip non-JSON lines
          }
        }
      } catch (error) {
        console.warn(`Failed to read log file ${logFile}:`, error);
      }
    }

    return allLogs.slice(-lines);
  }
}

// Log analysis utilities
export function detectAnomalies(analysis: LogAnalysis): string[] {
  const anomalies: string[] = [];

  // High error rate
  if (analysis.errorRate > 0.1) {
    anomalies.push(`High error rate detected: ${(analysis.errorRate * 100).toFixed(1)}%`);
  }

  // Spike in errors
  if (analysis.topErrors.length > 0 && analysis.topErrors[0].count > 50) {
    anomalies.push(`Error spike detected: "${analysis.topErrors[0].message}" occurred ${analysis.topErrors[0].count} times`);
  }

  // No logs
  if (analysis.totalLogs === 0) {
    anomalies.push('No logs found - possible logging failure');
  }

  // Imbalanced log levels (only errors)
  if (analysis.levelCounts['error'] > 0 && !analysis.levelCounts['info']) {
    anomalies.push('Imbalanced log levels - only errors present');
  }

  return anomalies;
}

export function generateLogReport(analysis: LogAnalysis): string {
  const lines: string[] = [];

  lines.push('=== Log Analysis Report ===');
  lines.push(`Time Range: ${analysis.timeRange.start} to ${analysis.timeRange.end}`);
  lines.push(`Total Logs: ${analysis.totalLogs}`);
  lines.push('');

  lines.push('Log Levels:');
  for (const [level, count] of Object.entries(analysis.levelCounts)) {
    lines.push(`  ${level}: ${count}`);
  }
  lines.push('');

  lines.push('Tools:');
  for (const [tool, count] of Object.entries(analysis.toolCounts)) {
    lines.push(`  ${tool}: ${count}`);
  }
  lines.push('');

  lines.push(`Error Rate: ${(analysis.errorRate * 100).toFixed(2)}%`);
  lines.push('');

  if (analysis.topErrors.length > 0) {
    lines.push('Top Errors:');
    for (const { message, count } of analysis.topErrors) {
      lines.push(`  [${count}] ${message}`);
    }
  }

  return lines.join('\n');
}
