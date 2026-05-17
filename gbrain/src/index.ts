import express from 'express';
import { migrate } from './migrate';
import { healthRouter } from './routes/health';
import { pagesRouter } from './routes/pages';
import { receiptsRouter } from './routes/receipts';
import { runsRouter } from './routes/runs';
import { driftRouter } from './routes/drift';
import { cognitiveRouter } from './routes/cognitive';
import { observationsRouter } from './routes/observations';
import { createLogger } from './logger';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware, securityMiddleware, requestLogger, apiSecurityHeaders } from './middleware/security.js';

const logger = createLogger('gbrain');

migrate();

const app = express();

// Apply security middleware first
app.use(...securityMiddleware);
app.use(requestLogger);
app.use(apiSecurityHeaders);

app.use(express.json({ limit: '10mb' }));

// Apply auth and rate-limit to all routes
app.use(authMiddleware);
app.use(rateLimitMiddleware(Number(process.env.GBRAIN_RATE_LIMIT_RPM) || 60));

// Request logging in dev mode
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });
}

app.use(healthRouter);
app.use(pagesRouter);
app.use(receiptsRouter);
app.use(runsRouter);
app.use(driftRouter);
app.use(cognitiveRouter);
app.use(observationsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, () => {
  logger.info(`running on http://localhost:${PORT}`);
});
