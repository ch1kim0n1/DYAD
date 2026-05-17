import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, newId, now } from '../db';
import { createLogger } from '../logger';

const logger = createLogger('gbrain');
export const pagesRouter = Router();

const PageInput = z.object({
  content: z.string(),
  metadata: z.record(z.unknown()).optional().default({}),
  page_kind: z.string().optional().default('generic'),
  tags: z.array(z.string()).optional().default([]),
});

// GET /pages — list all; optional ?tag=xxx filter
pagesRouter.get('/pages', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const tag = req.query['tag'] as string | undefined;
    let rows: any[];
    if (tag) {
      rows = db.prepare(`SELECT * FROM pages WHERE tags LIKE ?`).all(`%"${tag}"%`) as any[];
    } else {
      rows = db.prepare(`SELECT * FROM pages`).all() as any[];
    }
    res.json(rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata), tags: JSON.parse(r.tags) })));
  } catch (err) {
    logger.error('GET /pages error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});

// GET /pages/:id — single page or 404
pagesRouter.get('/pages/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(req.params['id']) as any;
    if (!row) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ ...row, metadata: JSON.parse(row.metadata), tags: JSON.parse(row.tags) });
  } catch (err) {
    logger.error('GET /pages/:id error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});

// POST /pages — create page
pagesRouter.post('/pages', (req: Request, res: Response) => {
  const parsed = PageInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  try {
    const db = getDb();
    const id = newId();
    const ts = now();
    const { content, metadata, page_kind, tags } = parsed.data;
    db.prepare(`
      INSERT INTO pages (id, content, metadata, page_kind, tags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, content, JSON.stringify(metadata), page_kind, JSON.stringify(tags), ts);
    const row = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(id) as any;
    res.status(201).json({ ...row, metadata: JSON.parse(row.metadata), tags: JSON.parse(row.tags) });
  } catch (err) {
    logger.error('POST /pages error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});

// DELETE /pages/:id — delete or 404
pagesRouter.delete('/pages/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = db.prepare(`DELETE FROM pages WHERE id = ?`).run(req.params['id']);
    if (result.changes === 0) { res.status(404).json({ error: 'not found' }); return; }
    res.status(204).send();
  } catch (err) {
    logger.error('DELETE /pages/:id error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'database error' });
  }
});
