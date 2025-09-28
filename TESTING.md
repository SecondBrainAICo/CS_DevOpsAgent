# 🧪 CS_DevOpsAgent Multi-Session Testing Guide

## Overview

This guide provides comprehensive instructions for testing multi-session Git operations and the CS_DevOpsAgent system across multiple concurrent sessions on a local machine.

## Test Suites Available

### 1. Standalone Multi-Session Test (`test-standalone-multi-session.sh`)
**Purpose**: Tests pure Git operations without DevOpsAgent dependencies
**Requirements**: Only Git and Bash
**Use Case**: Validating Git's concurrent session handling

### 2. E2E Multi-Session Test (`test-e2e-multi-session.sh`)
**Purpose**: Tests the complete CS_DevOpsAgent system
**Requirements**: Node.js, Git, DevOpsAgent components
**Use Case**: Full system validation including devops-agent features

## Quick Start

### Running Standalone Tests (Recommended)
```bash
# Make script executable
chmod +x test-standalone-multi-session.sh

# Run the test suite
./test-standalone-multi-session.sh
```

### Running Full E2E Tests
```bash
# Ensure dependencies are installed
npm install

# Make script executable
chmod +x test-e2e-multi-session.sh

# Run the test suite
./test-e2e-multi-session.sh
```

## Test Scenarios

### 1. Parallel Operations Test
**What it tests**: Multiple Git sessions making commits simultaneously
**Expected behavior**: Some operations may fail with lock errors (this is correct Git behavior)
**Success criteria**: At least some commits succeed, demonstrating proper lock handling

### 2. Worktree Isolation Test
**What it tests**: Git worktree feature for agent isolation
**Expected behavior**: Each agent works in its own worktree without conflicts
**Success criteria**: All worktrees created and commits successful

### 3. Concurrent Branches Test
**What it tests**: Multiple branches being created and modified simultaneously
**Expected behavior**: Branches are created successfully, some operations may be serialized
**Success criteria**: All requested branches exist after test

### 4. File Locking Test
**What it tests**: Custom file locking mechanism for preventing conflicts
**Expected behavior**: Some sessions blocked when trying to access locked files
**Success criteria**: Lock mechanism prevents simultaneous file modifications

### 5. Session Recovery Test
**What it tests**: Ability to recover from interrupted sessions
**Expected behavior**: State is preserved and work can be resumed
**Success criteria**: Interrupted work is completed after recovery

### 6. Performance Test
**What it tests**: System performance under concurrent load
**Expected behavior**: Multiple operations complete within reasonable time
**Success criteria**: All files created, execution time is reasonable

### 7. Remote Operations Test
**What it tests**: Push/pull operations from multiple sessions
**Expected behavior**: Changes are synchronized through remote repository
**Success criteria**: All sessions can push their changes (may require retries)

## Understanding Test Results

### Successful Output
```
✓ All tests passed! ✨
Total Tests: 7
Passed: 7
Failed: 0
```

### Partial Success (Expected)
```
Total Tests: 7
Passed: 6
Failed: 1
```
Note: Some failures are expected and demonstrate proper conflict handling

### Common "Failures" That Are Actually Successes

1. **Git Lock Errors**: 
   - Error: `Unable to create '.git/index.lock': File exists`
   - Meaning: Git is properly preventing concurrent modifications
   - This is CORRECT behavior!

2. **Blocked Sessions**:
   - Message: `BLOCKED: Session X could not acquire lock`
   - Meaning: Custom locking is working as designed
   - This prevents data corruption

3. **Merge Conflicts**:
   - Error: Merge conflict messages
   - Meaning: Git is detecting conflicting changes
   - Manual resolution would be required in real scenario

## Manual Testing Procedures

### Test 1: Simple Multi-Session Commit
```bash
# Terminal 1
cd test-repo
echo "Session 1" > file1.txt
git add file1.txt
git commit -m "Session 1 commit"

# Terminal 2 (simultaneously)
cd test-repo
echo "Session 2" > file2.txt
git add file2.txt
git commit -m "Session 2 commit"
```

### Test 2: Worktree-Based Isolation
```bash
# Create worktrees for different agents
git worktree add ../agent-claude -b agent/claude/main
git worktree add ../agent-copilot -b agent/copilot/main

# Work in each worktree independently
cd ../agent-claude
echo "Claude's work" > claude.txt
git add claude.txt
git commit -m "Claude's changes"

cd ../agent-copilot
echo "Copilot's work" > copilot.txt
git add copilot.txt
git commit -m "Copilot's changes"
```

### Test 3: Session State Recovery
```bash
# Start a session and save state
echo "working_on_feature_x" > .git/session_state
echo "Partial work" > feature.txt

# Kill the session (Ctrl+C)

# Recover in new session
if [ -f .git/session_state ]; then
    state=$(cat .git/session_state)
    echo "Resuming: $state"
    echo "Completed work" >> feature.txt
    git add feature.txt
    git commit -m "Completed feature X (recovered)"
fi
```

## Monitoring Active Sessions

### Check for Active Git Processes
```bash
ps aux | grep git
```

### Monitor File Locks
```bash
ls -la .git/*.lock 2>/dev/null
```

### View Git Worktrees
```bash
git worktree list
```

### Check Branch Status
```bash
git branch -a
```

## Troubleshooting

### Issue: Tests hang or timeout
**Solution**: Kill any stuck Git processes
```bash
pkill -f git
rm -f .git/index.lock
```

### Issue: Permission denied errors
**Solution**: Ensure proper permissions
```bash
chmod -R u+rwx test-standalone-workspace
```

### Issue: Worktree errors
**Solution**: Clean up broken worktrees
```bash
git worktree prune
git worktree remove <path> --force
```

### Issue: Remote push failures
**Solution**: Pull latest changes first
```bash
git pull --rebase origin main
git push origin main
```

## Performance Metrics

### Expected Performance Benchmarks
- Parallel commits: 5-10 operations in < 2 seconds
- Worktree creation: < 1 second per worktree
- Session recovery: < 1 second
- Remote sync: < 3 seconds for 3 sessions

### Monitoring Performance
```bash
# Time a test run
time ./test-standalone-multi-session.sh

# Check system resources during test
top -pid $(pgrep -f test-standalone)
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Multi-Session Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run standalone tests
        run: |
          chmod +x test-standalone-multi-session.sh
          ./test-standalone-multi-session.sh
```

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit
./test-standalone-multi-session.sh
if [ $? -ne 0 ]; then
    echo "Multi-session tests failed. Commit aborted."
    exit 1
fi
```

## Best Practices

1. **Always run tests in isolated environment**: Use the test workspace directory
2. **Clean up after tests**: The scripts auto-cleanup, but verify manually if needed
3. **Review logs**: Check `logs_*/` directories for detailed information
4. **Test regularly**: Run after major changes to Git workflow
5. **Document failures**: Some failures are expected - document which ones

## Advanced Testing

### Stress Testing
```bash
# Run multiple test iterations
for i in {1..10}; do
    echo "Test iteration $i"
    ./test-standalone-multi-session.sh
    sleep 2
done
```

### Custom Test Scenarios
Add new test functions to the scripts:
```bash
test_custom_scenario() {
    print_test "Custom scenario description"
    # Your test logic here
    echo "PASS: Custom scenario" >> "$RESULTS_FILE"
}
```

## Summary

The testing framework validates that:
1. ✅ Git properly handles concurrent access with locking
2. ✅ Worktrees provide isolation for multiple agents
3. ✅ Session state can be recovered after interruption
4. ✅ Performance remains acceptable under load
5. ✅ Remote synchronization works across sessions

Remember: Some "failures" are actually successful demonstrations of conflict prevention!

## Support

For issues or questions:
- Check logs in `test-standalone-workspace/logs_*/`
- Review Git documentation for concurrent access
- Open an issue on GitHub with test output

---

**Last Updated**: September 2025
**Version**: 1.0.0
**Repository**: [CS_DevOpsAgent](https://github.com/SecondBrainAICo/CS_DevOpsAgent)