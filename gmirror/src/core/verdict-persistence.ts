import * as path from 'path';
import * as fs from 'fs';

/**
 * SQLite Persistence Manager for VerdictAggregator
 *
 * Stores:
 * - Frustration history for trend detection
 * - Run records for historical analysis
 *
 * SQLite is required so verdict history survives restarts and production
 * deployments fail loudly if the durable store is unavailable.
 */
export class VerdictPersistenceManager {
  private db: any;
  private dbPath: string;
  private readonly SCHEMA_VERSION = 2;
  private backupDir: string;
  private backupRetentionCount: number;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || process.env.GMIRROR_DB_PATH || path.join(process.cwd(), '.gmirror', 'data', 'verdict.db');
    this.dbPath = resolvedPath;
    const dataDir = path.dirname(resolvedPath);
    this.backupDir = process.env.GMIRROR_BACKUP_DIR || path.join(dataDir, 'backups');
    this.backupRetentionCount = Math.max(1, Number(process.env.GMIRROR_BACKUP_RETENTION || '10'));

    try {
      const Database = require('better-sqlite3');
      fs.mkdirSync(dataDir, { recursive: true });
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.initializeSchema();
    } catch (error) {
      throw new Error(`Persistence is REQUIRED for GMirror: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const row = this.db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
    const currentVersion = row?.version || 0;
    if (currentVersion < this.SCHEMA_VERSION) {
      this.runMigrations(currentVersion);
    }

    this.db.prepare('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)').run(
      this.SCHEMA_VERSION,
      new Date().toISOString()
    );
  }

  addFrustrationData(data: {
    run_id: string;
    request_id: string;
    scenario_id: string;
    frustration: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO frustration_history (run_id, request_id, scenario_id, frustration, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(data.run_id, data.request_id, data.scenario_id, data.frustration, new Date().toISOString());
  }

  getFrustrationHistory(scenarioId: string, limit: number = 50): number[] {
    const stmt = this.db.prepare(`
      SELECT frustration FROM frustration_history
      WHERE scenario_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(scenarioId, limit) as { frustration: number }[];
    return rows.map((r: { frustration: number }) => r.frustration);
  }

  getAllFrustrationHistory(limit: number = 50): number[] {
    const stmt = this.db.prepare(`
      SELECT frustration FROM frustration_history
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as { frustration: number }[];
    return rows.map((r: { frustration: number }) => r.frustration);
  }

  addRunRecord(record: {
    run_id: string;
    request_id: string;
    synthetic_user_id: string;
    scenario_id: string;
    outcome: string;
    frustration: number;
    duration_ms: number;
    cost_usd: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO run_records
      (run_id, request_id, synthetic_user_id, scenario_id, outcome, frustration, duration_ms, cost_usd, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.run_id,
      record.request_id,
      record.synthetic_user_id,
      record.scenario_id,
      record.outcome,
      record.frustration,
      record.duration_ms,
      record.cost_usd,
      new Date().toISOString()
    );
  }

  getRunRecords(scenarioId: string, limit: number = 50): Array<{
    run_id: string;
    outcome: string;
    frustration: number;
    timestamp: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT run_id, outcome, frustration, timestamp FROM run_records
      WHERE scenario_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(scenarioId, limit) as Array<{
      run_id: string;
      outcome: string;
      frustration: number;
      timestamp: string;
    }>;
  }

  cleanupOldFrustrationHistory(): void {
    this.db.prepare(`
      DELETE FROM frustration_history
      WHERE id NOT IN (
        SELECT id FROM frustration_history
        ORDER BY timestamp DESC
        LIMIT 1000
      )
    `).run();
  }

  cleanupOldRunRecords(): void {
    this.db.prepare(`
      DELETE FROM run_records
      WHERE run_id NOT IN (
        SELECT run_id FROM run_records
        ORDER BY timestamp DESC
        LIMIT 1000
      )
    `).run();
  }

  transaction<T>(operation: () => T): T {
    return this.db.transaction(operation)();
  }

  backup(destinationPath?: string): string {
    fs.mkdirSync(this.backupDir, { recursive: true });
    const backupPath = destinationPath || path.join(
      this.backupDir,
      `gmirror-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    );
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(this.dbPath, backupPath);
    this.rotateBackups();
    return backupPath;
  }

  restore(sourcePath: string): void {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Backup does not exist: ${sourcePath}`);
    }
    this.db.close();
    fs.copyFileSync(sourcePath, this.dbPath);
    const Database = require('better-sqlite3');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
  }

  exportJson(): Record<string, any> {
    return {
      schema_version: this.SCHEMA_VERSION,
      db_path: this.dbPath,
      exported_at: new Date().toISOString(),
      frustration_history: this.db.prepare('SELECT * FROM frustration_history ORDER BY timestamp DESC').all(),
      run_records: this.db.prepare('SELECT * FROM run_records ORDER BY timestamp DESC').all(),
      migrations: this.db.prepare('SELECT * FROM migrations ORDER BY version ASC').all(),
      metadata: this.db.prepare('SELECT * FROM persistence_metadata ORDER BY key ASC').all(),
    };
  }

  close(): void {
    this.db.close();
  }

  getDbPath(): string {
    return this.dbPath;
  }

  private runMigrations(fromVersion: number): void {
    const migrations = this.loadMigrations();
    for (const migration of migrations) {
      if (migration.version <= fromVersion || migration.version > this.SCHEMA_VERSION) {
        continue;
      }
      this.db.transaction(() => {
        this.executeStatements(migration.sql);
        this.db.prepare('INSERT OR REPLACE INTO migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
          migration.version,
          migration.name,
          new Date().toISOString()
        );
      })();
    }
  }

  private loadMigrations(): Array<{ version: number; name: string; sql: string }> {
    const migrationDirCandidates = [
      path.join(__dirname, 'migrations'),
      path.join(process.cwd(), 'src', 'core', 'migrations'),
    ];
    const migrationDir = migrationDirCandidates.find(candidate => fs.existsSync(candidate));
    if (!migrationDir) {
      return this.embeddedMigrations();
    }

    return fs.readdirSync(migrationDir)
      .filter(file => /^\d+_.+\.sql$/.test(file))
      .sort()
      .map(file => ({
        version: Number(file.split('_')[0]),
        name: file.replace(/^\d+_/, '').replace(/\.sql$/, ''),
        sql: fs.readFileSync(path.join(migrationDir, file), 'utf8'),
      }));
  }

  private executeStatements(sql: string): void {
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/)) {
      const trimmed = statement.trim();
      if (trimmed) {
        this.db.exec(trimmed);
      }
    }
  }

  private rotateBackups(): void {
    const backups = fs.readdirSync(this.backupDir)
      .filter(name => /^gmirror-.+\.db$/.test(name))
      .map(name => path.join(this.backupDir, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    for (const stale of backups.slice(this.backupRetentionCount)) {
      fs.rmSync(stale, { force: true });
    }
  }

  private embeddedMigrations(): Array<{ version: number; name: string; sql: string }> {
    return [
      {
        version: 1,
        name: 'verdict_persistence',
        sql: `
          CREATE TABLE IF NOT EXISTS frustration_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            request_id TEXT NOT NULL,
            scenario_id TEXT NOT NULL,
            frustration REAL NOT NULL,
            timestamp TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS run_records (
            run_id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL,
            synthetic_user_id TEXT NOT NULL,
            scenario_id TEXT NOT NULL,
            outcome TEXT NOT NULL,
            frustration REAL NOT NULL,
            duration_ms INTEGER NOT NULL,
            cost_usd REAL NOT NULL,
            timestamp TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_frustration_history_run ON frustration_history(run_id, timestamp);
          CREATE INDEX IF NOT EXISTS idx_frustration_history_timestamp ON frustration_history(timestamp);
          CREATE INDEX IF NOT EXISTS idx_run_records_timestamp ON run_records(timestamp);
        `,
      },
      {
        version: 2,
        name: 'verdict_exports',
        sql: `
          CREATE TABLE IF NOT EXISTS persistence_metadata (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `,
      },
    ];
  }
}
