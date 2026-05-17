/**
 * Operational Audit Logger
 *
 * Provides:
 * - Structured audit logging to ~/.{tool}/audit/decisions-*.jsonl
 * - Decision tracking for transparency and debugging
 * - Automatic rotation and cleanup
 * - Atomic writes using proper-lockfile
 */

export interface AuditEntry {
  timestamp: string;
  tool: string;
  operation: string;
  decision: string;
  reasoning?: string;
  model_tier?: string;
  model_name?: string;
  cost_usd?: number;
  tokens?: number;
  latency_ms?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private tool: string;
  private auditDir: string;
  private currentFile: string;
  private maxFileSize: number;
  private maxFiles: number;
  private lockfile: any;

  constructor(tool: string, options: {
    maxFileSize?: number;
    maxFiles?: number;
  } = {}) {
    this.tool = tool;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 10;
    
    const homeDir = this.getHomeDir();
    this.auditDir = `${homeDir}/.${this.tool}/audit`;
    this.currentFile = this.getCurrentFilePath();
    this.lockfile = null;
  }

  private getHomeDir(): string {
    // Default to temp directory for MVP
    return '/tmp';
  }

  private getCurrentFilePath(): string {
    const date = new Date().toISOString().split('T')[0];
    return `${this.auditDir}/decisions-${date}.jsonl`;
  }

  /**
   * Initialize the audit directory
   */
  async init(): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    try {
      await fs.mkdir(this.auditDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Log an audit entry
   */
  async log(entry: Omit<AuditEntry, 'timestamp' | 'tool'>): Promise<void> {
    const fullEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      tool: this.tool,
      ...entry,
    };

    try {
      await this.init();
      await this.rotateIfNeeded();
      
      const line = JSON.stringify(fullEntry) + '\n';
      await this.atomicAppend(this.currentFile, line);
    } catch (error) {
      console.error(`[AuditLogger] Failed to write audit entry: ${error}`);
    }
  }

  private async atomicAppend(filePath: string, data: string): Promise<void> {
    const fs = await import('node:fs/promises');
    const lockfile = await import('proper-lockfile');
    
    try {
      const release = await lockfile.lock(filePath);
      try {
        await fs.appendFile(filePath, data, 'utf8');
      } finally {
        await release();
      }
    } catch (error) {
      throw new Error(`Failed to acquire lock for ${filePath}: ${error}`);
    }
  }

  /**
   * Rotate log files if they exceed max size
   */
  private async rotateIfNeeded(): Promise<void> {
    const fs = await import('node:fs');
    try {
      const stats = fs.statSync(this.currentFile);
      if (stats.size >= this.maxFileSize) {
        await this.rotate();
      }
    } catch (error) {
      // File might not exist yet
    }
  }

  /**
   * Rotate log files
   */
  private async rotate(): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newPath = `${this.auditDir}/decisions-${timestamp}.jsonl`;
    await fs.rename(this.currentFile, newPath);
    this.currentFile = this.getCurrentFilePath();
    await this.cleanupOldFiles();
  }

  /**
   * Cleanup old log files
   */
  private async cleanupOldFiles(): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    
    try {
      const files = await fs.readdir(this.auditDir);
      const auditFiles = files
        .filter(f => f.startsWith('decisions-') && f.endsWith('.jsonl'))
        .map(f => ({ name: f, path: path.join(this.auditDir, f) }))
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (timestamp) descending
      
      // Keep only maxFiles most recent files
      if (auditFiles.length > this.maxFiles) {
        for (const file of auditFiles.slice(this.maxFiles)) {
          await fs.unlink(file.path);
        }
      }
    } catch (error) {
      console.error(`[AuditLogger] Failed to cleanup old files: ${error}`);
    }
  }

  /**
   * Query audit entries
   */
  async query(options: {
    startDate?: Date;
    endDate?: Date;
    operation?: string;
    limit?: number;
  } = {}): Promise<AuditEntry[]> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    
    try {
      const files = await fs.readdir(this.auditDir);
      const auditFiles = files
        .filter(f => f.startsWith('decisions-') && f.endsWith('.jsonl'))
        .sort(); // Sort by name (timestamp) ascending
      
      const entries: AuditEntry[] = [];
      
      for (const file of auditFiles) {
        const filePath = path.join(this.auditDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (!line) continue;
          try {
            const entry = JSON.parse(line) as AuditEntry;
            const timestamp = new Date(entry.timestamp);
            
            // Filter by date range
            if (options.startDate && timestamp < options.startDate) continue;
            if (options.endDate && timestamp > options.endDate) continue;
            
            // Filter by operation
            if (options.operation && entry.operation !== options.operation) continue;
            
            entries.push(entry);
          } catch (error) {
            // Skip malformed entries
          }
        }
      }
      
      // Sort by timestamp descending and apply limit
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (options.limit) {
        return entries.slice(0, options.limit);
      }
      
      return entries;
    } catch (error) {
      console.error(`[AuditLogger] Failed to query entries: ${error}`);
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    successRate: number;
    avgCost: number;
    avgLatency: number;
    byOperation: Record<string, number>;
  }> {
    const entries = await this.query();
    
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        successRate: 0,
        avgCost: 0,
        avgLatency: 0,
        byOperation: {},
      };
    }
    
    const successCount = entries.filter(e => e.success).length;
    const totalCost = entries.reduce((sum, e) => sum + (e.cost_usd || 0), 0);
    const totalLatency = entries.reduce((sum, e) => sum + (e.latency_ms || 0), 0);
    const byOperation: Record<string, number> = {};
    
    for (const entry of entries) {
      byOperation[entry.operation] = (byOperation[entry.operation] || 0) + 1;
    }
    
    return {
      totalEntries: entries.length,
      successRate: successCount / entries.length,
      avgCost: totalCost / entries.length,
      avgLatency: totalLatency / entries.length,
      byOperation,
    };
  }
}
