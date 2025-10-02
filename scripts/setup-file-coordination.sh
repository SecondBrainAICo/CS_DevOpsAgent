#!/bin/bash

# ============================================================================
# FILE COORDINATION SYSTEM SETUP
# ============================================================================
# Creates a simple file-based coordination system where agents declare
# which files they're about to edit, preventing conflicts
# ============================================================================

set -euo pipefail

# Check if we're in a submodule and use the parent repository if so
SUPERPROJECT="$(git rev-parse --show-superproject-working-tree 2>/dev/null || echo "")"
if [ -n "$SUPERPROJECT" ]; then
    ROOT="$SUPERPROJECT"
else
    ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

COORD_DIR="$ROOT/.file-coordination"
ACTIVE_EDITS="$COORD_DIR/active-edits"
COMPLETED_EDITS="$COORD_DIR/completed-edits"
BLOCKED_FILES="$COORD_DIR/blocked-files"

echo "[INFO] Setting up file coordination system at: $ROOT"

# Check for existing house rules
HOUSERULES_PATH=""
HOUSERULES_FOUND=false

if [ -f "$ROOT/houserules.md" ]; then
    HOUSERULES_PATH="$ROOT/houserules.md"
    HOUSERULES_FOUND=true
    echo "[INFO] Found existing house rules at: houserules.md"
elif [ -f "$ROOT/HOUSERULES.md" ]; then
    HOUSERULES_PATH="$ROOT/HOUSERULES.md"
    HOUSERULES_FOUND=true
    echo "[INFO] Found existing house rules at: HOUSERULES.md"
elif [ -f "$ROOT/.github/HOUSERULES.md" ]; then
    HOUSERULES_PATH="$ROOT/.github/HOUSERULES.md"
    HOUSERULES_FOUND=true
    echo "[INFO] Found existing house rules at: .github/HOUSERULES.md"
elif [ -f "$ROOT/docs/houserules.md" ]; then
    HOUSERULES_PATH="$ROOT/docs/houserules.md"
    HOUSERULES_FOUND=true
    echo "[INFO] Found existing house rules at: docs/houserules.md"
else
    echo ""
    echo "[PROMPT] No house rules found for AI agents."
    echo "         House rules help AI agents understand your project conventions."
    echo ""
    echo "         Options:"
    echo "         1) Create new house rules at houserules.md (recommended)"
    echo "         2) Specify path to existing house rules"
    echo "         3) Skip (not recommended)"
    echo ""
    echo "         Enter choice (1/2/3): "
    read -r CHOICE
    
    case "$CHOICE" in
        1|"")
            HOUSERULES_PATH="$ROOT/houserules.md"
            HOUSERULES_FOUND=false
            echo "[INFO] Will create comprehensive house rules at: houserules.md"
            ;;
        2)
            echo "[PROMPT] Please enter the path to your house rules file (relative to $ROOT):"
            read -r CUSTOM_PATH
            if [ -f "$ROOT/$CUSTOM_PATH" ]; then
                HOUSERULES_PATH="$ROOT/$CUSTOM_PATH"
                HOUSERULES_FOUND=true
                echo "[INFO] Using house rules at: $CUSTOM_PATH"
            else
                echo "[WARNING] File not found. Will create house rules at: houserules.md"
                HOUSERULES_PATH="$ROOT/houserules.md"
                HOUSERULES_FOUND=false
            fi
            ;;
        3)
            echo "[WARNING] Skipping house rules setup. This is not recommended!"
            echo "[WARNING] AI agents may not follow project conventions without house rules."
            HOUSERULES_PATH="$ROOT/houserules.md"
            HOUSERULES_FOUND=false
            ;;
        *)
            HOUSERULES_PATH="$ROOT/houserules.md"
            HOUSERULES_FOUND=false
            echo "[INFO] Invalid choice. Will create house rules at: houserules.md"
            ;;
    esac
fi

# Create coordination directories
mkdir -p "$ACTIVE_EDITS"
mkdir -p "$COMPLETED_EDITS"
mkdir -p "$BLOCKED_FILES"

# Create the declaration template
cat > "$COORD_DIR/DECLARE_TEMPLATE.json" << 'EOF'
{
  "agent": "agent-name",
  "session": "session-id",
  "files": [
    "path/to/file1.js",
    "path/to/file2.js"
  ],
  "operation": "edit|create|delete",
  "reason": "Brief description of changes",
  "declaredAt": "ISO-8601",
  "estimatedDuration": 300
}
EOF

# Create the check script for agents
cat > "$ROOT/check-file-availability.sh" << 'SCRIPT'
#!/bin/bash
# Check if files are available for editing

FILES_TO_CHECK="$@"
COORD_DIR=".file-coordination/active-edits"
BLOCKED_FILES=""

for file in $FILES_TO_CHECK; do
    # Check if file is being edited
    if grep -l "\"$file\"" "$COORD_DIR"/*.json 2>/dev/null | head -1; then
        BLOCKED_BY=$(grep -l "\"$file\"" "$COORD_DIR"/*.json | xargs basename | cut -d. -f1)
        echo "❌ BLOCKED: $file (being edited by $BLOCKED_BY)"
        BLOCKED_FILES="$BLOCKED_FILES $file"
    else
        echo "✅ AVAILABLE: $file"
    fi
done

if [ -n "$BLOCKED_FILES" ]; then
    exit 1
else
    exit 0
fi
SCRIPT
chmod +x "$ROOT/check-file-availability.sh"

# Create the declaration script
cat > "$ROOT/declare-file-edits.sh" << 'SCRIPT'
#!/bin/bash
# Declare files that will be edited

AGENT="${1:-unknown}"
SESSION="${2:-$(date +%s)}"
shift 2
FILES="$@"

COORD_DIR=".file-coordination"
DECLARATION_FILE="$COORD_DIR/active-edits/${AGENT}-${SESSION}.json"

# Check if any files are already being edited
for file in $FILES; do
    if grep -l "\"$file\"" "$COORD_DIR/active-edits"/*.json 2>/dev/null | grep -v "$DECLARATION_FILE" | head -1; then
        echo "❌ Cannot declare: $file is already being edited"
        exit 1
    fi
done

# Create declaration
cat > "$DECLARATION_FILE" << EOF
{
  "agent": "$AGENT",
  "session": "$SESSION",
  "files": [$(echo $FILES | sed 's/ /", "/g' | sed 's/^/"/;s/$/"/')]
  "operation": "edit",
  "declaredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "estimatedDuration": 300
}
EOF

echo "✅ Declared edits for: $FILES"
echo "Declaration saved to: $DECLARATION_FILE"
SCRIPT
chmod +x "$ROOT/declare-file-edits.sh"

# Create the release script
cat > "$ROOT/release-file-edits.sh" << 'SCRIPT'
#!/bin/bash
# Release files after editing

AGENT="${1:-unknown}"
SESSION="${2:-*}"

COORD_DIR=".file-coordination"
DECLARATION_FILE="$COORD_DIR/active-edits/${AGENT}-${SESSION}.json"

if ls $DECLARATION_FILE 1> /dev/null 2>&1; then
    mv $DECLARATION_FILE "$COORD_DIR/completed-edits/" 2>/dev/null || true
    echo "✅ Released files for $AGENT-$SESSION"
else
    echo "⚠️  No active declaration found for $AGENT-$SESSION"
fi
SCRIPT
chmod +x "$ROOT/release-file-edits.sh"

# Add to .gitignore
if ! grep -q "^.file-coordination" "$ROOT/.gitignore" 2>/dev/null; then
    echo ".file-coordination" >> "$ROOT/.gitignore"
    echo "[INFO] Added .file-coordination to .gitignore"
fi

# Add or update house rules with file coordination protocol
update_houserules() {
    local houserules_file="$1"
    local is_new_file="$2"
    
    # Check if coordination rules already exist
    if grep -q "File Coordination Protocol" "$houserules_file" 2>/dev/null; then
        echo "[INFO] File coordination rules already present in house rules"
        return
    fi
    
    echo "[INFO] Setting up house rules with file coordination protocol"
    
    # Create backup if file exists
    if [ -f "$houserules_file" ] && [ -s "$houserules_file" ]; then
        cp "$houserules_file" "${houserules_file}.backup.$(date +%Y%m%d_%H%M%S)"
        echo "[INFO] Created backup of existing house rules"
    fi
    
    # If creating new file, add comprehensive template
    if [ "$is_new_file" = "true" ] || [ ! -f "$houserules_file" ] || [ ! -s "$houserules_file" ]; then
        cat > "$houserules_file" << 'FULL_TEMPLATE'
# House Rules for AI Agents

**IMPORTANT: All AI agents (Claude, Cline, Copilot, etc.) must read and follow these rules at the start of each session.**

## Core Principles

1. **Always preserve existing functionality** - Never break working code
2. **Follow existing patterns** - Match the codebase style and conventions
3. **Communicate clearly** - Document your changes and reasoning
4. **Coordinate with others** - Follow the file coordination protocol below

## Project Conventions

### Code Style
- Follow existing indentation and formatting patterns
- Maintain consistent naming conventions used in the project
- Keep functions small and focused
- Write clear, descriptive variable and function names

### Git Workflow
- Write clear, descriptive commit messages
- Follow conventional commit format when applicable (feat:, fix:, docs:, etc.)
- Keep commits atomic and focused on a single change
- Never commit sensitive information or credentials

### Testing
- Write tests for new functionality
- Ensure existing tests pass before committing
- Update tests when changing functionality

### Documentation
- Update README files when adding new features
- Document complex logic with clear comments
- Keep API documentation up to date
- Update CHANGELOG for significant changes

FULL_TEMPLATE
    fi
    
    # Create temporary file with coordination rules at the top (after any main header)
    TEMP_FILE=$(mktemp)
    
    # Check if file has a main header (starts with #)
    if head -n1 "$houserules_file" | grep -q '^#'; then
        # Keep the main header
        head -n1 "$houserules_file" > "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        # Add coordination rules
        cat >> "$TEMP_FILE" << 'COORDINATION_RULES'
## 🚨 CRITICAL: File Coordination Protocol (MUST FOLLOW)

**IMPORTANT: Always check the house rules at the beginning of each session!**

To prevent conflicts with other agents editing the same files, you MUST follow this protocol:

### Before Editing ANY Files:

1. **DECLARE YOUR INTENT FIRST**
   Create a file at `.file-coordination/active-edits/<your-name>-<session>.json` with:
   ```json
   {
     "agent": "<your-name>",
     "session": "<session-id>",
     "files": ["list", "of", "files", "you", "will", "edit"],
     "operation": "edit",
     "reason": "Brief description of what you're doing",
     "declaredAt": "<current-ISO-8601-timestamp>",
     "estimatedDuration": 300
   }
   ```

2. **CHECK FOR CONFLICTS**
   - Read ALL files in `.file-coordination/active-edits/`
   - If ANY other agent has declared the same files, you must:
     - WAIT for them to finish, OR
     - Choose different files to edit

3. **ONLY EDIT DECLARED FILES**
   - Never edit files you haven't declared
   - Stay within your declared scope

4. **RELEASE WHEN DONE**
   - Delete your declaration file after completing edits
   - Or move it to `.file-coordination/completed-edits/`

### If You Detect a Conflict:
- DO NOT proceed with edits
- Report the conflict to the user
- Wait or choose alternative files

### Helper Scripts Available:
- `./scripts/coordination/check-file-availability.sh <files>` - Check if files are available
- `./scripts/coordination/declare-file-edits.sh <agent> <session> <files>` - Declare your intent
- `./scripts/coordination/release-file-edits.sh <agent> <session>` - Release files after editing

**This coordination prevents wasted work and merge conflicts!**

---

COORDINATION_RULES
        
        # Add the rest of the original content (skipping the first line)
        tail -n +2 "$houserules_file" >> "$TEMP_FILE"
    else
        # No header, add coordination rules at the top
        cat >> "$TEMP_FILE" << 'COORDINATION_RULES'
## 🚨 CRITICAL: File Coordination Protocol (MUST FOLLOW)

**IMPORTANT: Always check the house rules at the beginning of each session!**

To prevent conflicts with other agents editing the same files, you MUST follow this protocol:

### Before Editing ANY Files:

1. **DECLARE YOUR INTENT FIRST**
   Create a file at `.file-coordination/active-edits/<your-name>-<session>.json` with:
   ```json
   {
     "agent": "<your-name>",
     "session": "<session-id>",
     "files": ["list", "of", "files", "you", "will", "edit"],
     "operation": "edit",
     "reason": "Brief description of what you're doing",
     "declaredAt": "<current-ISO-8601-timestamp>",
     "estimatedDuration": 300
   }
   ```

2. **CHECK FOR CONFLICTS**
   - Read ALL files in `.file-coordination/active-edits/`
   - If ANY other agent has declared the same files, you must:
     - WAIT for them to finish, OR
     - Choose different files to edit

3. **ONLY EDIT DECLARED FILES**
   - Never edit files you haven't declared
   - Stay within your declared scope

4. **RELEASE WHEN DONE**
   - Delete your declaration file after completing edits
   - Or move it to `.file-coordination/completed-edits/`

### If You Detect a Conflict:
- DO NOT proceed with edits
- Report the conflict to the user
- Wait or choose alternative files

### Helper Scripts Available:
- `./scripts/coordination/check-file-availability.sh <files>` - Check if files are available
- `./scripts/coordination/declare-file-edits.sh <agent> <session> <files>` - Declare your intent
- `./scripts/coordination/release-file-edits.sh <agent> <session>` - Release files after editing

**This coordination prevents wasted work and merge conflicts!**

---

COORDINATION_RULES
        
        # Add original content
        cat "$houserules_file" >> "$TEMP_FILE"
    fi
    
    # Replace original file
    mv "$TEMP_FILE" "$houserules_file"
    echo "[SUCCESS] Updated house rules with file coordination protocol"
}

# Update the house rules file
# Pass whether this is a new file (HOUSERULES_FOUND is false for new files)
if [ "$HOUSERULES_FOUND" = "false" ]; then
    update_houserules "$HOUSERULES_PATH" "true"
else
    update_houserules "$HOUSERULES_PATH" "false"
fi

echo "[SUCCESS] File coordination system created!"
echo ""
echo "Usage:"
echo "  1. Check availability:  ./scripts/coordination/check-file-availability.sh file1 file2"
echo "  2. Declare edits:       ./scripts/coordination/declare-file-edits.sh agent-name session-id file1 file2"
echo "  3. Release files:       ./scripts/coordination/release-file-edits.sh agent-name session-id"
