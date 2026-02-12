// Jest global setup
// Suppress console logs during tests unless explicitly debugging
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

// Set default test timeout
jest.setTimeout(10000);

// Setup environment variables for tests
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
