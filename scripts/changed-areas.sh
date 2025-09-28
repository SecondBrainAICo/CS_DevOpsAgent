#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"

# Redirect log output to stderr to keep stdout clean
exec 3>&1
exec 1>&2
source "$ROOT/scripts/lib/log.sh"

BASE="${BASE_REF:-origin/main}"
HEAD="${HEAD_REF:-HEAD}"

# Allow flags: --base <ref> --head <ref>
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --head) HEAD="$2"; shift 2 ;;
    *) log_warn "Unknown flag: $1"; shift ;;
  esac
done

log_group_start "Computing changed areas (BASE=$BASE, HEAD=$HEAD)"
changed_files=$(git diff --name-only "$BASE" "$HEAD" || true)
if [ -z "${changed_files}" ]; then
  log_info "No changed files detected."
  log_group_end
  exit 0
fi

# Heuristics:
# - Ignore tests + scripts + docs when mapping areas
# - Map first two path segments as <area>/<component> when possible
# - For monorepos with packages/<pkg> or apps/<app>, area=<pkg|app>, component=inferred child
areas=()

while IFS= read -r f; do
  # Normalize and skip
  [[ -z "$f" ]] && continue
  [[ "$f" =~ ^test_cases/ ]] && { log_debug "Skip test file $f"; continue; }
  [[ "$f" =~ ^scripts/ ]] && { log_debug "Skip script $f"; continue; }
  [[ "$f" =~ ^docs?/ ]] && { log_debug "Skip docs $f"; continue; }

  # AutoCommit-specific patterns
  if [[ "$f" =~ ^worktree-manager\.js$ ]]; then
    area="worktree"
    component="manager"
  elif [[ "$f" =~ ^auto-commit-worker\.js$ ]]; then
    area="autocommit"
    component="worker"
  elif [[ "$f" =~ ^run-with-agent\.js$ ]]; then
    area="agent"
    component="runner"
  elif [[ "$f" =~ ^product_requirement_docs/(.+)\.md$ ]]; then
    area="docs"
    component="${BASH_REMATCH[1]}"
  # Monorepo patterns
  elif [[ "$f" =~ ^packages/([^/]+)/([^/]+)/ ]]; then
    area="${BASH_REMATCH[1]}"
    component="${BASH_REMATCH[2]}"
  elif [[ "$f" =~ ^apps/([^/]+)/([^/]+)/ ]]; then
    area="${BASH_REMATCH[1]}"
    component="${BASH_REMATCH[2]}"
  elif [[ "$f" =~ ^([^/]+)/([^/]+)/ ]]; then
    area="${BASH_REMATCH[1]}"
    component="${BASH_REMATCH[2]}"
  elif [[ "$f" =~ ^([^/]+)/ ]]; then
    area="${BASH_REMATCH[1]}"
    component="default"
  else
    area="root"
    component="default"
  fi

  path="test_cases/${area}/${component}"
  log_debug "Map $f -> $path"
  areas+=("$path")
done <<< "$changed_files"

# Unique + existing or prospective test dirs
unique=($(printf "%s\n" "${areas[@]}" | sort -u))

# Output test dirs to original stdout
exec 1>&3
for a in "${unique[@]}"; do
  echo "$a"
done

# Restore stderr for final log
exec 1>&2
log_group_end
