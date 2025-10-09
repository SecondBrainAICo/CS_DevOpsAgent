#!/usr/bin/env zsh

# ============================================================================
# INTERACTIVE DEVOPS SESSION STARTER
# ============================================================================
# 
# This script provides a user-friendly way to start DevOps agent sessions.
# It handles the complete workflow:
# 1. Ask if using existing session or creating new
# 2. If new, creates session and generates instructions for Claude
# 3. Starts the DevOps agent monitoring the appropriate worktree
#
# ============================================================================

# Colors for output (using printf for better compatibility)
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;36m'
MAGENTA=$'\033[0;35m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
NC=$'\033[0m' # No Color
BG_BLUE=$'\033[44m'
BG_GREEN=$'\033[42m'
BG_YELLOW=$'\033[43m'

# Get the directory where this script is located (compatible with both bash and zsh)
if [[ -n "${BASH_SOURCE[0]}" ]]; then
    # Running in bash
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
else
    # Running in zsh
    SCRIPT_DIR="${0:A:h}"
fi
SRC_DIR="$SCRIPT_DIR/src"

# Function to display copyright
show_copyright() {
    echo
    echo "======================================================================"
    echo
    echo "  CS_DevOpsAgent - Intelligent Git Automation System"
    echo "  Version 1.6.0 | Build 20251009.12"
    echo "  "
    echo "  Copyright (c) 2024 SecondBrain Labs"
    echo "  Author: Sachin Dev Duggal"
    echo "  "
    echo "  Licensed under the MIT License"
    echo "  This software is provided 'as-is' without any warranty."
    echo "  See LICENSE file for full license text."
    echo "======================================================================"
    echo
}

# Function to display header
show_header() {
    echo
    echo -e "${BG_BLUE}${BOLD}                                                              ${NC}"
    echo -e "${BG_BLUE}${BOLD}           DevOps Agent Session Manager                      ${NC}"
    echo -e "${BG_BLUE}${BOLD}                                                              ${NC}"
    echo
}

# NOTE: display_instructions function removed - session coordinator handles this now
# to prevent duplicate copy-paste instructions

# Function to list existing sessions
list_sessions() {
    local sessions_dir="local_deploy/session-locks"
    
    if [[ ! -d "$sessions_dir" ]] || [[ -z "$(ls -A $sessions_dir 2>/dev/null)" ]]; then
        echo -e "${YELLOW}No existing sessions found.${NC}"
        return 1
    fi
    
    echo -e "${BOLD}Existing Sessions:${NC}"
    echo
    
    local i=1
    local session_files=()
    
    for lock_file in "$sessions_dir"/*.lock; do
        [[ ! -f "$lock_file" ]] && continue
        
        local session_data=$(cat "$lock_file")
        local session_id=$(echo "$session_data" | grep -o '"sessionId"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        local task=$(echo "$session_data" | grep -o '"task"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        local status=$(echo "$session_data" | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        local created=$(echo "$session_data" | grep -o '"created"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        
        # Color code based on status
        local status_color="${GREEN}"
        [[ "$status" == "stopped" ]] && status_color="${YELLOW}"
        [[ "$status" == "inactive" ]] && status_color="${RED}"
        
        echo -e "  ${BOLD}$i)${NC} Session: ${BLUE}${session_id}${NC}"
        echo -e "     Task: ${task}"
        echo -e "     Status: ${status_color}${status}${NC}"
        echo -e "     Created: ${created}"
        echo
        
        session_files+=("$lock_file")
        ((i++))
    done
    
    return 0
}

# Function to create a new session
create_new_session() {
    echo -e "${BOLD}Creating New Session${NC}"
    echo
    
    # Ask for task name
    echo -n "Enter task/feature name (e.g., 'authentication', 'api-endpoints'): "
    read task_name
    
    if [[ -z "$task_name" ]]; then
        task_name="development"
    fi
    
    # Ask for agent type
    echo -n "Agent type (claude/cline/copilot/cursor) [default: claude]: "
    read agent_type
    
    if [[ -z "$agent_type" ]]; then
        agent_type="claude"
    fi
    
    echo
    echo -e "${YELLOW}Creating session for: ${task_name}${NC}"
    
    # Run the session coordinator to create AND START the session
    # Keep current directory to ensure session is created for the right repo
    node "$SRC_DIR/session-coordinator.js" create-and-start --task "$task_name" --agent "$agent_type"
}

# Function to prompt for session selection
select_session() {
    echo -e "${BOLD}Select an Option:${NC}"
    echo
    echo "  ${BOLD}N)${NC} Create a ${GREEN}new${NC} session"
    
    # List existing sessions
    local sessions_dir="local_deploy/session-locks"
    local session_files=()
    
    if [[ -d "$sessions_dir" ]] && [[ -n "$(ls -A $sessions_dir 2>/dev/null)" ]]; then
        echo
        echo -e "${BOLD}Or select an existing session:${NC}"
        echo
        
        local i=1
        for lock_file in "$sessions_dir"/*.lock; do
            [[ ! -f "$lock_file" ]] && continue
            
            local session_data=$(cat "$lock_file")
            local session_id=$(echo "$session_data" | grep -o '"sessionId"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
            local task=$(echo "$session_data" | grep -o '"task"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
            
            echo -e "  ${BOLD}$i)${NC} ${BLUE}${session_id}${NC} - ${task}"
            session_files+=("$lock_file")
            ((i++))
        done
    fi
    
    echo
    echo -e "  ${BOLD}Q)${NC} ${RED}Quit${NC} - Exit the session manager"
    echo
    echo -n "Your choice: "
    read choice
    
    # Handle the choice
    if [[ "$choice" =~ ^[Qq]$ ]]; then
        # Quit the session manager
        echo
        echo -e "${GREEN}Goodbye! Exiting DevOps Session Manager.${NC}"
        exit 0
    elif [[ "$choice" =~ ^[Nn]$ ]]; then
        # Create new session
        create_new_session
        return 0
    elif [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le "${#session_files[@]}" ]]; then
        # Use existing session
        # Debug: Show what we're trying to access
        echo -e "${DIM}[Debug] Choice: $choice, Array size: ${#session_files[@]}${NC}"
        echo -e "${DIM}[Debug] Array contents: ${session_files[@]}${NC}"
        
        # In zsh, arrays are 1-indexed, so $choice maps directly
        local selected_file="${session_files[$choice]}"
        
        echo -e "${DIM}[Debug] Selected file: $selected_file${NC}"
        
        # Validate that the file exists
        if [[ ! -f "$selected_file" ]]; then
            echo -e "${RED}Error: Session file not found: $selected_file${NC}"
            echo -e "${YELLOW}All files in array:${NC}"
            for idx in "${!session_files[@]}"; do
                echo -e "  [$idx] = ${session_files[$idx]}"
            done
            return 1
        fi
        
        local session_data=$(cat "$selected_file")
        
        # Validate session data was read
        if [[ -z "$session_data" ]]; then
            echo -e "${RED}Error: Could not read session data from: $selected_file${NC}"
            return 1
        fi
        
        local session_id=$(echo "$session_data" | grep -o '"sessionId"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        local worktree_path=$(echo "$session_data" | grep -o '"worktreePath"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        local task=$(echo "$session_data" | grep -o '"task"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        local branch_name=$(echo "$session_data" | grep -o '"branchName"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        
        # Validate we got a session ID
        if [[ -z "$session_id" ]]; then
            echo -e "${RED}Error: Could not extract session ID from file: $selected_file${NC}"
            echo -e "${YELLOW}File contents:${NC}"
            cat "$selected_file"
            return 1
        fi
        
        echo
        echo -e "${GREEN}Using existing session: ${session_id}${NC}"
        
        # Instructions will be displayed by the session coordinator
        # No need to display them here to avoid duplication
        
        echo
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}Starting DevOps Agent${NC}"
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
        
        # Start the agent for this session
        # Keep current directory to ensure agent runs in the right repo
        node "$SRC_DIR/session-coordinator.js" start "$session_id"
        return 0
    else
        echo -e "${RED}Invalid choice. Please try again.${NC}"
        return 1
    fi
}

# Function to setup house rules and file coordination
setup_house_rules() {
    local ROOT="$1"
    local COORD_DIR="$ROOT/.file-coordination"
    
    # Check if we need to update existing house rules (even if coordination is set up)
    if [[ -f "$SCRIPT_DIR/src/house-rules-manager.js" ]]; then
        # Check status of house rules
        local STATUS=$(node "$SCRIPT_DIR/src/house-rules-manager.js" status 2>/dev/null || echo '{"needsUpdate": false, "exists": true}')
        local NEEDS_UPDATE=$(echo "$STATUS" | grep -o '"needsUpdate"[[:space:]]*:[[:space:]]*true' || echo "")
        local EXISTS=$(echo "$STATUS" | grep -o '"exists"[[:space:]]*:[[:space:]]*true' || echo "")
        
        # Check if house rules were deleted (coordination exists but house rules don't)
        if [[ -d "$COORD_DIR" ]] && [[ -z "$EXISTS" ]]; then
            echo -e "${YELLOW}⚠ House rules file appears to be missing!${NC}"
            echo "The file coordination system is set up, but house rules are gone."
            echo
            echo -n "Recreate house rules? (Y/n): "
            read RECREATE
            if [[ "${RECREATE}" != "n" ]] && [[ "${RECREATE}" != "N" ]]; then
                echo -e "${BLUE}Recreating house rules...${NC}"
                node "$SCRIPT_DIR/src/house-rules-manager.js" update 2>/dev/null
                echo -e "${GREEN}✓ House rules recreated!${NC}"
                echo
            fi
        elif [[ -n "$NEEDS_UPDATE" ]]; then
            echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${BOLD}House Rules Update Available${NC}"
            echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo
            echo "The DevOps Agent has updated house rules sections."
            echo "Your custom rules will be preserved."
            echo
            echo -n "Update house rules now? (Y/n): "
            read UPDATE_CHOICE
            
            if [[ "${UPDATE_CHOICE}" != "n" ]] && [[ "${UPDATE_CHOICE}" != "N" ]]; then
                echo -e "${BLUE}Updating house rules...${NC}"
                node "$SCRIPT_DIR/src/house-rules-manager.js" update
                echo -e "${GREEN}✓ House rules updated!${NC}"
                echo
            fi
        fi
    fi
    
    # Check if coordination system is already set up
    if [[ -d "$COORD_DIR" ]] && [[ -f "$ROOT/check-file-availability.sh" ]]; then
        return 0  # Already set up
    fi
    
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}First-time Setup: House Rules & File Coordination${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo
    echo "House rules help AI agents understand your project conventions and"
    echo "prevent conflicts when multiple agents work on the same codebase."
    echo
    
    # NOTE: House rules creation is now handled by session-coordinator's ensureHouseRulesSetup()
    # This provides the interactive prompt for structured vs flexible organization
    # We only need to ensure file coordination directory exists here
    
    # Create file coordination directory if it doesn't exist
    mkdir -p "$COORD_DIR/active-edits" "$COORD_DIR/completed-edits" "$COORD_DIR/conflicts"
    
    # House rules will be created by session-coordinator when needed
    # with the proper structured/flexible prompt
}

# Main function
main() {
    # Show copyright first
    show_copyright
    
    # Then show the header
    show_header
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}Error: Not in a git repository${NC}"
        echo "Please run this from within a git repository."
        exit 1
    fi
    
    # Get repo root
    REPO_ROOT=$(git rev-parse --show-toplevel)
    cd "$REPO_ROOT"
    
    # Check and setup house rules on first run
    setup_house_rules "$REPO_ROOT"
    
    echo -e "${BOLD}Welcome to DevOps Agent Session Manager${NC}"
    echo
    echo "This tool will:"
    echo "  1. Help you create or select a session"
    echo "  2. Generate instructions for your coding agent"
    echo "  3. Start the DevOps agent to monitor changes"
    echo
    
    # Main selection loop
    while true; do
        if select_session; then
            # After agent exits, ask if they want to continue or exit
            echo
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
            echo -e "${BOLD}Agent has stopped.${NC}"
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
            echo
            echo -e "Would you like to:"
            echo -e "  ${BOLD}1)${NC} Select another session"
            echo -e "  ${BOLD}2)${NC} Exit the session manager"
            echo
            echo -n "Your choice [1/2]: "
            read continue_choice
            
            if [[ "$continue_choice" == "2" ]]; then
                echo
                echo -e "${GREEN}Goodbye! Thank you for using DevOps Session Manager.${NC}"
                exit 0
            fi
            echo
            echo -e "${BLUE}Returning to session selection...${NC}"
            echo
        fi
    done
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Session terminated by user${NC}"; exit 0' INT

# Run main function
main "$@"