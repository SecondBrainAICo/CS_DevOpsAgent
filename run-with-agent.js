#!/usr/bin/env node

/**
 * ============================================================================
 * RUN WITH AGENT - Helper script to run AutoCommit with agent worktrees
 * ============================================================================
 * 
 * This script simplifies running AutoCommit with automatic worktree creation
 * for different AI agents. It sets up the necessary environment variables
 * and launches the auto-commit worker in the appropriate context.
 * 
 * Usage:
 *   node run-with-agent.js --agent claude --repo /path/to/repo --task feature-x
 *   node run-with-agent.js --agent copilot --repo ../my-project
 *   node run-with-agent.js --detect --repo /path/to/repo
 * 
 * Options:
 *   --agent <name>    Specify the agent name (claude, copilot, cursor, aider, custom)
 *   --repo <path>     Path to the target repository
 *   --task <name>     Task or feature name (default: development)
 *   --detect          Auto-detect agent from environment
 *   --no-worktree     Disable worktree creation (work directly in repo)
 *   --list            List all active agent worktrees
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const KNOWN_AGENTS = {
  claude: {
    envVars: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    msgFile: '.claude-commit-msg',
    color: '\x1b[35m' // Magenta
  },
  copilot: {
    envVars: ['COPILOT_API_KEY', 'GITHUB_COPILOT_ENABLED'],
    msgFile: '.copilot-commit-msg',
    color: '\x1b[36m' // Cyan
  },
  cursor: {
    envVars: ['CURSOR_API_KEY', 'CURSOR_ENABLED'],
    msgFile: '.cursor-commit-msg',
    color: '\x1b[34m' // Blue
  },
  aider: {
    envVars: ['AIDER_API_KEY', 'OPENAI_API_KEY'],
    msgFile: '.aider-commit-msg',
    color: '\x1b[33m' // Yellow
  },
  warp: {
    envVars: ['WARP_API_KEY', 'WARP_ENABLED'],
    msgFile: '.warp-commit-msg',
    color: '\x1b[32m' // Green
  }
};

const RESET_COLOR = '\x1b[0m';
const BRIGHT = '\x1b[1m';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(agent, msg) {
  const config = KNOWN_AGENTS[agent] || { color: '\x1b[37m' };
  console.log(`${config.color}${BRIGHT}[${agent.toUpperCase()}]${RESET_COLOR} ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m[ERROR]${RESET_COLOR} ${msg}`);
  process.exit(1);
}

function detectAgent() {
  // Check environment variables for agent indicators
  for (const [agent, config] of Object.entries(KNOWN_AGENTS)) {
    for (const envVar of config.envVars) {
      if (process.env[envVar]) {
        return agent;
      }
    }
  }
  
  // Check for agent-specific tools in PATH
  try {
    execSync('which copilot', { stdio: 'pipe' });
    return 'copilot';
  } catch {}
  
  try {
    execSync('which cursor', { stdio: 'pipe' });
    return 'cursor';
  } catch {}
  
  try {
    execSync('which aider', { stdio: 'pipe' });
    return 'aider';
  } catch {}
  
  // Check terminal environment
  if (process.env.TERM_PROGRAM === 'WarpTerminal') {
    return 'warp';
  }
  
  return null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    agent: null,
    repo: null,
    task: 'development',
    detect: false,
    noWorktree: false,
    list: false,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--agent':
      case '-a':
        options.agent = args[++i];
        break;
      case '--repo':
      case '-r':
        options.repo = args[++i];
        break;
      case '--task':
      case '-t':
        options.task = args[++i];
        break;
      case '--detect':
      case '-d':
        options.detect = true;
        break;
      case '--no-worktree':
        options.noWorktree = true;
        break;
      case '--list':
      case '-l':
        options.list = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
${BRIGHT}Run AutoCommit with Agent Worktrees${RESET_COLOR}

Usage:
  node run-with-agent.js --agent <name> --repo <path> [options]
  node run-with-agent.js --detect --repo <path> [options]

Options:
  -a, --agent <name>    Specify the agent name (claude, copilot, cursor, aider, warp, custom)
  -r, --repo <path>     Path to the target repository
  -t, --task <name>     Task or feature name (default: development)
  -d, --detect          Auto-detect agent from environment
  --no-worktree         Disable worktree creation (work directly in repo)
  -l, --list            List all active agent worktrees
  -h, --help            Show this help message

Examples:
  # Run with specific agent
  node run-with-agent.js --agent claude --repo /path/to/repo --task auth-feature
  
  # Auto-detect agent
  node run-with-agent.js --detect --repo ../my-project
  
  # List active worktrees
  node run-with-agent.js --list --repo /path/to/repo
  
  # Run without worktree
  node run-with-agent.js --agent copilot --repo . --no-worktree

Known Agents:
  ${Object.keys(KNOWN_AGENTS).join(', ')}

Environment Variables:
  AGENT_NAME        Override agent name
  AGENT_TASK        Override task name
  AC_USE_WORKTREE   Enable/disable worktrees (true/false/auto)
`);
}

function listWorktrees(repoPath) {
  try {
    process.chdir(repoPath);
    const result = execSync('git worktree list', { encoding: 'utf8' });
    
    console.log(`\n${BRIGHT}Active Worktrees in ${repoPath}:${RESET_COLOR}\n`);
    
    const lines = result.split('\n').filter(l => l);
    for (const line of lines) {
      const match = line.match(/(.+?)\s+([a-f0-9]+)\s+\[(.+?)\]/);
      if (match) {
        const [, path, commit, branch] = match;
        const isAgent = branch.includes('agent/');
        
        if (isAgent) {
          const agentMatch = branch.match(/agent\/([^\/]+)\//);
          const agent = agentMatch ? agentMatch[1] : 'unknown';
          const config = KNOWN_AGENTS[agent] || { color: '\x1b[37m' };
          
          console.log(`${config.color}[${agent.toUpperCase()}]${RESET_COLOR}`);
          console.log(`  Path: ${path}`);
          console.log(`  Branch: ${branch}`);
          console.log(`  Commit: ${commit}`);
          console.log('');
        } else if (path === repoPath) {
          console.log(`${BRIGHT}[MAIN]${RESET_COLOR}`);
          console.log(`  Path: ${path}`);
          console.log(`  Branch: ${branch}`);
          console.log(`  Commit: ${commit}`);
          console.log('');
        }
      }
    }
    
    // Check for agent configs
    const worktreesDir = path.join(repoPath, '.worktrees');
    if (fs.existsSync(worktreesDir)) {
      const agentsFile = path.join(worktreesDir, 'agents.json');
      if (fs.existsSync(agentsFile)) {
        const agents = JSON.parse(fs.readFileSync(agentsFile, 'utf8'));
        console.log(`${BRIGHT}Registered Agents:${RESET_COLOR}`);
        for (const [agent, data] of Object.entries(agents)) {
          const active = (data.worktrees || []).filter(w => w.status === 'active').length;
          console.log(`  ${agent}: ${active} active worktree(s)`);
        }
      }
    }
    
  } catch (err) {
    error(`Failed to list worktrees: ${err.message}`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    return;
  }
  
  // Validate repository path
  if (!options.repo) {
    error('Repository path is required. Use --repo <path>');
  }
  
  const repoPath = path.resolve(options.repo);
  if (!fs.existsSync(repoPath)) {
    error(`Repository path does not exist: ${repoPath}`);
  }
  
  // Check if it's a git repository
  try {
    execSync('git rev-parse --git-dir', { cwd: repoPath, stdio: 'pipe' });
  } catch {
    error(`Not a git repository: ${repoPath}`);
  }
  
  // Handle list command
  if (options.list) {
    listWorktrees(repoPath);
    return;
  }
  
  // Determine agent
  let agent = options.agent;
  if (options.detect && !agent) {
    agent = detectAgent();
    if (!agent) {
      console.log('No agent detected. Using generic agent name.');
      agent = `agent-${Date.now().toString(36)}`;
    } else {
      console.log(`Detected agent: ${agent}`);
    }
  }
  
  if (!agent) {
    error('Agent name is required. Use --agent <name> or --detect');
  }
  
  // Prepare environment variables
  const env = { ...process.env };
  
  env.AGENT_NAME = agent;
  env.AGENT_TASK = options.task;
  env.AI_AGENT = agent; // Alternative env var
  env.AI_TASK = options.task; // Alternative env var
  
  if (options.noWorktree) {
    env.AC_USE_WORKTREE = 'false';
  } else {
    env.AC_USE_WORKTREE = 'true';
  }
  
  // Set agent-specific message file
  const agentConfig = KNOWN_AGENTS[agent];
  if (agentConfig && agentConfig.msgFile) {
    env.AC_MSG_FILE = agentConfig.msgFile;
  } else {
    env.AC_MSG_FILE = `.${agent}-commit-msg`;
  }
  
  // Set branch prefix for agent
  env.AC_BRANCH_PREFIX = `agent_${agent}_`;
  
  log(agent, `Starting AutoCommit worker`);
  log(agent, `Repository: ${repoPath}`);
  log(agent, `Task: ${options.task}`);
  log(agent, `Worktrees: ${options.noWorktree ? 'disabled' : 'enabled'}`);
  log(agent, `Message file: ${env.AC_MSG_FILE}`);
  
  // Launch auto-commit worker
  const workerPath = path.join(__dirname, 'auto-commit-worker.js');
  
  const worker = spawn('node', [workerPath], {
    cwd: repoPath,
    env,
    stdio: 'inherit'
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log(agent, 'Stopping AutoCommit worker...');
    worker.kill('SIGINT');
    setTimeout(() => process.exit(0), 1000);
  });
  
  process.on('SIGTERM', () => {
    log(agent, 'Stopping AutoCommit worker...');
    worker.kill('SIGTERM');
    setTimeout(() => process.exit(0), 1000);
  });
  
  worker.on('exit', (code) => {
    log(agent, `Worker exited with code: ${code}`);
    process.exit(code);
  });
}

// Run the main function
main().catch(err => {
  error(`Fatal error: ${err.message}`);
});