#!/bin/bash

# ============================================================================
# MULTI-AGENT CONFLICT TEST SCRIPT
# ============================================================================
# This script simulates multiple agents working on the same files to test
# conflict resolution and merge strategies in the DevOps agent system.
#
# Usage: ./test-multi-agent-conflicts.sh [agent1-session-id] [agent2-session-id]
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Function to print colored output
print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to print section headers
print_section() {
    echo
    print_color "${BOLD}${CYAN}" "============================================================"
    print_color "${BOLD}${CYAN}" "$1"
    print_color "${BOLD}${CYAN}" "============================================================"
    echo
}

# Function to simulate agent work
simulate_agent_work() {
    local session_id=$1
    local agent_name=$2
    local worktree_path=$3
    local file_to_edit=$4
    local line_to_add=$5
    local commit_msg=$6
    
    print_color "${MAGENTA}" "[$agent_name] Working in: $worktree_path"
    
    # Change to worktree directory
    cd "$worktree_path"
    
    # Show current branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    print_color "${BLUE}" "[$agent_name] Current branch: $current_branch"
    
    # Pull latest changes
    print_color "${YELLOW}" "[$agent_name] Pulling latest changes..."
    git pull origin "$current_branch" 2>/dev/null || true
    
    # Edit the file
    print_color "${GREEN}" "[$agent_name] Editing $file_to_edit..."
    echo "$line_to_add" >> "$file_to_edit"
    
    # Show the change
    print_color "${CYAN}" "[$agent_name] Changes made:"
    tail -n 5 "$file_to_edit"
    
    # Stage changes
    git add "$file_to_edit"
    
    # Write commit message for DevOps agent
    local msg_file=".devops-commit-${session_id}.msg"
    echo "$commit_msg" > "$msg_file"
    
    print_color "${GREEN}" "[$agent_name] Commit message written to $msg_file"
    
    # Simulate the agent committing (in real scenario, the DevOps agent would do this)
    git commit -m "$commit_msg" 2>/dev/null || {
        print_color "${RED}" "[$agent_name] Commit failed!"
        return 1
    }
    
    # Try to push
    print_color "${YELLOW}" "[$agent_name] Attempting to push..."
    if git push origin "$current_branch" 2>/dev/null; then
        print_color "${GREEN}" "[$agent_name] ✓ Push successful!"
        return 0
    else
        print_color "${RED}" "[$agent_name] ✗ Push failed - conflict detected!"
        
        # Attempt automatic merge
        print_color "${YELLOW}" "[$agent_name] Attempting to resolve conflict..."
        git pull --rebase origin "$current_branch" 2>/dev/null || {
            print_color "${RED}" "[$agent_name] Rebase failed - manual intervention needed"
            
            # Show conflict status
            print_color "${CYAN}" "[$agent_name] Conflict details:"
            git status --short
            
            # Abort rebase for clean state
            git rebase --abort 2>/dev/null || true
            return 1
        }
        
        # Try push again after rebase
        if git push origin "$current_branch" 2>/dev/null; then
            print_color "${GREEN}" "[$agent_name] ✓ Push successful after rebase!"
            return 0
        else
            print_color "${RED}" "[$agent_name] ✗ Push still failed after rebase"
            return 1
        fi
    fi
}

# Main test execution
main() {
    print_section "MULTI-AGENT CONFLICT TESTING"
    
    # Check if we have session IDs
    if [ $# -lt 2 ]; then
        print_color "${YELLOW}" "Usage: $0 <session-id-1> <session-id-2>"
        print_color "${YELLOW}" "Creating two test sessions..."
        
        # You would need to create sessions first
        print_color "${RED}" "Please create two sessions first using:"
        print_color "${CYAN}" "node src/session-coordinator.js create --task \"test-agent-1\""
        print_color "${CYAN}" "node src/session-coordinator.js create --task \"test-agent-2\""
        exit 1
    fi
    
    SESSION1=$1
    SESSION2=$2
    
    # Find worktree paths
    WORKTREE1=$(find "$REPO_ROOT/local_deploy/worktrees" -maxdepth 1 -name "*${SESSION1}*" -type d | head -1)
    WORKTREE2=$(find "$REPO_ROOT/local_deploy/worktrees" -maxdepth 1 -name "*${SESSION2}*" -type d | head -1)
    
    if [ -z "$WORKTREE1" ] || [ -z "$WORKTREE2" ]; then
        print_color "${RED}" "Error: Could not find worktrees for the provided sessions"
        print_color "${CYAN}" "Session 1 worktree: $WORKTREE1"
        print_color "${CYAN}" "Session 2 worktree: $WORKTREE2"
        exit 1
    fi
    
    print_color "${GREEN}" "Found worktrees:"
    print_color "${CYAN}" "  Agent 1: $WORKTREE1"
    print_color "${CYAN}" "  Agent 2: $WORKTREE2"
    
    # Create a shared test file in both worktrees
    TEST_FILE="multi-agent-test.md"
    
    print_section "TEST 1: SEQUENTIAL EDITS (No Conflict)"
    
    # Agent 1 creates the initial file
    cd "$WORKTREE1"
    cat > "$TEST_FILE" << EOF
# Multi-Agent Test File

This file tests concurrent editing by multiple agents.

## Test Log
EOF
    
    git add "$TEST_FILE"
    git commit -m "test: initialize multi-agent test file"
    git push origin "$(git rev-parse --abbrev-ref HEAD)"
    
    # Agent 2 pulls the file
    cd "$WORKTREE2"
    git pull origin "$(git rev-parse --abbrev-ref HEAD)"
    
    # Sequential edits (should work fine)
    simulate_agent_work "$SESSION1" "Agent-1" "$WORKTREE1" "$TEST_FILE" \
        "- [$(date '+%H:%M:%S')] Agent 1: Added first entry" \
        "test: Agent 1 sequential edit"
    
    sleep 2
    
    simulate_agent_work "$SESSION2" "Agent-2" "$WORKTREE2" "$TEST_FILE" \
        "- [$(date '+%H:%M:%S')] Agent 2: Added second entry" \
        "test: Agent 2 sequential edit"
    
    print_section "TEST 2: CONCURRENT EDITS - SAME FILE, DIFFERENT LINES"
    
    # Both agents edit simultaneously (different parts of file)
    print_color "${YELLOW}" "Simulating concurrent edits to different sections..."
    
    # Agent 1 adds to top section
    cd "$WORKTREE1"
    git pull origin "$(git rev-parse --abbrev-ref HEAD)"
    sed -i '' '4a\
### Section A (Agent 1)\
This section is managed by Agent 1.\
' "$TEST_FILE"
    
    # Agent 2 adds to bottom section (before Agent 1 pushes)
    cd "$WORKTREE2"
    git pull origin "$(git rev-parse --abbrev-ref HEAD)"
    echo "" >> "$TEST_FILE"
    echo "### Section B (Agent 2)" >> "$TEST_FILE"
    echo "This section is managed by Agent 2." >> "$TEST_FILE"
    
    # Both try to commit and push
    print_color "${YELLOW}" "Both agents attempting to push..."
    
    # Agent 1 commits and pushes first
    cd "$WORKTREE1"
    git add "$TEST_FILE"
    git commit -m "test: Agent 1 adds Section A"
    git push origin "$(git rev-parse --abbrev-ref HEAD)"
    print_color "${GREEN}" "[Agent-1] ✓ Pushed successfully (first)"
    
    # Agent 2 tries to push (should fail, then merge)
    cd "$WORKTREE2"
    git add "$TEST_FILE"
    git commit -m "test: Agent 2 adds Section B"
    
    if ! git push origin "$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null; then
        print_color "${YELLOW}" "[Agent-2] Push failed, attempting merge..."
        git pull --no-rebase origin "$(git rev-parse --abbrev-ref HEAD)"
        git push origin "$(git rev-parse --abbrev-ref HEAD)"
        print_color "${GREEN}" "[Agent-2] ✓ Pushed successfully (after merge)"
    fi
    
    print_section "TEST 3: CONCURRENT EDITS - SAME LINE (Conflict)"
    
    # Create a conflict scenario
    print_color "${YELLOW}" "Creating a conflict scenario..."
    
    # Both agents edit the same line
    CONFLICT_FILE="conflict-test.md"
    
    # Initialize conflict file from Agent 1
    cd "$WORKTREE1"
    git pull origin "$(git rev-parse --abbrev-ref HEAD)"
    cat > "$CONFLICT_FILE" << EOF
# Conflict Test
Status: PENDING
Count: 0
EOF
    git add "$CONFLICT_FILE"
    git commit -m "test: initialize conflict test file"
    git push origin "$(git rev-parse --abbrev-ref HEAD)"
    
    # Agent 2 pulls
    cd "$WORKTREE2"
    git pull origin "$(git rev-parse --abbrev-ref HEAD)"
    
    # Both modify the same line simultaneously
    cd "$WORKTREE1"
    sed -i '' 's/Status: PENDING/Status: COMPLETED_BY_AGENT1/' "$CONFLICT_FILE"
    sed -i '' 's/Count: 0/Count: 1/' "$CONFLICT_FILE"
    
    cd "$WORKTREE2"
    sed -i '' 's/Status: PENDING/Status: COMPLETED_BY_AGENT2/' "$CONFLICT_FILE"
    sed -i '' 's/Count: 0/Count: 2/' "$CONFLICT_FILE"
    
    # Agent 1 commits and pushes first
    cd "$WORKTREE1"
    git add "$CONFLICT_FILE"
    git commit -m "test: Agent 1 updates status and count"
    git push origin "$(git rev-parse --abbrev-ref HEAD)"
    print_color "${GREEN}" "[Agent-1] ✓ Pushed conflict changes (first)"
    
    # Agent 2 tries to push (will definitely conflict)
    cd "$WORKTREE2"
    git add "$CONFLICT_FILE"
    git commit -m "test: Agent 2 updates status and count"
    
    print_color "${YELLOW}" "[Agent-2] Attempting to push (expecting conflict)..."
    if ! git push origin "$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null; then
        print_color "${RED}" "[Agent-2] ✗ Push failed (as expected)"
        print_color "${YELLOW}" "[Agent-2] Attempting automatic resolution..."
        
        # Try to pull and resolve
        if ! git pull --no-rebase origin "$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null; then
            print_color "${RED}" "[Agent-2] ✗ Automatic merge failed - conflict markers present"
            
            # Show conflict
            print_color "${CYAN}" "[Agent-2] Conflict in $CONFLICT_FILE:"
            cat "$CONFLICT_FILE" | grep -A2 -B2 "<<<<<<" || true
            
            # Resolve by taking both changes
            print_color "${YELLOW}" "[Agent-2] Resolving conflict by combining both changes..."
            cat > "$CONFLICT_FILE" << EOF
# Conflict Test
Status: COMPLETED_BY_BOTH
Count: 3
Resolution: Merged both agent changes
EOF
            git add "$CONFLICT_FILE"
            git commit -m "test: resolve conflict by merging both agent changes"
            git push origin "$(git rev-parse --abbrev-ref HEAD)"
            print_color "${GREEN}" "[Agent-2] ✓ Conflict resolved and pushed"
        fi
    fi
    
    print_section "TEST RESULTS SUMMARY"
    
    # Show final state
    cd "$WORKTREE1"
    git pull origin "$(git rev-parse --abbrev-ref HEAD)"
    
    print_color "${BOLD}${GREEN}" "Final file contents:"
    echo
    print_color "${CYAN}" "=== $TEST_FILE ==="
    cat "$TEST_FILE"
    echo
    print_color "${CYAN}" "=== $CONFLICT_FILE ==="
    cat "$CONFLICT_FILE"
    echo
    
    # Show commit history
    print_color "${BOLD}${GREEN}" "Commit history (last 10):"
    git log --oneline --graph -10
    
    print_section "TEST COMPLETE"
    
    print_color "${GREEN}" "✓ Multi-agent conflict testing completed"
    print_color "${YELLOW}" "Key findings:"
    print_color "${CYAN}" "  1. Sequential edits work without issues"
    print_color "${CYAN}" "  2. Concurrent edits to different sections can auto-merge"
    print_color "${CYAN}" "  3. Same-line edits create conflicts requiring resolution"
    print_color "${CYAN}" "  4. The DevOps agent needs conflict resolution strategies"
}

# Run main function
main "$@"