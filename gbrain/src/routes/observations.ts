import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, newId, now } from '../db';
import { createLogger } from '../logger';

const logger = createLogger('gbrain');
export const observationsRouter = Router();

const ObservationInput = z.object({
  type: z.string(),
  data: z.record(z.unknown()).optional().default({}),
  source: z.string().optional().default('unknown'),
});

// GET /observations — list with optional ?type=xxx&source=xxx filters, limit 100
observationsRouter.get('/observations', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const type = req.query['type'] as string | undefined;
    const source = req.query['source'] as string | undefined;
    const conditions: string[] = [];
    const params: any[] = [];
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (source) { conditions.push('source = ?'); params.push(source); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(100);
    const rows = db.prepare(`SELECT * FROM observations ${where} ORDER BY created_at DESC LIMIT ?`).all(...params) as any[];
    res.json(rows.map(r => ({ ...r, data: JSON.parse(r.data) })));
  } catch (err) {
    logger.error('GET /observations error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});

// POST /observations — create observation
observationsRouter.post('/observations', (req: Request, res: Response) => {
  const parsed = ObservationInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  try {
    const db = getDb();
    const id = newId();
    const ts = now();
    const { type, data, source } = parsed.data;
    db.prepare(`
      INSERT INTO observations (id, type, data, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, type, JSON.stringify(data), source, ts);
    const row = db.prepare(`SELECT * FROM observations WHERE id = ?`).get(id) as any;
    res.status(201).json({ ...row, data: JSON.parse(row.data) });
  } catch (err) {
    logger.error('POST /observations error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});
