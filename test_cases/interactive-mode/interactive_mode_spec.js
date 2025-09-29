#!/usr/bin/env node
/**
 * ============================================================================
 * INTERACTIVE MODE TEST SUITE
 * ============================================================================
 * Tests the new interactive command interface functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fork } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Interactive Mode', () => {
  let agent;
  let testDir;
  let agentPath;
  
  beforeEach(() => {
    // Create temp test directory
    testDir = `/tmp/devops-agent-interactive-test-${Date.now()}`;
    fs.mkdirSync(testDir, { recursive: true });
    
    // Initialize git repo
    require('child_process').execSync('git init', { cwd: testDir });
    require('child_process').execSync('git config user.email "test@test.com"', { cwd: testDir });
    require('child_process').execSync('git config user.name "Test User"', { cwd: testDir });
    
    // Path to agent worker
    agentPath = path.join(__dirname, '../../src/cs-devops-agent-worker.js');
  });
  
  afterEach(() => {
    // Kill agent if still running
    if (agent && !agent.killed) {
      agent.kill('SIGKILL');
    }
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      require('child_process').execSync(`rm -rf ${testDir}`);
    }
  });
  
  it('should start with interactive prompt', (done) => {
    agent = fork(agentPath, [], {
      cwd: testDir,
      env: {
        ...process.env,
        AC_MSG_FILE: '.test-commit.msg',
        AC_BRANCH: 'test-branch',
        AC_PUSH: 'false',
        AC_DEBUG: 'false',
        AC_CS_DEVOPS_AGENT_ON_START: 'false'
      },
      stdio: 'pipe',
      silent: false
    });
    
    let output = '';
    agent.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('[agent] >')) {
        expect(output).toContain('INTERACTIVE COMMANDS AVAILABLE');
        expect(output).toContain('help');
        expect(output).toContain('status');
        expect(output).toContain('exit');
        done();
      }
    });
    
    setTimeout(() => {
      done(new Error('Timeout waiting for interactive prompt'));
    }, 5000);
  });
  
  it('should respond to help command', (done) => {
    agent = fork(agentPath, [], {
      cwd: testDir,
      env: {
        ...process.env,
        AC_MSG_FILE: '.test-commit.msg',
        AC_BRANCH: 'test-branch',
        AC_PUSH: 'false',
        AC_DEBUG: 'false',
        AC_CS_DEVOPS_AGENT_ON_START: 'false'
      },
      stdio: 'pipe',
      silent: false
    });
    
    let output = '';
    let sentHelp = false;
    
    agent.stdout.on('data', (data) => {
      output += data.toString();
      
      if (!sentHelp && output.includes('[agent] >')) {
        sentHelp = true;
        agent.stdin.write('help\n');
      }
      
      if (sentHelp && output.includes('Available commands:')) {
        expect(output).toContain('help/h/?');
        expect(output).toContain('status/s');
        expect(output).toContain('verbose/v');
        expect(output).toContain('commit/c');
        expect(output).toContain('push/p');
        expect(output).toContain('exit/quit/q');
        done();
      }
    });
    
    setTimeout(() => {
      done(new Error('Timeout waiting for help response'));
    }, 5000);
  });
  
  it('should toggle verbose mode', (done) => {
    agent = fork(agentPath, [], {
      cwd: testDir,
      env: {
        ...process.env,
        AC_MSG_FILE: '.test-commit.msg',
        AC_BRANCH: 'test-branch',
        AC_PUSH: 'false',
        AC_DEBUG: 'false',
        AC_CS_DEVOPS_AGENT_ON_START: 'false'
      },
      stdio: 'pipe',
      silent: false
    });
    
    let output = '';
    let sentVerbose = false;
    
    agent.stdout.on('data', (data) => {
      output += data.toString();
      
      if (!sentVerbose && output.includes('[agent] >')) {
        sentVerbose = true;
        agent.stdin.write('verbose\n');
      }
      
      if (sentVerbose && output.includes('Verbose/Debug logging:')) {
        expect(output).toMatch(/Verbose\/Debug logging: (ENABLED|DISABLED)/);
        done();
      }
    });
    
    setTimeout(() => {
      done(new Error('Timeout waiting for verbose toggle'));
    }, 5000);
  });
  
  it('should show status with uncommitted changes', (done) => {
    // Create a test file
    fs.writeFileSync(path.join(testDir, 'test.txt'), 'test content');
    
    agent = fork(agentPath, [], {
      cwd: testDir,
      env: {
        ...process.env,
        AC_MSG_FILE: '.test-commit.msg',
        AC_BRANCH: 'test-branch',
        AC_PUSH: 'false',
        AC_DEBUG: 'false',
        AC_CS_DEVOPS_AGENT_ON_START: 'false'
      },
      stdio: 'pipe',
      silent: false
    });
    
    let output = '';
    let sentStatus = false;
    
    agent.stdout.on('data', (data) => {
      output += data.toString();
      
      if (!sentStatus && output.includes('[agent] >')) {
        sentStatus = true;
        agent.stdin.write('status\n');
      }
      
      if (sentStatus && output.includes('Session Status:')) {
        expect(output).toContain('Branch: test-branch');
        expect(output).toContain('Uncommitted changes:');
        expect(output).toContain('test.txt');
        done();
      }
    });
    
    setTimeout(() => {
      done(new Error('Timeout waiting for status'));
    }, 5000);
  });
  
  it('should handle clean exit', (done) => {
    agent = fork(agentPath, [], {
      cwd: testDir,
      env: {
        ...process.env,
        AC_MSG_FILE: '.test-commit.msg',
        AC_BRANCH: 'test-branch',
        AC_PUSH: 'false',
        AC_DEBUG: 'false',
        AC_CS_DEVOPS_AGENT_ON_START: 'false'
      },
      stdio: 'pipe',
      silent: false
    });
    
    let output = '';
    let sentExit = false;
    let sentNo = false;
    
    agent.stdout.on('data', (data) => {
      output += data.toString();
      
      if (!sentExit && output.includes('[agent] >')) {
        sentExit = true;
        agent.stdin.write('exit\n');
      }
      
      if (sentExit && !sentNo && output.includes('Commit them before exit?')) {
        sentNo = true;
        agent.stdin.write('n\n');
      }
      
      if (output.includes('Goodbye!')) {
        expect(output).toContain('Initiating clean shutdown');
        done();
      }
    });
    
    agent.on('exit', (code) => {
      expect(code).toBe(0);
    });
    
    setTimeout(() => {
      done(new Error('Timeout waiting for exit'));
    }, 5000);
  });
});