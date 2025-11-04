# CS_DevOpsAgent Wiki

Welcome to the **CS_DevOpsAgent** (s9n-devops-agent) documentation! This intelligent Git automation system enables seamless multi-agent development with automatic commit, push, and session management.

## 🚀 Quick Links

- **[Getting Started](Getting-Started)** - Installation and first-time setup
- **[Session Management](Session-Management)** - Creating and managing development sessions
- **[Multi-Agent Coordination](Multi-Agent-Coordination)** - Working with multiple AI agents
- **[Docker Integration](Docker-Integration)** - Automatic container restarts
- **[House Rules](House-Rules)** - Configure agent behavior
- **[Changelog](Changelog)** - Version history and updates
- **[Troubleshooting](Troubleshooting)** - Common issues and solutions
- **[API Reference](API-Reference)** - Command-line interface

## 📦 What is CS_DevOpsAgent?

CS_DevOpsAgent is an intelligent automation system that:

- ✅ **Automates Git Workflow** - Automatic commits and pushes based on file changes
- 🤖 **Multi-Agent Support** - Multiple AI assistants working in isolated worktrees
- 🔒 **File Coordination** - Prevents conflicts between concurrent agents
- 🐋 **Docker Integration** - Automatic container restarts after deployments
- 📋 **Session Management** - Organized worktrees with unique identifiers
- 🔄 **Daily Rollover** - Automatic version bumps and branch merging
- ⚙️ **Flexible Configuration** - Persistent settings for 24x7 operation

## 🎯 Use Cases

### Solo Development
- Automated commit/push workflow
- Daily version management
- Docker container lifecycle management

### Team Development
- Multiple developers with isolated worktrees
- File coordination to prevent conflicts
- Automatic branch management

### AI-Assisted Development
- **Claude, Cursor, Cline, GitHub Copilot** support
- Seamless handoff between human and AI
- Multiple AI agents working in parallel

## 📚 Documentation Structure

### Getting Started
1. **[Installation](Installation)** - System requirements and setup
2. **[First Session](First-Session)** - Creating your first development session
3. **[Configuration](Configuration)** - Initial project setup

### Core Concepts
4. **[Worktrees](Worktrees)** - Understanding Git worktrees
5. **[Branching Strategy](Branching-Strategy)** - Daily branches and version management
6. **[File Coordination](File-Coordination)** - Multi-agent file locking

### Advanced Features
7. **[Docker Management](Docker-Management)** - Container lifecycle automation
8. **[House Rules](House-Rules-Guide)** - Customizing agent behavior
9. **[Auto-Merge](Auto-Merge)** - Automatic branch merging
10. **[Infrastructure Tracking](Infrastructure-Tracking)** - Automated documentation

### Reference
11. **[CLI Commands](CLI-Commands)** - Complete command reference
12. **[Environment Variables](Environment-Variables)** - Configuration options
13. **[Project Settings](Project-Settings)** - Persistent configuration
14. **[Troubleshooting Guide](Troubleshooting-Guide)** - Solutions to common issues

## 🆕 Latest Updates

**Version 1.7.2** (2025-01-10)
- 🔢 **Version Display Fix** - All components now show correct v1.7.2
- 🔍 **Visible Update Check** - Transparent update status messages (v1.7.1)
- 🔒 **Critical Lock Timing Fix** - Session-lifetime file locks prevent race conditions (v1.7.0)
- 🔀 **Dual Merge Support** - Merges to both daily and main branches (v1.7.0)
- 📅 **Weekly Consolidation** - Automated branch cleanup (v1.7.0)
- 🧹 **Orphan Session Cleanup** - Automatic detection of stale sessions (v1.7.0)

[See full changelog →](Changelog)

## 💡 Quick Examples

### Start a New Session
```bash
npm start
# or
npx s9n-devops-agent start
```

### List Active Sessions
```bash
s9n-devops-agent list
```

### Close a Session
```bash
s9n-devops-agent close
```

## 🆘 Need Help?

- 📖 Check the [Troubleshooting Guide](Troubleshooting)
- 🐛 [Report an Issue](https://github.com/SecondBrainAICo/CS_DevOpsAgent/issues)
- 💬 [Discussions](https://github.com/SecondBrainAICo/CS_DevOpsAgent/discussions)

## 📄 License

MIT License - See [LICENSE](https://github.com/SecondBrainAICo/CS_DevOpsAgent/blob/main/LICENSE)

---

**Next:** [Getting Started →](Getting-Started)
