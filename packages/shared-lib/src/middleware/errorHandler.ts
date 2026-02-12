/**
 * Express error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError, isAppError } from '../utils/errors';

/**
 * Express error handling middleware
 * This should be the last middleware in the chain
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const requestId = (req as any).id || 'unknown';

  // Log the error
  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error(
        {
          code: err.code,
          statusCode: err.statusCode,
          context: err.context,
          requestId,
          stack: err.stack,
        },
        err.message
      );
    } else {
      logger.warn(
        {
          code: err.code,
          statusCode: err.statusCode,
          context: err.context,
          requestId,
        },
        err.message
      );
    }

    // Send AppError response
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.context && { context: err.context }),
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  } else {
    // Unhandled errors
    logger.error(
      {
        code: 'UNHANDLED_ERROR',
        requestId,
        stack: err.stack,
      },
      err.message || 'An unexpected error occurred'
    );

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Wrapper to catch async errors in route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
