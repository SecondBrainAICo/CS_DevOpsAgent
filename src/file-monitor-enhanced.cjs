#!/usr/bin/env node

/**
 * Enhanced File Monitor for Real-time Conflict Detection
 * 
 * Monitors file changes and immediately alerts when:
 * 1. Files are changed without declaration
 * 2. Files are changed that are declared by another agent
 * 3. Provides copy-paste instructions for the coding agent
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const FileCoordinator = require('./file-coordinator.cjs');

class EnhancedFileMonitor {
  constructor(sessionId, workingDir = process.cwd()) {
    this.sessionId = sessionId;
    this.workingDir = workingDir;
    this.coordinator = new FileCoordinator(sessionId, workingDir);
    
    // Track files we've seen changed
    this.changedFiles = new Set();
    this.lastAlertTime = {};
    this.alertCooldown = 30000; // 30 seconds between alerts for same file
    
    // Track our declared files
    this.ourDeclaredFiles = new Set();
    this.lastDeclarationCheck = 0;
  }

  /**
   * Get current git status and detect changes
   */
  async detectChanges() {
    try {
      // Get modified files
      const modifiedFiles = execSync('git diff --name-only', {
        cwd: this.workingDir,
        encoding: 'utf8'
      }).trim().split('\n').filter(f => f);
      
      const stagedFiles = execSync('git diff --cached --name-only', {
        cwd: this.workingDir,
        encoding: 'utf8'
      }).trim().split('\n').filter(f => f);
      
      const allChangedFiles = [...new Set([...modifiedFiles, ...stagedFiles])];
      
      // Check for new changes
      for (const file of allChangedFiles) {
        if (!this.changedFiles.has(file)) {
          // New file change detected!
          this.changedFiles.add(file);
          await this.handleFileChange(file);
        }
      }
      
      // Clean up files that are no longer changed
      for (const file of this.changedFiles) {
        if (!allChangedFiles.includes(file)) {
          this.changedFiles.delete(file);
        }
      }
      
      return allChangedFiles;
      
    } catch (err) {
      // No changes or git error
      return [];
    }
  }

  /**
   * Handle a newly detected file change
   */
  async handleFileChange(file) {
    console.log(`\n📝 File change detected: ${file}`);
    
    // Update our declared files list
    await this.updateOurDeclaredFiles();
    
    // Check if this file was declared by us
    if (this.ourDeclaredFiles.has(file)) {
      console.log(`✅ File properly declared by this session`);
      return;
    }
    
    // Check if file is declared by another agent
    const conflicts = this.coordinator.checkFilesForConflicts([file]);
    
    if (conflicts.length > 0) {
      // File is being edited by another agent!
      await this.alertConflict(file, conflicts[0]);
    } else {
      // File was not declared at all!
      await this.alertUndeclared(file);
    }
  }

  /**
   * Update our list of declared files
   */
  async updateOurDeclaredFiles() {
    const now = Date.now();
    
    // Only check every 5 seconds to avoid excessive reads
    if (now - this.lastDeclarationCheck < 5000) {
      return;
    }
    
    this.lastDeclarationCheck = now;
    this.ourDeclaredFiles.clear();
    
    const ourDeclaration = this.coordinator.findOurDeclaration();
    if (ourDeclaration) {
      try {
        const content = fs.readFileSync(ourDeclaration, 'utf8');
        const declaration = JSON.parse(content);
        (declaration.files || []).forEach(f => this.ourDeclaredFiles.add(f));
      } catch (err) {
        // Invalid declaration
      }
    }
  }

  /**
   * Alert user about undeclared file edit
   */
  async alertUndeclared(file) {
    // Check cooldown
    const lastAlert = this.lastAlertTime[file] || 0;
    if (Date.now() - lastAlert < this.alertCooldown) {
      return;
    }
    
    this.lastAlertTime[file] = Date.now();
    
    console.log('\n' + '⚠️'.repeat(30));
    console.log('⚠️  UNDECLARED FILE EDIT DETECTED!');
    console.log('⚠️'.repeat(30));
    
    console.log(`\n❌ File "${file}" was modified WITHOUT declaration!`);
    console.log('\n📋 COPY THIS INSTRUCTION TO YOUR CODING AGENT:');
    console.log('─'.repeat(60));
    
    // Generate instruction for the agent
    const instruction = `
STOP! You are editing files without declaring them first.

You MUST follow the file coordination protocol:

1. BEFORE editing "${file}", create this declaration:

\`\`\`json
// Save to: .file-coordination/active-edits/agent-${this.sessionId}.json
{
  "agent": "YOUR_AGENT_NAME",
  "session": "${this.sessionId}",
  "files": ["${file}"],
  "operation": "edit",
  "reason": "Describe what you're doing",
  "declaredAt": "${new Date().toISOString()}",
  "estimatedDuration": 300
}
\`\`\`

2. Check if any other agent has declared this file:
   - Look in .file-coordination/active-edits/ for other agents' declarations
   - If the file appears in another declaration, WAIT or choose a different file

3. Only proceed with editing after declaring and confirming no conflicts

This prevents merge conflicts and wasted work!`;
    
    console.log(instruction);
    console.log('─'.repeat(60));
    
    // Also save to a file the user can easily access
    const alertFile = path.join(this.workingDir, `.coordination-alert-${Date.now()}.md`);
    fs.writeFileSync(alertFile, `# File Coordination Alert\n\n${instruction}`);
    
    console.log(`\n💾 Full instructions saved to: ${alertFile}`);
    console.log('⚠️'.repeat(30) + '\n');
  }

  /**
   * Alert user about conflict with another agent
   */
  async alertConflict(file, conflict) {
    // Check cooldown
    const lastAlert = this.lastAlertTime[file] || 0;
    if (Date.now() - lastAlert < this.alertCooldown) {
      return;
    }
    
    this.lastAlertTime[file] = Date.now();
    
    console.log('\n' + '🚫'.repeat(30));
    console.log('🚫  FILE CONFLICT DETECTED!');
    console.log('🚫'.repeat(30));
    
    console.log(`\n❌ File "${file}" is being edited by: ${conflict.conflictsWith}`);
    console.log(`   Session: ${conflict.session}`);
    console.log(`   Since: ${conflict.declaredAt}`);
    console.log(`   Reason: ${conflict.reason}`);
    
    console.log('\n📋 COPY THIS INSTRUCTION TO YOUR CODING AGENT:');
    console.log('─'.repeat(60));
    
    const instruction = `
STOP! File conflict detected.

The file "${file}" is currently being edited by another agent:
- Agent: ${conflict.conflictsWith}
- Session: ${conflict.session}
- Reason: ${conflict.reason}

You have three options:

1. WAIT for the other agent to complete and release the file
2. CHOOSE a different file to edit instead
3. COORDINATE with the other agent (not recommended)

DO NOT continue editing this file as it will cause merge conflicts.

To check when the file is available:
\`\`\`bash
ls -la .file-coordination/active-edits/
# Look for when ${conflict.conflictsWith}'s declaration is removed
\`\`\`

To work on different files instead:
1. Revert changes to "${file}"
2. Choose alternative files
3. Declare the new files before editing them`;
    
    console.log(instruction);
    console.log('─'.repeat(60));
    
    // Save alert
    const alertFile = path.join(this.workingDir, `.coordination-conflict-${Date.now()}.md`);
    fs.writeFileSync(alertFile, `# File Conflict Alert\n\n${instruction}`);
    
    console.log(`\n💾 Full instructions saved to: ${alertFile}`);
    console.log('🚫'.repeat(30) + '\n');
  }

  /**
   * Start monitoring for file changes
   */
  async startMonitoring(intervalMs = 2000) {
    console.log('🔍 Enhanced file monitoring started');
    console.log(`   Session: ${this.sessionId}`);
    console.log(`   Checking every ${intervalMs/1000} seconds for undeclared changes`);
    console.log('─'.repeat(60));
    
    // Initial check
    await this.detectChanges();
    
    // Set up periodic monitoring
    this.monitorInterval = setInterval(async () => {
      await this.detectChanges();
    }, intervalMs);
    
    // Also monitor declaration directory for changes
    this.watchDeclarations();
  }

  /**
   * Watch for changes in declarations
   */
  watchDeclarations() {
    const declDir = path.join(this.workingDir, '.file-coordination/active-edits');
    
    // Ensure directory exists
    if (!fs.existsSync(declDir)) {
      fs.mkdirSync(declDir, { recursive: true });
    }
    
    // Watch for new/removed declarations
    try {
      fs.watch(declDir, async (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          console.log(`\n📁 Declaration change: ${eventType} ${filename}`);
          
          // Re-check our current changed files
          for (const file of this.changedFiles) {
            await this.handleFileChange(file);
          }
        }
      });
    } catch (err) {
      console.error('Could not watch declarations directory:', err.message);
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      console.log('🛑 File monitoring stopped');
    }
  }
}

// Export for use in DevOps agent
module.exports = EnhancedFileMonitor;

// If run directly, start monitoring
if (require.main === module) {
  const sessionId = process.env.DEVOPS_SESSION_ID || 'manual-monitor';
  const monitor = new EnhancedFileMonitor(sessionId);
  
  monitor.startMonitoring(2000);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down monitor...');
    monitor.stopMonitoring();
    process.exit(0);
  });
}