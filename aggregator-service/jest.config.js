const baseConfig = require('../jest.config.base.js');

module.exports = {
  ...baseConfig,
  displayName: 'aggregator-service',
  rootDir: '.',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
