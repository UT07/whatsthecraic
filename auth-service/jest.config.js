const baseConfig = require('../jest.config.base.js');

module.exports = {
  ...baseConfig,
  displayName: 'auth-service',
  rootDir: '.',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
