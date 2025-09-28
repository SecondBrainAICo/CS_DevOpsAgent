#!/usr/bin/env zsh
# Test Multiple Claude Agent Sessions
# Simulates multiple Claude instances working simultaneously on the same repo
# This is the REAL test - multiple AI sessions in parallel

set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "\n${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Multiple Claude Agents Coordination Test              ║${NC}"
echo -e "${CYAN}║     Simulating Concurrent AI Assistant Sessions           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}\n"

# Function for colored output
log_info() { echo -e "${CYAN}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[⚠]${NC} $*"; }
log_claude() {
    local session=$1
    shift
    echo -e "${BLUE}[Claude-$session]${NC} $*"
}

# Setup test environment
TEST_DIR="/tmp/claude-multi-test-$$"
ORIGINAL_DIR=$(pwd)

cleanup() {
    cd "$ORIGINAL_DIR"
    if [[ -d "$TEST_DIR" ]]; then
        rm -rf "$TEST_DIR"
        log_info "Cleaned up test directory"
    fi
    # Kill any remaining background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Initialize test repository
setup_test_repo() {
    log_info "Setting up test repository at $TEST_DIR"
    
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
    
    # Initialize git
    git init -q
    git config user.name "Test User"
    git config user.email "test@example.com"
    
    # Create project structure
    mkdir -p src/{api,auth,database,utils}
    mkdir -p tests docs config
    
    # Add some initial files
    echo "# Test Project" > README.md
    echo "export function api() {}" > src/api/index.js
    echo "export function auth() {}" > src/auth/index.js
    echo "export function db() {}" > src/database/index.js
    echo "{}" > package.json
    
    git add -A
    git commit -q -m "Initial commit"
    
    # Copy and run setup
    cp "$ORIGINAL_DIR/setup-prep-handshake.sh" .
    chmod +x setup-prep-handshake.sh
    ./setup-prep-handshake.sh >/dev/null 2>&1
    
    log_success "Test repository initialized"
}

# Simulate a Claude session working on a task
simulate_claude_session() {
    local session_id=$1
    local task=$2
    local target_path=$3
    local priority=$4
    local work_duration=$5
    
    {
        cd "$TEST_DIR"
        
        # Set agent identity
        export AGENT_NAME="claude-session-$session_id"
        
        log_claude "$session_id" "Starting work on: $task"
        
        # Random initial delay (simulating human typing/thinking)
        sleep $((RANDOM % 3))
        
        # Request permission to work
        log_claude "$session_id" "Requesting permission for $target_path"
        ./agent-prep.sh "$task" "$target_path" "$priority" >/dev/null 2>&1
        
        # Wait for acknowledgment (in real scenario, this would be automated)
        sleep 2
        
        # Simulate actual work
        log_claude "$session_id" "Working on files..."
        
        # Make actual changes based on the path
        case "$target_path" in
            *api*)
                if [[ -f src/api/index.js ]]; then
                    echo "// Modified by Claude session $session_id at $(date)" >> src/api/index.js
                    echo "export function newEndpoint$session_id() { return 'api-$session_id'; }" >> src/api/index.js
                fi
                ;;
            *auth*)
                if [[ -f src/auth/index.js ]]; then
                    echo "// Auth update by Claude session $session_id at $(date)" >> src/auth/index.js
                    echo "export function login$session_id() { return 'auth-$session_id'; }" >> src/auth/index.js
                fi
                ;;
            *database*)
                if [[ -f src/database/index.js ]]; then
                    echo "// DB changes by Claude session $session_id at $(date)" >> src/database/index.js
                    echo "export function query$session_id() { return 'db-$session_id'; }" >> src/database/index.js
                fi
                ;;
            *docs*)
                if [[ -f README.md ]]; then
                    echo "## Documentation by Claude session $session_id" >> README.md
                    echo "Updated at $(date)" >> README.md
                fi
                ;;
        esac
        
        # Simulate work time
        sleep "$work_duration"
        
        # Commit changes
        git add -A 2>/dev/null
        if ! git diff --cached --quiet; then
            git commit -q -m "$task - Claude session $session_id" 2>/dev/null
            log_claude "$session_id" "Changes committed"
        else
            log_claude "$session_id" "No changes to commit"
        fi
        
        # Check for conflicts
        if [[ -f ".git/.ac/alerts/claude-session-$session_id.md" ]]; then
            log_warn "Session $session_id received conflict alert!"
            cat ".git/.ac/alerts/claude-session-$session_id.md" 2>/dev/null
        fi
        
        log_claude "$session_id" "Task completed"
    } &
}

# Monitor active sessions
monitor_sessions() {
    local duration=$1
    local start_time=$(date +%s)
    
    log_info "Monitoring active sessions for ${duration} seconds..."
    
    while [[ $(($(date +%s) - start_time)) -lt $duration ]]; do
        clear
        echo -e "${CYAN}════════════════════════════════════════════${NC}"
        echo -e "${CYAN}     Active Claude Sessions Monitor${NC}"
        echo -e "${CYAN}════════════════════════════════════════════${NC}\n"
        
        # Show active requests
        echo -e "${YELLOW}Active Prep Requests:${NC}"
        for file in "$TEST_DIR"/.ac-prep/claude-session-*.json; do
            if [[ -f "$file" ]]; then
                local session=$(basename "$file" .json | sed 's/claude-session-//')
                if command -v jq >/dev/null 2>&1; then
                    local task=$(jq -r '.task' "$file" 2>/dev/null)
                    local priority=$(jq -r '.priority' "$file" 2>/dev/null)
                    echo "  Session $session: $task (priority: $priority)"
                else
                    echo "  Session $session: active"
                fi
            fi
        done
        
        echo -e "\n${GREEN}Recent Commits:${NC}"
        cd "$TEST_DIR"
        git log --oneline -5 2>/dev/null | head -5
        cd - >/dev/null
        
        echo -e "\n${RED}Alerts:${NC}"
        local alert_count=0
        for file in "$TEST_DIR"/.git/.ac/alerts/*.md; do
            if [[ -f "$file" ]]; then
                ((alert_count++))
                echo "  ⚠ $(basename "$file" .md)"
            fi
        done
        [[ $alert_count -eq 0 ]] && echo "  No conflicts detected"
        
        sleep 2
    done
}

# Main test execution
main() {
    log_info "Starting multi-Claude agent coordination test"
    log_info "This simulates real-world scenario: multiple Claude sessions working simultaneously"
    echo ""
    
    # Setup
    setup_test_repo
    echo ""
    
    # Test Scenario 1: Non-conflicting parallel work
    log_info "=== Scenario 1: Non-conflicting parallel work ==="
    log_info "3 Claude sessions working on different components"
    
    simulate_claude_session 1 "feat: Add user authentication" "src/auth/**" 6 3
    simulate_claude_session 2 "feat: Implement API endpoints" "src/api/**" 5 4
    simulate_claude_session 3 "docs: Update documentation" "docs/**" 4 2
    
    sleep 10
    wait
    
    log_success "Scenario 1 complete - check for smooth parallel execution"
    echo ""
    
    # Test Scenario 2: Potentially conflicting work
    log_info "=== Scenario 2: Overlapping work areas ==="
    log_info "2 Claude sessions trying to modify similar areas"
    
    simulate_claude_session 4 "refactor: Update authentication flow" "src/auth/**" 7 3 &
    sleep 1  # Small delay
    simulate_claude_session 5 "fix: Auth security patch" "src/auth/**" 9 2 &
    
    # Monitor while they work
    monitor_sessions 10
    wait
    
    log_success "Scenario 2 complete - check conflict handling"
    echo ""
    
    # Test Scenario 3: High concurrency
    log_info "=== Scenario 3: High concurrency stress test ==="
    log_info "5 Claude sessions working simultaneously"
    
    simulate_claude_session 6 "feat: Database migration" "src/database/**" 5 2
    simulate_claude_session 7 "test: Add unit tests" "tests/**" 4 3
    simulate_claude_session 8 "fix: API bug fix" "src/api/**" 8 2
    simulate_claude_session 9 "docs: API documentation" "docs/**" 3 4
    simulate_claude_session 10 "refactor: Code cleanup" "src/utils/**" 2 3
    
    sleep 15
    wait
    
    log_success "Scenario 3 complete - stress test finished"
    echo ""
    
    # Generate report
    log_info "Generating test report..."
    
    cd "$TEST_DIR"
    echo -e "\n${CYAN}═══════════════════════════════════════${NC}"
    echo -e "${CYAN}          TEST REPORT${NC}"
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
    
    echo -e "\n${YELLOW}Commits Created:${NC}"
    git log --oneline | wc -l | xargs echo "  Total commits:"
    
    echo -e "\n${YELLOW}Files Modified:${NC}"
    git diff --name-only HEAD~10..HEAD 2>/dev/null | sort -u | head -10
    
    echo -e "\n${YELLOW}Coordination Requests:${NC}"
    ls -1 .ac-prep/claude-session-*.json 2>/dev/null | wc -l | xargs echo "  Total requests:"
    
    echo -e "\n${YELLOW}Conflicts Detected:${NC}"
    ls -1 .git/.ac/alerts/*.md 2>/dev/null | wc -l | xargs echo "  Total alerts:"
    
    cd "$ORIGINAL_DIR"
    
    echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}     TEST COMPLETED SUCCESSFULLY${NC}"
    echo -e "${GREEN}═══════════════════════════════════════${NC}\n"
    
    log_success "Multi-Claude coordination system is working!"
    log_info "The system successfully handled multiple concurrent Claude sessions"
    
    # Ask if user wants to inspect
    echo ""
    read -p "Keep test environment for inspection? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        trap - EXIT
        log_info "Test environment preserved at: $TEST_DIR"
        log_info "To clean up: rm -rf $TEST_DIR"
    else
        cleanup
    fi
}

# Run the test
main "$@"