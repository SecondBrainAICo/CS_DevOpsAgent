#!/usr/bin/env node

/**
 * Comprehensive test for branch management system
 * Tests the actual scripts we created
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

class ComprehensiveBranchManagementTest {
  constructor() {
    this.testResults = [];
    this.testRepoPath = null;
    this.originalCwd = process.cwd();
  }

  async createTestRepo() {
    const testId = crypto.randomBytes(8).toString('hex');
    this.testRepoPath = path.join(os.tmpdir(), `devops-comprehensive-test-${testId}`);
    
    console.log(`${colors.dim}Creating test repo: ${this.testRepoPath}${colors.reset}`);
    
    // Create directory structure
    fs.mkdirSync(this.testRepoPath, { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, 'src'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, 'local_deploy'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, 'local_deploy', 'session-locks'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, '.file-coordination'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, '.file-coordination', 'active-edits'), { recursive: true });
    
    // Change to test directory
    process.chdir(this.testRepoPath);
    
    // Initialize git repository
    execSync('git init', { stdio: 'ignore' });
    execSync('git config user.name "Test User"', { stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
    
    // Copy source files
    const sourceDir = path.join(this.originalCwd, 'src');
    const sourceFiles = [
      'enhanced-close-session.js',
      'weekly-consolidator.js',
      'orphan-cleaner.js',
      'branch-config-manager.js'
    ];
    
    for (const file of sourceFiles) {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(this.testRepoPath, 'src', file);
      
      if (fs.existsSync(sourcePath)) {
        let content = fs.readFileSync(sourcePath, 'utf8');
        // Convert to ES module syntax for testing
        content = content.replace(/const (\w+) = require\('([^']+)'\);/g, "import $1 from '$2';");
        content = content.replace(/module\.exports = (\w+);/, "export default $1;");
        fs.writeFileSync(destPath, content);
      }
    }
    
    // Create initial commit
    fs.writeFileSync('README.md', '# Test Repository');
    execSync('git add .', { stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { stdio: 'ignore' });
    
    // Create main branch
    try {
      execSync('git branch -M main', { stdio: 'ignore' });
    } catch (e) {
      // Ignore if already on main
    }
    
    return this.testRepoPath;
  }

  async cleanupTestRepo() {
    if (this.testRepoPath && fs.existsSync(this.testRepoPath)) {
      process.chdir(this.originalCwd);
      
      try {
        execSync(`rm -rf "${this.testRepoPath}"`, { stdio: 'ignore' });
      } catch (error) {
        console.warn(`${colors.yellow}Warning: Could not clean up test repo: ${error.message}${colors.reset}`);
      }
    }
  }

  async runTest(testName, testFunction) {
    console.log(`\n${colors.blue}Running: ${testName}${colors.reset}`);
    
    const startTime = Date.now();
    
    try {
      await this.createTestRepo();
      const result = await testFunction();
      
      const duration = Date.now() - startTime;
      console.log(`${colors.green}✓ ${testName} (${duration}ms)${colors.reset}`);
      
      this.testResults.push({
        name: testName,
        status: 'passed',
        duration,
        result
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`${colors.red}✗ ${testName} (${duration}ms)${colors.reset}`);
      console.log(`${colors.red}  Error: ${error.message}${colors.reset}`);
      
      this.testResults.push({
        name: testName,
        status: 'failed',
        duration,
        error: error.message
      });
      
      return false;
    } finally {
      await this.cleanupTestRepo();
    }
  }

  assertBranchExists(branchName) {
    try {
      execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { stdio: 'ignore' });
      return true;
    } catch {
      throw new Error(`Branch ${branchName} does not exist`);
    }
  }

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

  assertFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} does not exist`);
    }
    return true;
  }

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
    
    const mergedSettings = { ...defaultSettings };
    if (settings.branchManagement) {
      mergedSettings.branchManagement = { ...defaultSettings.branchManagement, ...settings.branchManagement };
    }
    
    const settingsPath = path.join(this.testRepoPath, 'local_deploy', 'project-settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
    
    return mergedSettings;
  }

  createMockSession(sessionId, task, agentType = 'test-agent') {
    const branchName = `session/${agentType}/${task}`;
    
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
    execSync(`git checkout -b "${branchName}"`, { stdio: 'ignore' });
    
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

  async executeScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.testRepoPath, 'src', scriptName);
      const child = spawn('node', [scriptPath, ...args], {
        cwd: this.testRepoPath,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async testConfigurationManager() {
    await this.runTest('Configuration Manager', async () => {
      this.createProjectSettings();
      
      // Test show command
      const result = await this.executeScript('branch-config-manager.js', ['show']);
      
      if (result.code !== 0) {
        throw new Error(`Config manager failed: ${result.stderr}`);
      }
      
      // Verify settings file exists
      this.assertFileExists('local_deploy/project-settings.json');
      
      return { success: true, output: result.stdout };
    });
  }

  async testWeeklyConsolidator() {
    await this.runTest('Weekly Consolidator', async () => {
      this.createProjectSettings();
      
      // Create some daily branches
      const dates = ['2025-10-01', '2025-10-02', '2025-10-03'];
      for (const date of dates) {
        const branchName = `daily/${date}`;
        execSync(`git checkout -b "${branchName}"`, { stdio: 'ignore' });
        fs.writeFileSync(`work-${date}.txt`, `Daily work for ${date}`);
        execSync(`git add work-${date}.txt`, { stdio: 'ignore' });
        execSync(`git commit -m "Daily work for ${date}"`, { stdio: 'ignore' });
        execSync('git checkout main', { stdio: 'ignore' });
      }
      
      // Test the consolidator (it should detect no branches to consolidate since they're not from last week)
      const result = await this.executeScript('weekly-consolidator.js', ['consolidate']);
      
      // The script should run without error
      if (result.code !== 0) {
        console.log('STDOUT:', result.stdout);
        console.log('STDERR:', result.stderr);
        throw new Error(`Weekly consolidator failed: ${result.stderr}`);
      }
      
      return { success: true, output: result.stdout };
    });
  }

  async testOrphanCleaner() {
    await this.runTest('Orphan Cleaner', async () => {
      this.createProjectSettings({
        branchManagement: {
          orphanSessionThresholdDays: 1 // Very short threshold for testing
        }
      });
      
      // Create a mock session
      const session = this.createMockSession('test-session', 'test-task');
      
      // Test list command (should find no orphans since session is new)
      const result = await this.executeScript('orphan-cleaner.js', ['list']);
      
      if (result.code !== 0) {
        console.log('STDOUT:', result.stdout);
        console.log('STDERR:', result.stderr);
        throw new Error(`Orphan cleaner failed: ${result.stderr}`);
      }
      
      return { success: true, output: result.stdout };
    });
  }

  async testBranchNaming() {
    await this.runTest('Branch Naming Conventions', async () => {
      // Test that our branch naming conventions work
      const branches = [
        'daily/2025-10-10',
        'session/agent1/feature-work',
        'session/agent2/bug-fix',
        'weekly/2025-10-01_to_2025-10-07'
      ];
      
      for (const branch of branches) {
        execSync(`git checkout -b "${branch}"`, { stdio: 'ignore' });
        fs.writeFileSync(`${branch.replace(/[\/]/g, '-')}.txt`, `Content for ${branch}`);
        execSync(`git add .`, { stdio: 'ignore' });
        execSync(`git commit -m "Work in ${branch}"`, { stdio: 'ignore' });
        execSync('git checkout main', { stdio: 'ignore' });
        
        this.assertBranchExists(branch);
      }
      
      return { success: true, branchesCreated: branches.length };
    });
  }

  async testDualMergeConfiguration() {
    await this.runTest('Dual Merge Configuration', async () => {
      // Test dual merge settings
      this.createProjectSettings({
        branchManagement: {
          enableDualMerge: true,
          defaultMergeTarget: 'main',
          mergeStrategy: 'hierarchical-first'
        }
      });
      
      // Verify settings were saved correctly
      const settingsContent = fs.readFileSync('local_deploy/project-settings.json', 'utf8');
      const settings = JSON.parse(settingsContent);
      
      if (!settings.branchManagement.enableDualMerge) {
        throw new Error('Dual merge not enabled in settings');
      }
      
      if (settings.branchManagement.mergeStrategy !== 'hierarchical-first') {
        throw new Error('Merge strategy not set correctly');
      }
      
      return { success: true, settings };
    });
  }

  async testSessionLockFiles() {
    await this.runTest('Session Lock Files', async () => {
      // Test session lock file creation and management
      const session = this.createMockSession('lock-test', 'lock-task');
      
      // Verify lock file was created
      this.assertFileExists(`local_deploy/session-locks/${session.sessionId}.lock`);
      
      // Verify lock file content
      const lockContent = fs.readFileSync(`local_deploy/session-locks/${session.sessionId}.lock`, 'utf8');
      const lockData = JSON.parse(lockContent);
      
      if (lockData.sessionId !== session.sessionId) {
        throw new Error('Lock file contains incorrect session ID');
      }
      
      if (lockData.branchName !== session.branchName) {
        throw new Error('Lock file contains incorrect branch name');
      }
      
      return { success: true, lockData };
    });
  }

  printResults() {
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;
    
    console.log(`\n${colors.bright}Comprehensive Test Results:${colors.reset}`);
    console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    console.log(`Total: ${total}`);
    
    if (failed > 0) {
      console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`  ✗ ${r.name}: ${r.error}`);
        });
    } else {
      console.log(`\n${colors.green}${colors.bright}All tests passed! 🎉${colors.reset}`);
    }
    
    return failed === 0;
  }

  async runAllTests() {
    console.log(`${colors.bright}${colors.blue}Branch Management System - Comprehensive Tests${colors.reset}`);
    console.log('='.repeat(70));

    try {
      await this.testConfigurationManager();
      await this.testWeeklyConsolidator();
      await this.testOrphanCleaner();
      await this.testBranchNaming();
      await this.testDualMergeConfiguration();
      await this.testSessionLockFiles();
      
    } catch (error) {
      console.error(`Test suite failed: ${error.message}`);
    }

    return this.printResults();
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new ComprehensiveBranchManagementTest();
  tests.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
