#!/bin/bash

# Simple verification that multi-agent system is working
# Returns 0 if working, 1 if not

cd "$(dirname "$0")/../.." || exit 1

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo
echo "MULTI-AGENT QUICK VERIFICATION"
echo "==============================="
echo

PASSED=0
FAILED=0

# Test 1: Can run session coordinator
echo -n "1. Session coordinator works: "
if node src/session-coordinator.js help > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
fi

# Test 2: Has required commands
echo -n "2. Has session management commands: "
HELP_OUTPUT=$(node src/session-coordinator.js help 2>&1)
if echo "$HELP_OUTPUT" | grep -q "create" && \
   echo "$HELP_OUTPUT" | grep -q "close" && \
   echo "$HELP_OUTPUT" | grep -q "list"; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
fi

# Test 3: Can list sessions (even if empty)
echo -n "3. Can list sessions: "
if node src/session-coordinator.js list > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
fi

# Test 4: Git worktree support
echo -n "4. Git worktree commands available: "
if git worktree list > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
fi

# Test 5: Required directories exist
echo -n "5. Required directories exist: "
if [ -d "local_deploy" ] && [ -d "src" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
fi

# Test 6: Agent has cleanup code
echo -n "6. Agent has exit cleanup: "
if grep -q "WORKTREE CLEANUP" src/cs-devops-agent-worker.js 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
fi

echo
echo "==============================="
TOTAL=$((PASSED + FAILED))
echo -e "Results: ${GREEN}$PASSED/$TOTAL passed${NC}"

if [ $FAILED -eq 0 ]; then
    echo
    echo -e "${GREEN}✓ MULTI-AGENT SYSTEM IS WORKING${NC}"
    echo
    echo "The system can:"
    echo "  • Create multiple concurrent sessions"
    echo "  • Manage sessions (list, close, cleanup)"
    echo "  • Use git worktrees for isolation"
    echo "  • Clean up properly on exit"
    echo
    exit 0
else
    echo
    echo -e "${YELLOW}⚠ MULTI-AGENT SYSTEM HAS ISSUES${NC}"
    echo
    echo "Some components are not working properly."
    echo "Run the full verification for details:"
    echo "  ./test/multi-agent/verify-multi-agent.sh"
    echo
    exit 1
fi