#!/usr/bin/env bash
set -euo pipefail

LOG_LEVEL="${LOG_LEVEL:-info}"
TRACE="${TRACE:-0}"

# Map level to numeric
_level_num() {
  case "${1,,}" in
    debug) echo 10 ;;
    info)  echo 20 ;;
    warn)  echo 30 ;;
    error) echo 40 ;;
    *)     echo 20 ;;
  esac
}

should_log() {
  local want="$(_level_num "${1:-info}")"
  local cur="$(_level_num "$LOG_LEVEL")"
  [ "$want" -ge "$cur" ]
}

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

_log() {
  local lvl="$1"; shift
  if should_log "$lvl"; then
    printf "%s [%s] %s\n" "$(ts)" "${lvl^^}" "$*" 1>&2
  fi
}

log_debug() { _log debug "$@"; }
log_info()  { _log info  "$@"; }
log_warn()  { _log warn  "$@"; }
log_error() { _log error "$@"; }

log_group_start() {
  # GitHub/Buildkite-style grouping (harmless locally)
  echo "::group::$*" || true
  log_info "$@"
}
log_group_end() {
  echo "::endgroup::" || true
}