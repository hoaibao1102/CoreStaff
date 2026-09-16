module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: {
    target: 'ES2022', module: 'CommonJS', jsx: 'react-jsx', esModuleInterop: true,
    strict: true, skipLibCheck: true
  } }] }
};
