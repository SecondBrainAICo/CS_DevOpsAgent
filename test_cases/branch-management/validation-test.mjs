#!/usr/bin/env node

/**
 * Validation test for branch management system
 * Tests the core concepts and workflows without executing the actual scripts
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

class BranchManagementValidationTest {
  constructor() {
    this.testResults = [];
    this.testRepoPath = null;
    this.originalCwd = process.cwd();
  }

  async createTestRepo() {
    const testId = crypto.randomBytes(8).toString('hex');
    this.testRepoPath = path.join(os.tmpdir(), `devops-validation-test-${testId}`);
    
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

  // Test the hierarchical branching model
  async testHierarchicalBranching() {
    await this.runTest('Hierarchical Branching Model', async () => {
      // Create the hierarchy: session -> daily -> weekly -> main
      
      // 1. Create session branches
      const sessionBranches = [
        'session/agent1/feature-a',
        'session/agent2/feature-b',
        'session/agent1/bug-fix'
      ];
      
      for (const branch of sessionBranches) {
        execSync(`git checkout -b "${branch}"`, { stdio: 'ignore' });
        fs.writeFileSync(`${branch.replace(/[\/]/g, '-')}.txt`, `Work in ${branch}`);
        execSync(`git add .`, { stdio: 'ignore' });
        execSync(`git commit -m "Work in ${branch}"`, { stdio: 'ignore' });
        execSync('git checkout main', { stdio: 'ignore' });
        
        this.assertBranchExists(branch);
      }
      
      // 2. Create daily branch and merge sessions
      const today = new Date().toISOString().split('T')[0];
      const dailyBranch = `daily/${today}`;
      
      execSync(`git checkout -b "${dailyBranch}"`, { stdio: 'ignore' });
      
      // Merge session branches into daily
      for (const sessionBranch of sessionBranches) {
        execSync(`git merge "${sessionBranch}" --no-ff -m "Merge ${sessionBranch} into daily"`, { stdio: 'ignore' });
      }
      
      execSync('git checkout main', { stdio: 'ignore' });
      this.assertBranchExists(dailyBranch);
      
      // 3. Create weekly branch and merge daily
      const weeklyBranch = `weekly/${today}_to_${today}`;
      execSync(`git checkout -b "${weeklyBranch}"`, { stdio: 'ignore' });
      execSync(`git merge "${dailyBranch}" --no-ff -m "Merge daily into weekly"`, { stdio: 'ignore' });
      execSync('git checkout main', { stdio: 'ignore' });
      
      this.assertBranchExists(weeklyBranch);
      
      // 4. Merge weekly into main
      execSync(`git merge "${weeklyBranch}" --no-ff -m "Merge weekly into main"`, { stdio: 'ignore' });
      
      return { 
        success: true, 
        sessionBranches: sessionBranches.length,
        dailyBranch,
        weeklyBranch
      };
    });
  }

  // Test dual merge scenario
  async testDualMergeScenario() {
    await this.runTest('Dual Merge Scenario', async () => {
      // Create a session branch
      const sessionBranch = 'session/agent/dual-merge-test';
      execSync(`git checkout -b "${sessionBranch}"`, { stdio: 'ignore' });
      fs.writeFileSync('dual-merge-work.txt', 'Work for dual merge test');
      execSync(`git add dual-merge-work.txt`, { stdio: 'ignore' });
      execSync(`git commit -m "Work for dual merge test"`, { stdio: 'ignore' });
      execSync('git checkout main', { stdio: 'ignore' });
      
      // Create daily branch
      const today = new Date().toISOString().split('T')[0];
      const dailyBranch = `daily/${today}`;
      execSync(`git checkout -b "${dailyBranch}"`, { stdio: 'ignore' });
      execSync('git checkout main', { stdio: 'ignore' });
      
      // Simulate dual merge: merge to both daily and main
      // 1. Merge to daily first (hierarchical-first strategy)
      execSync(`git checkout "${dailyBranch}"`, { stdio: 'ignore' });
      execSync(`git merge "${sessionBranch}" --no-ff -m "Merge session to daily"`, { stdio: 'ignore' });
      
      // 2. Merge to main
      execSync('git checkout main', { stdio: 'ignore' });
      execSync(`git merge "${sessionBranch}" --no-ff -m "Merge session to main"`, { stdio: 'ignore' });
      
      // Verify both branches have the content
      execSync(`git checkout "${dailyBranch}"`, { stdio: 'ignore' });
      this.assertFileExists('dual-merge-work.txt');
      
      execSync('git checkout main', { stdio: 'ignore' });
      this.assertFileExists('dual-merge-work.txt');
      
      // Clean up session branch (simulate session closure)
      execSync(`git branch -D "${sessionBranch}"`, { stdio: 'ignore' });
      this.assertBranchNotExists(sessionBranch);
      
      return { 
        success: true, 
        mergedToBoth: true,
        dailyBranch,
        sessionCleaned: true
      };
    });
  }

  // Test session lifecycle management
  async testSessionLifecycle() {
    await this.runTest('Session Lifecycle Management', async () => {
      const sessionId = 'test-session-123';
      const sessionBranch = 'session/agent/lifecycle-test';
      
      // 1. Create session (simulate session start)
      const sessionData = {
        sessionId,
        task: 'lifecycle-test',
        agentType: 'test-agent',
        branchName: sessionBranch,
        status: 'active',
        created: new Date().toISOString(),
        worktreePath: path.join(this.testRepoPath, 'local_deploy', 'worktrees', sessionId)
      };
      
      // Create session lock file
      const lockFile = path.join(this.testRepoPath, 'local_deploy', 'session-locks', `${sessionId}.lock`);
      fs.writeFileSync(lockFile, JSON.stringify(sessionData, null, 2));
      this.assertFileExists(`local_deploy/session-locks/${sessionId}.lock`);
      
      // Create session branch
      execSync(`git checkout -b "${sessionBranch}"`, { stdio: 'ignore' });
      fs.writeFileSync('session-work.txt', 'Work done in session');
      execSync(`git add session-work.txt`, { stdio: 'ignore' });
      execSync(`git commit -m "Session work"`, { stdio: 'ignore' });
      execSync('git checkout main', { stdio: 'ignore' });
      
      this.assertBranchExists(sessionBranch);
      
      // 2. Simulate session closure with merge
      const today = new Date().toISOString().split('T')[0];
      const dailyBranch = `daily/${today}`;
      
      // Create daily branch if it doesn't exist
      try {
        execSync(`git checkout -b "${dailyBranch}"`, { stdio: 'ignore' });
      } catch {
        execSync(`git checkout "${dailyBranch}"`, { stdio: 'ignore' });
      }
      
      // Merge session into daily
      execSync(`git merge "${sessionBranch}" --no-ff -m "Merge session into daily"`, { stdio: 'ignore' });
      execSync('git checkout main', { stdio: 'ignore' });
      
      // Clean up session
      execSync(`git branch -D "${sessionBranch}"`, { stdio: 'ignore' });
      fs.unlinkSync(lockFile);
      
      // Verify cleanup
      this.assertBranchNotExists(sessionBranch);
      if (fs.existsSync(lockFile)) {
        throw new Error('Session lock file should be deleted');
      }
      
      // Verify work is preserved in daily branch
      execSync(`git checkout "${dailyBranch}"`, { stdio: 'ignore' });
      this.assertFileExists('session-work.txt');
      execSync('git checkout main', { stdio: 'ignore' });
      
      return { 
        success: true, 
        sessionCreated: true,
        sessionMerged: true,
        sessionCleaned: true,
        workPreserved: true
      };
    });
  }

  // Test weekly consolidation workflow
  async testWeeklyConsolidation() {
    await this.runTest('Weekly Consolidation Workflow', async () => {
      // Create multiple daily branches (simulating a week of work)
      const dates = ['2025-10-07', '2025-10-08', '2025-10-09', '2025-10-10'];
      const dailyBranches = [];
      
      for (const date of dates) {
        const dailyBranch = `daily/${date}`;
        dailyBranches.push(dailyBranch);
        
        execSync(`git checkout -b "${dailyBranch}"`, { stdio: 'ignore' });
        fs.writeFileSync(`work-${date}.txt`, `Daily work for ${date}`);
        execSync(`git add work-${date}.txt`, { stdio: 'ignore' });
        execSync(`git commit -m "Daily work for ${date}"`, { stdio: 'ignore' });
        execSync('git checkout main', { stdio: 'ignore' });
        
        this.assertBranchExists(dailyBranch);
      }
      
      // Create weekly branch and consolidate
      const weeklyBranch = `weekly/${dates[0]}_to_${dates[dates.length - 1]}`;
      execSync(`git checkout -b "${weeklyBranch}"`, { stdio: 'ignore' });
      
      // Merge all daily branches into weekly
      for (const dailyBranch of dailyBranches) {
        execSync(`git merge "${dailyBranch}" --no-ff -m "Merge ${dailyBranch} into weekly"`, { stdio: 'ignore' });
      }
      
      execSync('git checkout main', { stdio: 'ignore' });
      this.assertBranchExists(weeklyBranch);
      
      // Verify all daily work is in weekly branch
      execSync(`git checkout "${weeklyBranch}"`, { stdio: 'ignore' });
      for (const date of dates) {
        this.assertFileExists(`work-${date}.txt`);
      }
      execSync('git checkout main', { stdio: 'ignore' });
      
      // Clean up daily branches (simulate consolidation cleanup)
      for (const dailyBranch of dailyBranches) {
        execSync(`git branch -D "${dailyBranch}"`, { stdio: 'ignore' });
        this.assertBranchNotExists(dailyBranch);
      }
      
      return { 
        success: true, 
        dailyBranchesConsolidated: dailyBranches.length,
        weeklyBranch,
        dailyBranchesCleaned: true
      };
    });
  }

  // Test orphaned session detection logic
  async testOrphanedSessionDetection() {
    await this.runTest('Orphaned Session Detection', async () => {
      const currentTime = new Date();
      
      // Create recent session (not orphaned)
      const recentSession = {
        sessionId: 'recent-session',
        branchName: 'session/agent/recent-work',
        created: currentTime.toISOString(),
        status: 'active'
      };
      
      fs.writeFileSync(
        `local_deploy/session-locks/${recentSession.sessionId}.lock`,
        JSON.stringify(recentSession, null, 2)
      );
      
      // Create old session (orphaned)
      const oldTime = new Date(currentTime.getTime() - (8 * 24 * 60 * 60 * 1000)); // 8 days ago
      const oldSession = {
        sessionId: 'old-session',
        branchName: 'session/agent/old-work',
        created: oldTime.toISOString(),
        status: 'active'
      };
      
      fs.writeFileSync(
        `local_deploy/session-locks/${oldSession.sessionId}.lock`,
        JSON.stringify(oldSession, null, 2)
      );
      
      // Create branches for both sessions
      for (const session of [recentSession, oldSession]) {
        execSync(`git checkout -b "${session.branchName}"`, { stdio: 'ignore' });
        fs.writeFileSync(`${session.sessionId}.txt`, `Work for ${session.sessionId}`);
        execSync(`git add ${session.sessionId}.txt`, { stdio: 'ignore' });
        execSync(`git commit -m "Work for ${session.sessionId}"`, { stdio: 'ignore' });
        execSync('git checkout main', { stdio: 'ignore' });
      }
      
      // Simulate orphan detection logic (7 day threshold)
      const orphanThresholdDays = 7;
      const thresholdTime = new Date(currentTime.getTime() - (orphanThresholdDays * 24 * 60 * 60 * 1000));
      
      const lockFiles = fs.readdirSync('local_deploy/session-locks');
      const orphanedSessions = [];
      
      for (const lockFile of lockFiles) {
        const sessionData = JSON.parse(fs.readFileSync(`local_deploy/session-locks/${lockFile}`, 'utf8'));
        const createdTime = new Date(sessionData.created);
        
        if (createdTime < thresholdTime) {
          orphanedSessions.push(sessionData);
        }
      }
      
      // Should find only the old session as orphaned
      if (orphanedSessions.length !== 1) {
        throw new Error(`Expected 1 orphaned session, found ${orphanedSessions.length}`);
      }
      
      if (orphanedSessions[0].sessionId !== 'old-session') {
        throw new Error(`Expected old-session to be orphaned, found ${orphanedSessions[0].sessionId}`);
      }
      
      return { 
        success: true, 
        orphansDetected: orphanedSessions.length,
        orphanedSession: orphanedSessions[0].sessionId,
        thresholdDays: orphanThresholdDays
      };
    });
  }

  // Test configuration management
  async testConfigurationManagement() {
    await this.runTest('Configuration Management', async () => {
      // Test default configuration
      const defaultConfig = {
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
      
      // Save configuration
      const configPath = 'local_deploy/project-settings.json';
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      this.assertFileExists(configPath);
      
      // Test configuration loading
      const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      if (loadedConfig.branchManagement.defaultMergeTarget !== 'main') {
        throw new Error('Configuration not loaded correctly');
      }
      
      // Test configuration modification
      loadedConfig.branchManagement.enableDualMerge = true;
      loadedConfig.branchManagement.mergeStrategy = 'target-first';
      
      fs.writeFileSync(configPath, JSON.stringify(loadedConfig, null, 2));
      
      // Verify modification
      const modifiedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      if (!modifiedConfig.branchManagement.enableDualMerge) {
        throw new Error('Configuration modification failed');
      }
      
      if (modifiedConfig.branchManagement.mergeStrategy !== 'target-first') {
        throw new Error('Merge strategy not updated correctly');
      }
      
      return { 
        success: true, 
        configLoaded: true,
        configModified: true,
        dualMergeEnabled: modifiedConfig.branchManagement.enableDualMerge
      };
    });
  }

  printResults() {
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;
    
    console.log(`\n${colors.bright}Branch Management Validation Results:${colors.reset}`);
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
      console.log(`\n${colors.green}${colors.bright}All validation tests passed! 🎉${colors.reset}`);
      console.log(`${colors.dim}The branch management system design is sound and ready for implementation.${colors.reset}`);
    }
    
    return failed === 0;
  }

  async runAllTests() {
    console.log(`${colors.bright}${colors.blue}Branch Management System - Validation Tests${colors.reset}`);
    console.log(`${colors.dim}Testing core concepts and workflows${colors.reset}`);
    console.log('='.repeat(70));

    try {
      await this.testHierarchicalBranching();
      await this.testDualMergeScenario();
      await this.testSessionLifecycle();
      await this.testWeeklyConsolidation();
      await this.testOrphanedSessionDetection();
      await this.testConfigurationManagement();
      
    } catch (error) {
      console.error(`Test suite failed: ${error.message}`);
    }

    return this.printResults();
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new BranchManagementValidationTest();
  tests.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
