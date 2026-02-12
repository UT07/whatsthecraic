const baseConfig = require('../jest.config.base.js');

module.exports = {
  ...baseConfig,
  displayName: 'dj-service',
  rootDir: '.',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
