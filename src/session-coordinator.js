#!/usr/bin/env node

/**
 * ============================================================================
 * SESSION COORDINATOR - Foolproof Claude/Agent Handshake System
 * ============================================================================
 * 
 * This coordinator ensures Claude/Cline and DevOps agents work in sync.
 * It generates instructions for Claude and manages session allocation.
 * 
 * WORKFLOW:
 * 1. Start DevOps agent → generates session & instructions
 * 2. Copy instructions to Claude/Cline
 * 3. Claude follows instructions to use correct worktree
 * 4. Agent monitors that worktree for changes
 * 
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn, fork } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  sessionsDir: 'local_deploy/sessions',
  locksDir: 'local_deploy/session-locks',
  worktreesDir: 'local_deploy/worktrees',
  instructionsDir: 'local_deploy/instructions',
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m'
  }
};

// ============================================================================
// SESSION COORDINATOR CLASS
// ============================================================================

class SessionCoordinator {
  constructor() {
    this.repoRoot = this.getRepoRoot();
    this.sessionsPath = path.join(this.repoRoot, CONFIG.sessionsDir);
    this.locksPath = path.join(this.repoRoot, CONFIG.locksDir);
    this.worktreesPath = path.join(this.repoRoot, CONFIG.worktreesDir);
    this.instructionsPath = path.join(this.repoRoot, CONFIG.instructionsDir);
    
    // Store user settings in home directory for cross-project usage
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    this.globalSettingsDir = path.join(homeDir, '.devops-agent');
    this.globalSettingsPath = path.join(this.globalSettingsDir, 'settings.json');
    
    // Store project-specific settings in local_deploy
    this.projectSettingsPath = path.join(this.repoRoot, 'local_deploy', 'project-settings.json');
    
    this.ensureDirectories();
    this.cleanupStaleLocks();
    this.ensureSettingsFile();
    // DO NOT call ensureDeveloperInitials here - it should only be called when creating new sessions
  }

  getRepoRoot() {
    try {
      return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error('Error: Not in a git repository');
      process.exit(1);
    }
  }

  ensureDirectories() {
    // Ensure local project directories
    [this.sessionsPath, this.locksPath, this.worktreesPath, this.instructionsPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Ensure global settings directory in home folder
    if (!fs.existsSync(this.globalSettingsDir)) {
      fs.mkdirSync(this.globalSettingsDir, { recursive: true });
    }
  }

  cleanupStaleLocks() {
    // Clean up locks older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    
    if (fs.existsSync(this.locksPath)) {
      const locks = fs.readdirSync(this.locksPath);
      locks.forEach(lockFile => {
        const lockPath = path.join(this.locksPath, lockFile);
        const stats = fs.statSync(lockPath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(lockPath);
          console.log(`${CONFIG.colors.dim}Cleaned stale lock: ${lockFile}${CONFIG.colors.reset}`);
        }
      });
    }
  }
  
  /**
   * Ensure developer initials are configured
   */
  async ensureDeveloperInitials() {
    const settings = this.loadSettings();
    
    if (!settings.developerInitials || !settings.configured) {
      console.log(`\n${CONFIG.colors.yellow}First-time DevOps Agent setup!${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.bright}Please enter your 3-letter developer initials${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.dim}(These will be used in branch names to identify your work across all projects)${CONFIG.colors.reset}`);
      
      const initials = await this.promptForInitials();
      settings.developerInitials = initials.toLowerCase();
      
      // Also ask for starting version if not configured
      if (!settings.versioningStrategy.configured) {
        const versionInfo = await this.promptForStartingVersion();
        settings.versioningStrategy.prefix = versionInfo.prefix;
        settings.versioningStrategy.startMinor = versionInfo.startMinor;
        settings.versioningStrategy.configured = true;
        
        // Set environment variables for the current session
        process.env.AC_VERSION_PREFIX = versionInfo.prefix;
        process.env.AC_VERSION_START_MINOR = versionInfo.startMinor.toString();
      }
      
      settings.configured = true;
      this.saveSettings(settings);
      
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Developer initials saved: ${CONFIG.colors.bright}${initials}${CONFIG.colors.reset}`);
      if (settings.versioningStrategy.prefix) {
        console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Starting version: ${CONFIG.colors.bright}${settings.versioningStrategy.prefix}${settings.versioningStrategy.startMinor}${CONFIG.colors.reset}`);
      }
      console.log(`${CONFIG.colors.dim}Your initials are saved globally and will be used across all projects${CONFIG.colors.reset}`);
    } else {
      // Settings already configured, set environment variables
      if (settings.versioningStrategy.configured) {
        process.env.AC_VERSION_PREFIX = settings.versioningStrategy.prefix;
        process.env.AC_VERSION_START_MINOR = settings.versioningStrategy.startMinor.toString();
      }
    }
  }
  
  /**
   * Get developer initials from settings (no prompting)
   */
  getDeveloperInitials() {
    const settings = this.loadSettings();
    // Never prompt here, just return default if not configured
    return settings.developerInitials || 'dev';
  }
  
  /**
   * Ensure settings files exist
   */
  ensureSettingsFile() {
    // Create global settings if not exists
    if (!fs.existsSync(this.globalSettingsPath)) {
      const defaultGlobalSettings = {
        developerInitials: "",
        email: "",
        preferences: {
          defaultTargetBranch: "main",
          pushOnCommit: true,
          verboseLogging: false
        },
        configured: false
      };
      fs.writeFileSync(this.globalSettingsPath, JSON.stringify(defaultGlobalSettings, null, 2));
      console.log(`${CONFIG.colors.dim}Created global settings at ~/.devops-agent/settings.json${CONFIG.colors.reset}`);
    }
    
    // Create project settings if not exists
    if (!fs.existsSync(this.projectSettingsPath)) {
      const defaultProjectSettings = {
        versioningStrategy: {
          prefix: "v0.",
          startMinor: 20,
          configured: false
        },
        autoMergeConfig: {
          enabled: false,
          targetBranch: "main",
          strategy: "pull-request"
        }
      };
      const projectDir = path.dirname(this.projectSettingsPath);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      fs.writeFileSync(this.projectSettingsPath, JSON.stringify(defaultProjectSettings, null, 2));
    }
  }
  
  /**
   * Load global settings (user-specific)
   */
  loadGlobalSettings() {
    if (fs.existsSync(this.globalSettingsPath)) {
      return JSON.parse(fs.readFileSync(this.globalSettingsPath, 'utf8'));
    }
    return {
      developerInitials: "",
      email: "",
      preferences: {},
      configured: false
    };
  }
  
  /**
   * Load project settings
   */
  loadProjectSettings() {
    if (fs.existsSync(this.projectSettingsPath)) {
      return JSON.parse(fs.readFileSync(this.projectSettingsPath, 'utf8'));
    }
    return {
      versioningStrategy: {
        prefix: "v0.",
        startMinor: 20,
        configured: false
      },
      autoMergeConfig: {}
    };
  }
  
  /**
   * Combined settings loader for compatibility
   */
  loadSettings() {
    const global = this.loadGlobalSettings();
    const project = this.loadProjectSettings();
    return {
      ...global,
      ...project,
      developerInitials: global.developerInitials,
      configured: global.configured
    };
  }
  
  /**
   * Save global settings
   */
  saveGlobalSettings(settings) {
    fs.writeFileSync(this.globalSettingsPath, JSON.stringify(settings, null, 2));
    console.log(`${CONFIG.colors.dim}Global settings saved to ~/.devops-agent/settings.json${CONFIG.colors.reset}`);
  }
  
  /**
   * Save project settings
   */
  saveProjectSettings(settings) {
    const projectDir = path.dirname(this.projectSettingsPath);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    fs.writeFileSync(this.projectSettingsPath, JSON.stringify(settings, null, 2));
    console.log(`${CONFIG.colors.dim}Project settings saved to local_deploy/project-settings.json${CONFIG.colors.reset}`);
  }
  
  /**
   * Save settings (splits between global and project)
   */
  saveSettings(settings) {
    // Split settings into global and project
    const globalSettings = {
      developerInitials: settings.developerInitials,
      email: settings.email || "",
      preferences: settings.preferences || {},
      configured: settings.configured
    };
    
    const projectSettings = {
      versioningStrategy: settings.versioningStrategy,
      autoMergeConfig: settings.autoMergeConfig || {}
    };
    
    this.saveGlobalSettings(globalSettings);
    this.saveProjectSettings(projectSettings);
  }
  
  /**
   * Prompt for developer initials
   */
  promptForInitials() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      const askInitials = () => {
        rl.question('Developer initials (3 letters): ', (answer) => {
          const initials = answer.trim();
          if (initials.length !== 3) {
            console.log(`${CONFIG.colors.red}Please enter exactly 3 letters${CONFIG.colors.reset}`);
            askInitials();
          } else if (!/^[a-zA-Z]+$/.test(initials)) {
            console.log(`${CONFIG.colors.red}Please use only letters${CONFIG.colors.reset}`);
            askInitials();
          } else {
            rl.close();
            resolve(initials);
          }
        });
      };
      askInitials();
    });
  }
  
  /**
   * Get list of available branches
   */
  getAvailableBranches() {
    try {
      const result = execSync('git branch -a --format="%(refname:short)"', { 
        cwd: this.repoRoot,
        encoding: 'utf8' 
      });
      
      return result.split('\n')
        .filter(branch => branch.trim())
        .filter(branch => !branch.includes('HEAD'))
        .map(branch => branch.replace('origin/', ''));
    } catch (error) {
      return ['main', 'develop', 'master'];
    }
  }
  
  /**
   * Prompt for merge configuration
   */
  async promptForMergeConfig() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`\n${CONFIG.colors.yellow}═══ Auto-merge Configuration ═══${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}(Automatically merge today's work into a target branch)${CONFIG.colors.reset}`);
    
    // Ask if they want auto-merge
    const autoMerge = await new Promise((resolve) => {
      rl.question('\nEnable auto-merge at end of day? (y/N): ', (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    
    if (!autoMerge) {
      rl.close();
      console.log(`${CONFIG.colors.dim}Auto-merge disabled. You'll need to manually merge your work.${CONFIG.colors.reset}`);
      return { autoMerge: false };
    }
    
    // Get available branches
    const branches = this.getAvailableBranches();
    const uniqueBranches = [...new Set(branches)].slice(0, 10); // Show max 10 branches
    
    console.log(`\n${CONFIG.colors.bright}Which branch should today's work be merged INTO?${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}(e.g., main, develop, v2.0, feature/xyz)${CONFIG.colors.reset}\n`);
    
    console.log(`${CONFIG.colors.bright}Available branches:${CONFIG.colors.reset}`);
    uniqueBranches.forEach((branch, index) => {
      const isDefault = branch === 'main' || branch === 'master' || branch === 'develop';
      const marker = isDefault ? ` ${CONFIG.colors.green}⭐ (recommended)${CONFIG.colors.reset}` : '';
      console.log(`  ${index + 1}) ${branch}${marker}`);
    });
    console.log(`  0) Enter a different branch name`);
    
    // Ask for target branch
    const targetBranch = await new Promise((resolve) => {
      rl.question(`\nSelect target branch to merge INTO (1-${uniqueBranches.length}, or 0): `, async (answer) => {
        const choice = parseInt(answer);
        if (choice === 0) {
          rl.question('Enter custom branch name: ', (customBranch) => {
            resolve(customBranch.trim());
          });
        } else if (choice >= 1 && choice <= uniqueBranches.length) {
          resolve(uniqueBranches[choice - 1]);
        } else {
          resolve('main'); // Default to main if invalid choice
        }
      });
    });
    
    // Ask for merge strategy
    console.log(`\n${CONFIG.colors.bright}Merge strategy:${CONFIG.colors.reset}`);
    console.log(`  1) Create pull request (recommended)`);
    console.log(`  2) Direct merge (when tests pass)`);
    console.log(`  3) Squash and merge`);
    
    const strategy = await new Promise((resolve) => {
      rl.question('Select merge strategy (1-3) [1]: ', (answer) => {
        const choice = parseInt(answer) || 1;
        switch(choice) {
          case 2:
            resolve('direct');
            break;
          case 3:
            resolve('squash');
            break;
          default:
            resolve('pull-request');
        }
      });
    });
    
    rl.close();
    
    const config = {
      autoMerge: true,
      targetBranch,
      strategy,
      requireTests: strategy !== 'pull-request'
    };
    
    console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Auto-merge configuration saved:`);
    console.log(`  ${CONFIG.colors.bright}Today's work${CONFIG.colors.reset} → ${CONFIG.colors.bright}${targetBranch}${CONFIG.colors.reset}`);
    console.log(`  Strategy: ${CONFIG.colors.bright}${strategy}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}  (Daily branches will be merged into ${targetBranch} at end of day)${CONFIG.colors.reset}`);
    
    return config;
  }
  
  /**
   * Prompt for starting version configuration
   */
  async promptForStartingVersion() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`\n${CONFIG.colors.yellow}Version Configuration${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Set the starting version for this codebase${CONFIG.colors.reset}`);
    
    // Ask if inheriting existing codebase
    const isInherited = await new Promise((resolve) => {
      rl.question('\nIs this an existing/inherited codebase? (y/N): ', (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    
    let prefix = 'v0.';
    let startMinor = 20; // Default v0.20
    
    if (isInherited) {
      console.log(`\n${CONFIG.colors.bright}Current Version Examples:${CONFIG.colors.reset}`);
      console.log('  v1.5  → Enter: v1. and 50');
      console.log('  v2.3  → Enter: v2. and 30');
      console.log('  v0.8  → Enter: v0. and 80');
      console.log('  v3.12 → Enter: v3. and 120');
      
      // Get version prefix
      prefix = await new Promise((resolve) => {
        rl.question('\nEnter version prefix (e.g., v1., v2., v0.) [v0.]: ', (answer) => {
          const cleaned = answer.trim() || 'v0.';
          // Ensure it ends with a dot
          resolve(cleaned.endsWith('.') ? cleaned : cleaned + '.');
        });
      });
      
      // Get starting minor version
      const currentVersion = await new Promise((resolve) => {
        rl.question(`Current version number (e.g., for ${prefix}5 enter 50, for ${prefix}12 enter 120) [20]: `, (answer) => {
          const num = parseInt(answer.trim());
          resolve(isNaN(num) ? 20 : num);
        });
      });
      
      // Next version will be current + 1
      startMinor = currentVersion + 1;
      
      console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Next version will be: ${CONFIG.colors.bright}${prefix}${startMinor}${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.dim}(This represents ${prefix}${(startMinor/100).toFixed(2)} in semantic versioning)${CONFIG.colors.reset}`);
    } else {
      // New project
      console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Starting new project at: ${CONFIG.colors.bright}v0.20${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.dim}(Daily increments: v0.20 → v0.21 → v0.22...)${CONFIG.colors.reset}`);
    }
    
    rl.close();
    
    return {
      prefix,
      startMinor
    };
  }

  generateSessionId() {
    const timestamp = Date.now().toString(36).slice(-4);
    const random = crypto.randomBytes(2).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * Create a new session and generate Claude instructions
   */
  async createSession(options = {}) {
    // Ensure developer initials are configured before creating a session
    await this.ensureDeveloperInitials();
    
    const sessionId = this.generateSessionId();
    const task = options.task || 'development';
    const agentType = options.agent || 'claude';
    const devInitials = this.getDeveloperInitials();
    
    console.log(`\n${CONFIG.colors.bgBlue}${CONFIG.colors.bright} Creating New Session ${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.blue}Session ID:${CONFIG.colors.reset} ${CONFIG.colors.bright}${sessionId}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.blue}Task:${CONFIG.colors.reset} ${task}`);
    console.log(`${CONFIG.colors.blue}Agent:${CONFIG.colors.reset} ${agentType}`);
    console.log(`${CONFIG.colors.blue}Developer:${CONFIG.colors.reset} ${devInitials}`);
    
    // Ask for auto-merge configuration
    const mergeConfig = await this.promptForMergeConfig();
    
    // Create worktree with developer initials in the name
    const worktreeName = `${agentType}-${devInitials}-${sessionId}-${task.replace(/\s+/g, '-')}`;
    const worktreePath = path.join(this.worktreesPath, worktreeName);
    const branchName = `${agentType}/${devInitials}/${sessionId}/${task.replace(/\s+/g, '-')}`;
    
    try {
      // Create worktree
      console.log(`\n${CONFIG.colors.yellow}Creating worktree...${CONFIG.colors.reset}`);
      execSync(`git worktree add -b ${branchName} "${worktreePath}" HEAD`, { stdio: 'pipe' });
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Worktree created at: ${worktreePath}`);
      
      // Create session lock
      const lockData = {
        sessionId,
        agentType,
        task,
        worktreePath,
        branchName,
        created: new Date().toISOString(),
        status: 'active',
        pid: process.pid,
        developerInitials: devInitials,
        mergeConfig: mergeConfig
      };
      
      const lockFile = path.join(this.locksPath, `${sessionId}.lock`);
      fs.writeFileSync(lockFile, JSON.stringify(lockData, null, 2));
      
      // Generate Claude instructions
      const instructions = this.generateClaudeInstructions(lockData);
      
      // Save instructions to file
      const instructionsFile = path.join(this.instructionsPath, `${sessionId}.md`);
      fs.writeFileSync(instructionsFile, instructions.markdown);
      
      // Display instructions
      this.displayInstructions(instructions, sessionId, task);
      
      // Create session config in worktree
      this.createWorktreeConfig(worktreePath, lockData);
      
      return {
        sessionId,
        worktreePath,
        branchName,
        lockFile,
        instructionsFile,
        instructions: instructions.plaintext
      };
      
    } catch (error) {
      console.error(`${CONFIG.colors.red}Failed to create session: ${error.message}${CONFIG.colors.reset}`);
      process.exit(1);
    }
  }

  /**
   * Generate instructions for Claude/Cline
   */
  generateClaudeInstructions(sessionData) {
    const { sessionId, worktreePath, branchName, task } = sessionData;
    
    const plaintext = `
SESSION_ID: ${sessionId}
WORKTREE: ${worktreePath}
BRANCH: ${branchName}
TASK: ${task}

INSTRUCTIONS:
1. Change to worktree directory: cd "${worktreePath}"
2. Verify branch: git branch --show-current
3. Make your changes for: ${task}
4. Write commit message to: .devops-commit-${sessionId}.msg
5. The DevOps agent will auto-commit and push your changes
`;

    const markdown = `# DevOps Session Instructions

## Session Information
- **Session ID:** \`${sessionId}\`
- **Task:** ${task}
- **Worktree Path:** \`${worktreePath}\`
- **Branch:** \`${branchName}\`

## Instructions for Claude/Cline

### Step 1: Navigate to Your Worktree
\`\`\`bash
cd "${worktreePath}"
\`\`\`

### Step 2: Verify You're on the Correct Branch
\`\`\`bash
git branch --show-current
# Should output: ${branchName}
\`\`\`

### Step 3: Work on Your Task
Make changes for: **${task}**

### Step 4: Commit Your Changes
Write your commit message to the session-specific file:
\`\`\`bash
echo "feat: your commit message here" > .devops-commit-${sessionId}.msg
\`\`\`

### Step 5: Automatic Processing
The DevOps agent will automatically:
- Detect your changes
- Read your commit message
- Commit and push to the remote repository
- Clear the message file

## Session Status
- Created: ${new Date().toISOString()}
- Status: Active
- Agent: Monitoring

## Important Notes
- All changes should be made in the worktree directory
- Do not switch branches manually
- The agent is watching for changes in this specific worktree
`;

    const shellCommand = `cd "${worktreePath}" && echo "Session ${sessionId} ready"`;

    return {
      plaintext,
      markdown,
      shellCommand,
      worktreePath,
      sessionId
    };
  }

  /**
   * Display instructions in a user-friendly format
   */
  displayInstructions(instructions, sessionId, task) {
    console.log(`\n${CONFIG.colors.bgGreen}${CONFIG.colors.bright} Instructions for Claude/Cline ${CONFIG.colors.reset}\n`);
    
    // Clean separator
    console.log(`${CONFIG.colors.yellow}══════════════════════════════════════════════════════════════${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.bright}COPY AND PASTE THIS ENTIRE BLOCK INTO CLAUDE BEFORE YOUR PROMPT:${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.yellow}──────────────────────────────────────────────────────────────${CONFIG.colors.reset}`);
    console.log();
    
    // The actual copyable content - no colors inside
    console.log(`I'm working in a DevOps-managed session with the following setup:`);
    console.log(`- Session ID: ${sessionId}`);
    console.log(`- Working Directory: ${instructions.worktreePath}`);
    console.log(`- Task: ${task || 'development'}`);
    console.log(``);
    console.log(`Please switch to this directory before making any changes:`);
    console.log(`cd "${instructions.worktreePath}"`);
    console.log(``);
    console.log(`Write commit messages to: .devops-commit-${sessionId}.msg`);
    console.log(`The DevOps agent will automatically commit and push changes.`);
    console.log();
    
    console.log(`${CONFIG.colors.yellow}══════════════════════════════════════════════════════════════${CONFIG.colors.reset}`);
    
    // Status info
    console.log(`\n${CONFIG.colors.green}✓ DevOps agent is starting...${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Full instructions saved to: ${CONFIG.instructionsDir}/${sessionId}.md${CONFIG.colors.reset}`);
  }

  /**
   * Create configuration in the worktree
   */
  createWorktreeConfig(worktreePath, sessionData) {
    // Session config file
    const configPath = path.join(worktreePath, '.devops-session.json');
    fs.writeFileSync(configPath, JSON.stringify(sessionData, null, 2));
    
    // Commit message file
    const msgFile = path.join(worktreePath, `.devops-commit-${sessionData.sessionId}.msg`);
    fs.writeFileSync(msgFile, '');
    
    // VS Code settings
    const vscodeDir = path.join(worktreePath, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
    
    const settings = {
      'window.title': `${sessionData.agentType.toUpperCase()} Session ${sessionData.sessionId} - ${sessionData.task}`,
      'terminal.integrated.env.osx': {
        'DEVOPS_SESSION_ID': sessionData.sessionId,
        'DEVOPS_WORKTREE': path.basename(worktreePath),
        'DEVOPS_BRANCH': sessionData.branchName,
        'AC_MSG_FILE': `.devops-commit-${sessionData.sessionId}.msg`,
        'AC_BRANCH_PREFIX': `${sessionData.agentType}_${sessionData.sessionId}_`
      }
    };
    
    fs.writeFileSync(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );
    
    // Create a README for the session
    const readme = `# DevOps Session: ${sessionData.sessionId}

## Task
${sessionData.task}

## Session Details
- **Session ID:** ${sessionData.sessionId}
- **Branch:** ${sessionData.branchName}
- **Created:** ${sessionData.created}
- **Agent Type:** ${sessionData.agentType}

## How to Use
1. Make your changes in this directory
2. Write commit message to: \`.devops-commit-${sessionData.sessionId}.msg\`
3. The DevOps agent will handle the rest

## Status
The DevOps agent is monitoring this worktree for changes.
`;
    
    fs.writeFileSync(path.join(worktreePath, 'SESSION_README.md'), readme);
    
    // Auto-commit session files to prevent rollover issues
    // This prevents "uncommitted changes" blocking daily branch creation
    try {
      execSync('git add .devops-session.json SESSION_README.md .devops-commit-*.msg .vscode/settings.json', { 
        cwd: worktreePath,
        stdio: 'pipe' 
      });
      
      execSync(`git commit -m "chore: initialize session ${sessionData.sessionId}\n\nAuto-commit session configuration files:\n- Session config (.devops-session.json)\n- Session README (SESSION_README.md)\n- Empty commit message file\n- VS Code settings\n\nTask: ${sessionData.task}\nAgent: ${sessionData.agentType}"`, {
        cwd: worktreePath,
        stdio: 'pipe'
      });
      
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Session files committed to prevent rollover blocks`);
    } catch (error) {
      // If commit fails, it might be because files haven't changed
      console.log(`${CONFIG.colors.dim}Session files not committed (may already exist)${CONFIG.colors.reset}`);
    }
  }

  /**
   * Request a session (for Claude to call)
   */
  async requestSession(agentName = 'claude') {
    console.log(`\n${CONFIG.colors.magenta}[${agentName.toUpperCase()}]${CONFIG.colors.reset} Requesting session...`);
    
    // Check for available unlocked sessions
    const availableSession = this.findAvailableSession();
    
    if (availableSession) {
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Found available session: ${availableSession.sessionId}`);
      return this.claimSession(availableSession, agentName);
    } else {
      console.log(`${CONFIG.colors.yellow}No available sessions. Creating new one...${CONFIG.colors.reset}`);
      const task = await this.promptForTask();
      return this.createSession({ task, agent: agentName });
    }
  }

  /**
   * Find an available unclaimed session
   */
  findAvailableSession() {
    if (!fs.existsSync(this.locksPath)) {
      return null;
    }
    
    const locks = fs.readdirSync(this.locksPath);
    
    for (const lockFile of locks) {
      const lockPath = path.join(this.locksPath, lockFile);
      const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      
      // Check if session is available (not claimed)
      if (lockData.status === 'waiting' && !lockData.claimedBy) {
        return lockData;
      }
    }
    
    return null;
  }

  /**
   * Claim a session for an agent
   */
  claimSession(session, agentName) {
    session.claimedBy = agentName;
    session.claimedAt = new Date().toISOString();
    session.status = 'active';
    
    const lockFile = path.join(this.locksPath, `${session.sessionId}.lock`);
    fs.writeFileSync(lockFile, JSON.stringify(session, null, 2));
    
    const instructions = this.generateClaudeInstructions(session);
    this.displayInstructions(instructions, session.sessionId, session.task);
    
    return {
      ...session,
      instructions: instructions.plaintext
    };
  }

  /**
   * Start the DevOps agent for a session
   */
  async startAgent(sessionId, options = {}) {
    const lockFile = path.join(this.locksPath, `${sessionId}.lock`);
    
    if (!fs.existsSync(lockFile)) {
      console.error(`${CONFIG.colors.red}Session not found: ${sessionId}${CONFIG.colors.reset}`);
      return;
    }
    
    const sessionData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    
    console.log(`\n${CONFIG.colors.bgYellow}${CONFIG.colors.bright} Starting DevOps Agent ${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.blue}Session:${CONFIG.colors.reset} ${sessionId}`);
    console.log(`${CONFIG.colors.blue}Worktree:${CONFIG.colors.reset} ${sessionData.worktreePath}`);
    console.log(`${CONFIG.colors.blue}Branch:${CONFIG.colors.reset} ${sessionData.branchName}`);
    
    // Update session status
    sessionData.agentStarted = new Date().toISOString();
    sessionData.agentPid = process.pid;
    fs.writeFileSync(lockFile, JSON.stringify(sessionData, null, 2));
    
    // Get developer initials from session data or settings (NO PROMPTING HERE)
    const devInitials = sessionData.developerInitials || this.getDeveloperInitials() || 'dev';
    const settings = this.loadSettings();
    const projectSettings = this.loadProjectSettings();
    
    // Start the agent
    const env = {
      ...process.env,
      DEVOPS_SESSION_ID: sessionId,
      AC_MSG_FILE: `.devops-commit-${sessionId}.msg`,
      AC_BRANCH_PREFIX: `${sessionData.agentType}_${devInitials}_${sessionId}_`,
      AC_WORKING_DIR: sessionData.worktreePath,
      // Don't set AC_BRANCH - let the agent create daily branches within the worktree
      // AC_BRANCH would force a static branch, preventing daily/weekly rollover
      AC_PUSH: 'true',  // Enable auto-push for session branches
      AC_DAILY_PREFIX: `${sessionData.agentType}_${devInitials}_${sessionId}_`,  // Daily branches with dev initials
      AC_TZ: process.env.AC_TZ || 'Asia/Dubai',  // Preserve timezone for daily branches
      AC_DATE_STYLE: process.env.AC_DATE_STYLE || 'dash',  // Preserve date style
      // Apply version configuration if set
      ...(projectSettings.versioningStrategy?.prefix && { AC_VERSION_PREFIX: projectSettings.versioningStrategy.prefix }),
      ...(projectSettings.versioningStrategy?.startMinor && { AC_VERSION_START_MINOR: projectSettings.versioningStrategy.startMinor.toString() })
    };
    
    const agentScript = path.join(__dirname, 'cs-devops-agent-worker.js');
    
    console.log(`\n${CONFIG.colors.green}Agent starting...${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Monitoring: ${sessionData.worktreePath}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Message file: .devops-commit-${sessionId}.msg${CONFIG.colors.reset}`);
    
    // Use fork for better Node.js script handling
    // Fork automatically uses the same node executable and handles paths better
    const child = fork(agentScript, [], {
      cwd: sessionData.worktreePath,
      env,
      stdio: 'inherit',
      silent: false
    });
    
    child.on('exit', (code) => {
      console.log(`${CONFIG.colors.yellow}Agent exited with code: ${code}${CONFIG.colors.reset}`);
      
      // Update session status
      sessionData.agentStopped = new Date().toISOString();
      sessionData.status = 'stopped';
      fs.writeFileSync(lockFile, JSON.stringify(sessionData, null, 2));
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(`\n${CONFIG.colors.yellow}Stopping agent...${CONFIG.colors.reset}`);
      child.kill('SIGINT');
      setTimeout(() => process.exit(0), 1000);
    });
  }

  /**
   * List all sessions
   */
  listSessions() {
    console.log(`\n${CONFIG.colors.bright}Active Sessions:${CONFIG.colors.reset}`);
    
    if (!fs.existsSync(this.locksPath)) {
      console.log('No active sessions');
      return;
    }
    
    const locks = fs.readdirSync(this.locksPath);
    
    if (locks.length === 0) {
      console.log('No active sessions');
      return;
    }
    
    locks.forEach(lockFile => {
      const lockPath = path.join(this.locksPath, lockFile);
      const session = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      
      const status = session.status === 'active' ? 
        `${CONFIG.colors.green}●${CONFIG.colors.reset}` : 
        `${CONFIG.colors.yellow}○${CONFIG.colors.reset}`;
      
      console.log(`\n${status} ${CONFIG.colors.bright}${session.sessionId}${CONFIG.colors.reset}`);
      console.log(`  Task: ${session.task}`);
      console.log(`  Agent: ${session.agentType}`);
      console.log(`  Branch: ${session.branchName}`);
      console.log(`  Status: ${session.status}`);
      
      if (session.claimedBy) {
        console.log(`  Claimed by: ${session.claimedBy}`);
      }
      
      if (session.agentPid) {
        console.log(`  Agent PID: ${session.agentPid}`);
      }
    });
  }

  /**
   * Prompt for task name
   */
  promptForTask() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question('Enter task name: ', (answer) => {
        rl.close();
        resolve(answer || 'development');
      });
    });
  }

  /**
   * Create a combined session (both create and start agent)
   */
  async createAndStart(options = {}) {
    const session = await this.createSession(options);
    
    console.log(`\n${CONFIG.colors.yellow}Starting agent for session ${session.sessionId}...${CONFIG.colors.reset}`);
    
    // Wait a moment for user to see instructions
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.startAgent(session.sessionId);
    
    return session;
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  const coordinator = new SessionCoordinator();
  
  switch (command) {
    case 'create': {
      // Create a new session
      const task = args.includes('--task') ? 
        args[args.indexOf('--task') + 1] : 
        await coordinator.promptForTask();
      
      const agent = args.includes('--agent') ? 
        args[args.indexOf('--agent') + 1] : 
        'claude';
      
      await coordinator.createSession({ task, agent });
      break;
    }
    
    case 'start': {
      // Start agent for a session
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: start <session-id>');
        process.exit(1);
      }
      await coordinator.startAgent(sessionId);
      break;
    }
    
    case 'create-and-start': {
      // Create session and immediately start agent
      const task = args.includes('--task') ? 
        args[args.indexOf('--task') + 1] : 
        await coordinator.promptForTask();
      
      const agent = args.includes('--agent') ? 
        args[args.indexOf('--agent') + 1] : 
        'claude';
      
      await coordinator.createAndStart({ task, agent });
      break;
    }
    
    case 'request': {
      // Request a session (for Claude to call)
      const agent = args[1] || 'claude';
      await coordinator.requestSession(agent);
      break;
    }
    
    case 'list': {
      coordinator.listSessions();
      break;
    }
    
    case 'help':
    default: {
      console.log(`
${CONFIG.colors.bright}DevOps Session Coordinator${CONFIG.colors.reset}

${CONFIG.colors.blue}Usage:${CONFIG.colors.reset}
  node session-coordinator.js <command> [options]

${CONFIG.colors.blue}Commands:${CONFIG.colors.reset}
  ${CONFIG.colors.green}create${CONFIG.colors.reset}              Create a new session and show instructions
  ${CONFIG.colors.green}start <id>${CONFIG.colors.reset}          Start DevOps agent for a session
  ${CONFIG.colors.green}create-and-start${CONFIG.colors.reset}    Create session and start agent (all-in-one)
  ${CONFIG.colors.green}request [agent]${CONFIG.colors.reset}     Request a session (for Claude to call)
  ${CONFIG.colors.green}list${CONFIG.colors.reset}                List all active sessions
  ${CONFIG.colors.green}help${CONFIG.colors.reset}                Show this help

${CONFIG.colors.blue}Options:${CONFIG.colors.reset}
  --task <name>       Task or feature name
  --agent <type>      Agent type (claude, cline, copilot, etc.)

${CONFIG.colors.blue}Examples:${CONFIG.colors.reset}
  ${CONFIG.colors.dim}# Workflow 1: Manual coordination${CONFIG.colors.reset}
  node session-coordinator.js create --task "auth-feature"
  ${CONFIG.colors.dim}# Copy instructions to Claude${CONFIG.colors.reset}
  node session-coordinator.js start <session-id>

  ${CONFIG.colors.dim}# Workflow 2: All-in-one${CONFIG.colors.reset}
  node session-coordinator.js create-and-start --task "api-endpoints"

  ${CONFIG.colors.dim}# Workflow 3: Claude requests a session${CONFIG.colors.reset}
  node session-coordinator.js request claude

${CONFIG.colors.yellow}Typical Workflow:${CONFIG.colors.reset}
1. Run: ${CONFIG.colors.green}node session-coordinator.js create-and-start${CONFIG.colors.reset}
2. Copy the displayed instructions to Claude/Cline
3. Claude navigates to the worktree and starts working
4. Agent automatically commits and pushes changes
`);
    }
  }
}

// Run the CLI
main().catch(err => {
  console.error(`${CONFIG.colors.red}Error: ${err.message}${CONFIG.colors.reset}`);
  process.exit(1);
});