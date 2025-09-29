#!/bin/bash

#############################################################################
# Debug Failing Tests - Isolated test environment for troubleshooting
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
TEST_DIR="$(pwd)/debug-test-workspace"
TEST_REPO="${TEST_DIR}/test-repo"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="${TEST_DIR}/logs_${TIMESTAMP}"

# Resolve repository root
SCRIPT_DIR="$(cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

print_header() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
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
    echo -e "${CYAN}ℹ${NC} $1"
}

cleanup() {
    print_header "Cleaning up debug test environment"
    if [ -d "$TEST_DIR" ]; then
        rm -rf "$TEST_DIR"
        print_success "Test directory cleaned up"
    fi
}

setup_test_env() {
    print_header "Setting up debug test environment"
    
    mkdir -p "$TEST_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$TEST_REPO"
    
    print_info "Test directory: $TEST_DIR"
    print_info "Log directory: $LOG_DIR"
    
    cd "$TEST_REPO"
    git init
    git config user.name "Test User"
    git config user.email "test@example.com"
    
    # Copy necessary files
    mkdir -p "$TEST_REPO/src"
    cp -r "$REPO_ROOT/src"/*.js "$TEST_REPO/src/"
    cp -r "$REPO_ROOT/deploy_test"/*.sh "$TEST_REPO/"
    cp "$REPO_ROOT/package.json" "$TEST_REPO/"
    
    # Install dependencies locally
    print_info "Installing dependencies..."
    cd "$TEST_REPO"
    npm install --save-dev chokidar execa 2>/dev/null
    
    # Create initial commit
    echo "# Test Repository" > README.md
    git add .
    git commit -m "Initial commit"
    
    print_success "Test environment setup complete"
}

# Test 1: Debug Worktree Management
debug_worktree() {
    print_test "Debugging Worktree Management"
    
    cd "$TEST_REPO"
    
    print_info "Current directory: $(pwd)"
    print_info "Git status:"
    git status
    
    # Check if worktree-manager.js exists and is executable
    if [ -f "src/worktree-manager.js" ]; then
        print_success "worktree-manager.js found"
        
        # Try to run it with help
        print_info "Testing worktree-manager.js help:"
        node src/worktree-manager.js help 2>&1 || true
        
        # Try to create a worktree
        print_info "Creating worktree for agent 'claude':"
        node src/worktree-manager.js create --agent "claude" --task "feature_claude" 2>&1 | tee "${LOG_DIR}/worktree_claude.log" || {
            print_error "Worktree creation failed. Error output:"
            cat "${LOG_DIR}/worktree_claude.log"
        }
        
        # Check if worktree was created
        print_info "Checking worktrees:"
        git worktree list
        
        if git worktree list | grep -q "agent/claude"; then
            print_success "Worktree created for claude"
        else
            print_error "Worktree not found for claude"
            
            # Try alternative approach
            print_info "Trying manual worktree creation:"
            git worktree add -b "agent/claude/feature_claude" ".worktrees/claude-feature_claude" 2>&1 || true
            git worktree list
        fi
    else
        print_error "worktree-manager.js not found"
        ls -la src/
    fi
}

# Test 2: Debug Conflict Detection
debug_conflict_detection() {
    print_test "Debugging Conflict Detection"
    
    cd "$TEST_REPO"
    
    # Setup for conflict detection
    print_info "Setting up conflict detection test..."
    
    # First check if we need to set up the coordination system
    if [ -f "setup-prep-handshake.sh" ]; then
        print_info "Running setup-prep-handshake.sh:"
        ./setup-prep-handshake.sh 2>&1 | tee "${LOG_DIR}/handshake_setup.log" || {
            print_error "Handshake setup failed"
            cat "${LOG_DIR}/handshake_setup.log"
        }
    else
        print_info "setup-prep-handshake.sh not found, creating directories manually:"
        mkdir -p .git/.ac/alerts
        mkdir -p .ac-prep
        print_success "Created coordination directories"
    fi
    
    # Create a conflict scenario
    echo "Original content" > conflict_file.txt
    git add conflict_file.txt
    git commit -m "Add conflict file"
    
    # Simulate two agents modifying the same file
    print_info "Simulating concurrent modifications:"
    
    # Agent A
    (
        export AGENT_NAME="agent_a"
        echo "Content from Agent A" > conflict_file.txt
        echo "Modified by Agent A at $(date)" >> "${LOG_DIR}/agent_a.log"
        
        # If agent-prep.sh exists, use it
        if [ -f "agent-prep.sh" ]; then
            ./agent-prep.sh "task_a" "conflict_file.txt" 8 2>&1 >> "${LOG_DIR}/agent_a.log" || true
        fi
    ) &
    
    # Agent B
    (
        export AGENT_NAME="agent_b"
        sleep 0.5  # Small delay to create overlap
        echo "Content from Agent B" > conflict_file.txt
        echo "Modified by Agent B at $(date)" >> "${LOG_DIR}/agent_b.log"
        
        # If agent-prep.sh exists, use it
        if [ -f "agent-prep.sh" ]; then
            ./agent-prep.sh "task_b" "conflict_file.txt" 7 2>&1 >> "${LOG_DIR}/agent_b.log" || true
        fi
    ) &
    
    wait
    
    print_info "Checking for conflicts/alerts:"
    
    # Check various conflict indicators
    if [ -d ".git/.ac/alerts" ]; then
        ls -la .git/.ac/alerts/
        if [ "$(ls -A .git/.ac/alerts 2>/dev/null)" ]; then
            print_success "Alerts found in .git/.ac/alerts"
            cat .git/.ac/alerts/* 2>/dev/null
        else
            print_error "No alerts found"
        fi
    fi
    
    if [ -d ".ac-prep" ]; then
        ls -la .ac-prep/
    fi
    
    # Check git status for conflicts
    git status
    
    # Check the file content
    print_info "Final content of conflict_file.txt:"
    cat conflict_file.txt
}

# Test 3: Debug Daily Rollover
debug_daily_rollover() {
    print_test "Debugging Daily Rollover"
    
    cd "$TEST_REPO"
    
    # Get date strings
    local today=$(date +%Y-%m-%d)
    local yesterday=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)
    
    print_info "Today: $today"
    print_info "Yesterday: $yesterday"
    
    # Create yesterday's branch
    git checkout -b "test_${yesterday}"
    echo "Yesterday's work" > yesterday.txt
    git add .
    git commit -m "Yesterday's commit"
    print_success "Created yesterday's branch: test_${yesterday}"
    
    # Return to main
    git checkout main
    
    # Create version branch
    git checkout -b "v0.01"
    print_success "Created version branch: v0.01"
    
    # Test rollover with Node.js script
    print_info "Testing rollover logic with Node.js:"
    
    cat > test_rollover.js << 'EOF'
const { execSync } = require('child_process');

console.log('Testing daily rollover functionality...');

// Get today's date
const today = new Date().toISOString().split('T')[0];
const newBranch = `test_${today}`;

try {
    // Check if branch already exists
    try {
        execSync(`git rev-parse --verify ${newBranch}`, { stdio: 'pipe' });
        console.log(`Branch ${newBranch} already exists`);
        // Switch to existing branch
        execSync(`git checkout ${newBranch}`, { stdio: 'inherit' });
    } catch (e) {
        // Branch doesn't exist, create it
        console.log(`Creating new daily branch: ${newBranch}`);
        execSync(`git checkout -b ${newBranch}`, { stdio: 'inherit' });
    }
    
    // Create a test file for today
    const fs = require('fs');
    fs.writeFileSync('today.txt', `Work for ${today}`);
    execSync('git add today.txt', { stdio: 'inherit' });
    execSync(`git commit -m "Daily work for ${today}"`, { stdio: 'inherit' });
    
    console.log(`✓ Daily rollover successful - branch: ${newBranch}`);
    process.exit(0);
} catch (error) {
    console.error('✗ Rollover failed:', error.message);
    process.exit(1);
}
EOF
    
    if node test_rollover.js 2>&1 | tee "${LOG_DIR}/rollover.log"; then
        print_success "Daily rollover successful"
        
        # Verify the rollover worked
        print_info "Current branch:"
        git branch --show-current
        
        print_info "All branches:"
        git branch -a
    else
        print_error "Daily rollover failed"
        cat "${LOG_DIR}/rollover.log"
    fi
}

# Main execution
main() {
    print_header "Debug Failing Tests"
    print_info "Repository root: $REPO_ROOT"
    
    # Clean up any previous runs
    cleanup
    
    # Setup test environment
    setup_test_env
    
    # Run individual debug tests
    print_header "Test 1: Worktree Management"
    debug_worktree
    
    print_header "Test 2: Conflict Detection"
    debug_conflict_detection
    
    print_header "Test 3: Daily Rollover"
    debug_daily_rollover
    
    print_header "Debug Complete"
    print_info "Logs available in: $LOG_DIR"
    print_info "Test repo available for inspection: $TEST_REPO"
    
    # Ask if user wants to keep test environment for inspection
    echo ""
    read -p "Keep test environment for inspection? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        cleanup
    else
        print_info "Test environment preserved at: $TEST_DIR"
    fi
}

# Run main if not sourced
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi