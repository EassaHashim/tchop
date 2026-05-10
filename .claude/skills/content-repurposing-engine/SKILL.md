---
name: content-repurposing-engine
description: >
  Convert long-form content (blog posts, articles, notes, transcripts) into
  multiple platform-native formats — LinkedIn posts, X/Bluesky threads,
  short-form video scripts, newsletter snippets, executive summaries —
  while preserving the core message and tchop.io voice. Use when the user
  says "repurpose this post", "turn this into social", "make a thread from
  this", "short-form from this blog", or when another skill (e.g.
  blog-input-create) invokes this step.
metadata:
  version: 1.0.0
---

# Content Repurposing Engine

Turn one long-form piece into a pack of platform-native assets. Each format
speaks its platform's language without parroting the source.

## Inputs

| Input | Required | Notes |
|---|---|---|
| `SOURCE_CONTENT` | yes | Full blog text, article, or transcript (markdown ok) |
| `SOURCE_URL` | yes | Canonical link for back-references and UTMs |
| `LANGUAGE` | yes | `en` or `de` — picks the right tone-and-voice file |
| `TARGET_ICP` | no | ICP segment from `icp-context.md` if known |
| `FORMATS` | no | Subset of the format list below. Default: all |
| `CTA` | no | Primary CTA URL. Default: homepage |

## Step 1 — Load Context

Read before writing:
- `.claude/context/brand.md`
- `.claude/context/icp-context.md`
- `.claude/context/messaging.md` (or `messaging-de.md` if `LANGUAGE=de`)
- `.claude/context/tone-and-voice.md` (or `tone-and-voice-de.md`)

## Step 2 — Extract Core Ideas

From `SOURCE_CONTENT`, extract and store:
- `CORE_THESIS` — one sentence, the single takeaway
- `KEY_POINTS` — 3–5 supporting points
- `PROOFS` — specific numbers, quotes, examples, names
- `CONTRARIAN_TAKE` — the most counterintuitive or spicy line in the source
- `CTA_ANCHOR` — the action the reader should take

This is the skeleton every format reuses. Do not skip this step.

## Step 3 — Generate Each Format

Produce each requested format. For every format, match the platform's native
rhythm — don't just chop the blog into tweet-sized pieces.

### LinkedIn post (150–220 words)

- Hook in line 1 (no emojis, no "Here's why")
- Line break, then the story or claim
- 3–4 short paragraphs
- End with CTA linking to `SOURCE_URL`
- No hashtags unless brand uses them
- DE version: native German LinkedIn conventions, correct Umlaute

### X/Twitter thread (6–10 tweets, ≤270 chars each)

- Tweet 1: hook. One concrete claim or number. No "1/"
- Tweets 2–N: one idea each, concrete, no filler
- Last tweet: CTA with `SOURCE_URL`
- Number tweets `2/` onwards; leave tweet 1 unnumbered
- No emojis unless brand uses them

### Bluesky post (1 post, ≤300 chars + optional 2-reply thread)

- Single punchy post first. Link to `SOURCE_URL`
- Optional 2-reply thread for context — keep each reply self-contained
- Conversational tone, lower formality than LinkedIn

### Short-form video script (30–60 seconds, ~90–150 words)

Format as:
```
[HOOK 0-3s]  — one sentence, visual cue in brackets
[POINT 3-15s] — ...
[POINT 15-35s] — ...
[PROOF 35-50s] — specific number or quote
[CTA 50-60s] — ...
```
Include on-screen text suggestions and a B-roll note per beat.

### Newsletter snippet (80–140 words)

- Subject-line suggestion (<55 chars)
- 1 paragraph hook + 1 paragraph payoff
- Clear read-more link to `SOURCE_URL`

### Executive summary (TL;DR, 40–80 words)

- 3 bullets max, each ≤15 words
- One-sentence so-what at the end
- No jargon

## Step 4 — Voice and Quality Checks

For every format, verify:
- [ ] Preserves `CORE_THESIS` without drift
- [ ] Matches `tone-and-voice.md` (or `-de.md`)
- [ ] No banned phrases
- [ ] No em dashes, no emojis (unless explicitly on-brand)
- [ ] Specific over vague — named things, real numbers
- [ ] CTA is clear and points to `SOURCE_URL` (or the provided `CTA`)
- [ ] DE output uses proper Umlaute (ä ö ü ß), never ae/oe/ue/ss substitutes

Run each format through the `stop-slop` rules, then through the
`tone-style-enforcer` skill in single-artifact mode with the correct
`LANGUAGE`. The enforcer returns a pass/fail verdict against the tchop
brand ruleset. If any format scores below 40/50 or has any BLOCK
violation, rewrite it and re-check. Max 2 passes per format.

## Step 5 — Output

Return a single JSON object (so callers can parse it):

```json
{
  "source_url": "...",
  "language": "en",
  "core_thesis": "...",
  "formats": {
    "linkedin": "...",
    "x_thread": ["tweet 1", "2/ ...", "3/ ..."],
    "bluesky": {"post": "...", "replies": ["...", "..."]},
    "short_video": "[HOOK 0-3s] ...",
    "newsletter": {"subject": "...", "body": "..."},
    "tldr": ["bullet 1", "bullet 2", "bullet 3", "so what: ..."]
  }
}
```

If invoked conversationally (not from another skill), render the same pack
as nicely formatted markdown with clear section headers instead of JSON.

## Constraints

- Preserve meaning — never invent stats, quotes, or product features
- Avoid verbosity — cut every word that doesn't carry weight
- Format must match channel style — don't post LinkedIn copy on X
- Stay within the tchop brand voice — one pack, one voice
- Never mix languages — if both EN and DE are needed, run this skill twice
