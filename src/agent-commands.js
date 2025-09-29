/**
 * Agent Command Monitor
 * Watches for special command files to trigger agent actions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AgentCommandMonitor {
  constructor(sessionId, worktreePath) {
    this.sessionId = sessionId;
    this.worktreePath = worktreePath;
    this.commandFile = path.join(worktreePath, `.devops-command-${sessionId}`);
    this.isClosing = false;
  }

  /**
   * Start monitoring for commands
   */
  startMonitoring() {
    // Check for command file every 5 seconds
    this.interval = setInterval(() => {
      this.checkForCommands();
    }, 5000);
    
    console.log('[agent-commands] Monitoring for special commands...');
    console.log(`[agent-commands] To close session, create: ${path.basename(this.commandFile)} with "CLOSE_SESSION"`);
  }

  /**
   * Check if command file exists and process it
   */
  checkForCommands() {
    if (this.isClosing) return;
    
    if (fs.existsSync(this.commandFile)) {
      try {
        const command = fs.readFileSync(this.commandFile, 'utf8').trim();
        
        // Remove the command file immediately
        fs.unlinkSync(this.commandFile);
        
        // Process the command
        this.processCommand(command);
      } catch (error) {
        console.error('[agent-commands] Error reading command file:', error.message);
      }
    }
  }

  /**
   * Process a command
   */
  processCommand(command) {
    console.log(`[agent-commands] Received command: ${command}`);
    
    switch (command.toUpperCase()) {
      case 'CLOSE_SESSION':
      case 'EXIT':
      case 'QUIT':
        this.handleCloseSession();
        break;
        
      case 'STATUS':
        this.handleStatus();
        break;
        
      case 'PUSH':
        this.handlePush();
        break;
        
      default:
        console.log(`[agent-commands] Unknown command: ${command}`);
    }
  }

  /**
   * Handle close session command
   */
  handleCloseSession() {
    if (this.isClosing) return;
    this.isClosing = true;
    
    console.log('[agent-commands] Initiating session cleanup...');
    
    // Stop monitoring
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    try {
      // 1. Check for uncommitted changes
      const status = execSync(`git status --porcelain`, { 
        cwd: this.worktreePath, 
        encoding: 'utf8' 
      }).trim();
      
      if (status) {
        console.log('[agent-commands] Committing final changes...');
        execSync(`git add -A`, { cwd: this.worktreePath });
        execSync(`git commit -m "chore: session cleanup - final commit"`, { 
          cwd: this.worktreePath,
          stdio: 'pipe' 
        });
      }
      
      // 2. Push any unpushed commits
      console.log('[agent-commands] Pushing changes...');
      const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { 
        cwd: this.worktreePath, 
        encoding: 'utf8' 
      }).trim();
      
      try {
        execSync(`git push origin ${branch}`, { 
          cwd: this.worktreePath,
          stdio: 'pipe' 
        });
        console.log('[agent-commands] Changes pushed successfully');
      } catch (error) {
        console.log('[agent-commands] Push failed or no changes to push');
      }
      
      // 3. Create a cleanup marker file
      const cleanupMarker = path.join(this.worktreePath, '.session-cleanup-requested');
      fs.writeFileSync(cleanupMarker, JSON.stringify({
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        worktree: this.worktreePath
      }, null, 2));
      
      console.log('[agent-commands] ✓ Session cleanup complete');
      console.log('[agent-commands] The worktree has been prepared for removal.');
      console.log('[agent-commands] Run "npm run devops:close" from the main repo to remove the worktree.');
      console.log('[agent-commands] Stopping agent...');
      
      // Exit the agent process
      setTimeout(() => {
        process.exit(0);
      }, 2000);
      
    } catch (error) {
      console.error('[agent-commands] Error during cleanup:', error.message);
      this.isClosing = false;
    }
  }

  /**
   * Handle status command
   */
  handleStatus() {
    try {
      const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { 
        cwd: this.worktreePath, 
        encoding: 'utf8' 
      }).trim();
      
      const status = execSync(`git status --short`, { 
        cwd: this.worktreePath, 
        encoding: 'utf8' 
      });
      
      console.log('[agent-commands] Session Status:');
      console.log(`  Session ID: ${this.sessionId}`);
      console.log(`  Branch: ${branch}`);
      console.log(`  Working directory: ${this.worktreePath}`);
      
      if (status.trim()) {
        console.log('  Uncommitted changes:');
        console.log(status);
      } else {
        console.log('  No uncommitted changes');
      }
    } catch (error) {
      console.error('[agent-commands] Error getting status:', error.message);
    }
  }

  /**
   * Handle push command
   */
  handlePush() {
    try {
      const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { 
        cwd: this.worktreePath, 
        encoding: 'utf8' 
      }).trim();
      
      console.log(`[agent-commands] Pushing branch ${branch}...`);
      execSync(`git push origin ${branch}`, { 
        cwd: this.worktreePath,
        stdio: 'inherit' 
      });
      console.log('[agent-commands] Push complete');
    } catch (error) {
      console.error('[agent-commands] Error pushing:', error.message);
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}

module.exports = AgentCommandMonitor;