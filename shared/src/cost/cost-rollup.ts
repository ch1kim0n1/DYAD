/**
 * Cost Rollup Manager
 * 
 * Aggregates costs from receipts into daily and weekly rollup files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface CostRecord {
  timestamp: string;
  date: string;  // YYYY-MM-DD
  week: string;  // YYYY-Www
  tool_name: string;
  model_id: string;
  cost_usd: number;
  request_id: string;
}

export interface DailyRollup {
  date: string;
  total_cost_usd: number;
  tool_breakdown: Record<string, number>;
  model_breakdown: Record<string, number>;
  request_count: number;
}

export interface WeeklyRollup {
  week: string;
  total_cost_usd: number;
  tool_breakdown: Record<string, number>;
  model_breakdown: Record<string, number>;
  request_count: number;
  daily_breakdown: Record<string, number>;
}

export class CostRollupManager {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), '.gstack', 'costs');
  }

  /**
   * Add a cost record to the daily and weekly rollups
   */
  async addCostRecord(record: CostRecord): Promise<void> {
    await this.ensureDirectories();
    
    // Write to daily rollup
    await this.updateDailyRollup(record);
    
    // Write to weekly rollup
    await this.updateWeeklyRollup(record);
    
    // Append to raw cost log
    await this.appendRawCost(record);
  }

  /**
   * Get daily cost for a specific date
   */
  async getDailyCost(date: string): Promise<DailyRollup | null> {
    const filePath = path.join(this.basePath, 'daily', `${date}.json`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as DailyRollup;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  /**
   * Get weekly cost for a specific week
   */
  async getWeeklyCost(week: string): Promise<WeeklyRollup | null> {
    const filePath = path.join(this.basePath, 'weekly', `${week}.json`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as WeeklyRollup;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  /**
   * Get costs for a date range
   */
  async getCostsInRange(startDate: string, endDate: string): Promise<DailyRollup[]> {
    const results: DailyRollup[] = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const rollup = await this.getDailyCost(dateStr);
      if (rollup) {
        results.push(rollup);
      }
    }
    
    return results;
  }

  /**
   * Get raw cost records for a date
   */
  async getRawCosts(date: string): Promise<CostRecord[]> {
    const filePath = path.join(this.basePath, 'raw', `${date}.jsonl`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter((l: string) => l);
      return lines.map(line => JSON.parse(line) as CostRecord);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(path.join(this.basePath, 'daily'), { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'weekly'), { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'raw'), { recursive: true });
  }

  private async updateDailyRollup(record: CostRecord): Promise<void> {
    const filePath = path.join(this.basePath, 'daily', `${record.date}.json`);
    
    let rollup: DailyRollup;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      rollup = JSON.parse(content) as DailyRollup;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        rollup = {
          date: record.date,
          total_cost_usd: 0,
          tool_breakdown: {},
          model_breakdown: {},
          request_count: 0,
        };
      } else {
        throw error;
      }
    }
    
    rollup.total_cost_usd += record.cost_usd;
    rollup.tool_breakdown[record.tool_name] = (rollup.tool_breakdown[record.tool_name] || 0) + record.cost_usd;
    rollup.model_breakdown[record.model_id] = (rollup.model_breakdown[record.model_id] || 0) + record.cost_usd;
    rollup.request_count += 1;
    
    await fs.writeFile(filePath, JSON.stringify(rollup, null, 2), 'utf8');
  }

  private async updateWeeklyRollup(record: CostRecord): Promise<void> {
    const filePath = path.join(this.basePath, 'weekly', `${record.week}.json`);
    
    let rollup: WeeklyRollup;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      rollup = JSON.parse(content) as WeeklyRollup;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        rollup = {
          week: record.week,
          total_cost_usd: 0,
          tool_breakdown: {},
          model_breakdown: {},
          request_count: 0,
          daily_breakdown: {},
        };
      } else {
        throw error;
      }
    }
    
    rollup.total_cost_usd += record.cost_usd;
    rollup.tool_breakdown[record.tool_name] = (rollup.tool_breakdown[record.tool_name] || 0) + record.cost_usd;
    rollup.model_breakdown[record.model_id] = (rollup.model_breakdown[record.model_id] || 0) + record.cost_usd;
    rollup.request_count += 1;
    rollup.daily_breakdown[record.date] = (rollup.daily_breakdown[record.date] || 0) + record.cost_usd;
    
    await fs.writeFile(filePath, JSON.stringify(rollup, null, 2), 'utf8');
  }

  private async appendRawCost(record: CostRecord): Promise<void> {
    const filePath = path.join(this.basePath, 'raw', `${record.date}.jsonl`);
    const line = JSON.stringify(record) + '\n';
    await fs.appendFile(filePath, line, 'utf8');
  }
}
