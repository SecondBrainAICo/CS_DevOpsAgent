# Test Scripts Directory

This directory contains all test scripts for the CS_DevOpsAgent system.

## Directory Structure

```
test_scripts/
├── multi-agent/           # Multi-agent and conflict testing
│   ├── quick-verify.sh    # Quick system verification (7 tests)
│   ├── test-conflicts.sh  # Conflict scenario demonstrations
│   ├── verify-multi-agent.sh # Comprehensive verification (14 tests)
│   ├── demo-multi-agent.sh   # Interactive demonstration
│   └── ...
├── test-coordination.sh   # Session coordination tests
├── test-e2e-multi-session.sh # End-to-end multi-session tests
├── test-multi-claude.sh    # Multiple Claude agent tests
└── test-push-behind-scenario.sh # Push conflict scenarios
```

## Quick Start

### 1. Verify System is Working
```bash
./test_scripts/multi-agent/quick-verify.sh
```
✅ **Pass Criteria:** 7/7 tests pass

### 2. Test Conflict Handling
```bash
./test_scripts/multi-agent/test-conflicts.sh
```
Shows how the system handles:
- No conflicts (different files)
- Auto-merge (different sections)
- Manual resolution (same lines)

### 3. Full System Test
```bash
./test_scripts/multi-agent/verify-multi-agent.sh
```
✅ **Pass Criteria:** 14/14 tests pass

## Test Categories

### Multi-Agent Tests (`multi-agent/`)
Tests for concurrent agent operations, conflict resolution, and session management.

**Key Scripts:**
- `quick-verify.sh` - Fast verification (< 5 seconds)
- `test-conflicts.sh` - Conflict scenarios with visual output
- `verify-multi-agent.sh` - Comprehensive system check
- `demo-multi-agent.sh` - Interactive walkthrough

### Coordination Tests
- `test-coordination.sh` - Session coordination logic
- `test-coordination-simple.sh` - Basic coordination tests

### End-to-End Tests
- `test-e2e-multi-session.sh` - Full workflow testing
- `test-standalone-multi-session.sh` - Independent session tests

### Scenario Tests
- `test-push-behind-scenario.sh` - Git push conflict scenarios
- `test-multi-claude.sh` - Multiple Claude agent scenarios

## Understanding Test Results

### Success Indicators
- ✅ Green checkmarks for passed tests
- Clear "ALL TESTS PASSED" message
- Exit code 0

### Failure Indicators
- ❌ Red X marks for failed tests
- Specific error messages
- Exit code 1

### Conflict Test Results
When running conflict tests, you'll see:
- **No Conflict** - Clean merges
- **Auto-Merged** - Git resolved automatically
- **Manual Resolution** - Human intervention needed

## Troubleshooting

### Common Issues

1. **"Session coordinator not found"**
   - Ensure you're in the repo root
   - Check node is installed: `node --version`

2. **"Git worktree commands failed"**
   - Verify git version: `git --version`
   - Clean worktrees: `git worktree prune`

3. **"Cannot create sessions"**
   - Clean up old sessions: `node src/session-coordinator.js cleanup`
   - Check disk space

### Debug Mode
Enable debug output:
```bash
DEBUG=true ./test_scripts/multi-agent/test-conflicts.sh
```

## Best Practices

1. **Before Running Tests**
   - Clean old sessions: `node src/session-coordinator.js cleanup`
   - Ensure main branch is up to date

2. **After Tests**
   - Tests auto-cleanup on exit
   - Manual cleanup: `node src/session-coordinator.js list` then `close`

3. **Conflict Testing**
   - Run on a test branch
   - Review conflict markers carefully
   - Understand merge vs rebase strategies

## Contributing

When adding new tests:
1. Place in appropriate category folder
2. Make executable: `chmod +x script.sh`
3. Add to this README
4. Include cleanup in script (trap EXIT)
5. Use consistent output formatting

## Support

For issues or questions:
- Check test output for specific errors
- Review logs in `local_deploy/`
- Run `quick-verify.sh` first for basic diagnosis