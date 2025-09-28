module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/test_cases/**/*_spec.js',
    '**/test_cases/**/*_spec.ts',
    '**/test_cases/**/*.spec.js',
    '**/test_cases/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test-repo/'
  ],
  collectCoverageFrom: [
    '*.js',
    '!jest.config.js',
    '!test_cases/**/*.js',
    '!scripts/**/*.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};