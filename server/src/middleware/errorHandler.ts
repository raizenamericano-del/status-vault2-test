import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, 'Unhandled error');
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? 'Internal server error' : (err.message || 'Request failed');
  res.status(status).json({ error: message });
}
