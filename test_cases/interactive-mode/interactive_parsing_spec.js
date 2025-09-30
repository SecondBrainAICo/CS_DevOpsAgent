#!/usr/bin/env node
/**
 * ============================================================================
 * INTERACTIVE COMMAND PARSING TEST SUITE
 * ============================================================================
 * Tests for the interactive command parsing issues including:
 * - Command recognition (exit, help, status, etc.)
 * - No developer initials prompt during runtime
 * - Proper handling of single-character vs full commands
 * - Clean exit flow
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { fork } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Interactive Command Parsing', () => {
  let agent;
  let testDir;
  let agentPath;
  let output = '';
  let errorOutput = '';
  
  beforeEach(() => {
    // Create temp test directory
    testDir = `/tmp/devops-agent-parsing-test-${Date.now()}`;
    fs.mkdirSync(testDir, { recursive: true });
    
    // Initialize git repo
    execSync('git init', { cwd: testDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });
    
    // Create initial commit to avoid rollover issues
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');
    execSync('git add .', { cwd: testDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: testDir, stdio: 'pipe' });
    
    // Path to agent worker
    agentPath = path.join(__dirname, '../../src/cs-devops-agent-worker.js');
    
    output = '';
    errorOutput = '';
  });
  
  afterEach(() => {
    // Kill agent if still running
    if (agent && !agent.killed) {
      agent.kill('SIGKILL');
    }
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`, { stdio: 'pipe' });
    }
  });
  
  describe('Command Recognition', () => {
    it('should NOT prompt for developer initials during runtime', (done) => {
      agent = fork(agentPath, [], {
        cwd: testDir,
        env: {
          ...process.env,
          AC_MSG_FILE: '.test-commit.msg',
          AC_BRANCH: 'test-branch',
          AC_PUSH: 'false',
          AC_DEBUG: 'false',
          AC_CS_DEVOPS_AGENT_ON_START: 'false',
          AC_BRANCH_PREFIX: 'test_',
          // Ensure no session coordinator interference
          DEVOPS_SESSION_ID: null,
          NO_INTERACTIVE_PROMPTS: 'true'
        },
        stdio: 'pipe',
        silent: false
      });
      
      agent.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      agent.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // Wait for agent to start and show prompt
      setTimeout(() => {
        // Should NOT see developer initials prompt
        expect(output).not.toContain('Please enter exactly 3 letters');
        expect(output).not.toContain('Developer initials');
        expect(output).not.toContain('First-time setup detected');
        
        // Should see interactive commands prompt
        expect(output).toContain('[agent] >');
        expect(output).toContain('INTERACTIVE COMMANDS AVAILABLE');
        
        done();
      }, 3000);
    }, 10000);
    
    it('should recognize "exit" command immediately', (done) => {
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
      
      let promptSeen = false;
      let exitSent = false;
      
      agent.stdout.on('data', (data) => {
        output += data.toString();
        
        if (!promptSeen && output.includes('[agent] >')) {
          promptSeen = true;
          // Send exit command
          agent.stdin.write('exit\n');
          exitSent = true;
        }
        
        if (exitSent && output.includes('Initiating clean shutdown')) {
          expect(output).not.toContain('Unknown command');
          expect(output).not.toContain('Please enter exactly 3 letters');
          expect(output).toContain('Initiating clean shutdown');
          done();
        }
      });
      
      setTimeout(() => {
        if (!exitSent) {
          done(new Error('Agent prompt never appeared'));
        } else {
          done(new Error('Exit command not recognized'));
        }
      }, 5000);
    }, 10000);
    
    it('should handle single character input without confusion', (done) => {
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
      
      let promptSeen = false;
      const commandsSent = [];
      
      agent.stdout.on('data', (data) => {
        output += data.toString();
        
        if (!promptSeen && output.includes('[agent] >')) {
          promptSeen = true;
          // Send single character commands
          agent.stdin.write('h\n');  // help
          commandsSent.push('h');
        }
        
        if (commandsSent.includes('h') && output.includes('Available commands:')) {
          // Help was recognized, now try 's' for status
          if (!commandsSent.includes('s')) {
            agent.stdin.write('s\n');
            commandsSent.push('s');
          }
        }
        
        if (commandsSent.includes('s') && output.includes('Session Status:')) {
          // Both single-char commands worked
          expect(output).toContain('Available commands:');
          expect(output).toContain('Session Status:');
          expect(output).not.toContain('Unknown command: \'h\'');
          expect(output).not.toContain('Unknown command: \'s\'');
          done();
        }
      });
      
      setTimeout(() => {
        done(new Error('Commands not recognized properly'));
      }, 5000);
    }, 10000);
    
    it('should not interpret "exit" as individual characters', (done) => {
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
      
      let promptSeen = false;
      
      agent.stdout.on('data', (data) => {
        output += data.toString();
        
        if (!promptSeen && output.includes('[agent] >')) {
          promptSeen = true;
          // Type "exit" as one command
          agent.stdin.write('exit\n');
        }
        
        // Check that we don't see errors for individual letters
        if (output.includes('Initiating clean shutdown')) {
          expect(output).not.toContain('Unknown command: \'e\'');
          expect(output).not.toContain('Unknown command: \'x\'');
          expect(output).not.toContain('Unknown command: \'i\'');
          expect(output).not.toContain('Unknown command: \'t\'');
          expect(output).not.toContain('Unknown command: \'ex\'');
          expect(output).not.toContain('Unknown command: \'exi\'');
          done();
        }
      });
      
      setTimeout(() => {
        done(new Error('Exit command not processed correctly'));
      }, 5000);
    }, 10000);
  });
  
  describe('Exit Flow', () => {
    it('should handle clean exit with "n" to commit prompt', (done) => {
      // Create a file to have uncommitted changes
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
      
      let promptSeen = false;
      let exitSent = false;
      let commitPromptSeen = false;
      
      agent.stdout.on('data', (data) => {
        output += data.toString();
        
        if (!promptSeen && output.includes('[agent] >')) {
          promptSeen = true;
          agent.stdin.write('exit\n');
          exitSent = true;
        }
        
        if (exitSent && !commitPromptSeen && output.includes('Commit them before exit?')) {
          commitPromptSeen = true;
          // Send 'n' for no
          agent.stdin.write('n\n');
        }
        
        if (commitPromptSeen && output.includes('Goodbye!')) {
          expect(output).toContain('Initiating clean shutdown');
          expect(output).toContain('You have uncommitted changes');
          expect(output).not.toContain('Unknown command: \'n\'');
          done();
        }
      });
      
      agent.on('exit', (code) => {
        expect(code).toBe(0);
      });
      
      setTimeout(() => {
        done(new Error('Exit flow not completed'));
      }, 7000);
    }, 10000);
    
    it('should not confuse exit response with developer initials', (done) => {
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'test content');
      
      agent = fork(agentPath, [], {
        cwd: testDir,
        env: {
          ...process.env,
          AC_MSG_FILE: '.test-commit.msg',
          AC_BRANCH: 'test-branch',
          AC_PUSH: 'false',
          AC_DEBUG: 'false',
          AC_CS_DEVOPS_AGENT_ON_START: 'false',
          AC_BRANCH_PREFIX: 'test_'
        },
        stdio: 'pipe',
        silent: false
      });
      
      const interactions = [];
      
      agent.stdout.on('data', (data) => {
        output += data.toString();
        
        if (output.includes('[agent] >') && !interactions.includes('exit')) {
          interactions.push('exit');
          agent.stdin.write('exit\n');
        }
        
        if (output.includes('Commit them before exit?') && !interactions.includes('n')) {
          interactions.push('n');
          agent.stdin.write('n\n');
        }
      });
      
      agent.on('exit', () => {
        // Verify we never saw developer initials prompt
        expect(output).not.toContain('Developer initials (3 letters):');
        expect(output).not.toContain('Please enter exactly 3 letters');
        expect(output).not.toContain('First-time setup detected');
        
        // Verify exit flow completed
        expect(output).toContain('Goodbye!');
        done();
      });
      
      setTimeout(() => {
        done(new Error('Test timeout'));
      }, 8000);
    }, 10000);
  });
  
  describe('Command Aliases', () => {
    it('should recognize all exit aliases', (done) => {
      const aliases = ['exit', 'quit', 'q'];
      let currentAlias = 0;
      
      function testAlias() {
        if (currentAlias >= aliases.length) {
          done();
          return;
        }
        
        const alias = aliases[currentAlias];
        output = '';
        
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
        
        let promptSeen = false;
        
        agent.stdout.on('data', (data) => {
          output += data.toString();
          
          if (!promptSeen && output.includes('[agent] >')) {
            promptSeen = true;
            agent.stdin.write(alias + '\n');
          }
          
          if (output.includes('Initiating clean shutdown')) {
            expect(output).not.toContain(`Unknown command: '${alias}'`);
            agent.kill();
            currentAlias++;
            setTimeout(testAlias, 500);
          }
        });
        
        setTimeout(() => {
          agent.kill();
          done(new Error(`Alias '${alias}' not recognized`));
        }, 3000);
      }
      
      testAlias();
    }, 15000);
  });
});