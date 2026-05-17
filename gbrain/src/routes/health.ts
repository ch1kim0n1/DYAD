import { Router } from 'express';
import { getDb } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ healthy: true, status: 'ok', service: 'gbrain', version: '0.1.0' });
});

healthRouter.get('/health/live', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/health/ready', (_req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unavailable' });
  }
});
