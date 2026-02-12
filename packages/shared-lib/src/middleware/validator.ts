/**
 * Validation middleware using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Middleware factory for validating request query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        logger.warn({ issues }, 'Validation error');
        next(new ValidationError('Invalid query parameters', { issues }));
      } else {
        next(err);
      }
    }
  };
}

/**
 * Middleware factory for validating request body parameters
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        logger.warn({ issues }, 'Validation error');
        next(new ValidationError('Invalid request body', { issues }));
      } else {
        next(err);
      }
    }
  };
}

/**
 * Middleware factory for validating request parameters
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        logger.warn({ issues }, 'Validation error');
        next(new ValidationError('Invalid URL parameters', { issues }));
      } else {
        next(err);
      }
    }
  };
}
