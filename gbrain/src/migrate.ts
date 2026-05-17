import { getDb } from './db';

const CURRENT_SCHEMA_VERSION = 1;

export function migrate(dbPath?: string): void {
  const db = getDb(dbPath);

  // Create schema_version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Get current schema version
  const currentVersion = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
  const version = currentVersion?.version ?? 0;

  // Run migrations if needed
  if (version < CURRENT_SCHEMA_VERSION) {
    runMigrations(db, version, CURRENT_SCHEMA_VERSION);
  }

  // Create all other tables
  createTables(db);
}

function runMigrations(db: any, fromVersion: number, toVersion: number): void {
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    switch (v) {
      case 1:
        migrateToV1(db);
        break;
      // Add future migrations here
      default:
        break;
    }
  }
}

function migrateToV1(db: any): void {
  // Initial schema - all tables created in createTables
  db.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
}

function createTables(db: any): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id         TEXT PRIMARY KEY,
      content    TEXT NOT NULL,
      metadata   TEXT NOT NULL DEFAULT '{}',
      page_kind  TEXT NOT NULL DEFAULT 'generic',
      tags       TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id         TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL,
      config     TEXT NOT NULL DEFAULT '{}',
      verdict    TEXT,
      cost_usd   REAL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id          TEXT PRIMARY KEY,
      run_id      TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      payload     TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drift (
      id          TEXT PRIMARY KEY,
      metric      TEXT NOT NULL,
      value       REAL NOT NULL,
      window      TEXT NOT NULL DEFAULT 'default',
      recorded_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cognitive (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL UNIQUE,
      state      TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS observations (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      data       TEXT NOT NULL DEFAULT '{}',
      source     TEXT NOT NULL DEFAULT 'unknown',
      created_at INTEGER NOT NULL
    );
  `);
}

export function getSchemaVersion(dbPath?: string): number {
  const db = getDb(dbPath);
  const result = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
  return result?.version ?? 0;
}
