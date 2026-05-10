---
name: linkedin-scout
description: >
  Find 10 LinkedIn posts worth commenting on for tchop.io thought leadership.
  Browses Sales Navigator lead list activity feeds via Chrome MCP to find fresh
  posts from curated leads, filters by keywords, drafts comments, and delivers
  to Slack. Falls back to WebSearch if Chrome is unavailable.
  Runs weekdays at 8am via scheduled-tasks.
metadata:
  version: 2.0.0
---

# LinkedIn Scout

You find high-value LinkedIn posts in tchop's market and deliver them to Slack
with draft comments. This runs unattended — never ask for user input.

---

## Lead Lists

Sales Navigator lead list URLs. The activity feed on each list shows recent
posts from curated leads. Add or remove URLs as needed.

```yaml
lead_lists:
  - url: "https://www.linkedin.com/sales/lists/people/7181701681737297921"
    name: "(EN) B2B Media & Publishing"
  - url: "https://www.linkedin.com/sales/lists/people/7239271490058162177"
    name: "(DE) Internal Comms"
  - url: "https://www.linkedin.com/sales/lists/people/7180520842127126528"
    name: "(EN) B2C Media & Publishing"
  - url: "https://www.linkedin.com/sales/search/people?savedSearchId=1963373417"
    name: "Search List Media Execs Int."
```
---

## Keywords

Edit this list to change what topics are searched and how Sales Nav posts are
filtered for relevance. One phrase per line.

```yaml
keywords:
  - community
  - user loyalty
  - user retention
  - owned media
  - memberships
  - employee app
  - news app
  - internal communications
  - employee engagement
  - social intranet
  - frontdoor intranet
  - AI newsroom
  - AI publishing
  - content curation
  - community-led growth
  - white-label app
  - mobile intranet
  - brand community
  - content hub
```

---

## Configuration

```yaml
slack_channel: "#linkedin-scout"
max_posts: 10
search_days: 7
source_mode: auto  # "chrome" | "websearch" | "auto"
```

- `auto` — try Chrome MCP first, fall back to WebSearch if unavailable
- `chrome` — Chrome MCP only, error if unavailable
- `websearch` — WebSearch only, skip Chrome MCP

---

## Phase 1 — Load Context

Read these files before doing anything else:

1. `/Users/heiko_scherer/claude-projects/.claude/context/brand.md` — product positioning, competitors, differentiators
2. `/Users/heiko_scherer/claude-projects/.claude/context/tone-and-voice.md` — writing guidelines, banned words
3. This skill file itself — parse the `lead_lists`, `keywords`, and `Configuration` blocks above

Extract from this file:
- The `lead_lists` array (URLs + names)
- The `keywords` array
- `slack_channel` (default: `#linkedin-scout`)
- `max_posts` (default: 10)
- `search_days` (default: 7)
- `source_mode` (default: `auto`)

---

## Phase 2A — Browse Sales Navigator (Primary)

Use Chrome MCP to browse Sales Navigator. Supports two URL types:

- **Lead lists** (`/sales/lists/people/...`) — converted to alerts view to show posts
- **Saved searches** (`/sales/search/people?savedSearchId=...`) — browse leads' activity

### Step 1: Check Chrome MCP availability

Call `mcp__Claude_in_Chrome__tabs_context_mcp` to verify the Chrome extension is
connected. If this fails, skip to Phase 2B.

### Step 2: Detect URL type and browse

For each URL in `lead_lists`, detect the type from the URL path:

#### Type A: Lead list (`/sales/lists/people/`)

1. Extract the list ID from the URL (the number at the end)
2. Convert to alerts view: `https://www.linkedin.com/sales/home?alertGroup=LEAD&listId=LIST_ID`
3. `mcp__Control_Chrome__open_url` — navigate to the alerts URL in a new tab
4. Wait 3 seconds for Sales Nav to load (heavy JS app)
5. `mcp__Claude_in_Chrome__computer` with `action: "screenshot"` — verify the page loaded. If a login wall is visible, skip to Phase 2B with a note.
6. Try structured extraction with `mcp__Claude_in_Chrome__javascript_tool`:
   ```js
   Array.from(document.querySelectorAll('[data-view-name="lead-activity-card"]')).map(card => ({
     author: card.querySelector('.artdeco-entity-lockup__title')?.textContent?.trim(),
     snippet: card.querySelector('.lead-activity-card__text')?.textContent?.trim(),
     timestamp: card.querySelector('time')?.textContent?.trim(),
     link: card.querySelector('a[href*="linkedin.com/feed/update"]')?.href
       || card.querySelector('a[href*="linkedin.com/posts/"]')?.href
   }))
   ```
7. If JS returns empty (Sales Nav DOM changes frequently), fall back to `mcp__Claude_in_Chrome__get_page_text` and parse the activity feed from plain text.
8. Scroll down to load more: `mcp__Claude_in_Chrome__computer` with `action: "scroll"`, `scroll_direction: "down"`, `scroll_amount: 5`. Wait 2 seconds. Repeat up to 3 times, extracting after each scroll.

#### Type B: Saved search (`/sales/search/people`)

Saved searches show a list of people, not posts directly. Extract posts via their activity:

1. `mcp__Control_Chrome__open_url` — navigate to the saved search URL in a new tab
2. Wait 3 seconds, then screenshot to verify page loaded
3. If login wall -> skip to Phase 2B
4. Use `mcp__Claude_in_Chrome__get_page_text` to read the search results page
5. Look for "Posted on LinkedIn" activity indicators shown inline next to leads. Sales Nav often shows recent post snippets in search results.
6. If inline activity is visible, extract post snippets and author names directly
7. If no inline activity is visible, identify the top 10-15 leads from the results, then for each lead navigate to their activity page: `https://www.linkedin.com/sales/people/LEAD_ID/recent-activity/` and extract recent posts
8. Scroll the search results page 2x to load more leads if needed

### Step 3: Collect results

From all lists and searches combined, collect:
- Post URL (`linkedin.com/feed/update/...` or `linkedin.com/posts/...`)
- Author name
- Post snippet / text preview
- Timestamp (if available)

Target: 20-30 raw candidates to filter in Phase 3.

If Chrome MCP encounters any error during extraction and fewer than 5 posts have
been collected so far, fall back to Phase 2B for the remaining lists.

---

## Phase 2B — WebSearch Fallback

Triggered when:
- Chrome MCP is unavailable (extension not running, browser closed)
- LinkedIn login wall detected
- `source_mode` is set to `"websearch"`

Use `WebSearch` to find recent LinkedIn posts. Pair keywords two at a time to
balance coverage against query count.

**Query pattern:**

```
site:linkedin.com/posts "keyword 1" OR "keyword 2"
```

With 10 keywords, this produces 5 queries. If the keyword list has an odd
number of entries, the last query uses a single keyword.

**After collecting results:**

- Keep only URLs matching `linkedin.com/posts/` — discard profile pages, articles, company pages
- Deduplicate by URL
- Discard posts that appear older than `search_days` based on date indicators in the snippet or URL
- Target: 20-30 raw candidates to filter down in Phase 3

If a query returns no results, move on. Do not retry the same query.

Set `used_fallback = true` so Phase 5 includes a source note in the Slack message.

---

## Phase 3 — Filter, Rank and Select

### Keyword pre-filter (Sales Nav results only)

For posts sourced from Sales Navigator: check if the snippet contains any keyword
from the `keywords` list (case-insensitive). Posts matching zero keywords get a -2
penalty to topic relevance but are NOT discarded — they come from curated leads
and may still be relevant.

Posts from WebSearch are already keyword-matched by the query, so no pre-filter needed.

### Scoring

Score each post on a 0-10 scale:

| Criterion | Weight | What to look for |
|-----------|--------|------------------|
| Topic relevance | 40% | Alignment with tchop's market: internal comms, community platforms, deskless workers, employee engagement, media apps |
| Author influence | 25% | Job titles in snippet (VP, Head of, CMO, CEO, Founder), industry-known names |
| Engagement potential | 20% | Questions posed, trending topics, takes worth responding to |
| Comment opportunity | 15% | Posts where tchop's perspective adds genuine value without being a pitch |

Sort by composite score descending. Select the top `max_posts` results.

If fewer than 5 quality posts are found, deliver what's available with a note.
Never pad the list with low-quality results.

---

## Phase 4 — Draft Comments

For each selected post, write a draft comment (2-3 sentences).

**Content rules:**

- Add value: share an insight, a data point, a complementary perspective, or a practical example
- Never just agree — no "Great post!", "Love this!", "Totally agree!"
- Reference tchop by name in **at most 2 of 10 comments**, and only when the post directly discusses a problem tchop solves
- When referencing tchop, keep it natural and non-pushy (e.g., "We see the same pattern with our community platform clients" not "Check out tchop.io!")
- Match the language of the original post — if the post is in German, write a German comment

**Tone rules** (from tone-and-voice.md, LinkedIn channel):

- Professional but slightly warmer than website copy
- Use concrete examples or data points
- Active voice, short sentences (~20 words max)
- One idea per sentence

**Banned words — never use these:**

revolutionary, game-changing, seamless, powerful, all-in-one, robust, leverage,
empower, solution, drive engagement, cutting-edge, best-in-class

---

## Phase 5 — Post to Slack

Post a single message to the configured Slack channel using the Slack MCP.

Use `slack_search_channels` to find the channel ID by name, then
`slack_send_message` with the channel ID to deliver the message.

**Message format** (use Slack mrkdwn, NOT standard Markdown):

```
*LinkedIn Scout — [today's date]*
[n] posts worth commenting on today.

*1. [Post title/snippet, truncated to ~80 chars]*
<[post URL]|View on LinkedIn>
[Author name if visible]

> _Draft comment:_
> [2-3 sentence draft]

*2. [Next post]*
<[post URL]|View on LinkedIn>
[Author]

> _Draft comment:_
> [draft]

[... repeat for all posts ...]

_Keywords: community platform, employee app, internal communications, ..._
_Edit lead lists and keywords in `.agents/skills/linkedin-scout/SKILL.md`_
```

**If fallback was used**, append before the footer:
```
_Source: Google search fallback (Chrome was unavailable). For better results, ensure Chrome is open with LinkedIn logged in._
```

**Formatting reminders:**

- Bold uses single asterisks: `*bold*` (not `**bold**`)
- Links use angle brackets: `<url|text>` (not `[text](url)`)
- No `---` horizontal rules (Slack doesn't render them)
- No `## headers` (Slack doesn't support them)
- Use blank lines between posts for readability

If Slack delivery fails, print the full formatted output so it's visible
in the task session log.

---

## Hard Rules

1. **Never post on LinkedIn.** This skill drafts comments only. A human reviews and posts them.
2. **Mention tchop in max 2 of 10 comments.** Only when the post topic directly overlaps. Never pushy.
3. **Never use banned words** listed in Phase 4.
4. **Never fabricate engagement data.** If the snippet doesn't show likes/comments, don't invent numbers.
5. **German posts get German comments.** Always match the original post's language.
6. **Never pad with junk.** If fewer than 5 quality posts are found, deliver what's available with a note.
7. **Never ask for user input.** This runs unattended via scheduled task.
8. **If Slack fails**, print the full output to the session log so results aren't lost.
9. **Never attempt to log in to LinkedIn.** If a login wall appears, fall back to WebSearch.
10. **DOM selectors may change.** If JS extraction returns empty, parse `get_page_text` output instead.
