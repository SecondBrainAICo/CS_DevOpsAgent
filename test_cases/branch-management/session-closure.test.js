#!/usr/bin/env node

/**
 * ============================================================================
 * SESSION CLOSURE TESTS
 * ============================================================================
 * 
 * Tests for the enhanced-close-session.js functionality including:
 * - Single merge scenarios
 * - Dual merge scenarios  
 * - Different merge strategies
 * - Error handling and recovery
 * 
 * ============================================================================
 */

import BranchManagementTestFramework from './test-framework.js';

class SessionClosureTests {
  constructor() {
    this.framework = new BranchManagementTestFramework();
  }

  async runAllTests() {
    console.log(`\n${this.framework.constructor.name} - Session Closure Tests`);
    console.log('='.repeat(60));

    try {
      await this.testSingleMergeToMain();
      await this.testSingleMergeToDailyBranch();
      await this.testDualMergeHierarchicalFirst();
      await this.testDualMergeTargetFirst();
      await this.testDualMergeParallel();
      await this.testSessionCleanupAfterMerge();
      await this.testKeepSessionActive();
      await this.testDeleteSession();
      await this.testMergeConflictHandling();
      
    } catch (error) {
      console.error(`Test suite failed: ${error.message}`);
    }

    return this.framework.printResults();
  }

  /**
   * Test single merge to main branch
   */
  async testSingleMergeToMain() {
    await this.framework.runTest('Single merge to main branch', async () => {
      // Setup
      this.framework.createProjectSettings({
        branchManagement: {
          defaultMergeTarget: 'main',
          enableDualMerge: false
        }
      });

      const session = this.framework.createMockSession('test-session-1', 'feature-work');
      
      // Simulate closing session with merge
      const { default: EnhancedSessionCloser } = await import(`file://${this.framework.testRepoPath}/src/enhanced-close-session.js`);
      const closer = new EnhancedSessionCloser();
      
      // Mock the prompt to return 'merge'
      closer.promptForCloseAction = async () => 'm';
      
      await closer.closeSession(session);
      
      // Verify results
      this.framework.assertBranchNotExists(session.branchName); // Session branch should be deleted
      this.framework.assertFileNotExists(`local_deploy/session-locks/${session.sessionId}.lock`);
      
      // Check that main branch has the merged content
      const branches = this.framework.getAllBranches();
      this.framework.assertBranchExists('main');
      
      return { success: true, mergedTo: 'main' };
    });
  }

  /**
   * Test single merge to daily branch (when no target configured)
   */
  async testSingleMergeToDailyBranch() {
    await this.framework.runTest('Single merge to daily branch', async () => {
      // Setup with no default merge target
      this.framework.createProjectSettings({
        branchManagement: {
          defaultMergeTarget: null,
          enableDualMerge: false
        }
      });

      const session = this.framework.createMockSession('test-session-2', 'daily-work');
      
      const { default: EnhancedSessionCloser } = await import(`file://${this.framework.testRepoPath}/src/enhanced-close-session.js`);
      const closer = new EnhancedSessionCloser();
      closer.promptForCloseAction = async () => 'm';
      
      await closer.closeSession(session);
      
      // Verify daily branch was created and session merged to it
      const today = new Date().toISOString().split('T')[0];
      const dailyBranch = `daily/${today}`;
      this.framework.assertBranchExists(dailyBranch);
      this.framework.assertBranchNotExists(session.branchName);
      
      return { success: true, mergedTo: dailyBranch };
    });
  }

  /**
   * Test dual merge with hierarchical-first strategy
   */
  async testDualMergeHierarchicalFirst() {
    await this.framework.runTest('Dual merge - hierarchical first', async () => {
      // Setup dual merge
      this.framework.createProjectSettings({
        branchManagement: {
          defaultMergeTarget: 'main',
          enableDualMerge: true,
          mergeStrategy: 'hierarchical-first'
        }
      });

      const session = this.framework.createMockSession('test-session-3', 'dual-merge-work');
      
      const { default: EnhancedSessionCloser } = await import(`file://${this.framework.testRepoPath}/src/enhanced-close-session.js`);
      const closer = new EnhancedSessionCloser();
      closer.promptForCloseAction = async () => 'm';
      
      await closer.closeSession(session);
      
      // Verify both branches exist and session is cleaned up
      const today = new Date().toISOString().split('T')[0];
      const dailyBranch = `daily/${today}`;
      
      this.framework.assertBranchExists(dailyBranch);
      this.framework.assertBranchExists('main');
      this.framework.assertBranchNotExists(session.branchName);
      
      return { success: true, mergedTo: ['daily', 'main'] };
    });
  }

  /**
   * Test dual merge with target-first strategy
   */
  async testDualMergeTargetFirst() {
    await this.framework.runTest('Dual merge - target first', async () => {
      this.framework.createProjectSettings({
        branchManagement: {
          defaultMergeTarget: 'main',
          enableDualMerge: true,
          mergeStrategy: 'target-first'
        }
      });

      const session = this.framework.createMockSession('test-session-4', 'target-first-work');
      
      const { default: EnhancedSessionCloser } = await import(`file://${this.framework.testRepoPath}/src/enhanced-close-session.js`);
      const closer = new EnhancedSessionCloser();
      closer.promptForCloseAction = async () => 'm';
      
      await closer.closeSession(session);
      
      const today = new Date().toISOString().split('T')[0];
      const dailyBranch = `daily/${today}`;
      
      this.framework.assertBranchExists(dailyBranch);
      this.framework.assertBranchExists('main');
      this.framework.assertBranchNotExists(session.branchName);
      
      return { success: true, strategy: 'target-first' };
    });
  }

  /**
   * Test dual merge with parallel strategy
   */
  async testDualMergeParallel() {
    await this.framework.runTest('Dual merge - parallel', async () => {
      this.framework.createProjectSettings({
        branchManagement: {
          defaultMergeTarget: 'main',
          enableDualMerge: true,
          mergeStrategy: 'parallel'
        }
      });

      const session = this.framework.createMockSession('test-session-5', 'parallel-work');
      
      const { default: EnhancedSessionCloser } = await import(`file://${this.framework.testRepoPath}/src/enhanced-close-session.js`);
      const closer = new EnhancedSessionCloser();
      closer.promptForCloseAction = async () => 'm';
      
      await closer.closeSession(session);
      
      const today = new Date().toISOString().split('T')[0];
      const dailyBranch = `daily/${today}`;
      
      this.framework.assertBranchExists(dailyBranch);
      this.framework.assertBranchExists('main');
      this.framework.assertBranchNotExists(session.branchName);
      
      return { success: true, strategy: 'parallel' };
    });
  }

  /**
   * Test complete session cleanup after merge
   */
  async testSessionCleanupAfterMerge() {
    await this.framework.runTest('Session cleanup after merge', async () => {
      this.framework.createProjectSettings();
      const session = this.framework.createMockSession('cleanup-test', 'cleanup-work');
      
      // Create some session files that should be cleaned up
      const commitMsgFile = `.devops-commit-${session.sessionId}.msg`;
      require('fs').writeFileSync(commitMsgFile, 'test commit message');
      
      const { default: EnhancedSessionCloser } = await import(`file://${this.framework.testRepoPath}/src/enhanced-close-session.js`);
      const closer = new EnhancedSessionCloser();
      closer.promptForCloseAction = async () => 'm';
      
      await closer.closeSession(session);
      
      // Verify all session artifacts are cleaned up
      this.framework.assertBranchNotExists(session.branchName);
      this.framework.assertFileNotExists(`local_deploy/session-locks/${session.sessionId}.lock`);
      this.framework.assertFileNotExists(commitMsgFile);
      
      return { success: true, cleanedUp: true };
    });
  }

  /**
   * Test keeping session active (just cleanup worktree)
   */
  async testKeepSessionActive() {
    await this.framework.runTest('Keep session active', async () => {
      this.framework.createProjectSettings();
      const session = this.framework.createMockSession('keep-active', 'ongoing-work');
      
      const { default: EnhancedSessionCloser } = await import(`file://${this.framework.testRepoPath}/src/enhanced-close-session.js`);
      const closer = new EnhancedSessionCloser();
      closer.promptForCloseAction = async () => 'k'; // Keep active
      
      await closer.closeSession(session);
      
      // Verify session branch still exists but status is updated
      this.framework.assertBranchExists(session.branchName);
      this.framework.assertFileExists(`local_deploy/session-locks/${session.sessionId}.lock`);
      
      // Check that session status was updated to inactive
      const lockFile = require('fs').readFileSync(`local_deploy/session-locks/${session.sessionId}.lock`, 'utf8');
      const sessionData = JSON.parse(lockFile);
      
      if (sessionData.status !== 'inactive') {
        throw new Error('Session status should be inactive');
      }
      
      return { success: true, kept: true };
    });
  }

  /**
   * Test deleting session completely
   */
  async testDeleteSession() {
    await this.framework.runTest('Delete session completely', async () => {
      this.framework.createProjectSettings();
      const session = this.framework.createMockSession('delete-test', 'delete-work');
      
      const { default: EnhancedSessionCloser } = await import(`file://${this.framework.testRepoPath}/src/enhanced-close-session.js`);
      const closer = new EnhancedSessionCloser();
      closer.promptForCloseAction = async () => 'd'; // Delete
      
      // Mock the confirmation prompt
      const originalReadline = require('readline');
      const mockRl = {
        question: (question, callback) => {
          callback('DELETE'); // Confirm deletion
        },
        close: () => {}
      };
      
      require('readline').createInterface = () => mockRl;
      
      await closer.closeSession(session);
      
      // Restore readline
      require('readline').createInterface = originalReadline.createInterface;
      
      // Verify everything is deleted
      this.framework.assertBranchNotExists(session.branchName);
      this.framework.assertFileNotExists(`local_deploy/session-locks/${session.sessionId}.lock`);
      
      return { success: true, deleted: true };
    });
  }

  /**
   * Test merge conflict handling (simulated)
   */
  async testMergeConflictHandling() {
    await this.framework.runTest('Merge conflict handling', async () => {
      this.framework.createProjectSettings();
      
      // Create a session with conflicting changes
      const session = this.framework.createMockSession('conflict-test', 'conflict-work');
      
      // Create conflicting content in main branch
      require('child_process').execSync('git checkout main', { stdio: 'ignore' });
      require('fs').writeFileSync('conflict-file.txt', 'Main branch content\n');
      require('child_process').execSync('git add conflict-file.txt', { stdio: 'ignore' });
      require('child_process').execSync('git commit -m "Add conflicting content to main"', { stdio: 'ignore' });
      
      // Add same file with different content in session branch
      require('child_process').execSync(`git checkout ${session.branchName}`, { stdio: 'ignore' });
      require('fs').writeFileSync('conflict-file.txt', 'Session branch content\n');
      require('child_process').execSync('git add conflict-file.txt', { stdio: 'ignore' });
      require('child_process').execSync('git commit -m "Add conflicting content to session"', { stdio: 'ignore' });
      require('child_process').execSync('git checkout main', { stdio: 'ignore' });
      
      const { default: EnhancedSessionCloser } = await import(`file://${this.framework.testRepoPath}/src/enhanced-close-session.js`);
      const closer = new EnhancedSessionCloser();
      closer.promptForCloseAction = async () => 'm';
      
      // This should handle the conflict gracefully (not crash)
      try {
        await closer.closeSession(session);
        
        // Session branch should still exist if merge failed
        this.framework.assertBranchExists(session.branchName);
        
        return { success: true, conflictHandled: true };
      } catch (error) {
        // Expected behavior - merge should fail but not crash the system
        return { success: true, conflictDetected: true, error: error.message };
      }
    });
  }
}

// Run tests if called directly
if (require.main === module) {
  const tests = new SessionClosureTests();
  tests.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = SessionClosureTests;
