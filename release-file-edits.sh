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
