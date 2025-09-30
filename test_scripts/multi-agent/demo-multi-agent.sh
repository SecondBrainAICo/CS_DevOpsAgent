#!/bin/bash

# ============================================================================
# MULTI-AGENT DEMO - Simple demonstration of concurrent agents
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

print_section() {
    echo
    echo "============================================================"
    print_color "${BOLD}${CYAN}" "$1"
    echo "============================================================"
    echo
}

# Navigate to repo root
cd "$(dirname "$0")/../.." || exit 1

print_section "MULTI-AGENT FUNCTIONALITY DEMO"

print_color "${YELLOW}" "This demo will show you:"
print_color "${CYAN}" "  1. How to create multiple sessions"
print_color "${CYAN}" "  2. How agents work in parallel"
print_color "${CYAN}" "  3. What happens when they edit the same files"
print_color "${CYAN}" "  4. How conflicts are handled"
echo

print_color "${YELLOW}" "Press Enter to start the demo..."
read -r

# Step 1: Create first session
print_section "STEP 1: Creating First Session"
print_color "${CYAN}" "Creating a session for Agent 1..."
echo "n" | node src/session-coordinator.js create --task "demo-agent-1" --agent "demo1" > /tmp/session1.log 2>&1

SESSION1=$(grep "Session ID:" /tmp/session1.log | awk '{print $3}')
WORKTREE1=$(grep "Worktree created at:" /tmp/session1.log | sed 's/.*Worktree created at: //')

if [ -z "$SESSION1" ]; then
    print_color "${RED}" "Failed to create session 1"
    cat /tmp/session1.log
    exit 1
fi

print_color "${GREEN}" "✓ Created Session 1: $SESSION1"
print_color "${CYAN}" "  Worktree: $WORKTREE1"
echo

# Step 2: Create second session
print_section "STEP 2: Creating Second Session"
print_color "${CYAN}" "Creating a session for Agent 2..."
echo "n" | node src/session-coordinator.js create --task "demo-agent-2" --agent "demo2" > /tmp/session2.log 2>&1

SESSION2=$(grep "Session ID:" /tmp/session2.log | awk '{print $3}')
WORKTREE2=$(grep "Worktree created at:" /tmp/session2.log | sed 's/.*Worktree created at: //')

if [ -z "$SESSION2" ]; then
    print_color "${RED}" "Failed to create session 2"
    cat /tmp/session2.log
    exit 1
fi

print_color "${GREEN}" "✓ Created Session 2: $SESSION2"
print_color "${CYAN}" "  Worktree: $WORKTREE2"
echo

print_section "STEP 3: What You're Seeing"

print_color "${BOLD}${GREEN}" "SUCCESS INDICATORS:"
echo
print_color "${GREEN}" "✓ Two separate sessions created"
print_color "${GREEN}" "✓ Each has its own worktree (isolated workspace)"
print_color "${GREEN}" "✓ Each has its own branch"
echo

print_color "${BOLD}${CYAN}" "WORKTREE LOCATIONS:"
echo "  Agent 1: $WORKTREE1"
echo "  Agent 2: $WORKTREE2"
echo

print_color "${BOLD}${CYAN}" "SESSION IDs:"
echo "  Agent 1: $SESSION1"
echo "  Agent 2: $SESSION2"
echo

print_section "STEP 4: Simulating Concurrent Work"

print_color "${YELLOW}" "Creating a test file in Agent 1's worktree..."
cat > "$WORKTREE1/concurrent-test.txt" << EOF
Test file created by Agent 1
Time: $(date)
Session: $SESSION1
EOF

print_color "${GREEN}" "✓ File created by Agent 1"
echo

print_color "${YELLOW}" "Agent 1 committing..."
cd "$WORKTREE1"
git add concurrent-test.txt
git commit -m "test: Agent 1 creates test file" > /dev/null 2>&1
git push origin "$(git rev-parse --abbrev-ref HEAD)" > /dev/null 2>&1
print_color "${GREEN}" "✓ Agent 1 pushed changes"
echo

print_color "${YELLOW}" "Agent 2 pulling and modifying the same file..."
cd "$WORKTREE2"
git pull origin "$(git rev-parse --abbrev-ref HEAD)" > /dev/null 2>&1
echo "Modified by Agent 2 at $(date)" >> concurrent-test.txt
git add concurrent-test.txt
git commit -m "test: Agent 2 modifies test file" > /dev/null 2>&1

print_color "${YELLOW}" "Agent 2 attempting to push (this might conflict)..."
if git push origin "$(git rev-parse --abbrev-ref HEAD)" > /dev/null 2>&1; then
    print_color "${GREEN}" "✓ No conflict - Agent 2 pushed successfully"
else
    print_color "${YELLOW}" "⚠ Push failed - conflict detected (this is expected!)"
    print_color "${CYAN}" "This demonstrates what happens when agents work on the same branch"
fi

print_section "DEMO COMPLETE"

print_color "${BOLD}${GREEN}" "What This Demonstrated:"
echo
print_color "${CYAN}" "1. Multiple sessions can be created independently"
print_color "${CYAN}" "2. Each session gets its own isolated worktree"
print_color "${CYAN}" "3. Agents can work in parallel without interfering"
print_color "${CYAN}" "4. Git handles conflicts when they edit the same files"
echo

print_color "${BOLD}${YELLOW}" "Key Takeaways:"
echo
print_color "${CYAN}" "• The system is working if you see separate worktrees created"
print_color "${CYAN}" "• Each agent operates in its own directory (no interference)"
print_color "${CYAN}" "• Conflicts only happen if they push to the same branch"
print_color "${CYAN}" "• The DevOps agent would handle these scenarios automatically"
echo

print_color "${YELLOW}" "Clean up sessions? (y/n): "
read -r answer

if [ "$answer" = "y" ]; then
    print_color "${CYAN}" "Cleaning up..."
    echo "Y" | node src/session-coordinator.js close "$SESSION1" > /dev/null 2>&1
    echo "Y" | node src/session-coordinator.js close "$SESSION2" > /dev/null 2>&1
    print_color "${GREEN}" "✓ Sessions cleaned up"
else
    print_color "${CYAN}" "Sessions kept. To clean up later, run:"
    echo "  node src/session-coordinator.js close $SESSION1"
    echo "  node src/session-coordinator.js close $SESSION2"
fi

echo
print_color "${GREEN}" "Demo complete!"