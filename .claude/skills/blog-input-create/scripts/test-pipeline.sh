#!/usr/bin/env bash
# test-pipeline.sh — Dry-run integration test for blog-input-create
#
# Validates prerequisites and WP connectivity for each phase of the
# blog-input-create pipeline without publishing anything. Optionally
# creates and deletes a test draft to confirm full read/write/delete on
# the WordPress REST API.
#
# Usage:
#   .claude/skills/blog-input-create/scripts/test-pipeline.sh
#   .claude/skills/blog-input-create/scripts/test-pipeline.sh --create-draft
#   .claude/skills/blog-input-create/scripts/test-pipeline.sh --url=https://example.com/post
#
# Flags:
#   --create-draft   Create, read, and delete a test draft in WordPress
#   --url=URL        URL to exercise the scrape path against (default: example.com)
#   -h, --help       Show this help

set -uo pipefail  # intentionally NOT -e so we report every failure

# ─── Colors ───────────────────────────────────────────────────────────
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
BLUE=$'\033[34m'
RESET=$'\033[0m'

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
FAILURES=()

pass()    { echo "${GREEN}✓${RESET} $*"; PASS_COUNT=$((PASS_COUNT+1)); }
warn()    { echo "${YELLOW}⚠${RESET} $*"; WARN_COUNT=$((WARN_COUNT+1)); }
fail()    { echo "${RED}✗${RESET} $*"; FAIL_COUNT=$((FAIL_COUNT+1)); FAILURES+=("$*"); }
info()    { echo "${BLUE}ℹ${RESET} $*"; }
section() { echo; echo "${BLUE}━━━${RESET} $* ${BLUE}━━━${RESET}"; }

# ─── Parse args ───────────────────────────────────────────────────────
CREATE_DRAFT=false
TEST_URL="https://example.com"

for arg in "$@"; do
  case "$arg" in
    --create-draft) CREATE_DRAFT=true ;;
    --url=*) TEST_URL="${arg#*=}" ;;
    -h|--help)
      sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) fail "Unknown arg: $arg"; exit 1 ;;
  esac
done

# ─── Resolve repo root ────────────────────────────────────────────────
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

# ─── 1. Environment variables ─────────────────────────────────────────
section "1. Environment variables"

for var in WP_BASE_URL WP_USER WP_APP_PASSWORD; do
  if [ -n "${!var:-}" ]; then
    pass "$var is set"
  else
    fail "$var is not set"
  fi
done

if [ -n "${FIRECRAWL_API_KEY:-}" ]; then
  pass "FIRECRAWL_API_KEY is set (optional)"
else
  warn "FIRECRAWL_API_KEY not set — runtime will fall back to WebFetch"
fi

SKIP_WP=false
if [ -z "${WP_BASE_URL:-}" ] || [ -z "${WP_USER:-}" ] || [ -z "${WP_APP_PASSWORD:-}" ]; then
  SKIP_WP=true
fi

# ─── 2. tchop context files ───────────────────────────────────────────
section "2. tchop context files"

CONTEXT_FILES=(
  ".claude/context/brand.md"
  ".claude/context/tone-and-voice.md"
  ".claude/context/tone-and-voice-de.md"
  ".claude/context/messaging.md"
  ".claude/context/messaging-de.md"
  ".claude/context/icp-context.md"
  ".claude/context/product-architecture.md"
  ".claude/context/sales-objections.md"
  ".claude/context/content-inventory.md"
)

for file in "${CONTEXT_FILES[@]}"; do
  if [ -f "$file" ]; then
    size=$(wc -c < "$file" | tr -d ' ')
    pass "$file (${size} bytes)"
  else
    fail "$file missing"
  fi
done

# ─── 3. Related skills on disk ────────────────────────────────────────
section "3. Related skills on disk"

SKILL_DIRS=(
  ".claude/skills/blog-input-create"
  ".claude/skills/content-repurposing-engine"
  ".claude/skills/tone-style-enforcer"
  ".claude/skills/content"
  ".claude/skills/stop-slop"
  ".claude/skills/last30days"
  ".claude/skills/seo"
  ".claude/skills/ai-seo"
  ".claude/skills/schema-markup"
)

for dir in "${SKILL_DIRS[@]}"; do
  if [ -f "$dir/SKILL.md" ]; then
    pass "$dir/SKILL.md"
  else
    fail "$dir/SKILL.md missing"
  fi
done

if [ -f ".claude/skills/last30days/scripts/last30days.py" ]; then
  pass "last30days research script present"
else
  warn "last30days/scripts/last30days.py missing — Phase 3 will need another research path"
fi

# ─── 4. State directory ───────────────────────────────────────────────
section "4. State directory"

STATE_DIR="$HOME/.claude/skills/blog-input-create/state"
if [ -d "$STATE_DIR" ]; then
  pass "$STATE_DIR exists"
else
  mkdir -p "$STATE_DIR/repurpose"
  pass "Created $STATE_DIR"
fi

RECENT_LOG="$STATE_DIR/recent-images.json"
if [ -f "$RECENT_LOG" ]; then
  pick_count=$(jq '.picks | length' "$RECENT_LOG" 2>/dev/null || echo "?")
  pass "recent-images.json exists (${pick_count} picks logged)"
else
  echo '{"window_days": 60, "picks": []}' > "$RECENT_LOG"
  pass "Initialized recent-images.json"
fi

# ─── 5. CLI tools ─────────────────────────────────────────────────────
section "5. Required CLI tools"

for cmd in curl jq shuf; do
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "$cmd"
  else
    fail "$cmd not installed"
  fi
done

if command -v pandoc >/dev/null 2>&1; then
  pass "pandoc (markdown → HTML)"
else
  warn "pandoc not installed — Phase 10 will need another markdown → HTML path"
fi

# Stop here if we can't reach WP
if [ "$SKIP_WP" = true ]; then
  section "Summary"
  echo "${RED}WordPress credentials missing — cannot run connectivity tests.${RESET}"
  echo "${GREEN}Passed:${RESET}   $PASS_COUNT"
  echo "${YELLOW}Warnings:${RESET} $WARN_COUNT"
  echo "${RED}Failed:${RESET}   $FAIL_COUNT"
  exit 1
fi

# ─── 6. WordPress REST API connectivity ───────────────────────────────
section "6. WordPress REST API connectivity"

code=$(curl -s -o /tmp/wp-root.json -w "%{http_code}" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  "$WP_BASE_URL/wp-json/")
if [ "$code" = "200" ]; then
  site_name=$(jq -r '.name // "?"' /tmp/wp-root.json)
  pass "GET /wp-json → 200 (site: $site_name)"
else
  fail "GET /wp-json → $code"
fi

code=$(curl -s -o /tmp/wp-posts.json -w "%{http_code}" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  "$WP_BASE_URL/wp-json/wp/v2/posts?per_page=1&status=any&context=edit")
if [ "$code" = "200" ]; then
  pass "GET /wp/v2/posts (context=edit) → 200 (auth OK)"
else
  fail "GET /wp/v2/posts → $code (auth may have failed)"
fi

code=$(curl -s -o /tmp/wp-me.json -w "%{http_code}" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  "$WP_BASE_URL/wp-json/wp/v2/users/me?context=edit")
if [ "$code" = "200" ]; then
  user_name=$(jq -r '.name // "?"' /tmp/wp-me.json)
  user_caps=$(jq -r '[.capabilities | to_entries[] | select(.value == true) | .key] | join(",")' /tmp/wp-me.json 2>/dev/null || echo "?")
  pass "Authenticated as: $user_name"
  if echo "$user_caps" | grep -q "edit_posts"; then
    pass "User has edit_posts capability"
  else
    warn "User lacks edit_posts — draft creation will fail"
  fi
else
  warn "GET /wp/v2/users/me → $code"
fi

# ─── 7. "title images" folder resolution ──────────────────────────────
section "7. 'title images' folder resolution"

FOLDER_MECH=""
FOLDER_ID=""
IMG_COUNT=0

# 7a. FileBird
code=$(curl -s -o /tmp/wp-fb.json -w "%{http_code}" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  "$WP_BASE_URL/wp-json/filebird/public/v1/folder" 2>/dev/null)
if [ "$code" = "200" ]; then
  folder_id=$(jq -r '[.. | objects | select((.text // .name // "" | ascii_downcase) == "title images") | .id] | first // empty' /tmp/wp-fb.json 2>/dev/null)
  if [ -n "$folder_id" ] && [ "$folder_id" != "null" ]; then
    pass "FileBird: 'title images' → id=$folder_id"
    FOLDER_MECH="filebird"
    FOLDER_ID=$folder_id
  else
    info "FileBird active but no folder named 'title images'"
  fi
else
  info "FileBird endpoint not available ($code)"
fi

# 7b. Real Media Library
if [ -z "$FOLDER_MECH" ]; then
  code=$(curl -s -o /tmp/wp-rml.json -w "%{http_code}" \
    -u "$WP_USER:$WP_APP_PASSWORD" \
    "$WP_BASE_URL/wp-json/realmedialibrary/v1/folders" 2>/dev/null)
  if [ "$code" = "200" ]; then
    folder_id=$(jq -r '[.. | objects | select((.name // .text // "" | ascii_downcase) == "title images") | .id] | first // empty' /tmp/wp-rml.json 2>/dev/null)
    if [ -n "$folder_id" ] && [ "$folder_id" != "null" ]; then
      pass "Real Media Library: 'title images' → id=$folder_id"
      FOLDER_MECH="rml"
      FOLDER_ID=$folder_id
    fi
  else
    info "RML endpoint not available ($code)"
  fi
fi

# 7c. media_tag taxonomy
if [ -z "$FOLDER_MECH" ]; then
  code=$(curl -s -o /tmp/wp-tag.json -w "%{http_code}" \
    -u "$WP_USER:$WP_APP_PASSWORD" \
    "$WP_BASE_URL/wp-json/wp/v2/media_tag?slug=title-images" 2>/dev/null)
  if [ "$code" = "200" ]; then
    tag_id=$(jq -r '.[0].id // empty' /tmp/wp-tag.json 2>/dev/null)
    if [ -n "$tag_id" ] && [ "$tag_id" != "null" ]; then
      pass "media_tag 'title-images' → id=$tag_id"
      FOLDER_MECH="media_tag"
      FOLDER_ID=$tag_id
    fi
  fi
fi

# 7d. Filename convention fallback
if [ -z "$FOLDER_MECH" ]; then
  code=$(curl -s -o /tmp/wp-search.json -w "%{http_code}" \
    -u "$WP_USER:$WP_APP_PASSWORD" \
    "$WP_BASE_URL/wp-json/wp/v2/media?search=title&per_page=5&media_type=image" 2>/dev/null)
  if [ "$code" = "200" ]; then
    count=$(jq 'length' /tmp/wp-search.json 2>/dev/null || echo 0)
    if [ "$count" -gt 0 ]; then
      warn "No folder plugin detected. Found $count media items matching 'title' by filename — could use as fallback"
      FOLDER_MECH="filename"
    else
      fail "No 'title images' folder or matching media found"
    fi
  fi
fi

# Count images in the folder
if [ "$FOLDER_MECH" = "filebird" ]; then
  curl -s -u "$WP_USER:$WP_APP_PASSWORD" \
    "$WP_BASE_URL/wp-json/wp/v2/media?per_page=100&fb_folder=$FOLDER_ID&media_type=image" \
    > /tmp/wp-imgs.json
  IMG_COUNT=$(jq 'length' /tmp/wp-imgs.json 2>/dev/null || echo 0)
  pass "Images in FileBird folder $FOLDER_ID: $IMG_COUNT"
elif [ "$FOLDER_MECH" = "media_tag" ]; then
  curl -s -u "$WP_USER:$WP_APP_PASSWORD" \
    "$WP_BASE_URL/wp-json/wp/v2/media?per_page=100&media_tag=$FOLDER_ID&media_type=image" \
    > /tmp/wp-imgs.json
  IMG_COUNT=$(jq 'length' /tmp/wp-imgs.json 2>/dev/null || echo 0)
  pass "Images with media_tag $FOLDER_ID: $IMG_COUNT"
fi

if [ "$IMG_COUNT" -gt 0 ] && [ "$IMG_COUNT" -lt 2 ]; then
  warn "Folder has only $IMG_COUNT image(s) — Phase 9 needs ≥2 for distinct EN/DE picks"
fi

# ─── 8. Rank Math SEO plugin ──────────────────────────────────────────
section "8. Rank Math SEO plugin"

SEO_PLUGIN="rank_math"

# Check whether rank_math_* meta fields are exposed on existing posts via REST
if jq -e '.[0].meta | keys[] | select(startswith("rank_math"))' /tmp/wp-posts.json >/dev/null 2>&1; then
  pass "rank_math_* meta fields exposed via REST"
else
  warn "No rank_math_* meta fields visible on existing posts via REST. Enable Rank Math → General Settings → REST API, or verify the SEO Meta module is active"
fi

# Probe Rank Math's own REST namespace
code=$(curl -s -o /tmp/wp-rm.json -w "%{http_code}" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  "$WP_BASE_URL/wp-json/rankmath/v1" 2>/dev/null)
if [ "$code" = "200" ] || [ "$code" = "404" ]; then
  # 200 means the namespace exists and lists endpoints
  # 404 on the index is fine; individual endpoints like updateMeta may still work
  if [ "$code" = "200" ]; then
    pass "Rank Math REST namespace /wp-json/rankmath/v1 reachable"
  else
    info "Rank Math REST namespace index returned 404 (some versions don't expose an index). Individual endpoints may still work."
  fi
else
  warn "Rank Math REST namespace check returned $code — plugin may not be installed or REST API is disabled"
fi

# Check for Yoast just to surface a conflict if both are installed
if jq -e '.[0].meta | keys[] | select(startswith("_yoast_wpseo"))' /tmp/wp-posts.json >/dev/null 2>&1; then
  warn "Yoast SEO meta fields also detected — running two SEO plugins in parallel will cause duplicate meta tags. Disable one."
fi

# ─── 9. Multilingual plugin detection ─────────────────────────────────
section "9. Multilingual plugin detection"

code=$(curl -s -o /tmp/wp-pll.json -w "%{http_code}" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  "$WP_BASE_URL/wp-json/pll/v1/languages" 2>/dev/null)
if [ "$code" = "200" ]; then
  lang_count=$(jq 'length' /tmp/wp-pll.json 2>/dev/null || echo 0)
  pass "Polylang active ($lang_count languages)"
  I18N="polylang"
else
  code=$(curl -s -o /tmp/wp-wpml.json -w "%{http_code}" \
    -u "$WP_USER:$WP_APP_PASSWORD" \
    "$WP_BASE_URL/wp-json/wpml/v1/languages" 2>/dev/null)
  if [ "$code" = "200" ]; then
    pass "WPML active"
    I18N="wpml"
  else
    warn "No multilingual plugin detected — EN/DE linking will be manual"
    I18N="none"
  fi
fi

# ─── 10. Scrape path ──────────────────────────────────────────────────
section "10. Scrape path"

if [ -n "${FIRECRAWL_API_KEY:-}" ]; then
  code=$(curl -s -o /tmp/fc.json -w "%{http_code}" \
    -X POST "https://api.firecrawl.dev/v1/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"$TEST_URL\",\"formats\":[\"markdown\"],\"onlyMainContent\":true}")
  if [ "$code" = "200" ]; then
    chars=$(jq -r '(.data.markdown // "") | length' /tmp/fc.json 2>/dev/null || echo 0)
    pass "Firecrawl scrape of $TEST_URL → 200 ($chars chars markdown)"
  else
    fail "Firecrawl scrape → HTTP $code"
    jq -r '.error // "unknown error"' /tmp/fc.json 2>/dev/null | head -3
  fi
else
  info "Firecrawl skipped (no key). Runtime will use WebFetch tool"
fi

# ─── 11. Live draft round-trip (opt-in) ───────────────────────────────
if [ "$CREATE_DRAFT" = true ]; then
  section "11. Live draft round-trip (create → read → delete)"

  timestamp=$(date +%Y%m%d-%H%M%S)
  payload=$(jq -n --arg ts "$timestamp" '{
    title: ("[TEST] blog-input-create pipeline check — safe to delete (" + $ts + ")"),
    content: "This is a test draft created by test-pipeline.sh. It will be deleted automatically.",
    status: "draft"
  }')

  code=$(curl -s -o /tmp/wp-draft.json -w "%{http_code}" \
    -X POST -u "$WP_USER:$WP_APP_PASSWORD" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$WP_BASE_URL/wp-json/wp/v2/posts")

  if [ "$code" = "201" ] || [ "$code" = "200" ]; then
    draft_id=$(jq -r '.id' /tmp/wp-draft.json)
    draft_link=$(jq -r '.link' /tmp/wp-draft.json)
    pass "Created draft #$draft_id → $draft_link"

    code=$(curl -s -o /tmp/wp-read.json -w "%{http_code}" \
      -u "$WP_USER:$WP_APP_PASSWORD" \
      "$WP_BASE_URL/wp-json/wp/v2/posts/$draft_id?context=edit")
    if [ "$code" = "200" ]; then
      pass "Read back draft #$draft_id"
    else
      fail "Read back draft → HTTP $code"
    fi

    code=$(curl -s -o /tmp/wp-del.json -w "%{http_code}" \
      -X DELETE -u "$WP_USER:$WP_APP_PASSWORD" \
      "$WP_BASE_URL/wp-json/wp/v2/posts/$draft_id?force=true")
    if [ "$code" = "200" ]; then
      pass "Deleted test draft #$draft_id"
    else
      fail "Delete test draft → HTTP $code (manual cleanup needed for post #$draft_id)"
    fi
  else
    fail "Create draft → HTTP $code"
    jq -r '.message // "unknown error"' /tmp/wp-draft.json 2>/dev/null | head -3
  fi
else
  info "Skipping live draft round-trip. Pass --create-draft to run it."
fi

# ─── Summary ──────────────────────────────────────────────────────────
section "Summary"
echo "${GREEN}Passed:${RESET}   $PASS_COUNT"
echo "${YELLOW}Warnings:${RESET} $WARN_COUNT"
echo "${RED}Failed:${RESET}   $FAIL_COUNT"

if [ "${FOLDER_MECH:-}" != "" ]; then
  echo
  echo "Detected config:"
  echo "  Folder mechanism: $FOLDER_MECH (id=$FOLDER_ID, $IMG_COUNT images)"
  echo "  SEO plugin:       ${SEO_PLUGIN:-unknown}"
  echo "  i18n plugin:      ${I18N:-none}"
fi

if [ ${#FAILURES[@]} -gt 0 ]; then
  echo
  echo "${RED}Failures:${RESET}"
  for f in "${FAILURES[@]}"; do
    echo "  - $f"
  done
fi

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi

echo
echo "${GREEN}✓ Ready to run blog-input-create${RESET}"
exit 0
