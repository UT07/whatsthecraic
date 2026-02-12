# @whatsthecraic/shared-lib

Shared library containing common types, utilities, middleware, and error handling for WhatsTheCraic microservices.

## Features

- **Common Types**: User, Event, Venue, DJ, JwtPayload, and API response types
- **Structured Logging**: Pino-based logger with HTTP middleware
- **Custom Errors**: Typed error classes for consistent error handling
- **Validation Middleware**: Zod-based query/body/params validation
- **Common Schemas**: Reusable Zod schemas for pagination, search, and auth
- **Error Handling**: Express error handler middleware
- **Request Tracking**: Request ID middleware for distributed tracing

## Installation

This is an internal monorepo package. Install at the root level:

```bash
npm install
```

## Usage

### Types

Import common types used across services:

```typescript
import { User, Event, Venue, DJ, JwtPayload, ApiResponse } from '@whatsthecraic/shared-lib';

const event: Event = {
  id: '123',
  title: 'Concert',
  artistName: 'Artist Name',
  venueName: 'Venue Name',
  city: 'Dublin',
  country: 'Ireland',
  date: new Date(),
  source: 'ticketmaster',
  sourceEventId: 'abc123',
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### Logging

Use the structured logger in your services:

```typescript
import { logger, createHttpLogger } from '@whatsthecraic/shared-lib';

app.use(createHttpLogger());

logger.info({ userId: '123' }, 'User created');
logger.warn({ error: 'Connection failed' }, 'Database connection');
logger.error({ stack: err.stack }, 'Critical error');
```

### Error Handling

Use custom error classes and error handler middleware:

```typescript
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  errorHandler,
} from '@whatsthecraic/shared-lib';

// In route handlers
app.get('/users/:id', (req, res, next) => {
  if (!isValidId(req.params.id)) {
    return next(new ValidationError('Invalid user ID'));
  }

  const user = findUser(req.params.id);
  if (!user) {
    return next(new NotFoundError('User not found'));
  }

  res.json(user);
});

// Register error handler (must be last middleware)
app.use(errorHandler);
```

### Request ID Middleware

Track requests across logs with unique IDs:

```typescript
import { requestIdMiddleware } from '@whatsthecraic/shared-lib';

app.use(requestIdMiddleware);

// Now every request has a unique ID
// Access via: (req as any).id
// Response includes X-Request-ID header
```

### Validation Middleware

Validate query, body, and params with Zod schemas:

```typescript
import {
  validateQuery,
  validateBody,
  EventSearchSchema,
  LoginSchema,
} from '@whatsthecraic/shared-lib';

// Validate query parameters
app.get('/events/search',
  validateQuery(EventSearchSchema),
  (req, res) => {
    // req.query is now validated
  }
);

// Validate request body
app.post('/auth/login',
  validateBody(LoginSchema),
  (req, res) => {
    // req.body is now validated
  }
);
```

### Common Schemas

Pre-built Zod schemas for common patterns:

```typescript
import {
  PaginationSchema,
  EventSearchSchema,
  DJSearchSchema,
  LoginSchema,
  SignupSchema,
} from '@whatsthecraic/shared-lib';

// Use directly
const query = EventSearchSchema.parse(req.query);

// Or compose
const CustomSchema = EventSearchSchema.extend({
  includeDetails: z.boolean().default(false),
});
```

## Architecture

```
packages/shared-lib/
├── src/
│   ├── types/
│   │   └── common.ts           # Common interface types
│   ├── utils/
│   │   ├── logger.ts           # Pino logger setup
│   │   ├── errors.ts           # Custom error classes
│   │   └── schemas.ts          # Zod validation schemas
│   ├── middleware/
│   │   ├── errorHandler.ts     # Express error handler
│   │   ├── requestId.ts        # Request ID tracking
│   │   └── validator.ts        # Query/body/params validation
│   └── index.ts                # Main exports
├── package.json
├── tsconfig.json
└── README.md
```

## Building

Build the library to generate TypeScript declarations and JavaScript output:

```bash
npm run build
```

Output is generated in the `dist/` directory.

Type checking:

```bash
npm run type-check
```

## Integration with Services

Each service can import from the shared library:

```typescript
import {
  logger,
  requestIdMiddleware,
  validateQuery,
  errorHandler,
  EventSearchSchema,
  Event,
  User,
} from '@whatsthecraic/shared-lib';

const app = express();

// Setup middleware
app.use(requestIdMiddleware);
app.use(createHttpLogger());

// Routes
app.get('/events/search',
  validateQuery(EventSearchSchema),
  async (req, res, next) => {
    try {
      const events: Event[] = await searchEvents(req.query);
      res.json({ success: true, data: events });
    } catch (err) {
      next(err);
    }
  }
);

// Error handling (last middleware)
app.use(errorHandler);
```

## Error Handling Best Practices

1. **Always use custom error classes**:
   ```typescript
   // Good
   throw new NotFoundError('User not found', { userId });

   // Avoid
   throw new Error('User not found');
   ```

2. **Include context for debugging**:
   ```typescript
   throw new ValidationError('Invalid email', {
     email: req.body.email,
     field: 'email',
   });
   ```

3. **Use appropriate status codes**:
   - `ValidationError`: 400
   - `UnauthorizedError`: 401
   - `ForbiddenError`: 403
   - `NotFoundError`: 404
   - `ConflictError`: 409
   - `RateLimitError`: 429
   - `InternalError`: 500
   - `ServiceUnavailableError`: 503

4. **Let the error handler format responses**:
   ```typescript
   // Middleware will catch and format
   app.use(errorHandler);

   // Errors are automatically formatted as JSON
   ```

## Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "context": {
      "issues": [
        {
          "field": "limit",
          "message": "Number must be less than or equal to 100"
        }
      ]
    }
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-02-12T15:30:45.123Z"
  }
}
```

## Contributing

When adding new shared code:

1. Add types to `src/types/`
2. Add utilities to `src/utils/`
3. Add middleware to `src/middleware/`
4. Export from `src/index.ts`
5. Update this README with usage examples
6. Build and test in dependent services

## Future Enhancements

- [ ] Cache middleware (Redis)
- [ ] Rate limiting middleware
- [ ] Database client wrapper
- [ ] Authentication middleware (JWT)
- [ ] API documentation utilities
- [ ] Metrics/observability helpers
