#!/bin/bash
# Declare files that will be edited

AGENT="${1:-unknown}"
SESSION="${2:-$(date +%s)}"
shift 2
FILES="$@"

COORD_DIR=".file-coordination"
DECLARATION_FILE="$COORD_DIR/active-edits/${AGENT}-${SESSION}.json"

# Ensure directory exists
mkdir -p "$COORD_DIR/active-edits"

# Check if any files are already being edited
for file in $FILES; do
    # Check each existing JSON file
    for json_file in "$COORD_DIR/active-edits"/*.json; do
        # Skip if no files exist (glob didn't expand)
        [ -f "$json_file" ] || continue
        # Skip our own declaration file
        [ "$json_file" = "$DECLARATION_FILE" ] && continue
        # Check if this file is already declared
        if grep -q "\"$file\"" "$json_file" 2>/dev/null; then
            agent_name=$(basename "$json_file" | cut -d'-' -f1)
            echo "❌ Cannot declare: $file is already being edited by $agent_name"
            exit 1
        fi
    done
done

# Create declaration
cat > "$DECLARATION_FILE" << EOF
{
  "agent": "$AGENT",
  "session": "$SESSION",
  "files": [$(echo $FILES | sed 's/ /", "/g' | sed 's/^/"/;s/$/"/')],
  "operation": "edit",
  "declaredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "estimatedDuration": 300
}
EOF

echo "✅ Declared edits for: $FILES"
echo "Declaration saved to: $DECLARATION_FILE"
