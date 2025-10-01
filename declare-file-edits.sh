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
