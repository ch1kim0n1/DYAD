import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, newId, now } from '../db';
import { createLogger } from '../logger';

const logger = createLogger('gbrain');
export const driftRouter = Router();

const DriftInput = z.object({
  metric: z.string(),
  value: z.number(),
  window: z.string().optional().default('default'),
});

// GET /drift/:metric — latest 50 entries for metric, newest first
driftRouter.get('/drift/:metric', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM drift WHERE metric = ? ORDER BY recorded_at DESC LIMIT 50`).all(req.params['metric']) as any[];
    res.json(rows);
  } catch (err) {
    logger.error('GET /drift/:metric error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});

// POST /drift — record drift entry
driftRouter.post('/drift', (req: Request, res: Response) => {
  const parsed = DriftInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  try {
    const db = getDb();
    const id = newId();
    const ts = now();
    const { metric, value, window } = parsed.data;
    db.prepare(`
      INSERT INTO drift (id, metric, value, window, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, metric, value, window, ts);
    const row = db.prepare(`SELECT * FROM drift WHERE id = ?`).get(id) as any;
    res.status(201).json(row);
  } catch (err) {
    logger.error('POST /drift error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});
