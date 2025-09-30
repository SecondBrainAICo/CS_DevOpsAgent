#!/bin/bash

# ============================================================================
# MULTI-AGENT TEST RUNNER
# ============================================================================
# This script creates two sessions, starts agents, and tests concurrent work
#
# Usage: ./run-multi-agent-test.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

print_section() {
    echo
    print_color "${BOLD}${CYAN}" "============================================================"
    print_color "${BOLD}${CYAN}" "$1"
    print_color "${BOLD}${CYAN}" "============================================================"
    echo
}

cleanup_sessions() {
    print_color "${YELLOW}" "Cleaning up sessions..."
    
    # Kill any running agents
    pkill -f "cs-devops-agent-worker.js" 2>/dev/null || true
    pkill -f "session-coordinator.js start" 2>/dev/null || true
    
    # Clean up session files
    rm -rf "$REPO_ROOT/local_deploy/session-locks/"*.lock 2>/dev/null || true
    
    print_color "${GREEN}" "Cleanup complete"
}

# Trap to ensure cleanup on exit
trap cleanup_sessions EXIT

print_section "MULTI-AGENT CONCURRENT TESTING SETUP"

# Navigate to repo root
cd "$REPO_ROOT"

print_color "${YELLOW}" "Creating two test sessions..."

# Create first session
print_color "${CYAN}" "Creating session 1..."
SESSION1_OUTPUT=$(node src/session-coordinator.js create --task "multi-agent-test-1" --agent "test1" 2>&1)
SESSION1=$(echo "$SESSION1_OUTPUT" | grep -oE 'Session ID: [a-z0-9-]+' | cut -d' ' -f3)

if [ -z "$SESSION1" ]; then
    print_color "${RED}" "Failed to create session 1"
    echo "$SESSION1_OUTPUT"
    exit 1
fi

print_color "${GREEN}" "✓ Created session 1: $SESSION1"

# Create second session
print_color "${CYAN}" "Creating session 2..."
SESSION2_OUTPUT=$(node src/session-coordinator.js create --task "multi-agent-test-2" --agent "test2" 2>&1)
SESSION2=$(echo "$SESSION2_OUTPUT" | grep -oE 'Session ID: [a-z0-9-]+' | cut -d' ' -f3)

if [ -z "$SESSION2" ]; then
    print_color "${RED}" "Failed to create session 2"
    echo "$SESSION2_OUTPUT"
    exit 1
fi

print_color "${GREEN}" "✓ Created session 2: $SESSION2"

# Find worktree paths
WORKTREE1=$(find "$REPO_ROOT/local_deploy/worktrees" -maxdepth 1 -name "*${SESSION1}*" -type d | head -1)
WORKTREE2=$(find "$REPO_ROOT/local_deploy/worktrees" -maxdepth 1 -name "*${SESSION2}*" -type d | head -1)

print_color "${CYAN}" "Worktree 1: $WORKTREE1"
print_color "${CYAN}" "Worktree 2: $WORKTREE2"

print_section "STARTING DEVOPS AGENTS"

# Start agent 1 in background
print_color "${YELLOW}" "Starting DevOps agent for session 1..."
(
    cd "$REPO_ROOT"
    node src/session-coordinator.js start "$SESSION1" > "$REPO_ROOT/local_deploy/agent1.log" 2>&1 &
)
AGENT1_PID=$!
print_color "${GREEN}" "✓ Agent 1 started (PID: $AGENT1_PID)"

# Start agent 2 in background
print_color "${YELLOW}" "Starting DevOps agent for session 2..."
(
    cd "$REPO_ROOT"
    node src/session-coordinator.js start "$SESSION2" > "$REPO_ROOT/local_deploy/agent2.log" 2>&1 &
)
AGENT2_PID=$!
print_color "${GREEN}" "✓ Agent 2 started (PID: $AGENT2_PID)"

# Give agents time to initialize
print_color "${YELLOW}" "Waiting for agents to initialize..."
sleep 5

print_section "RUNNING CONCURRENT EDIT TESTS"

# Create a test file that both agents will edit
TEST_FILE="concurrent-test.md"

print_color "${CYAN}" "Test 1: Creating initial file in worktree 1..."
cat > "$WORKTREE1/$TEST_FILE" << EOF
# Concurrent Edit Test
Version: 1.0
Last Updated: $(date)

## Edits Log
EOF

# Create commit message for agent 1
echo "test: initialize concurrent test file" > "$WORKTREE1/.devops-commit-${SESSION1}.msg"
sleep 3  # Wait for agent to commit

print_color "${CYAN}" "Test 2: Agent 2 pulls and edits..."
cd "$WORKTREE2"
git pull origin "$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null || true

# Agent 2 adds content
echo "- Agent 2 edit at $(date '+%H:%M:%S')" >> "$WORKTREE2/$TEST_FILE"
echo "test: Agent 2 adds entry" > "$WORKTREE2/.devops-commit-${SESSION2}.msg"

print_color "${CYAN}" "Test 3: Agent 1 edits simultaneously..."
echo "- Agent 1 edit at $(date '+%H:%M:%S')" >> "$WORKTREE1/$TEST_FILE"
echo "test: Agent 1 adds entry" > "$WORKTREE1/.devops-commit-${SESSION1}.msg"

# Wait for commits
print_color "${YELLOW}" "Waiting for agents to process commits..."
sleep 5

print_section "CONFLICT TEST"

# Create a file both will edit on the same line
CONFLICT_FILE="conflict-test.json"

print_color "${CYAN}" "Creating conflict scenario..."

# Agent 1 creates JSON file
cat > "$WORKTREE1/$CONFLICT_FILE" << EOF
{
  "status": "pending",
  "count": 0,
  "agent": "none"
}
EOF

echo "test: create conflict test JSON" > "$WORKTREE1/.devops-commit-${SESSION1}.msg"
sleep 3

# Both agents modify the same fields
cd "$WORKTREE2"
git pull origin "$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null || true

# Simultaneous conflicting edits
print_color "${YELLOW}" "Both agents editing same fields..."

# Agent 1 changes
cat > "$WORKTREE1/$CONFLICT_FILE" << EOF
{
  "status": "completed",
  "count": 1,
  "agent": "agent1"
}
EOF

# Agent 2 changes (before Agent 1 pushes)
cat > "$WORKTREE2/$CONFLICT_FILE" << EOF
{
  "status": "in_progress",
  "count": 2,
  "agent": "agent2"
}
EOF

# Trigger commits
echo "test: Agent 1 updates JSON" > "$WORKTREE1/.devops-commit-${SESSION1}.msg"
echo "test: Agent 2 updates JSON" > "$WORKTREE2/.devops-commit-${SESSION2}.msg"

print_color "${YELLOW}" "Waiting for conflict resolution..."
sleep 10

print_section "TEST RESULTS"

# Check agent logs for conflicts
print_color "${BOLD}${CYAN}" "Agent 1 Log (last 20 lines):"
tail -n 20 "$REPO_ROOT/local_deploy/agent1.log" | grep -E "(commit|push|conflict|merge|rebase)" || true

echo
print_color "${BOLD}${CYAN}" "Agent 2 Log (last 20 lines):"
tail -n 20 "$REPO_ROOT/local_deploy/agent2.log" | grep -E "(commit|push|conflict|merge|rebase)" || true

# Show git history from worktree 1
echo
cd "$WORKTREE1"
git pull origin "$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null || true
print_color "${BOLD}${GREEN}" "Git History (last 10 commits):"
git log --oneline --graph -10

# Show file contents
echo
if [ -f "$TEST_FILE" ]; then
    print_color "${BOLD}${GREEN}" "Contents of $TEST_FILE:"
    cat "$TEST_FILE"
fi

echo
if [ -f "$CONFLICT_FILE" ]; then
    print_color "${BOLD}${GREEN}" "Contents of $CONFLICT_FILE:"
    cat "$CONFLICT_FILE"
fi

print_section "CLEANUP OPTIONS"

print_color "${YELLOW}" "Test complete! Agents are still running."
print_color "${CYAN}" "Options:"
print_color "${CYAN}" "  1. Press Ctrl+C to stop agents and clean up"
print_color "${CYAN}" "  2. Keep agents running to observe behavior"
print_color "${CYAN}" "  3. Check logs: tail -f local_deploy/agent[1|2].log"

# Keep script running until user interrupts
print_color "${GREEN}" "Press Ctrl+C to stop agents and exit..."
wait