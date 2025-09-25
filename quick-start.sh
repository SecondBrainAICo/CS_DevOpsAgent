#!/bin/bash

# ScriptAutoCommit Quick Start
# This script provides a one-command setup for the auto-commit system

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Header
clear
print_color "$BLUE" "============================================"
print_color "$BLUE" "     ScriptAutoCommit Quick Start Setup"
print_color "$BLUE" "============================================"
echo

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_color "$RED" "❌ Error: Not in a git repository!"
    print_color "$YELLOW" "Please run this script from your project root (where .git folder exists)"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "0")
if [[ "$NODE_VERSION" == "0" ]]; then
    print_color "$RED" "❌ Error: Node.js is not installed!"
    print_color "$YELLOW" "Please install Node.js v16+ from https://nodejs.org/"
    exit 1
fi

# Extract major version number
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt 16 ]; then
    print_color "$RED" "❌ Error: Node.js version is too old!"
    print_color "$YELLOW" "Current version: $NODE_VERSION"
    print_color "$YELLOW" "Required: v16.0.0 or higher"
    exit 1
fi

print_color "$GREEN" "✓ Node.js $NODE_VERSION detected"
print_color "$GREEN" "✓ Git repository detected"
echo

# Check if ScriptAutoCommit is in the right place
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CURRENT_DIR="$(pwd)"

if [[ "$SCRIPT_DIR" != "$CURRENT_DIR/ScriptAutoCommit" ]]; then
    print_color "$YELLOW" "⚠️  ScriptAutoCommit folder not in project root"
    print_color "$YELLOW" "Moving ScriptAutoCommit to current directory..."
    
    if [ -d "ScriptAutoCommit" ]; then
        print_color "$RED" "ScriptAutoCommit folder already exists in current directory!"
        read -p "Overwrite? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        rm -rf ScriptAutoCommit
    fi
    
    cp -r "$SCRIPT_DIR" ./ScriptAutoCommit
    cd ScriptAutoCommit
    SCRIPT_DIR="$CURRENT_DIR/ScriptAutoCommit"
    print_color "$GREEN" "✓ ScriptAutoCommit copied to project root"
fi

# Check if already configured
if [ -f "../.claude-commit-msg" ] && [ -f "../package.json" ]; then
    if grep -q "auto-commit" ../package.json 2>/dev/null; then
        print_color "$YELLOW" "⚠️  Auto-commit appears to be already configured"
        read -p "Run setup anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_color "$BLUE" "Skipping setup..."
            echo
            print_color "$GREEN" "You can start the auto-commit worker with:"
            print_color "$GREEN" "  npm run auto-commit"
            exit 0
        fi
    fi
fi

# Run the setup
print_color "$BLUE" "Starting interactive setup..."
echo
cd "$CURRENT_DIR"
node ScriptAutoCommit/setup-auto-commit.js

# Success message
echo
print_color "$GREEN" "============================================"
print_color "$GREEN" "     Setup Complete! 🎉"
print_color "$GREEN" "============================================"
echo
print_color "$BLUE" "Next steps:"
echo "1. Start the auto-commit worker:"
print_color "$GREEN" "   npm run auto-commit"
echo
echo "2. Make your code changes"
echo
echo "3. Create a commit message:"
print_color "$GREEN" "   echo \"feat(module): description\" > .claude-commit-msg"
echo
print_color "$BLUE" "For more information, see ScriptAutoCommit/README.md"
echo