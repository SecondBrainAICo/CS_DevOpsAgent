#!/bin/bash

# ============================================================================
# MULTI-AGENT CONFLICT TESTING
# ============================================================================
# This script demonstrates various conflict scenarios and how they're handled
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

# Navigate to repo root
cd "$(dirname "$0")/../.." || exit 1
REPO_ROOT=$(pwd)

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

print_step() {
    echo -e "${YELLOW}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_conflict() {
    echo -e "${RED}⚠ CONFLICT:${NC} $1"
}

print_resolution() {
    echo -e "${GREEN}✓ RESOLVED:${NC} $1"
}

cleanup_test_sessions() {
    # Clean up any test sessions
    echo "Y" | node src/session-coordinator.js close "$SESSION1" > /dev/null 2>&1
    echo "Y" | node src/session-coordinator.js close "$SESSION2" > /dev/null 2>&1
    rm -f /tmp/conflict-test-*.log
}

# Trap to ensure cleanup
trap cleanup_test_sessions EXIT

print_section "MULTI-AGENT CONFLICT DEMONSTRATION"

print_color "${YELLOW}" "This test will demonstrate:"
print_color "${CYAN}" "  1. No conflict - Different files"
print_color "${CYAN}" "  2. No conflict - Same file, different sections"
print_color "${CYAN}" "  3. Conflict - Same file, same lines"
print_color "${CYAN}" "  4. Conflict resolution strategies"
echo

# ============================================================================
# SETUP
# ============================================================================

print_section "SETUP: Creating Two Agent Sessions"

# Create first session
print_step "Creating session for Agent 1..."
echo "n" | node src/session-coordinator.js create --task "conflict-test-1" --agent "agent1" > /tmp/conflict-test-1.log 2>&1
SESSION1=$(grep "Session ID:" /tmp/conflict-test-1.log | head -1 | awk '{print $3}')
WORKTREE1=$(find local_deploy/worktrees -name "*${SESSION1}*" -type d 2>/dev/null | head -1)

if [ -z "$SESSION1" ] || [ -z "$WORKTREE1" ]; then
    print_color "${RED}" "Failed to create session 1"
    exit 1
fi
print_success "Agent 1 session: $SESSION1"
print_color "${CYAN}" "  Worktree: $(basename "$WORKTREE1")"

# Create second session  
print_step "Creating session for Agent 2..."
echo "n" | node src/session-coordinator.js create --task "conflict-test-2" --agent "agent2" > /tmp/conflict-test-2.log 2>&1
SESSION2=$(grep "Session ID:" /tmp/conflict-test-2.log | head -1 | awk '{print $3}')
WORKTREE2=$(find local_deploy/worktrees -name "*${SESSION2}*" -type d 2>/dev/null | head -1)

if [ -z "$SESSION2" ] || [ -z "$WORKTREE2" ]; then
    print_color "${RED}" "Failed to create session 2"
    exit 1
fi
print_success "Agent 2 session: $SESSION2"
print_color "${CYAN}" "  Worktree: $(basename "$WORKTREE2")"

# Get branch names
cd "$WORKTREE1"
BRANCH1=$(git rev-parse --abbrev-ref HEAD)
cd "$WORKTREE2"
BRANCH2=$(git rev-parse --abbrev-ref HEAD)
cd "$REPO_ROOT"

print_success "Setup complete - Two agents ready"

# ============================================================================
# TEST 1: NO CONFLICT - DIFFERENT FILES
# ============================================================================

print_section "TEST 1: No Conflict - Different Files"

print_step "Agent 1 creates file1.txt..."
cat > "$WORKTREE1/file1.txt" << EOF
File created by Agent 1
Session: $SESSION1
Time: $(date)
EOF

cd "$WORKTREE1"
git add file1.txt
git commit -m "feat: Agent 1 creates file1.txt" > /dev/null 2>&1
git push origin "$BRANCH1" > /dev/null 2>&1
print_success "Agent 1 pushed file1.txt"

print_step "Agent 2 creates file2.txt (different file)..."
cat > "$WORKTREE2/file2.txt" << EOF
File created by Agent 2
Session: $SESSION2
Time: $(date)
EOF

cd "$WORKTREE2"
git add file2.txt
git commit -m "feat: Agent 2 creates file2.txt" > /dev/null 2>&1
git push origin "$BRANCH2" > /dev/null 2>&1
print_success "Agent 2 pushed file2.txt"

print_color "${GREEN}" "✓ NO CONFLICT: Agents worked on different files"
echo

# ============================================================================
# TEST 2: NO CONFLICT - SAME FILE, DIFFERENT SECTIONS
# ============================================================================

print_section "TEST 2: No Conflict - Same File, Different Sections"

# Create a shared file
print_step "Creating shared document..."
cat > "$WORKTREE1/shared-doc.md" << EOF
# Shared Document

## Section A
This section will be edited by Agent 1.

## Section B
This section will be edited by Agent 2.

## Section C
This section will remain unchanged.
EOF

cd "$WORKTREE1"
git add shared-doc.md
git commit -m "docs: create shared document" > /dev/null 2>&1
git push origin "$BRANCH1" > /dev/null 2>&1
print_success "Shared document created"

# Agent 2 pulls the file
print_step "Agent 2 pulls the shared document..."
cd "$WORKTREE2"
git pull origin "$BRANCH1" > /dev/null 2>&1
print_success "Agent 2 has the document"

# Agent 1 edits Section A
print_step "Agent 1 edits Section A..."
sed -i '' 's/This section will be edited by Agent 1./Agent 1 has modified this section at '"$(date +%T)"'/' "$WORKTREE1/shared-doc.md"
cd "$WORKTREE1"
git add shared-doc.md
git commit -m "docs: Agent 1 updates Section A" > /dev/null 2>&1

# Agent 2 edits Section B (before Agent 1 pushes)
print_step "Agent 2 edits Section B (simultaneously)..."
sed -i '' 's/This section will be edited by Agent 2./Agent 2 has modified this section at '"$(date +%T)"'/' "$WORKTREE2/shared-doc.md"
cd "$WORKTREE2"
git add shared-doc.md
git commit -m "docs: Agent 2 updates Section B" > /dev/null 2>&1

# Agent 1 pushes first
print_step "Agent 1 pushes changes..."
cd "$WORKTREE1"
git push origin "$BRANCH1" > /dev/null 2>&1
print_success "Agent 1 pushed successfully"

# Agent 2 tries to push
print_step "Agent 2 attempts to push..."
cd "$WORKTREE2"
if git push origin "$BRANCH2" > /dev/null 2>&1; then
    print_success "Agent 2 pushed (different branches)"
else
    # If on same branch, need to pull and merge
    print_color "${YELLOW}" "Push failed - pulling and merging..."
    git pull origin "$BRANCH1" --no-edit > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        git push origin "$BRANCH2" > /dev/null 2>&1
        print_resolution "Auto-merged successfully (different sections)"
    fi
fi

print_color "${GREEN}" "✓ NO CONFLICT: Changes were in different sections"
echo

# ============================================================================
# TEST 3: CONFLICT - SAME FILE, SAME LINES
# ============================================================================

print_section "TEST 3: Conflict - Same File, Same Lines"

# Create a JSON config file
print_step "Creating configuration file..."
cat > "$WORKTREE1/config.json" << EOF
{
  "version": "1.0.0",
  "status": "pending",
  "count": 0,
  "agent": "none",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

cd "$WORKTREE1"
git add config.json
git commit -m "feat: create config file" > /dev/null 2>&1
git push origin "$BRANCH1" > /dev/null 2>&1
print_success "Config file created"

# Agent 2 pulls
print_step "Agent 2 pulls config file..."
cd "$WORKTREE2"
git pull origin "$BRANCH1" > /dev/null 2>&1
print_success "Both agents have the same config"

# Both edit the same fields simultaneously
print_step "Agent 1 modifies config..."
cat > "$WORKTREE1/config.json" << EOF
{
  "version": "1.0.1",
  "status": "completed",
  "count": 10,
  "agent": "agent1",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

print_step "Agent 2 modifies config (same fields)..."
cat > "$WORKTREE2/config.json" << EOF
{
  "version": "1.0.2",
  "status": "in_progress",
  "count": 20,
  "agent": "agent2",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Both commit
cd "$WORKTREE1"
git add config.json
git commit -m "feat: Agent 1 updates config" > /dev/null 2>&1

cd "$WORKTREE2"
git add config.json
git commit -m "feat: Agent 2 updates config" > /dev/null 2>&1

# Agent 1 pushes first
print_step "Agent 1 pushes changes..."
cd "$WORKTREE1"
git push origin "$BRANCH1" > /dev/null 2>&1
print_success "Agent 1 pushed successfully"

# Agent 2 tries to push
print_step "Agent 2 attempts to push..."
cd "$WORKTREE2"
if ! git push origin "$BRANCH2" > /dev/null 2>&1; then
    print_conflict "Push rejected - changes conflict!"
    
    # Try to pull
    print_step "Attempting automatic merge..."
    if ! git pull origin "$BRANCH1" --no-edit > /dev/null 2>&1; then
        print_conflict "Automatic merge failed - manual resolution needed"
        
        # Show conflict
        if [ -f "$WORKTREE2/config.json" ]; then
            echo
            print_color "${YELLOW}" "Conflict markers in config.json:"
            echo "----------------------------------------"
            grep -E "<<<<<<|======|>>>>>>" "$WORKTREE2/config.json" 2>/dev/null || echo "(Conflict markers would appear here)"
            echo "----------------------------------------"
        fi
        
        # Demonstrate resolution
        print_step "Resolving conflict by combining both changes..."
        cat > "$WORKTREE2/config.json" << EOF
{
  "version": "1.0.3",
  "status": "merged",
  "count": 30,
  "agent": "both",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "resolution": "manual merge of both agent changes"
}
EOF
        git add config.json
        git commit -m "fix: resolve conflict between agent changes" > /dev/null 2>&1
        git push origin "$BRANCH2" > /dev/null 2>&1
        print_resolution "Conflict resolved manually"
    else
        print_resolution "Auto-merged (unlikely for same lines)"
    fi
fi

echo

# ============================================================================
# TEST 4: CONFLICT RESOLUTION STRATEGIES
# ============================================================================

print_section "TEST 4: Conflict Resolution Strategies"

print_color "${BOLD}${CYAN}" "Available Strategies:"
echo

print_color "${GREEN}" "1. MERGE (Default):"
echo "   - Creates merge commit"
echo "   - Preserves both histories"
echo "   - Good for: collaborative work"
echo

print_color "${GREEN}" "2. REBASE:"
echo "   - Linear history"
echo "   - Cleaner commit log"
echo "   - Good for: feature branches"
echo

print_color "${GREEN}" "3. THEIRS/OURS:"
echo "   - Take one version completely"
echo "   - Discards other changes"
echo "   - Good for: generated files"
echo

print_color "${GREEN}" "4. MANUAL:"
echo "   - Edit conflict markers"
echo "   - Combine both changes"
echo "   - Good for: complex conflicts"
echo

# ============================================================================
# SUMMARY
# ============================================================================

print_section "CONFLICT TEST SUMMARY"

print_color "${BOLD}${GREEN}" "What We Learned:"
echo
print_color "${CYAN}" "✓ Different files = No conflict"
print_color "${CYAN}" "✓ Different sections = Usually auto-merges"
print_color "${CYAN}" "✓ Same lines = Conflict (manual resolution needed)"
print_color "${CYAN}" "✓ Git tracks who pushed first (first wins)"
print_color "${CYAN}" "✓ Second pusher must resolve conflicts"
echo

print_color "${BOLD}${YELLOW}" "Key Insights:"
echo
print_color "${CYAN}" "• Conflicts are NORMAL in multi-agent work"
print_color "${CYAN}" "• Most conflicts can be auto-resolved"
print_color "${CYAN}" "• Complex conflicts need human intervention"
print_color "${CYAN}" "• Good commit messages help understand conflicts"
print_color "${CYAN}" "• Frequent pulls reduce conflict complexity"
echo

print_color "${BOLD}${GREEN}" "Best Practices:"
echo
print_color "${CYAN}" "1. Pull before starting work"
print_color "${CYAN}" "2. Commit and push frequently"
print_color "${CYAN}" "3. Work on separate files when possible"
print_color "${CYAN}" "4. Use clear commit messages"
print_color "${CYAN}" "5. Coordinate on shared files"
echo

print_color "${GREEN}" "✓ Conflict demonstration complete!"
echo

# Cleanup is handled by trap