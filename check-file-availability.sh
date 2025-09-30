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
