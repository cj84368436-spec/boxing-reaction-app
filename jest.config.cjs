const path = require('path');

const config = require('@granite-js/react-native/jest').config({
  rootDir: __dirname,
  moduleNameMapper: {
    '@babel/runtime(.*)': `${path.dirname(require.resolve('@babel/runtime/package.json'))}$1`,
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
});

module.exports = {
  ...config,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/app/__tests__/**/*.test.ts?(x)'],
};
