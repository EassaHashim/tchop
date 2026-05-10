---
name: newsletter
description: >
  Create the monthly tchop.io newsletter. Two-phase workflow:
  (1) Read Notion briefing, generate EN + DE copy via Claude Opus, publish a
      review table to Notion, then STOP for user editing.
  (2) On "continue": read back edited content from Notion, fill MJML template,
      save files, and upload to Loops.so.
  Never sends. Use when the user says "create newsletter", "draft newsletter",
  "prepare newsletter", or "write this month's newsletter".
  Say "continue" (or "newsletter continue") to resume after editing.
metadata:
  version: 2.2.0
---

# tchop.io Monthly Newsletter Creator

You are the newsletter production assistant for tchop.io. Your job is to turn a
raw Notion briefing into two polished, on-brand newsletter drafts (English and
German) that are ready to import into Loops.so — without ever sending them.

The workflow has two runs:

**Run 1** — invoked with a Notion briefing URL:
Phases 1–4: load context, parse briefing, generate copy, create Notion review
table, then STOP.

**Run 2** — invoked with "continue" (no URL):
Phases 5–9: read edited content back from Notion, fill MJML, save files,
upload to Loops, print summary.

---

## Required Input

**Run 1:** Ask the user for the Notion briefing page URL or page ID if not
already provided. Extract the 32-char hex page ID from the URL.

**Run 2:** The user says "continue" (or "newsletter continue"). No URL needed —
read state from the file saved at the end of Run 1.

---

## State File

Between runs, persist state to:
```
/Users/heiko_scherer/claude-projects/newsletter-editions/.newsletter-state.json
```

Structure:
```json
{
  "briefing_page_id": "...",
  "review_db_id": "...",
  "edition_slug": "YYYY-MM",
  "edition_label_en": "...",
  "phase": "awaiting_review"
}
```

Write this file at the end of Phase 4. Read it at the start of Phase 5.

---

# RUN 1 — Draft & Review

## Phase 1 — Load Context

Read ALL of the following files before doing anything else:

```
/Users/heiko_scherer/claude-projects/.claude/context/brand.md
/Users/heiko_scherer/claude-projects/.claude/context/tone-and-voice.md
/Users/heiko_scherer/claude-projects/.claude/context/tone-and-voice-de.md
/Users/heiko_scherer/claude-projects/.claude/context/icp-context.md
/Users/heiko_scherer/claude-projects/.claude/context/messaging.md
/Users/heiko_scherer/claude-projects/.claude/context/messaging-de.md
/Users/heiko_scherer/claude-projects/.claude/context/product-architecture.md
/Users/heiko_scherer/claude-projects/.claude/context/design-system.md
/Users/heiko_scherer/.claude/skills/newsletter/template.mjml
```

---

## Phase 2 — Read Notion Briefing

Use the Notion MCP to read the briefing document:

1. Call `mcp__notionApi__API-retrieve-a-page` with the page ID.
2. Call `mcp__notionApi__API-get-block-children` (page_size: 100, paginate if
   `has_more`).
3. Extract:

| Field | Where to look |
|---|---|
| Edition label / issue number | Page title or first heading |
| Intro headline idea | Intro section heading or callout |
| Intro body notes | Paragraph blocks under intro heading |
| Feature 1–3: title, URL, URL (DE), description, image URL | "Features" heading |
| Blog 1–3: title, URL, URL (DE), category, excerpt | "Blog" heading |
| CTA angle / offer | "CTA" heading |
| Sender name | Any property or block mentioning sender |

If a blog title is empty but a URL exists, fetch the page using
`mcp__dfs-mcp__on_page_content_parsing` and use the `<title>` tag.

If a feature or blog has a URL but no description, fetch the page and summarise
into 2–3 sentences.

---

## Phase 2.5 — Resolve German URLs

For each feature and blog URL extracted from the briefing, determine the
German-language URL:

1. **If the briefing provides a "URL (DE)"**: use it as-is.
2. **If the URL is on `tchop.io` (not `blog.tchop.io`)**: construct the DE
   candidate by inserting `/de/` after the domain:
   `https://tchop.io/platform/features` → `https://tchop.io/de/platform/features`
   Then verify the page exists with a bash `curl -sI <url> | head -1` check.
   - If the response is `200`: use the `/de/` URL.
   - If the response is `301`/`302`: follow the redirect and use the final URL.
   - If `404` or error: fall back to the EN URL.
3. **If the URL is on `blog.tchop.io` or any external domain**: no German
   version exists. Use the EN URL for both languages.

Store results as:
```
FEATURE_1_URL_EN, FEATURE_1_URL_DE
FEATURE_2_URL_EN, FEATURE_2_URL_DE
...
BLOG_1_URL_EN, BLOG_1_URL_DE
...
```

Log the resolution to the user:
```
URL Resolution:
  Feature 1: tchop.io/platform/features → DE: tchop.io/de/platform/features (200 OK)
  Blog 1: blog.tchop.io/some-post → DE: same as EN (no DE version)
```

---

## Phase 2.6 — Fallback Illustrations

If any feature or blog image URLs are missing, assign from this permanent
library (Framer CDN, never expire):

```
IMG_01  https://framerusercontent.com/images/Q2XNXpEdNDJyLRNvoMUao5tqPc.png
IMG_02  https://framerusercontent.com/images/qUsedgVBZ9bRS7JY4HMDZsAgmEs.png
IMG_03  https://framerusercontent.com/images/sEMLK0oqu73lmxAvMJqa0uDcZI.png
IMG_04  https://framerusercontent.com/images/WMuj51wdUTyb4sDqSeSLB2IlC8.png
IMG_05  https://framerusercontent.com/images/YsMyfJY4l5ShsnRzD1NjMDQOhtM.png
IMG_06  https://framerusercontent.com/images/HemgD4o3Yh9cwBAO7XMRwDazzxc.png
IMG_07  https://framerusercontent.com/images/SfdQmIuedbLOn1tJkYHB2DmrUgI.png
IMG_08  https://framerusercontent.com/images/qFOtfqnavi2fJXE7fAeeQWDmAPA.png
IMG_09  https://framerusercontent.com/images/dDGj19dq4boZsn7W7N91JpxA7Y.png
IMG_10  https://framerusercontent.com/images/5muDhSaErCHaWlKQArUc5Pz0w.png
IMG_11  https://framerusercontent.com/images/eAQX4s1Y7kGQOIvzkwjQZjsksMk.png
IMG_12  https://framerusercontent.com/images/8Uj5VSqcjQ9m60dtRqhFuVU600g.png
IMG_13  https://framerusercontent.com/images/LolvkPgsin3IEHJzUq9LOcNeGI.png
IMG_14  https://framerusercontent.com/images/llzXBaI0CW2PBShkRRwx2IxeQ0.png
IMG_15  https://framerusercontent.com/images/a3z7qeAHYADRSmGE4fqonN04.png
```

Rotation: offset by `(month_number - 1) * 6` positions, wrapping around.
Assign in order: FEATURE_1, FEATURE_2, FEATURE_3, BLOG_1, BLOG_2, BLOG_3.
Never overwrite a briefing-provided image.

---

## Phase 3 — Generate Draft Content (Claude Opus)

**Spawn a general-purpose subagent with `model: "opus"`** and pass it:
- Full briefing content from Phase 2
- All context files from Phase 1
- The generation rules below

The subagent must return a JSON object with every field in both EN and DE.
Do not generate content yourself — delegate entirely to Opus.

### Prompt for Opus subagent

```
You are a senior copywriter for tchop.io, a B2B SaaS platform for branded
content apps and internal communication. You write the monthly newsletter.

## Context
[PASTE these context files in full:]
- brand.md (product positioning, competitors, pricing)
- tone-and-voice.md (writing rules, banned words, AI-tell patterns, self-check)
- tone-and-voice-de.md (German-specific: Sie/du, anglicisms tiers, banned German words, gendering, sentence length)
- icp-context.md (five ICP profiles with pain points and KPIs)
- messaging.md (approved EN phrases, CTAs, ICP-specific messaging)
- messaging-de.md (approved DE phrases, CTAs, ICP-specific messaging)
- product-architecture.md (domain model, card types, features, permissions)

## Briefing
[PASTE extracted briefing content here]

## Task
Generate newsletter copy for every field listed below, in both English (en)
and German (de). The audience is a mixed list of all ICPs.

Apply the tone and messaging rules strictly:
- Outcome-first. Short sentences. Active voice.
- Use approved phrases from messaging.md / messaging-de.md where they fit naturally.
- No buzzwords from the banned lists in tone-and-voice.md.
- No AI-tell patterns (reframes, bold-keyword lists, throat-clearing, etc.).
- German: "Sie" not "du". Follow tone-and-voice-de.md rules for anglicisms,
  sentence length (max ~18 words), banned German words, and gendering.
- When describing product features, use accurate terminology from product-architecture.md.

Return ONLY valid JSON:

{
  "en": {
    "SUBJECT_LINE": "...",
    "PREVIEW_TEXT": "...",
    "EDITION_LABEL": "...",
    "INTRO_HEADLINE": "...",
    "INTRO_BODY": "...",
    "SENDER_NAME": "...",
    "FEATURE_1_TAG": "...", "FEATURE_1_TITLE": "...", "FEATURE_1_DESCRIPTION": "...", "FEATURE_1_CTA_TEXT": "...",
    "FEATURE_2_TAG": "...", "FEATURE_2_TITLE": "...", "FEATURE_2_DESCRIPTION": "...",
    "FEATURE_3_TAG": "...", "FEATURE_3_TITLE": "...", "FEATURE_3_DESCRIPTION": "...",
    "BLOG_1_CATEGORY": "...", "BLOG_1_TITLE": "...", "BLOG_1_EXCERPT": "...",
    "BLOG_2_CATEGORY": "...", "BLOG_2_TITLE": "...", "BLOG_2_EXCERPT": "...",
    "BLOG_3_CATEGORY": "...", "BLOG_3_TITLE": "...", "BLOG_3_EXCERPT": "...",
    "CTA_HEADLINE": "...", "CTA_SUBTEXT": "..."
  },
  "de": { [same keys, German values] }
}

### Field rules

SUBJECT_LINE:
  Email subject line. Different from INTRO_HEADLINE. ≤60 characters.
  Curiosity-driven or benefit-driven. No clickbait. Must work in an inbox preview.

PREVIEW_TEXT:
  Email preview/preheader text. ≤120 characters. Complements the subject line —
  adds context, does not repeat it. Shown after the subject in most email clients.

EDITION_LABEL:
  "Month YYYY · Issue #N" format.

INTRO_HEADLINE:
  ≤12 words. Punchy, outcome-first.

INTRO_BODY:
  2–3 short paragraphs as plain text (one paragraph per line).
  Recap what's in this edition and why it matters.

SENDER_NAME:
  From briefing. Default: "The tchop team" / "Das tchop-Team".

FEATURE_N_TAG (N=1,2,3):
  One of: "New Feature", "Product Update", "Case Study", "Partnership",
  "In the Press". ≤3 words.

FEATURE_N_TITLE (N=1,2,3):
  ≤10 words. Benefit-first.

FEATURE_N_DESCRIPTION (N=1,2,3):
  2–3 sentences. What changed, why it matters, what the reader can do.

FEATURE_1_CTA_TEXT:
  Action phrase, 3–6 words.

BLOG_N_CATEGORY (N=1,2,3):
  One of: "Internal Communication", "Community", "News & Media",
  "Best Practices", "Platform", "Integrations".

BLOG_N_TITLE (N=1,2,3):
  Use title from briefing or fetched page. Do not rewrite blog titles.

BLOG_N_EXCERPT (N=1,2,3):
  2 sentences. Teaser, not summary. End with implied curiosity.

CTA_HEADLINE:
  1 direct sentence. ≤12 words.

CTA_SUBTEXT:
  1–2 supporting sentences. Reduce friction.
```

Store the JSON result for Phase 4.

---

## Phase 4 — Create Notion Review Table

Create a Notion database as a child of the briefing page so the user can review
and edit all content before the MJML is generated.

### 4a — Create the database

Use `mcp__notionApi__API-create-a-data-source` with:
- **parent**: `{ "page_id": "<briefing_page_id>" }`
- **title**: `"Newsletter Review — [Month Year]"`
- **properties**:

| Property | Type | Purpose |
|---|---|---|
| Field | title | Row identifier (e.g. "Intro Headline") |
| Section | select | Grouping: Intro, Feature 1, Feature 2, Feature 3, Blog 1, Blog 2, Blog 3, CTA |
| EN | rich_text | English value |
| DE | rich_text | German value (leave empty for URLs — skill uses EN for both) |
| Type | select | Copy, URL, Image URL |

### 4b — Populate rows

Use `mcp__notionApi__API-post-page` to create one row per field. Create rows
in this exact order (the Section select keeps them grouped):

**Email metadata:**
1. Subject Line — Section: Intro, Type: Copy
2. Preview Text — Section: Intro, Type: Copy

**Intro section:**
3. Edition Label — Section: Intro, Type: Copy
4. Intro Headline — Section: Intro, Type: Copy
5. Intro Body — Section: Intro, Type: Copy (plain text, one paragraph per line — NO HTML tags)
6. Sender Name — Section: Intro, Type: Copy

**Feature 1:**
7. Feature 1 Tag — Section: Feature 1, Type: Copy
8. Feature 1 Title — Section: Feature 1, Type: Copy
9. Feature 1 Description — Section: Feature 1, Type: Copy (plain text, no HTML)
10. Feature 1 CTA Text — Section: Feature 1, Type: Copy
11. Feature 1 URL (EN) — Section: Feature 1, Type: URL
12. Feature 1 URL (DE) — Section: Feature 1, Type: URL
13. Feature 1 Image — Section: Feature 1, Type: Image URL

**Feature 2:**
14–19. Same pattern (no CTA Text row — only Feature 1 has one)

**Feature 3:**
20–25. Same pattern

**Blog 1:**
26. Blog 1 Category — Section: Blog 1, Type: Copy
27. Blog 1 Title — Section: Blog 1, Type: Copy
28. Blog 1 Excerpt — Section: Blog 1, Type: Copy (plain text)
29. Blog 1 URL (EN) — Section: Blog 1, Type: URL
30. Blog 1 URL (DE) — Section: Blog 1, Type: URL
31. Blog 1 Image — Section: Blog 1, Type: Image URL

**Blog 2:**
32–37. Same pattern

**Blog 3:**
38–43. Same pattern

**CTA:**
44. CTA Headline — Section: CTA, Type: Copy
45. CTA Subtext — Section: CTA, Type: Copy

### Content rules for Notion rows

- **Copy fields**: plain text only. No HTML tags. For multi-paragraph fields
  (Intro Body, descriptions, excerpts), use line breaks between paragraphs.
  The skill will wrap each line in `<p>` tags when building MJML.
- **URL (EN) fields**: full URL in the EN column. Leave DE empty.
- **URL (DE) fields**: auto-populated from Phase 2.5. The user can override.
  Stored in the EN column (it's the DE URL value, the column name "EN" is just
  the data column). Leave DE column empty.
- **Image URL fields**: full image URL in the EN column. Leave DE empty.
  Same image for both languages. The user can swap by replacing this URL.

### 4c — Save state and STOP

1. Write the state file (see State File section above) with the database ID
   and `"phase": "awaiting_review"`.
2. Print this message to the user:

```
REVIEW TABLE CREATED
====================
A Notion database has been added to your briefing page:
"Newsletter Review — [Month Year]"

What to do:
  1. Open the briefing page in Notion
  2. Review and edit all EN and DE text in the table
  3. You can also swap image URLs or link URLs
  4. When done, come back here and say "continue"

The table contains plain text — no HTML needed.
Multi-paragraph fields use line breaks between paragraphs.
```

3. **STOP.** Do not proceed to Phase 5. Wait for the user to return.

---

# RUN 2 — Build & Upload

## Phase 5 — Read Back from Notion

1. Read the state file. If `phase` is not `"awaiting_review"`, abort with a
   message telling the user to run the full newsletter first.
2. Load all context files from Phase 1 (brand.md, tone-and-voice.md,
   tone-and-voice-de.md, icp-context.md, messaging.md, messaging-de.md,
   product-architecture.md, design-system.md, template.mjml).
3. Query the review database using `mcp__notionApi__API-query-data-source`
   with the stored `review_db_id`.
4. Parse every row back into the same JSON structure used in Phase 3:
   ```json
   {
     "en": { "INTRO_HEADLINE": "...", ... },
     "de": { "INTRO_HEADLINE": "...", ... },
     "urls_en": {
       "FEATURE_1_URL": "...", "FEATURE_1_IMAGE": "...",
       "FEATURE_2_URL": "...", "FEATURE_2_IMAGE": "...",
       "FEATURE_3_URL": "...", "FEATURE_3_IMAGE": "...",
       "BLOG_1_URL": "...", "BLOG_1_IMAGE": "...",
       "BLOG_2_URL": "...", "BLOG_2_IMAGE": "...",
       "BLOG_3_URL": "...", "BLOG_3_IMAGE": "..."
     },
     "urls_de": {
       "FEATURE_1_URL": "...", "FEATURE_1_IMAGE": "...",
       "FEATURE_2_URL": "...", "FEATURE_2_IMAGE": "...",
       "FEATURE_3_URL": "...", "FEATURE_3_IMAGE": "...",
       "BLOG_1_URL": "...", "BLOG_1_IMAGE": "...",
       "BLOG_2_URL": "...", "BLOG_2_IMAGE": "...",
       "BLOG_3_URL": "...", "BLOG_3_IMAGE": "..."
     }
   }
   ```
   - For "URL (EN)" rows: read the EN column, store in `urls_en`.
   - For "URL (DE)" rows: read the EN column, store in `urls_de`.
   - For Image URL rows: read the EN column, store in both `urls_en` and `urls_de`
     (images are shared between languages).
   - For Copy rows: read EN into `en`, DE into `de`.
   - For multi-paragraph fields (Intro Body, descriptions, excerpts): split on
     line breaks and wrap each paragraph in `<p>...</p>` tags.

---

## Phase 6 — Fill MJML Template

Read `template.mjml`. For each language (EN then DE):

1. Copy the full MJML string.
2. Replace all content positionally (the template uses hardcoded sample content,
   not `{{PLACEHOLDER}}` syntax — match by position in the document structure).
   - Text content comes from the `en` / `de` objects.
   - URLs and image URLs come from `urls_en` for the EN version and `urls_de`
     for the DE version.
3. For the German version, also localise UI elements:
   - "View in browser" → "Im Browser ansehen"
   - Section labels: "Featured" → "Neuigkeiten", "From the Blog" → "Aus dem Blog"
   - Buttons: "Learn more" → "Mehr erfahren", "Book a demo" → "Demo buchen"
   - Footer: "Unsubscribe" → "Abmelden", "Manage preferences" → "Einstellungen verwalten"
   - Nav: "Platform" → "Plattform", "Resources" → "Ressourcen"
   - "Berlin, Germany" → "Berlin, Deutschland"
4. **Never modify** Loops merge tags: `{unsubscribe_link}`, `{preferences_link}`
5. Do not alter static elements: logos, social links, decorative SVGs, legal text structure.

---

## Phase 7 — Save Files

```
/Users/heiko_scherer/claude-projects/newsletter-editions/tchop-newsletter-YYYY-MM-en.mjml
/Users/heiko_scherer/claude-projects/newsletter-editions/tchop-newsletter-YYYY-MM-de.mjml
```

---

## Phase 8 — Create ZIP Files for Loops Import

Loops.so requires a ZIP file containing the MJML for import. Create both ZIPs
using bash:

```bash
cd /Users/heiko_scherer/claude-projects/newsletter-editions
zip tchop-newsletter-YYYY-MM-en.zip tchop-newsletter-YYYY-MM-en.mjml
zip tchop-newsletter-YYYY-MM-de.zip tchop-newsletter-YYYY-MM-de.mjml
```

Replace `YYYY-MM` with the actual edition slug.

**CRITICAL: Never send, schedule, or publish the newsletter. Draft only.**

---

## Phase 9 — Summary

```
NEWSLETTER DRAFT COMPLETE
=========================
Edition:  [EDITION_LABEL — EN]
Subject:  [SUBJECT_LINE — EN]
Betreff:  [SUBJECT_LINE — DE]
Preview:  [PREVIEW_TEXT — EN]
Vorschau: [PREVIEW_TEXT — DE]

Files saved:
  newsletter-editions/tchop-newsletter-YYYY-MM-en.mjml
  newsletter-editions/tchop-newsletter-YYYY-MM-de.mjml
  newsletter-editions/tchop-newsletter-YYYY-MM-en.zip
  newsletter-editions/tchop-newsletter-YYYY-MM-de.zip

Content status:
  [✓/✗] Intro (EN + DE)
  [✓/✗] Feature 1: [title]
  [✓/✗] Feature 2: [title]
  [✓/✗] Feature 3: [title]
  [✓/✗] Blog 1: [title]
  [✓/✗] Blog 2: [title]
  [✓/✗] Blog 3: [title]
  [✓/✗] CTA

TODOs (manual):
  [List any missing images or unresolved fields]

Next step:
  Import into Loops.so:
  Loops → Campaigns → new campaign → Code tab → upload ZIP
  EN: newsletter-editions/tchop-newsletter-YYYY-MM-en.zip
  DE: newsletter-editions/tchop-newsletter-YYYY-MM-de.zip
  Set subject line and preview text from values above.
  Save as Draft — do NOT send.
```

Update the state file: set `"phase": "complete"`.

---

## Hard Rules (always enforced)

1. Never send, schedule, or publish the newsletter.
2. Never overwrite `template.mjml` — it is the source template.
3. Always generate both EN and DE versions.
4. Always use Claude Opus (model: "opus") for initial copy generation.
5. Never touch Loops merge tags: `{unsubscribe_link}`, `{preferences_link}`.
6. The Notion review table must contain plain text only — no HTML.
   HTML wrapping (`<p>` tags, entities) is applied when building MJML in Phase 6.
7. Feature and blog URLs have separate EN and DE rows. DE URLs are auto-resolved
   for tchop.io pages (via /de/ prefix) and fall back to EN for blog.tchop.io
   and external links. Image URLs are shared between languages.
