#!/usr/bin/env zsh
# Script to rename AutoCommit to CS_DevOpsAgent throughout the codebase
# Date: September 28, 2025

set -uo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   Renaming AutoCommit to CS_DevOpsAgent${NC}"
echo -e "${CYAN}════════════════════════════════════════════════${NC}\n"

# Function for logging
log_info() { echo -e "${CYAN}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $*"; }

# Check if we're in the right directory
if [[ ! -f "auto-commit-worker.js" ]]; then
    log_warn "Please run this script from the AutoCommit root directory"
    exit 1
fi

log_info "Starting rename process..."

# Update file contents - case sensitive replacements
update_file_contents() {
    log_info "Updating file contents..."
    
    # Main replacements
    find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.sh" -o -name "*.yml" \) \
        -not -path "./node_modules/*" \
        -not -path "./.git/*" \
        -not -path "./rename-to-cs-devops-agent.sh" \
        -exec sed -i '' \
        -e 's/AutoCommit/CS_DevOpsAgent/g' \
        -e 's/autocommit/cs-devops-agent/g' \
        -e 's/auto-commit/cs-devops-agent/g' \
        -e 's/auto_commit/cs_devops_agent/g' \
        -e 's/AUTOCOMMIT/CS_DEVOPS_AGENT/g' \
        -e 's/ScriptAutoCommit/CS_DevOpsAgent/g' \
        -e 's/code_studio_autocommitAgent/CS_DevOpsAgent/g' \
        {} \;
    
    log_success "File contents updated"
}

# Rename files
rename_files() {
    log_info "Renaming files..."
    
    # Rename auto-commit-worker.js
    if [[ -f "auto-commit-worker.js" ]]; then
        mv "auto-commit-worker.js" "cs-devops-agent-worker.js"
        log_success "Renamed auto-commit-worker.js to cs-devops-agent-worker.js"
    fi
    
    # Rename setup-auto-commit.js
    if [[ -f "setup-auto-commit.js" ]]; then
        mv "setup-auto-commit.js" "setup-cs-devops-agent.js"
        log_success "Renamed setup-auto-commit.js to setup-cs-devops-agent.js"
    fi
    
    # Rename run-auto-commit-*.sh files
    setopt nullglob
    for file in run-auto-commit-*.sh; do
        if [[ -f "$file" ]]; then
            newname="${file/auto-commit/cs-devops-agent}"
            mv "$file" "$newname"
            log_success "Renamed $file to $newname"
        fi
    done
    unsetopt nullglob
}

# Update package.json scripts
update_package_json() {
    log_info "Updating package.json scripts..."
    
    if [[ -f "package.json" ]]; then
        # Update script names
        sed -i '' \
            -e 's/"auto-commit"/"cs-devops-agent"/g' \
            -e 's/"auto-commit:/"cs-devops-agent:/g' \
            -e 's/auto-commit-worker/cs-devops-agent-worker/g' \
            "package.json"
        
        log_success "Updated package.json scripts"
    fi
}

# Update README
update_readme() {
    log_info "Updating README..."
    
    if [[ -f "README.md" ]]; then
        # Update title and main references
        sed -i '' \
            -e '1s/.*/# CS_DevOpsAgent - Code Studio DevOps Automation 🚀/' \
            -e 's/Code Studio AutoCommit Agent/CS_DevOpsAgent - Code Studio DevOps Automation/g' \
            -e 's/AutoCommit is/CS_DevOpsAgent is/g' \
            -e 's/AutoCommit/CS_DevOpsAgent/g' \
            README.md
        
        log_success "Updated README.md"
    fi
}

# Update environment variables
update_env_vars() {
    log_info "Updating environment variable references..."
    
    # Update all AC_ prefixed variables to CS_ prefix
    find . -type f \( -name "*.js" -o -name "*.sh" \) \
        -not -path "./node_modules/*" \
        -not -path "./.git/*" \
        -exec sed -i '' \
        -e 's/AC_/CS_/g' \
        {} \;
    
    log_success "Updated environment variables"
}

# Update VS Code settings
update_vscode() {
    log_info "Updating VS Code settings..."
    
    if [[ -f ".vscode/tasks.json" ]]; then
        sed -i '' \
            -e 's/Auto-Commit/CS DevOps Agent/g' \
            -e 's/auto-commit/cs-devops-agent/g' \
            ".vscode/tasks.json"
        
        log_success "Updated VS Code tasks"
    fi
    
    if [[ -f ".vscode/settings.json" ]]; then
        sed -i '' \
            -e 's/auto-commit/cs-devops-agent/g' \
            ".vscode/settings.json"
        
        log_success "Updated VS Code settings"
    fi
}

# Update house rules
update_houserules() {
    log_info "Updating house rules..."
    
    if [[ -f "houserules.md" ]]; then
        sed -i '' \
            -e 's/AutoCommit/CS_DevOpsAgent/g' \
            -e 's/auto-commit/cs-devops-agent/g' \
            "houserules.md"
        
        log_success "Updated house rules"
    fi
}

# Main execution
main() {
    # Create backup
    log_info "Creating backup..."
    tar czf "../AutoCommit-backup-$(date +%Y%m%d-%H%M%S).tar.gz" . 2>/dev/null
    log_success "Backup created"
    
    # Run all updates
    update_file_contents
    rename_files
    update_package_json
    update_readme
    update_env_vars
    update_vscode
    update_houserules
    
    echo -e "\n${GREEN}════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}   Rename Complete!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════${NC}\n"
    
    log_success "Successfully renamed AutoCommit to CS_DevOpsAgent"
    log_info "Please review the changes and test the system"
    log_info "Remember to update:"
    log_info "  - GitHub repository name"
    log_info "  - Any external documentation"
    log_info "  - CI/CD configurations"
    log_info "  - Team documentation"
    
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "1. Review the changes: git diff"
    echo "2. Test the system: npm run cs-devops-agent"
    echo "3. Commit the changes: git add -A && git commit -m 'refactor: Rename AutoCommit to CS_DevOpsAgent'"
    echo "4. Update GitHub repo name to: CS_DevOpsAgent"
}

# Ask for confirmation
echo -e "${YELLOW}This will rename all references from AutoCommit to CS_DevOpsAgent${NC}"
echo -e "${YELLOW}A backup will be created first.${NC}"
echo -n "Continue? (y/n): "
read -r REPLY
echo ""

if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    main
else
    log_info "Rename cancelled"
fi
