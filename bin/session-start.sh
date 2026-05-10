#!/usr/bin/env bash
# session-start.sh
#
# Runs on SessionStart (see .claude/settings.json). Ensures this repo's
# external skill dependencies are present and linked so every new Claude
# Code session has them available — on a laptop, in CI, or in a sandboxed
# web session.
#
# Steps:
#   1. Clone gstack to ~/.claude/skills/gstack if missing (one-time per machine).
#   2. Run bin/gstack-link.sh to (re)create symlinks under .claude/skills/.
#
# Failures are logged but non-fatal: Claude Code will still start the session
# even if the network is unavailable or the clone fails.

set -uo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
GSTACK_DIR="${GSTACK_DIR:-$HOME/.claude/skills/gstack}"

log() { echo "session-start: $*" >&2; }

# 1. Install gstack if missing
if [ ! -d "$GSTACK_DIR" ]; then
  log "gstack not found at $GSTACK_DIR — cloning…"
  if git clone --single-branch --depth 1 \
      https://github.com/garrytan/gstack.git "$GSTACK_DIR" >&2; then
    if [ -x "$GSTACK_DIR/setup" ]; then
      (cd "$GSTACK_DIR" && ./setup --team) >&2 \
        || log "warning: gstack ./setup --team exited non-zero; continuing"
    fi
  else
    log "warning: failed to clone gstack; skills will be unavailable this session"
  fi
fi

# 2. Link gstack skills into this project
if [ -d "$GSTACK_DIR" ] && [ -x "$PROJECT_ROOT/bin/gstack-link.sh" ]; then
  GSTACK_DIR="$GSTACK_DIR" "$PROJECT_ROOT/bin/gstack-link.sh" >&2 \
    || log "warning: gstack-link.sh exited non-zero"
fi

exit 0
