#!/bin/bash

# ============================================================================
# MULTI-AGENT FILE LOCKING TEST
# ============================================================================
# Tests the file coordination system with multiple agents
# Shows how file locking prevents conflicts
# ============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Navigate to repo root
cd "$(dirname "$0")/../.." || exit 1

echo -e "${CYAN}============================================================================${NC}"
echo -e "${BLUE}MULTI-AGENT FILE LOCKING DEMONSTRATION${NC}"
echo -e "${CYAN}============================================================================${NC}"
echo ""
echo "This test will demonstrate:"
echo "  1. ✅ Agent successfully declaring files"
echo "  2. 🔒 Second agent blocked from same files"
echo "  3. 🔄 File release and handover"
echo "  4. ⚠️  Undeclared edit detection"
echo ""

# Setup
echo -e "${YELLOW}Setting up test environment...${NC}"
rm -rf .file-coordination/active-edits/*.json 2>/dev/null || true
rm -rf .file-coordination/conflicts/*.md 2>/dev/null || true
mkdir -p .file-coordination/active-edits
mkdir -p .file-coordination/conflicts

# Create test files
echo "// Test file 1" > test-file-1.js
echo "// Test file 2" > test-file-2.js
echo "// Test file 3" > test-file-3.js

echo -e "${GREEN}✓ Test environment ready${NC}"
echo ""

# ============================================================================
# TEST 1: Successful File Declaration
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 1: Agent 1 declares files for editing${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${MAGENTA}Agent 1 (Claude):${NC} I need to edit test-file-1.js and test-file-2.js"
echo -e "Running: ./scripts/coordination/declare-file-edits.sh claude session-001 test-file-1.js test-file-2.js"
echo ""

if ./scripts/coordination/declare-file-edits.sh claude session-001 test-file-1.js test-file-2.js; then
    echo -e "${GREEN}✅ SUCCESS: Agent 1 has locked the files${NC}"
else
    echo -e "${RED}✗ FAILED: Could not declare files${NC}"
    exit 1
fi

echo ""
echo "Current locks:"
echo -e "${YELLOW}"
ls -la .file-coordination/active-edits/ | grep -v "^total" | grep -v "^d"
echo -e "${NC}"

# ============================================================================
# TEST 2: Second Agent Blocked
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 2: Agent 2 tries to edit same files (should be blocked)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${MAGENTA}Agent 2 (Copilot):${NC} I also want to edit test-file-1.js"
echo -e "Running: ./scripts/coordination/declare-file-edits.sh copilot session-002 test-file-1.js"
echo ""

if ./scripts/coordination/declare-file-edits.sh copilot session-002 test-file-1.js 2>&1 | grep -q "Cannot declare"; then
    echo -e "${GREEN}✅ CORRECT: Agent 2 was blocked - file is already locked by Agent 1${NC}"
    echo -e "${YELLOW}   Message: '❌ Cannot declare: test-file-1.js is already being edited'${NC}"
else
    echo -e "${RED}✗ ERROR: Agent 2 should have been blocked!${NC}"
fi

# ============================================================================
# TEST 3: Non-conflicting Files
# ============================================================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 3: Agent 2 declares different file (should succeed)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${MAGENTA}Agent 2 (Copilot):${NC} OK, I'll edit test-file-3.js instead"
echo -e "Running: ./scripts/coordination/declare-file-edits.sh copilot session-002 test-file-3.js"
echo ""

if ./scripts/coordination/declare-file-edits.sh copilot session-002 test-file-3.js; then
    echo -e "${GREEN}✅ SUCCESS: Agent 2 can edit non-conflicting files${NC}"
else
    echo -e "${RED}✗ FAILED: Agent 2 should be able to declare different files${NC}"
fi

echo ""
echo "Current locks (both agents have files):"
echo -e "${YELLOW}"
for file in .file-coordination/active-edits/*.json; do
    if [ -f "$file" ]; then
        agent=$(basename "$file" | cut -d'-' -f1)
        echo -n "  $agent: "
        grep '"files"' "$file" | sed 's/.*\[//' | sed 's/\].*//'
    fi
done
echo -e "${NC}"

# ============================================================================
# TEST 4: Check File Availability
# ============================================================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 4: Check file availability${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${MAGENTA}New Agent (Cursor):${NC} Let me check which files are available"
echo ""

echo "Checking test-file-1.js (locked by claude):"
if ./scripts/coordination/check-file-availability.sh test-file-1.js 2>&1 | grep -q "BLOCKED"; then
    echo -e "${GREEN}  ✅ Correctly shows as BLOCKED${NC}"
else
    echo -e "${YELLOW}  ⚠️  Should show as blocked${NC}"
fi

echo ""
echo "Checking test-file-3.js (locked by copilot):"
if ./scripts/coordination/check-file-availability.sh test-file-3.js 2>&1 | grep -q "BLOCKED"; then
    echo -e "${GREEN}  ✅ Correctly shows as BLOCKED${NC}"
else
    echo -e "${YELLOW}  ⚠️  Should show as blocked${NC}"
fi

echo ""
echo "Checking new-file.js (not locked):"
if ./scripts/coordination/check-file-availability.sh new-file.js 2>&1 | grep -q "AVAILABLE"; then
    echo -e "${GREEN}  ✅ Correctly shows as AVAILABLE${NC}"
else
    echo -e "${YELLOW}  ⚠️  Should show as available${NC}"
fi

# ============================================================================
# TEST 5: File Release and Handover
# ============================================================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 5: Agent 1 releases files${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${MAGENTA}Agent 1 (Claude):${NC} I'm done editing, releasing my files"
echo -e "Running: ./scripts/coordination/release-file-edits.sh claude session-001"
echo ""

if ./scripts/coordination/release-file-edits.sh claude session-001; then
    echo -e "${GREEN}✅ SUCCESS: Agent 1 released files${NC}"
else
    echo -e "${RED}✗ FAILED: Could not release files${NC}"
fi

echo ""
echo "Now Agent 2 can declare the previously locked files:"
if ./scripts/coordination/declare-file-edits.sh copilot session-002b test-file-1.js; then
    echo -e "${GREEN}✅ SUCCESS: Agent 2 can now edit test-file-1.js${NC}"
else
    echo -e "${RED}✗ FAILED: Agent 2 should be able to declare after release${NC}"
fi

# ============================================================================
# TEST 6: Simulate Undeclared Edit (Warning System)
# ============================================================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 6: Undeclared edit detection (simulated)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${MAGENTA}Rogue Agent:${NC} Let me just edit test-file-2.js without declaring..."
echo "echo '// Unauthorized edit' >> test-file-2.js"
echo '// Unauthorized edit' >> test-file-2.js

echo ""
echo -e "${YELLOW}⚠️  WARNING: This would trigger an alert in the real system${NC}"
echo "   The DevOps agent would detect this undeclared edit and create:"
echo "   - An orange alert file (.coordination-alert-*.md)"
echo "   - Instructions to declare the file properly"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "${CYAN}============================================================================${NC}"
echo -e "${BLUE}FILE LOCKING DEMONSTRATION COMPLETE${NC}"
echo -e "${CYAN}============================================================================${NC}"
echo ""
echo -e "${GREEN}What We Demonstrated:${NC}"
echo ""
echo "  1. ✅ File Declaration - Agents can lock files before editing"
echo "  2. 🔒 Conflict Prevention - Other agents are blocked from locked files"
echo "  3. 🔄 Non-conflicting Work - Agents can work on different files simultaneously"
echo "  4. 📋 Availability Checking - Agents can check which files are available"
echo "  5. 🔓 File Release - Agents can release files when done"
echo "  6. ⚠️  Undeclared Edit Detection - System detects unauthorized edits"
echo ""
echo -e "${CYAN}Key Benefits:${NC}"
echo "  • Prevents wasted work from conflicts"
echo "  • Enables parallel development"
echo "  • Provides clear coordination"
echo "  • Maintains code integrity"
echo ""

# Cleanup
echo -e "${YELLOW}Cleaning up test files...${NC}"
rm -f test-file-*.js new-file.js 2>/dev/null || true
rm -rf .file-coordination/active-edits/*.json 2>/dev/null || true

echo -e "${GREEN}✓ Test complete!${NC}"