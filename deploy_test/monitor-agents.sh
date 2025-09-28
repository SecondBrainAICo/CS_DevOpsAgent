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

