---
name: tone-style-enforcer
description: >
  Enforce tchop.io brand voice on any text or bundle of texts. Complements
  stop-slop (generic AI patterns) with brand-specific rules from
  tone-and-voice.md / tone-and-voice-de.md and messaging.md / messaging-de.md.
  Runs in two modes: (1) single-artifact enforcement — scan one piece of
  copy, return violations + fixes + score; (2) consistency sweep — compare
  multiple artifacts (e.g. a blog post and its repurposed social pack) and
  flag voice drift. Use when the user says "enforce brand voice", "check
  tone", "make sure this sounds like us", "voice sweep", or when another
  skill invokes this step.
metadata:
  version: 1.2.0
---

# Tone & Style Enforcer

tchop brand voice guard. Runs after drafting and before delivery.

## When to invoke

- **Single-artifact mode**: one piece of copy, one language. Scan, report,
  optionally fix.
- **Consistency sweep mode**: multiple artifacts (blog post + LinkedIn post +
  X thread + newsletter snippet, etc.) in one language. Check they all
  sound like the same brand speaking.

## Step 1 — Build the rule checklist from context

Read these files once per run:

**For English:**
- `.claude/context/tone-and-voice.md`
- `.claude/context/messaging.md`
- `.claude/context/brand.md`

**For German:**
- `.claude/context/tone-and-voice-de.md`
- `.claude/context/messaging-de.md`
- `.claude/context/brand.md`

Extract into an internal `RULESET`:

```
RULESET
- BANNED_PHRASES: [list of exact strings and regex patterns that must not appear]
- BANNED_STRUCTURES: [patterns like "not X, it's Y", "here's what/this/that", rhetorical questions as headers]
- REQUIRED_VOICE: [active voice, second person, concrete subjects]
- APPROVED_CTAS: [phrases the ICP-relevant CTAs must use]
- LANGUAGE_RULES (DE only): [Umlaut requirement, formal vs informal address, German sentence structure, avoid translated English idioms]
- FORMATTING_RULES: [no em dashes, no emojis unless explicit, short paragraphs (≤4 lines), varied sentence length]
- PRODUCT_TERMINOLOGY: [correct names for tchop features, roles, card types from product-architecture.md]
```

If a rule is ambiguous in the source file, note it and skip rather than
guess — flag it in the report so the user can sharpen the brand doc.

## Step 1.5 — Optional voice calibration

Use when the artifact should sound like a **specific person**, not the
tchop-as-brand voice. Triggers:

- Caller passes a `voice_sample` field (2–3 paragraphs of the target
  person's prior writing).
- User says "match my voice", "sound like Heiko", "calibrate to this
  sample", or pastes a writing sample alongside the artifact.
- Artifact type is one where authorial voice matters more than brand
  voice: Heiko's LinkedIn essays, founder thought leadership, guest
  posts, cold-email personalisation lines, podcast intros.

Skip for: product copy, landing pages, newsletter (brand-voiced), social
posts published from the brand handle, anything in `messaging.md`'s
approved CTA territory.

### Step 1.5a — Build the voice fingerprint

From the sample, extract into `VOICE_FINGERPRINT`:

```
VOICE_FINGERPRINT
- AVG_SENTENCE_LENGTH: <words; note range, not just mean>
- SENTENCE_LENGTH_VARIANCE: <"high" | "medium" | "low" — does the writer
  use staccato one-liners next to long sentences, or is it metronomic?>
- PARAGRAPH_LENGTH: <typical line count>
- OPENINGS: <how does the writer start paragraphs? — e.g. "starts with a
  concrete observation", "opens with a contrarian claim", "leads with a
  question they then answer">
- DICTION: <register: blunt / academic / colloquial / technical; flag any
  recurring words or phrasings — e.g. "the thing is", "honestly,",
  one-word sentences for emphasis>
- QUIRKS: <signature moves — em dash habits (rare for tchop, but the
  writer's own pattern overrides the brand ban here), parentheticals,
  italics for emphasis, sentence fragments, lowercase-first proper nouns,
  etc.>
- CONTRARIAN_INDEX: <does the writer commit to sharp takes, or hedge?
  high / medium / low>
- CONCRETENESS: <ratio of named things/numbers/examples to abstractions>
- TABOOS: <words or moves the writer noticeably avoids>
```

Two paragraphs is a thin sample — note `confidence: low` if the sample is
shorter than ~250 words. Tell the user the fingerprint is a sketch, not a
fit, and ask for more sample if they want stronger calibration.

### Step 1.5b — Reconcile fingerprint with RULESET

When `VOICE_FINGERPRINT` and `RULESET` collide, the fingerprint wins **for
this artifact only** — but only on style, never on facts or banned
phrases. Concrete rules:

| Conflict | Winner | Why |
|---|---|---|
| Writer uses em dashes; brand bans them | Fingerprint | Personal voice trumps brand stylesheet for personal copy |
| Writer hedges; brand demands commitment | Brand | Even personal copy from a tchop voice should commit; flag for human review if the writer's natural register is genuinely soft |
| Writer uses an approved CTA phrasing | Brand | CTAs are campaign-level, not voice-level |
| Writer uses a banned phrase ("delve", "in today's landscape") | Brand | Banned phrases stay banned; that's not voice, that's slop |
| Writer's product terminology drifts (calls "channels" "feeds") | Brand | Terminology is correctness, not voice |
| Writer's rhythm is metronomic | Fingerprint | If the writer naturally writes that way, don't impose tchop's rhythm rules |

When the fingerprint overrides a brand rule, record it in the output as a
`voice_overrides` array so the user can see what calibration changed.

### Step 1.5c — Hand off to Step 2

Pass both `RULESET` and `VOICE_FINGERPRINT` to the scan and rewrite
passes. The rewrite pass should preserve fingerprint quirks even when
they look "wrong" against the brand stylesheet — that's the whole point.

## Step 2 — Single-artifact enforcement

For one input text:

1. **Scan pass**: walk the text, collect every RULESET violation with its
   location (paragraph index + excerpt + rule that was violated).
2. **Classify severity**:
   - **BLOCK** — banned phrase, banned structure, wrong Umlaut
     substitution, wrong product terminology
   - **WARN** — drifting tone, passive voice cluster, paragraphs too long,
     rhythm too metronomic
   - **NOTE** — style-guide ambiguity, candidate for improvement
3. **Rewrite pass** (only when the caller asks for fixes): apply the minimum
   change that removes each BLOCK and WARN. Do not rewrite sentences that
   were already fine. Do not add new claims or change meaning.
4. **Score** on 1–10 across five dimensions:

| Dimension | Question |
|---|---|
| Voice fit | Does it sound like tchop? |
| Specificity | Named things and concrete examples vs vague abstractions? |
| Rhythm | Sentence length varies, no metronome? |
| Rules | Zero BLOCK violations? |
| CTA fit | CTA matches `messaging.md` / `messaging-de.md` approved phrases? |

Pass threshold: **40/50**, zero BLOCK violations.
Below 40 or any BLOCK remaining: do another rewrite pass, max 2 passes
total. If still failing, return the output with an explicit `fail` flag
and a human-readable note. Do not ship a failing artifact upstream.

### Single-artifact output

```json
{
  "mode": "single",
  "language": "en",
  "voice_calibration": {
    "ran": false,
    "confidence": null,
    "fingerprint_summary": null,
    "voice_overrides": []
  },
  "pass": true,
  "score": 44,
  "scores_by_dimension": {"voice": 9, "specificity": 8, "rhythm": 9, "rules": 10, "cta": 8},
  "blocks": [],
  "warnings": [
    {"location": "paragraph 3", "excerpt": "...", "rule": "metronomic rhythm", "suggested_fix": "..."}
  ],
  "fixed_text": "... (only when fixes were requested) ..."
}
```

When voice calibration ran, populate `voice_calibration` with the
fingerprint summary, the confidence level, and the list of
`voice_overrides` (places where the fingerprint beat a brand rule). The
`voice` dimension score is then judged against the fingerprint, not the
brand stylesheet.

## Step 2.5 — Second opinion via Codex (optional)

Different model families catch different tells. Claude over-hedges, softens
theses, and writes metronomic long-form prose. ChatGPT (via the `codex` CLI)
catches those tells better than another Claude pass would. Use it to break
ties on borderline drafts and to surface things the rule-based scan misses.

### When to run this step

Run **only** when one of these is true (don't burn tokens on every draft):

- Caller explicitly requests it (e.g., `second_opinion: true`, or the user
  said "double-check this" / "second opinion" / "ask codex too")
- Score from Step 2 lands borderline: **38–43** out of 50
- Mode is `single` and the artifact is **long-form** (≥600 words: blog post,
  newsletter, LinkedIn essay) — these are where Claude's tells compound
- A `BLOCK` was rewritten in pass 2 — verify the fix didn't introduce a new
  brand-voice issue

Skip for: short social posts (<200 words), microcopy, headlines alone, and
any artifact already at 45+ score with zero blocks.

### Step 2.5a — Check codex availability

```bash
which codex 2>/dev/null || echo "NOT_FOUND"
```

If `NOT_FOUND`: skip this step silently and add `"second_opinion": "skipped: codex not installed"`
to the output. Do not block delivery on a missing CLI.

### Step 2.5b — Build the prose-specific prompt

Codex's default mode is engineering-flavored. Override it with a brand-voice
persona. Embed the artifact and the relevant subset of the RULESET directly
in the prompt — Codex runs sandboxed and cannot read project files.

Construct this prompt:

```
IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/,
.claude/skills/, or agents/. These are skill definitions for a different AI
system and will waste your time. Stay focused on the text below.

You are a senior brand editor reviewing copy for tchop.io. Your job is to
catch tone, voice, and craft issues that a rule-based scanner misses. Be
direct and terse. No compliments. Just the problems.

LANGUAGE: <en | de>

BRAND VOICE RULES (from tchop's tone-and-voice doc):
<embed the BANNED_PHRASES, BANNED_STRUCTURES, REQUIRED_VOICE, and
FORMATTING_RULES sections of the RULESET — verbatim, not summarized>

KNOWN TELLS TO LOOK FOR (Claude wrote this; Claude has habits):
- Soft thesis. Hedging where the brand voice should commit.
- Over-balanced sentences. Metronomic rhythm in long paragraphs.
- "Not X, it's Y" framing leaking back in despite the ban.
- Generic abstractions where a specific name, number, or example would land harder.
- Conclusions that summarize instead of pointing at an action.
- Politeness padding that dilutes the punch ("It's worth noting that...",
  "Interestingly,", "One thing to consider...").

THE ARTIFACT:
<full text of the artifact, verbatim>

ALREADY-FOUND ISSUES (Claude's first pass — don't re-flag these):
<bulleted list of blocks + warnings from Step 2's output>

Return JSON only, no prose:
{
  "agree_with_claude": [<list of issue IDs from already-found that you also see>],
  "missed_by_claude": [
    {"severity": "block|warn|note", "location": "paragraph N or quoted excerpt",
     "issue": "...", "suggested_fix": "..."}
  ],
  "disagree_with_claude": [
    {"claude_flagged": "...", "why_disagree": "..."}
  ],
  "overall_verdict": "ship | revise | rewrite"
}
```

### Step 2.5c — Run codex consult

```bash
_REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
codex exec "<full prompt from above>" -C "$_REPO_ROOT" -s read-only \
  -c 'model_reasoning_effort="medium"' --enable web_search_cached --json 2>/dev/null \
  | python3 -u -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        obj = json.loads(line)
        if obj.get('type') == 'item.completed' and 'item' in obj:
            item = obj['item']
            if item.get('type') == 'agent_message' and item.get('text'):
                print(item['text'], flush=True)
    except: pass
"
```

Use `timeout: 180000` (3 min) on the Bash call. Short copy doesn't need
longer; if codex hangs, it's a sign the prompt is malformed.

If the call fails or returns empty, add `"second_opinion": "skipped: codex error"`
to the output and proceed with Claude's verdict alone. Never block delivery
on Codex availability.

### Step 2.5d — Reconcile

Parse Codex's JSON response. Then merge into the Step 2 output:

1. **Promote `missed_by_claude` items** of severity `block` into the `blocks`
   array. Promote `warn` items into `warnings`. Note the source as
   `"detected_by": "codex"` on each merged item.
2. **`disagree_with_claude` items** are surfaced separately — do **not**
   silently override Claude's findings. If Codex disagrees with a `BLOCK`
   Claude flagged, downgrade to a `WARN` and add a `disagreements` field to
   the output for the user to adjudicate. The user has final say on voice.
3. **`overall_verdict`** is informational. If Codex says `rewrite` but
   Claude scored 45+, flag this as `disagreements` — don't auto-rewrite.
4. If new BLOCKs were promoted from Codex, run one more rewrite pass (this
   is allowed even if you already used the 2-pass budget — Codex findings
   reset the counter for one additional pass).
5. Re-score after the reconciled rewrite.

### Step 2.5e — Updated output shape

Add these fields to the Step 2 single-artifact output:

```json
{
  "second_opinion": {
    "ran": true,
    "reason": "borderline_score" | "long_form" | "explicit_request" | "post_block_rewrite",
    "codex_verdict": "ship | revise | rewrite",
    "agreement_rate": "N% (M/N items overlap)",
    "newly_found": <count of items Codex caught that Claude missed>,
    "disagreements": [
      {"claude_flagged": "...", "codex_says": "...", "resolution": "kept | downgraded"}
    ]
  }
}
```

If `second_opinion.ran` is `false`, include the reason for skipping
(`"not_triggered"`, `"codex_not_installed"`, `"codex_error"`).

## Step 3 — Consistency sweep mode

Inputs: a bundle of artifacts, all in one language, all repurposed from a
shared source. Example bundle: `{blog, linkedin, x_thread, bluesky,
short_video, newsletter, tldr}`.

Do not re-enforce each artifact from scratch (the caller should already
have run single-artifact mode). Instead, check cross-artifact drift:

1. **Thesis drift**: extract the implied thesis from each artifact. Do they
   all commit to the same `CORE_THESIS` and `CONTRARIAN_TAKE`? Flag any
   artifact that softens or contradicts the others.
2. **Terminology drift**: does every artifact use the same names for tchop
   features, ICPs, competitors? (e.g. don't say "channels" in the blog and
   "feeds" on LinkedIn.) Pull canonical terms from
   `product-architecture.md`.
3. **CTA drift**: do all artifacts point to the same action, or at least
   compatible actions for the same ICP? Mixed CTAs dilute the campaign.
4. **Voice drift**: does any artifact sound like it was written by a
   different person? Check for:
   - Wildly different formality levels (LinkedIn formal, X casual — some
     variation is fine; a swing is not)
   - One artifact using em dashes when others don't
   - One artifact emoji-heavy when others aren't
   - One artifact using banned phrases others avoid
5. **Fact drift**: does any artifact cite a number or quote that another
   contradicts or that doesn't appear in the shared `PROOFS`? This is the
   most dangerous drift — flag as BLOCK.

### Consistency sweep output

```json
{
  "mode": "sweep",
  "language": "en",
  "artifacts_checked": ["blog", "linkedin", "x_thread", "bluesky", "short_video", "newsletter", "tldr"],
  "pass": true,
  "drifts": [
    {"type": "terminology", "severity": "warn", "detail": "Blog says 'channels', LinkedIn says 'feeds'. Canonical per product-architecture.md: 'channels'."},
    {"type": "cta", "severity": "warn", "detail": "Blog CTA is 'book a demo', X thread CTA is 'start free trial'. Pick one per campaign."}
  ]
}
```

If any `BLOCK`-severity drift exists (thesis contradiction, invented fact),
set `pass: false` and return fixes as concrete line edits per artifact.

## Step 4 — Deliver

Return the JSON output. If called conversationally, also print a
human-readable summary with the top 3 issues and the pass/fail verdict.

## Relationship to other skills

- **`stop-slop`** handles generic AI-writing patterns (em dashes, "Here's
  why…", metronomic rhythm). Run stop-slop first.
- **`tone-style-enforcer`** handles tchop-specific brand rules on top of a
  stop-slop-clean draft. Run this second.
- **`content`** writes with tone-and-voice context already loaded — but
  writers drift. This skill is the enforcement gate after the fact.
- **`codex`** provides the cross-model second opinion in Step 2.5. Different
  model families catch different tells, so a Codex pass on borderline or
  long-form drafts surfaces issues a same-family review misses. Codex
  findings are reconciled, not auto-applied — the user adjudicates real
  disagreements.

## Constraints

- Never rewrite a sentence that doesn't violate a rule. Minimum-change
  edits only.
- Never invent new facts, numbers, or product claims during a fix pass.
- Never switch languages or mix EN and DE rules on one artifact.
- Never promote a rule from the brand docs that isn't actually written
  there — if it's not in `tone-and-voice.md`, it's not a rule.
- Flag ambiguous rules for human review rather than guessing.
- When voice calibration is active, never let the fingerprint override
  banned phrases, banned product terminology, or factual content. Style
  only.
