# Testing Infrastructure - Phase 1.1 Preparation

Complete testing framework setup for WhatsTheCraic enterprise transformation. This document describes the Phase 1 testing infrastructure preparation (not yet executed).

## Overview

The testing infrastructure is organized into three levels:

1. **Unit Tests** - Test individual functions and modules in isolation
2. **Integration Tests** - Test service-to-service interactions and workflows
3. **E2E Tests** - Test complete user journeys across all services

## Directory Structure

### Jest Configuration Files

```
/jest.config.js                 # Root configuration (aggregates all projects)
/jest.config.base.js            # Base configuration extended by all services
/jest.setup.js                  # Global Jest setup

/aggregator-service/
  /jest.config.js               # Service-specific configuration

/auth-service/
  /jest.config.js

/events-service/
  /jest.config.js

/dj-service/
  /jest.config.js

/venue-service/
  /jest.config.js

/ml-service/
  /jest.config.js

/packages/shared-lib/
  /jest.config.js
```

### Test Directory Structure

Each service follows a consistent test structure:

```
{service}/src/
  /__tests__/
    /unit/                      # Unit tests
      /{feature}.test.ts
    /integration/               # Integration tests
      /{feature}.test.ts
    /e2e/                       # E2E tests (optional per service)
      /{workflow}.test.ts
  /features/
    /{feature}.ts              # Source code
```

Example for events-service:

```
events-service/src/
  /__tests__/
    /unit/
      /middleware.test.ts
      /handlers.test.ts
      /validation.test.ts
    /integration/
      /events.test.ts
      /database.test.ts
    /e2e/
      /search-workflow.test.ts
  /middleware/
  /handlers/
  /utils/
```

### Test Files Created

#### Unit Test Template
- **File**: `packages/shared-lib/src/__tests__/unit/logger.test.ts`
- **Purpose**: Template for unit testing utility modules
- **Covers**: Logger initialization, log levels, structured logging, error handling
- **Pattern**: Isolated component testing with mocked dependencies

#### Integration Test Template
- **File**: `events-service/src/__tests__/integration/events.test.ts`
- **Purpose**: Template for testing API endpoints with database
- **Covers**: CRUD operations, filtering, pagination, authentication, caching
- **Pattern**: Real database + Redis + API endpoint testing

#### E2E Test Template
- **File**: `__tests__/e2e/event-search.test.ts`
- **Purpose**: Template for complete user workflows
- **Covers**: Search → Filter → View Details → Save → Manage Favorites
- **Pattern**: HTTP-level testing simulating real user behavior

#### Test Utilities Template
- **File**: `packages/shared-lib/src/__tests__/unit/test-utils.test.ts`
- **Purpose**: Reusable testing utilities and helpers
- **Includes**: Mock factories, data generators, JWT helpers, timing utilities

## Jest Configuration Details

### Root Configuration (`jest.config.js`)

Uses Jest's `projects` feature to run tests across all services:

```javascript
projects: [
  '<rootDir>/aggregator-service/jest.config.js',
  '<rootDir>/auth-service/jest.config.js',
  '<rootDir>/events-service/jest.config.js',
  '<rootDir>/dj-service/jest.config.js',
  '<rootDir>/venue-service/jest.config.js',
  '<rootDir>/ml-service/jest.config.js',
  '<rootDir>/packages/shared-lib/jest.config.js',
]
```

**Benefits**:
- Single `npm test` command runs all services
- Services run in parallel for faster feedback
- Coverage aggregated across all services
- Each service can have unique configuration

### Base Configuration (`jest.config.base.js`)

Extended by all services to provide consistent defaults:

**Key Settings**:
- `preset: 'ts-jest'` - TypeScript support
- `testEnvironment: 'node'` - Node.js environment
- Coverage thresholds: 70% lines, 70% functions, 65% branches, 70% statements
- Test timeout: 10 seconds
- Supports unit/integration/e2e test matching

**File Patterns**:
```
'**/__tests__/unit/**/*.test.ts'        # Unit tests
'**/__tests__/integration/**/*.test.ts' # Integration tests
'**/__tests__/e2e/**/*.test.ts'         # E2E tests
'**/*.test.ts'                          # Fallback pattern
```

### Service Configuration

Each service imports base config and customizes:

```javascript
const baseConfig = require('../jest.config.base.js');

module.exports = {
  ...baseConfig,
  displayName: 'aggregator-service',
  rootDir: '.',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
```

### Global Setup (`jest.setup.js`)

Runs before all tests:

- Sets `NODE_ENV=test`
- Sets `LOG_LEVEL=error` to suppress test output noise
- Mocks console methods (log, debug, info, warn)
- Sets default timeout to 10 seconds

## Docker Compose for Testing

### `docker-compose.test.yml`

Provides isolated test environment:

**Services**:
1. **test-db** (MySQL 8.0)
   - Database: `gigsdb_test`
   - User: `test_user`
   - Password: `test_password`
   - Port: 3306
   - Health check included

2. **test-redis** (Redis 7)
   - Port: 6379
   - Health check included

3. **test-localstack** (AWS Services Mock)
   - Services: SecretsManager, SQS, S3
   - Port: 4566
   - Region: eu-west-1

**Benefits**:
- Reproducible test environment
- No external API dependencies
- Parallel test execution possible
- Cleanup after tests

**Usage**:
```bash
# Start services
docker-compose -f docker-compose.test.yml up -d

# Run tests
npm run test:integration

# Cleanup
docker-compose -f docker-compose.test.yml down
```

## Package.json Scripts

### Root-level Testing Scripts

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit:all

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e

# Run tests in CI mode (coverage, no watch, max 2 workers)
npm run test:ci

# Type check without building
npm run type-check

# Build TypeScript
npm run build

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format
```

## GitHub Actions CI/CD Integration

### Updated `.github/workflows/deploy.yml`

**Testing Phase** (`lint-and-test` job):

```yaml
- Install dependencies
- Run linter
- Run type check
- Run unit tests with coverage
- Run integration tests (with Docker Compose)
- Upload coverage to Codecov
- Check coverage thresholds (minimum 70%)
- Run smoke tests
```

**Quality Gates**:
- Linting must pass (or be skipped with `|| true`)
- Unit tests must pass with ≥70% coverage
- Integration tests must pass
- Type checking must pass
- Coverage check verifies 70%+ lines covered

**Deployment Phase**:
- Only runs if lint-and-test passes
- Only deploys from `main` branch
- Publishes metrics to CloudWatch

## Coverage Thresholds

All services must meet minimum coverage standards:

```
Global Thresholds:
- Branches: 65%
- Functions: 70%
- Lines: 70%
- Statements: 70%
```

**Target**: 75% overall (enterprise standard)

**Enforcement**:
- GitHub Actions checks coverage in CI
- Fail build if below 70%
- Report coverage to Codecov
- Generate HTML coverage report

**View Coverage**:
```bash
npm run test:coverage
open coverage/index.html
```

## Test Templates Reference

### Unit Test Template Pattern

```typescript
describe('Feature Name', () => {
  // Setup/teardown
  beforeEach(() => { /* setup */ });
  afterEach(() => { /* cleanup */ });

  describe('Specific functionality', () => {
    it('should do X when Y', () => {
      // Arrange - setup test data
      // Act - call function
      // Assert - verify results
    });
  });
});
```

**Best Practices**:
- One assertion per test (when possible)
- Clear arrange/act/assert sections
- Descriptive test names
- Test both happy path and error cases
- Mock external dependencies

### Integration Test Template Pattern

```typescript
describe('API Integration', () => {
  beforeAll(async () => {
    // Connect to test database
    // Start services
    // Seed test data
  });

  afterAll(async () => {
    // Disconnect database
    // Stop services
  });

  beforeEach(async () => {
    // Clear cache
    // Reset state
  });

  it('should handle complete workflow', async () => {
    // Make multiple HTTP requests
    // Verify database state
    // Check cache behavior
  });
});
```

**Best Practices**:
- Test complete workflows
- Use real database (in-memory or test container)
- Test caching behavior
- Test error scenarios
- Verify external API interactions (mocked)

### E2E Test Template Pattern

```typescript
describe('User Journey', () => {
  it('should search, filter, and save events', async () => {
    // 1. Search for events
    // 2. Apply filters
    // 3. View details
    // 4. Save favorite
    // 5. Verify in favorites list
  });
});
```

**Best Practices**:
- Simulate real user behavior
- Test across multiple endpoints
- Verify complete workflows
- Test error recovery
- Include performance checks

## Mocking Strategy

### Level 1: Unit Tests
- Mock all external dependencies
- Mock Express request/response
- Mock database queries
- Mock Redis cache
- Mock external APIs

### Level 2: Integration Tests
- Use real test database
- Use real test cache
- Mock external APIs
- Test actual endpoint implementations
- Test database transactions

### Level 3: E2E Tests
- Use real endpoints
- Use real database
- Use real cache
- Mock external APIs (if available)
- Test complete workflows

## Test Data Management

### Seeding
- Use database seed files (`init-gigsdb.sql`)
- Generate random test data factories
- Create fixtures for common test data

### Cleanup
- Clear cache before each test
- Truncate tables after integration tests
- Use transaction rollback when available

### Isolation
- Each test should be independent
- Clean state between tests
- Parallel-safe database operations

## Running Tests Locally

### Prerequisites
```bash
# Install Node.js 18+
node --version

# Install dependencies
npm install

# Install Docker (for integration tests)
docker --version
docker-compose --version
```

### Unit Tests Only
```bash
# All unit tests
npm run test:unit:all

# Specific service
cd aggregator-service
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Integration Tests
```bash
# Start test containers
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready
sleep 30

# Run integration tests
npm run test:integration

# Cleanup
docker-compose -f docker-compose.test.yml down
```

### E2E Tests
```bash
# Start all services
docker-compose up -d

# Run E2E tests
npm run test:e2e

# Cleanup
docker-compose down
```

### Full Test Suite
```bash
npm run test:ci
```

## Debugging Tests

### Enable Debug Output
```bash
# Show console output during tests
DEBUG=true npm test

# Run single test file
npm test -- logger.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should validate"

# Run tests for single file
npm test -- --testPathPattern="events-service"
```

### Debugging in VS Code
Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-coverage"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Best Practices

### Naming
- Test files: `{feature}.test.ts`
- Test suites: `describe('Feature Name')`
- Test cases: `it('should do X when Y')`

### Organization
- Group related tests in describe blocks
- Keep test file structure parallel to source
- One describe per module/class

### Assertions
- Use specific matchers (not just `toBeTruthy`)
- Test both success and error cases
- Include edge cases

### Performance
- Keep unit tests < 100ms
- Keep integration tests < 1s
- Skip slow tests with `.skip` when developing
- Run full suite before committing

### Maintenance
- Update tests when requirements change
- Keep mocks in sync with real implementations
- Remove obsolete tests
- Use snapshots cautiously (review diffs)

## Coverage Analysis

### View Coverage Report
```bash
npm run test:coverage
open coverage/index.html
```

### Improve Coverage
1. Identify untested code in report
2. Write tests for critical paths first
3. Add error case tests
4. Test edge cases and boundaries

### Coverage by Service

Target 70%+ for each service:
- aggregator-service: API gateway tests
- auth-service: Authentication tests
- events-service: Event query/management tests
- dj-service: DJ directory tests
- venue-service: Venue directory tests
- ml-service: ML model tests
- shared-lib: Utility tests

## Next Steps (After Phase 1.1 Preparation)

1. **Phase 1.2**: Create actual test implementations
2. **Phase 1.3**: Set up CI/CD with quality gates
3. **Phase 2**: Add observability (logging, tracing)
4. **Phase 3**: Security hardening
5. **Phase 4+**: Infrastructure and advanced features

## Resources

### Jest Documentation
- https://jestjs.io/docs/getting-started
- https://jestjs.io/docs/configuration
- https://jestjs.io/docs/api

### TypeScript + Jest
- https://github.com/kulshekhar/ts-jest
- https://jestjs.io/docs/typescript

### Testing Best Practices
- https://testing-library.com/docs/
- https://jestjs.io/docs/snapshot-testing
- https://martinfowler.com/bliki/TestPyramid.html

### Docker Compose for Testing
- https://docs.docker.com/compose/
- https://testcontainers.com/

## Support

For issues or questions about testing infrastructure:
1. Check test templates for examples
2. Review Jest documentation
3. Check GitHub Actions logs
4. Consult team documentation

---

**Created**: Phase 1.1 Preparation
**Status**: Infrastructure Ready (Awaiting Implementation)
**Target Coverage**: 75% (Minimum: 70%)
**Next Phase**: Phase 1.2 - Test Implementation
