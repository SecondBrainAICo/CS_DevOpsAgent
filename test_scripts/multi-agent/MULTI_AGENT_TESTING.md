# Multi-Agent Testing Guide

## Overview

This directory contains tools for testing multiple DevOps agents working concurrently on the same repository. These tests help identify and resolve conflicts when multiple developers (or AI agents) are working simultaneously.

## Test Scripts

### 1. `test-conflicts.sh` 🆕
**Purpose:** Demonstrates and tests conflict scenarios between agents.

**Usage:**
```bash
./test-conflicts.sh
```

**What it tests:**
1. No conflict - Different files
2. No conflict - Same file, different sections
3. Conflict - Same file, same lines
4. Conflict resolution strategies

**Key Features:**
- Visual demonstration of conflicts
- Shows conflict markers
- Demonstrates resolution strategies
- Explains best practices

### 2. `run-multi-agent-test.sh`
**Purpose:** Automated test that creates sessions, starts agents, and simulates concurrent editing.

**Usage:**
```bash
./run-multi-agent-test.sh
```

**What it does:**
- Creates two new sessions automatically
- Starts DevOps agents for both sessions
- Simulates concurrent file editing
- Tests conflict scenarios
- Shows results and logs
- Cleans up when done (Ctrl+C)

### 2. `test-multi-agent-conflicts.sh`
**Purpose:** Manual testing script for existing sessions.

**Usage:**
```bash
# First create two sessions manually:
node src/session-coordinator.js create --task "test-1"  # Note session ID
node src/session-coordinator.js create --task "test-2"  # Note session ID

# Then run the test:
./test-multi-agent-conflicts.sh <session-1-id> <session-2-id>
```

**What it tests:**
1. Sequential edits (no conflict)
2. Concurrent edits to different parts of the same file
3. Concurrent edits to the same lines (conflict scenario)

## Test Scenarios

### Conflict Scenarios

#### No Conflict Scenarios:
1. **Different Files** - Agents work on completely separate files
2. **Different Branches** - Each agent has their own branch
3. **Different Sections** - Same file but non-overlapping changes

#### Conflict Scenarios:
1. **Same Line Edits** - Both agents modify the same line
2. **Overlapping Changes** - Changes that affect nearby lines
3. **Structural Changes** - One agent restructures while another edits

### Scenario 1: Sequential Edits
- Agent 1 edits and pushes
- Agent 2 pulls, edits, and pushes
- **Expected:** No conflicts, smooth operation

### Scenario 2: Concurrent Different Lines
- Both agents edit different parts of the same file
- Both try to push at nearly the same time
- **Expected:** Git auto-merges non-conflicting changes

### Scenario 3: Same Line Conflicts
- Both agents edit the same lines
- Both try to push at nearly the same time
- **Expected:** Second agent faces conflict, needs resolution

## Monitoring Tests

### Watch Agent Logs
```bash
# In separate terminals:
tail -f local_deploy/agent1.log
tail -f local_deploy/agent2.log
```

### Check Git History
```bash
cd local_deploy/worktrees/<worktree-name>
git log --oneline --graph -10
```

## Conflict Resolution Strategies

The DevOps agent currently handles conflicts using:

1. **Pull with Rebase** (default)
   - Attempts to rebase local changes on top of remote
   - Cleaner history but may fail on conflicts

2. **Pull with Merge** (fallback)
   - Creates merge commits
   - More likely to succeed but messier history

3. **Manual Resolution** (when automated fails)
   - Agent reports conflict
   - Developer must manually resolve

## Future Improvements

Based on test results, consider implementing:

1. **Smart Conflict Resolution**
   - Detect file types (JSON, Markdown, etc.)
   - Apply type-specific merge strategies
   - Auto-resolve simple conflicts

2. **Agent Coordination**
   - Lock files during editing
   - Queue system for sequential processing
   - Agent communication protocol

3. **Rollback Mechanism**
   - Automatic rollback on conflict
   - Retry with backoff strategy
   - Alert system for human intervention

## Common Issues and Solutions

### Issue: Agents push simultaneously
**Solution:** The first agent succeeds, second agent must pull and merge/rebase

### Issue: Merge conflicts in JSON files
**Solution:** Consider using JSON-specific merge tools or strategies

### Issue: Lost commits during rebase
**Solution:** Use reflog to recover: `git reflog`

### Issue: Agents stuck in conflict state
**Solution:** 
```bash
# Reset agent worktree
cd local_deploy/worktrees/<worktree-name>
git reset --hard origin/<branch-name>
```

## Testing Workflow

1. **Start Test:**
   ```bash
   ./run-multi-agent-test.sh
   ```

2. **Monitor Progress:**
   ```bash
   # Watch both agent logs
   watch -n 1 'tail -n 20 local_deploy/agent*.log | grep -E "(commit|push|conflict)"'
   ```

3. **Analyze Results:**
   - Check git history for merge commits
   - Review conflict resolution attempts
   - Verify file contents are correct

4. **Clean Up:**
   - Press Ctrl+C to stop agents
   - Script auto-cleans session files

## Best Practices

1. **Test Isolation:** Run tests in separate branches
2. **Backup:** Keep backups before testing on important branches
3. **Monitoring:** Always monitor agent logs during tests
4. **Documentation:** Document any new conflict scenarios discovered

## Example Test Run

```bash
# Terminal 1: Run the test
./run-multi-agent-test.sh

# Terminal 2: Watch agent 1
tail -f local_deploy/agent1.log

# Terminal 3: Watch agent 2
tail -f local_deploy/agent2.log

# Terminal 4: Monitor git activity
watch -n 1 'cd local_deploy/worktrees && ls -la */concurrent-test.md'
```

## Interpreting Results

### Successful Test
- Both agents commit and push
- Git history shows merged branches
- No error messages in logs
- Files contain expected content

### Conflict Detected
- One agent shows "push failed"
- Logs show merge/rebase attempts
- May see conflict markers in files
- Resolution attempts visible in logs

## Contributing

When adding new test scenarios:
1. Document the scenario clearly
2. Add to appropriate test script
3. Update this README
4. Test thoroughly before committing