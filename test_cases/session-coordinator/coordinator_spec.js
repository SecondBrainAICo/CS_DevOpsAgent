#!/usr/bin/env node
/**
 * ============================================================================
 * SESSION COORDINATOR TEST SUITE
 * ============================================================================
 * Tests the session coordinator's ability to manage multi-agent sessions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Session Coordinator', () => {
  let tempDir;
  let coordinatorPath;
  
  beforeEach(() => {
    // Create temp directory
    tempDir = `/tmp/devops-coordinator-test-${Date.now()}`;
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Initialize git repo
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "test@test.com"', { cwd: tempDir });
    execSync('git config user.name "Test User"', { cwd: tempDir });
    
    // Create initial commit
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Repo');
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });
    
    // Path to coordinator
    coordinatorPath = path.join(__dirname, '../../src/session-coordinator.js');
  });
  
  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf ${tempDir}`);
    }
  });
  
  it('should create session directories', () => {
    // Run coordinator to create session
    const result = execSync(`node ${coordinatorPath} create --task "test-task"`, {
      cwd: tempDir,
      encoding: 'utf8',
      input: '\n'  // For task prompt
    });
    
    // Check directories were created
    expect(fs.existsSync(path.join(tempDir, 'local_deploy/sessions'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'local_deploy/session-locks'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'local_deploy/worktrees'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'local_deploy/instructions'))).toBe(true);
  });
  
  it('should create worktree for session', () => {
    // Create session
    const result = execSync(`node ${coordinatorPath} create --task "test-feature"`, {
      cwd: tempDir,
      encoding: 'utf8',
      input: '\n'
    });
    
    // Extract session ID from output
    const sessionIdMatch = result.match(/Session ID:.*?([a-z0-9]{4}-[a-z0-9]{4})/);
    expect(sessionIdMatch).toBeTruthy();
    const sessionId = sessionIdMatch[1];
    
    // Check worktree exists
    const worktrees = execSync('git worktree list', { cwd: tempDir, encoding: 'utf8' });
    expect(worktrees).toContain('local_deploy/worktrees');
    expect(worktrees).toContain(sessionId);
  });
  
  it('should generate correct branch names', () => {
    const agents = ['claude', 'warp', 'cursor', 'copilot'];
    
    agents.forEach(agent => {
      // Create session for each agent type
      const result = execSync(`node ${coordinatorPath} create --task "test" --agent ${agent}`, {
        cwd: tempDir,
        encoding: 'utf8',
        input: '\n'
      });
      
      // Check branch name format
      expect(result).toMatch(new RegExp(`Branch:.*?${agent}/[a-z0-9]{4}-[a-z0-9]{4}/test`));
    });
  });
  
  it('should create lock file with correct data', () => {
    // Create session
    const result = execSync(`node ${coordinatorPath} create --task "feature-x"`, {
      cwd: tempDir,
      encoding: 'utf8',
      input: '\n'
    });
    
    // Extract session ID
    const sessionIdMatch = result.match(/Session ID:.*?([a-z0-9]{4}-[a-z0-9]{4})/);
    const sessionId = sessionIdMatch[1];
    
    // Check lock file
    const lockFile = path.join(tempDir, 'local_deploy/session-locks', `${sessionId}.lock`);
    expect(fs.existsSync(lockFile)).toBe(true);
    
    const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    expect(lockData.sessionId).toBe(sessionId);
    expect(lockData.task).toBe('feature-x');
    expect(lockData.status).toBe('active');
    expect(lockData.worktreePath).toContain('local_deploy/worktrees');
    expect(lockData.branchName).toContain(sessionId);
  });
  
  it('should generate instructions file', () => {
    // Create session
    const result = execSync(`node ${coordinatorPath} create --task "api-update"`, {
      cwd: tempDir,
      encoding: 'utf8',
      input: '\n'
    });
    
    // Extract session ID
    const sessionIdMatch = result.match(/Session ID:.*?([a-z0-9]{4}-[a-z0-9]{4})/);
    const sessionId = sessionIdMatch[1];
    
    // Check instructions file
    const instructionsFile = path.join(tempDir, 'local_deploy/instructions', `${sessionId}.md`);
    expect(fs.existsSync(instructionsFile)).toBe(true);
    
    const instructions = fs.readFileSync(instructionsFile, 'utf8');
    expect(instructions).toContain('DevOps Session Instructions');
    expect(instructions).toContain(sessionId);
    expect(instructions).toContain('api-update');
    expect(instructions).toContain('.devops-commit-' + sessionId + '.msg');
  });
  
  it('should list sessions correctly', () => {
    // Create multiple sessions
    execSync(`node ${coordinatorPath} create --task "task1"`, {
      cwd: tempDir,
      encoding: 'utf8',
      input: '\n'
    });
    
    execSync(`node ${coordinatorPath} create --task "task2"`, {
      cwd: tempDir,
      encoding: 'utf8',
      input: '\n'
    });
    
    // List sessions
    const listOutput = execSync(`node ${coordinatorPath} list`, {
      cwd: tempDir,
      encoding: 'utf8'
    });
    
    expect(listOutput).toContain('Active Sessions');
    expect(listOutput).toContain('task1');
    expect(listOutput).toContain('task2');
    expect(listOutput).toContain('Status: active');
  });
  
  it('should clean up stale locks', () => {
    // Create a stale lock (older than 1 hour)
    const locksDir = path.join(tempDir, 'local_deploy/session-locks');
    fs.mkdirSync(locksDir, { recursive: true });
    
    const staleLock = path.join(locksDir, 'stale.lock');
    fs.writeFileSync(staleLock, JSON.stringify({ sessionId: 'stale', status: 'active' }));
    
    // Set modification time to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(staleLock, twoHoursAgo, twoHoursAgo);
    
    // Run coordinator (should clean stale locks on init)
    execSync(`node ${coordinatorPath} list`, {
      cwd: tempDir,
      encoding: 'utf8'
    });
    
    // Check stale lock was removed
    expect(fs.existsSync(staleLock)).toBe(false);
  });
  
  it('should create SESSION_README.md in worktree', () => {
    // Create session
    const result = execSync(`node ${coordinatorPath} create --task "docs"`, {
      cwd: tempDir,
      encoding: 'utf8',
      input: '\n'
    });
    
    // Extract worktree path
    const pathMatch = result.match(/Worktree created at: (.+)/);
    expect(pathMatch).toBeTruthy();
    const worktreePath = pathMatch[1];
    
    // Check SESSION_README.md exists
    const readmePath = path.join(worktreePath, 'SESSION_README.md');
    expect(fs.existsSync(readmePath)).toBe(true);
    
    const readme = fs.readFileSync(readmePath, 'utf8');
    expect(readme).toContain('DevOps Agent Session');
    expect(readme).toContain('How to Use This Session');
  });
});