module.exports = {
  testMatch: [
    '**/test_cases/**/*.spec.js',
    '**/test_cases/**/*.test.js',
    '**/test_cases/**/*_spec.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/local_deploy/',
    '/debug-test-workspace/',
    '/.worktrees/',
    '/test_scripts/'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/local_deploy/',
    '<rootDir>/debug-test-workspace/',
    '<rootDir>/.worktrees/'
  ],
  testEnvironment: 'node',
  verbose: true,
  collectCoverage: false,
  testTimeout: 10000,
  passWithNoTests: true  // Pass when no tests match the pattern
};
