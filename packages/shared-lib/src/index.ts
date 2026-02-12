/**
 * WhatsTheCraic Shared Library - Main exports
 */

// Types
export * from './types/common';

// Utils - Logger
export { logger, createHttpLogger } from './utils/logger';

// Utils - Errors
export {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  InternalError,
  ServiceUnavailableError,
  isAppError,
} from './utils/errors';

// Utils - Schemas
export {
  PaginationSchema,
  CityFilterSchema,
  EventSearchSchema,
  DJSearchSchema,
  VenueSearchSchema,
  LoginSchema,
  SignupSchema,
  IdParamSchema,
} from './utils/schemas';

// Middleware
export { errorHandler, asyncHandler } from './middleware/errorHandler';
export { requestIdMiddleware } from './middleware/requestId';
export { validateQuery, validateBody, validateParams } from './middleware/validator';
