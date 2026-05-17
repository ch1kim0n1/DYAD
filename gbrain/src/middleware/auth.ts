import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authToken = process.env.GBRAIN_AUTH_TOKEN;
  if (!authToken) {
    return next(); // No auth configured, allow all
  }

  const providedToken = req.headers.authorization?.replace('Bearer ', '');
  if (!providedToken || providedToken !== authToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
