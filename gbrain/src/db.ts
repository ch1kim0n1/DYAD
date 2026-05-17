import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import * as fs from 'fs';

let instance: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (instance) return instance;
  const filePath = dbPath ?? process.env.GBRAIN_DB_PATH ?? path.join(os.homedir(), '.gbrain', 'gbrain.db');
  if (filePath !== ':memory:') {
    const dir = path.dirname(filePath);
    // Ensure directory exists
    fs.mkdirSync(dir, { recursive: true });
  }
  instance = new Database(filePath);
  return instance;
}

/** Reset singleton — used in tests to swap in a :memory: DB */
export function resetDb(): void {
  instance = null;
}

export function newId(): string {
  return randomUUID();
}

export function now(): number {
  return Date.now();
}
