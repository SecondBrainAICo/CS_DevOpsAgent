#!/usr/bin/env bash
# ============================================================================
# Multi-Agent Prep TODO Handshake Setup
# Purpose: Prevent agents from stepping on each other with edit plan coordination
# ============================================================================

set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
HOUSE_LOCAL="$ROOT/houserules.md"  # Updated from CLAUDE.md
TASKS="$ROOT/.vscode/tasks.json"
SHARDS="$ROOT/.ac-shards.json"

echo "[info] repo root: $ROOT"
echo "[info] house rules: $HOUSE_LOCAL"

# ============================================================================
# 1) Create folders for prep/ack/alert/claim/reservation system
# ============================================================================
echo "[step] Creating coordination directories..."
mkdir -p "$ROOT/.ac-prep" \
         "$ROOT/.ac/ack" \
         "$ROOT/.git/.ac/alerts" \
         "$ROOT/.git/.ac/claims" \
         "$ROOT/.git/.ac/reservations"

# ============================================================================
# 2) Ensure commit message file exists and is ignored
# ============================================================================
echo "[step] Setting up commit message file..."
touch "$ROOT/.claude-commit-msg"
if ! grep -qxF '.claude-commit-msg' "$ROOT/.gitignore" 2>/dev/null; then
    echo '.claude-commit-msg' >> "$ROOT/.gitignore"
    echo "[ok] Added .claude-commit-msg to .gitignore"
else
    echo "[skip] .claude-commit-msg already in .gitignore"
fi

# Also ignore prep coordination directories
for pattern in '.ac-prep' '.ac' '.git/.ac'; do
    if ! grep -qxF "$pattern" "$ROOT/.gitignore" 2>/dev/null; then
        echo "$pattern" >> "$ROOT/.gitignore"
        echo "[ok] Added $pattern to .gitignore"
    fi
done

# ============================================================================
# 3) Create default shard map for path-based coordination
# ============================================================================
if [ ! -f "$SHARDS" ]; then
    cat > "$SHARDS" <<'JSON'
{
  "worktree": ["worktree-manager.js", "worktree/**"],
  "cs-devops-agent": ["cs-devops-agent-worker.js", "cs-devops-agent/**"],
  "agent": ["run-with-agent.js", "agent/**"],
  "webapp": ["webapp/**", "app/**", "frontend/**"],
  "services": ["services/**", "src/services/**"],
  "infra": ["infra/**", "infrastructure/**", "ops/**", "Documentation/infrastructure.md"],
  "shared": ["shared/**", "packages/**", "libs/**"],
  "scripts": ["scripts/**", "Scripts_Dev/**", "setup-*.js", "setup-*.sh"],
  "tests": ["test_cases/**", "jest.config.*", "*.spec.js", "*.test.js"],
  "docs": ["*.md", "product_requirement_docs/**", "Documentation/**"],
  "config": ["package.json", "package-lock.json", ".vscode/**", ".*rc", ".*config.*"],
  "default": ["**"]
}
JSON
    echo "[ok] Created $SHARDS with CS_DevOpsAgent-specific shards"
else
    echo "[skip] $SHARDS already exists"
fi

# ============================================================================
# 4) Append Prep TODO & Coordination section to house rules
# ============================================================================
append_prep_section() {
    local f="$1"
    
    if [ ! -f "$f" ]; then
        echo "# House Rules" > "$f"
        echo "[ok] Created $f"
    fi
    
    if grep -qi '^## Prep TODO & Coordination' "$f" 2>/dev/null; then
        echo "[skip] Prep TODO section already present in $(basename "$f")"
        return
    fi

    cat >> "$f" <<'MD'

---

## Prep TODO & Coordination (Multi-Agent Handshake)

**Purpose:** Prevent agents from stepping on each other by publishing an _edit plan_ before changing files. The commit agent reads these plans, reserves shards (coarse path buckets), and either **acknowledges** or **blocks** the work.

### Agent Workflow

**Agents MUST write** a single JSON at `.ac-prep/<agent>.json` **before** edits and wait for `.ac/ack/<agent>.json`.

### Prep JSON Format
```json
{
  "agent": "<agent-id>",
  "task": "<short-slug>",
  "branch": "<target-branch>",
  "paths": ["<glob1>", "<glob2>"],
  "shards": ["<shard1>", "<shard2>"],
  "reason": "<why>",
  "priority": 1-10,
  "createdAt": "<ISO-8601>",
  "ttlMs": 600000
}
```

### Flow

1. **Write prep file** → `.ac-prep/<agent>.json`
2. **Wait for acknowledgment** → `.ac/ack/<agent>.json`
3. **Check status**:
   - `status:"ok"` → proceed only within acknowledged paths/shards
   - `status:"blocked"` → do not edit; narrow scope or wait; re-publish
   - `status:"queued"` → wait for turn based on priority
4. **After edits** → write `.claude-commit-msg` (Conventional Commit + 1–3 bullets)
5. **If alert appears** → `.git/.ac/alerts/<agent>.md` → re-run with narrower scope

### Shard System

Shards live in `.ac-shards.json`. The commit agent:
- **Reserves shards** on prep, acks or blocks
- **At commit**, claims shards and stages only owned files
- **Overlapping work** is blocked/queued/branched per config
- **Writes human alerts** to `.git/.ac/alerts/<agent>.md` when overlap occurs

### Priority Levels
- `10`: Critical hotfix
- `7-9`: High priority features
- `4-6`: Normal development
- `1-3`: Low priority/cleanup

### Conflict Resolution Strategy
```
AC_SHARD_STRATEGY options:
- "block": Prevent overlapping edits (default)
- "branch": Create agent-specific branches
- "queue": Queue based on priority and timestamp
```

### Agent Identification
Agents are identified by:
- Environment variable: `AGENT_NAME` or `AI_AGENT`
- Auto-detection from API keys (Claude, Copilot, Cursor, etc.)
- Session-based: `session-${USER}@${HOSTNAME}`

### Monitoring
Check coordination status:
```bash
ls -la .ac-prep/      # Pending prep requests
ls -la .ac/ack/       # Acknowledgments
ls -la .git/.ac/alerts/  # Conflict alerts
cat .git/.ac/claims/*.json  # Active claims
```

MD
    echo "[ok] Appended Prep TODO & Coordination section to $(basename "$f")"
}

append_prep_section "$HOUSE_LOCAL"

# ============================================================================
# 5) Create prep template for agents
# ============================================================================
TPL="$ROOT/.ac-prep/_template.json"
if [ ! -f "$TPL" ]; then
    cat > "$TPL" <<'JSON'
{
  "agent": "replace-with-agent-id",
  "task": "short-slug-for-task",
  "branch": "dev_sdd_$(date +%Y-%m-%d)",
  "paths": ["src/**/*.js", "test/**/*.spec.js"],
  "shards": ["cs-devops-agent", "tests"],
  "reason": "Brief description of what and why",
  "priority": 5,
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "ttlMs": 600000
}
JSON
    echo "[ok] Created prep template at $TPL"
fi

# ============================================================================
# 6) Create acknowledgment template
# ============================================================================
ACK_TPL="$ROOT/.ac/ack/_template.json"
mkdir -p "$ROOT/.ac/ack"
if [ ! -f "$ACK_TPL" ]; then
    cat > "$ACK_TPL" <<'JSON'
{
  "agent": "agent-id",
  "status": "ok|blocked|queued",
  "acknowledgedPaths": ["paths/that/can/be/edited"],
  "acknowledgedShards": ["shard1", "shard2"],
  "blockedBy": null,
  "queuePosition": null,
  "message": "Human-readable status message",
  "expiresAt": "ISO-8601",
  "acknowledgedAt": "ISO-8601"
}
JSON
    echo "[ok] Created ack template at $ACK_TPL"
fi

# ============================================================================
# 7) Patch VS Code tasks.json for Auto Commit Worker
# ============================================================================
if [ -f "$TASKS" ]; then
    if command -v jq >/dev/null 2>&1; then
        echo "[step] Updating VS Code tasks.json with coordination env vars..."
        TMP="$(mktemp)"
        
        # Check if Auto Commit Worker task exists
        if jq -e '.tasks[] | select(.label == "🚀 Start Auto-Commit Worker")' "$TASKS" >/dev/null 2>&1; then
            jq '
            (.tasks[] | 
             select(.label == "🚀 Start Auto-Commit Worker") | 
             .options.env) += {
                // Message-driven commits
                "AC_TRIGGER_ON_MSG": "true",
                "AC_MSG_DEBOUNCE_MS": "3000",
                "AC_QUIET_MS": "0",
                "AC_REQUIRE_MSG": "true",
                "AC_REQUIRE_MSG_AFTER_CHANGE": "false",
                "AC_CLEAR_MSG_WHEN": "push",
                "AC_MSG_FILE": ".claude-commit-msg",
                
                // Shards + claims + prep/ack locations
                "AC_SHARDS_FILE": ".ac-shards.json",
                "AC_SHARD_STRATEGY": "block",
                "AC_CLAIM_TTL_MS": "120000",
                "AC_CLAIM_HEARTBEAT": "10000",
                "AC_CLAIM_STICKY_MS": "30000",
                "AC_PREP_DIR": ".ac-prep",
                "AC_ACK_DIR": ".ac/ack",
                "AC_ALERT_DIR": ".git/.ac/alerts",
                "AC_CLAIMS_DIR": ".git/.ac/claims",
                "AC_RESERVATIONS_DIR": ".git/.ac/reservations",
                "AC_AGENT_ID": "session-${USER}@${HOSTNAME}",
                
                // Branch & rollover settings
                "AC_TZ": "Asia/Dubai",
                "AC_BRANCH_PREFIX": "dev_sdd_",
                "AC_ROLLOVER_PROMPT": "true",
                "AC_VERSION_PREFIX": "v0.",
                "AC_VERSION_START_MINOR": "2",
                "AC_VERSION_BASE_REF": "origin/main"
            }' "$TASKS" > "$TMP" && mv "$TMP" "$TASKS"
            echo "[ok] Updated env vars in $TASKS"
        else
            echo "[warn] Auto Commit Worker task not found in tasks.json"
        fi
    else
        cat <<'NOTE'
[note] jq not installed. Please add these env vars to the "🚀 Start Auto-Commit Worker" task options.env:

AC_TRIGGER_ON_MSG=true
AC_MSG_DEBOUNCE_MS=3000
AC_QUIET_MS=0
AC_REQUIRE_MSG=true
AC_REQUIRE_MSG_AFTER_CHANGE=false
AC_CLEAR_MSG_WHEN=push
AC_MSG_FILE=.claude-commit-msg
AC_SHARDS_FILE=.ac-shards.json
AC_SHARD_STRATEGY=block
AC_CLAIM_TTL_MS=120000
AC_CLAIM_HEARTBEAT=10000
AC_CLAIM_STICKY_MS=30000
AC_PREP_DIR=.ac-prep
AC_ACK_DIR=.ac/ack
AC_ALERT_DIR=.git/.ac/alerts
AC_CLAIMS_DIR=.git/.ac/claims
AC_RESERVATIONS_DIR=.git/.ac/reservations
AC_AGENT_ID=session-${USER}@${HOSTNAME}
AC_TZ=Asia/Dubai
AC_BRANCH_PREFIX=dev_sdd_
AC_ROLLOVER_PROMPT=true
AC_VERSION_PREFIX=v0.
AC_VERSION_START_MINOR=2
AC_VERSION_BASE_REF=origin/main
NOTE
    fi
else
    echo "[warn] .vscode/tasks.json not found; skipping tasks patch."
fi

# ============================================================================
# 8) Create monitoring script
# ============================================================================
MONITOR_SCRIPT="$ROOT/monitor-agents.sh"
if [ ! -f "$MONITOR_SCRIPT" ]; then
    cat > "$MONITOR_SCRIPT" <<'SCRIPT'
#!/usr/bin/env bash
# Monitor agent coordination status

set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"

echo "========================================="
echo "Multi-Agent Coordination Status"
echo "========================================="
echo

echo "📝 Pending Prep Requests:"
if [ -d "$ROOT/.ac-prep" ]; then
    for file in "$ROOT/.ac-prep"/*.json; do
        [ -f "$file" ] || continue
        agent=$(basename "$file" .json)
        [ "$agent" = "_template" ] && continue
        echo "  - $agent: $(jq -r '.task // "unknown"' "$file" 2>/dev/null || echo "invalid json")"
    done
else
    echo "  (none)"
fi
echo

echo "✅ Active Acknowledgments:"
if [ -d "$ROOT/.ac/ack" ]; then
    for file in "$ROOT/.ac/ack"/*.json; do
        [ -f "$file" ] || continue
        agent=$(basename "$file" .json)
        [ "$agent" = "_template" ] && continue
        status=$(jq -r '.status // "unknown"' "$file" 2>/dev/null || echo "invalid")
        echo "  - $agent: $status"
    done
else
    echo "  (none)"
fi
echo

echo "⚠️  Active Alerts:"
if [ -d "$ROOT/.git/.ac/alerts" ]; then
    alert_count=$(find "$ROOT/.git/.ac/alerts" -name "*.md" | wc -l)
    if [ "$alert_count" -gt 0 ]; then
        for file in "$ROOT/.git/.ac/alerts"/*.md; do
            [ -f "$file" ] || continue
            agent=$(basename "$file" .md)
            echo "  - $agent: $(head -n1 "$file" 2>/dev/null || echo "empty")"
        done
    else
        echo "  (none)"
    fi
else
    echo "  (none)"
fi
echo

echo "🔒 Active Claims:"
if [ -d "$ROOT/.git/.ac/claims" ]; then
    for file in "$ROOT/.git/.ac/claims"/*.json; do
        [ -f "$file" ] || continue
        agent=$(basename "$file" .json)
        shards=$(jq -r '.shards[]' "$file" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
        echo "  - $agent: [$shards]"
    done
else
    echo "  (none)"
fi
echo

echo "📊 Shard Configuration:"
if [ -f "$ROOT/.ac-shards.json" ]; then
    echo "  Defined shards: $(jq -r 'keys | join(", ")' "$ROOT/.ac-shards.json")"
else
    echo "  (not configured)"
fi

SCRIPT
    chmod +x "$MONITOR_SCRIPT"
    echo "[ok] Created monitoring script: $MONITOR_SCRIPT"
fi

# ============================================================================
# 9) Create example agent prep script
# ============================================================================
AGENT_SCRIPT="$ROOT/agent-prep.sh"
if [ ! -f "$AGENT_SCRIPT" ]; then
    cat > "$AGENT_SCRIPT" <<'AGENT'
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

AGENT
    chmod +x "$AGENT_SCRIPT"
    echo "[ok] Created agent prep script: $AGENT_SCRIPT"
fi

# ============================================================================
# 10) Status Report
# ============================================================================
echo
echo "========================================="
echo "✅ Prep/Coordination Scaffolding Complete"
echo "========================================="
echo

echo "📁 Directory Structure:"
ls -la "$ROOT/.ac-prep" 2>/dev/null | head -5 || echo "  .ac-prep/ (created)"
ls -la "$ROOT/.ac/ack" 2>/dev/null | head -5 || echo "  .ac/ack/ (created)"
ls -la "$ROOT/.git/.ac/alerts" 2>/dev/null | head -5 || echo "  .git/.ac/alerts/ (created)"

echo
echo "📋 Configuration Files:"
[ -f "$SHARDS" ] && echo "  ✓ .ac-shards.json (shard definitions)" || echo "  ✗ .ac-shards.json"
[ -f "$HOUSE_LOCAL" ] && echo "  ✓ houserules.md (with Prep TODO section)" || echo "  ✗ houserules.md"
[ -f "$ROOT/.ac-prep/_template.json" ] && echo "  ✓ Prep template" || echo "  ✗ Prep template"
[ -f "$ROOT/.ac/ack/_template.json" ] && echo "  ✓ Ack template" || echo "  ✗ Ack template"

echo
echo "🛠️  Helper Scripts:"
[ -x "$MONITOR_SCRIPT" ] && echo "  ✓ monitor-agents.sh (status monitoring)" || echo "  ✗ monitor-agents.sh"
[ -x "$AGENT_SCRIPT" ] && echo "  ✓ agent-prep.sh (agent request helper)" || echo "  ✗ agent-prep.sh"

echo
echo "📝 House Rules Status:"
if grep -q "Prep TODO & Coordination" "$HOUSE_LOCAL" 2>/dev/null; then
    echo "  ✓ Prep TODO & Coordination section added to houserules.md"
else
    echo "  ✗ Prep TODO & Coordination section not found"
fi

echo
echo "========================================="
echo "🚀 Next Steps:"
echo "========================================="
echo "1. Agents should use: ./agent-prep.sh <task> <paths> <priority>"
echo "2. Monitor status with: ./monitor-agents.sh"
echo "3. Start Auto-Commit Worker to process prep requests"
echo "4. Check .git/.ac/alerts/ for conflict notifications"
echo
echo "[done] Setup complete. Multi-agent coordination is ready!"