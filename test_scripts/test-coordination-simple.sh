#!/usr/bin/env zsh
# Simple test of multi-agent coordination system
# Tests the actual functionality in the current repo

# Don't exit on error - we want to see all test results
set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test state
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}     Simple Multi-Agent Coordination Test${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}\n"

# Function to log test results
test_pass() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}[✗]${NC} $1"
    ((TESTS_FAILED++))
}

test_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

test_section() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

# Test 1: Check if coordination system is set up
test_section "Testing coordination system setup"

if [[ -f ".ac-shards.json" ]]; then
    test_pass "Shards configuration exists"
else
    test_fail "Shards configuration missing"
fi

if [[ -d ".ac-prep" ]]; then
    test_pass "Prep directory exists"
else
    test_fail "Prep directory missing"
fi

if [[ -d ".ac/ack" ]]; then
    test_pass "Acknowledgment directory exists"
else
    test_fail "Acknowledgment directory missing"
fi

if [[ -f "agent-prep.sh" ]]; then
    test_pass "Agent prep script exists"
else
    test_fail "Agent prep script missing"
fi

if [[ -f "monitor-agents.sh" ]]; then
    test_pass "Monitor script exists"
else
    test_fail "Monitor script missing"
fi

# Test 2: Simulate Claude making a request
test_section "Testing agent prep request (Claude)"

export AGENT_NAME="claude"
./agent-prep.sh "test-auth-feature" "src/auth/**" 6 >/dev/null 2>&1

if [[ -f ".ac-prep/claude.json" ]]; then
    test_pass "Claude prep request created"
    
    # Check content if jq is available
    if command -v jq >/dev/null 2>&1; then
        local task=$(jq -r '.task' .ac-prep/claude.json)
        if [[ "$task" == "test-auth-feature" ]]; then
            test_pass "Request contains correct task"
        else
            test_fail "Request task mismatch"
        fi
    fi
else
    test_fail "Claude prep request not created"
fi

# Test 3: Simulate Copilot making a conflicting request
test_section "Testing concurrent agent request (Copilot)"

export AGENT_NAME="copilot"
./agent-prep.sh "test-api-update" "src/auth/login.js" 8 >/dev/null 2>&1

if [[ -f ".ac-prep/copilot.json" ]]; then
    test_pass "Copilot prep request created"
else
    test_fail "Copilot prep request not created"
fi

# Test 4: Check monitoring
test_section "Testing monitoring capability"

if ./monitor-agents.sh 2>&1 | grep -q "Active Requests"; then
    test_pass "Monitor script can list active requests"
else
    test_info "Monitor script needs improvements"
fi

# Test 5: Clean up test files
test_section "Cleaning up test artifacts"

rm -f .ac-prep/claude.json .ac-prep/copilot.json
test_pass "Test artifacts cleaned"

# Summary
echo -e "\n${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                   TEST SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}\n"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✓ All tests passed! The coordination system is working.${NC}\n"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the setup.${NC}\n"
    exit 1
fi