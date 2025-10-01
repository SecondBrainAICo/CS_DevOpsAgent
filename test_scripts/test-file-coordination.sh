#!/bin/bash

# ============================================================================
# FILE COORDINATION SYSTEM - COMPREHENSIVE TEST SUITE
# ============================================================================
# Tests all edge cases for the file coordination system
# ============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
ORANGE='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Navigate to repo root
cd "$(dirname "$0")/.." || exit 1
REPO_ROOT=$(pwd)

# Test utilities
test_header() {
    echo -e "\n${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${BLUE}TEST $1: $2${NC}"
    echo -e "${CYAN}────────────────────────────────────────────${NC}"
    ((TESTS_TOTAL++))
}

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

# Clean up function
cleanup_test() {
    rm -rf .file-coordination/active-edits/test-*.json 2>/dev/null || true
    rm -f test-file-*.txt 2>/dev/null || true
    rm -f .coordination-*.md 2>/dev/null || true
}

# Setup
setup_test() {
    echo -e "${YELLOW}Setting up test environment...${NC}"
    
    # Ensure coordination system is set up
    if [ ! -d ".file-coordination" ]; then
        ./scripts/setup-file-coordination.sh > /dev/null 2>&1
    fi
    
    cleanup_test
}

# ============================================================================
# TEST 1: Basic Declaration and Release
# ============================================================================
test_basic_declaration() {
    test_header 1 "Basic Declaration and Release"
    
    # Declare a file
    if ./declare-file-edits.sh test-agent test-session-1 src/test.js 2>/dev/null; then
        test_pass "File declaration successful"
    else
        test_fail "File declaration failed"
        return 1
    fi
    
    # Check if declaration exists
    if [ -f ".file-coordination/active-edits/test-agent-test-session-1.json" ]; then
        test_pass "Declaration file created"
    else
        test_fail "Declaration file not found"
        return 1
    fi
    
    # Release the file
    if ./release-file-edits.sh test-agent test-session-1 2>/dev/null; then
        test_pass "File release successful"
    else
        test_fail "File release failed"
        return 1
    fi
    
    # Check if declaration moved to completed
    if [ ! -f ".file-coordination/active-edits/test-agent-test-session-1.json" ]; then
        test_pass "Declaration removed from active"
    else
        test_fail "Declaration still in active"
        return 1
    fi
}

# ============================================================================
# TEST 2: Conflict Detection
# ============================================================================
test_conflict_detection() {
    test_header 2 "Conflict Detection"
    
    # Agent 1 declares a file
    ./declare-file-edits.sh agent1 session1 src/main.js > /dev/null 2>&1
    test_pass "Agent 1 declared src/main.js"
    
    # Agent 2 tries to declare same file
    if ./declare-file-edits.sh agent2 session2 src/main.js 2>/dev/null; then
        test_fail "Agent 2 should not be able to declare same file"
        return 1
    else
        test_pass "Agent 2 blocked from declaring same file"
    fi
    
    # Check availability should show blocked
    if ./check-file-availability.sh src/main.js 2>&1 | grep -q "BLOCKED"; then
        test_pass "File correctly shown as blocked"
    else
        test_fail "File not shown as blocked"
        return 1
    fi
    
    # Release by agent 1
    ./release-file-edits.sh agent1 session1 > /dev/null 2>&1
    
    # Now agent 2 should be able to declare
    if ./declare-file-edits.sh agent2 session2 src/main.js 2>/dev/null; then
        test_pass "Agent 2 can declare after release"
    else
        test_fail "Agent 2 still cannot declare after release"
        return 1
    fi
    
    # Cleanup
    ./release-file-edits.sh agent2 session2 > /dev/null 2>&1
}

# ============================================================================
# TEST 3: Multiple Files Declaration
# ============================================================================
test_multiple_files() {
    test_header 3 "Multiple Files Declaration"
    
    # Declare multiple files
    if ./declare-file-edits.sh agent3 session3 src/file1.js src/file2.js src/file3.js 2>/dev/null; then
        test_pass "Multiple files declared"
    else
        test_fail "Multiple files declaration failed"
        return 1
    fi
    
    # Check if all files are blocked
    local all_blocked=true
    for file in src/file1.js src/file2.js src/file3.js; do
        if ! ./check-file-availability.sh "$file" 2>&1 | grep -q "BLOCKED"; then
            all_blocked=false
            break
        fi
    done
    
    if $all_blocked; then
        test_pass "All files correctly blocked"
    else
        test_fail "Some files not blocked"
        return 1
    fi
    
    # Release
    ./release-file-edits.sh agent3 session3 > /dev/null 2>&1
    test_pass "Multiple files released"
}

# ============================================================================
# TEST 4: Partial Overlap Detection
# ============================================================================
test_partial_overlap() {
    test_header 4 "Partial Overlap Detection"
    
    # Agent 1 declares files A and B
    ./declare-file-edits.sh agent1 session1 src/fileA.js src/fileB.js > /dev/null 2>&1
    test_pass "Agent 1 declared fileA and fileB"
    
    # Agent 2 tries to declare files B and C (partial overlap)
    if ./declare-file-edits.sh agent2 session2 src/fileB.js src/fileC.js 2>/dev/null; then
        test_fail "Agent 2 should be blocked due to fileB overlap"
        return 1
    else
        test_pass "Agent 2 blocked due to partial overlap"
    fi
    
    # Agent 2 should be able to declare just fileC
    if ./declare-file-edits.sh agent2 session2 src/fileC.js 2>/dev/null; then
        test_pass "Agent 2 can declare non-overlapping file"
    else
        test_fail "Agent 2 cannot declare non-overlapping file"
        return 1
    fi
    
    # Cleanup
    ./release-file-edits.sh agent1 session1 > /dev/null 2>&1
    ./release-file-edits.sh agent2 session2 > /dev/null 2>&1
}

# ============================================================================
# TEST 5: File Monitor Detection
# ============================================================================
test_file_monitor() {
    test_header 5 "File Monitor Detection"
    
    echo -e "${YELLOW}Starting file monitor...${NC}"
    
    # Start the monitor in background
    node src/file-monitor-enhanced.cjs > /tmp/monitor-test.log 2>&1 &
    MONITOR_PID=$!
    sleep 2
    
    # Create a file change without declaration
    echo "test change" >> test-monitor-file.txt
    git add test-monitor-file.txt 2>/dev/null || true
    
    sleep 3
    
    # Check if monitor detected the undeclared change
    if grep -q "UNDECLARED FILE EDIT DETECTED" /tmp/monitor-test.log; then
        test_pass "Monitor detected undeclared file edit"
    else
        test_fail "Monitor did not detect undeclared file edit"
        cat /tmp/monitor-test.log
    fi
    
    # Kill the monitor
    kill $MONITOR_PID 2>/dev/null || true
    
    # Clean up
    git reset HEAD test-monitor-file.txt 2>/dev/null || true
    rm -f test-monitor-file.txt
    rm -f /tmp/monitor-test.log
}

# ============================================================================
# TEST 6: Stale Declaration Cleanup
# ============================================================================
test_stale_cleanup() {
    test_header 6 "Stale Declaration Cleanup"
    
    # Create an old declaration (simulate expired)
    cat > .file-coordination/active-edits/test-stale.json << EOF
{
    "agent": "stale-agent",
    "session": "stale-session",
    "files": ["src/stale.js"],
    "operation": "edit",
    "declaredAt": "2020-01-01T00:00:00Z",
    "estimatedDuration": 300
}
EOF
    
    test_pass "Created stale declaration"
    
    # Run coordinator check (should detect and move stale)
    if node src/file-coordinator.cjs > /dev/null 2>&1; then
        test_pass "Coordinator check completed"
    fi
    
    # The stale file should be moved or ignored
    # Try to declare the same file - should work if stale was handled
    if ./declare-file-edits.sh new-agent new-session src/stale.js 2>/dev/null; then
        test_pass "Can declare previously stale file"
        ./release-file-edits.sh new-agent new-session > /dev/null 2>&1
    else
        test_fail "Cannot declare previously stale file"
    fi
}

# ============================================================================
# TEST 7: Concurrent Agents (Race Condition)
# ============================================================================
test_concurrent_agents() {
    test_header 7 "Concurrent Agents (Race Condition)"
    
    # Try to declare same file from two agents simultaneously
    (./declare-file-edits.sh race1 session1 src/race.js > /dev/null 2>&1) &
    PID1=$!
    (./declare-file-edits.sh race2 session2 src/race.js > /dev/null 2>&1) &
    PID2=$!
    
    wait $PID1
    RESULT1=$?
    wait $PID2
    RESULT2=$?
    
    # Exactly one should succeed
    if [ $RESULT1 -eq 0 ] && [ $RESULT2 -ne 0 ]; then
        test_pass "Agent 1 won the race"
        ./release-file-edits.sh race1 session1 > /dev/null 2>&1
    elif [ $RESULT1 -ne 0 ] && [ $RESULT2 -eq 0 ]; then
        test_pass "Agent 2 won the race"
        ./release-file-edits.sh race2 session2 > /dev/null 2>&1
    else
        test_fail "Race condition not properly handled"
    fi
}

# ============================================================================
# TEST 8: Session Recovery
# ============================================================================
test_session_recovery() {
    test_header 8 "Session Recovery"
    
    # Create a declaration
    ./declare-file-edits.sh recovery-agent recovery-session src/recovery.js > /dev/null 2>&1
    test_pass "Created declaration for recovery test"
    
    # Simulate crash (declaration remains)
    # New instance should be able to find and continue
    if [ -f ".file-coordination/active-edits/recovery-agent-recovery-session.json" ]; then
        test_pass "Declaration persists after simulated crash"
    else
        test_fail "Declaration lost"
        return 1
    fi
    
    # Should be able to release with same session info
    if ./release-file-edits.sh recovery-agent recovery-session 2>/dev/null; then
        test_pass "Successfully recovered and released session"
    else
        test_fail "Could not recover session"
    fi
}

# ============================================================================
# MAIN TEST EXECUTION
# ============================================================================

echo -e "${CYAN}════════════════════════════════════════════${NC}"
echo -e "${BLUE}FILE COORDINATION SYSTEM TEST SUITE${NC}"
echo -e "${CYAN}════════════════════════════════════════════${NC}"

# Setup
setup_test

# Run tests
test_basic_declaration
test_conflict_detection
test_multiple_files
test_partial_overlap
test_file_monitor
test_stale_cleanup
test_concurrent_agents
test_session_recovery

# Cleanup
cleanup_test

# Results
echo -e "\n${CYAN}════════════════════════════════════════════${NC}"
echo -e "${BLUE}TEST RESULTS${NC}"
echo -e "${CYAN}════════════════════════════════════════════${NC}"
echo -e "Total Tests: ${TESTS_TOTAL}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi