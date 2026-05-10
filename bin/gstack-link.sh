#!/usr/bin/env bash
# gstack-link.sh
#
# Link gstack skills into this project's .claude/skills/ so they're callable
# as slash commands from within this repo.
#
# Prerequisite: gstack must be installed at ~/.claude/skills/gstack. Install once:
#
#   git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git \
#     ~/.claude/skills/gstack
#   cd ~/.claude/skills/gstack && ./setup --team
#
# gstack's --team mode keeps itself updated automatically, so you never need
# to re-run this script unless gstack adds brand-new skill folders.
#
# Usage:
#   ./bin/gstack-link.sh            # link all gstack skills
#   GSTACK_DIR=/path ./bin/gstack-link.sh   # override gstack install location
#
# Re-runs are idempotent: existing symlinks are refreshed, real directories
# (your own project skills) are never touched.

set -euo pipefail

GSTACK_DIR="${GSTACK_DIR:-$HOME/.claude/skills/gstack}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"

if [ ! -d "$GSTACK_DIR" ]; then
  cat >&2 <<EOF
error: gstack is not installed at $GSTACK_DIR

Install it first:

  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git \\
    "$GSTACK_DIR"
  cd "$GSTACK_DIR" && ./setup --team

Or set GSTACK_DIR to an existing install:

  GSTACK_DIR=/path/to/gstack ./bin/gstack-link.sh
EOF
  exit 1
fi

mkdir -p "$SKILLS_DIR"

linked=0
refreshed=0
conflicts=()

for skill_path in "$GSTACK_DIR"/*/; do
  skill_name="$(basename "$skill_path")"

  # Only consider directories that look like skills (have a SKILL.md).
  [ -f "$skill_path/SKILL.md" ] || continue

  target="$SKILLS_DIR/$skill_name"

  if [ -e "$target" ] && [ ! -L "$target" ]; then
    # Real directory already exists — this is a project-owned skill that
    # happens to share a name with a gstack skill. Don't clobber it.
    conflicts+=("$skill_name")
    continue
  fi

  if [ -L "$target" ]; then
    rm "$target"
    ln -s "$skill_path" "$target"
    refreshed=$((refreshed + 1))
  else
    ln -s "$skill_path" "$target"
    linked=$((linked + 1))
  fi
done

echo "gstack: linked $linked new, refreshed $refreshed existing skill(s)"
echo "        source: $GSTACK_DIR"
echo "        target: $SKILLS_DIR"

if [ "${#conflicts[@]}" -gt 0 ]; then
  echo
  echo "skipped (project skill with same name already exists):"
  for name in "${conflicts[@]}"; do
    echo "  - $name"
  done
  echo
  echo "Rename or remove the project skill if you want to use the gstack version."
fi
