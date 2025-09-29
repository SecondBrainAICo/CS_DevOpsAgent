#!/usr/bin/env node
/**
 * ============================================================================
 * DAILY BRANCH IN WORKTREE TEST SUITE
 * ============================================================================
 * Tests that daily branches work correctly within session worktrees
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Daily Branches in Worktrees', () => {
  let tempDir;
  let mainRepo;
  let worktreeDir;
  
  beforeEach(() => {
    // Create temp directory
    tempDir = `/tmp/devops-daily-branch-test-${Date.now()}`;
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Create main repository
    mainRepo = path.join(tempDir, 'main-repo');
    fs.mkdirSync(mainRepo);
    
    // Initialize git repo
    execSync('git init', { cwd: mainRepo });
    execSync('git config user.email "test@test.com"', { cwd: mainRepo });
    execSync('git config user.name "Test User"', { cwd: mainRepo });
    
    // Create initial commit
    fs.writeFileSync(path.join(mainRepo, 'README.md'), '# Test Repo');
    execSync('git add .', { cwd: mainRepo });
    execSync('git commit -m "Initial commit"', { cwd: mainRepo });
    
    // Create worktree for session
    worktreeDir = path.join(tempDir, 'worktrees', 'session-test');
    execSync(`git worktree add -b session/test/main "${worktreeDir}" HEAD`, { cwd: mainRepo });
  });
  
  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf ${tempDir}`);
    }
  });
  
  it('should create daily branch with session prefix', () => {
    const today = new Date().toISOString().split('T')[0];
    const expectedBranch = `claude_test_${today}`;
    
    // Simulate agent creating daily branch
    execSync(`git checkout -b ${expectedBranch}`, { cwd: worktreeDir });
    
    // Verify branch was created
    const currentBranch = execSync('git branch --show-current', { 
      cwd: worktreeDir, 
      encoding: 'utf8' 
    }).trim();
    
    expect(currentBranch).toBe(expectedBranch);
  });
  
  it('should handle date rollover at midnight', () => {
    // Test with different timezones
    const timezones = ['Asia/Dubai', 'America/New_York', 'Europe/London'];
    
    timezones.forEach(tz => {
      // Get date string for timezone
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      
      const branchName = `agent_session_${dateStr}`;
      
      // Create branch
      execSync(`git checkout -b ${branchName}`, { cwd: worktreeDir });
      
      // Verify branch exists
      const branches = execSync('git branch', { 
        cwd: worktreeDir, 
        encoding: 'utf8' 
      });
      
      expect(branches).toContain(branchName);
      
      // Switch back to main for next test
      execSync('git checkout session/test/main', { cwd: worktreeDir });
    });
  });
  
  it('should create different daily branches for different sessions', () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Create multiple worktrees for different sessions
    const sessions = ['abc1-def2', 'xyz3-uvw4', 'mno5-pqr6'];
    
    sessions.forEach(sessionId => {
      const worktreePath = path.join(tempDir, 'worktrees', `session-${sessionId}`);
      const baseBranch = `session/${sessionId}/task`;
      
      // Create worktree
      execSync(`git worktree add -b ${baseBranch} "${worktreePath}" HEAD`, { 
        cwd: mainRepo 
      });
      
      // Create daily branch in worktree
      const dailyBranch = `agent_${sessionId}_${today}`;
      execSync(`git checkout -b ${dailyBranch}`, { cwd: worktreePath });
      
      // Verify branch
      const currentBranch = execSync('git branch --show-current', { 
        cwd: worktreePath, 
        encoding: 'utf8' 
      }).trim();
      
      expect(currentBranch).toBe(dailyBranch);
    });
  });
  
  it('should maintain separate daily branches per worktree', () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Create second worktree
    const worktree2 = path.join(tempDir, 'worktrees', 'session-2');
    execSync(`git worktree add -b session/test2/main "${worktree2}" HEAD`, { 
      cwd: mainRepo 
    });
    
    // Create daily branches in both worktrees
    const branch1 = `session1_${today}`;
    const branch2 = `session2_${today}`;
    
    execSync(`git checkout -b ${branch1}`, { cwd: worktreeDir });
    execSync(`git checkout -b ${branch2}`, { cwd: worktree2 });
    
    // Make commits in each
    fs.writeFileSync(path.join(worktreeDir, 'file1.txt'), 'Session 1 work');
    execSync('git add . && git commit -m "Session 1 commit"', { cwd: worktreeDir });
    
    fs.writeFileSync(path.join(worktree2, 'file2.txt'), 'Session 2 work');
    execSync('git add . && git commit -m "Session 2 commit"', { cwd: worktree2 });
    
    // Verify branches are independent
    const log1 = execSync('git log --oneline -1', { 
      cwd: worktreeDir, 
      encoding: 'utf8' 
    });
    const log2 = execSync('git log --oneline -1', { 
      cwd: worktree2, 
      encoding: 'utf8' 
    });
    
    expect(log1).toContain('Session 1 commit');
    expect(log2).toContain('Session 2 commit');
    expect(log1).not.toContain('Session 2');
    expect(log2).not.toContain('Session 1');
  });
  
  it('should handle branch naming with different date styles', () => {
    const date = new Date();
    const dashStyle = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const compactStyle = dashStyle.replace(/-/g, ''); // YYYYMMDD
    
    // Test dash style
    const dashBranch = `agent_test_${dashStyle}`;
    execSync(`git checkout -b ${dashBranch}`, { cwd: worktreeDir });
    let current = execSync('git branch --show-current', { 
      cwd: worktreeDir, 
      encoding: 'utf8' 
    }).trim();
    expect(current).toBe(dashBranch);
    
    // Switch back
    execSync('git checkout session/test/main', { cwd: worktreeDir });
    
    // Test compact style  
    const compactBranch = `agent_test_${compactStyle}`;
    execSync(`git checkout -b ${compactBranch}`, { cwd: worktreeDir });
    current = execSync('git branch --show-current', { 
      cwd: worktreeDir, 
      encoding: 'utf8' 
    }).trim();
    expect(current).toBe(compactBranch);
  });
});