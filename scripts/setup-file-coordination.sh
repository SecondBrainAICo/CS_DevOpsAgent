#!/bin/bash

# ============================================================================
# FILE COORDINATION SYSTEM SETUP
# ============================================================================
# Creates a simple file-based coordination system where agents declare
# which files they're about to edit, preventing conflicts
# ============================================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
COORD_DIR="$ROOT/.file-coordination"
ACTIVE_EDITS="$COORD_DIR/active-edits"
COMPLETED_EDITS="$COORD_DIR/completed-edits"
BLOCKED_FILES="$COORD_DIR/blocked-files"

echo "[INFO] Setting up file coordination system at: $ROOT"

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
fi

echo "[SUCCESS] File coordination system created!"
echo ""
echo "Usage:"
echo "  1. Check availability:  ./check-file-availability.sh file1 file2"
echo "  2. Declare edits:       ./declare-file-edits.sh agent-name session-id file1 file2"
echo "  3. Release files:       ./release-file-edits.sh agent-name session-id"