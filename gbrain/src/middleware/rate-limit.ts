import { Request, Response, NextFunction } from 'express';

const requestMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimitMiddleware(rpm: number = 60) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    const record = requestMap.get(clientIp);
    if (!record || now > record.resetTime) {
      requestMap.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= rpm) {
      const resetAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', String(resetAfter));
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    record.count++;
    next();
  };
}
