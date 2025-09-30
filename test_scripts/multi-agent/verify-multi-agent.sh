#!/bin/bash

# ============================================================================
# MULTI-AGENT SYSTEM VERIFICATION
# ============================================================================
# This script verifies that the multi-agent system is working correctly
# by checking specific conditions and reporting pass/fail status
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Navigate to repo root
cd "$(dirname "$0")/../.." || exit 1
REPO_ROOT=$(pwd)

print_test() {
    local status=$1
    local test_name=$2
    local details=$3
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} ${test_name}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        if [ -n "$details" ]; then
            echo -e "  ${CYAN}${details}${NC}"
        fi
    else
        echo -e "${RED}✗${NC} ${test_name}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        if [ -n "$details" ]; then
            echo -e "  ${YELLOW}${details}${NC}"
        fi
    fi
}

print_section() {
    echo
    echo -e "${BOLD}${CYAN}$1${NC}"
    echo "----------------------------------------"
}

# ============================================================================
# TEST FUNCTIONS
# ============================================================================

test_session_coordinator_exists() {
    if [ -f "src/session-coordinator.js" ]; then
        print_test "PASS" "Session coordinator exists"
    else
        print_test "FAIL" "Session coordinator exists" "File not found: src/session-coordinator.js"
    fi
}

test_session_coordinator_runs() {
    if node src/session-coordinator.js --help > /dev/null 2>&1; then
        print_test "PASS" "Session coordinator runs without errors"
    else
        print_test "FAIL" "Session coordinator runs without errors" "Failed to run session-coordinator.js"
    fi
}

test_session_commands_available() {
    local help_output=$(node src/session-coordinator.js --help 2>&1)
    local commands_found=0
    local missing_commands=""
    
    for cmd in "create" "start" "list" "close" "cleanup"; do
        if echo "$help_output" | grep -q "$cmd"; then
            commands_found=$((commands_found + 1))
        else
            missing_commands="$missing_commands $cmd"
        fi
    done
    
    if [ $commands_found -eq 5 ]; then
        print_test "PASS" "All session commands available" "create, start, list, close, cleanup"
    else
        print_test "FAIL" "All session commands available" "Missing:$missing_commands"
    fi
}

test_directories_exist() {
    local all_exist=true
    local missing_dirs=""
    
    for dir in "local_deploy" "src" "test/multi-agent"; do
        if [ ! -d "$dir" ]; then
            all_exist=false
            missing_dirs="$missing_dirs $dir"
        fi
    done
    
    if $all_exist; then
        print_test "PASS" "Required directories exist"
    else
        print_test "FAIL" "Required directories exist" "Missing:$missing_dirs"
    fi
}

test_can_create_session() {
    # Create a test session
    local session_output=$(echo "n" | node src/session-coordinator.js create --task "verify-test" --agent "verify" 2>&1)
    local session_id=$(echo "$session_output" | grep "^Session ID:" | head -1 | cut -d':' -f2 | tr -d ' ')
    
    if [ -n "$session_id" ] && [[ "$session_id" =~ ^[a-z0-9]+-[a-z0-9]+$ ]]; then
        print_test "PASS" "Can create new session" "Session ID: $session_id"
        
        # Store for cleanup
        echo "$session_id" > /tmp/test_session_id.txt
        return 0
    else
        print_test "FAIL" "Can create new session" "No valid session ID found in output"
        return 1
    fi
}

test_worktree_created() {
    if [ -f /tmp/test_session_id.txt ]; then
        local session_id=$(cat /tmp/test_session_id.txt)
        local worktree_exists=false
        
        for worktree in local_deploy/worktrees/*${session_id}*; do
            if [ -d "$worktree" ]; then
                worktree_exists=true
                print_test "PASS" "Worktree created for session" "$(basename "$worktree")"
                break
            fi
        done
        
        if ! $worktree_exists; then
            print_test "FAIL" "Worktree created for session" "No worktree found for session $session_id"
        fi
    else
        print_test "SKIP" "Worktree created for session" "No test session available"
    fi
}

test_session_lock_created() {
    if [ -f /tmp/test_session_id.txt ]; then
        local session_id=$(cat /tmp/test_session_id.txt)
        local lock_file="local_deploy/session-locks/${session_id}.lock"
        
        if [ -f "$lock_file" ]; then
            print_test "PASS" "Session lock file created" "$(basename "$lock_file")"
        else
            print_test "FAIL" "Session lock file created" "Lock file not found: $lock_file"
        fi
    else
        print_test "SKIP" "Session lock file created" "No test session available"
    fi
}

test_session_appears_in_list() {
    if [ -f /tmp/test_session_id.txt ]; then
        local session_id=$(cat /tmp/test_session_id.txt)
        local list_output=$(node src/session-coordinator.js list 2>&1)
        
        if echo "$list_output" | grep -q "$session_id"; then
            print_test "PASS" "Session appears in list command"
        else
            print_test "FAIL" "Session appears in list command" "Session $session_id not found in list"
        fi
    else
        print_test "SKIP" "Session appears in list command" "No test session available"
    fi
}

test_can_close_session() {
    if [ -f /tmp/test_session_id.txt ]; then
        local session_id=$(cat /tmp/test_session_id.txt)
        
        # Close the session
        echo -e "n\nY" | node src/session-coordinator.js close "$session_id" > /dev/null 2>&1
        
        # Check if lock file is removed
        if [ ! -f "local_deploy/session-locks/${session_id}.lock" ]; then
            print_test "PASS" "Can close session" "Session $session_id closed successfully"
            rm -f /tmp/test_session_id.txt
        else
            print_test "FAIL" "Can close session" "Lock file still exists after close"
        fi
    else
        print_test "SKIP" "Can close session" "No test session available"
    fi
}

test_git_worktree_commands() {
    local worktree_list=$(git worktree list 2>&1)
    
    if [ $? -eq 0 ]; then
        local worktree_count=$(echo "$worktree_list" | wc -l)
        print_test "PASS" "Git worktree commands work" "$worktree_count worktree(s) configured"
    else
        print_test "FAIL" "Git worktree commands work" "git worktree list failed"
    fi
}

test_multiple_sessions_possible() {
    # Try to create two sessions quickly
    local session1=$(echo "n" | node src/session-coordinator.js create --task "multi-1" --agent "test1" 2>&1 | grep "^Session ID:" | head -1 | cut -d':' -f2 | tr -d ' ')
    local session2=$(echo "n" | node src/session-coordinator.js create --task "multi-2" --agent "test2" 2>&1 | grep "^Session ID:" | head -1 | cut -d':' -f2 | tr -d ' ')
    
    if [ -n "$session1" ] && [ -n "$session2" ] && [ "$session1" != "$session2" ]; then
        print_test "PASS" "Multiple sessions can coexist" "$session1 and $session2"
        
        # Clean up
        echo -e "n\nY" | node src/session-coordinator.js close "$session1" > /dev/null 2>&1
        echo -e "n\nY" | node src/session-coordinator.js close "$session2" > /dev/null 2>&1
    else
        print_test "FAIL" "Multiple sessions can coexist" "Could not create two distinct sessions"
    fi
}

test_agent_worker_exists() {
    if [ -f "src/cs-devops-agent-worker.js" ]; then
        print_test "PASS" "DevOps agent worker exists"
    else
        print_test "FAIL" "DevOps agent worker exists" "File not found: src/cs-devops-agent-worker.js"
    fi
}

test_agent_has_exit_cleanup() {
    if grep -q "WORKTREE CLEANUP" src/cs-devops-agent-worker.js; then
        print_test "PASS" "Agent has worktree cleanup on exit"
    else
        print_test "FAIL" "Agent has worktree cleanup on exit" "Cleanup code not found in agent"
    fi
}

test_test_scripts_exist() {
    local all_exist=true
    local missing_files=""
    
    for file in "test/multi-agent/test-multi-agent-conflicts.sh" "test/multi-agent/run-multi-agent-test.sh"; do
        if [ ! -f "$file" ]; then
            all_exist=false
            missing_files="$missing_files $(basename "$file")"
        fi
    done
    
    if $all_exist; then
        print_test "PASS" "Multi-agent test scripts exist"
    else
        print_test "FAIL" "Multi-agent test scripts exist" "Missing:$missing_files"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

echo
echo -e "${BOLD}${CYAN}MULTI-AGENT SYSTEM VERIFICATION${NC}"
echo "========================================"
echo "Checking that all components are working correctly..."

print_section "1. BASIC COMPONENTS"
test_session_coordinator_exists
test_session_coordinator_runs
test_session_commands_available
test_directories_exist
test_agent_worker_exists

print_section "2. SESSION MANAGEMENT"
test_can_create_session
test_worktree_created
test_session_lock_created
test_session_appears_in_list
test_can_close_session

print_section "3. MULTI-AGENT CAPABILITIES"
test_git_worktree_commands
test_multiple_sessions_possible
test_agent_has_exit_cleanup

print_section "4. TEST INFRASTRUCTURE"
test_test_scripts_exist

# ============================================================================
# SUMMARY
# ============================================================================

echo
echo "========================================"
echo -e "${BOLD}VERIFICATION SUMMARY${NC}"
echo "========================================"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}/${TESTS_TOTAL}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}/${TESTS_TOTAL}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo
    echo -e "${BOLD}${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}The multi-agent system is working correctly.${NC}"
    echo
    echo -e "${CYAN}What this means:${NC}"
    echo "  • You can create multiple concurrent sessions"
    echo "  • Each session gets its own isolated worktree"
    echo "  • Sessions can be managed (list, close, cleanup)"
    echo "  • The agent handles cleanup properly on exit"
    echo "  • Git worktrees are configured correctly"
    echo
    exit 0
else
    echo
    echo -e "${BOLD}${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${YELLOW}The multi-agent system has issues that need attention.${NC}"
    echo
    echo -e "${CYAN}To fix:${NC}"
    echo "  1. Review the failed tests above"
    echo "  2. Check error messages for specific issues"
    echo "  3. Ensure all dependencies are installed"
    echo "  4. Verify you're in a git repository"
    echo
    exit 1
fi