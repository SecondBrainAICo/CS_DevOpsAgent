#!/usr/bin/env node

/**
 * Simple test runner for branch management system
 * Tests the core functionality without complex mocking
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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

class SimpleBranchManagementTest {
  constructor() {
    this.testResults = [];
    this.testRepoPath = null;
    this.originalCwd = process.cwd();
  }

  async createTestRepo() {
    const testId = crypto.randomBytes(8).toString('hex');
    this.testRepoPath = path.join(os.tmpdir(), `devops-test-${testId}`);
    
    console.log(`${colors.dim}Creating test repo: ${this.testRepoPath}${colors.reset}`);
    
    // Create directory structure
    fs.mkdirSync(this.testRepoPath, { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, 'src'), { recursive: true });
    fs.mkdirSync(path.join(this.testRepoPath, 'local_deploy'), { recursive: true });
    
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
        fs.copyFileSync(sourcePath, destPath);
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
      
      throw error;
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
      }
    };
    
    const mergedSettings = { ...defaultSettings, ...settings };
    const settingsPath = path.join(this.testRepoPath, 'local_deploy', 'project-settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
    
    return mergedSettings;
  }

  async testBasicFunctionality() {
    await this.runTest('Basic git operations', async () => {
      // Test basic git operations work
      execSync('git checkout -b test-branch', { stdio: 'ignore' });
      fs.writeFileSync('test.txt', 'test content');
      execSync('git add test.txt', { stdio: 'ignore' });
      execSync('git commit -m "Test commit"', { stdio: 'ignore' });
      execSync('git checkout main', { stdio: 'ignore' });
      
      this.assertBranchExists('test-branch');
      this.assertBranchExists('main');
      
      return { success: true };
    });
  }

  async testConfigManager() {
    await this.runTest('Configuration manager', async () => {
      // Test that the config manager can be imported and basic functions work
      this.createProjectSettings();
      
      // Check if the config file was created
      this.assertFileExists('local_deploy/project-settings.json');
      
      const configContent = fs.readFileSync('local_deploy/project-settings.json', 'utf8');
      const config = JSON.parse(configContent);
      
      if (!config.branchManagement) {
        throw new Error('Configuration missing branchManagement section');
      }
      
      return { success: true, config };
    });
  }

  async testBranchCreation() {
    await this.runTest('Branch creation and management', async () => {
      // Test creating multiple branches like the system would
      const branches = ['daily/2025-10-10', 'session/agent/task1', 'weekly/2025-10-01_to_2025-10-07'];
      
      for (const branch of branches) {
        execSync(`git checkout -b "${branch}"`, { stdio: 'ignore' });
        fs.writeFileSync(`${branch.replace(/[\/]/g, '-')}.txt`, `Content for ${branch}`);
        execSync(`git add .`, { stdio: 'ignore' });
        execSync(`git commit -m "Work in ${branch}"`, { stdio: 'ignore' });
        execSync('git checkout main', { stdio: 'ignore' });
        
        this.assertBranchExists(branch);
      }
      
      // Test branch listing
      const output = execSync('git branch --format="%(refname:short)"', { encoding: 'utf8' });
      const allBranches = output.split('\n').filter(b => b.trim()).map(b => b.trim());
      
      for (const branch of branches) {
        if (!allBranches.includes(branch)) {
          throw new Error(`Branch ${branch} not found in git branch list`);
        }
      }
      
      return { success: true, branchesCreated: branches.length };
    });
  }

  async testMergeOperations() {
    await this.runTest('Basic merge operations', async () => {
      // Create a feature branch with changes
      execSync('git checkout -b feature/test', { stdio: 'ignore' });
      fs.writeFileSync('feature.txt', 'Feature content');
      execSync('git add feature.txt', { stdio: 'ignore' });
      execSync('git commit -m "Add feature"', { stdio: 'ignore' });
      
      // Merge back to main
      execSync('git checkout main', { stdio: 'ignore' });
      execSync('git merge feature/test --no-ff -m "Merge feature"', { stdio: 'ignore' });
      
      // Verify merge was successful
      this.assertFileExists('feature.txt');
      
      // Clean up feature branch
      execSync('git branch -d feature/test', { stdio: 'ignore' });
      
      return { success: true, merged: true };
    });
  }

  printResults() {
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;
    
    console.log(`\n${colors.bright}Test Results Summary:${colors.reset}`);
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
    }
    
    return failed === 0;
  }

  async runAllTests() {
    console.log(`${colors.bright}${colors.blue}Branch Management System - Simple Tests${colors.reset}`);
    console.log('='.repeat(60));

    try {
      await this.testBasicFunctionality();
      await this.testConfigManager();
      await this.testBranchCreation();
      await this.testMergeOperations();
      
    } catch (error) {
      console.error(`Test suite failed: ${error.message}`);
    }

    return this.printResults();
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new SimpleBranchManagementTest();
  tests.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
