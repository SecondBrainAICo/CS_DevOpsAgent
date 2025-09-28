# Worktree Manager - Product Requirements Document

## Overview
The Worktree Manager is a Git worktree orchestration system designed to enable multiple AI agents to collaborate on the same codebase simultaneously without conflicts. It extends the existing auto-commit infrastructure to support parallel development workflows.

## Problem Statement
When multiple AI agents (Claude, Copilot, Cursor, Aider, etc.) work on the same codebase concurrently on a single machine, they face:
- Git staging conflicts when different agents modify files simultaneously
- Branch collision issues with overlapping naming conventions
- Difficulty tracking which agent made which changes
- Complex merge workflows when consolidating agent work

## Solution
The Worktree Manager creates isolated Git worktrees for each AI agent, providing:
- **Complete Isolation**: Each agent works in its own directory with its own branch
- **Parallel Development**: Multiple agents can modify the same files without conflicts
- **Agent Attribution**: Clear tracking of which agent made which changes
- **Automated Workflows**: Integration with the existing auto-commit system

## Key Features

### 1. Worktree Creation
- Creates dedicated worktrees for each AI agent
- Assigns unique branch namespaces per agent
- Configures agent-specific environment variables
- Sets up VS Code workspaces with agent identification

### 2. Agent Management
- Tracks active agents and their worktrees
- Maintains persistent configuration in `.worktrees/agents.json`
- Supports known agents: Claude, Copilot, Cursor, Aider, Custom
- Provides agent-specific commit message prefixes

### 3. Branch Strategy
- **Agent branches**: `agent/{agentName}/{taskName}`
- **Daily branches**: `agent/{agentName}/daily/{date}`
- **Feature branches**: `agent/{agentName}/feature/{feature}`
- Prevents naming collisions between agents

### 4. Merge Coordination
- Interactive merge workflow for consolidating agent work
- Conflict resolution at merge time (not during development)
- Optional branch cleanup after successful merges
- Preserves full history of agent contributions

### 5. Auto-Commit Integration
- Each worktree runs its own auto-commit worker instance
- Agent-specific commit message files
- Environment variables customized per agent
- Compatible with existing versioning strategy

## Technical Architecture

### Directory Structure
```
repository/
├── .worktrees/                  # Worktree base directory
│   ├── agents.json              # Agent configuration
│   ├── workspaces.json          # Parallel workspace configs
│   ├── claude-auth-feature/    # Agent worktree
│   │   ├── .agent-config       # Agent-specific config
│   │   ├── .claude-commit-msg  # Agent commit messages
│   │   └── .vscode/            # VS Code settings
│   └── copilot-refactor/       # Another agent worktree
├── worktree-manager.js          # Main orchestration module
└── auto-commit-worker.js        # Existing auto-commit system
```

### Configuration Files

#### `.agent-config` (per worktree)
```json
{
  "agent": "claude",
  "worktree": "claude-auth-feature",
  "created": "2025-09-26T10:00:00Z",
  "task": "authentication",
  "autoCommit": {
    "enabled": true,
    "prefix": "agent_claude_",
    "messagePrefix": "[CLAUDE]",
    "pushOnCommit": true
  }
}
```

#### `agents.json` (global)
```json
{
  "claude": {
    "name": "claude",
    "worktrees": [
      {
        "name": "claude-auth-feature",
        "path": ".worktrees/claude-auth-feature",
        "branch": "agent/claude/auth-feature",
        "task": "authentication",
        "created": "2025-09-26T10:00:00Z",
        "status": "active"
      }
    ]
  }
}
```

## Usage Workflows

### Single Agent Setup
```bash
# Create worktree for Claude to work on authentication
node worktree-manager.js create --agent claude --task auth-feature

# Navigate to worktree
cd .worktrees/claude-auth-feature

# Run auto-commit worker
AC_BRANCH_PREFIX=agent_claude_ node ../../auto-commit-worker.js
```

### Multi-Agent Parallel Development
```bash
# Create parallel workspace for 3 agents
node worktree-manager.js parallel \
  --agents claude,copilot,cursor \
  --task refactor-api

# Each agent gets its own worktree:
# - .worktrees/claude-refactor-api
# - .worktrees/copilot-refactor-api  
# - .worktrees/cursor-refactor-api
```

### Merging Agent Work
```bash
# Interactive merge of Claude's work
node worktree-manager.js merge --agent claude

# Clean up after merge
node worktree-manager.js cleanup --agent claude --delete-branches
```

## Command Reference

### `create`
Creates a new worktree for an AI agent.
```bash
node worktree-manager.js create --agent <name> --task <task>
```

### `list`
Lists all active worktrees and their agents.
```bash
node worktree-manager.js list
```

### `merge`
Merges an agent's work back to main branch.
```bash
node worktree-manager.js merge --agent <name>
```

### `cleanup`
Removes worktrees and optionally deletes branches.
```bash
node worktree-manager.js cleanup --agent <name> [--all] [--delete-branches]
```

### `auto-commit`
Runs auto-commit worker in a specific worktree.
```bash
node worktree-manager.js auto-commit --agent <name> --worktree <name>
```

### `parallel`
Creates parallel workspace for multiple agents.
```bash
node worktree-manager.js parallel --agents agent1,agent2 --task <task>
```

## Auto-Detection Features (NEW)

### Automatic Agent Detection
- **Environment-Based Detection**: Automatically identifies AI agents from environment variables
- **Supported Agents**: Claude, Copilot, Cursor, Aider, Warp (extensible)
- **Fallback Mechanism**: Generates unique agent ID if no known agent detected
- **Repository Awareness**: Detects when running in AutoCommit repo itself and disables worktrees

### Smart Worktree Creation
- **On-Demand Creation**: Creates worktrees only when working on external repositories
- **Configuration Override**: Respects `AC_USE_WORKTREE` environment variable
- **Existing Worktree Detection**: Reuses existing worktrees when appropriate
- **Automatic Branch Naming**: Creates consistent `agent/{name}/{task}` branches

## Benefits

### For Development
- **True Parallelism**: Multiple agents work simultaneously without conflicts
- **Clean History**: Agent contributions are clearly attributed
- **Flexible Merging**: Choose when and how to integrate agent work
- **Reduced Conflicts**: Conflicts only occur at merge time, not during development
- **Zero Configuration**: Works automatically without manual setup

### For Project Management
- **Agent Accountability**: Track which agent made which changes
- **Task Isolation**: Each agent works on specific, isolated tasks
- **Quality Control**: Review agent work before merging to main
- **Experiment Safely**: Test different approaches in parallel

### For System Performance
- **No Staging Conflicts**: Each worktree has its own staging area
- **Independent Commits**: Agents commit at their own pace
- **Efficient Resource Usage**: Worktrees share object database
- **Fast Context Switching**: Switch between agent workspaces instantly

## Integration Points

### With Auto-Commit Worker
- Worktree manager sets environment variables for auto-commit
- Each worktree runs its own worker instance
- Compatible with existing versioning strategy (v0.20, v0.21, etc.)
- Preserves daily branch workflow within each agent's namespace

### With VS Code
- Creates `.vscode/settings.json` per worktree
- Sets window title to identify agent workspace
- Configures terminal environment variables
- Enables agent-specific debugging and testing

### With Git
- Uses native Git worktree functionality
- Compatible with all Git operations
- Preserves full commit history
- Supports standard merge strategies

## Future Enhancements

### Phase 2: Agent Intelligence
- Agent performance metrics and scoring
- Automatic task assignment based on agent strengths
- Learning from successful merge patterns
- Agent collaboration recommendations

### Phase 3: Distributed Development
- Support for remote worktrees
- Multi-machine agent coordination
- Cloud-based worktree provisioning
- Real-time agent synchronization

### Phase 4: Advanced Orchestration
- Dependency-aware task distribution
- Automatic conflict prediction and prevention
- Agent work validation and testing
- Intelligent merge sequencing

## Success Metrics
- Number of parallel agents supported
- Reduction in merge conflicts
- Time saved through parallel development
- Code quality improvements from isolated testing
- Developer satisfaction with multi-agent workflows

## Conclusion
The Worktree Manager transforms the auto-commit system into a powerful multi-agent development platform. By providing isolated workspaces for each AI agent, it enables true parallel development while maintaining code quality and project coherence. This system is essential for scaling AI-assisted development beyond single-agent workflows.