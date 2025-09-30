# CS_DevOpsAgent 🚀

[![npm version](https://badge.fury.io/js/s9n-devops-agent.svg)](https://badge.fury.io/js/s9n-devops-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/SecondBrainAICo/CS_DevOpsAgent)

An intelligent Git automation system with multi-agent support, session management, and seamless integration with AI coding assistants like Claude, GitHub Copilot, and Cursor.

## 🔗 Quick Links

- **GitHub Repository**: [https://github.com/SecondBrainAICo/CS_DevOpsAgent](https://github.com/SecondBrainAICo/CS_DevOpsAgent)
- **NPM Package**: [https://www.npmjs.com/package/s9n-devops-agent](https://www.npmjs.com/package/s9n-devops-agent)
- **Issues & Support**: [GitHub Issues](https://github.com/SecondBrainAICo/CS_DevOpsAgent/issues)
- **Documentation**: [GitHub Wiki](https://github.com/SecondBrainAICo/CS_DevOpsAgent/wiki)

## Features ✨

- **🤖 Multi-Agent Support**: Work with Claude, GitHub Copilot, Cursor, and other AI coding assistants
- **📁 Git Worktree Management**: Isolated workspaces for each session to prevent conflicts
- **🔄 Automatic Commits & Push**: Monitors changes and commits with proper messages
- **📅 Daily Version Rollover**: Automatic version management with customizable increments
- **🎯 Session Management**: Create, manage, and track multiple development sessions
- **⚙️ VS Code Integration**: Seamlessly integrates with VS Code tasks
- **🔐 Safe Concurrent Development**: Multiple agents can work simultaneously without conflicts
- **🏷️ Smart Branching**: Automatic branch creation with configurable naming patterns

## Installation 📦

### Option 1: NPM Package (Recommended for Users)

#### Global Installation
```bash
npm install -g s9n-devops-agent
```

#### Local Installation
```bash
npm install s9n-devops-agent --save-dev
```

### Option 2: From Source (For Contributors)

#### Clone the Repository
```bash
# Clone the repository
git clone https://github.com/SecondBrainAICo/CS_DevOpsAgent.git
cd CS_DevOpsAgent

# Install dependencies
npm install

# Link globally for development
npm link

# Now you can use s9n-devops-agent command globally
s9n-devops-agent --help
```

#### Development Setup
```bash
# Clone and setup for development
git clone https://github.com/SecondBrainAICo/CS_DevOpsAgent.git
cd CS_DevOpsAgent

# Install dependencies
npm install

# Run tests
npm test

# Start development session
npm run dev
```

## Quick Start 🚀

### First-Time Setup

```bash
# Run the interactive setup wizard
s9n-devops-agent setup

# This will configure:
# - Your developer initials (used in branch names)
# - Version numbering strategy
# - Default timezone for daily rollover
```

### Start a DevOps Session

```bash
# Start the interactive session manager
s9n-devops-agent start

# Or create a new session directly
s9n-devops-agent create --task "implement-api"
```

### Working with AI Assistants

When you start a session, you'll receive instructions to paste into your AI assistant:

```
I'm working in a DevOps-managed session with the following setup:
- Session ID: 8a3s-45b1
- Working Directory: /path/to/worktree
- Task: implement-api

Please switch to this directory before making any changes:
cd "/path/to/worktree"

Write commit messages to: .devops-commit-8a3s-45b1.msg
The DevOps agent will automatically commit and push changes.
```

## Commands 📝

### Session Management

```bash
# Start interactive session manager
s9n-devops-agent start

# List all active sessions
s9n-devops-agent list

# Create a new session
s9n-devops-agent create --task "feature-name" --agent claude

# Close an active session
s9n-devops-agent close <session-id>

# Clean up stale sessions
s9n-devops-agent cleanup
```

### Direct Operations

```bash
# Run the worker directly (for CI/CD)
s9n-devops-agent worker

# Manage worktrees
s9n-devops-agent worktree create
s9n-devops-agent worktree list

# Run setup wizard
s9n-devops-agent setup
```

## Configuration 🔧

### Environment Variables

```bash
# Branch naming prefix
export AC_BRANCH_PREFIX="dev_initials_"

# Enable auto-push (default: true)
export AC_PUSH=true

# Enable debug logging
export AC_DEBUG=true

# Set timezone for daily rollover
export AC_TZ="America/New_York"

# Version configuration
export AC_VERSION_PREFIX="v0."
export AC_VERSION_START_MINOR="20"
export AC_VERSION_INCREMENT="1"  # 1 = 0.01, 10 = 0.1
```

### Configuration Files

Configuration is stored in:
- **Global settings**: `~/.devops-agent/settings.json` (developer initials, email)
- **Project settings**: `local_deploy/project-settings.json` (version strategy, auto-merge)

## Workflow Example 💡

1. **Start a Session**:
   ```bash
   s9n-devops-agent start
   # Select: N) Create a new session
   # Enter task: implement-authentication
   ```

2. **Copy Instructions to AI Assistant**:
   - The tool provides instructions to paste into Claude/Copilot
   - The AI works in the isolated worktree

3. **AI Makes Changes**:
   - AI writes code in the worktree directory
   - Creates commit message in `.devops-commit-{session-id}.msg`

4. **Automatic Processing**:
   - Agent detects changes
   - Reads commit message
   - Commits and pushes automatically

5. **Close Session**:
   ```bash
   s9n-devops-agent close
   ```

## VS Code Integration 🔌

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start DevOps Agent",
      "type": "shell",
      "command": "s9n-devops-agent",
      "args": ["start"],
      "problemMatcher": [],
      "isBackground": true
    }
  ]
}
```

## Advanced Features 🔬

### Multi-Agent Collaboration

Multiple AI assistants can work on different features simultaneously:

```bash
# Terminal 1: Claude working on API
s9n-devops-agent create --task "api-endpoints" --agent claude

# Terminal 2: Copilot working on frontend
s9n-devops-agent create --task "ui-components" --agent copilot

# Each gets their own worktree and branch
```

### Custom Version Strategies

Configure daily version increments:
- `0.01` increments: v0.20 → v0.21 → v0.22
- `0.1` increments: v0.20 → v0.30 → v0.40
- `0.2` increments: v0.20 → v0.40 → v0.60

### Automatic Daily Rollover

At midnight (configurable timezone):
1. Merges current day's work into version branch
2. Creates new version branch (e.g., v0.21)
3. Creates new daily branch
4. Preserves work continuity

## Platform Compatibility 🖥️

- ✅ **Git Platforms**: GitHub, GitLab, Bitbucket, Gitea, self-hosted Git
- ✅ **Operating Systems**: macOS, Linux, Windows (WSL recommended)
- ✅ **AI Assistants**: Claude, GitHub Copilot, Cursor, Cody, any AI that can write files
- ✅ **Node.js**: Version 16.0.0 or higher

## Troubleshooting 🔍

### Common Issues

**Session files showing as uncommitted**:
```bash
# Files are automatically gitignored
# If issue persists, run:
s9n-devops-agent cleanup
```

**Permission denied errors**:
```bash
# Ensure scripts are executable
chmod +x $(npm root -g)/s9n-devops-agent/bin/s9n-devops-agent
```

**Agent not detecting changes**:
```bash
# Check if running in correct directory
pwd
# Ensure message file exists
ls -la .devops-commit-*.msg
```

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support 💬

- 📧 Email: support@secondbrain.ai
- 🐛 Issues: [GitHub Issues](https://github.com/SecondBrainAICo/CS_DevOpsAgent/issues)
- 📖 Documentation: [GitHub Wiki](https://github.com/SecondBrainAICo/CS_DevOpsAgent/wiki)

## Acknowledgments 🙏

Built with ❤️ by [SecondBrain Labs](https://secondbrain.ai)

Special thanks to all contributors and the open-source community.

---

**Copyright © 2024 SecondBrain Labs. All rights reserved.**