#!/usr/bin/env python3
"""
Lilien Matchday Curator

Polls a curated list of Bluesky and X accounts around SV Darmstadt 98 match
windows, has Claude rank the candidate posts, and publishes the best ones
as social cards to a tchop mix.

Run via cron every ~5 minutes. The script is a no-op outside match windows,
so cron cost is negligible.

Required environment (loaded from .env in project root or parent):
    ANTHROPIC_API_KEY     Claude API key for curation
    X_BEARER_TOKEN        X/Twitter v2 API bearer
    TCHOP_ORG             tchop organisation slug (e.g. "lilien")
    TCHOP_AUTH_TOKEN      tchop GraphQL auth token
    TCHOP_API_CLIENT_ID   tchop API client id (optional but recommended)
    TCHOP_API_URL         defaults to https://tchop.io/api/graphql/webapp
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest

# ---------------------------------------------------------------------------
# Paths + config loading
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"
MATCHES_PATH = ROOT / "matches.json"
STATE_PATH = ROOT / "state.json"
LOG_PATH = ROOT / "curate.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_PATH), logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("curate")


def load_env() -> None:
    """Load env from .env and, as a fallback for TCHOP_*, from ~/.claude.json."""
    for candidate in [ROOT / ".env", ROOT.parent / ".env"]:
        if not candidate.exists():
            continue
        for line in candidate.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and not os.environ.get(key):
                os.environ[key] = value

    # Fallback: read tchop credentials from Claude Code MCP server config.
    # This avoids duplicating secrets between .env and ~/.claude.json.
    # Accepts either "tchop-lilien" (current) or legacy "tchop-production".
    if not os.environ.get("TCHOP_AUTH_TOKEN"):
        mcp_config = Path.home() / ".claude.json"
        if mcp_config.exists():
            try:
                data = json.loads(mcp_config.read_text())
                mcp_servers = data.get("mcpServers", {})
                server = mcp_servers.get("tchop-lilien") or mcp_servers.get("tchop-production") or {}
                env_block = server.get("env", {})
                for key in ("TCHOP_ORG", "TCHOP_AUTH_TOKEN", "TCHOP_API_CLIENT_ID", "TCHOP_API_URL"):
                    if env_block.get(key) and not os.environ.get(key):
                        os.environ[key] = env_block[key]
            except Exception:
                pass


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def save_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Candidate:
    url: str
    platform: str  # "bsky" | "x"
    author_handle: str
    author_name: str
    text: str
    created_at: str  # ISO 8601
    image_urls: list[str] = field(default_factory=list)
    avatar_url: str | None = None

    def dedup_key(self) -> str:
        return self.url


# ---------------------------------------------------------------------------
# Match window
# ---------------------------------------------------------------------------

def in_match_window(matches: list[dict[str, Any]], cfg_window: dict[str, int], now: datetime) -> dict[str, Any] | None:
    pre = timedelta(minutes=cfg_window["minutes_before_kickoff"])
    dur = timedelta(minutes=cfg_window["match_duration_minutes"])
    post = timedelta(minutes=cfg_window["minutes_after_final_whistle"])
    for match in matches:
        kickoff = datetime.fromisoformat(match["kickoff"])
        start = kickoff - pre
        end = kickoff + dur + post
        if start <= now <= end:
            return match
    return None


def in_extended_window(
    matches: list[dict[str, Any]],
    cfg_window: dict[str, int],
    cfg_extended: dict[str, int] | None,
    now: datetime,
) -> dict[str, Any] | None:
    """Check if we're in the post-match extended curation window.

    This covers the period AFTER the main match window ends, up to
    cfg_extended["hours_after_final_whistle"] hours after the final whistle.
    Returns the match if in the extended window, None otherwise.
    """
    if not cfg_extended:
        return None
    dur = timedelta(minutes=cfg_window["match_duration_minutes"])
    post = timedelta(minutes=cfg_window["minutes_after_final_whistle"])
    ext = timedelta(hours=cfg_extended["hours_after_final_whistle"])
    for match in matches:
        kickoff = datetime.fromisoformat(match["kickoff"])
        main_end = kickoff + dur + post
        ext_end = kickoff + dur + ext
        if main_end < now <= ext_end:
            return match
    return None


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def http_request(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: int = 20,
) -> tuple[int, bytes]:
    req = urlrequest.Request(url, method=method, data=body)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urlrequest.urlopen(req, timeout=timeout) as res:
            return res.status, res.read()
    except urlerror.HTTPError as e:
        return e.code, e.read() if e.fp else b""


def http_json(url: str, **kwargs) -> Any:
    status, body = http_request(url, **kwargs)
    if status >= 400:
        raise RuntimeError(f"HTTP {status} for {url}: {body[:300].decode('utf-8', 'replace')}")
    return json.loads(body.decode("utf-8"))


# ---------------------------------------------------------------------------
# Bluesky
# ---------------------------------------------------------------------------

BSKY_PUBLIC = "https://public.api.bsky.app/xrpc"


def bsky_resolve_handle(handle: str) -> str | None:
    try:
        data = http_json(f"{BSKY_PUBLIC}/com.atproto.identity.resolveHandle?handle={urlparse.quote(handle)}")
        return data.get("did")
    except Exception as exc:
        log.warning("bsky resolve failed for %s: %s", handle, exc)
        return None


def bsky_fetch_author_feed(handle: str, limit: int = 20) -> list[Candidate]:
    did = bsky_resolve_handle(handle)
    if not did:
        return []
    url = (
        f"{BSKY_PUBLIC}/app.bsky.feed.getAuthorFeed"
        f"?actor={urlparse.quote(did)}&limit={limit}&filter=posts_no_replies"
    )
    try:
        data = http_json(url)
    except Exception as exc:
        log.warning("bsky feed failed for %s: %s", handle, exc)
        return []
    candidates: list[Candidate] = []
    for entry in data.get("feed", []):
        # Skip reposts (reason present) and replies (should be filtered already)
        if entry.get("reason"):
            continue
        post = entry.get("post") or {}
        record = post.get("record") or {}
        if record.get("reply"):
            continue
        uri = post.get("uri", "")
        # Build public web URL
        rkey = uri.rsplit("/", 1)[-1] if uri else ""
        web_url = f"https://bsky.app/profile/{handle}/post/{rkey}" if rkey else ""
        if not web_url:
            continue
        author = post.get("author") or {}
        images = []
        embed = post.get("embed") or {}
        for img in embed.get("images", []) or []:
            if img.get("fullsize"):
                images.append(img["fullsize"])
        candidates.append(
            Candidate(
                url=web_url,
                platform="bsky",
                author_handle=handle,
                author_name=author.get("displayName") or handle,
                text=record.get("text", ""),
                created_at=record.get("createdAt", ""),
                image_urls=images,
                avatar_url=author.get("avatar"),
            )
        )
    return candidates


# ---------------------------------------------------------------------------
# X / Twitter
# ---------------------------------------------------------------------------

X_API = "https://api.twitter.com/2"


def x_headers() -> dict[str, str]:
    token = os.environ.get("X_BEARER_TOKEN", "")
    return {"Authorization": f"Bearer {token}"}


def x_resolve_user(username: str) -> dict[str, Any] | None:
    url = f"{X_API}/users/by/username/{urlparse.quote(username)}?user.fields=profile_image_url,name"
    try:
        data = http_json(url, headers=x_headers())
        return data.get("data")
    except Exception as exc:
        log.warning("x resolve failed for %s: %s", username, exc)
        return None


def x_fetch_user_tweets(username: str, max_results: int = 20) -> list[Candidate]:
    user = x_resolve_user(username)
    if not user:
        return []
    user_id = user["id"]
    url = (
        f"{X_API}/users/{user_id}/tweets"
        f"?max_results={max_results}"
        "&exclude=replies,retweets"
        "&tweet.fields=created_at,attachments,entities"
        "&expansions=attachments.media_keys"
        "&media.fields=url,preview_image_url,type"
    )
    try:
        data = http_json(url, headers=x_headers())
    except Exception as exc:
        log.warning("x tweets failed for %s: %s", username, exc)
        return []
    media_by_key: dict[str, dict[str, Any]] = {}
    for m in (data.get("includes") or {}).get("media", []) or []:
        media_by_key[m["media_key"]] = m
    candidates: list[Candidate] = []
    for tweet in data.get("data", []) or []:
        tid = tweet["id"]
        web_url = f"https://x.com/{username}/status/{tid}"
        images: list[str] = []
        for key in (tweet.get("attachments") or {}).get("media_keys", []) or []:
            m = media_by_key.get(key, {})
            url_field = m.get("url") or m.get("preview_image_url")
            if url_field:
                images.append(url_field)
        candidates.append(
            Candidate(
                url=web_url,
                platform="x",
                author_handle=username,
                author_name=user.get("name") or username,
                text=tweet.get("text", ""),
                created_at=tweet.get("created_at", ""),
                image_urls=images,
                avatar_url=user.get("profile_image_url"),
            )
        )
    return candidates


# ---------------------------------------------------------------------------
# Filtering + dedup
# ---------------------------------------------------------------------------

def filter_candidates(
    candidates: list[Candidate],
    state: dict[str, Any],
    window_start: datetime,
) -> list[Candidate]:
    posted = state.get("posted_urls", {})
    out: list[Candidate] = []
    for c in candidates:
        if c.url in posted:
            continue
        if not c.created_at:
            continue
        try:
            created = datetime.fromisoformat(c.created_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if created < window_start:
            continue
        if not c.text.strip() and not c.image_urls:
            continue
        out.append(c)
    return out


# ---------------------------------------------------------------------------
# Rate limit check
# ---------------------------------------------------------------------------

def rate_limit_remaining(state: dict[str, Any], rate_cfg: dict[str, int], now: datetime) -> int:
    window = timedelta(minutes=rate_cfg["window_minutes"])
    recent = []
    for entry in state.get("publish_log", []):
        try:
            ts = datetime.fromisoformat(entry["published_at"])
        except (KeyError, ValueError):
            continue
        if now - ts <= window:
            recent.append(entry)
    return max(0, rate_cfg["max_posts"] - len(recent))


# ---------------------------------------------------------------------------
# Claude curation
# ---------------------------------------------------------------------------

def curate_with_claude(candidates: list[Candidate], curation_prompt: str) -> list[dict[str, Any]]:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    posts_block = "\n\n".join(
        f"POST {i+1}\nurl: {c.url}\nauthor: {c.author_name} (@{c.author_handle}) on {c.platform}\ncreated: {c.created_at}\nimages: {len(c.image_urls)}\ntext: {c.text}"
        for i, c in enumerate(candidates)
    )
    user_msg = (
        f"{curation_prompt}\n\n"
        f"Here are the new candidate posts:\n\n{posts_block}\n\n"
        'Return ONLY valid JSON with this exact shape: {"rankings": [{"url": "...", "include": true, "score": 0-10, "reason": "..."}]}'
        " -- include an entry for every post."
    )
    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 2000,
        "messages": [{"role": "user", "content": user_msg}],
    }
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    status, raw = http_request(
        "https://api.anthropic.com/v1/messages",
        method="POST",
        headers=headers,
        body=body,
        timeout=60,
    )
    if status >= 400:
        raise RuntimeError(f"Claude API {status}: {raw[:500].decode('utf-8', 'replace')}")
    data = json.loads(raw.decode("utf-8"))
    text_out = "".join(
        block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"
    )
    # Extract JSON object
    start = text_out.find("{")
    end = text_out.rfind("}")
    if start == -1 or end == -1:
        raise RuntimeError(f"Claude returned non-JSON: {text_out[:300]}")
    parsed = json.loads(text_out[start : end + 1])
    return parsed.get("rankings", [])


# ---------------------------------------------------------------------------
# Publishing via tchop GraphQL
# ---------------------------------------------------------------------------

# storyCardParseUrl: given a Bluesky/X/IG post URL, tchop's backend parses it
# and downloads any referenced media into its own file service. The returned
# integer image IDs can be passed straight into storyCardPostInStory.gallery.
# This is the only path that attaches images on production (the REST
# /api/fs/upload/* endpoint rejects API-client tokens).
STORY_CARD_PARSE_IMAGE_MUTATION = """
mutation StoryCardParseUrl($input: StoryCardParseUrlInput!) {
  storyCardParseUrl(input: $input) {
    payload {
      __typename
      ... on StoryCardImageParsedUrl {
        gallery { image { id } }
      }
    }
  }
}
"""

STORY_CARD_PARSE_URL_MUTATION = """
mutation StoryCardParseUrl($input: StoryCardParseUrlInput!) {
  storyCardParseUrl(input: $input) {
    payload {
      __typename
      ... on StoryCardQuoteParsedUrl {
        type
        quote
        quoteCreated
        quotePerson
        quotePersonHandle
        quoteSource
        quotePersonImage { id }
        gallery { image { id } }
      }
    }
  }
}
"""

PUSH_NOTIFICATION_MUTATION = """
mutation PushNotificationChannelCreate($input: PushNotificationChannelCreateInput!) {
  pushNotificationChannelCreate(input: $input) {
    ... on PushNotificationChannelCreateResult {
      __typename
      error {
        ... on GraphqlAppErrorInterface { message }
        ... on ChannelReadOnlyAccessError { message }
        ... on StoryCardNotFoundError { message }
        ... on StoryNotFoundError { message }
        ... on UnknownError { message }
      }
    }
  }
}
"""

STORY_CARD_UPDATE_STATUS_MUTATION = """
mutation StoryCardUpdate($input: StoryCardUpdateInput!) {
  storyCardUpdate(input: $input) {
    payload { id }
    error {
      __typename
      ... on UnknownError { message }
    }
  }
}
"""

STORY_CARD_POST_MUTATION = """
mutation StoryCardPostInStory($input: StoryCardPostInStoryInput!) {
  storyCardPostInStory(input: $input) {
    payload { id type storyId }
    error {
      __typename
      ... on StoryCardPostContentValidationError { message }
      ... on StoryCardUrlUniquenessConflictError { message }
      ... on StoryCardValidationError { details { message path type } }
      ... on UnknownError { message }
    }
  }
}
"""


def tchop_headers() -> dict[str, str]:
    org = os.environ.get("TCHOP_ORG", "")
    token = os.environ.get("TCHOP_AUTH_TOKEN", "")
    client_id = os.environ.get("TCHOP_API_CLIENT_ID", "")
    if not org or not token:
        raise RuntimeError("TCHOP_ORG and TCHOP_AUTH_TOKEN must be set")
    headers = {
        "Content-Type": "application/json",
        "x-tchop-webapp-organisation": org,
        "x-tchop-auth-token": token,
    }
    if client_id:
        headers["x-tchop-api-client-id"] = client_id
    return headers


def tchop_graphql(api_url: str, query: str, variables: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    status, raw = http_request(api_url, method="POST", headers=tchop_headers(), body=body, timeout=30)
    if status >= 400:
        raise RuntimeError(f"tchop HTTP {status}: {raw[:500].decode('utf-8', 'replace')}")
    data = json.loads(raw.decode("utf-8"))
    if data.get("errors"):
        raise RuntimeError(f"tchop GraphQL errors: {data['errors']}")
    return data["data"]


def publish_candidate(candidate: Candidate, mix_id: int, api_url: str, published: bool) -> dict[str, Any]:
    """Parse the post URL via tchop, then post the card with the returned image IDs.

    The two-step chain is required because /api/fs/upload/* rejects API tokens
    on production; letting the backend parse the URL is the sanctioned path
    for pulling in post text, avatar, and gallery images.
    """
    platform_src = {"bsky": "BSKY", "x": "X"}.get(candidate.platform, "X")

    # Step 1: parse the URL server-side
    parse_data = tchop_graphql(
        api_url,
        STORY_CARD_PARSE_URL_MUTATION,
        {"input": {"url": candidate.url}},
    )
    parsed = (parse_data.get("storyCardParseUrl") or {}).get("payload") or {}
    if parsed.get("__typename") != "StoryCardQuoteParsedUrl":
        raise RuntimeError(
            f"parseUrl returned {parsed.get('__typename')!r} for {candidate.url} -- expected StoryCardQuoteParsedUrl"
        )

    gallery_input: list[dict[str, Any]] = []
    for g in parsed.get("gallery") or []:
        img_id = ((g or {}).get("image") or {}).get("id")
        if img_id is not None:
            gallery_input.append({"image": {"id": img_id}})

    quote_input: dict[str, Any] = {
        "url": candidate.url,
        # Prefer fetched values, fall back to what we scraped client-side.
        "quotePerson": parsed.get("quotePerson") or candidate.author_name,
        "quotePersonHandle": parsed.get("quotePersonHandle") or candidate.author_handle,
        "quoteCreated": parsed.get("quoteCreated") or candidate.created_at or datetime.now(timezone.utc).isoformat(),
        "quoteSource": platform_src,
        "headline": "",
        "quote": parsed.get("quote") or candidate.text,
        "gallery": gallery_input,
    }
    avatar = parsed.get("quotePersonImage") or {}
    if avatar.get("id") is not None:
        quote_input["quotePersonImageId"] = avatar["id"]

    input_payload = {
        "storyId": mix_id,
        "fields": {
            "quoteFields": quote_input,
            "status": "PUBLISHED" if published else "DRAFTED",
        },
    }

    # Step 2: create the card
    post_data = tchop_graphql(
        api_url,
        STORY_CARD_POST_MUTATION,
        {"input": input_payload},
    )
    mutation = post_data["storyCardPostInStory"]
    if mutation.get("error"):
        raise RuntimeError(f"tchop mutation error: {mutation['error']}")
    payload = mutation["payload"] or {}
    payload["_image_count"] = len(gallery_input)
    return payload


# ---------------------------------------------------------------------------
# Push notifications
# ---------------------------------------------------------------------------

def send_push(api_url: str, channel_id: int, title: str, message: str, url: str | None = None) -> bool:
    """Send a push notification to all users of a channel. Returns True on success."""
    fields: dict[str, Any] = {"title": title, "message": message}
    if url:
        fields["url"] = url
    try:
        data = tchop_graphql(api_url, PUSH_NOTIFICATION_MUTATION, {"input": {"channelId": channel_id, "fields": fields}})
        result = data.get("pushNotificationChannelCreate") or {}
        err = result.get("error")
        if err:
            log.error("Push failed: %s", err.get("message", err))
            return False
        log.info("Push sent to channel %d: %s", channel_id, title)
        return True
    except Exception as exc:
        log.error("Push send error: %s", exc)
        return False


def card_deep_link(org: str, channel_id: int, story_id: int, card_id: int) -> str:
    """Build a tchop deep link URL that opens a specific card in the app."""
    return f"https://{org}.tchop.io/apps/posts/{channel_id}/{story_id}/{card_id}"


# ---------------------------------------------------------------------------
# Lineup detection
# ---------------------------------------------------------------------------

def detect_and_publish_lineup(
    candidates: list[Candidate],
    config: dict[str, Any],
    state: dict[str, Any],
    api_url: str,
) -> list[Candidate]:
    """Check candidates for lineup posts from the trigger account.

    If found: publish to the mix immediately (always published, bypasses
    auto_publish setting), send a push notification with a deep link to
    the card, and remove from the candidate list so regular curation
    doesn't re-process it.

    Returns the remaining candidates with lineup posts removed.
    """
    lineup_cfg = config.get("lineup")
    if not lineup_cfg:
        return candidates

    trigger = lineup_cfg["trigger_account"].lower()
    keywords = [kw.lower() for kw in lineup_cfg["keywords"]]
    exclude_keywords = [kw.lower() for kw in lineup_cfg.get("exclude_keywords", [])]
    push_channel_id = lineup_cfg["push_channel_id"]
    mix_id = lineup_cfg.get("push_mix_id", config["tchop"]["mix_id"])
    org = config["tchop"]["org"]

    remaining: list[Candidate] = []
    for cand in candidates:
        if cand.author_handle.lower() != trigger:
            remaining.append(cand)
            continue

        text_lower = cand.text.lower()
        if not any(kw in text_lower for kw in keywords):
            remaining.append(cand)
            continue
        if any(kw in text_lower for kw in exclude_keywords):
            remaining.append(cand)
            continue

        # Already processed?
        if cand.url in state.get("posted_urls", {}):
            continue

        log.info("Lineup detected from @%s: %s", cand.author_handle, cand.url)

        # Extract title and message from post text.
        # Strip hashtags, URLs, and empty lines. Keep meaningful content lines.
        lines = [
            l.strip() for l in cand.text.split("\n")
            if l.strip()
            and not l.strip().startswith("#")
            and not l.strip().startswith("http")
            and not l.strip().startswith("@")
        ]
        # First content line = push title, second = push message.
        # If only one line, use it for both.
        push_title = lines[0] if lines else "Aufstellung"
        push_message = lines[1] if len(lines) > 1 else push_title
        # Trim to reasonable push length
        if len(push_title) > 60:
            push_title = push_title[:57] + "..."
        if len(push_message) > 120:
            push_message = push_message[:117] + "..."

        try:
            # Publish card (always published, not drafted)
            payload = publish_candidate(cand, mix_id, api_url, published=True)
            card_id = payload.get("id")
            img_count = payload.get("_image_count", 0)
            log.info("Lineup card PUBLISHED (id=%s, images=%d): %s", card_id, img_count, cand.url)

            # Record in state
            now_iso = datetime.now(timezone.utc).isoformat()
            state["posted_urls"][cand.url] = now_iso
            state.setdefault("publish_log", []).append({
                "url": cand.url,
                "published_at": now_iso,
                "score": 10,
                "reason": "Lineup post (auto-detected)",
                "mode": "PUBLISHED",
                "card_id": card_id,
            })

            # Send push notification with deep link to the card
            if card_id:
                deep_link = card_deep_link(org, push_channel_id, mix_id, card_id)
                send_push(api_url, push_channel_id, push_title, push_message, url=deep_link)
            else:
                log.warning("No card_id returned -- push skipped")

        except Exception as exc:
            log.error("Lineup publish/push failed for %s: %s", cand.url, exc)

    return remaining


# ---------------------------------------------------------------------------
# Fanradio livestream card + push
# ---------------------------------------------------------------------------

import re as _re


def scrape_fanradio(url: str) -> dict[str, str | None]:
    """Scrape the fanradio livestream page for match info.

    Returns dict with keys: spieltag, reporters, image_url.
    All values may be None if not found.
    """
    try:
        status, body = http_request(url, timeout=15)
        if status >= 400:
            log.warning("fanradio scrape HTTP %d", status)
            return {"spieltag": None, "reporters": None, "image_url": None}
        html = body.decode("utf-8", "replace")
    except Exception as exc:
        log.warning("fanradio scrape failed: %s", exc)
        return {"spieltag": None, "reporters": None, "image_url": None}

    # Extract Spieltag (e.g. "29. Spieltag")
    spieltag = None
    m = _re.search(r"(\d+)\.\s*Spieltag", html, _re.IGNORECASE)
    if m:
        spieltag = f"{m.group(1)}. Spieltag"

    # Extract reporter names -- look for "Reporter:" or similar
    reporters = None
    m = _re.search(r"Reporter[:\s]+([^<]+)", html, _re.IGNORECASE)
    if m:
        reporters = m.group(1).strip()
        # Clean up HTML entities
        reporters = reporters.replace("&amp;", "&").replace("&#038;", "&")
        # Trim trailing whitespace or stray tags
        reporters = _re.sub(r"<.*", "", reporters).strip()

    # Extract match image from wp-content/uploads (skip logos and static images)
    image_url = None
    for img_url in _re.findall(r'src=["\']([^"\']*wp-content/uploads/\d{4}/\d{2}/[^"\']+)["\']', html):
        # Skip known static images
        if any(skip in img_url.lower() for skip in ["logo", "livestream.png", "fufa.jpg", "fanradio"]):
            continue
        image_url = img_url
        break

    return {"spieltag": spieltag, "reporters": reporters, "image_url": image_url}


def build_match_title(match: dict[str, Any]) -> str:
    """Build match title like 'SV Darmstadt 98 - Hannover 96'."""
    opponent = match.get("opponent", "")
    if match.get("home", True):
        return f"SV Darmstadt 98 - {opponent}"
    return f"{opponent} - SV Darmstadt 98"


def publish_fanradio_card(
    config: dict[str, Any],
    match: dict[str, Any],
    state: dict[str, Any],
    api_url: str,
) -> int | None:
    """Publish the fanradio article card. Returns card_id or None."""
    fanradio_cfg = config.get("fanradio")
    if not fanradio_cfg:
        return None

    state_key = "fanradio_card_published"
    if state.get(state_key):
        log.info("Fanradio card already published this match window")
        return state.get("fanradio_card_id")

    url = fanradio_cfg["url"]
    story_id = fanradio_cfg["story_id"]
    source_name = fanradio_cfg["source_name"]

    # Scrape match info
    info = scrape_fanradio(url)
    title = build_match_title(match)
    parts = []
    if info["spieltag"]:
        parts.append(info["spieltag"])
    if info["reporters"]:
        parts.append(f"Reporter: {info['reporters']}")
    abstract = ", ".join(parts) if parts else ""

    # Get image ID via parseUrl if available
    gallery: list[dict[str, Any]] = []
    if info["image_url"]:
        try:
            parse_data = tchop_graphql(
                api_url,
                STORY_CARD_PARSE_IMAGE_MUTATION,
                {"input": {"url": info["image_url"]}},
            )
            parsed = (parse_data.get("storyCardParseUrl") or {}).get("payload") or {}
            for g in parsed.get("gallery") or []:
                img_id = ((g or {}).get("image") or {}).get("id")
                if img_id is not None:
                    gallery.append({"image": {"id": img_id}})
        except Exception as exc:
            log.warning("Fanradio image parse failed: %s", exc)

    # Create article card
    input_payload = {
        "storyId": story_id,
        "fields": {
            "articleFields": {
                "url": url,
                "title": title,
                "abstract": abstract,
                "sourceName": source_name,
                "headline": "",
                "gallery": gallery,
                "styles": {"teaserImageStyle": "BIG_WITHOUT_TEXT"},
            },
            "status": "PUBLISHED",
        },
    }

    try:
        post_data = tchop_graphql(api_url, STORY_CARD_POST_MUTATION, {"input": input_payload})
        mutation = post_data["storyCardPostInStory"]
        if mutation.get("error"):
            log.error("Fanradio card error: %s", mutation["error"])
            return None
        card_id = (mutation.get("payload") or {}).get("id")
        log.info("Fanradio card PUBLISHED (id=%s): %s", card_id, title)
        state[state_key] = True
        state["fanradio_card_id"] = card_id
        return card_id
    except Exception as exc:
        log.error("Fanradio card publish failed: %s", exc)
        return None


def send_fanradio_push(
    config: dict[str, Any],
    match: dict[str, Any],
    api_url: str,
) -> bool:
    """Send the fanradio push notification."""
    fanradio_cfg = config.get("fanradio")
    if not fanradio_cfg:
        return False

    push_title = fanradio_cfg["push_title"]
    push_message = build_match_title(match)
    push_channel_id = fanradio_cfg["push_channel_id"]
    livestream_url = fanradio_cfg["url"]

    return send_push(api_url, push_channel_id, push_title, push_message, url=livestream_url)


def check_fanradio(
    config: dict[str, Any],
    match: dict[str, Any],
    state: dict[str, Any],
    now: datetime,
) -> None:
    """Check if it's time to publish the fanradio card and/or send the push.

    Card: published card_minutes_before_kickoff before kickoff.
    Push: sent push_minutes_before_kickoff before kickoff.
    """
    fanradio_cfg = config.get("fanradio")
    if not fanradio_cfg:
        return

    kickoff = datetime.fromisoformat(match["kickoff"])
    api_url = config["tchop"]["api_url"]
    card_time = kickoff - timedelta(minutes=fanradio_cfg["card_minutes_before_kickoff"])
    push_time = kickoff - timedelta(minutes=fanradio_cfg["push_minutes_before_kickoff"])

    # Publish card at T-10
    if now >= card_time and not state.get("fanradio_card_published"):
        publish_fanradio_card(config, match, state, api_url)

    # Send push at T-5
    if now >= push_time and not state.get("fanradio_push_sent"):
        send_fanradio_push(config, match, api_url)
        state["fanradio_push_sent"] = True
        log.info("Fanradio push sent")


# ---------------------------------------------------------------------------
# Matchday morning announcement
# ---------------------------------------------------------------------------

def is_matchday(matches: list[dict[str, Any]], now: datetime) -> dict[str, Any] | None:
    """Return the match if today (UTC date) is a matchday."""
    today = now.date()
    for match in matches:
        kickoff = datetime.fromisoformat(match["kickoff"])
        if kickoff.date() == today:
            return match
    return None


def publish_gegner_check(
    config: dict[str, Any],
    match: dict[str, Any],
    state: dict[str, Any],
    now: datetime,
) -> bool:
    """Publish the pre-drafted Gegner-Check card and send a push linking to it.

    At 9 AM CET (7 UTC in summer) on matchday:
    1. Flip the Gegner-Check card from DRAFT to PUBLISHED
    2. Send push: "MATCHDAY: {opponent}" / "Der Gegner-Check!"

    Requires gegner_check_card_id and gegner_check_story_id in matches.json.
    Returns True if published, False otherwise.
    """
    if state.get("gegner_check_published"):
        return False

    morning_cfg = config.get("matchday_morning")
    if not morning_cfg:
        return False

    hour_from = morning_cfg["check_from_hour_utc"]
    hour_to = morning_cfg["check_to_hour_utc"]
    if not (hour_from <= now.hour < hour_to):
        return False

    gegner_check_id = match.get("gegner_check_card_id")
    gegner_check_story = match.get("gegner_check_story_id")
    if not gegner_check_id or not gegner_check_story:
        log.info("No Gegner-Check card configured in matches.json -- skipping")
        return False

    api_url = config["tchop"]["api_url"]
    org = config["tchop"]["org"]
    push_channel_id = morning_cfg["push_channel_id"]
    opponent = match.get("opponent", "")

    # Step 1: Publish the draft card
    try:
        update_data = tchop_graphql(
            api_url,
            STORY_CARD_UPDATE_STATUS_MUTATION,
            {"input": {"storyId": gegner_check_story, "storyCardId": gegner_check_id, "fields": {"status": "PUBLISHED"}}},
        )
        mutation = update_data.get("storyCardUpdate") or {}
        if mutation.get("error"):
            log.error("Gegner-Check publish failed: %s", mutation["error"])
            return False
        log.info("Gegner-Check card %d PUBLISHED in story %d", gegner_check_id, gegner_check_story)
    except Exception as exc:
        log.error("Gegner-Check publish error: %s", exc)
        return False

    # Step 2: Send push
    push_title = f"MATCHDAY: {opponent} \u269c\ufe0f"
    push_message = "Der Gegner-Check!"
    deep_link = card_deep_link(org, push_channel_id, gegner_check_story, gegner_check_id)
    send_push(api_url, push_channel_id, push_title, push_message, url=deep_link)

    state["gegner_check_published"] = True
    return True


def check_matchday_morning(
    config: dict[str, Any],
    match: dict[str, Any],
    state: dict[str, Any],
    now: datetime,
) -> bool:
    """Check for a MATCHDAY announcement post from SVDNews_ and publish it.

    No push is sent for the MATCHDAY social card -- the push goes to the
    Gegner-Check instead (handled by publish_gegner_check).
    Returns True if a post was found and published, False otherwise.
    """
    morning_cfg = config.get("matchday_morning")
    if not morning_cfg:
        return False

    hour_from = morning_cfg["check_from_hour_utc"]
    hour_to = morning_cfg["check_to_hour_utc"]
    if not (hour_from <= now.hour < hour_to):
        return False

    trigger = morning_cfg["trigger_account"]
    keywords = [kw.lower() for kw in morning_cfg["keywords"]]
    mix_id = morning_cfg.get("push_mix_id", config["tchop"]["mix_id"])
    api_url = config["tchop"]["api_url"]

    if not os.environ.get("X_BEARER_TOKEN"):
        log.warning("X_BEARER_TOKEN not set -- cannot check matchday morning post")
        return False

    candidates = x_fetch_user_tweets(trigger, max_results=10)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    for cand in candidates:
        try:
            created = datetime.fromisoformat(cand.created_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if created < today_start:
            continue

        text_lower = cand.text.lower()
        if not any(kw in text_lower for kw in keywords):
            continue

        if cand.url in state.get("posted_urls", {}):
            log.info("Matchday morning post already processed: %s", cand.url)
            return False

        log.info("Matchday morning post detected: %s", cand.url)

        try:
            payload = publish_candidate(cand, mix_id, api_url, published=True)
            card_id = payload.get("id")
            img_count = payload.get("_image_count", 0)
            log.info("Matchday morning card PUBLISHED (id=%s, images=%d)", card_id, img_count)

            now_iso = now.isoformat()
            state["posted_urls"][cand.url] = now_iso
            state.setdefault("publish_log", []).append({
                "url": cand.url,
                "published_at": now_iso,
                "score": 10,
                "reason": "Matchday morning announcement (auto-detected)",
                "mode": "PUBLISHED",
                "card_id": card_id,
            })
            return True
        except Exception as exc:
            log.error("Matchday morning publish failed: %s", exc)
            return False

    return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    load_env()
    config = load_json(CONFIG_PATH)
    matches = load_json(MATCHES_PATH)["matches"]
    state = load_json(STATE_PATH) if STATE_PATH.exists() else {"posted_urls": {}, "publish_log": []}

    now = datetime.now(timezone.utc)

    # Matchday morning check: runs before the match window on matchdays.
    # Looks for the "MATCHDAY" announcement post from SVDNews_.
    today_match = is_matchday(matches, now)
    if today_match:
        # Publish Gegner-Check at 9 AM and send the push
        if publish_gegner_check(config, today_match, state, now):
            save_json(STATE_PATH, state)
        # Post the MATCHDAY social card (no push -- push goes to Gegner-Check)
        if check_matchday_morning(config, today_match, state, now):
            save_json(STATE_PATH, state)

    match = in_match_window(matches, config["match_window"], now)
    extended_match = None
    is_extended = False
    if not match:
        extended_match = in_extended_window(
            matches, config["match_window"], config.get("post_match_extended"), now
        )
        if not extended_match:
            log.info("Outside match window -- exiting.")
            return 0
        # In extended window: throttle to configured interval
        ext_cfg = config["post_match_extended"]
        interval = timedelta(minutes=ext_cfg["check_interval_minutes"])
        last_ext = state.get("last_extended_run")
        if last_ext:
            last_ext_dt = datetime.fromisoformat(last_ext)
            if now - last_ext_dt < interval:
                log.info("Extended window: next run in %d min -- skipping.",
                         int((interval - (now - last_ext_dt)).total_seconds() / 60))
                return 0
        match = extended_match
        is_extended = True
        log.info("In extended post-match window (every %d min)", ext_cfg["check_interval_minutes"])

    kickoff = datetime.fromisoformat(match["kickoff"])
    window_start = kickoff - timedelta(minutes=config["match_window"]["minutes_before_kickoff"])
    log.info("%s match window for %s (kickoff %s)",
             "Extended" if is_extended else "In",
             match.get("opponent", "?"), match["kickoff"])

    # Fanradio: publish card at T-10, send push at T-5
    check_fanradio(config, match, state, now)
    save_json(STATE_PATH, state)

    remaining_slots = rate_limit_remaining(state, config["rate_limit"], now)
    if remaining_slots <= 0:
        log.info("Rate limit reached (%d per %d min) -- exiting.", config["rate_limit"]["max_posts"], config["rate_limit"]["window_minutes"])
        return 0
    log.info("Rate limit: %d slot(s) available", remaining_slots)

    # Fetch from both platforms
    all_candidates: list[Candidate] = []
    for handle in config["accounts"]["bluesky"]:
        all_candidates.extend(bsky_fetch_author_feed(handle))
    if os.environ.get("X_BEARER_TOKEN"):
        for username in config["accounts"]["x"]:
            all_candidates.extend(x_fetch_user_tweets(username))
    else:
        log.warning("X_BEARER_TOKEN not set -- skipping X fetch")
    log.info("Fetched %d total posts", len(all_candidates))

    new_candidates = filter_candidates(all_candidates, state, window_start)
    log.info("%d new in-window candidates after dedup", len(new_candidates))
    if not new_candidates:
        save_json(STATE_PATH, state)
        return 0

    # Lineup detection: check for lineup posts, publish + push immediately,
    # remove from candidate list so Claude doesn't re-process them.
    api_url = config["tchop"]["api_url"]
    new_candidates = detect_and_publish_lineup(new_candidates, config, state, api_url)
    if not new_candidates:
        save_json(STATE_PATH, state)
        log.info("Only lineup post(s) found -- done.")
        return 0

    # Cap candidates sent to Claude
    max_cands = config["publishing"]["max_candidates_per_run"]
    if len(new_candidates) > max_cands:
        new_candidates = sorted(new_candidates, key=lambda c: c.created_at, reverse=True)[:max_cands]

    rankings = curate_with_claude(new_candidates, config["curation_prompt"])
    by_url = {c.url: c for c in new_candidates}
    picks = sorted(
        [r for r in rankings if r.get("include") and r.get("url") in by_url],
        key=lambda r: r.get("score", 0),
        reverse=True,
    )
    log.info("Claude included %d of %d", len(picks), len(rankings))

    published_count = 0
    for r in picks[:remaining_slots]:
        cand = by_url[r["url"]]
        try:
            published = config["publishing"]["auto_publish"]
            payload = publish_candidate(
                cand,
                config["tchop"]["mix_id"],
                config["tchop"]["api_url"],
                published=published,
            )
            mode = "PUBLISHED" if published else "DRAFTED"
            img_count = payload.get("_image_count", 0)
            log.info(
                "%s %s (score=%s, images=%d): %s",
                mode, cand.author_handle, r.get("score"), img_count, cand.url,
            )
            state["posted_urls"][cand.url] = now.isoformat()
            state.setdefault("publish_log", []).append(
                {
                    "url": cand.url,
                    "published_at": now.isoformat(),
                    "score": r.get("score"),
                    "reason": r.get("reason"),
                    "mode": mode,
                    "card_id": payload.get("id"),
                }
            )
            published_count += 1
        except Exception as exc:
            log.error("Publish failed for %s: %s", cand.url, exc)

    # Prune state: keep posted_urls from last 14 days, publish_log from last 24h
    cutoff_urls = now - timedelta(days=14)
    state["posted_urls"] = {
        u: ts for u, ts in state["posted_urls"].items()
        if datetime.fromisoformat(ts) > cutoff_urls
    }
    cutoff_log = now - timedelta(hours=24)
    state["publish_log"] = [
        e for e in state["publish_log"]
        if datetime.fromisoformat(e["published_at"]) > cutoff_log
    ]

    # Record extended run timestamp for throttling
    if is_extended:
        state["last_extended_run"] = now.isoformat()

    save_json(STATE_PATH, state)
    log.info("Done. Published %d card(s).", published_count)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        log.exception("Fatal error: %s", exc)
        sys.exit(1)
