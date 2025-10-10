#!/usr/bin/env node

/**
 * ============================================================================
 * BRANCH MANAGEMENT TESTING FRAMEWORK
 * ============================================================================
 * 
 * This framework provides automated testing for the branch management system
 * by creating isolated test repositories and simulating multi-session scenarios.
 * 
 * Key Features:
 * - Isolated test repositories for each test case
 * - Multi-session simulation with concurrent operations
 * - Git state validation and cleanup
 * - Comprehensive scenario testing
 * 
 * Usage:
 *   node test-framework.js [test-suite]
 * 
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import crypto from 'crypto';
import os from 'os';
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
  testTimeout: 30000, // 30 seconds per test
  tempDirPrefix: 'devops-agent-test-',
  gitConfig: {
    'user.name': 'DevOps Agent Test',
    'user.email': 'test@devops-agent.local'
  }
};

class BranchManagementTestFramework {
  constructor() {
    this.testResults = [];
    this.currentTest = null;
    this.testRepoPath = null;
    this.originalCwd = process.cwd();
    this.sourceDir = path.join(this.originalCwd, 'src');
  }

  /**
   * Create an isolated test repository
   */
  async createTestRepo() {
    const testId = crypto.randomBytes(8).toString('hex');
    this.testRepoPath = path.join(os.tmpdir(), `${TEST_CONFIG.tempDirPrefix}${testId}`);
    
    console.log(`${TEST_CONFIG.colors.dim}Creating test repo: ${this.testRepoPath}${TEST_CONFIG.colors.reset}`);
    
    // Create directory structure
    fs.mkdirSync(this.testRepoPath, { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, 'src'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, 'local_deploy'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, 'local_deploy', 'session-locks'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, 'local_deploy', 'worktrees'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, '.file-coordination'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, '.file-coordination', 'active-edits'), { recursive: true });
    
    // Change to test directory
    process.chdir(this.testRepoPath);
    
    // Initialize git repository
    execSync('git init', { stdio: 'ignore' });
    
    // Configure git
    for (const [key, value] of Object.entries(TEST_CONFIG.gitConfig)) {
      execSync(`git config ${key} "${value}"`, { stdio: 'ignore' });
    }
    
    // Copy source files to test repo
    this.copySourceFiles();
    
    // Create initial commit
    fs.writeFileSync('README.md', '# Test Repository\nThis is a test repository for branch management testing.');
    execSync('git add .', { stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { stdio: 'ignore' });
    
    // Create main branch (some tests expect it)
    try {
      execSync('git branch -M main', { stdio: 'ignore' });
    } catch (e) {
      // Ignore if already on main
    }
    
    return this.testRepoPath;
  }

  /**
   * Copy source files to test repository
   */
  copySourceFiles() {
    const sourceFiles = [
      'enhanced-close-session.js',
      'weekly-consolidator.js',
      'orphan-cleaner.js',
      'branch-config-manager.js'
    ];
    
    for (const file of sourceFiles) {
      const sourcePath = path.join(this.sourceDir, file);
      const destPath = path.join(this.testRepoPath, 'src', file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  }

  /**
   * Clean up test repository
   */
  async cleanupTestRepo() {
    if (this.testRepoPath && fs.existsSync(this.testRepoPath)) {
      process.chdir(this.originalCwd);
      
      try {
        // Force remove the test directory
        if (process.platform === 'win32') {
          execSync(`rmdir /s /q "${this.testRepoPath}"`, { stdio: 'ignore' });
        } else {
          execSync(`rm -rf "${this.testRepoPath}"`, { stdio: 'ignore' });
        }
      } catch (error) {
        console.warn(`${TEST_CONFIG.colors.yellow}Warning: Could not clean up test repo: ${error.message}${TEST_CONFIG.colors.reset}`);
      }
    }
  }

  /**
   * Create a mock session with specified properties
   */
  createMockSession(sessionId, task, agentType = 'test-agent', branchName = null) {
    if (!branchName) {
      branchName = `session/${agentType}/${task}`;
    }
    
    const sessionData = {
      sessionId,
      task,
      agentType,
      branchName,
      status: 'active',
      created: new Date().toISOString(),
      worktreePath: path.join(this.testRepoPath, 'local_deploy', 'worktrees', sessionId)
    };
    
    // Create session lock file
    const lockFile = path.join(this.testRepoPath, 'local_deploy', 'session-locks', `${sessionId}.lock`);
    fs.writeFileSync(lockFile, JSON.stringify(sessionData, null, 2));
    
    // Create session branch with some commits
    execSync(`git checkout -b ${branchName}`, { stdio: 'ignore' });
    
    // Add some test content
    const testFile = `test-${sessionId}.txt`;
    fs.writeFileSync(testFile, `Test content for session ${sessionId}\nTask: ${task}\n`);
    execSync(`git add ${testFile}`, { stdio: 'ignore' });
    execSync(`git commit -m "Add test content for session ${sessionId}"`, { stdio: 'ignore' });
    
    // Add another commit to simulate work
    fs.appendFileSync(testFile, `Additional work in session ${sessionId}\n`);
    execSync(`git add ${testFile}`, { stdio: 'ignore' });
    execSync(`git commit -m "Additional work in session ${sessionId}"`, { stdio: 'ignore' });
    
    // Return to main branch
    execSync('git checkout main', { stdio: 'ignore' });
    
    return sessionData;
  }

  /**
   * Create project settings for testing
   */
  createProjectSettings(settings = {}) {
    const defaultSettings = {
      version: "1.4.0",
      branchManagement: {
        defaultMergeTarget: "main",
        enableDualMerge: false,
        enableWeeklyConsolidation: true,
        orphanSessionThresholdDays: 7,
        mergeStrategy: "hierarchical-first",
        conflictResolution: "prompt"
      },
      rolloverSettings: {
        enableAutoRollover: true,
        rolloverTime: "00:00",
        timezone: "UTC",
        preserveRunningAgent: true
      },
      cleanup: {
        autoCleanupOrphans: false,
        weeklyCleanupDay: "sunday",
        retainWeeklyBranches: 12
      }
    };
    
    // Merge with provided settings
    const mergedSettings = { ...defaultSettings };
    if (settings.branchManagement) {
      mergedSettings.branchManagement = { ...defaultSettings.branchManagement, ...settings.branchManagement };
    }
    
    const settingsPath = path.join(this.testRepoPath, 'local_deploy', 'project-settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
    
    return mergedSettings;
  }

  /**
   * Create daily branches for testing weekly consolidation
   */
  createDailyBranches(dates) {
    const branches = [];
    
    for (const date of dates) {
      const branchName = `daily/${date}`;
      branches.push(branchName);
      
      // Create branch
      execSync(`git checkout -b ${branchName}`, { stdio: 'ignore' });
      
      // Add content
      const testFile = `daily-work-${date}.txt`;
      fs.writeFileSync(testFile, `Daily work for ${date}\n`);
      execSync(`git add ${testFile}`, { stdio: 'ignore' });
      execSync(`git commit -m "Daily work for ${date}"`, { stdio: 'ignore' });
      
      // Return to main
      execSync('git checkout main', { stdio: 'ignore' });
    }
    
    return branches;
  }

  /**
   * Simulate old session (for orphan testing)
   */
  createOldSession(sessionId, daysOld) {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - daysOld);
    
    const sessionData = this.createMockSession(sessionId, 'old-task', 'old-agent');
    
    // Update the session creation date
    sessionData.created = oldDate.toISOString();
    const lockFile = path.join(this.testRepoPath, 'local_deploy', 'session-locks', `${sessionId}.lock`);
    fs.writeFileSync(lockFile, JSON.stringify(sessionData, null, 2));
    
    // Modify the last commit date on the branch (simulate old work)
    execSync(`git checkout ${sessionData.branchName}`, { stdio: 'ignore' });
    
    // Create a commit with old date
    const oldCommitDate = oldDate.toISOString();
    execSync(`git commit --amend --date="${oldCommitDate}" --no-edit`, { stdio: 'ignore' });
    
    execSync('git checkout main', { stdio: 'ignore' });
    
    return sessionData;
  }

  /**
   * Run a test with timeout and error handling
   */
  async runTest(testName, testFunction) {
    console.log(`\n${TEST_CONFIG.colors.blue}Running: ${testName}${TEST_CONFIG.colors.reset}`);
    this.currentTest = testName;
    
    const startTime = Date.now();
    
    try {
      // Create fresh test repo for each test
      await this.createTestRepo();
      
      // Run the test with timeout
      const result = await Promise.race([
        testFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), TEST_CONFIG.testTimeout)
        )
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`${TEST_CONFIG.colors.green}✓ ${testName} (${duration}ms)${TEST_CONFIG.colors.reset}`);
      
      this.testResults.push({
        name: testName,
        status: 'passed',
        duration,
        result
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`${TEST_CONFIG.colors.red}✗ ${testName} (${duration}ms)${TEST_CONFIG.colors.reset}`);
      console.log(`${TEST_CONFIG.colors.red}  Error: ${error.message}${TEST_CONFIG.colors.reset}`);
      
      this.testResults.push({
        name: testName,
        status: 'failed',
        duration,
        error: error.message
      });
      
      throw error;
    } finally {
      await this.cleanupTestRepo();
    }
  }

  /**
   * Assert that a branch exists
   */
  assertBranchExists(branchName) {
    try {
      execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { stdio: 'ignore' });
      return true;
    } catch {
      throw new Error(`Branch ${branchName} does not exist`);
    }
  }

  /**
   * Assert that a branch does not exist
   */
  assertBranchNotExists(branchName) {
    try {
      execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { stdio: 'ignore' });
      throw new Error(`Branch ${branchName} should not exist`);
    } catch (error) {
      if (error.message.includes('should not exist')) {
        throw error;
      }
      return true; // Branch doesn't exist, which is what we want
    }
  }

  /**
   * Assert that a file exists
   */
  assertFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} does not exist`);
    }
    return true;
  }

  /**
   * Assert that a file does not exist
   */
  assertFileNotExists(filePath) {
    if (fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} should not exist`);
    }
    return true;
  }

  /**
   * Get list of all branches
   */
  getAllBranches() {
    try {
      const output = execSync('git branch --format="%(refname:short)"', { encoding: 'utf8' });
      return output.split('\n').filter(branch => branch.trim()).map(branch => branch.trim());
    } catch {
      return [];
    }
  }

  /**
   * Execute a script and capture output
   */
  async executeScript(scriptPath, args = [], input = null) {
    return new Promise((resolve, reject) => {
      const fullPath = path.join(this.testRepoPath, 'src', scriptPath);
      const child = spawn('node', [fullPath, ...args], {
        cwd: this.testRepoPath,
        stdio: input ? 'pipe' : 'inherit'
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      if (input && child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Script exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Print test results summary
   */
  printResults() {
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;
    
    console.log(`\n${TEST_CONFIG.colors.bright}Test Results Summary:${TEST_CONFIG.colors.reset}`);
    console.log(`${TEST_CONFIG.colors.green}Passed: ${passed}${TEST_CONFIG.colors.reset}`);
    console.log(`${TEST_CONFIG.colors.red}Failed: ${failed}${TEST_CONFIG.colors.reset}`);
    console.log(`Total: ${total}`);
    
    if (failed > 0) {
      console.log(`\n${TEST_CONFIG.colors.red}Failed Tests:${TEST_CONFIG.colors.reset}`);
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`  ✗ ${r.name}: ${r.error}`);
        });
    }
    
    return failed === 0;
  }
}

export default BranchManagementTestFramework;
