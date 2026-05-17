import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, newId, now } from '../db';
import { createLogger } from '../logger';

const logger = createLogger('gbrain');
export const receiptsRouter = Router();

const ReceiptInput = z.object({
  run_id: z.string(),
  fingerprint: z.string(),
  payload: z.record(z.unknown()),
});

// GET /receipts/:run_id — all receipts for a run
receiptsRouter.get('/receipts/:run_id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM receipts WHERE run_id = ? ORDER BY created_at DESC`).all(req.params['run_id']) as any[];
    res.json(rows.map(r => ({ ...r, payload: JSON.parse(r.payload) })));
  } catch (err) {
    logger.error('GET /receipts/:run_id error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});

// POST /receipts — create receipt
receiptsRouter.post('/receipts', (req: Request, res: Response) => {
  const parsed = ReceiptInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  try {
    const db = getDb();
    const id = newId();
    const ts = now();
    const { run_id, fingerprint, payload } = parsed.data;
    db.prepare(`
      INSERT INTO receipts (id, run_id, fingerprint, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, run_id, fingerprint, JSON.stringify(payload), ts);
    const row = db.prepare(`SELECT * FROM receipts WHERE id = ?`).get(id) as any;
    res.status(201).json({ ...row, payload: JSON.parse(row.payload) });
  } catch (err) {
    logger.error('POST /receipts error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});
