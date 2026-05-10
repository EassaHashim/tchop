# LinkedIn Post Scraper Service -- Implementation Plan

## Overview

Standalone service that monitors LinkedIn profiles and automatically imports posts as social cards into tchop channels. Fully independent from the web scraper service -- own codebase, own Hetzner VPS, own Supabase project.

## Architecture

```
linkedin-service/            (new project folder in claude-projects/)
        |
   [Supabase]                (new project, free tier)
        |
   [Worker: Bun + Fastify]   (new Hetzner CX22, Nuremberg, ~4 EUR/mo)
        |
   [Apify: harvestapi/       (existing Starter plan, $0.002/post)
    linkedin-profile-posts]
        |
   [tchop Graph API]         (same staging token as web scraper)
        |
   [Slack #integrationalert] (same webhook as web scraper)
```

### Why separate from the web scraper?

- Different API (Apify vs Firecrawl)
- Different card type (social vs article/longpost)
- Different failure modes (LinkedIn blocks vs sitemap delays)
- Independent deployment cycles
- Clean isolation: LinkedIn issues don't affect web scraping and vice versa

### What's shared

- tchop Graph API token (same cross-org token)
- Slack webhook URL (same #integrationalert channel)
- Apify subscription (same Starter plan)
- Code patterns (polling loop, dedup, auth, Slack notifications copied from scraper-service)

---

## Apify Actor: harvestapi/linkedin-profile-posts

### Why this actor?

| Criteria | harvestapi | apimaestro |
|----------|-----------|------------|
| Price | $0.002/post | $0.005/post |
| Success rate | 99.9% | 100% |
| Users | 7,800 | 16,000 |
| Rating | 4.9/5 | 4.7/5 |
| No cookies | Yes | Yes |
| Date filter | Built-in (24h, week, month) | Manual pagination |
| Batch input | Multiple profile URLs | Single username |
| Images | Full array with dimensions | Yes |
| Avatar | Yes (author.avatar.url) | Need separate call |
| Reposts | Detected (repostedBy field) | Unknown |
| Engagement | Likes, comments, shares, reactions | Unknown |

### Input parameters

```json
{
  "targetUrls": ["https://www.linkedin.com/in/heikoscherer/"],
  "maxPosts": 10,
  "postedLimit": "week",
  "includeReposts": true,
  "includeQuotePosts": true,
  "scrapeReactions": false,
  "scrapeComments": false
}
```

### Output per post (key fields)

```json
{
  "type": "post",
  "id": "7447172579288715264",
  "linkedinUrl": "https://www.linkedin.com/posts/heikoscherer_journalists-curate-...",
  "content": "Full post text...",
  "author": {
    "name": "Heiko Scherer",
    "publicIdentifier": "heikoscherer",
    "info": "CEO & Founder at tchop...",
    "avatar": {
      "url": "https://media.licdn.com/dms/image/...",
      "width": 800,
      "height": 800,
      "expiresAt": 1776902400000
    }
  },
  "postedAt": {
    "timestamp": 1775544304678,
    "date": "2026-04-07T06:45:04.678Z"
  },
  "postImages": [
    {
      "url": "https://media.licdn.com/dms/image/...",
      "width": 1500,
      "height": 900,
      "expiresAt": 1776902400000
    }
  ],
  "repostedBy": null,
  "engagement": {
    "likes": 3,
    "comments": 0,
    "shares": 0,
    "reactions": [{"type": "LIKE", "count": 3}]
  }
}
```

---

## Field Mapping: LinkedIn Post -> tchop Social Card

### Main mapping table

| Apify field | Example | tchop quoteFields | Notes |
|-------------|---------|-------------------|-------|
| `content` | "Journalists curate all day..." | `quote` | Full post text body |
| `author.name` | "Heiko Scherer" | `quotePerson` | Author display name |
| `author.publicIdentifier` | "heikoscherer" | `quotePersonHandle` | LinkedIn username |
| `author.avatar.url` | CDN URL (800x800) | `quotePersonImageId` | Upload to tchop, cache per profile |
| `linkedinUrl` | "linkedin.com/posts/heiko..." | `url` | Post permalink. Opens LinkedIn on click. |
| `postedAt.date` | "2026-04-07T06:45:04.678Z" | `quoteCreated` | ISO 8601 timestamp. Required by API. |
| `postImages[0].url` | CDN URL (1500x900) | `gallery[0].image.id` | Upload image to tchop first |
| `postImages[1].url` | (if multiple) | `gallery[1].image.id` | Upload each, add all to gallery |
| -- | -- | `quoteSource` | Always `"LINKEDIN"` (hardcoded) |
| -- | -- | `headline` | Empty string (no editorial comment) |
| `auto_publish` setting | true/false | `status` | `"PUBLISHED"` or `"DRAFTED"` |

### Special cases

| Scenario | Apify data | Handling |
|----------|-----------|---------|
| **Repost** | `repostedBy` is not null | Use original author for quotePerson. Include or skip based on `include_reposts` setting per integration. |
| **Text-only post** | `postImages` is empty | Social card with text only, no gallery. Valid card. |
| **Multiple images** | `postImages` has 2+ items | Upload all images, add all to gallery array. |
| **Video post** | `postImages` empty, video in post | Create social card with text + LinkedIn post URL. Video plays on LinkedIn when user clicks through. No video download/upload. |
| **Document/carousel** | Document post type | Create as text-only social card. Document content not extractable. |
| **Profile mentions** | `contentAttributes` with type PROFILE_MENTION | Keep plain text. Mention metadata not needed for the card. |
| **Engagement data** | `engagement.likes`, `.comments`, `.shares` | Not mapped to card fields. Available for future filtering (e.g., only import posts with >10 likes). |
| **Repost attribution** | `header.text` = "Heiko Scherer reposted this" | Alternative repost detection. If `repostedBy` is set, original author goes in quotePerson. |

### Profile avatar caching

LinkedIn avatar URLs expire (~30 days based on `expiresAt` field).

Strategy:
1. First scrape of a profile: download avatar, upload to tchop via `/api/fs/upload/image`, store the tchop image ID in the integration row (`avatar_image_id` column)
2. Subsequent scrapes: reuse the cached tchop image ID (no re-upload)
3. Re-upload trigger: when `avatar_updated_at` is older than 7 days, re-upload (avatar may have changed)
4. The avatar is per-integration (one profile = one avatar), not per-post

### tchop Graph API mutation

Uses the same `StoryCardPostInStory` mutation as the web scraper, but with `quoteFields` instead of `articleFields` or `postFields`:

```typescript
const input = {
  storyId: mixId,
  fields: {
    quoteFields: {
      url: post.linkedinUrl,
      quotePerson: post.author.name,
      quotePersonHandle: post.author.publicIdentifier,
      quotePersonImageId: avatarImageId,
      quoteCreated: post.postedAt.date,
      quoteSource: "LINKEDIN",
      headline: "",
      quote: post.content,
      gallery: uploadedImages,
    },
    status: autoPublish ? "PUBLISHED" : "DRAFTED",
  },
};
```

---

## Supabase Schema (new project)

### Table: `linkedin_integrations`

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | int8 | identity | PK | Row ID |
| `name` | text | -- | NOT NULL | Display name ("Heiko LinkedIn") |
| `org_id` | text | -- | NOT NULL | tchop org slug |
| `channel_id` | numeric | -- | NOT NULL | Target channel |
| `mix_id` | numeric | -- | NOT NULL | Target mix (required for posting) |
| `profile_url` | text | -- | NOT NULL | LinkedIn profile URL to monitor |
| `auto_publish` | boolean | true | NOT NULL | Publish immediately or save as draft |
| `include_reposts` | boolean | true | NOT NULL | Include reposts or skip them |
| `schedule_interval` | text | '1h' | NOT NULL | Poll frequency (15m, 30m, 1h, 4h, 12h, 1d) |
| `max_posts` | integer | 10 | NOT NULL | Max posts per scrape (controls Apify cost) |
| `initial_backfill` | integer | 5 | NOT NULL | Posts to pull on first run |
| `is_active` | boolean | false | NOT NULL | Enable/disable (pause/resume) |
| `last_run_at` | timestamptz | -- | NULLABLE | Last poll timestamp |
| `items_found` | integer | 0 | NOT NULL | Cumulative posts found |
| `items_posted` | integer | 0 | NOT NULL | Cumulative posts created in tchop |
| `last_error` | text | -- | NULLABLE | Last error message |
| `avatar_image_id` | text | -- | NULLABLE | Cached tchop image ID for profile avatar |
| `avatar_updated_at` | timestamptz | -- | NULLABLE | When avatar was last uploaded to tchop |
| `created_at` | timestamptz | now() | NOT NULL | Row creation time |

### Table: `processed_items`

Same structure as web scraper (proven pattern):

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| `id` | int8 | PK, identity | Row ID |
| `integration_id` | int8 | FK -> linkedin_integrations, ON DELETE CASCADE | Which integration |
| `url` | text | NOT NULL | LinkedIn post URL (dedup key) |
| `processed_at` | timestamptz | DEFAULT now() | When processed |
| | | UNIQUE (integration_id, url) | Dedup constraint |

### RLS policies

Same as web scraper: RLS enabled, full access `TO service_role` only. Anon key has no access.

---

## Project Structure

```
linkedin-service/
  src/
    index.ts              Fastify HTTP server + setTimeout polling loop + graceful shutdown
    config.ts             Env vars: SUPABASE_URL/KEY, APIFY_TOKEN, TCHOP_*, SLACK_WEBHOOK, PORT
    types.ts              LinkedInIntegration, LinkedInPost, SocialCardPayload
    poll.ts               Fetch due integrations, dispatch, sequential processing

    services/
      apify.ts            scrapeLinkedInProfile(profileUrl, maxPosts, postedLimit) -> LinkedInPost[]
      graphapi.ts         createSocialCard(mixId, card) using quoteFields + image upload
      supabase.ts         fetchDueIntegrations, updateState, claimUrl, avatar cache read/write
      slack.ts            notifyError, notifyAuthFailure (same pattern as web scraper)

    pipeline/
      dedup.ts            claimAndCheck(integrationId, postUrl) -- atomic INSERT ON CONFLICT
      mapper.ts           mapLinkedInPost(post, integration) -> SocialCardPayload

    handlers/
      preview.ts          POST /preview (scrape profile once, return posts for review)
      health.ts           GET /health, GET /integrations/status, GET /ui (serves test-ui.html)
      integrations.ts     POST/PATCH/DELETE /integrations (CRUD)

    middleware/
      auth.ts             x-api-key check (same as web scraper)

    utils/
      async.ts            pooled() concurrency helper

  test-ui.html            Config UI served at /ui (LinkedIn profile URL input, preview, status table)
  supabase-migration.sql  Schema for both tables + RLS policies
  Dockerfile              FROM oven/bun:1, HEALTHCHECK, CMD bun run src/index.ts
  .env.example            All env var templates
  start.sh                Auto-restart shell wrapper for local dev
  README.md               Full documentation
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | New Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (not anon) |
| `APIFY_TOKEN` | Yes | Apify API token (existing account) |
| `TCHOP_API_URL` | Yes | tchop GraphQL endpoint (staging or production) |
| `TCHOP_API_TOKEN` | Yes | tchop auth token (same as web scraper) |
| `TCHOP_ORG` | Yes | tchop org slug (e.g., "quantum") |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook for error alerts |
| `PORT` | No | HTTP port (default: 3000) |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Service health, integration count, uptime |
| `GET` | `/ui` | No | Test UI (HTML page) |
| `GET` | `/integrations/status` | Yes | All integrations with cumulative stats |
| `POST` | `/integrations` | Yes | Create new LinkedIn integration |
| `PATCH` | `/integrations/:id` | Yes | Update settings (pause, resume, edit) |
| `DELETE` | `/integrations/:id` | Yes | Delete integration + dedup history |
| `POST` | `/preview` | Yes | Scrape profile once, return posts for review |

### Preview request

```json
{
  "profile_url": "https://www.linkedin.com/in/heikoscherer/",
  "max_posts": 5
}
```

### Create integration

```json
{
  "name": "Heiko LinkedIn",
  "org_id": "quantum",
  "channel_id": 2381,
  "mix_id": 60962,
  "profile_url": "https://www.linkedin.com/in/heikoscherer/",
  "auto_publish": true,
  "include_reposts": true,
  "max_posts": 10,
  "initial_backfill": 5,
  "schedule_interval": "1h",
  "is_active": true
}
```

---

## Polling Flow

```
Every 60s: check Supabase for due integrations
  |
  For each due integration:
    |
    1. Call Apify: harvestapi/linkedin-profile-posts
       Input: profile URL, maxPosts, postedLimit based on schedule
       Output: array of LinkedInPost objects
    |
    2. Filter reposts (if include_reposts = false, skip posts with repostedBy)
    |
    3. For each post:
       a. Dedup check: INSERT ON CONFLICT on processed_items
       b. If already processed: skip
       c. If new:
          - Upload post images to tchop (if any)
          - Upload/refresh avatar (if needed)
          - Map to SocialCardPayload
          - Call createSocialCard via Graph API
          - Update cumulative counters
    |
    4. On first run (last_run_at is null):
       Limit to initial_backfill posts (not max_posts)
    |
    5. Update integration state:
       last_run_at, items_found (cumulative), items_posted (cumulative), last_error
    |
    6. On error: log, update last_error, send Slack notification
    |
    7. On auth error: pause integration (is_active = false), Slack alert
```

---

## Deduplication

Same two-layer approach as web scraper:

1. **Per-integration URL dedup** -- atomic `INSERT ON CONFLICT DO NOTHING` on `processed_items` with unique constraint on `(integration_id, url)`. LinkedIn post URLs are stable.

2. **tchop mutation-level dedup** -- `StoryCardUrlUniquenessConflictError` prevents duplicate URLs within the same mix. Handled gracefully (not treated as error).

LinkedIn post IDs are also available (`entityId` field) and could be used for additional dedup if URL format changes.

---

## Test UI (test-ui.html)

Served at `/ui` on the worker. Features:

- **Connection**: worker URL (auto-detects origin) + API token (saved in localStorage)
- **Health check**: green/red status indicator
- **Preview**: enter LinkedIn profile URL, see recent posts with author, text snippet, images, engagement
- **Create integration**: all fields (profile URL, org/channel/mix, auto-publish, include reposts, schedule, backfill)
- **Status table**: all integrations with cumulative found/posted, last run, errors, pause/resume/delete buttons

---

## Deployment

### Infrastructure setup

1. **Hetzner Cloud**: Create CX22 (Docker CE image, Nuremberg, ~4 EUR/mo)
2. **Supabase**: Create new project (free tier), run migration SQL
3. **Docker**: Build and run with auto-restart

### Deploy commands

```bash
# From local machine
rsync -avz --exclude='node_modules' --exclude='bun.lock' \
  linkedin-service/ root@<SERVER_IP>:/opt/linkedin-service/

ssh root@<SERVER_IP> "cd /opt/linkedin-service && \
  docker build -t tchop-linkedin . && \
  docker rm -f tchop-linkedin && \
  docker run -d --name tchop-linkedin --restart=unless-stopped \
    -p 3000:3000 --env-file .env tchop-linkedin"
```

### Monitoring

```bash
docker ps                                # container status + health
docker logs tchop-linkedin --tail 50     # recent logs
docker logs tchop-linkedin -f            # follow live
curl http://<SERVER_IP>:3000/health      # health check
```

---

## Cost

| Service | Plan | Monthly cost |
|---------|------|-------------|
| Hetzner CX22 | VPS (2 vCPU, 4GB) | ~4 EUR |
| Supabase | Free | $0 |
| Apify | Starter (existing), $0.002/post | ~$1.50 for 5 profiles x 5 posts/day |
| **Total** | | **~5.50 EUR/mo** |

### Apify cost breakdown

| Scenario | Posts/day | Daily cost | Monthly |
|----------|----------|-----------|---------|
| 5 profiles, ~5 new posts/day each | 25 | $0.05 | $1.50 |
| 10 profiles, ~5 posts/day | 50 | $0.10 | $3.00 |
| 20 profiles, ~5 posts/day | 100 | $0.20 | $6.00 |

All within Apify Starter plan (100 CU/month). The actor charges per post ($0.002), not per compute unit.

---

## Error Handling

Same pattern as web scraper:

| Error type | Handling |
|-----------|---------|
| Apify timeout/failure | Log, update last_error, Slack alert, retry next cycle |
| tchop API auth failure (401) | Pause integration, Slack alert |
| Image upload failure | Skip image, create card without it |
| Avatar upload failure | Skip avatar, create card without profile image |
| Supabase connection error | Retry, crash if persistent (Docker restarts) |
| Invalid schedule_interval | Skip integration, log warning |

---

## Verification Checklist

1. Preview: enter LinkedIn profile URL, see recent posts with text, author, images
2. Save integration, wait for poll cycle
3. Social cards appear in tchop staging with correct author, text, images, LinkedIn link
4. Avatar image visible on the social card
5. Reposts: included when setting is on, skipped when off
6. Video posts: text-only social card with LinkedIn URL (no video)
7. Multiple images: all uploaded and in gallery
8. Dedup: second poll doesn't create duplicates
9. Backfill: first run pulls exactly initial_backfill posts
10. Cumulative counters: found/posted increase over time
11. Pause/resume/delete work from test UI
12. Slack notification on error
13. Health endpoint returns status
14. Auto-restart after container crash (Docker --restart=unless-stopped)

---

## Future Considerations (not in v1)

- **Company page monitoring**: Apify has `apimaestro/linkedin-company-posts` for company pages. Same architecture, different actor input.
- **Engagement filtering**: Only import posts with >X likes. Data is available from Apify.
- **Comment import**: Apify can scrape comments ($0.002/comment). Could create thread cards in tchop.
- **Cross-platform**: Same service could monitor X/Twitter, Instagram if Apify actors exist.
- **Webhook notifications**: Notify tchop admin when new LinkedIn posts are imported.
