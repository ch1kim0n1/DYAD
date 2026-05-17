import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, newId, now } from '../db';
import { createLogger } from '../logger';

const logger = createLogger('gbrain');
export const cognitiveRouter = Router();

const CognitiveInput = z.object({
  state: z.record(z.unknown()),
});

// GET /cognitive/:user_id — return state for user or 404
cognitiveRouter.get('/cognitive/:user_id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM cognitive WHERE user_id = ?`).get(req.params['user_id']) as any;
    if (!row) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ ...row, state: JSON.parse(row.state) });
  } catch (err) {
    logger.error('GET /cognitive/:user_id error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});

// PUT /cognitive/:user_id — upsert state
cognitiveRouter.put('/cognitive/:user_id', (req: Request, res: Response) => {
  const parsed = CognitiveInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  try {
    const db = getDb();
    const user_id = req.params['user_id'];
    const ts = now();
    const existing = db.prepare(`SELECT id FROM cognitive WHERE user_id = ?`).get(user_id) as any;
    const id = existing ? existing.id : newId();
    db.prepare(`
      INSERT INTO cognitive (id, user_id, state, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
    `).run(id, user_id, JSON.stringify(parsed.data.state), ts);
    const row = db.prepare(`SELECT * FROM cognitive WHERE user_id = ?`).get(user_id) as any;
    res.json({ ...row, state: JSON.parse(row.state) });
  } catch (err) {
    logger.error('PUT /cognitive/:user_id error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});
