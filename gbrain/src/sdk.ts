/**
 * GBrainSDK — typed in-process library wrapping the SQLite layer.
 * Does NOT start an HTTP server.
 */

import { resetDb, getDb, newId, now } from './db';
import { migrate } from './migrate';

// ---- Typed return shapes ----

export interface Page {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  page_kind: string;
  tags: string[];
  updated_at: number;
}

export interface Run {
  id: string;
  task_id: string;
  config: Record<string, unknown>;
  verdict: string | null;
  cost_usd: number;
  created_at: number;
}

export interface Receipt {
  id: string;
  run_id: string;
  fingerprint: string;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface DriftEntry {
  id: string;
  metric: string;
  value: number;
  window: string;
  recorded_at: number;
}

export interface CognitiveState {
  id: string;
  user_id: string;
  state: Record<string, unknown>;
  updated_at: number;
}

export interface Observation {
  id: string;
  type: string;
  data: Record<string, unknown>;
  source: string;
  created_at: number;
}

// ---- Input types ----

export interface CreatePageInput {
  content: string;
  metadata?: Record<string, unknown>;
  page_kind?: string;
  tags?: string[];
}

export interface CreateRunInput {
  task_id: string;
  config?: Record<string, unknown>;
  verdict?: string;
  cost_usd?: number;
}

export interface CreateReceiptInput {
  run_id: string;
  fingerprint: string;
  payload: Record<string, unknown>;
}

export interface CreateObservationInput {
  type: string;
  data?: Record<string, unknown>;
  source?: string;
}

// ---- SDK class ----

export class GBrainSDK {
  private dbPath: string;

  constructor(options: { dbPath?: string } = {}) {
    this.dbPath = options.dbPath ?? ':memory:';
    // Reset singleton so each SDK instance can use its own db path
    resetDb();
    migrate(this.dbPath);
  }

  private get db() {
    return getDb(this.dbPath);
  }

  // ---- Pages ----

  createPage(input: CreatePageInput): Page {
    const id = newId();
    const ts = now();
    const metadata = input.metadata ?? {};
    const page_kind = input.page_kind ?? 'generic';
    const tags = input.tags ?? [];
    this.db.prepare(`
      INSERT INTO pages (id, content, metadata, page_kind, tags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.content, JSON.stringify(metadata), page_kind, JSON.stringify(tags), ts);
    return this.getPage(id)!;
  }

  getPage(id: string): Page | null {
    const row = this.db.prepare(`SELECT * FROM pages WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return { ...row, metadata: JSON.parse(row.metadata), tags: JSON.parse(row.tags) };
  }

  listPages(filter?: { tag?: string }): Page[] {
    let rows: any[];
    if (filter?.tag) {
      rows = this.db.prepare(`SELECT * FROM pages WHERE tags LIKE ?`).all(`%"${filter.tag}"%`) as any[];
    } else {
      rows = this.db.prepare(`SELECT * FROM pages`).all() as any[];
    }
    return rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata), tags: JSON.parse(r.tags) }));
  }

  deletePage(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM pages WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  // ---- Runs ----

  createRun(input: CreateRunInput): Run {
    const id = newId();
    const ts = now();
    const config = input.config ?? {};
    this.db.prepare(`
      INSERT INTO runs (id, task_id, config, verdict, cost_usd, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.task_id, JSON.stringify(config), input.verdict ?? null, input.cost_usd ?? 0, ts);
    return this.getRun(id)!;
  }

  getRun(id: string): Run | null {
    const row = this.db.prepare(`SELECT * FROM runs WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return { ...row, config: JSON.parse(row.config) };
  }

  listRuns(taskId?: string): Run[] {
    let rows: any[];
    if (taskId) {
      rows = this.db.prepare(`SELECT * FROM runs WHERE task_id = ?`).all(taskId) as any[];
    } else {
      rows = this.db.prepare(`SELECT * FROM runs`).all() as any[];
    }
    return rows.map(r => ({ ...r, config: JSON.parse(r.config) }));
  }

  // ---- Receipts ----

  createReceipt(input: CreateReceiptInput): Receipt {
    const id = newId();
    const ts = now();
    this.db.prepare(`
      INSERT INTO receipts (id, run_id, fingerprint, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, input.run_id, input.fingerprint, JSON.stringify(input.payload), ts);
    const row = this.db.prepare(`SELECT * FROM receipts WHERE id = ?`).get(id) as any;
    return { ...row, payload: JSON.parse(row.payload) };
  }

  getReceiptsByRun(runId: string): Receipt[] {
    const rows = this.db.prepare(`SELECT * FROM receipts WHERE run_id = ? ORDER BY created_at DESC`).all(runId) as any[];
    return rows.map(r => ({ ...r, payload: JSON.parse(r.payload) }));
  }

  // ---- Drift ----

  recordDrift(metric: string, value: number, window: string = 'default'): DriftEntry {
    const id = newId();
    const ts = now();
    this.db.prepare(`
      INSERT INTO drift (id, metric, value, window, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, metric, value, window, ts);
    return this.db.prepare(`SELECT * FROM drift WHERE id = ?`).get(id) as DriftEntry;
  }

  getDrift(metric: string): DriftEntry[] {
    return this.db.prepare(`SELECT * FROM drift WHERE metric = ? ORDER BY recorded_at DESC LIMIT 50`).all(metric) as DriftEntry[];
  }

  // ---- Cognitive ----

  getCognitiveState(userId: string): CognitiveState | null {
    const row = this.db.prepare(`SELECT * FROM cognitive WHERE user_id = ?`).get(userId) as any;
    if (!row) return null;
    return { ...row, state: JSON.parse(row.state) };
  }

  setCognitiveState(userId: string, state: Record<string, unknown>): CognitiveState {
    const ts = now();
    const existing = this.db.prepare(`SELECT id FROM cognitive WHERE user_id = ?`).get(userId) as any;
    const id = existing ? existing.id : newId();
    this.db.prepare(`
      INSERT INTO cognitive (id, user_id, state, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
    `).run(id, userId, JSON.stringify(state), ts);
    return this.getCognitiveState(userId)!;
  }

  // ---- Observations ----

  createObservation(input: CreateObservationInput): Observation {
    const id = newId();
    const ts = now();
    const data = input.data ?? {};
    const source = input.source ?? 'unknown';
    this.db.prepare(`
      INSERT INTO observations (id, type, data, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, input.type, JSON.stringify(data), source, ts);
    const row = this.db.prepare(`SELECT * FROM observations WHERE id = ?`).get(id) as any;
    return { ...row, data: JSON.parse(row.data) };
  }

  listObservations(type?: string, source?: string): Observation[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (source) { conditions.push('source = ?'); params.push(source); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(100);
    const rows = this.db.prepare(`SELECT * FROM observations ${where} ORDER BY created_at DESC LIMIT ?`).all(...params) as any[];
    return rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
  }
}
