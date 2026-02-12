# Testing Dependencies for WhatsTheCraic

This document outlines all testing frameworks and dependencies required for Phase 1 testing infrastructure.

## Core Testing Framework

### Jest
- **jest**: ^29.5.0 - Testing framework
- **ts-jest**: ^29.1.0 - TypeScript support for Jest
- **@types/jest**: ^29.5.0 - Type definitions for Jest

## TypeScript Support

- **typescript**: ^5.0.0 - TypeScript compiler
- **@types/node**: ^18.0.0 - Node.js type definitions
- **ts-node**: ^10.9.0 - Execute TypeScript directly

## Mocking and Test Utilities

- **jest-mock-extended**: ^3.0.0 - Advanced mocking for TypeScript
- **supertest**: ^6.3.0 - HTTP assertion library for testing Express
- **@types/supertest**: ^2.0.10 - Type definitions for supertest
- **jest-when**: ^3.5.0 - Mocking library for complex test scenarios

## Code Coverage

- **@types/jest**: ^29.5.0 - Includes coverage support
- **jest-coverage-report**: ^1.4.0 - Enhanced coverage reporting (optional)

## Testing Utilities

- **@testing-library/jest-dom**: ^5.16.0 - DOM matchers for Jest
- **dotenv**: ^16.0.0 - Environment variable management for tests

## Linting and Code Quality

- **eslint**: ^8.35.0 - JavaScript linting
- **@typescript-eslint/eslint-plugin**: ^5.50.0 - TypeScript linting
- **@typescript-eslint/parser**: ^5.50.0 - TypeScript parser for ESLint
- **prettier**: ^2.8.0 - Code formatting

## Pre-commit Hooks (Optional but Recommended)

- **husky**: ^8.0.0 - Git hooks
- **lint-staged**: ^13.1.0 - Run linters on staged files

## Container Testing (Integration Tests)

- **testcontainers**: ^9.0.0 - Manage test containers (MySQL, Redis)

## API Documentation and Testing

- **openapi-types**: ^12.0.0 - OpenAPI type definitions (for validation testing)

## All Dependencies Combined (npm install command)

```bash
npm install --save-dev \
  jest@29.5.0 \
  ts-jest@29.1.0 \
  @types/jest@29.5.0 \
  typescript@5.0.0 \
  @types/node@18.0.0 \
  ts-node@10.9.0 \
  jest-mock-extended@3.0.0 \
  supertest@6.3.0 \
  @types/supertest@2.0.10 \
  jest-when@3.5.0 \
  @testing-library/jest-dom@5.16.0 \
  dotenv@16.0.0 \
  eslint@8.35.0 \
  @typescript-eslint/eslint-plugin@5.50.0 \
  @typescript-eslint/parser@5.50.0 \
  prettier@2.8.0 \
  husky@8.0.0 \
  lint-staged@13.1.0 \
  testcontainers@9.0.0 \
  openapi-types@12.0.0
```

## Environment-Specific Dependencies

### Development
- eslint
- prettier
- husky
- lint-staged
- typescript
- ts-node

### Testing
- jest
- ts-jest
- @types/jest
- jest-mock-extended
- supertest
- testcontainers

### Production
- None of the above (all are devDependencies)

## Installation Steps

### 1. Root Level Installation
```bash
cd /sessions/wonderful-relaxed-planck/mnt/whatsthecraic
npm install --save-dev jest ts-jest @types/jest typescript @types/node
```

### 2. Per-Service Installation
```bash
cd aggregator-service
npm install --save-dev supertest @types/supertest jest-mock-extended
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

Repeat for each service:
- auth-service
- events-service
- dj-service
- venue-service
- ml-service

### 3. Shared Library Setup
```bash
cd packages/shared-lib
npm install --save-dev jest ts-jest @types/jest
```

## Configuration Files

The following configuration files have been created:

1. **jest.config.js** - Root configuration defining all service projects
2. **jest.config.base.js** - Base configuration extended by all services
3. **jest.setup.js** - Global Jest setup (environment, console mocking)
4. **{service}/jest.config.js** - Per-service configuration (7 files)
5. **packages/shared-lib/jest.config.js** - Shared library configuration

## Test Coverage Thresholds

Global minimums (enforced by all services):
- **Branches**: 65%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

These align with the enterprise target of 75% overall coverage.

## Scripts to Add to Root package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=__tests__/unit",
    "test:integration": "jest --testPathPattern=__tests__/integration",
    "test:e2e": "jest --testPathPattern=__tests__/e2e",
    "test:ci": "jest --coverage --ci --maxWorkers=2",
    "lint": "eslint . --ext .ts,.js",
    "lint:fix": "eslint . --ext .ts,.js --fix",
    "format": "prettier --write \"**/*.{ts,js,json,md}\"",
    "type-check": "tsc --noEmit"
  }
}
```

## CI/CD Integration

These dependencies enable:
1. **Pre-commit hooks** (via husky + lint-staged)
2. **Automated test runs** (via GitHub Actions)
3. **Coverage reporting** (via Jest built-in and codecov)
4. **Type checking** (via TypeScript)
5. **Code linting** (via ESLint)
6. **Code formatting** (via Prettier)

## Notes

- All versions are pinned for reproducibility
- Development dependencies are separated from production
- Test environment uses `NODE_ENV=test`
- Console output is mocked during tests for cleaner output
- Default test timeout is 10 seconds (configurable per test)
