/**
 * SQLite Persistence Manager
 * 
 * Provides SQLite-based persistence for metrics, receipts, and other data.
 */

import Database from 'better-sqlite3';
import * as path from 'path';

export interface MetricRecord {
  id: string;
  timestamp: string;
  tool_name: string;
  metric_type: string;
  metric_value: number;
  metadata?: string;  // JSON string
}

export class SQLiteManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), '.gstack', 'data.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_metrics_tool ON metrics(tool_name);
      CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);

      CREATE TABLE IF NOT EXISTS costs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        date TEXT NOT NULL,
        week TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        model_id TEXT NOT NULL,
        cost_usd REAL NOT NULL,
        request_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_costs_date ON costs(date);
      CREATE INDEX IF NOT EXISTS idx_costs_week ON costs(week);
      CREATE INDEX IF NOT EXISTS idx_costs_tool ON costs(tool_name);
    `);
  }

  /**
   * Insert a metric record
   */
  insertMetric(metric: MetricRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO metrics (id, timestamp, tool_name, metric_type, metric_value, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      metric.id,
      metric.timestamp,
      metric.tool_name,
      metric.metric_type,
      metric.metric_value,
      metric.metadata || null
    );
  }

  /**
   * Batch insert metric records
   */
  insertMetrics(metrics: MetricRecord[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO metrics (id, timestamp, tool_name, metric_type, metric_value, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((metrics) => {
      for (const metric of metrics) {
        stmt.run(
          metric.id,
          metric.timestamp,
          metric.tool_name,
          metric.metric_type,
          metric.metric_value,
          metric.metadata || null
        );
      }
    });
    insertMany(metrics);
  }

  /**
   * Query metrics by tool and type
   */
  getMetrics(toolName: string, metricType: string, limit?: number): MetricRecord[] {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const stmt = this.db.prepare(`
      SELECT * FROM metrics
      WHERE tool_name = ? AND metric_type = ?
      ORDER BY timestamp DESC
      ${limitClause}
    `);
    return stmt.all(toolName, metricType) as MetricRecord[];
  }

  /**
   * Query metrics by date range
   */
  getMetricsByDateRange(startDate: string, endDate: string): MetricRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM metrics
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `);
    return stmt.all(startDate, endDate) as MetricRecord[];
  }

  /**
   * Get aggregate statistics for a metric type
   */
  getMetricStats(toolName: string, metricType: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
  } {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as count,
        AVG(metric_value) as avg,
        MIN(metric_value) as min,
        MAX(metric_value) as max
      FROM metrics
      WHERE tool_name = ? AND metric_type = ?
    `);
    return stmt.get(toolName, metricType) as {
      count: number;
      avg: number;
      min: number;
      max: number;
    };
  }

  /**
   * Insert a cost record
   */
  insertCost(cost: {
    id: string;
    timestamp: string;
    date: string;
    week: string;
    tool_name: string;
    model_id: string;
    cost_usd: number;
    request_id: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO costs (id, timestamp, date, week, tool_name, model_id, cost_usd, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      cost.id,
      cost.timestamp,
      cost.date,
      cost.week,
      cost.tool_name,
      cost.model_id,
      cost.cost_usd,
      cost.request_id
    );
  }

  /**
   * Get total cost by date
   */
  getTotalCostByDate(date: string): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) as total
      FROM costs
      WHERE date = ?
    `);
    const result = stmt.get(date) as { total: number };
    return result.total;
  }

  /**
   * Get total cost by week
   */
  getTotalCostByWeek(week: string): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) as total
      FROM costs
      WHERE week = ?
    `);
    const result = stmt.get(week) as { total: number };
    return result.total;
  }

  /**
   * Get cost breakdown by tool for a date range
   */
  getCostBreakdown(startDate: string, endDate: string): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT tool_name, SUM(cost_usd) as total
      FROM costs
      WHERE date BETWEEN ? AND ?
      GROUP BY tool_name
    `);
    const rows = stmt.all(startDate, endDate) as Array<{ tool_name: string; total: number }>;
    const breakdown: Record<string, number> = {};
    for (const row of rows) {
      breakdown[row.tool_name] = row.total;
    }
    return breakdown;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the database path
   */
  getDbPath(): string {
    return this.dbPath;
  }
}
