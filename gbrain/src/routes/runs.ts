import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, newId, now } from '../db';
import { createLogger } from '../logger';

const logger = createLogger('gbrain');
export const runsRouter = Router();

const RunInput = z.object({
  task_id: z.string(),
  config: z.record(z.unknown()).optional().default({}),
  verdict: z.string().optional(),
  cost_usd: z.number().optional().default(0),
});

// GET /runs — list all; optional ?task_id=xxx filter
runsRouter.get('/runs', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const taskId = req.query['task_id'] as string | undefined;
    let rows: any[];
    if (taskId) {
      rows = db.prepare(`SELECT * FROM runs WHERE task_id = ?`).all(taskId) as any[];
    } else {
      rows = db.prepare(`SELECT * FROM runs`).all() as any[];
    }
    res.json(rows.map(r => ({ ...r, config: JSON.parse(r.config) })));
  } catch (err) {
    logger.error('GET /runs error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});

// GET /runs/:id — single run or 404
runsRouter.get('/runs/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(req.params['id']) as any;
    if (!row) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ ...row, config: JSON.parse(row.config) });
  } catch (err) {
    logger.error('GET /runs/:id error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});

// POST /runs — create run
runsRouter.post('/runs', (req: Request, res: Response) => {
  const parsed = RunInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  try {
    const db = getDb();
    const id = newId();
    const ts = now();
    const { task_id, config, verdict, cost_usd } = parsed.data;
    db.prepare(`
      INSERT INTO runs (id, task_id, config, verdict, cost_usd, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, task_id, JSON.stringify(config), verdict ?? null, cost_usd, ts);
    const row = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(id) as any;
    res.status(201).json({ ...row, config: JSON.parse(row.config) });
  } catch (err) {
    logger.error('POST /runs error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});
