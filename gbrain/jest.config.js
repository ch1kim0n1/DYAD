const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleDirectories: ['node_modules'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: path.resolve(__dirname, 'tsconfig.test.json') }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
