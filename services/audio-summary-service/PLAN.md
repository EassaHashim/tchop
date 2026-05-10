# Audio Summary Integration -- Implementation Plan

## Context

We validated a manual briefing pipeline: pull Lilien News activity via tchop MCP, generate a German script, convert to audio via ElevenLabs TTS, post as AUDIO card to a mix. Now we want to productize this as a reusable tchop integration that any organisation can self-configure.

The architecture follows the **scraper-service** blueprint exactly: Bun + Fastify + Supabase + setTimeout polling + tchop proxy pattern.

---

## Architecture: New Standalone Service

**`audio-summary-service/`** -- separate from scraper-service. Different domain (LLM + TTS vs web scraping), different dependencies, independent deploy. Shares the same Supabase project (different tables) and tchop API token.

```
audio-summary-service/
  src/
    index.ts                # Fastify + polling loop (copy from scraper)
    config.ts               # Env: Supabase, tchop, Claude, ElevenLabs
    types.ts                # AudioIntegration, GatheredContent, etc.
    poll.ts                 # Fetch due integrations, dispatch pipeline
    scheduling/
      cron.ts               # isDue() -- daily_HHmm / weekly_DOW_HHmm / interval_Xh
    pipeline/
      gather.ts             # Pull cards + comments + stats from tchop Graph API
      script.ts             # Claude API script generation (monologue or dialogue JSON)
      audio.ts              # ElevenLabs TTS, dialogue stitching, upload + publish
      stitch.ts             # Audio segment stitching: concat, pauses, fades (ffmpeg)
    services/
      supabase.ts           # Config CRUD, run logging, state updates
      graphapi.ts           # tchop read (content) + write (upload audio, create card)
      claude.ts             # Anthropic SDK wrapper
      elevenlabs.ts         # ElevenLabs REST API wrapper
      slack.ts              # Error notifications (copy from scraper)
    handlers/
      health.ts             # GET /health, GET /integrations/status
      integrations.ts       # POST/PATCH/DELETE /integrations
      preview.ts            # POST /preview -- dry-run (script only, no audio)
    middleware/
      auth.ts               # x-api-key (copy from scraper)
  supabase-migration.sql
  test-ui.html
  Dockerfile
  .env.example
  README.md
```

---

## Database Schema (Supabase)

### `audio_summary_integrations`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | bigint PK | auto | |
| `name` | text | required | Display name |
| `org_id` | text | required | tchop org slug |
| **Source scope** | | | |
| `source_scope` | text | 'one_channel' | 'one_channel' / 'one_mix' (v2: 'all_channels') |
| `source_channel_id` | numeric | required | Channel to summarize |
| `source_mix_id` | numeric | null | Required when source_scope = 'one_mix' |
| **Target** | | | |
| `target_channel_id` | numeric | required | Where to post the audio card |
| `target_mix_id` | numeric | required | |
| **Audio settings** | | | |
| `format` | text | 'monologue' | 'monologue' (single narrator) / 'dialogue' (two hosts) |
| `voice_id` | text | Daniel ID | ElevenLabs voice -- narrator (monologue) or Host A (dialogue) |
| `voice_id_b` | text | Sarah ID | ElevenLabs voice for Host B (dialogue only, ignored in monologue) |
| `language` | text | 'de' | Content language: controls script, TTS model, formatting (see Language) |
| `target_length` | text | '3min' | 1min / 2min / 3min / 5min / 10min |
| **Summary settings** | | | |
| `summary_period` | text | '24h' | 12h / 24h / 48h / 7d / 14d / 30d |
| `tone` | text | 'neutral' | neutral / enthusiastic / formal / casual / analytical |
| `additional_prompt` | text | null | Custom LLM instructions |
| `context_card_id` | numeric | null | Long Post card ID with brand/tone context (fetched each run) |
| `content_focus` | text | 'balanced' | balanced / discussions / new_content / engagement |
| `min_activity_threshold` | integer | 0 | Min cards+comments before generating (0 = always) |
| **Card template** | | | |
| `card_title_template` | text | '{type} -- {date}' | Supports {date}, {period}, {type}, {org} |
| `card_image_url` | text | null | Optional branded cover image URL |
| **Schedule** | | | |
| `schedule` | text | 'daily_0800' | daily_HHmm / weekly_DOW_HHmm / interval_Xh |
| `timezone` | text | 'Europe/Berlin' | |
| **Publishing** | | | |
| `auto_publish` | boolean | true | Draft vs published |
| `push_notification_text` | text | null | null = no push |
| **State** | | | |
| `is_active` | boolean | false | |
| `last_run_at` | timestamptz | null | |
| `last_error` | text | null | |
| `runs_completed` | integer | 0 | |

### `audio_summary_runs` (run log + cost tracking)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | |
| `integration_id` | FK | cascade delete |
| `created_at` | timestamptz | Record creation (DEFAULT now()) |
| `started_at` | timestamptz | Pipeline execution start |
| `completed_at` | timestamptz | |
| `status` | text | running / completed / failed / skipped_no_content |
| `cards_gathered` | integer | |
| `comments_gathered` | integer | |
| `script_text` | text | Preserved for debugging |
| `script_word_count` | integer | |
| `audio_duration_seconds` | integer | |
| `claude_input_tokens` | integer | Cost tracking |
| `claude_output_tokens` | integer | |
| `elevenlabs_characters` | integer | |
| `card_id` | numeric | tchop AUDIO card ID if posted |
| `error` | text | |

RLS on both tables, service_role only.

**Schema notes:**
- CHECK constraints on: `source_scope`, `format`, `language`, `target_length`, `summary_period`, `tone`, `content_focus`, `schedule` (regex)
- Indexes: `integrations(is_active)`, `runs(integration_id, status)`, `runs(started_at)`
- All `_id` columns use `numeric` consistently (tchop API returns numbers)

---

## Voice Picker

v1 ships with **curated presets** grouped by gender. The UI shows a dropdown with preview labels:

| Label | Gender | Voice ID | Style |
|-------|--------|----------|-------|
| Daniel | Male | `onwK4e9ZLuTAKqWW03F9` | Steady Broadcaster |
| George | Male | `JBFqnCBsd6RMkjVDRZzb` | Warm Storyteller |
| Brian | Male | `nPczCjzI2devNBz1zQrb` | Deep, Resonant |
| Charlie | Male | `IKne3meq5aSn9XLyUdCD` | Confident, Energetic |
| Sarah | Female | `EXAVITQu4vr4xnSDxMaL` | Mature, Reassuring |
| Alice | Female | `Xb7hH8MSUJpSbSDYk0k2` | Clear Educator |
| Lily | Female | `pFZP5JQG7iQjIQuC4Bku` | Warm, Professional |
| River | Neutral | `SAz9YHcvj6GT2YYXdXww` | Relaxed, Informative |

Plus a "Custom voice ID" text input for orgs with cloned voices.

**Dialogue default pairing:** When format is "dialogue", the UI suggests complementary pairs (e.g. Daniel + Sarah). `voice_id` = Host A (curious, introduces topics), `voice_id_b` = Host B (analytical, adds depth).

**v2:** Dynamic voice browser via `GET /v1/voices` (proxied through worker) with gender filter + audio preview button.

---

## Language (content language, not just TTS)

`language` controls four aspects at once:

| Aspect | `de` | `en` |
|--------|------|------|
| Script language | German | English |
| TTS model | `eleven_multilingual_v2` | `eleven_v3` (higher quality) |
| Words/minute target | ~130 | ~150 |
| Date/number formatting | "siebten April" | "April seventh" |
| Greeting/sign-off | "Guten Morgen" | "Good morning" |

The `model_id` is derived from `language` -- no separate setting needed. Additional languages (FR, ES, etc.) can be added later using `eleven_multilingual_v2` without architecture changes.

---

## Dialogue Format

Two modes, controlled by `format` setting:

### Monologue (default)
Single narrator reads the briefing. Script is flat text. One TTS call per run.

### Dialogue
Two AI hosts discuss the community activity in conversation. Much more engaging and listenable.

**Host roles:**
- **Host A** (`voice_id`): The curious one. Introduces topics, asks questions, reacts with enthusiasm.
- **Host B** (`voice_id_b`): The analytical one. Adds depth, offers opinions, provides context.

**Script structure:** JSON array of turns:
```json
[
  { "speaker": "A", "text": "Guten Morgen! Gestern war einiges los..." },
  { "speaker": "B", "text": "Ja, vor allem die Diskussion zum Bielefeld-Spiel..." },
  { "speaker": "A", "text": "Hagen hatte da eine interessante Analyse..." }
]
```

**Prompt rules for natural dialogue** (inspired by zarazhangrui/personalized-podcast):
- Sound like two friends chatting, not news anchors reading teleprompters
- Use contractions, incomplete sentences, natural speech patterns
- 1-4 sentences per turn -- no monologues
- Genuine reactions: surprise, skepticism, enthusiasm, humor
- Explain things naturally instead of jargon-dumping
- Host A drives the conversation forward, Host B adds insight

**Audio stitching:**
- Each turn is a separate TTS call with the corresponding voice
- 300ms silence between speaker turns for natural pacing
- 500ms fade-in at episode start
- 1000ms fade-out at episode end
- Stitching via ffmpeg (required dependency) or pydub-equivalent in Node

**Word count for dialogue:** ~20% more words than monologue for the same duration (back-and-forth creates natural pauses). Adjust targets accordingly.

---

## Brand Context via `context_card_id`

Admins create a **Long Post card** in an internal/unpublished mix containing brand context: who the org is, audience, vocabulary, style rules. The integration stores the card's ID in `context_card_id`.

On each run, the worker fetches the card content via Graph API and injects it into the Claude system prompt. Benefits:
- Non-technical admins edit context via the familiar card editor
- Context stays current without DB changes or redeployment
- Card can live in a hidden mix (not visible to end users)

If `context_card_id` is null, the worker uses a generic briefing prompt.

---

## Scheduling (replaces scraper's ms-based intervals)

`scheduling/cron.ts` exports `isDue(integration): boolean`:

- **`daily_HHmm`** (e.g. `daily_0800`): Current time in timezone >= 08:00 AND last_run_at before today's 08:00
- **`weekly_DOW_HHmm`** (e.g. `weekly_mon_0800`): Same + day-of-week check
- **`interval_Xh`** (e.g. `interval_12h`): Same as scraper's `ms()` logic (fallback)

Polling loop stays 60s -- execution accurate to within 1 minute.

---

## Pipeline Flow (per integration execution)

### Without approval (`require_approval: false`)
```
1. GATHER    -- tchop Graph API: cards, comments, engagement for time window
2. SCRIPT    -- Claude Sonnet: structured data -> spoken-word script
3. AUDIO     -- ElevenLabs TTS: script -> mp3 buffer
4. PUBLISH   -- Upload mp3 to tchop -> create AUDIO card -> optional push
```

### With approval -- DEFERRED TO v1.1

Depends on card status tags (deploying ~2026-04-14). Full design preserved here for reference:

- Script posted as POST card in auto-created review mix with status tag "draft"
- Editor reviews/edits, changes status to "approved"
- Worker detects, reads (edited) content, generates audio, sets status to "published"
- One pending per integration (new schedule replaces old pending)
- Before replacing, re-check if editor approved in the meantime (race condition mitigation)
- Timeout (default 72h to cover weekends) expires unreviewed scripts
- Script card includes metadata: period covered, creation time, expiration time
- Adds schema: `require_approval`, `review_mix_id`, `approval_timeout_hours` on integrations; `script_card_id`, `pending_approval`/`expired` statuses on runs
- Validate mix creation permissions when `require_approval` is first enabled

### 1. Gather (`pipeline/gather.ts`)

Reuses GraphQL queries from tchop-mcp-server (`src/index.ts`):
- `get_content_activity` -- aggregate stats for period
- `get_top_content` -- top cards by engagement
- `get_comments_feed` -- recent comments per channel
- `list_story_cards` -- recent cards with details

Source scope determines which channels/mixes to query. Empty result -> `skipped_no_content`, no API costs.

**Content budget:** Cap gathered content at ~8K tokens to prevent context overflow. Strategy: top 10 cards by engagement, top 15 comments by reactions, aggregate stats. Very active communities get summarized, not exhaustively listed.

### 2. Script (`pipeline/script.ts`)

- Model: Claude Sonnet (cost-efficient for summarization)
- Word count targets: derived from `language` + `target_length` + `format` (~130 wpm DE, ~150 wpm EN; dialogue +20%)
- **Monologue output:** flat text string
- **Dialogue output:** JSON array of `{ speaker: "A"|"B", text: string }` turns
- **Dialogue JSON robustness:** strip markdown code fences, validate array structure, fail run on malformed output (no silent fallback)
- System prompt includes:
  - TTS-optimized speech rules: numbers as words, no abbreviations, contractions OK, natural speech
  - For dialogue: "Sound like two friends chatting, not news anchors. 1-4 sentences per turn. Genuine reactions."
  - Brand context from `context_card_id` (fetched via Graph API, injected as-is)
  - `additional_prompt` for per-org customization
  - `tone` setting
  - `language` for script language + date formatting
- User prompt provides structured gathered content
- `content_focus` steers emphasis: discussions (comments-heavy), new_content (cards-heavy), engagement (trending), balanced (default)
- **Content rule: no metrics** (views/likes/counts) -- focus on what happened and what people said

### 3. Audio (`pipeline/audio.ts` + `services/elevenlabs.ts`)

**Monologue:**
- Single TTS call: `POST /v1/text-to-speech/{voice_id}`
- Returns mp3 buffer directly

**Dialogue:**
- One TTS call per turn, alternating `voice_id` (Host A) and `voice_id_b` (Host B)
- Stitch segments with 300ms silence between turns
- 500ms fade-in at start, 1000ms fade-out at end
- Stitching via ffmpeg (Bun shell exec) or pure-JS audio concat
- Concurrent TTS calls (up to 3) using `pooled()` for speed

**Shared settings:** stability=0.5, similarity_boost=0.75

**Error handling:**
- TTS calls: retry once with 2s backoff on 429/500. Fail the whole run on second failure (no partial audio).
- Claude: no retry (non-idempotent, different output each time). Failed script = failed run.
- ffmpeg stitching: fail run on error (malformed segments).
- Startup: check ffmpeg is in PATH if any dialogue integrations exist.

### 4. Publish (`pipeline/audio.ts`)

- Upload mp3 buffer to `/api/fs/upload/audio?organisation={org}`
- Create AUDIO card via `StoryCardPostInStory` mutation with `audioFields`
- Send push notification if `push_notification_text` is set

**Known blocker:** Production file upload rejects API tokens (staging works). Start on staging, switch when backend fix ships -- no code change needed.

---

## Files to Copy from Scraper Service

| File | Action |
|------|--------|
| `src/index.ts` | Copy verbatim (Fastify + polling loop) |
| `src/poll.ts` | Adapt: replace `executeCrawl/Scrape` with `executeAudioSummary` |
| `src/config.ts` | Adapt: add Claude/ElevenLabs keys, remove Firecrawl/Apify |
| `src/middleware/auth.ts` | Copy verbatim |
| `src/services/slack.ts` | Copy verbatim |
| `src/utils/async.ts` | Copy verbatim (`pooled()` for concurrent API calls) |
| `src/handlers/*.ts` | Adapt: change table names, fields |
| `test-ui.html` | Adapt: new form fields for audio settings |
| `Dockerfile` | Copy, update service name, **add ffmpeg** (`apt-get install ffmpeg`) for dialogue stitching |

## Key Reference Files

| File | What to reuse |
|------|--------------|
| `tchop-mcp-server/src/index.ts` | GraphQL queries for cards, comments, analytics (lines 100-800), AUDIO card mutation (lines 2276-2349) |
| `tchop-mcp-server/src/services/graphql.ts` | `uploadAudioFromUrl` pattern (lines 114-159), auth headers |
| `scraper-service/src/services/supabase.ts` | `fetchDueIntegrations`, `updateIntegrationState` patterns |
| `zarazhangrui/personalized-podcast` | Dialogue prompt patterns (PROMPT.md), audio stitching approach (speak.py), pacing constants |

---

## Feature Roadmap

### v1 (initial release)
- Core pipeline: gather, script, audio, publish
- **Dialogue + monologue formats** -- two-host conversation or single narrator
- Voice picker with curated presets + custom ID (two voices for dialogue)
- Language: DE / EN (controls script, TTS model, formatting)
- Brand context via `context_card_id`
- Content focus, tone, additional prompt, `min_activity_threshold`
- TTS-optimized prompt rules (natural speech, contractions, no jargon)
- Audio stitching for dialogue (per-turn TTS, 300ms pauses, fade in/out, ffmpeg)
- Card title template + optional cover image
- Scheduling: daily / weekly / interval with timezone
- Schedule validation on create/update (reject invalid formats)
- Push notification on publish
- Run log with cost tracking
- Health check: verify Supabase connectivity, ffmpeg presence
- TTS retry (once with 2s backoff), fail-fast on partial dialogue
- Content budget cap (~8K tokens) for active communities
- Test UI + preview endpoint

### v1.1 (after status tags ship)
- **Approval flow**: review via POST card in review mix using status tags (draft/approved/published)
- Schema additions: `require_approval`, `review_mix_id`, `approval_timeout_hours`, `script_card_id`
- Edge case handling: replacement, race conditions, timeout (72h default)

### v2 (future)
- `source_scope: "all_channels"` + `exclude_mixes`
- Dynamic voice browser with audio preview (proxied ElevenLabs API)
- Fish Audio as alternative TTS provider (cheaper for dialogue, 2M+ voices, 30+ languages incl. German)
- `intro_music` -- jingle/intro audio prepended to briefing
- `highlight_users` -- always mention certain users when active
- `publish_to_multiple_mixes` -- post to several mixes at once
- `archive_after_days` -- auto-unpublish old briefings
- Additional languages (FR, ES, etc.)

---

## Implementation Phases

1. **Skeleton** -- Copy scraper scaffold, wire config, create Supabase tables, implement scheduling
2. **Gather** -- GraphQL read queries, content assembly by scope/period
3. **Script** -- Claude API integration, prompt design, length control
4. **Audio + Publish** -- ElevenLabs TTS, tchop file upload + card creation
5. **API + UI** -- CRUD endpoints, preview endpoint, test-ui.html
6. **Polish** -- Run logging, push notifications, Docker, README

---

## Verification

1. Create integration via `POST /integrations` with lilien org, daily_0800 schedule
2. Use `POST /preview` to dry-run: verify gathered content + script quality
3. Manually trigger by setting `last_run_at` to null and `is_active` to true
4. Check staging tchop admin for the AUDIO card in target mix
5. Verify `audio_summary_runs` has complete cost tracking data
6. Test pause/resume via `PATCH /integrations/:id`

---

## Cost Estimate (per run, 3min German briefing)

| Service | Monologue | Dialogue | Notes |
|---------|-----------|----------|-------|
| Claude Sonnet | ~$0.025 | ~$0.025 | ~5K in + 600 out tokens |
| ElevenLabs | ~2,000 chars | ~2,400 chars | +20% for dialogue turns |
| ElevenLabs API calls | 1 | ~20 | Per-turn TTS in dialogue |
| tchop API | Free | Free | Internal |
| Supabase | Negligible | Negligible | |

**ElevenLabs plan guidance:** Starter ($22/mo, 100K chars) = ~40 daily briefings. Scale ($99/mo, 2M chars) = ~830 daily briefings. Professional for multi-org.
