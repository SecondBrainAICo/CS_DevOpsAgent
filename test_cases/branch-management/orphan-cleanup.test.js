#!/usr/bin/env node

/**
 * ============================================================================
 * ORPHANED SESSION CLEANUP TESTS
 * ============================================================================
 * 
 * Tests for the orphan-cleaner.js functionality including:
 * - Detection of orphaned sessions based on age
 * - Cleanup of orphaned sessions with merge attempts
 * - Handling of missing branches
 * - Configuration-based thresholds
 * 
 * ============================================================================
 */

const BranchManagementTestFramework = require('./test-framework');

class OrphanCleanupTests {
  constructor() {
    this.framework = new BranchManagementTestFramework();
  }

  async runAllTests() {
    console.log(`\n${this.framework.constructor.name} - Orphan Cleanup Tests`);
    console.log('='.repeat(60));

    try {
      await this.testOrphanDetection();
      await this.testOrphanCleanupWithMerge();
      await this.testOrphanWithMissingBranch();
      await this.testConfigurableThreshold();
      await this.testNoOrphansScenario();
      await this.testPartialOrphanCleanup();
      await this.testOrphanWithDualMerge();
      await this.testOrphanListingOnly();
      
    } catch (error) {
      console.error(`Test suite failed: ${error.message}`);
    }

    return this.framework.printResults();
  }

  /**
   * Test basic orphan detection
   */
  async testOrphanDetection() {
    await this.framework.runTest('Orphan detection', async () => {
      // Setup
      this.framework.createProjectSettings({
        branchManagement: {
          orphanSessionThresholdDays: 7
        }
      });

      // Create a recent session (should not be orphaned)
      const recentSession = this.framework.createMockSession('recent-session', 'recent-work');
      
      // Create an old session (should be orphaned)
      const oldSession = this.framework.createOldSession('old-session', 10); // 10 days old
      
      const OrphanedSessionCleaner = require(this.framework.testRepoPath + '/src/orphan-cleaner.js');
      const cleaner = new OrphanedSessionCleaner();
      
      const orphans = await cleaner.findOrphanedSessions();
      
      // Should find only the old session
      if (orphans.length !== 1) {
        throw new Error(`Expected 1 orphan, found ${orphans.length}`);
      }
      
      if (orphans[0].sessionId !== 'old-session') {
        throw new Error(`Expected old-session to be orphaned, found ${orphans[0].sessionId}`);
      }
      
      return { success: true, orphansFound: orphans.length };
    });
  }

  /**
   * Test orphan cleanup with successful merge
   */
  async testOrphanCleanupWithMerge() {
    await this.framework.runTest('Orphan cleanup with merge', async () => {
      this.framework.createProjectSettings({
        branchManagement: {
          orphanSessionThresholdDays: 5,
          enableDualMerge: false,
          defaultMergeTarget: 'main'
        }
      });

      const oldSession = this.framework.createOldSession('merge-orphan', 8);
      
      const OrphanedSessionCleaner = require(this.framework.testRepoPath + '/src/orphan-cleaner.js');
      const cleaner = new OrphanedSessionCleaner();
      
      // Mock the prompts to automatically clean up
      cleaner.promptForOrphanCleanup = async () => 'a'; // Clean up all
      
      await cleaner.cleanupOrphans();
      
      // Verify session was cleaned up
      this.framework.assertBranchNotExists(oldSession.branchName);
      this.framework.assertFileNotExists(`local_deploy/session-locks/${oldSession.sessionId}.lock`);
      
      // Verify merge target exists (main branch should have the merged content)
      this.framework.assertBranchExists('main');
      
      return { success: true, cleanedUp: true };
    });
  }

  /**
   * Test orphan with missing branch
   */
  async testOrphanWithMissingBranch() {
    await this.framework.runTest('Orphan with missing branch', async () => {
      this.framework.createProjectSettings({
        branchManagement: {
          orphanSessionThresholdDays: 5
        }
      });

      // Create session and then delete its branch
      const session = this.framework.createOldSession('missing-branch', 8);
      require('child_process').execSync(`git branch -D ${session.branchName}`, { stdio: 'ignore' });
      
      const OrphanedSessionCleaner = require(this.framework.testRepoPath + '/src/orphan-cleaner.js');
      const cleaner = new OrphanedSessionCleaner();
      
      const orphans = await cleaner.findOrphanedSessions();
      
      // Should still detect as orphan even with missing branch
      if (orphans.length !== 1) {
        throw new Error(`Expected 1 orphan with missing branch, found ${orphans.length}`);
      }
      
      if (!orphans[0].branchMissing) {
        throw new Error('Orphan should be marked as having missing branch');
      }
      
      // Cleanup should work even with missing branch
      cleaner.promptForOrphanCleanup = async () => 'a';
      await cleaner.cleanupOrphans();
      
      // Session lock should be removed
      this.framework.assertFileNotExists(`local_deploy/session-locks/${session.sessionId}.lock`);
      
      return { success: true, missingBranchHandled: true };
    });
  }

  /**
   * Test configurable threshold
   */
  async testConfigurableThreshold() {
    await this.framework.runTest('Configurable threshold', async () => {
      // Set a very short threshold
      this.framework.createProjectSettings({
        branchManagement: {
          orphanSessionThresholdDays: 1
        }
      });

      // Create a session that's 2 days old (should be orphaned with 1-day threshold)
      const session = this.framework.createOldSession('threshold-test', 2);
      
      const OrphanedSessionCleaner = require(this.framework.testRepoPath + '/src/orphan-cleaner.js');
      const cleaner = new OrphanedSessionCleaner();
      
      const orphans = await cleaner.findOrphanedSessions();
      
      if (orphans.length !== 1) {
        throw new Error(`Expected 1 orphan with 1-day threshold, found ${orphans.length}`);
      }
      
      // Now test with longer threshold
      this.framework.createProjectSettings({
        branchManagement: {
          orphanSessionThresholdDays: 5 // 5 days, session is only 2 days old
        }
      });
      
      const cleaner2 = new OrphanedSessionCleaner();
      const orphans2 = await cleaner2.findOrphanedSessions();
      
      if (orphans2.length !== 0) {
        throw new Error(`Expected 0 orphans with 5-day threshold, found ${orphans2.length}`);
      }
      
      return { success: true, thresholdConfigurable: true };
    });
  }

  /**
   * Test scenario with no orphans
   */
  async testNoOrphansScenario() {
    await this.framework.runTest('No orphans scenario', async () => {
      this.framework.createProjectSettings();
      
      // Create only recent sessions
      this.framework.createMockSession('recent1', 'work1');
      this.framework.createMockSession('recent2', 'work2');
      
      const OrphanedSessionCleaner = require(this.framework.testRepoPath + '/src/orphan-cleaner.js');
      const cleaner = new OrphanedSessionCleaner();
      
      const orphans = await cleaner.findOrphanedSessions();
      
      if (orphans.length !== 0) {
        throw new Error(`Expected 0 orphans, found ${orphans.length}`);
      }
      
      // Cleanup should complete without error
      await cleaner.cleanupOrphans();
      
      return { success: true, noOrphansFound: true };
    });
  }

  /**
   * Test partial orphan cleanup (selective)
   */
  async testPartialOrphanCleanup() {
    await this.framework.runTest('Partial orphan cleanup', async () => {
      this.framework.createProjectSettings({
        branchManagement: {
          orphanSessionThresholdDays: 5
        }
      });

      // Create multiple old sessions
      const session1 = this.framework.createOldSession('orphan1', 8);
      const session2 = this.framework.createOldSession('orphan2', 10);
      const session3 = this.framework.createOldSession('orphan3', 12);
      
      const OrphanedSessionCleaner = require(this.framework.testRepoPath + '/src/orphan-cleaner.js');
      const cleaner = new OrphanedSessionCleaner();
      
      // Mock selective cleanup (choose specific sessions)
      cleaner.promptForOrphanCleanup = async () => 's'; // Select specific
      cleaner.selectSessionsForCleanup = async (orphans) => {
        // Return only first and third sessions
        return [orphans[0], orphans[2]];
      };
      
      await cleaner.cleanupOrphans();
      
      // Verify selective cleanup
      this.framework.assertBranchNotExists(session1.branchName);
      this.framework.assertBranchExists(session2.branchName); // Should still exist
      this.framework.assertBranchNotExists(session3.branchName);
      
      this.framework.assertFileNotExists(`local_deploy/session-locks/${session1.sessionId}.lock`);
      this.framework.assertFileExists(`local_deploy/session-locks/${session2.sessionId}.lock`);
      this.framework.assertFileNotExists(`local_deploy/session-locks/${session3.sessionId}.lock`);
      
      return { success: true, selectiveCleanup: true };
    });
  }

  /**
   * Test orphan cleanup with dual merge
   */
  async testOrphanWithDualMerge() {
    await this.framework.runTest('Orphan cleanup with dual merge', async () => {
      this.framework.createProjectSettings({
        branchManagement: {
          orphanSessionThresholdDays: 5,
          enableDualMerge: true,
          defaultMergeTarget: 'main',
          mergeStrategy: 'hierarchical-first'
        }
      });

      const oldSession = this.framework.createOldSession('dual-merge-orphan', 8);
      
      const OrphanedSessionCleaner = require(this.framework.testRepoPath + '/src/orphan-cleaner.js');
      const cleaner = new OrphanedSessionCleaner();
      
      cleaner.promptForOrphanCleanup = async () => 'a';
      
      await cleaner.cleanupOrphans();
      
      // Verify session was cleaned up
      this.framework.assertBranchNotExists(oldSession.branchName);
      this.framework.assertFileNotExists(`local_deploy/session-locks/${oldSession.sessionId}.lock`);
      
      // Verify both merge targets exist
      const today = new Date().toISOString().split('T')[0];
      const dailyBranch = `daily/${today}`;
      this.framework.assertBranchExists(dailyBranch);
      this.framework.assertBranchExists('main');
      
      return { success: true, dualMergeCompleted: true };
    });
  }

  /**
   * Test listing orphans without cleanup
   */
  async testOrphanListingOnly() {
    await this.framework.runTest('Orphan listing only', async () => {
      this.framework.createProjectSettings({
        branchManagement: {
          orphanSessionThresholdDays: 5
        }
      });

      const session1 = this.framework.createOldSession('list-orphan1', 8);
      const session2 = this.framework.createOldSession('list-orphan2', 10);
      
      const OrphanedSessionCleaner = require(this.framework.testRepoPath + '/src/orphan-cleaner.js');
      const cleaner = new OrphanedSessionCleaner();
      
      // Test list command
      await cleaner.run('list');
      
      // Sessions should still exist (no cleanup performed)
      this.framework.assertBranchExists(session1.branchName);
      this.framework.assertBranchExists(session2.branchName);
      this.framework.assertFileExists(`local_deploy/session-locks/${session1.sessionId}.lock`);
      this.framework.assertFileExists(`local_deploy/session-locks/${session2.sessionId}.lock`);
      
      return { success: true, listingOnly: true };
    });
  }
}

// Run tests if called directly
if (require.main === module) {
  const tests = new OrphanCleanupTests();
  tests.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = OrphanCleanupTests;
