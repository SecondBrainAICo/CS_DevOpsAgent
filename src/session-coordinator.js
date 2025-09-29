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
    
    this.ensureDirectories();
    this.cleanupStaleLocks();
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
    [this.sessionsPath, this.locksPath, this.worktreesPath, this.instructionsPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
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

  generateSessionId() {
    const timestamp = Date.now().toString(36).slice(-4);
    const random = crypto.randomBytes(2).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * Create a new session and generate Claude instructions
   */
  async createSession(options = {}) {
    const sessionId = this.generateSessionId();
    const task = options.task || 'development';
    const agentType = options.agent || 'claude';
    
    console.log(`\n${CONFIG.colors.bgBlue}${CONFIG.colors.bright} Creating New Session ${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.blue}Session ID:${CONFIG.colors.reset} ${CONFIG.colors.bright}${sessionId}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.blue}Task:${CONFIG.colors.reset} ${task}`);
    console.log(`${CONFIG.colors.blue}Agent:${CONFIG.colors.reset} ${agentType}`);
    
    // Create worktree
    const worktreeName = `${agentType}-${sessionId}-${task.replace(/\s+/g, '-')}`;
    const worktreePath = path.join(this.worktreesPath, worktreeName);
    const branchName = `${agentType}/${sessionId}/${task.replace(/\s+/g, '-')}`;
    
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
        pid: process.pid
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
    
    // Start the agent
    const env = {
      ...process.env,
      DEVOPS_SESSION_ID: sessionId,
      AC_MSG_FILE: `.devops-commit-${sessionId}.msg`,
      AC_BRANCH_PREFIX: `${sessionData.agentType}_${sessionId}_`,
      AC_WORKING_DIR: sessionData.worktreePath,
      AC_BRANCH: sessionData.branchName,
      AC_PUSH: 'true'  // Enable auto-push for session branches
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