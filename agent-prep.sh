#!/usr/bin/env bash
# Example script for agents to request edit permission

set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"

# Determine agent ID
AGENT="${AGENT_NAME:-${AI_AGENT:-${USER:-unknown}}}"
TASK="${1:-development}"
PATHS="${2:-**}"
PRIORITY="${3:-5}"

# Create prep request
PREP_FILE="$ROOT/.ac-prep/${AGENT}.json"

cat > "$PREP_FILE" <<JSON
{
  "agent": "${AGENT}",
  "task": "${TASK}",
  "branch": "$(git branch --show-current)",
  "paths": ["${PATHS}"],
  "shards": ["default"],
  "reason": "Agent ${AGENT} working on ${TASK}",
  "priority": ${PRIORITY},
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "ttlMs": 600000
}
JSON

echo "[prep] Created prep request for ${AGENT}"
echo "[prep] Waiting for acknowledgment at .ac/ack/${AGENT}.json"

# Wait for acknowledgment (timeout after 30 seconds)
TIMEOUT=30
ELAPSED=0
while [ ! -f "$ROOT/.ac/ack/${AGENT}.json" ] && [ $ELAPSED -lt $TIMEOUT ]; do
    sleep 1
    ELAPSED=$((ELAPSED + 1))
    printf "."
done
echo

if [ -f "$ROOT/.ac/ack/${AGENT}.json" ]; then
    STATUS=$(jq -r '.status' "$ROOT/.ac/ack/${AGENT}.json")
    echo "[ack] Status: ${STATUS}"
    
    if [ "$STATUS" = "ok" ]; then
        echo "[ack] ✅ Permission granted. You may proceed with edits."
        jq -r '.acknowledgedShards[]' "$ROOT/.ac/ack/${AGENT}.json" 2>/dev/null | sed 's/^/  - /'
    elif [ "$STATUS" = "blocked" ]; then
        echo "[ack] ❌ Permission blocked. Another agent has priority."
        jq -r '.message' "$ROOT/.ac/ack/${AGENT}.json" 2>/dev/null
    elif [ "$STATUS" = "queued" ]; then
        echo "[ack] ⏳ Queued. Wait for your turn."
        echo "Position: $(jq -r '.queuePosition' "$ROOT/.ac/ack/${AGENT}.json" 2>/dev/null)"
    fi
else
    echo "[timeout] No acknowledgment received within ${TIMEOUT} seconds"
    echo "[timeout] Proceeding with caution - conflicts may occur"
fi

