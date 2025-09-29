#!/bin/bash

# Test script to verify DevOps agent can push new session branches
# This simulates what happens in a real multi-agent session

echo "==================================="
echo "Testing DevOps Agent Push Capability"
echo "==================================="
echo ""

# Configuration
TEST_SESSION_ID="test-push-$(date +%s)"
WORKTREE_DIR="./local_deploy/worktrees/test-${TEST_SESSION_ID}"
BRANCH_NAME="warp/${TEST_SESSION_ID}/test-branch"
COMMIT_MSG_FILE=".devops-commit-${TEST_SESSION_ID}.msg"
TEST_FILE="test-file-${TEST_SESSION_ID}.txt"

echo "Test Configuration:"
echo "  Session ID: ${TEST_SESSION_ID}"
echo "  Branch: ${BRANCH_NAME}"
echo "  Worktree: ${WORKTREE_DIR}"
echo ""

# Step 1: Create a worktree for testing
echo "Step 1: Creating test worktree..."
git worktree add -b "${BRANCH_NAME}" "${WORKTREE_DIR}" main 2>/dev/null || {
    echo "Failed to create worktree. Cleaning up..."
    git worktree remove "${WORKTREE_DIR}" --force 2>/dev/null
    git branch -D "${BRANCH_NAME}" 2>/dev/null
    git worktree add -b "${BRANCH_NAME}" "${WORKTREE_DIR}" main
}
echo "✓ Worktree created"
echo ""

# Step 2: Start the DevOps agent
echo "Step 2: Starting DevOps agent..."
export AC_BRANCH="${BRANCH_NAME}"
export AC_MSG_FILE="${COMMIT_MSG_FILE}"
export AC_DEBUG=1
export AC_PERIOD=5  # Check every 5 seconds for faster testing

cd "${WORKTREE_DIR}"
node "../../../src/cs-devops-agent-worker.js" &
AGENT_PID=$!
echo "✓ Agent started with PID ${AGENT_PID}"
echo ""

# Give agent time to initialize
sleep 2

# Step 3: Create a test change
echo "Step 3: Creating test file and commit message..."
echo "Test content for push verification" > "${TEST_FILE}"
echo "test(push): verify session branch push capability" > "${COMMIT_MSG_FILE}"
echo "✓ Test file and commit message created"
echo ""

# Step 4: Wait for agent to detect and process changes
echo "Step 4: Waiting for agent to commit and push..."
echo "  (This should take about 5-10 seconds)"

# Monitor for up to 30 seconds
for i in {1..6}; do
    sleep 5
    
    # Check if commit was made
    if git log -1 --oneline 2>/dev/null | grep -q "verify session branch push"; then
        echo "✓ Commit detected!"
        
        # Check if push succeeded
        if git ls-remote origin "${BRANCH_NAME}" 2>/dev/null | grep -q "${BRANCH_NAME}"; then
            echo "✓ Branch successfully pushed to remote!"
            break
        else
            echo "  Waiting for push..."
        fi
    else
        echo "  Waiting for commit... (${i}/6)"
    fi
done
echo ""

# Step 5: Verify results
echo "Step 5: Verifying results..."
echo ""
echo "Local commits:"
git log --oneline -3
echo ""

echo "Remote branch status:"
if git ls-remote origin "${BRANCH_NAME}" 2>/dev/null | grep -q "${BRANCH_NAME}"; then
    echo "✅ SUCCESS: Branch '${BRANCH_NAME}' exists on remote!"
    echo "The DevOps agent successfully pushed the session branch."
else
    echo "❌ FAILED: Branch '${BRANCH_NAME}' was not pushed to remote."
    echo ""
    echo "Agent logs (last 20 lines):"
    # Try to show recent agent output
    sleep 2
fi
echo ""

# Step 6: Cleanup
echo "Step 6: Cleaning up..."
kill ${AGENT_PID} 2>/dev/null
cd ../../../
git worktree remove "${WORKTREE_DIR}" --force 2>/dev/null
git push origin --delete "${BRANCH_NAME}" 2>/dev/null  # Clean remote if exists
git branch -D "${BRANCH_NAME}" 2>/dev/null
echo "✓ Cleanup complete"
echo ""

echo "==================================="
echo "Test complete!"
echo "====================================="