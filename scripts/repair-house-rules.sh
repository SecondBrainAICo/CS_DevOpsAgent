#!/bin/bash

# House Rules Repair Script
# ==========================
# Checks and repairs house rules if they're missing or corrupted

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

echo -e "${BOLD}House Rules Health Check${NC}"
echo -e "${DIM}Checking house rules status...${NC}"
echo

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if house-rules-manager exists
if [[ ! -f "$ROOT_DIR/src/house-rules-manager.js" ]]; then
    echo -e "${RED}Error: house-rules-manager.js not found${NC}"
    echo "Please ensure you're running this from the DevOps Agent directory."
    exit 1
fi

# Get status
STATUS=$(node "$ROOT_DIR/src/house-rules-manager.js" status 2>&1 || echo '{"exists": false}')

# Check if house rules exist
EXISTS=$(echo "$STATUS" | grep -o '"exists"[[:space:]]*:[[:space:]]*true' || echo "")
NEEDS_UPDATE=$(echo "$STATUS" | grep -o '"needsUpdate"[[:space:]]*:[[:space:]]*true' || echo "")

if [[ -z "$EXISTS" ]]; then
    echo -e "${YELLOW}⚠ House rules not found!${NC}"
    echo
    echo "This could happen if:"
    echo "  • The file was accidentally deleted"
    echo "  • This is a fresh installation"
    echo "  • The file was moved to a different location"
    echo
    echo -n "Create house rules now? (Y/n): "
    read CREATE_CHOICE
    
    if [[ "${CREATE_CHOICE}" != "n" ]] && [[ "${CREATE_CHOICE}" != "N" ]]; then
        echo -e "${BLUE}Creating house rules...${NC}"
        RESULT=$(node "$ROOT_DIR/src/house-rules-manager.js" update 2>&1)
        
        if echo "$RESULT" | grep -q '"created"[[:space:]]*:[[:space:]]*true'; then
            echo -e "${GREEN}✓ House rules created successfully!${NC}"
            
            # Extract path if possible
            PATH_LINE=$(echo "$RESULT" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' || echo "")
            if [[ -n "$PATH_LINE" ]]; then
                FILE_PATH=$(echo "$PATH_LINE" | sed 's/.*"path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
                echo -e "  Location: ${BOLD}$FILE_PATH${NC}"
            fi
        else
            echo -e "${GREEN}✓ House rules restored!${NC}"
        fi
    else
        echo -e "${YELLOW}Skipped house rules creation${NC}"
        exit 0
    fi
    
elif [[ -n "$NEEDS_UPDATE" ]]; then
    echo -e "${YELLOW}House rules need updating${NC}"
    echo
    echo "Your house rules exist but some sections are outdated."
    echo -e "${DIM}Your custom rules will be preserved during the update.${NC}"
    echo
    
    # Show what needs updating
    echo "$STATUS" | node -e "
        const input = require('fs').readFileSync(0, 'utf8');
        try {
            const data = JSON.parse(input);
            if (data.managedSections) {
                const updates = [];
                const additions = [];
                for (const [name, info] of Object.entries(data.managedSections)) {
                    if (info.needsUpdate) {
                        if (info.installed) {
                            updates.push(\`  • \${name} (\${info.installedVersion} → \${info.currentVersion})\`);
                        } else {
                            additions.push(\`  • \${name} (new)\`);
                        }
                    }
                }
                if (updates.length > 0) {
                    console.log('Sections to update:');
                    updates.forEach(u => console.log(u));
                }
                if (additions.length > 0) {
                    console.log('\\nSections to add:');
                    additions.forEach(a => console.log(a));
                }
            }
        } catch (e) {
            // Silent fail
        }
    " 2>/dev/null || true
    
    echo
    echo -n "Update house rules now? (Y/n): "
    read UPDATE_CHOICE
    
    if [[ "${UPDATE_CHOICE}" != "n" ]] && [[ "${UPDATE_CHOICE}" != "N" ]]; then
        echo -e "${BLUE}Updating house rules...${NC}"
        RESULT=$(node "$ROOT_DIR/src/house-rules-manager.js" update 2>&1)
        echo -e "${GREEN}✓ House rules updated!${NC}"
    else
        echo -e "${YELLOW}Skipped house rules update${NC}"
    fi
    
else
    echo -e "${GREEN}✓ House rules are healthy!${NC}"
    echo
    
    # Show current status
    echo "$STATUS" | node -e "
        const input = require('fs').readFileSync(0, 'utf8');
        try {
            const data = JSON.parse(input);
            if (data.path) {
                console.log(\`  Location: \${data.path}\`);
            }
            if (data.managedSections) {
                console.log('  Managed sections:');
                for (const [name, info] of Object.entries(data.managedSections)) {
                    if (info.installed) {
                        console.log(\`    • \${name} (v\${info.installedVersion})\`);
                    }
                }
            }
        } catch (e) {
            // Silent fail
        }
    " 2>/dev/null || true
    
    echo
    echo -e "${DIM}All sections are up to date.${NC}"
fi

echo