const baseConfig = require('../../jest.config.base.js');

module.exports = {
  ...baseConfig,
  displayName: 'shared-lib',
  rootDir: '.',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
