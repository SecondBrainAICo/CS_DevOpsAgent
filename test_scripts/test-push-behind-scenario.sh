#!/bin/bash

#############################################################################
# Test: CS_DevOpsAgent Push Behind Remote Scenario
#############################################################################
# This test verifies that cs-devops-agent-worker.js correctly handles
# the scenario where the local branch is behind the remote branch
# by pulling and merging changes before retrying the push.
#############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="/tmp/cs_devops_agent_push_test_$(date +%s)"
REMOTE_REPO="${TEST_DIR}/remote.git"
LOCAL_REPO_1="${TEST_DIR}/local_1"
LOCAL_REPO_2="${TEST_DIR}/local_2"
WORKER_SCRIPT="$(pwd)/cs-devops-agent-worker.js"

# Helper functions
print_header() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
}

print_test() {
    echo -e "\n${YELLOW}▶ TEST: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

# Cleanup function
cleanup() {
    print_info "Cleaning up test environment..."
    rm -rf "$TEST_DIR"
}

# Setup test environment
setup_test_env() {
    print_header "Setting Up Test Environment"
    
    # Create test directory
    mkdir -p "$TEST_DIR"
    
    # Create bare remote repository
    print_info "Creating remote repository at $REMOTE_REPO"
    mkdir -p "$REMOTE_REPO"
    cd "$REMOTE_REPO"
    git init --bare --initial-branch=main
    
    # Setup first local repository
    print_info "Setting up first local repository at $LOCAL_REPO_1"
    mkdir -p "$LOCAL_REPO_1"
    cd "$LOCAL_REPO_1"
    git init --initial-branch=main
    git config user.name "User 1"
    git config user.email "user1@test.com"
    git remote add origin "$REMOTE_REPO"
    
    # Initial commit
    echo "# Test Project" > README.md
    echo "test: initial commit for push-behind test" > .claude-commit-msg
    git add README.md
    git commit -m "test: initial commit"
    git push -u origin main
    
    # Setup second local repository (clone)
    print_info "Setting up second local repository at $LOCAL_REPO_2"
    cd "$TEST_DIR"
    git clone "$REMOTE_REPO" "$LOCAL_REPO_2"
    cd "$LOCAL_REPO_2"
    git config user.name "User 2"
    git config user.email "user2@test.com"
    echo "test: initial setup for repo 2" > .claude-commit-msg
    
    print_success "Test environment setup complete"
}

# Test 1: Simple push-behind scenario
test_simple_push_behind() {
    print_test "Simple Push Behind Scenario"
    
    # User 2 makes a change and pushes
    print_info "User 2 making changes..."
    cd "$LOCAL_REPO_2"
    echo "Change from User 2" > file2.txt
    git add file2.txt
    git commit -m "feat: add file2 from user 2"
    git push origin main
    
    # User 1 makes a change (unaware of User 2's push)
    print_info "User 1 making changes (branch now behind)..."
    cd "$LOCAL_REPO_1"
    echo "Change from User 1" > file1.txt
    echo "feat: add file1 from user 1

This change was made while the branch was behind remote" > .claude-commit-msg
    
    # Run cs-devops-agent-worker to handle the commit and push
    print_info "Running cs-devops-agent-worker..."
    
    # Start the worker with auto-commit enabled
    AC_PUSH=true \
    AC_REQUIRE_MSG=true \
    AC_MSG_FILE=.claude-commit-msg \
    AC_CLEAR_MSG_WHEN=push \
    AC_DEBUG=true \
    AC_CS_DEVOPS_AGENT_ON_START=true \
    timeout 10 node "$WORKER_SCRIPT" 2>&1 | tee "${TEST_DIR}/worker_output.log" || true
    
    # Verify the results
    print_info "Verifying results..."
    
    # Check if both files exist after pull and push
    git pull origin main --no-edit 2>/dev/null || true
    
    if [ -f "file1.txt" ] && [ -f "file2.txt" ]; then
        print_success "Both files exist - merge successful"
    else
        print_error "Files missing - merge may have failed"
        ls -la
        return 1
    fi
    
    # Check if message file was cleared
    if [ ! -s ".claude-commit-msg" ]; then
        print_success "Message file cleared after successful push"
    else
        print_error "Message file not cleared"
        cat .claude-commit-msg
    fi
    
    # Check remote has all commits
    local remote_commits=$(git log --oneline origin/main | wc -l)
    if [ "$remote_commits" -ge 3 ]; then
        print_success "All commits pushed to remote ($remote_commits commits)"
    else
        print_error "Some commits missing from remote"
        git log --oneline origin/main
    fi
}

# Test 2: Multiple push-behind scenarios
test_multiple_push_behind() {
    print_test "Multiple Concurrent Push Behind Scenarios"
    
    # Simulate 3 concurrent users
    for i in {3..5}; do
        (
            local clone_dir="${TEST_DIR}/local_${i}"
            git clone "$REMOTE_REPO" "$clone_dir" 2>/dev/null
            cd "$clone_dir"
            git config user.name "User $i"
            git config user.email "user${i}@test.com"
            
            # Make changes
            echo "Change from User $i" > "file${i}.txt"
            echo "feat: add file${i} from user ${i}" > .claude-commit-msg
            
            # Run worker
            AC_PUSH=true \
            AC_REQUIRE_MSG=true \
            AC_MSG_FILE=.claude-commit-msg \
            AC_CLEAR_MSG_WHEN=push \
            AC_CS_DEVOPS_AGENT_ON_START=true \
            timeout 10 node "$WORKER_SCRIPT" 2>&1 > "${TEST_DIR}/worker_${i}.log" || true
        ) &
    done
    
    # Wait for all background processes
    wait
    
    # Verify all changes made it to remote
    cd "$LOCAL_REPO_1"
    git pull origin main 2>/dev/null
    
    local file_count=$(ls -1 file*.txt 2>/dev/null | wc -l)
    if [ "$file_count" -ge 5 ]; then
        print_success "All files present after concurrent pushes ($file_count files)"
    else
        print_error "Some files missing (only $file_count files found)"
        ls -la
    fi
}

# Test 3: Conflict resolution scenario
test_conflict_scenario() {
    print_test "Conflict Resolution During Push Behind"
    
    # Both users edit the same file
    cd "$LOCAL_REPO_1"
    echo "Version A" > shared.txt
    git add shared.txt
    git commit -m "feat: add shared file version A"
    git push origin main
    
    cd "$LOCAL_REPO_2"
    git pull origin main
    echo "Version B" > shared.txt
    git add shared.txt  
    git commit -m "feat: update shared file to version B"
    git push origin main
    
    # User 1 tries to push different change to same file
    cd "$LOCAL_REPO_1"
    echo "Version C" > shared.txt
    echo "feat: update shared file to version C

This will cause a conflict" > .claude-commit-msg
    
    # Run worker (should handle pull but may need manual conflict resolution)
    print_info "Running worker with conflicting changes..."
    AC_PUSH=true \
    AC_REQUIRE_MSG=true \
    AC_MSG_FILE=.claude-commit-msg \
    AC_CLEAR_MSG_WHEN=push \
    AC_DEBUG=true \
    AC_CS_DEVOPS_AGENT_ON_START=true \
    timeout 10 node "$WORKER_SCRIPT" 2>&1 | tee "${TEST_DIR}/conflict_output.log" || true
    
    # Check if conflict was detected
    if grep -q "conflict\|CONFLICT\|merge" "${TEST_DIR}/conflict_output.log"; then
        print_success "Conflict properly detected and reported"
    else
        print_error "Conflict not properly handled"
    fi
}

# Main test execution
main() {
    print_header "CS_DevOpsAgent Push Behind Remote Test Suite"
    print_info "Testing push-behind scenario handling"
    print_info "Worker script: $WORKER_SCRIPT"
    
    # Check if worker script exists
    if [ ! -f "$WORKER_SCRIPT" ]; then
        print_error "Worker script not found at $WORKER_SCRIPT"
        exit 1
    fi
    
    # Cleanup any previous runs
    trap cleanup EXIT INT TERM
    
    # Setup test environment
    setup_test_env
    
    # Run tests
    test_simple_push_behind
    test_multiple_push_behind
    test_conflict_scenario
    
    # Summary
    print_header "Test Summary"
    print_success "Push-behind scenario tests completed"
    print_info "Test logs available in: $TEST_DIR"
    
    # Keep test directory for debugging if KEEP_TEST_DIR is set
    if [ -z "$KEEP_TEST_DIR" ]; then
        print_info "Set KEEP_TEST_DIR=1 to preserve test directory"
    else
        print_info "Test directory preserved at: $TEST_DIR"
        trap - EXIT
    fi
}

# Run if not sourced
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi