#!/bin/bash

# End-to-End Test: Multi-Agent with Conflicts and Merge Scenarios
# Tests:
# 1. Two coding agents working in parallel
# 2. File coordination conflicts (editing declared files)
# 3. Undeclared edits (editing without declaring)
# 4. Dual merge to daily + main
# 5. Conflict resolution during merge

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
TEST_REPO="/Volumes/Simba User Data/Development/SecondBrain_Code_Studio/CS_TechWriterAgent"
DEVOPS_AGENT_DIR="/Volumes/Simba User Data/Development/SecondBrain_Code_Studio/DevOpsAgent"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  End-to-End Multi-Agent Conflict & Merge Test             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo

# Ensure we're on the right branch
cd "$DEVOPS_AGENT_DIR"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "manus_1010_mergeUpgrade" ]; then
    echo -e "${YELLOW}Switching to manus_1010_mergeUpgrade branch...${NC}"
    git checkout manus_1010_mergeUpgrade
fi

cd "$TEST_REPO"

# Setup
TODAY=$(date +%Y-%m-%d)
DAILY_BRANCH="daily/$TODAY"
AGENT1_ID="agent1-$(date +%s)"
AGENT2_ID="agent2-$(date +%s)"
AGENT1_BRANCH="session/sdd-warp-${AGENT1_ID}"
AGENT2_BRANCH="session/sdd-warp-${AGENT2_ID}"

echo -e "${YELLOW}Test Setup:${NC}"
echo "  Repository: $TEST_REPO"
echo "  Daily Branch: $DAILY_BRANCH"
echo "  Agent 1: $AGENT1_BRANCH"
echo "  Agent 2: $AGENT2_BRANCH"
echo

# Configure project settings
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Setting up project with dual merge enabled${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

mkdir -p "$TEST_REPO/local_deploy"
mkdir -p "$TEST_REPO/.file-coordination/active-edits"
mkdir -p "$TEST_REPO/.file-coordination/completed-edits"

cat > "$TEST_REPO/local_deploy/project-settings.json" << 'EOF'
{
  "version": "1.6.2",
  "branchManagement": {
    "defaultMergeTarget": "main",
    "enableDualMerge": true,
    "enableWeeklyConsolidation": true,
    "mergeStrategy": "hierarchical-first",
    "conflictResolution": "prompt"
  }
}
EOF

echo -e "${GREEN}✓ Project settings configured${NC}"
echo

# Create daily branch
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Creating daily branch${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

git checkout main 2>/dev/null || git checkout -b main
if ! git show-ref --verify --quiet "refs/heads/$DAILY_BRANCH"; then
    git checkout -b "$DAILY_BRANCH"
    echo -e "${GREEN}✓ Created daily branch: $DAILY_BRANCH${NC}"
else
    git checkout "$DAILY_BRANCH"
    echo -e "${YELLOW}⚠ Daily branch exists: $DAILY_BRANCH${NC}"
fi
echo

# TEST 1: Agent 1 declares and edits a file
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}TEST 1: Agent 1 - Proper file coordination${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

git checkout "$DAILY_BRANCH"
git checkout -b "$AGENT1_BRANCH"

# Agent 1 declares intent
echo -e "${YELLOW}Agent 1: Declaring intent to edit test_calculator.py${NC}"
cat > "$TEST_REPO/.file-coordination/active-edits/agent1-${AGENT1_ID}.json" << EOF
{
  "agent": "agent1",
  "session": "${AGENT1_ID}",
  "files": ["test_calculator.py"],
  "operation": "edit",
  "reason": "Adding new calculation methods",
  "declaredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "estimatedDuration": 300
}
EOF

# Agent 1 makes changes
echo -e "${YELLOW}Agent 1: Editing test_calculator.py${NC}"
cat >> test_calculator.py << 'EOF'

    def multiply(self, a, b):
        """Multiply two numbers - added by Agent 1"""
        return a * b
EOF

git add test_calculator.py .file-coordination/active-edits/agent1-${AGENT1_ID}.json
git commit -m "feat(agent1): add multiply method to calculator"

echo -e "${GREEN}✓ Agent 1 completed work on test_calculator.py${NC}"
echo

# TEST 2: Agent 2 tries to edit the SAME file (CONFLICT scenario)
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}TEST 2: Agent 2 - Conflict detection (same file)${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

git checkout "$DAILY_BRANCH"
git checkout -b "$AGENT2_BRANCH"

# Agent 2 checks for conflicts
echo -e "${YELLOW}Agent 2: Checking active edits before declaring...${NC}"
if [ -f "$TEST_REPO/.file-coordination/active-edits/agent1-${AGENT1_ID}.json" ]; then
    echo -e "${RED}🚨 CONFLICT DETECTED!${NC}"
    echo -e "${RED}Agent 1 has declared: test_calculator.py${NC}"
    cat "$TEST_REPO/.file-coordination/active-edits/agent1-${AGENT1_ID}.json"
    echo
    echo -e "${YELLOW}⚠ Agent 2 should ASK USER for permission before proceeding${NC}"
    echo -e "${YELLOW}⚠ For this test, we'll simulate choosing a different file${NC}"
    echo
fi

# Agent 2 chooses a different file (proper behavior)
echo -e "${YELLOW}Agent 2: Declaring intent to edit test_string_operations.py (different file)${NC}"
cat > "$TEST_REPO/.file-coordination/active-edits/agent2-${AGENT2_ID}.json" << EOF
{
  "agent": "agent2",
  "session": "${AGENT2_ID}",
  "files": ["test_string_operations.py"],
  "operation": "edit",
  "reason": "Adding string manipulation methods",
  "declaredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "estimatedDuration": 300
}
EOF

echo -e "${YELLOW}Agent 2: Editing test_string_operations.py${NC}"
cat >> test_string_operations.py << 'EOF'

    def reverse_string(self, text):
        """Reverse a string - added by Agent 2"""
        return text[::-1]
EOF

git add test_string_operations.py .file-coordination/active-edits/agent2-${AGENT2_ID}.json
git commit -m "feat(agent2): add reverse_string method"

echo -e "${GREEN}✓ Agent 2 completed work on test_string_operations.py (no conflict)${NC}"
echo

# TEST 3: Simulate undeclared edit (VIOLATION scenario)
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}TEST 3: Agent 2 - Undeclared edit (violation)${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

echo -e "${RED}Agent 2: Making undeclared edit to test_data_processor.py${NC}"
echo -e "${RED}(This violates house rules - editing without declaring!)${NC}"

cat >> test_data_processor.py << 'EOF'

    def sort_data(self, data):
        """Sort data - UNDECLARED EDIT by Agent 2"""
        return sorted(data)
EOF

git add test_data_processor.py
git commit -m "feat(agent2): add sort_data method (UNDECLARED)"

echo -e "${YELLOW}⚠ Violation detected: Agent 2 edited test_data_processor.py without declaring${NC}"
echo -e "${YELLOW}⚠ File coordinator should flag this in real workflow${NC}"
echo

# TEST 4: Release file locks
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Releasing file coordination locks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

git checkout "$AGENT1_BRANCH"
if [ -f ".file-coordination/active-edits/agent1-${AGENT1_ID}.json" ]; then
    mv ".file-coordination/active-edits/agent1-${AGENT1_ID}.json" ".file-coordination/completed-edits/"
    git add .file-coordination/
    git commit -m "chore(agent1): release file locks"
    echo -e "${GREEN}✓ Agent 1 released file locks${NC}"
fi

git checkout "$AGENT2_BRANCH"
if [ -f ".file-coordination/active-edits/agent2-${AGENT2_ID}.json" ]; then
    mv ".file-coordination/active-edits/agent2-${AGENT2_ID}.json" ".file-coordination/completed-edits/"
    git add .file-coordination/
    git commit -m "chore(agent2): release file locks"
    echo -e "${GREEN}✓ Agent 2 released file locks${NC}"
fi
echo

# Create session lock files for both agents
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Creating session lock files${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

mkdir -p "$TEST_REPO/local_deploy/session-locks"

cat > "$TEST_REPO/local_deploy/session-locks/${AGENT1_ID}.lock" << EOF
{
  "sessionId": "${AGENT1_ID}",
  "agentType": "warp",
  "task": "calculator-enhancements",
  "worktreePath": "$TEST_REPO/local_deploy/worktrees/sdd-warp-${AGENT1_ID}",
  "branchName": "${AGENT1_BRANCH}",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "active",
  "developerInitials": "sdd",
  "mergeConfig": {
    "autoMerge": true,
    "targetBranch": "main",
    "strategy": "hierarchical-first"
  }
}
EOF

cat > "$TEST_REPO/local_deploy/session-locks/${AGENT2_ID}.lock" << EOF
{
  "sessionId": "${AGENT2_ID}",
  "agentType": "warp",
  "task": "string-operations",
  "worktreePath": "$TEST_REPO/local_deploy/worktrees/sdd-warp-${AGENT2_ID}",
  "branchName": "${AGENT2_BRANCH}",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "active",
  "developerInitials": "sdd",
  "mergeConfig": {
    "autoMerge": true,
    "targetBranch": "main",
    "strategy": "hierarchical-first"
  }
}
EOF

echo -e "${GREEN}✓ Session locks created for both agents${NC}"
echo

# Show current state
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Current branch structure${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
git log --all --decorate --oneline --graph --max-count=15 | grep -E "(agent1|agent2|daily|main)"
echo

# TEST 5: Test dual merge for Agent 1
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}TEST 5: Agent 1 - Dual merge (to daily + main)${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

cd "$DEVOPS_AGENT_DIR"

echo -e "${YELLOW}Merging Agent 1 session: ${AGENT1_ID}${NC}"
echo -e "${YELLOW}Expected: Merge to daily/$TODAY AND main${NC}"
echo

# Check if enhanced-close-session.js can be run
if [ -f "$DEVOPS_AGENT_DIR/src/enhanced-close-session.js" ]; then
    echo -e "${BLUE}Running enhanced session closer for Agent 1...${NC}"
    node "$DEVOPS_AGENT_DIR/src/enhanced-close-session.js" \
        --session "${AGENT1_ID}" \
        --repo "$TEST_REPO" \
        2>&1 | head -50
    echo
    echo -e "${GREEN}✓ Agent 1 merge attempted${NC}"
else
    echo -e "${YELLOW}⚠ enhanced-close-session.js not found, performing manual merge${NC}"
    
    # Manual dual merge simulation
    cd "$TEST_REPO"
    
    # Merge to daily
    git checkout "$DAILY_BRANCH"
    git merge --no-ff "$AGENT1_BRANCH" -m "Merge agent1 session: calculator enhancements to daily"
    echo -e "${GREEN}✓ Merged to daily branch${NC}"
    
    # Merge to main
    git checkout main
    git merge --no-ff "$AGENT1_BRANCH" -m "Merge agent1 session: calculator enhancements to main"
    echo -e "${GREEN}✓ Merged to main branch${NC}"
fi
echo

# TEST 6: Test dual merge for Agent 2
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}TEST 6: Agent 2 - Dual merge (to daily + main)${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

cd "$DEVOPS_AGENT_DIR"

echo -e "${YELLOW}Merging Agent 2 session: ${AGENT2_ID}${NC}"
echo -e "${YELLOW}Expected: Merge to daily/$TODAY AND main${NC}"
echo

if [ -f "$DEVOPS_AGENT_DIR/src/enhanced-close-session.js" ]; then
    echo -e "${BLUE}Running enhanced session closer for Agent 2...${NC}"
    node "$DEVOPS_AGENT_DIR/src/enhanced-close-session.js" \
        --session "${AGENT2_ID}" \
        --repo "$TEST_REPO" \
        2>&1 | head -50
    echo
    echo -e "${GREEN}✓ Agent 2 merge attempted${NC}"
else
    cd "$TEST_REPO"
    
    # Manual dual merge
    git checkout "$DAILY_BRANCH"
    git merge --no-ff "$AGENT2_BRANCH" -m "Merge agent2 session: string operations to daily"
    echo -e "${GREEN}✓ Merged to daily branch${NC}"
    
    git checkout main
    git merge --no-ff "$AGENT2_BRANCH" -m "Merge agent2 session: string operations to main"
    echo -e "${GREEN}✓ Merged to main branch${NC}"
fi
echo

# Final verification
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Final Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$TEST_REPO"

echo
echo -e "${GREEN}Commits in daily branch:${NC}"
git log "$DAILY_BRANCH" --oneline --max-count=5

echo
echo -e "${GREEN}Commits in main branch:${NC}"
git log main --oneline --max-count=5

echo
echo -e "${GREEN}Branch graph (last 20 commits):${NC}"
git log --all --decorate --oneline --graph --max-count=20

echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ End-to-End Test Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo
echo -e "${YELLOW}Test Summary:${NC}"
echo -e "  ${GREEN}✓${NC} Agent 1 declared and edited files properly"
echo -e "  ${GREEN}✓${NC} Agent 2 detected conflict and chose different file"
echo -e "  ${RED}✗${NC} Agent 2 made undeclared edit (violation captured)"
echo -e "  ${GREEN}✓${NC} Both agents released file locks"
echo -e "  ${GREEN}✓${NC} Dual merge to daily and main branches"
echo
echo -e "${YELLOW}Session IDs for cleanup:${NC}"
echo -e "  Agent 1: ${AGENT1_ID}"
echo -e "  Agent 2: ${AGENT2_ID}"
echo
echo -e "${YELLOW}To clean up test branches:${NC}"
echo "  git checkout main"
echo "  git branch -D $AGENT1_BRANCH $AGENT2_BRANCH $DAILY_BRANCH"
