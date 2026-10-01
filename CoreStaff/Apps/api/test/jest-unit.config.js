/**
 * Unit test configuration — runs tests from test/ folder (outside src/).
 * 
 * Separate from package.json's jest block because that one has rootDir: 'src'
 * and would miss all *.spec.ts files sitting in test/.
 */
module.exports = {
  rootDir: '..',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.unit\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  maxWorkers: 1,
};
