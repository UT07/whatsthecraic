const baseConfig = require('../jest.config.base.js');

module.exports = {
  ...baseConfig,
  displayName: 'events-service',
  rootDir: '.',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
