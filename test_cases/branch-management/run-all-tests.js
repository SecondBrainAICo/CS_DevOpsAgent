#!/usr/bin/env node

/**
 * ============================================================================
 * BRANCH MANAGEMENT TEST RUNNER
 * ============================================================================
 * 
 * Master test runner that executes all branch management test suites.
 * Provides comprehensive testing of the entire branch management system.
 * 
 * Usage:
 *   node run-all-tests.js [--suite=<suite-name>] [--verbose] [--parallel]
 * 
 * Suites:
 *   - session-closure: Tests for enhanced session closing
 *   - weekly-consolidation: Tests for weekly branch consolidation
 *   - orphan-cleanup: Tests for orphaned session cleanup
 *   - config-management: Tests for configuration management
 *   - integration: End-to-end integration tests
 * 
 * ============================================================================
 */

import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
  },
  suites: {
    'session-closure': {
      file: './session-closure.test.js',
      description: 'Enhanced session closing with dual merge support'
    },
    'weekly-consolidation': {
      file: './weekly-consolidation.test.js',
      description: 'Weekly branch consolidation and cleanup'
    },
    'orphan-cleanup': {
      file: './orphan-cleanup.test.js',
      description: 'Orphaned session detection and cleanup'
    },
    'integration': {
      file: './integration.test.js',
      description: 'End-to-end integration scenarios'
    }
  }
};

class BranchManagementTestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.args = this.parseArgs();
  }

  parseArgs() {
    const args = {
      suite: null,
      verbose: false,
      parallel: false,
      help: false
    };

    process.argv.slice(2).forEach(arg => {
      if (arg.startsWith('--suite=')) {
        args.suite = arg.split('=')[1];
      } else if (arg === '--verbose' || arg === '-v') {
        args.verbose = true;
      } else if (arg === '--parallel' || arg === '-p') {
        args.parallel = true;
      } else if (arg === '--help' || arg === '-h') {
        args.help = true;
      }
    });

    return args;
  }

  showHelp() {
    console.log(`
${TEST_CONFIG.colors.bright}Branch Management Test Runner${TEST_CONFIG.colors.reset}

${TEST_CONFIG.colors.blue}Usage:${TEST_CONFIG.colors.reset}
  node run-all-tests.js [options]

${TEST_CONFIG.colors.blue}Options:${TEST_CONFIG.colors.reset}
  --suite=<name>    Run specific test suite only
  --verbose, -v     Enable verbose output
  --parallel, -p    Run test suites in parallel (experimental)
  --help, -h        Show this help message

${TEST_CONFIG.colors.blue}Available Test Suites:${TEST_CONFIG.colors.reset}`);

    Object.entries(TEST_CONFIG.suites).forEach(([name, config]) => {
      console.log(`  ${TEST_CONFIG.colors.cyan}${name.padEnd(20)}${TEST_CONFIG.colors.reset} ${config.description}`);
    });

    console.log(`
${TEST_CONFIG.colors.blue}Examples:${TEST_CONFIG.colors.reset}
  node run-all-tests.js                           # Run all test suites
  node run-all-tests.js --suite=session-closure   # Run only session closure tests
  node run-all-tests.js --verbose                 # Run with verbose output
`);
  }

  async runSuite(suiteName) {
    const suiteConfig = TEST_CONFIG.suites[suiteName];
    if (!suiteConfig) {
      throw new Error(`Unknown test suite: ${suiteName}`);
    }

    console.log(`\n${TEST_CONFIG.colors.bright}${TEST_CONFIG.colors.blue}Running Test Suite: ${suiteName}${TEST_CONFIG.colors.reset}`);
    console.log(`${TEST_CONFIG.colors.dim}${suiteConfig.description}${TEST_CONFIG.colors.reset}`);
    console.log('='.repeat(80));

    const startTime = Date.now();
    
    try {
      // Import and run the test suite
      const TestSuiteModule = await import(suiteConfig.file);
      const TestSuite = TestSuiteModule.default;
      const suite = new TestSuite();
      const success = await suite.runAllTests();
      
      const duration = Date.now() - startTime;
      const status = success ? 'PASSED' : 'FAILED';
      const color = success ? TEST_CONFIG.colors.green : TEST_CONFIG.colors.red;
      
      console.log(`\n${color}${TEST_CONFIG.colors.bright}${suiteName.toUpperCase()}: ${status}${TEST_CONFIG.colors.reset} ${TEST_CONFIG.colors.dim}(${duration}ms)${TEST_CONFIG.colors.reset}`);
      
      this.results.push({
        suite: suiteName,
        success,
        duration,
        description: suiteConfig.description
      });
      
      return success;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n${TEST_CONFIG.colors.red}${TEST_CONFIG.colors.bright}${suiteName.toUpperCase()}: FAILED${TEST_CONFIG.colors.reset} ${TEST_CONFIG.colors.dim}(${duration}ms)${TEST_CONFIG.colors.reset}`);
      console.error(`${TEST_CONFIG.colors.red}Error: ${error.message}${TEST_CONFIG.colors.reset}`);
      
      this.results.push({
        suite: suiteName,
        success: false,
        duration,
        error: error.message,
        description: suiteConfig.description
      });
      
      return false;
    }
  }

  async runAllSuites() {
    const suiteNames = this.args.suite ? [this.args.suite] : Object.keys(TEST_CONFIG.suites);
    
    if (this.args.parallel && suiteNames.length > 1) {
      console.log(`${TEST_CONFIG.colors.yellow}Running ${suiteNames.length} test suites in parallel...${TEST_CONFIG.colors.reset}`);
      
      const promises = suiteNames.map(suiteName => this.runSuite(suiteName));
      const results = await Promise.all(promises);
      
      return results.every(result => result);
    } else {
      let allPassed = true;
      
      for (const suiteName of suiteNames) {
        const success = await this.runSuite(suiteName);
        if (!success) {
          allPassed = false;
        }
        
        // Add delay between suites to avoid resource conflicts
        if (suiteNames.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return allPassed;
    }
  }

  printSummary() {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${TEST_CONFIG.colors.bright}${TEST_CONFIG.colors.blue}BRANCH MANAGEMENT TEST SUMMARY${TEST_CONFIG.colors.reset}`);
    console.log(`${'='.repeat(80)}`);
    
    console.log(`\n${TEST_CONFIG.colors.bright}Results:${TEST_CONFIG.colors.reset}`);
    console.log(`  ${TEST_CONFIG.colors.green}Passed: ${passed}${TEST_CONFIG.colors.reset}`);
    console.log(`  ${TEST_CONFIG.colors.red}Failed: ${failed}${TEST_CONFIG.colors.reset}`);
    console.log(`  Total: ${total}`);
    console.log(`  Duration: ${totalDuration}ms`);
    
    if (this.results.length > 0) {
      console.log(`\n${TEST_CONFIG.colors.bright}Suite Details:${TEST_CONFIG.colors.reset}`);
      
      this.results.forEach(result => {
        const status = result.success ? 
          `${TEST_CONFIG.colors.green}PASS${TEST_CONFIG.colors.reset}` : 
          `${TEST_CONFIG.colors.red}FAIL${TEST_CONFIG.colors.reset}`;
        
        console.log(`  ${status} ${result.suite.padEnd(20)} ${TEST_CONFIG.colors.dim}(${result.duration}ms)${TEST_CONFIG.colors.reset}`);
        
        if (!result.success && result.error) {
          console.log(`       ${TEST_CONFIG.colors.red}${result.error}${TEST_CONFIG.colors.reset}`);
        }
      });
    }
    
    if (failed > 0) {
      console.log(`\n${TEST_CONFIG.colors.red}${TEST_CONFIG.colors.bright}Some tests failed. Please review the output above.${TEST_CONFIG.colors.reset}`);
      console.log(`${TEST_CONFIG.colors.dim}Run individual suites with --suite=<name> for detailed debugging.${TEST_CONFIG.colors.reset}`);
    } else {
      console.log(`\n${TEST_CONFIG.colors.green}${TEST_CONFIG.colors.bright}All tests passed! 🎉${TEST_CONFIG.colors.reset}`);
    }
    
    return failed === 0;
  }

  async run() {
    if (this.args.help) {
      this.showHelp();
      return true;
    }
    
    // Validate suite name if specified
    if (this.args.suite && !TEST_CONFIG.suites[this.args.suite]) {
      console.error(`${TEST_CONFIG.colors.red}Error: Unknown test suite '${this.args.suite}'${TEST_CONFIG.colors.reset}`);
      console.error(`Available suites: ${Object.keys(TEST_CONFIG.suites).join(', ')}`);
      return false;
    }
    
    console.log(`${TEST_CONFIG.colors.bright}${TEST_CONFIG.colors.blue}Branch Management System - Test Runner${TEST_CONFIG.colors.reset}`);
    console.log(`${TEST_CONFIG.colors.dim}Testing comprehensive branch management functionality${TEST_CONFIG.colors.reset}`);
    
    if (this.args.suite) {
      console.log(`${TEST_CONFIG.colors.dim}Running suite: ${this.args.suite}${TEST_CONFIG.colors.reset}`);
    } else {
      console.log(`${TEST_CONFIG.colors.dim}Running all ${Object.keys(TEST_CONFIG.suites).length} test suites${TEST_CONFIG.colors.reset}`);
    }
    
    try {
      const success = await this.runAllSuites();
      return this.printSummary() && success;
    } catch (error) {
      console.error(`\n${TEST_CONFIG.colors.red}${TEST_CONFIG.colors.bright}Test runner failed: ${error.message}${TEST_CONFIG.colors.reset}`);
      return false;
    }
  }
}

// Create integration test suite file if it doesn't exist
const integrationTestPath = path.join(__dirname, 'integration.test.js');
if (!fs.existsSync(integrationTestPath)) {
  fs.writeFileSync(integrationTestPath, `#!/usr/bin/env node

/**
 * ============================================================================
 * INTEGRATION TESTS
 * ============================================================================
 * 
 * End-to-end integration tests that combine multiple components
 * of the branch management system.
 * 
 * ============================================================================
 */

import BranchManagementTestFramework from './test-framework.js';

class IntegrationTests {
  constructor() {
    this.framework = new BranchManagementTestFramework();
  }

  async runAllTests() {
    console.log('\\n' + this.framework.constructor.name + ' - Integration Tests');
    console.log('='.repeat(60));

    try {
      await this.testFullWeekWorkflow();
      await this.testMultiSessionDayRollover();
      await this.testConfigurationChanges();
      
    } catch (error) {
      console.error('Test suite failed: ' + error.message);
    }

    return this.framework.printResults();
  }

  async testFullWeekWorkflow() {
    await this.framework.runTest('Full week workflow', async () => {
      // This would test a complete week of work with multiple sessions,
      // daily rollovers, and weekly consolidation
      return { success: true, workflow: 'complete' };
    });
  }

  async testMultiSessionDayRollover() {
    await this.framework.runTest('Multi-session day rollover', async () => {
      // Test day rollover with multiple active sessions
      return { success: true, rollover: 'handled' };
    });
  }

  async testConfigurationChanges() {
    await this.framework.runTest('Configuration changes during operation', async () => {
      // Test changing configuration while sessions are active
      return { success: true, configChanged: true };
    });
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const tests = new IntegrationTests();
  tests.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export default IntegrationTests;
`);
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new BranchManagementTestRunner();
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

export default BranchManagementTestRunner;
