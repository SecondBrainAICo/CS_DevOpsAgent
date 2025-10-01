# CS_DevOpsAgent Installation & Setup Guide

## Table of Contents
- [What Gets Installed](#what-gets-installed)
- [Installation Process](#installation-process)
- [Post-Installation Setup](#post-installation-setup)
- [Configuration Files](#configuration-files)
- [House Rules Setup](#house-rules-setup)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## What Gets Installed

When you run `npm install -g s9n-devops-agent`, the following components are installed:

### 1. **Binary Executable** (`s9n-devops-agent`)
- Located in your global npm bin directory (e.g., `/usr/local/bin` or `~/.npm-global/bin`)
- Provides the main CLI interface for all DevOps agent commands
- Automatically added to your PATH for global access

### 2. **Core Source Files** (in npm global node_modules)
```
s9n-devops-agent/
├── bin/
│   └── cs-devops-agent         # Main CLI entry point
├── src/
│   ├── cs-devops-agent-worker.js    # Core worker that monitors changes
│   ├── session-coordinator.js       # Multi-session management
│   ├── worktree-manager.js         # Git worktree isolation
│   ├── claude-session-manager.js   # AI assistant integration
│   ├── docker-utils.js             # Docker container management
│   ├── setup-cs-devops-agent.js    # Interactive setup wizard
│   └── close-session.js            # Session cleanup utilities
├── docs/
│   ├── houserules.md              # AI assistant guidelines
│   ├── SESSION_MANAGEMENT.md      # Session documentation
│   └── TESTING.md                  # Testing guidelines
├── start-devops-session.sh        # Session starter script
└── cleanup-sessions.sh            # Cleanup utility
```

### 3. **Dependencies**
- `chokidar@^3.5.3` - File system monitoring for auto-commits
- `execa@^7.1.1` - Process execution for Git commands

### 4. **No Project Files Are Modified**
- The global installation does NOT modify any files in your project
- All configuration is stored separately
- Your project remains clean until you run setup

## Installation Process

### Step 1: Install the Package

```bash
# Global installation (recommended)
npm install -g s9n-devops-agent

# Verify installation
s9n-devops-agent --help
```

### Step 2: Check Installation Location

```bash
# Find where npm installed the package
npm list -g s9n-devops-agent

# Check the binary location
which s9n-devops-agent

# View installed files
ls -la $(npm root -g)/s9n-devops-agent/
```

## Post-Installation Setup

### Step 1: Run the Setup Wizard

Navigate to your project directory and run:

```bash
cd /path/to/your/project
s9n-devops-agent setup
```

The setup wizard will:

1. **Prompt for Developer Initials** (3 letters)
   - Used for branch naming (e.g., `dev_abc_feature`)
   - Stored globally in `~/.devops-agent/settings.json`

2. **Configure Version Strategy**
   - Daily version rollover settings
   - Version increment size (0.01, 0.1, etc.)
   - Timezone for daily rollover

3. **Create Project Configuration**
   - Creates `local_deploy/` directory if not exists
   - Generates `local_deploy/project-settings.json`
   - Sets up `.gitignore` entries

4. **Configure VS Code Integration** (optional)
   - Creates `.vscode/tasks.json` for easy startup
   - Adds environment variables to `.vscode/settings.json`

### Step 2: Create House Rules File

The house rules file tells AI assistants how to work with your project:

```bash
# Create the docs directory if it doesn't exist
mkdir -p docs

# Create house rules from template
cat > docs/houserules.md << 'EOF'
# House Rules for AI Assistants

## Working with CS_DevOpsAgent

When you start working on this project, you'll be given:
- A session ID (e.g., 8a3s-45b1)
- A working directory (git worktree)
- A commit message file path

## Commit Message Rules

1. Always write commit messages to the specified `.devops-commit-*.msg` file
2. Use Conventional Commit format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `refactor:` for code refactoring
   - `test:` for tests
   - `chore:` for maintenance

3. Include a brief description and bullet points for changes:
   ```
   feat: implement user authentication

   - Add login endpoint
   - Create JWT token generation
   - Add password hashing
   ```

## Testing Policy

1. Every bug fix must have a test
2. Tests go in `test_cases/<area>/<component>/`
3. Name format: `YYYYMMDD_<description>_spec.<ext>`

## Infrastructure Changes

When modifying configuration files, package.json, or docker files:
- Document changes in `/Documentation/infrastructure.md`
- Use `infra:` prefix in commit messages

## Multi-Agent Coordination

Before making changes:
1. Check for `.ac-prep/` directory for other agents' plans
2. Write your plan to `.ac-prep/<agent-name>.json`
3. Wait for acknowledgment in `.ac/ack/<agent-name>.json`
4. Only edit files within your acknowledged scope

## Environment Variables

Key variables that might be set:
- `AGENT_NAME` or `AI_AGENT` - Your agent identifier
- `AC_BRANCH_PREFIX` - Branch naming prefix
- `AC_DEBUG` - Enable debug output
- `AC_USE_WORKTREE` - Worktree management (usually auto)
EOF

echo "Created docs/houserules.md"
```

### Step 3: Initialize Git Configuration

```bash
# Ensure proper git configuration
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Set up gitignore for DevOps agent files
echo "# CS_DevOpsAgent files" >> .gitignore
echo ".devops-commit-*.msg" >> .gitignore
echo "local_deploy/sessions/" >> .gitignore
echo "local_deploy/worktrees/" >> .gitignore
echo "local_deploy/logs/" >> .gitignore
echo ".ac/" >> .gitignore
echo ".ac-prep/" >> .gitignore
echo ".ac-shards.json" >> .gitignore
```

## Configuration Files

### 1. Global Settings (`~/.devops-agent/settings.json`)

Created after first setup, contains:
```json
{
  "developerInitials": "abc",
  "email": "developer@example.com",
  "defaultTimezone": "America/New_York"
}
```

### 2. Project Settings (`local_deploy/project-settings.json`)

Per-project configuration:
```json
{
  "version": {
    "prefix": "v0.",
    "startMinor": 20,
    "increment": 1
  },
  "autoMerge": {
    "enabled": true,
    "targetBranch": "main"
  },
  "docker": {
    "autoRestart": false,
    "rebuildOnRestart": false
  }
}
```

### 3. Session Files (created during runtime)

```
local_deploy/
├── sessions/          # Active session metadata
├── session-locks/     # Coordination locks
├── worktrees/        # Git worktrees for isolation
└── logs/             # Session logs
```

## House Rules Setup

The house rules file (`docs/houserules.md`) is essential for AI assistants to understand your project workflow. Key sections to customize:

### Testing Requirements
```markdown
## Testing Policy
Goal: Every feature ships with tests
Location: test_cases/<your-structure>
Framework: [pytest/jest/go test/rspec]
```

### Code Style
```markdown
## Code Style Guidelines
- Indentation: [2 spaces/4 spaces/tabs]
- Line length: [80/100/120]
- Quote style: [single/double]
```

### Project-Specific Rules
```markdown
## Project Conventions
- API endpoints: /api/v1/<resource>
- Database migrations: db/migrate/
- Environment configs: config/environments/
```

## Environment Variables

### Core Variables (set automatically)

| Variable | Description | Default |
|----------|-------------|---------|
| `AC_BRANCH_PREFIX` | Branch naming prefix | `dev_<initials>_` |
| `AC_PUSH` | Auto-push to remote | `true` |
| `AC_DEBUG` | Debug logging | `false` |
| `AC_TZ` | Timezone for rollover | `America/New_York` |

### Advanced Variables (optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `AC_VERSION_PREFIX` | Version prefix | `v0.` |
| `AC_VERSION_INCREMENT` | Daily increment | `1` (0.01) or `10` (0.1) |
| `AC_USE_WORKTREE` | Worktree mode | `auto` |
| `AC_SHARD_STRATEGY` | Conflict handling | `block`/`queue`/`branch` |
| `AC_MSG_MIN_BYTES` | Min commit message | `20` |
| `AC_DEBOUNCE_MS` | Change debounce | `1500` |

### Setting Environment Variables

**Bash/Zsh (.bashrc/.zshrc):**
```bash
export AC_BRANCH_PREFIX="dev_abc_"
export AC_DEBUG=true
export AC_TZ="America/New_York"
```

**VS Code (settings.json):**
```json
{
  "terminal.integrated.env.osx": {
    "AC_BRANCH_PREFIX": "dev_abc_",
    "AC_DEBUG": "true"
  }
}
```

## Troubleshooting

### Installation Issues

**Command not found after installation:**
```bash
# Check npm bin directory
npm bin -g

# Add to PATH if needed
export PATH="$PATH:$(npm bin -g)"
```

**Permission errors during global install:**
```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Setup Issues

**Setup wizard not finding project:**
```bash
# Ensure you're in a git repository
git init

# Or specify project root
AC_PROJECT_ROOT=/path/to/project s9n-devops-agent setup
```

**Worktree creation fails:**
```bash
# Check git version (needs 2.5+)
git --version

# Clean up broken worktrees
git worktree prune

# List existing worktrees
git worktree list
```

### Runtime Issues

**Agent not detecting changes:**
```bash
# Check if running
ps aux | grep devops-agent

# Enable debug mode
AC_DEBUG=true s9n-devops-agent start

# Check file watchers
ls -la .devops-commit-*.msg
```

**Commit messages not being picked up:**
```bash
# Verify message file exists
ls -la .devops-commit-*.msg

# Check minimum size
wc -c .devops-commit-*.msg  # Should be > 20 bytes

# Write test message
echo "test: checking agent" > .devops-commit-test.msg
```

**Multi-agent conflicts:**
```bash
# Check coordination files
ls -la .ac-prep/        # Prep requests
ls -la .ac/ack/         # Acknowledgments
cat .ac-shards.json     # Shard allocations

# Clear stuck coordination
rm -rf .ac-prep .ac
```

## Next Steps

After installation and setup:

1. **Start a session:**
   ```bash
   s9n-devops-agent start
   ```

2. **Copy instructions to your AI assistant**

3. **Begin development** - The agent will handle commits automatically

4. **Monitor activity:**
   ```bash
   # View logs
   tail -f local_deploy/logs/devops-*.log
   
   # Check session status
   s9n-devops-agent list
   ```

5. **Close session when done:**
   ```bash
   s9n-devops-agent close <session-id>
   ```

## Getting Help

- **Documentation**: [GitHub Wiki](https://github.com/SecondBrainAICo/CS_DevOpsAgent/wiki)
- **Issues**: [GitHub Issues](https://github.com/SecondBrainAICo/CS_DevOpsAgent/issues)
- **NPM Package**: [npmjs.com/package/s9n-devops-agent](https://www.npmjs.com/package/s9n-devops-agent)

---

**Note**: This agent is designed to work alongside AI coding assistants. It does NOT modify your code - it only manages git operations based on the commit messages your AI assistant writes.