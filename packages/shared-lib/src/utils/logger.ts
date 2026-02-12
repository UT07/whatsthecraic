/**
 * Structured logging utility using Pino
 */

import pino from 'pino';
import pinoHttp from 'pino-http';
import { Request, Response } from 'express';

/**
 * Create the main logger instance
 */
const createLogger = () => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
  });
};

/**
 * Main logger instance
 */
export const logger = createLogger();

/**
 * Create HTTP logger middleware for Express
 */
export const createHttpLogger = () => {
  return pinoHttp({
    logger,
    customLogLevel: (req: Request, res: Response, err: Error | undefined) => {
      if (err) {
        return 'error';
      }

      if (res.statusCode >= 500) {
        return 'error';
      }

      if (res.statusCode >= 400) {
        return 'warn';
      }

      return 'info';
    },
    autoLogging: {
      ignore: (req: Request) => {
        return req.url === '/health' || req.url === '/metrics';
      },
    },
  });
};

/**
 * Express request type with logger attached
 */
declare global {
  namespace Express {
    interface Request {
      id: string;
      log: typeof logger;
    }
  }
}

export default logger;
