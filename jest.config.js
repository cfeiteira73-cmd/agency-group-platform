/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/tests/chaos/**/*.spec.ts',
    '**/tests/load/**/*.spec.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/api/**/*.ts',
    'app/imoveis/data.ts',
    '!**/*.d.ts',
  ],
}

module.exports = config
