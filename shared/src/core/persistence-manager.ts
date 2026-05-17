/**
 * Persistence Manager
 * 
 * Provides:
 * - Required persistence for stateful tools
 * - Automatic state serialization and deserialization
 * - Persistence failure handling and recovery
 * - File-based persistence (SQLite optional if better-sqlite3 is available)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

let Database: any = null;
try {
  // @ts-ignore - better-sqlite3 is optional
  Database = require('better-sqlite3');
} catch {
  // better-sqlite3 not available, will use file-based persistence
}

export interface PersistenceConfig {
  tool: string;
  statePath?: string;
  autoSave?: boolean;
  saveInterval?: number;
  useSQLite?: boolean; // Enable SQLite persistence (requires better-sqlite3)
}

export interface PersistedState<T> {
  version: string;
  timestamp: string;
  state: T;
}

export class PersistenceManager<T> {
  private config: PersistenceConfig;
  private state: T | null = null;
  private saveTimer: any = null;
  private initialState: T;
  private db: any = null;

  constructor(initialState: T, config: PersistenceConfig) {
    this.initialState = initialState;
    this.config = {
      autoSave: true,
      saveInterval: 30000, // 30 seconds
      useSQLite: !!Database, // Only use SQLite if better-sqlite3 is available
      ...config,
    };
  }

  /**
   * Initialize persistence
   */
  async init(): Promise<void> {
    try {
      if (this.config.useSQLite) {
        await this.initSQLite();
      }

      const loaded = await this.load();
      if (loaded) {
        this.state = loaded;
        console.log(`[PersistenceManager] Loaded state for ${this.config.tool}`);
      } else {
        this.state = this.initialState;
        await this.save();
        console.log(`[PersistenceManager] Initialized state for ${this.config.tool}`);
      }

      if (this.config.autoSave) {
        this.startAutoSave();
      }
    } catch (error) {
      console.error(`[PersistenceManager] Failed to initialize: ${error}`);
      throw new Error(`Persistence initialization failed: ${error}`);
    }
  }

  /**
   * Initialize SQLite database
   */
  private async initSQLite(): Promise<void> {
    if (!Database) {
      console.warn(`[PersistenceManager] better-sqlite3 not available, using file-based persistence`);
      return;
    }

    const statePath = this.config.statePath || path.join(process.cwd(), '.gbrain-corpus', `${this.config.tool}.db`);
    const dbDir = path.dirname(statePath);
    
    await fs.mkdir(dbDir, { recursive: true });
    
    this.db = new Database(statePath);
    
    // Create state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    
    console.log(`[PersistenceManager] SQLite initialized at ${statePath}`);
  }

  /**
   * Get current state
   */
  getState(): T {
    if (this.state === null) {
      throw new Error(`State not initialized for ${this.config.tool}`);
    }
    return this.state;
  }

  /**
   * Update state
   */
  async updateState(updater: (state: T) => T): Promise<void> {
    if (this.state === null) {
      throw new Error(`State not initialized for ${this.config.tool}`);
    }

    this.state = updater(this.state);
    
    if (this.config.autoSave) {
      await this.save();
    }
  }

  /**
   * Save state to disk
   */
  async save(): Promise<void> {
    if (this.state === null) {
      throw new Error(`State not initialized for ${this.config.tool}`);
    }

    try {
      const persisted: PersistedState<T> = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        state: this.state,
      };

      const serialized = JSON.stringify(persisted, null, 2);
      
      if (this.config.useSQLite && this.db && Database) {
        // Save to SQLite
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO state (key, value, updated_at)
          VALUES (?, ?, ?)
        `);
        stmt.run('current_state', serialized, new Date().toISOString());
      } else {
        // Fallback to file-based persistence
        const statePath = this.config.statePath || path.join(process.cwd(), '.gbrain-corpus', `${this.config.tool}-state.json`);
        const stateDir = path.dirname(statePath);
        await fs.mkdir(stateDir, { recursive: true });
        await fs.writeFile(statePath, serialized, 'utf8');
      }
    } catch (error) {
      console.error(`[PersistenceManager] Failed to save state: ${error}`);
      throw new Error(`Persistence save failed: ${error}`);
    }
  }

  /**
   * Load state from disk
   */
  async load(): Promise<T | null> {
    try {
      if (this.config.useSQLite && this.db && Database) {
        // Load from SQLite
        const stmt = this.db.prepare('SELECT value FROM state WHERE key = ?');
        const row = stmt.get('current_state') as { value: string } | undefined;
        
        if (row) {
          const persisted: PersistedState<T> = JSON.parse(row.value);
          return persisted.state;
        }
      } else {
        // Fallback to file-based persistence
        const statePath = this.config.statePath || path.join(process.cwd(), '.gbrain-corpus', `${this.config.tool}-state.json`);
        try {
          const content = await fs.readFile(statePath, 'utf8');
          const persisted: PersistedState<T> = JSON.parse(content);
          return persisted.state;
        } catch (error) {
          const err = error as { code?: string };
          if (err.code === 'ENOENT') {
            return null;
          }
          throw error;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`[PersistenceManager] Failed to load state: ${error}`);
      return null;
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }

    this.saveTimer = setInterval(() => {
      this.save().catch(error => {
        console.error(`[PersistenceManager] Auto-save failed: ${error}`);
      });
    }, this.config.saveInterval);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /**
   * Cleanup and save final state
   */
  async shutdown(): Promise<void> {
    this.stopAutoSave();
    await this.save();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    console.log(`[PersistenceManager] Shutdown complete for ${this.config.tool}`);
  }

  /**
   * Reset state to initial value
   */
  async reset(): Promise<void> {
    this.state = this.initialState;
    await this.save();
    console.log(`[PersistenceManager] State reset for ${this.config.tool}`);
  }

  /**
   * Check if persistence is healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    lastSave?: string;
    error?: string;
  }> {
    try {
      if (this.state === null) {
        return {
          healthy: false,
          error: 'State not initialized',
        };
      }

      return {
        healthy: true,
        lastSave: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Create a persistence manager for a tool
 */
export function createPersistenceManager<T>(
  initialState: T,
  tool: string,
  options?: {
    statePath?: string;
    autoSave?: boolean;
    saveInterval?: number;
  }
): PersistenceManager<T> {
  return new PersistenceManager(initialState, {
    tool,
    ...options,
  });
}
