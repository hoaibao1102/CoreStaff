/**
 * TASK-071 — the integration lane (`npm run test:integration`).
 *
 * Separate from the `jest` block in `package.json` on purpose: that one has
 * `rootDir: 'src'` and matches every `*.spec.ts`, so these files would otherwise
 * be picked up by `npm test` and try to boot a database in a unit run.
 *
 * `test/` sits outside `src`, so `nest build` never ships it (sourceRoot is `src`).
 */
module.exports = {
  rootDir: '..',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  // One mongod for the whole lane, shared by every file.
  globalSetup: '<rootDir>/test/global-setup.ts',
  // Without this the mongod started by globalSetup is never stopped and jest
  // prints "did not exit one second after the test run has completed", then sits
  // there until something external kills it.
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  maxWorkers: 1,
  // First run downloads a mongod binary; after that a suite is seconds.
  testTimeout: 120000,
};
