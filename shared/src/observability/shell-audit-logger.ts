/**
 * Shell Jobs Audit Logger
 * 
 * Provides audit logging for shell execution calls across all tools.
 * Logs to ~/.{tool}/audit/shell-jobs-YYYY-Www.jsonl
 */

export interface ShellJobEntry {
  timestamp: string;
  tool: string;
  command: string;
  working_directory?: string;
  environment?: Record<string, string>;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  duration_ms?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export class ShellAuditLogger {
  private tool: string;
  private auditDir: string;
  private currentFile: string;
  private maxFileSize: number;
  private maxFiles: number;

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
  }

  private getHomeDir(): string {
    // Default to temp directory for MVP
    return process.env.HOME || process.env.USERPROFILE || '/tmp';
  }

  private getCurrentFilePath(): string {
    const now = new Date();
    const year = now.getFullYear();
    const weekNum = Math.ceil((now.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${this.auditDir}/shell-jobs-${year}-W${String(weekNum).padStart(2, '0')}.jsonl`;
  }

  /**
   * Initialize the audit directory
   */
  async init(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(this.auditDir, { recursive: true });
    } catch (error) {
      console.error(`[ShellAuditLogger] Failed to initialize audit directory: ${error}`);
    }
  }

  /**
   * Log a shell job entry
   */
  async log(entry: Omit<ShellJobEntry, 'timestamp' | 'tool'>): Promise<void> {
    const fullEntry: ShellJobEntry = {
      timestamp: new Date().toISOString(),
      tool: this.tool,
      ...entry,
    };

    try {
      await this.init();
      await this.rotateIfNeeded();
      
      const line = JSON.stringify(fullEntry) + '\n';
      await this.appendFile(this.currentFile, line);
    } catch (error) {
      console.error(`[ShellAuditLogger] Failed to write audit entry: ${error}`);
    }
  }

  private async appendFile(path: string, data: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.appendFile(path, data, 'utf8');
    } catch (error) {
      console.error(`[ShellAuditLogger] Failed to append to file: ${error}`);
    }
  }

  /**
   * Rotate log files if they exceed max size
   */
  private async rotateIfNeeded(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      try {
        const stats = await fs.stat(this.currentFile);
        if (stats.size > this.maxFileSize) {
          await this.rotate();
        }
      } catch {
        // File doesn't exist yet, no rotation needed
      }
    } catch (error) {
      console.error(`[ShellAuditLogger] Failed to check file size: ${error}`);
    }
  }

  /**
   * Rotate log files
   */
  private async rotate(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const timestamp = Date.now();
      const rotatedPath = this.currentFile.replace('.jsonl', `-${timestamp}.jsonl`);
      await fs.rename(this.currentFile, rotatedPath);
      await this.cleanupOldFiles();
    } catch (error) {
      console.error(`[ShellAuditLogger] Failed to rotate log file: ${error}`);
    }
  }

  /**
   * Cleanup old log files
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const files = await fs.readdir(this.auditDir);
      const shellJobFiles = files
        .filter(f => f.startsWith('shell-jobs-') && f.endsWith('.jsonl'))
        .map(f => ({ name: f, path: path.join(this.auditDir, f) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Remove old files beyond maxFiles limit
      if (shellJobFiles.length > this.maxFiles) {
        const filesToDelete = shellJobFiles.slice(0, shellJobFiles.length - this.maxFiles);
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
        }
      }
    } catch (error) {
      console.error(`[ShellAuditLogger] Failed to cleanup old files: ${error}`);
    }
  }

  /**
   * Query audit entries
   */
  async query(options: {
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    limit?: number;
  } = {}): Promise<ShellJobEntry[]> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(this.currentFile, 'utf8');
      const lines = content.trim().split('\n').filter((l: string) => l);
      
      const entries: ShellJobEntry[] = [];
      for (const line of lines) {
        const entry = JSON.parse(line) as ShellJobEntry;
        
        // Filter by date range
        const entryDate = new Date(entry.timestamp);
        if (options.startDate && entryDate < options.startDate) continue;
        if (options.endDate && entryDate > options.endDate) continue;
        
        // Filter by success
        if (options.success !== undefined && entry.success !== options.success) continue;
        
        entries.push(entry);
      }
      
      // Apply limit
      if (options.limit) {
        return entries.slice(-options.limit);
      }
      
      return entries;
    } catch (error) {
      console.error(`[ShellAuditLogger] Failed to query entries: ${error}`);
      return [];
    }
  }
}

/**
 * Global shell audit logger instances
 */
const shellAuditLoggers = new Map<string, ShellAuditLogger>();

export function getShellAuditLogger(tool: string): ShellAuditLogger {
  if (!shellAuditLoggers.has(tool)) {
    shellAuditLoggers.set(tool, new ShellAuditLogger(tool));
  }
  return shellAuditLoggers.get(tool)!;
}
