# Session Management Guide

## Overview
The DevOps Agent now includes easy session management tools for cleanly closing and cleaning up worktree sessions.

## Starting a Session
```bash
npm start
# Select "N" for new session
# Enter task name and agent type
# Copy instructions to your AI agent
```

## Closing a Session

### Method 1: Interactive Cleanup (Recommended)
From the main repository directory:

```bash
npm run devops:close
```

This will:
1. List all active sessions
2. Let you select which one to close
3. Kill the agent process
4. Check for uncommitted changes (option to commit)
5. Push any unpushed commits
6. Remove the worktree
7. Delete local branch
8. Clean up lock files
9. Optionally delete remote branch

### Method 2: From Within the Agent
While the agent is running, you can send it commands by creating a special command file in the worktree:

```bash
# From the worktree directory:
echo "CLOSE_SESSION" > .devops-command-{sessionId}

# Or for status:
echo "STATUS" > .devops-command-{sessionId}

# Or to manually push:
echo "PUSH" > .devops-command-{sessionId}
```

The agent will:
- Detect the command file
- Execute the requested action
- Delete the command file
- For CLOSE_SESSION: commit changes, push, and exit gracefully

### Method 3: Manual Cleanup
If you need to manually clean up:

```bash
# 1. Stop the agent (Ctrl+C or kill the process)

# 2. From main repo:
git worktree remove path/to/worktree --force

# 3. Delete local branch:
git branch -D branch-name

# 4. Optionally delete remote:
git push origin --delete branch-name
```

## Session Commands

### Available Commands (via command file):
- `CLOSE_SESSION` or `EXIT` or `QUIT` - Cleanly close the session
- `STATUS` - Display session status and uncommitted changes
- `PUSH` - Push current branch to remote

### Command File Format:
- Filename: `.devops-command-{sessionId}`
- Content: Single line with the command (e.g., "CLOSE_SESSION")
- Location: In the worktree root directory
- The file is automatically deleted after processing

## Best Practices

1. **Always close sessions properly** - Use `npm run devops:close` to ensure clean shutdown
2. **Commit before closing** - The tool will prompt you about uncommitted changes
3. **Keep remote clean** - Delete remote branches after merging or when no longer needed
4. **Check status regularly** - Use the STATUS command to see uncommitted changes

## Troubleshooting

### Session won't close
- Check if the agent process is still running: `ps aux | grep cs-devops-agent`
- Kill manually if needed: `kill -9 <PID>`
- Use `--force` flag with worktree remove

### Can't find session
- Check lock files: `ls local_deploy/session-locks/`
- List all worktrees: `git worktree list`

### Remote branch issues
- If push fails, the branch might not exist on remote
- Create it with: `git push -u origin branch-name`
- Or skip remote deletion if it doesn't exist

## Integration with AI Agents

When working with AI coding assistants:
1. Start a session with `npm start`
2. Copy the provided instructions to your AI agent
3. Work in the session worktree
4. When done, either:
   - Tell the AI to create the close command file
   - Or run `npm run devops:close` from main repo

The session management ensures:
- No conflicts between multiple agents
- Clean separation of work
- Easy cleanup when done
- All changes are tracked and pushed