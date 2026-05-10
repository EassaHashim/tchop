#!/usr/bin/env python3
"""
build-de-inventory.py — Build content-inventory-de.md for tchop.io German content

Run this locally from the claude-config repo root:
    python3 .claude/skills/blog-input-create/scripts/build-de-inventory.py

What it does:
1. Pulls sitemaps from tchop.io and blog.tchop.io
2. Filters to /de/ URLs only
3. Fetches each blog post and extracts: title, word count, H2 headings, first paragraph
4. Writes .claude/context/content-inventory-de.md in the same format as the EN inventory
5. Writes a shortlist.md with the top 15 candidate posts ranked by likely quality
   (for picking native German writing samples to add to tone-and-voice-de.md)

Safe to re-run: caches fetched HTML in /tmp/tchop-de-cache to avoid re-downloading.

Dependencies: Python 3.8+ stdlib only. No pip install needed.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

# ─── Config ──────────────────────────────────────────────────────────
SITEMAP_CANDIDATES = [
    "https://tchop.io/sitemap.xml",
    "https://tchop.io/sitemap_index.xml",
    "https://blog.tchop.io/sitemap.xml",
    "https://blog.tchop.io/wp-sitemap.xml",
    "https://blog.tchop.io/sitemap_index.xml",
]

CACHE_DIR = Path("/tmp/tchop-de-cache")
OUTPUT_INVENTORY = Path(".claude/context/content-inventory-de.md")
OUTPUT_SHORTLIST = Path(".claude/skills/blog-input-create/scripts/de-samples-shortlist.md")

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

REQUEST_DELAY_SEC = 0.3  # be polite to the server
MAX_BLOG_POSTS_TO_FETCH = 250  # safety cap
TOP_SHORTLIST_SIZE = 15

# ─── Progress helpers ────────────────────────────────────────────────
def log(msg: str) -> None:
    print(f"[inventory] {msg}", file=sys.stderr, flush=True)


# ─── Fetch with cache ────────────────────────────────────────────────
def fetch(url: str, *, use_cache: bool = True) -> str | None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    # Cache key = url with / and : replaced
    safe = re.sub(r"[^a-zA-Z0-9]+", "_", url).strip("_")[:200]
    cache_file = CACHE_DIR / f"{safe}.html"

    if use_cache and cache_file.exists() and cache_file.stat().st_size > 0:
        return cache_file.read_text(encoding="utf-8", errors="replace")

    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        log(f"HTTP {e.code} for {url}")
        return None
    except Exception as e:
        log(f"FAIL for {url}: {e}")
        return None

    cache_file.write_text(body, encoding="utf-8")
    time.sleep(REQUEST_DELAY_SEC)
    return body


# ─── Sitemap parsing ─────────────────────────────────────────────────
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def extract_urls_from_sitemap(xml_text: str) -> list[str]:
    """Return all <loc> URLs, whether this is a sitemap or a sitemap index."""
    urls: list[str] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        log(f"sitemap parse error: {e}")
        return urls

    tag = root.tag.lower()
    # Handle both sitemap and sitemapindex
    for loc in root.iter():
        if loc.tag.endswith("}loc") or loc.tag == "loc":
            if loc.text:
                urls.append(loc.text.strip())
    return urls


def discover_all_urls() -> list[str]:
    """Walk all sitemap candidates (and any nested sitemapindex) to collect URLs."""
    seen: set[str] = set()
    collected: list[str] = []
    queue: list[str] = list(SITEMAP_CANDIDATES)

    while queue:
        sm_url = queue.pop(0)
        if sm_url in seen:
            continue
        seen.add(sm_url)

        body = fetch(sm_url)
        if not body:
            continue
        log(f"parsed sitemap: {sm_url}")

        for u in extract_urls_from_sitemap(body):
            # If this is a nested sitemap, enqueue it. Otherwise treat as content URL.
            if u.endswith(".xml"):
                if u not in seen:
                    queue.append(u)
            else:
                if u not in collected:
                    collected.append(u)

    return collected


# ─── URL filtering ───────────────────────────────────────────────────
def is_de_url(url: str) -> bool:
    """Match any /de/ URL on tchop.io or blog.tchop.io."""
    return "/de/" in url or url.endswith("/de")


def url_category(url: str) -> str:
    """Rough bucketing to match the EN inventory structure."""
    u = url.lower()
    if u.rstrip("/").endswith("tchop.io/de"):
        return "homepage"
    if "/blog.tchop.io/de/" in u and "/category/" in u:
        return "blog-category"
    if "/blog.tchop.io/de/" in u:
        return "blog-post"
    if "/company/" in u:
        return "company"
    if "/platform/" in u:
        return "platform"
    if "/solutions/use-cases/" in u:
        return "solutions-use-case"
    if "/solutions/perfect-for/" in u:
        return "solutions-perfect-for"
    if "/solutions/functions/" in u:
        return "solutions-function"
    if "/resources/customer-success/" in u:
        return "case-study"
    if "/resources/" in u:
        return "resource"
    if "/glossary/" in u:
        return "glossary"
    return "other"


# ─── Blog post extraction ───────────────────────────────────────────
@dataclass
class BlogPost:
    url: str
    title: str = ""
    word_count: int = 0
    heading_count: int = 0
    first_paragraph: str = ""
    year: str = ""
    quality_score: float = 0.0


TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.DOTALL | re.IGNORECASE)
H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.DOTALL | re.IGNORECASE)
H2_RE = re.compile(r"<h2[^>]*>(.*?)</h2>", re.DOTALL | re.IGNORECASE)
P_RE = re.compile(r"<p[^>]*>(.*?)</p>", re.DOTALL | re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")
YEAR_RE = re.compile(r'(?:datetime|datePublished)["\']?\s*[:=]\s*["\']?(\d{4})')


def strip_tags(text: str) -> str:
    text = TAG_RE.sub("", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def extract_post_metadata(url: str, body: str) -> BlogPost:
    p = BlogPost(url=url)

    # Title: prefer H1, fall back to <title>
    h1 = H1_RE.search(body)
    if h1:
        p.title = strip_tags(h1.group(1))
    else:
        t = TITLE_RE.search(body)
        if t:
            p.title = strip_tags(t.group(1))

    # Body paragraphs
    paragraphs = [strip_tags(p_text) for p_text in P_RE.findall(body)]
    paragraphs = [p_text for p_text in paragraphs if len(p_text) > 20]

    if paragraphs:
        p.first_paragraph = paragraphs[0][:400]

    # Word count across paragraphs
    full_text = " ".join(paragraphs)
    p.word_count = len(full_text.split())

    # Heading count
    p.heading_count = len(H2_RE.findall(body))

    # Year
    ym = YEAR_RE.search(body)
    if ym:
        p.year = ym.group(1)

    # Quality heuristic: longer posts with more structure score higher
    # word count ∈ [600, 2500] ideal; bonus for 3+ headings; penalty for < 400 words
    wc = p.word_count
    length_score = min(1.0, wc / 800) if wc < 800 else min(1.0, 1600 / max(wc, 1600))
    structure_score = min(1.0, p.heading_count / 4)
    short_penalty = 0.3 if wc < 400 else 1.0
    p.quality_score = round((length_score * 0.5 + structure_score * 0.5) * short_penalty, 3)

    return p


# ─── Inventory file rendering ────────────────────────────────────────
def render_inventory(urls: list[str], posts: dict[str, BlogPost]) -> str:
    buckets: dict[str, list[str]] = {}
    for u in urls:
        buckets.setdefault(url_category(u), []).append(u)

    out: list[str] = []
    out.append("# tchop.io — Content Inventory (German / Deutsch)")
    out.append("")
    out.append("Reference for content planning, SEO, copywriting, and cross-linking "
               "when writing German content. Companion to `content-inventory.md` "
               "which covers English pages.")
    out.append("")
    out.append(f"Source: sitemaps from tchop.io and blog.tchop.io. Generated by "
               f"`.claude/skills/blog-input-create/scripts/build-de-inventory.py`.")
    out.append("")
    out.append("---")
    out.append("")

    label = {
        "homepage": "Homepage",
        "company": "Unternehmen / Company Pages",
        "platform": "Plattform / Platform Pages",
        "solutions-use-case": "Solutions — Use Cases",
        "solutions-perfect-for": "Solutions — Perfect For",
        "solutions-function": "Solutions — By Function",
        "case-study": "Case Studies / Kundenreferenzen",
        "resource": "Resources",
        "blog-category": "Blog Categories",
        "blog-post": "Blog Posts (blog.tchop.io/de)",
        "glossary": "Glossary",
        "other": "Other",
    }
    order = [
        "homepage", "company", "platform",
        "solutions-use-case", "solutions-perfect-for", "solutions-function",
        "case-study", "resource", "glossary", "blog-category",
        "blog-post", "other",
    ]

    for key in order:
        items = sorted(buckets.get(key, []))
        if not items:
            continue
        out.append(f"## {label[key]} ({len(items)})")
        out.append("")

        if key == "blog-post":
            out.append("| Title | URL | Year | Words | Headings |")
            out.append("|-------|-----|------|-------|----------|")
            enriched = [(u, posts.get(u)) for u in items]
            enriched.sort(key=lambda x: (x[1].year if x[1] else "", x[1].title if x[1] else ""), reverse=True)
            for u, p in enriched:
                if p is None or not p.title:
                    out.append(f"| _(not fetched)_ | `{u}` | — | — | — |")
                else:
                    title = p.title.replace("|", "\\|")
                    out.append(f"| {title} | `{u}` | {p.year or '—'} | {p.word_count} | {p.heading_count} |")
        else:
            out.append("| URL |")
            out.append("|-----|")
            for u in items:
                out.append(f"| `{u}` |")
        out.append("")

    out.append("---")
    out.append("")
    out.append(f"**Total DE URLs inventoried:** {len(urls)}")
    out.append(f"**Blog posts with fetched metadata:** "
               f"{sum(1 for p in posts.values() if p.title)}")
    return "\n".join(out) + "\n"


def render_shortlist(posts: dict[str, BlogPost]) -> str:
    ranked = [p for p in posts.values() if p.word_count >= 400 and p.title]
    ranked.sort(key=lambda p: p.quality_score, reverse=True)
    top = ranked[:TOP_SHORTLIST_SIZE]

    out: list[str] = []
    out.append("# DE Sample Candidates — Shortlist for tone-and-voice-de.md")
    out.append("")
    out.append(f"Top {len(top)} German blog posts ranked by length + structure heuristic. "
               "Review these and pick the ones you consider best native German voice. "
               "The selected paragraphs will become `## Writing samples` in "
               "`tone-and-voice-de.md` to mirror the EN sample section.")
    out.append("")
    out.append("| Rank | Score | Words | Headings | Year | Title | URL |")
    out.append("|------|-------|-------|----------|------|-------|-----|")
    for i, p in enumerate(top, 1):
        title = p.title.replace("|", "\\|")
        out.append(f"| {i} | {p.quality_score} | {p.word_count} | {p.heading_count} | "
                   f"{p.year or '—'} | {title} | `{p.url}` |")
    out.append("")
    out.append("## First paragraphs (quick preview)")
    out.append("")
    for i, p in enumerate(top, 1):
        out.append(f"### {i}. {p.title}")
        out.append(f"`{p.url}`")
        out.append("")
        out.append(f"> {p.first_paragraph}")
        out.append("")
    return "\n".join(out) + "\n"


# ─── Main ────────────────────────────────────────────────────────────
def main() -> int:
    log("discovering sitemaps...")
    all_urls = discover_all_urls()
    log(f"collected {len(all_urls)} total URLs from sitemaps")

    de_urls = sorted({u for u in all_urls if is_de_url(u)})
    log(f"filtered to {len(de_urls)} DE URLs")

    if not de_urls:
        log("ERROR: no DE URLs found. Check sitemap URLs and connectivity.")
        return 1

    blog_posts = [u for u in de_urls if url_category(u) == "blog-post"][:MAX_BLOG_POSTS_TO_FETCH]
    log(f"will fetch metadata for {len(blog_posts)} blog posts")

    posts: dict[str, BlogPost] = {}
    for i, u in enumerate(blog_posts, 1):
        if i % 10 == 0:
            log(f"  fetched {i}/{len(blog_posts)}")
        body = fetch(u)
        if body:
            posts[u] = extract_post_metadata(u, body)

    OUTPUT_INVENTORY.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_INVENTORY.write_text(render_inventory(de_urls, posts), encoding="utf-8")
    log(f"wrote {OUTPUT_INVENTORY}")

    OUTPUT_SHORTLIST.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_SHORTLIST.write_text(render_shortlist(posts), encoding="utf-8")
    log(f"wrote {OUTPUT_SHORTLIST}")

    log("done.")
    log(f"next: review {OUTPUT_SHORTLIST} and tell claude which posts to turn into samples")
    return 0


if __name__ == "__main__":
    sys.exit(main())
