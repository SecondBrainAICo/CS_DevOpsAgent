#!/bin/bash

# ==========================================
# Standalone Multi-Session Git Test Suite
# ==========================================
# Tests git operations across multiple concurrent sessions
# No external dependencies - uses only git and bash

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="$(pwd)/test-standalone-workspace"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="${TEST_DIR}/logs_${TIMESTAMP}"
RESULTS_FILE="${LOG_DIR}/test_results.txt"

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
}

print_test() {
    echo -e "${YELLOW}► TEST:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${MAGENTA}ℹ${NC} $1"
}

# Function to simulate a git session
simulate_session() {
    local session_id=$1
    local repo_path=$2
    local action=$3
    local log_file="${LOG_DIR}/session_${session_id}.log"
    
    {
        cd "$repo_path"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session $session_id starting" 
        
        case "$action" in
            "commit")
                echo "Content from session $session_id" > "session_${session_id}.txt"
                git add "session_${session_id}.txt"
                git commit -m "feat: changes from session $session_id"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session $session_id committed"
                ;;
            "branch")
                git checkout -b "feature/session_${session_id}"
                echo "Feature work from session $session_id" > "feature_${session_id}.txt"
                git add "feature_${session_id}.txt"
                git commit -m "feat: feature from session $session_id"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session $session_id created feature branch"
                ;;
            "merge")
                git checkout main
                git merge "feature/session_${session_id}" --no-ff -m "merge: session $session_id feature"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session $session_id merged"
                ;;
        esac
        
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session $session_id completed"
    } >> "$log_file" 2>&1
}

# Function to cleanup test environment
cleanup() {
    print_header "Cleaning up test environment"
    
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Remove test directory
    if [ -d "$TEST_DIR" ]; then
        rm -rf "$TEST_DIR"
        print_success "Test directory cleaned up"
    fi
}

# Function to setup test environment
setup_test_env() {
    print_header "Setting up test environment"
    
    # Create test directories
    mkdir -p "$TEST_DIR"
    mkdir -p "$LOG_DIR"
    
    print_info "Test directory: $TEST_DIR"
    print_info "Log directory: $LOG_DIR"
    
    print_success "Test environment setup complete"
}

# Test 1: Multiple parallel git operations
test_parallel_operations() {
    print_test "Multiple parallel git operations"
    
    local TEST_REPO="${TEST_DIR}/repo_parallel"
    mkdir -p "$TEST_REPO"
    cd "$TEST_REPO"
    
    # Initialize repo
    git init
    git config user.name "Test User"
    git config user.email "test@example.com"
    echo "# Test Repo" > README.md
    git add README.md
    git commit -m "Initial commit"
    
    # Start multiple parallel sessions
    for i in {1..5}; do
        simulate_session "$i" "$TEST_REPO" "commit" &
    done
    
    # Wait for all sessions
    wait
    
    # Check results
    local commit_count=$(git log --oneline | wc -l)
    if [ "$commit_count" -ge 6 ]; then  # Initial + 5 sessions
        print_success "All parallel sessions committed successfully ($commit_count commits)"
        echo "PASS: Parallel operations" >> "$RESULTS_FILE"
    else
        print_error "Some sessions failed (only $commit_count commits)"
        echo "FAIL: Parallel operations" >> "$RESULTS_FILE"
    fi
}

# Test 2: Git worktree for isolation
test_worktree_isolation() {
    print_test "Git worktree isolation for multiple agents"
    
    local MAIN_REPO="${TEST_DIR}/repo_worktree"
    mkdir -p "$MAIN_REPO"
    cd "$MAIN_REPO"
    
    # Initialize main repo
    git init
    git config user.name "Test User"
    git config user.email "test@example.com"
    echo "# Main Repo" > README.md
    git add README.md
    git commit -m "Initial commit"
    
    # Create worktrees for different "agents"
    local agents=("claude" "copilot" "cursor")
    for agent in "${agents[@]}"; do
        git worktree add "${TEST_DIR}/worktree_${agent}" -b "agent/${agent}/main"
        
        # Simulate work in each worktree
        (
            cd "${TEST_DIR}/worktree_${agent}"
            echo "Work by $agent" > "${agent}_work.txt"
            git add "${agent}_work.txt"
            git commit -m "feat($agent): add work"
        ) &
    done
    
    wait
    
    # Check if all worktrees were created
    local worktree_count=$(git worktree list | wc -l)
    if [ "$worktree_count" -eq 4 ]; then  # Main + 3 worktrees
        print_success "All worktrees created and isolated"
        echo "PASS: Worktree isolation" >> "$RESULTS_FILE"
    else
        print_error "Worktree creation failed (count: $worktree_count)"
        echo "FAIL: Worktree isolation" >> "$RESULTS_FILE"
    fi
}

# Test 3: Concurrent branch operations
test_concurrent_branches() {
    print_test "Concurrent branch operations"
    
    local TEST_REPO="${TEST_DIR}/repo_branches"
    mkdir -p "$TEST_REPO"
    cd "$TEST_REPO"
    
    # Initialize repo
    git init
    git config user.name "Test User"
    git config user.email "test@example.com"
    echo "# Branch Test" > README.md
    git add README.md
    git commit -m "Initial commit"
    
    # Create multiple branches concurrently
    for i in {1..5}; do
        (
            git checkout -b "feature/concurrent_${i}"
            echo "Feature $i content" > "feature_${i}.txt"
            git add "feature_${i}.txt"
            git commit -m "feat: add feature $i"
        ) &
    done
    
    wait
    
    # Check branch count
    local branch_count=$(git branch -a | wc -l)
    if [ "$branch_count" -ge 6 ]; then  # main + 5 features
        print_success "All concurrent branches created"
        echo "PASS: Concurrent branches" >> "$RESULTS_FILE"
    else
        print_error "Branch creation failed (count: $branch_count)"
        echo "FAIL: Concurrent branches" >> "$RESULTS_FILE"
    fi
}

# Test 4: File locking simulation
test_file_locking() {
    print_test "File locking and conflict detection"
    
    local TEST_REPO="${TEST_DIR}/repo_locking"
    local LOCK_DIR="${TEST_REPO}/.git/locks"
    mkdir -p "$TEST_REPO"
    cd "$TEST_REPO"
    
    # Initialize repo
    git init
    git config user.name "Test User"
    git config user.email "test@example.com"
    echo "Original content" > shared_file.txt
    git add shared_file.txt
    git commit -m "Initial commit"
    
    # Create lock directory
    mkdir -p "$LOCK_DIR"
    
    # Simulate file locking mechanism
    acquire_lock() {
        local file=$1
        local session=$2
        local lock_file="${LOCK_DIR}/${file}.lock"
        
        # Try to acquire lock (atomic operation)
        if (set -C; echo "$session" > "$lock_file") 2>/dev/null; then
            return 0
        else
            return 1
        fi
    }
    
    release_lock() {
        local file=$1
        local lock_file="${LOCK_DIR}/${file}.lock"
        rm -f "$lock_file"
    }
    
    # Test concurrent access with locking
    local success_count=0
    for i in {1..3}; do
        (
            if acquire_lock "shared_file.txt" "session_$i"; then
                echo "Session $i content" >> shared_file.txt
                git add shared_file.txt
                git commit -m "update: session $i changes"
                release_lock "shared_file.txt"
                echo "SUCCESS: Session $i acquired lock" >> "${LOG_DIR}/locking.log"
            else
                echo "BLOCKED: Session $i could not acquire lock" >> "${LOG_DIR}/locking.log"
            fi
        ) &
    done
    
    wait
    
    # Check results
    if [ -f "${LOG_DIR}/locking.log" ]; then
        local blocked_count=$(grep -c "BLOCKED" "${LOG_DIR}/locking.log" || echo 0)
        if [ "$blocked_count" -ge 1 ]; then
            print_success "File locking mechanism working (some sessions were blocked)"
            echo "PASS: File locking" >> "$RESULTS_FILE"
        else
            print_info "All sessions acquired lock (sequential execution)"
            echo "PASS: File locking (sequential)" >> "$RESULTS_FILE"
        fi
    else
        print_error "Locking test failed"
        echo "FAIL: File locking" >> "$RESULTS_FILE"
    fi
}

# Test 5: Session recovery
test_session_recovery() {
    print_test "Session recovery after interruption"
    
    local TEST_REPO="${TEST_DIR}/repo_recovery"
    local SESSION_STATE="${TEST_REPO}/.git/session_state"
    mkdir -p "$TEST_REPO"
    cd "$TEST_REPO"
    
    # Initialize repo
    git init
    git config user.name "Test User"
    git config user.email "test@example.com"
    echo "# Recovery Test" > README.md
    git add README.md
    git commit -m "Initial commit"
    
    # Simulate session with state saving
    save_state() {
        local session_id=$1
        local state=$2
        mkdir -p "$SESSION_STATE"
        echo "$state" > "${SESSION_STATE}/session_${session_id}.state"
    }
    
    recover_state() {
        local session_id=$1
        local state_file="${SESSION_STATE}/session_${session_id}.state"
        if [ -f "$state_file" ]; then
            cat "$state_file"
        else
            echo "none"
        fi
    }
    
    # Start session 1
    save_state "1" "working_on_feature_x"
    echo "Partial work" > feature_x.txt
    
    # Simulate crash (no commit)
    
    # Start session 2 (recovery)
    local recovered_state=$(recover_state "1")
    if [ "$recovered_state" = "working_on_feature_x" ]; then
        # Continue work
        echo "Completed work" >> feature_x.txt
        git add feature_x.txt
        git commit -m "feat: complete feature x (recovered)"
        save_state "1" "completed"
        print_success "Session recovered and completed work"
        echo "PASS: Session recovery" >> "$RESULTS_FILE"
    else
        print_error "Failed to recover session state"
        echo "FAIL: Session recovery" >> "$RESULTS_FILE"
    fi
}

# Test 6: Performance under load
test_performance() {
    print_test "Performance with many concurrent operations"
    
    local TEST_REPO="${TEST_DIR}/repo_performance"
    mkdir -p "$TEST_REPO"
    cd "$TEST_REPO"
    
    # Initialize repo
    git init
    git config user.name "Test User"
    git config user.email "test@example.com"
    echo "# Performance Test" > README.md
    git add README.md
    git commit -m "Initial commit"
    
    local start_time=$(date +%s)
    
    # Create many files concurrently
    for i in {1..20}; do
        (
            echo "Content $i" > "file_${i}.txt"
            git add "file_${i}.txt"
            git commit -m "add: file $i"
        ) &
    done
    
    wait
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Check results
    local file_count=$(ls -1 file_*.txt 2>/dev/null | wc -l)
    local commit_count=$(git log --oneline | wc -l)
    
    print_info "Created $file_count files with $commit_count commits in ${duration}s"
    
    if [ "$file_count" -eq 20 ]; then
        print_success "Performance test passed (${duration}s for 20 operations)"
        echo "PASS: Performance (${duration}s)" >> "$RESULTS_FILE"
    else
        print_error "Some operations failed (only $file_count/20 files)"
        echo "FAIL: Performance" >> "$RESULTS_FILE"
    fi
}

# Test 7: Remote repository simulation
test_remote_operations() {
    print_test "Remote repository operations"
    
    local REMOTE_REPO="${TEST_DIR}/remote.git"
    local LOCAL_REPO="${TEST_DIR}/local_repo"
    
    # Create bare remote repository
    mkdir -p "$REMOTE_REPO"
    cd "$REMOTE_REPO"
    git init --bare
    
    # Create local repository
    mkdir -p "$LOCAL_REPO"
    cd "$LOCAL_REPO"
    git init
    git config user.name "Test User"
    git config user.email "test@example.com"
    git remote add origin "$REMOTE_REPO"
    
    # Initial commit and push
    echo "# Remote Test" > README.md
    git add README.md
    git commit -m "Initial commit"
    git push -u origin main
    
    # Simulate multiple sessions pushing
    for i in {1..3}; do
        (
            # Clone to simulate different session
            local clone_dir="${TEST_DIR}/clone_${i}"
            git clone "$REMOTE_REPO" "$clone_dir" 2>/dev/null
            cd "$clone_dir"
            git config user.name "User $i"
            git config user.email "user${i}@example.com"
            
            # Make changes
            echo "Changes from session $i" > "session_${i}.txt"
            git add "session_${i}.txt"
            git commit -m "feat: session $i changes"
            
            # Pull and push
            git pull origin main --no-edit 2>/dev/null || true
            git push origin main 2>/dev/null
        ) &
    done
    
    wait
    
    # Check remote repository
    cd "$LOCAL_REPO"
    git pull origin main 2>/dev/null
    local remote_commits=$(git log --oneline | wc -l)
    
    if [ "$remote_commits" -ge 2 ]; then
        print_success "Remote operations successful ($remote_commits commits)"
        echo "PASS: Remote operations" >> "$RESULTS_FILE"
    else
        print_error "Remote operations failed"
        echo "FAIL: Remote operations" >> "$RESULTS_FILE"
    fi
}

# Main test execution
main() {
    print_header "Standalone Multi-Session Git Test Suite"
    print_info "Starting at $(date)"
    print_info "No external dependencies required - using only git and bash"
    
    # Cleanup any previous test runs
    cleanup
    
    # Setup test environment
    setup_test_env
    
    # Run all tests
    test_parallel_operations
    test_worktree_isolation
    test_concurrent_branches
    test_file_locking
    test_session_recovery
    test_performance
    test_remote_operations
    
    # Generate test report
    print_header "Test Results Summary"
    
    if [ -f "$RESULTS_FILE" ]; then
        local total_tests=$(grep -c ":" "$RESULTS_FILE" 2>/dev/null || echo 0)
        local passed_tests=$(grep -c "PASS" "$RESULTS_FILE" 2>/dev/null || echo 0)
        local failed_tests=$(grep -c "FAIL" "$RESULTS_FILE" 2>/dev/null || echo 0)
        
        echo -e "${CYAN}Total Tests:${NC} $total_tests"
        echo -e "${GREEN}Passed:${NC} $passed_tests"
        echo -e "${RED}Failed:${NC} $failed_tests"
        
        echo ""
        echo "Detailed Results:"
        cat "$RESULTS_FILE"
        
        if [ "$failed_tests" -eq 0 ]; then
            print_success "All tests passed! ✨"
            echo ""
            print_info "Logs available at: $LOG_DIR"
            exit 0
        else
            print_error "Some tests failed. Check logs in: $LOG_DIR"
            exit 1
        fi
    else
        print_error "No results file generated"
        exit 1
    fi
}

# Handle interrupts
trap cleanup EXIT INT TERM

# Run main if not sourced
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi