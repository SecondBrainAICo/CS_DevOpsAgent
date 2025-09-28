# Code Studio CS_DevOpsAgent Agent - Project Information

## Repository Details

- **GitHub Repository**: https://github.com/secondbrainAI-limited/code_studio_cs-devops-agentAgent
- **Organization**: SecondBrainAI Limited
- **Local Path**: `/Volumes/Simba User Data/Development/SecondBrain_Code_Studio/CS_DevOpsAgent`

## Project Structure

```
CS_DevOpsAgent/
├── cs-devops-agent-worker.js    # Main worker that watches and commits changes
├── setup-cs-devops-agent.js     # Interactive setup wizard
├── quick-start.sh          # One-command setup script
├── README.md               # Comprehensive documentation
├── package.json            # NPM package configuration
├── LICENSE                 # MIT License
├── .gitignore             # Git ignore rules
└── PROJECT_INFO.md        # This file
```

## Key Features

- **Automatic Git Commits**: Watches for file changes and commit messages
- **Daily Branching**: Creates daily development branches (dev_{initials}_YYYY-MM-DD)
- **Version Management**: Micro-revision versioning (v0.20, v0.21, etc.)
- **VS Code Integration**: Tasks and settings for seamless workflow
- **Developer Personalization**: Each developer gets their own branch prefix
- **Claude AI Integration**: Generates CLAUDE.md house rules for AI assistance

## Quick Commands

### Setup (for new projects)
```bash
# Clone to a new project
git clone https://github.com/secondbrainAI-limited/code_studio_cs-devops-agentAgent.git CS_DevOpsAgent
cd CS_DevOpsAgent
./quick-start.sh
```

### Daily Usage
```bash
# Start the worker
npm run cs-devops-agent

# Create a commit message
echo "feat(module): description" > .claude-commit-msg

# Stop the worker
pkill -f "node.*cs-devops-agent-worker"
```

## Git Commands

### Push to GitHub
```bash
git push -u origin main
```

### Pull Latest Changes
```bash
git pull origin main
```

### Check Remote Status
```bash
git remote -v
git branch -vv
```

## Environment Variables

The system uses these environment variables (set during setup):

- `AC_BRANCH_PREFIX`: Developer's branch prefix (e.g., dev_sdd_)
- `AC_TZ`: Timezone for daily rollover (default: Asia/Dubai)
- `AC_PUSH`: Auto-push to remote (default: true)
- `AC_DEBUG`: Enable debug logging (default: false)

## Development Workflow

1. **Initial Setup**: Run `./quick-start.sh` in your project root
2. **Start Worker**: `npm run cs-devops-agent`
3. **Make Changes**: Edit your files normally
4. **Commit**: Write message to `.claude-commit-msg`
5. **Auto-Process**: Worker stages, commits, and pushes automatically
6. **Daily Rollover**: Handled automatically at midnight

## Integration with SecondBrain Projects

This cs-devops-agent system is designed to work seamlessly with:
- SecondBrain MVPEmails
- DistilledConceptExtractor
- Other SecondBrain Code Studio projects

## Support

- **Issues**: https://github.com/secondbrainAI-limited/code_studio_cs-devops-agentAgent/issues
- **Organization**: https://github.com/secondbrainAI-limited

## License

MIT License - See LICENSE file for details

---

*Last Updated: 2025-09-25*