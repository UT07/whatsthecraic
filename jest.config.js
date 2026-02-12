module.exports = {
  projects: [
    '<rootDir>/aggregator-service/jest.config.js',
    '<rootDir>/auth-service/jest.config.js',
    '<rootDir>/events-service/jest.config.js',
    '<rootDir>/dj-service/jest.config.js',
    '<rootDir>/venue-service/jest.config.js',
    '<rootDir>/ml-service/jest.config.js',
    '<rootDir>/packages/shared-lib/jest.config.js',
  ],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/__tests__/**',
    '!**/*.test.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
