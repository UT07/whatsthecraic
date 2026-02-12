/**
 * Custom error classes for consistent error handling
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400 Bad Request)
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('VALIDATION_ERROR', 400, message, context);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Not found error (404 Not Found)
 */
export class NotFoundError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('NOT_FOUND', 404, message, context);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Unauthorized error (401 Unauthorized)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', context?: Record<string, unknown>) {
    super('UNAUTHORIZED', 401, message, context);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * Forbidden error (403 Forbidden)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions', context?: Record<string, unknown>) {
    super('FORBIDDEN', 403, message, context);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Conflict error (409 Conflict)
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('CONFLICT', 409, message, context);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Rate limit error (429 Too Many Requests)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', context?: Record<string, unknown>) {
    super('RATE_LIMIT_EXCEEDED', 429, message, context);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Internal server error (500 Internal Server Error)
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', context?: Record<string, unknown>) {
    super('INTERNAL_ERROR', 500, message, context);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

/**
 * Service unavailable error (503 Service Unavailable)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable', context?: Record<string, unknown>) {
    super('SERVICE_UNAVAILABLE', 503, message, context);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
