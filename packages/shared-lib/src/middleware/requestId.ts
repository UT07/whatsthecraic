/**
 * Request ID middleware for tracking requests across logs
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware to add unique request ID to each request
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use X-Request-ID header if provided, otherwise generate a new UUID
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Attach request ID to request object
  (req as any).id = requestId;

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
}
