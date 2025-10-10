#!/bin/bash

# Multi-Session Live Test for Branch Management System
# Tests the new dual merge and branch management features in a real repository

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TEST_REPO="/Volumes/Simba User Data/Development/SecondBrain_Code_Studio/CS_TechWriterAgent"
DEVOPS_AGENT_DIR="/Volumes/Simba User Data/Development/SecondBrain_Code_Studio/DevOpsAgent"
NUM_SESSIONS=3

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Multi-Session Branch Management Live Test                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo

echo -e "${YELLOW}Test Repository:${NC} $TEST_REPO"
echo -e "${YELLOW}DevOps Agent:${NC} $DEVOPS_AGENT_DIR"
echo -e "${YELLOW}Number of Sessions:${NC} $NUM_SESSIONS"
echo

# Check if test repo exists
if [ ! -d "$TEST_REPO" ]; then
    echo -e "${RED}✗ Test repository not found: $TEST_REPO${NC}"
    exit 1
fi

# Check if we're on the right branch
cd "$DEVOPS_AGENT_DIR"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "manus_1010_mergeUpgrade" ]; then
    echo -e "${YELLOW}⚠ Current branch is '$CURRENT_BRANCH', expected 'manus_1010_mergeUpgrade'${NC}"
    echo -n "Switch to manus_1010_mergeUpgrade branch? (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        git checkout manus_1010_mergeUpgrade
    else
        echo -e "${RED}✗ Aborted${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ On branch: manus_1010_mergeUpgrade${NC}"
echo

# Step 1: Backup current state
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Backing up current state${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$TEST_REPO"
CURRENT_BRANCH_TEST=$(git branch --show-current)
echo "Current branch in test repo: $CURRENT_BRANCH_TEST"
git status --short

# Step 2: Configure branch management settings
echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Configuring branch management${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Create project settings with dual merge enabled
mkdir -p "$TEST_REPO/local_deploy"
cat > "$TEST_REPO/local_deploy/project-settings.json" << 'EOF'
{
  "version": "1.6.2",
  "versioningStrategy": {
    "prefix": "v0.",
    "startMinor": 20,
    "configured": true
  },
  "branchManagement": {
    "defaultMergeTarget": "main",
    "enableDualMerge": true,
    "enableWeeklyConsolidation": true,
    "orphanSessionThresholdDays": 7,
    "mergeStrategy": "hierarchical-first",
    "conflictResolution": "prompt",
    "dailyBranchPrefix": "daily",
    "weeklyBranchPrefix": "weekly",
    "sessionBranchPrefix": "session"
  },
  "autoMergeConfig": {
    "enabled": false,
    "targetBranch": "main",
    "strategy": "pull-request"
  }
}
EOF

echo -e "${GREEN}✓ Created project settings with dual merge enabled${NC}"
cat "$TEST_REPO/local_deploy/project-settings.json"

# Step 3: Create multiple test sessions
echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Creating $NUM_SESSIONS test sessions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Get today's date for daily branch
TODAY=$(date +%Y-%m-%d)
DAILY_BRANCH="daily/$TODAY"

# Ensure we're on main
git checkout main 2>/dev/null || git checkout -b main

# Create daily branch if it doesn't exist
if ! git show-ref --verify --quiet "refs/heads/$DAILY_BRANCH"; then
    git checkout -b "$DAILY_BRANCH"
    echo -e "${GREEN}✓ Created daily branch: $DAILY_BRANCH${NC}"
else
    git checkout "$DAILY_BRANCH"
    echo -e "${YELLOW}⚠ Daily branch already exists: $DAILY_BRANCH${NC}"
fi

# Create session branches
for i in $(seq 1 $NUM_SESSIONS); do
    SESSION_ID="test-$(date +%s)-$i"
    SESSION_BRANCH="session/sdd-warp-${SESSION_ID}"
    
    echo
    echo -e "${YELLOW}Creating session $i: $SESSION_BRANCH${NC}"
    
    # Create session branch from daily branch
    git checkout "$DAILY_BRANCH"
    git checkout -b "$SESSION_BRANCH"
    
    # Make some changes
    echo "Test content from session $i - $(date)" >> "test_file_session_$i.txt"
    git add "test_file_session_$i.txt"
    git commit -m "feat: add test content from session $i"
    
    # Create session lock file
    mkdir -p "$TEST_REPO/local_deploy/session-locks"
    cat > "$TEST_REPO/local_deploy/session-locks/${SESSION_ID}.lock" << EOF
{
  "sessionId": "${SESSION_ID}",
  "agentType": "warp",
  "task": "test-session-${i}",
  "worktreePath": "$TEST_REPO/local_deploy/worktrees/sdd-warp-${SESSION_ID}",
  "branchName": "${SESSION_BRANCH}",
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
    
    echo -e "${GREEN}✓ Session $i created: $SESSION_BRANCH${NC}"
    echo -e "  Branch: $SESSION_BRANCH"
    echo -e "  Lock file: local_deploy/session-locks/${SESSION_ID}.lock"
done

# Step 4: Show current branch structure
echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Current branch structure${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo
echo "All branches:"
git branch -a | grep -E "(session|daily|weekly|main)"

echo
echo "Session lock files:"
ls -la "$TEST_REPO/local_deploy/session-locks/" 2>/dev/null || echo "No session lock files"

# Step 5: Test instructions
echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Test Instructions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo
echo -e "${YELLOW}Test Environment Ready!${NC}"
echo
echo "To test the enhanced branch management:"
echo
echo -e "${GREEN}1. Test enhanced session closure with dual merge:${NC}"
echo "   cd $DEVOPS_AGENT_DIR"
echo "   node src/enhanced-close-session.js --session test-XXXXXX-1 --repo $TEST_REPO"
echo
echo -e "${GREEN}2. Test weekly consolidation:${NC}"
echo "   node src/weekly-consolidator.js --repo $TEST_REPO"
echo
echo -e "${GREEN}3. Test orphan cleanup:${NC}"
echo "   node src/orphan-cleaner.js --repo $TEST_REPO --dry-run"
echo
echo -e "${GREEN}4. View branch structure:${NC}"
echo "   cd $TEST_REPO && git log --all --decorate --oneline --graph"
echo
echo -e "${YELLOW}Expected behavior:${NC}"
echo "  - Session branches merge to both daily branch AND main (dual merge)"
echo "  - Daily branches can be consolidated into weekly branches"
echo "  - Orphaned sessions detected after threshold period"
echo

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Test environment setup complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
