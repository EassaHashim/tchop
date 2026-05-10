---
name: blog-input-create
description: >
  Turn any URL (X post, Bluesky post, blog article, news piece) plus a short
  hook into two quality blog posts for the tchop.io blog — one English, one
  German (written fresh, not translated). Scrapes the source, researches the
  topic via /last30days, drafts both posts through the content skill, passes
  them through stop-slop and brand voice enforcement, picks a hero image
  from the "title images" folder in WordPress, publishes via the WordPress
  REST API, then repurposes the post into a pack of social assets. Use when
  the user says "blog-input-create", "blog this link", "write a tchop blog
  post from this URL", "turn this post into a blog", or similar.
metadata:
  version: 1.1.0
  requires:
    env:
      - WP_BASE_URL
      - WP_USER
      - WP_APP_PASSWORD
    optional_env:
      - FIRECRAWL_API_KEY
---

# Blog Input Create — Bilingual tchop.io Blog Pipeline

You are the orchestrator for a multi-phase pipeline that takes a source URL
plus a hook note and ships two high-quality blog posts (EN + DE) to the
tchop.io WordPress blog. You coordinate sub-agents and existing skills at
each phase. Do NOT skip quality gates.

## Guiding Principles

- **Quality over speed.** Every draft passes stop-slop, SEO review, and a
  final self-check before publish.
- **German is not a translation.** The DE draft is written fresh by its own
  sub-agent reading the German tone-and-voice and messaging files directly.
- **tchop perspective always.** The source is a springboard. The post must
  connect to a tchop ICP, USP, and a concrete CTA.
- **Publish carefully.** Always create as draft first, present a summary, get
  explicit user confirmation, then flip status to `publish`.

---

## Phase 0 — Intake

Collect these inputs. Ask only for what is missing. Use `AskUserQuestion` if
multiple items are unclear:

| Input | Required | Notes |
|---|---|---|
| `SOURCE_URL` | yes | X post, Bluesky post, blog article, news URL |
| `HOOK` | yes | 1–3 sentence note from the user: why this matters, the angle |
| `TARGET_ICP` | no | If omitted, infer from source + brand context in Phase 5 |
| `PRIMARY_KEYWORD` | no | If omitted, derive in Phase 6 |
| `PUBLISH_MODE` | no | Default: `draft`. User can say "publish" to go live |
| `IMAGE_FOLDER` | no | WP media folder/collection to pick a hero from. Default: `title images` |

Store these as variables for the rest of the run.

Echo the parsed intake back to the user before you start work:

```
Running blog-input-create pipeline:
- Source: {SOURCE_URL}
- Hook: {HOOK}
- Target ICP: {TARGET_ICP or "infer from context"}
- Image tag: {IMAGE_TAG}
- Publish mode: {PUBLISH_MODE} (posts will be created as drafts regardless and published after your confirmation)
```

---

## Phase 1 — Load tchop Context

Read ALL of these files before anything else. Do not proceed until done:

```
.claude/context/brand.md
.claude/context/tone-and-voice.md
.claude/context/tone-and-voice-de.md
.claude/context/messaging.md
.claude/context/messaging-de.md
.claude/context/icp-context.md
.claude/context/product-architecture.md
.claude/context/sales-objections.md
.claude/context/content-inventory.md
```

Extract and remember in working memory:
- Positioning and competitors
- ICP segments and their pains/goals
- Approved phrases (EN + DE) and banned phrases
- Existing blog URLs to avoid duplicating angles and to find internal-link targets

---

## Phase 2 — Scrape the Source URL

### Primary path: Firecrawl (if `FIRECRAWL_API_KEY` is set)

```bash
curl -s -X POST https://api.firecrawl.dev/v1/scrape \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg url "$SOURCE_URL" '{url: $url, formats: ["markdown","html"], onlyMainContent: true}')"
```

### Fallback: WebFetch tool

If `FIRECRAWL_API_KEY` is not set, use the `WebFetch` tool with a prompt like:
`"Extract the full article text, title, author, publish date, and any quoted
sources. If this is a social post, return the full post text, the author
handle, post date, engagement metrics, and any thread replies."`

### Platform-specific notes

- **X/Twitter posts** — the full thread matters. Ask Firecrawl/WebFetch to
  pull the whole thread, not just the first tweet. If behind auth, fall back
  to describing what the user pasted in the HOOK.
- **Bluesky** — public; Firecrawl handles these well.
- **Blog/news** — strip nav, ads, related posts; keep body, headings, images.

### Output of this phase

Store `SOURCE_CONTENT` with:
- `title`
- `author` / `handle`
- `published_at`
- `body_markdown`
- `key_quotes` (3–5 direct quotes you can cite)
- `source_topic` — a 3–6 word topic string for Phase 3

If the scrape fails or returns thin content, tell the user and ask whether to
proceed with just the HOOK or abort.

---

## Phase 3 — Topic Research via `/last30days`

Delegate to the `last30days` skill to become an expert on `source_topic`.

Launch a sub-agent (`subagent_type: general-purpose`) with a self-contained
prompt:

```
Run the last30days skill on topic: "{source_topic}".
Goal: become an expert on what people have been saying in the last 30 days
about this topic across Reddit, X, YouTube, HN, and the web.

Return to me (under 600 words):
- 3-5 key patterns with source citations
- Specific named tools/companies/people mentioned most often
- Contradictions or debates
- What's NEW in the last 30 days vs common knowledge
- 5 direct quotes or stats we could cite in a blog post

Do NOT write a blog post. Do NOT ask me follow-up questions. Just research
and report.
```

Store the result as `RESEARCH_BRIEF`.

---

## Phase 4 — Angle Synthesis (you do this yourself)

Combine `SOURCE_CONTENT` + `HOOK` + `RESEARCH_BRIEF` + tchop context. Write
an internal brief using the **same skeleton the repurposing engine uses**,
so Phase 13 can pass it through without re-extracting:

```
WORKING BRIEF
- CORE_THESIS (one sentence, the single takeaway): ...
- KEY_POINTS (3-5 supporting points with a concrete detail each): ...
- PROOFS (specific numbers, quotes, examples, names from source + research): ...
- CONTRARIAN_TAKE (the most counterintuitive or spicy line — do NOT skip): ...
- CTA_ANCHOR (the action the reader should take + URL): ...
- TARGET_ICP (segment from icp-context.md): ...
- TCHOP_USP (which USP this post leans on): ...
- GOAL (awareness / consideration / conversion): ...
- INTERNAL_LINKS (2-3 from content-inventory.md): ...
- RISKS (things to avoid, e.g. overlap with existing posts): ...
```

Why each field matters:
- `CORE_THESIS` anchors every section — if a paragraph doesn't serve it, cut it.
- `CONTRARIAN_TAKE` is the anti-generic clause. If you can't name one, you
  don't have a post worth writing. Revise the angle.
- `PROOFS` are the only things the writer is allowed to cite as facts.
  Nothing outside this list may appear as a number or direct quote.
- `CTA_ANCHOR` flows straight through to Phase 13 for social repurposing.

Self-check before moving on:
- Is `CORE_THESIS` genuinely different from what's already in
  `content-inventory.md`?
- Does `CONTRARIAN_TAKE` make you slightly nervous? Good. If it's safe,
  it's generic — sharpen it.
- Does it match an ICP pain from `icp-context.md`?
- Does it respect the banned phrases in `tone-and-voice.md`?

If any check fails, revise the brief before moving on.

---

## Phase 5 — Keyword Plan

Delegate to a sub-agent that uses the `seo` and `ai-seo` skills:

```
Using the seo and ai-seo skills, propose a keyword plan for a tchop.io blog
post with this angle: "{angle}" targeting this ICP: "{icp}".

Return:
- PRIMARY_KEYWORD (1, buyer-intent where possible)
- 3-5 SECONDARY_KEYWORDS
- URL slug (kebab-case, <60 chars)
- Meta title (<60 chars, includes primary keyword)
- Meta description (<155 chars, benefit-led, includes primary keyword)
- 3 H2 suggestions that target related queries
- Schema.org type recommendation (Article, BlogPosting, etc.)
- 2 internal-link anchor suggestions from this list: {paste relevant URLs from content-inventory.md}

Do the same exercise for the German version. Keywords for DE must be
researched fresh for the German market, not translated. Return the same
fields under a "DE" block.

Under 500 words total.
```

Store as `KEYWORD_PLAN_EN` and `KEYWORD_PLAN_DE`.

---

## Phase 6 — Parallel Drafting (EN + DE)

Launch **two sub-agents in parallel** in a single message. Each one uses the
`content` skill independently. Neither agent sees the other's output.

### EN writer prompt

```
You are writing a tchop.io blog post in English using the content skill.

Context (MUST read before writing):
- .claude/context/brand.md
- .claude/context/tone-and-voice.md
- .claude/context/messaging.md
- .claude/context/icp-context.md

Source material:
{paste SOURCE_CONTENT body + key quotes}

Hook/angle from the user:
{HOOK}

Research brief (last30days):
{paste RESEARCH_BRIEF}

Working brief:
{paste WORKING BRIEF}

Keyword plan:
{paste KEYWORD_PLAN_EN}

Write a blog post with:
- 900-1400 words
- Every section must serve `CORE_THESIS` — if a paragraph doesn't, cut it
- Lead with `CONTRARIAN_TAKE` — the H1 and first 100 words must commit to it
- H1 is one concrete claim or number. No questions, no "Here's why", no "The
  guide to…". Match the meta title plan
- 3-5 H2 sections using the suggested H2s as a starting point
- Primary keyword in H1, first 100 words, one H2, and meta description
- Secondary keywords distributed naturally
- **Anti-hallucination rule**: the only facts, numbers, direct quotes,
  customer names, case studies, and product feature claims you may cite are
  the ones in `PROOFS` and `RESEARCH_BRIEF`. Do not invent. Do not round
  numbers to nicer-looking figures. Do not attribute quotes to people who
  didn't say them. If you need a stat you don't have, rewrite the sentence
- 1-2 direct quotes from the source, properly attributed
- Cite sources inline with publication/handle names, not raw URLs
- A tchop-specific CTA at the end tied to the ICP, matching `CTA_ANCHOR`
- Short paragraphs, varied sentence rhythm, active voice
- No em dashes, no emojis, no banned phrases from tone-and-voice.md

Return as JSON:
{
  "h1": "...",
  "slug": "...",
  "meta_title": "...",
  "meta_description": "...",
  "body_markdown": "...",
  "excerpt": "...",
  "tags": ["..."],
  "categories": ["..."],
  "internal_links": [{"anchor": "...", "url": "..."}]
}
```

### DE writer prompt

```
Du schreibst einen Blogpost für tchop.io auf Deutsch mit dem content skill.
Dies ist KEINE Übersetzung. Schreibe frisch für den deutschsprachigen Markt.

Pflichtlektüre vor dem Schreiben:
- .claude/context/brand.md
- .claude/context/tone-and-voice-de.md
- .claude/context/messaging-de.md
- .claude/context/icp-context.md

Quellmaterial:
{paste SOURCE_CONTENT body + key quotes}

Aufhänger des Nutzers:
{HOOK}

Recherche-Brief (last30days):
{paste RESEARCH_BRIEF}

Arbeits-Brief:
{paste WORKING BRIEF}

Keyword-Plan:
{paste KEYWORD_PLAN_DE}

Schreibe einen Blogpost mit:
- 900-1400 Wörtern
- Jeder Abschnitt dient `CORE_THESIS` — Absätze, die das nicht tun, werden
  gestrichen
- Lead mit `CONTRARIAN_TAKE` — H1 und erste 100 Wörter committen sich darauf
- H1 ist eine konkrete Aussage oder Zahl. Keine Fragen, kein „So geht's"
- Korrekten Umlauten (ä ö ü ß — niemals ae/oe/ue/ss-Ersatz)
- Natürlicher deutscher Satzstruktur (keine englischen Satzmuster übersetzt)
- Deutschem Markt-Kontext wo möglich (DSGVO, Betriebsrat, etc. falls passend)
- 3-5 H2 Abschnitten
- Primärkeyword in H1, ersten 100 Wörtern, einer H2 und Meta-Description
- **Anti-Halluzinations-Regel**: Die einzigen Fakten, Zahlen, direkten
  Zitate, Kundennamen, Case Studies und Produktmerkmale, die du nennen
  darfst, stehen in `PROOFS` und `RESEARCH_BRIEF`. Erfinde nichts. Runde
  keine Zahlen auf „schönere" Werte. Schreibe keine Zitate Personen zu,
  die sie nicht gesagt haben. Wenn dir eine Zahl fehlt, formuliere den
  Satz um
- 1-2 Zitaten aus der Quelle mit Quellenangabe
- Konkreten Beispielen aus der Recherche (Publikations-/Handle-Namen, keine
  Roh-URLs)
- Einem tchop-spezifischen CTA für den ICP, passend zu `CTA_ANCHOR`
- Kurzen Absätzen, aktivem Stil
- Keine Gedankenstriche (Geviertstriche), keine Emojis, keine verbotenen
  Phrasen aus tone-and-voice-de.md

Antwort als JSON im gleichen Schema wie der englische Agent.
```

Store results as `DRAFT_EN` and `DRAFT_DE`.

---

## Phase 7 — Voice Cleanup (Stop-Slop + Brand Voice Enforcement)

Two sequential passes per draft. `stop-slop` handles generic AI patterns;
`tone-style-enforcer` handles tchop-specific brand rules. Do not skip
either — they catch different things.

### Step 7a — Stop-slop (parallel EN + DE)

Launch two sub-agents in one message. Each runs the `stop-slop` skill and
returns:
- The revised `body_markdown`
- A score (out of 50) against the stop-slop dimensions
- A list of changes made

Gate: ≥35/50. If either draft fails, run a second stop-slop revision pass
before moving on. For German, explicitly instruct the agent to check
against `tone-and-voice-de.md` banned patterns as well.

Overwrite `DRAFT_EN.body_markdown` and `DRAFT_DE.body_markdown` with the
cleaned versions.

### Step 7b — Brand voice enforcement (parallel EN + DE)

Launch two more sub-agents in one message. Each runs the
`tone-style-enforcer` skill in single-artifact mode on the stop-slop-clean
draft:

```
Run tone-style-enforcer in single-artifact mode on this draft.

Inputs:
- TEXT: {DRAFT_EN.body_markdown}
- LANGUAGE: en
- APPLY_FIXES: true
- CONTEXT: tchop.io blog post, target ICP: {TARGET_ICP}

Load the English rule files (tone-and-voice.md, messaging.md, brand.md),
build the RULESET, scan for BLOCK and WARN violations, apply minimum-change
fixes, and return the JSON output object defined by the skill.

Do not invent facts. Do not change meaning. Minimum-change edits only.
```

DE sub-agent gets the same prompt with `LANGUAGE: de` and the DE rule files.

Gate: `pass: true`, score ≥40/50, zero BLOCK violations. If either draft
fails, run one more enforcement pass. If it still fails, stop the pipeline
and report the specific BLOCK violations to the user — do not ship a
brand-voice-failing post.

Overwrite `DRAFT_EN.body_markdown` and `DRAFT_DE.body_markdown` with the
brand-clean versions.

---

## Phase 8 — SEO & Schema Review

One sub-agent, sequential (needs both drafts):

```
Using the seo, ai-seo, and schema-markup skills, review these two drafts for
on-page SEO and generate JSON-LD schema for each.

{paste DRAFT_EN and DRAFT_DE}

For each post return:
- pass/fail on: keyword density, meta title length, meta description length,
  H1 uniqueness, H2 structure, internal link count, alt text placeholders
- JSON-LD BlogPosting schema (fill in as much as you can; leave image URL as
  "{{HERO_IMAGE_URL}}" placeholder)
- Any copy fixes needed

Under 400 words.
```

Apply the recommended fixes to both drafts.

---

## Phase 9 — Hero Image Pick (from "title images" folder)

The tchop WordPress site has a media folder named **"title images"**. All
hero images for blog posts come from this folder. Pick two different images
(one EN, one DE) and avoid images that have been used recently.

### Step 9a — Resolve the "title images" folder

WordPress core has no native folder concept, so "title images" is stored by
one of these mechanisms (check in this order):

1. **FileBird / Real Media Library / Folderly plugin** — exposes folders via
   REST. Try:
   ```bash
   # FileBird
   curl -s -u "$WP_USER:$WP_APP_PASSWORD" \
     "$WP_BASE_URL/wp-json/filebird/public/v1/folder" | jq '.[] | select(.text=="title images")'
   # Real Media Library
   curl -s -u "$WP_USER:$WP_APP_PASSWORD" \
     "$WP_BASE_URL/wp-json/realmedialibrary/v1/folders" | jq '.[] | select(.name=="title images")'
   ```
2. **Media tag/category taxonomy** — slug `title-images`:
   ```bash
   curl -s -u "$WP_USER:$WP_APP_PASSWORD" \
     "$WP_BASE_URL/wp-json/wp/v2/media_tag?slug=title-images" | jq '.[0].id'
   ```
3. **Filename convention** — list all media and filter by filename prefix
   `title-` or by the `alt_text`/`caption` containing "title image".

On the first run, probe each option and remember which one is live. Store
the folder id / tag id / filter in `state.json` so the next run is fast.

### Step 9b — List all images in the folder

Paginate through all media items in the folder. Example for FileBird:

```bash
curl -s -u "$WP_USER:$WP_APP_PASSWORD" \
  "$WP_BASE_URL/wp-json/wp/v2/media?per_page=100&fb_folder={folder_id}&media_type=image" \
  | jq '[.[] | {id, source_url, alt_text, date}]' > /tmp/title-images.json
```

For a `media_tag` fallback use `&media_tag={tag_id}`. For a filename
convention use `?search=title-` and filter client-side.

### Step 9c — Check the recent-picks log

State file:
```
~/.claude/skills/blog-input-create/state/recent-images.json
```

Structure:
```json
{
  "window_days": 60,
  "picks": [
    {"media_id": 1234, "used_at": "2026-04-01T10:12:00Z", "post_id": 987, "lang": "en"},
    {"media_id": 1235, "used_at": "2026-04-01T10:12:00Z", "post_id": 988, "lang": "de"}
  ]
}
```

Create the directory and file if missing. Read it, drop any entry older than
`window_days` (default 60), then build `RECENTLY_USED = {set of media_ids}`.

### Step 9d — Pick two images (EN + DE), never reusing recent ones

```bash
jq --argjson recent "$(jq '[.picks[].media_id]' recent-images.json)" \
   '[.[] | select(.id as $id | $recent | index($id) | not)]' \
   /tmp/title-images.json > /tmp/available.json

# Sanity: make sure we still have at least 2
COUNT=$(jq 'length' /tmp/available.json)
if [ "$COUNT" -lt 2 ]; then
  # The full folder was exhausted inside the window. Fall back to the two
  # LEAST-recently-used images from the full folder.
  echo "Warning: only $COUNT fresh images available. Falling back to least-recently-used."
fi

# Random pick of two distinct ids
jq -r '.[].id' /tmp/available.json | shuf -n 2
```

Rules:
- EN and DE **must** be different media items (unless the folder has only
  one image — in which case warn the user and let them decide).
- If no fresh images remain, pick the two oldest `used_at` entries from the
  recent log and reuse those, and warn the user explicitly in the Phase 11
  summary (`Note: reusing image X, last used {date} — folder has no fresh
  images left within the {window_days}-day window`).
- Never pick an image used in the last 14 days under any circumstance.

Store `HERO_IMAGE_ID_EN`, `HERO_IMAGE_ID_DE`, and their `source_url` and
`alt_text`. Substitute `{{HERO_IMAGE_URL}}` in the JSON-LD from Phase 8.

### Step 9e — Update the recent-picks log (AFTER publish, Phase 12)

Do not write to the log yet. The log is only updated in Phase 12 once the
posts are actually published, so that aborted runs do not burn image slots.

---

## Phase 10 — Create as DRAFT in WordPress

Create both posts as `status=draft` first. Never publish in this phase.

### Resolve tags and categories

Tags/categories from the drafts need to exist in WP. For each tag name:

```bash
# Search for existing, create if missing
curl -s -u "$WP_USER:$WP_APP_PASSWORD" \
  "$WP_BASE_URL/wp-json/wp/v2/tags?search=$(printf %s "$NAME" | jq -sRr @uri)" \
  | jq '.[0].id // empty'
```

If empty, POST to `/wp-json/wp/v2/tags` with `{"name": "$NAME"}` and capture
the new ID. Same for categories.

### Create the EN post

```bash
curl -s -u "$WP_USER:$WP_APP_PASSWORD" -X POST \
  "$WP_BASE_URL/wp-json/wp/v2/posts" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "title": "{DRAFT_EN.h1}",
  "slug": "{DRAFT_EN.slug}",
  "status": "draft",
  "content": "{DRAFT_EN.body_html}",
  "excerpt": "{DRAFT_EN.excerpt}",
  "featured_media": {HERO_IMAGE_ID_EN},
  "categories": [{cat_ids}],
  "tags": [{tag_ids}],
  "meta": {
    "rank_math_title": "{DRAFT_EN.meta_title}",
    "rank_math_description": "{DRAFT_EN.meta_description}",
    "rank_math_focus_keyword": "{PRIMARY_KEYWORD},{SECONDARY_KEYWORDS_CSV}",
    "rank_math_canonical_url": "",
    "rank_math_robots": ["index","follow"],
    "rank_math_snippet_article_type": "BlogPosting",
    "rank_math_facebook_title": "{DRAFT_EN.meta_title}",
    "rank_math_facebook_description": "{DRAFT_EN.meta_description}",
    "rank_math_twitter_title": "{DRAFT_EN.meta_title}",
    "rank_math_twitter_description": "{DRAFT_EN.meta_description}"
  },
  "lang": "en"
}
JSON
```

Notes:
- Convert `body_markdown` → HTML before sending. A simple pandoc call works:
  `pandoc -f markdown -t html5` or use a Node one-liner. Preserve headings.
- **SEO plugin: Rank Math.** Meta keys are `rank_math_title`,
  `rank_math_description`, `rank_math_focus_keyword` (comma-separated list
  where the first item is the primary keyword), `rank_math_canonical_url`,
  `rank_math_robots`, `rank_math_snippet_article_type`, and the
  `rank_math_facebook_*` / `rank_math_twitter_*` social fields.
- Rank Math exposes these via `show_in_rest` in current versions. If a POST
  with `meta: { rank_math_* }` returns 200 but the fields don't persist,
  verify Rank Math's "SEO Meta" module is enabled and that the REST API
  integration is on under Rank Math → General Settings → REST API. If a
  field is rejected with `rest_invalid_param`, fall back to a one-shot
  `POST /wp-json/rankmath/v1/updateMeta` (available in Rank Math 1.0.90+)
  or set it via a small companion mu-plugin that registers the missing
  keys with `show_in_rest`.
- For the hero image, also set `rank_math_facebook_image` and
  `rank_math_twitter_image` to `HERO_IMAGE_URL_EN` (or DE) so social
  shares pick it up.
- `lang` assumes Polylang or WPML. Check which is active via
  `/wp-json/polylang/v1/languages` or `/wp-json/wpml/...`. Adjust the payload
  accordingly.

### Create the DE post

Same call with `DRAFT_DE` fields and `"lang": "de"`. If Polylang is active,
immediately link the two via the Polylang translations endpoint so they show
as each other's language counterpart.

### Capture the draft URLs

Save `draft_url_en` and `draft_url_de` from the response (`link` field) plus
post IDs for Phase 12.

---

## Phase 11 — Present Review Summary & Get Confirmation

Show the user:

```
Drafts created on {WP_BASE_URL}:

EN: {draft_url_en}
  Title: {DRAFT_EN.h1}
  Meta title: {DRAFT_EN.meta_title}
  Meta description: {DRAFT_EN.meta_description}
  Primary keyword: {PRIMARY_KEYWORD_EN}
  Word count: {wc_en}
  Stop-slop score: {score_en}/50
  Hero image: {hero_url_en}

DE: {draft_url_de}
  Title: {DRAFT_DE.h1}
  Meta title: {DRAFT_DE.meta_title}
  Meta description: {DRAFT_DE.meta_description}
  Primary keyword: {PRIMARY_KEYWORD_DE}
  Word count: {wc_de}
  Stop-slop score: {score_de}/50
  Hero image: {hero_url_de}

Both are saved as DRAFT. Review them in WordPress and reply:
- "publish both" to go live
- "publish en" / "publish de" to go live with just one
- "fix: <what to change>" to iterate
- "cancel" to leave as drafts
```

Then STOP. Wait for the user's decision. Do not publish without an explicit
instruction.

---

## Phase 12 — Publish (only on user confirmation)

On confirmation, PATCH each post:

```bash
curl -s -u "$WP_USER:$WP_APP_PASSWORD" -X POST \
  "$WP_BASE_URL/wp-json/wp/v2/posts/{POST_ID}" \
  -H "Content-Type: application/json" \
  -d '{"status": "publish"}'
```

Capture the final `link` from the response. Verify the post is reachable:

```bash
curl -s -o /dev/null -w "%{http_code}" "{final_url}"
```

Expect `200`. If not, report the status code and do not claim success.

### Record the image picks in the recent-picks log

Only after a successful publish, append entries to
`~/.claude/skills/blog-input-create/state/recent-images.json`:

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
jq --arg now "$NOW" \
   --argjson en_id "$HERO_IMAGE_ID_EN" --argjson de_id "$HERO_IMAGE_ID_DE" \
   --argjson en_post "$POST_ID_EN" --argjson de_post "$POST_ID_DE" \
   '.picks += [
     {media_id: $en_id, used_at: $now, post_id: $en_post, lang: "en"},
     {media_id: $de_id, used_at: $now, post_id: $de_post, lang: "de"}
   ]' recent-images.json > recent-images.json.tmp && mv recent-images.json.tmp recent-images.json
```

If only one language was published, record only that one.

Final report:

```
Published:
- EN: {final_url_en}
- DE: {final_url_de}

Post IDs: EN={id_en}, DE={id_de}
Hero images: EN media #{id}, DE media #{id}
Language linking: {polylang/wpml status}
```

---

## Phase 13 — Repurpose (runs only after successful publish)

Once both posts are live, repurpose each one into a pack of platform-native
assets via the `content-repurposing-engine` skill. Do not skip this step —
it's how the blog post earns its distribution.

**Skeleton pass-through:** Phase 4's `WORKING BRIEF` already has the exact
fields (`CORE_THESIS`, `KEY_POINTS`, `PROOFS`, `CONTRARIAN_TAKE`,
`CTA_ANCHOR`) the repurposing engine extracts in its Step 2. Pass them
through explicitly so the engine doesn't re-derive them from the published
body — that guarantees every repurposed format commits to the same
contrarian take as the blog post.

Launch **two sub-agents in parallel** (one per language) in a single
message. Each sub-agent invokes the `content-repurposing-engine` skill.

### EN repurpose prompt

```
Use the content-repurposing-engine skill to repurpose this published
tchop.io blog post.

Inputs:
- SOURCE_CONTENT: {full DRAFT_EN.body_markdown}
- SOURCE_URL: {final_url_en}
- LANGUAGE: en
- TARGET_ICP: {TARGET_ICP}
- FORMATS: linkedin, x_thread, bluesky, short_video, newsletter, tldr
- CTA: {final_url_en}

Follow the skill's full workflow: load tchop English context, extract core
ideas, generate each format, run quality checks (including stop-slop
patterns), and return the JSON output object defined by the skill.

Preserve the blog's core thesis. Do not invent stats or quotes. Match the
English tchop tone-and-voice.
```

### DE repurpose prompt

```
Nutze den content-repurposing-engine skill, um diesen veröffentlichten
tchop.io Blogpost für deutsche Kanäle neu aufzubereiten. Keine Übersetzung
aus dem Englischen — arbeite direkt mit dem deutschen Originaltext.

Inputs:
- SOURCE_CONTENT: {full DRAFT_DE.body_markdown}
- SOURCE_URL: {final_url_de}
- LANGUAGE: de
- TARGET_ICP: {TARGET_ICP}
- FORMATS: linkedin, x_thread, bluesky, short_video, newsletter, tldr
- CTA: {final_url_de}

Lade den deutschen tchop-Kontext (tone-and-voice-de.md, messaging-de.md),
extrahiere die Kernideen, generiere jedes Format in natürlichem Deutsch
mit korrekten Umlauten, und gib das JSON-Objekt gemäß Skill-Spezifikation
zurück.
```

Store results as `REPURPOSE_EN` and `REPURPOSE_DE`.

### Save the packs to disk

Write both packs to:

```
~/.claude/skills/blog-input-create/state/repurpose/{YYYY-MM-DD}-{slug}-en.json
~/.claude/skills/blog-input-create/state/repurpose/{YYYY-MM-DD}-{slug}-de.json
```

Create the directory if missing. These files are the user's pickup point
for manual posting (or for a downstream scheduler like Buffer/Hootsuite/
Publer if one is wired up later).

### Consistency sweep across the repurpose pack

Before showing anything to the user, run `tone-style-enforcer` in
**consistency sweep mode** once per language. This catches cross-artifact
drift that single-artifact enforcement can't see — the blog might be
"channels" while the LinkedIn post ended up as "feeds".

Launch two sub-agents in parallel:

```
Run tone-style-enforcer in sweep mode.

Inputs:
- LANGUAGE: en
- BUNDLE: {
    blog: {DRAFT_EN.body_markdown, CTA: CTA_ANCHOR},
    linkedin: REPURPOSE_EN.formats.linkedin,
    x_thread: REPURPOSE_EN.formats.x_thread,
    bluesky: REPURPOSE_EN.formats.bluesky,
    short_video: REPURPOSE_EN.formats.short_video,
    newsletter: REPURPOSE_EN.formats.newsletter,
    tldr: REPURPOSE_EN.formats.tldr
  }
- SHARED_SKELETON: {CORE_THESIS, KEY_POINTS, PROOFS, CONTRARIAN_TAKE, CTA_ANCHOR}

Check for thesis drift, terminology drift, CTA drift, voice drift, and
fact drift per the skill spec. Return the JSON sweep output.
```

Same for DE with the German bundle.

If the sweep returns any BLOCK-severity drift (thesis contradiction,
invented fact), apply the suggested line edits to the affected artifacts
and re-run the sweep. Max 2 passes. If it still fails, flag the specific
drifts in the pack preview so the user knows what to fix manually before
distributing.

WARN-level drifts (terminology inconsistencies, soft CTA mismatches) are
surfaced in the preview but do not block delivery.

### Present the repurpose pack

After both sub-agents return, show the user a compact preview:

```
Repurpose packs ready:

EN (saved to {path_en}):
- LinkedIn post ({word_count} words)
- X thread ({n} tweets)
- Bluesky post (+{n} replies)
- Short-form video script ({seconds}s)
- Newsletter snippet (subject: "{subject}")
- TL;DR bullets ({n})

DE (saved to {path_de}):
- LinkedIn Post ({word_count} Wörter)
- X Thread ({n} Tweets)
- Bluesky Post (+{n} Replies)
- Short-Form Video Script ({seconds}s)
- Newsletter-Snippet (Betreff: "{subject}")
- TL;DR Bullets ({n})

Reply "show en" / "show de" to print the full pack, or "done" to finish.
```

Do not auto-post to any social platform. This skill creates assets; human
or scheduler handles distribution.

### If Phase 13 is skipped

If the user cancels at Phase 11 (no publish), do not run Phase 13. There's
nothing to repurpose until the canonical blog URL exists.

---

## Error Handling & Rollback

- **Scrape fails** → tell user, ask to proceed with HOOK only or abort
- **last30days fails** → proceed with a note; write with source + context only
- **WP create fails** → print the raw error, do not retry blindly; ask user
- **Publish fails after draft creation** → drafts remain; report IDs so the
  user can publish manually in WP admin
- **Pandoc missing** → install via `brew install pandoc` or fall back to a
  Node markdown-it one-liner

Never delete posts the user didn't ask you to delete.

---

## Sub-Agent Usage Summary

| Phase | Agent | Skill invoked | Parallel? |
|---|---|---|---|
| 3 | general-purpose | last30days | no |
| 5 | general-purpose | seo + ai-seo | no |
| 6 | general-purpose ×2 | content (EN), content (DE) | **yes** |
| 7a | general-purpose ×2 | stop-slop | **yes** |
| 7b | general-purpose ×2 | tone-style-enforcer (single) | **yes** |
| 8 | general-purpose | seo + ai-seo + schema-markup | no |
| 13 | general-purpose ×2 | content-repurposing-engine (EN), (DE) | **yes** |
| 13 (sweep) | general-purpose ×2 | tone-style-enforcer (sweep) | **yes** |

Launch parallel sub-agents by sending multiple `Agent` tool calls in a
single message.

---

## Security & Permissions

What this skill does:
- Fetches the source URL via Firecrawl or WebFetch
- Calls the last30days skill (which may hit Reddit/X/YouTube/HN/Polymarket/web)
- Reads local context files under `.claude/context/`
- Calls the WordPress REST API at `$WP_BASE_URL` with application-password auth
- Lists and attaches WordPress media
- Creates drafts, then (only with explicit user confirmation) publishes them

What this skill does NOT do:
- Never publishes without user confirmation
- Never deletes posts, media, or tags
- Never amends or overwrites existing published posts unless the user asks
- Never pushes credentials to logs or commits
- Never uses destructive WP endpoints (DELETE) automatically
