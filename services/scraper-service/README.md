# tchop Scraper Service

Content monitoring service for [tchop.io](https://tchop.io). Watches websites for new articles and automatically creates content cards in tchop channels via the Graph API.

## How It Works

```
User configures integration (URL to monitor, target channel/mix)
                    |
            [Supabase config DB]
                    |
            [Worker polls every 60s]
                    |
        +-----------+-----------+
        |                       |
  Firecrawl /map           Apify fallback
  (sitemap-based,          (JS rendering,
   fast, cheap)             for complex pages)
        |                       |
        +-----------+-----------+
                    |
            New URLs found?
                    |
              Dedup check
          (processed_items table)
                    |
       +------------+------------+
       |                         |
  Article card              Long Post (beta)
  Firecrawl /scrape         Firecrawl /extract
  (metadata only)           (clean article body
                             via LLM extraction)
       |                         |
       +------------+------------+
                    |
           Create card in tchop
          (Graph API mutation)
                    |
       Upload image + set fields
       (title, abstract, source,
        author, teaser style)
                    |
            Update Supabase state
         (cumulative counters)
```

### Discovery Layer

**Two-tier URL discovery:**

1. **Firecrawl map** (primary) -- discovers article URLs from a site's sitemap. Fast (~2s), cheap, works for most news sites. User enters a section URL (e.g. `spiegel.de/politik/`) and map finds articles listed there.
2. **Apify Web Scraper** (fallback) -- only triggers when map returns 0 results. Opens the page in a real browser, waits for JS to render, extracts links. Handles JS-heavy pages like spiegel.de/schlagzeilen. Costs negligible credits (~0.004 CU per page on Apify Starter plan).

### Extraction Layer

After discovering new URLs, the worker scrapes each one:

- **Article cards** -- uses Firecrawl `/scrape` (1 credit). Extracts metadata: title, description, image, author, source name.
- **Long Post cards (beta)** -- uses Firecrawl `/extract` with LLM (token-based credits). Extracts clean article body as markdown (no navigation, footer, share buttons). Converts markdown to tchop Long Post blocks (headings, paragraphs, lists, images, quotes). Also runs a regular scrape for image/source metadata.
- **Apify + Long Post** -- when URLs come from the Apify fallback, Long Post is not available (Apify only discovers URLs, doesn't extract content). The worker automatically downgrades to Article card in this case.

### Content Processing

- **Title cleaning** -- strips SEO site name suffixes ("- DER SPIEGEL") using three methods: batch detection across multiple titles (3+ matching suffix), og:site_name matching, and a `looksLikeSiteName` heuristic (all caps, contains dots, title case). Falls back to extracting a readable title from the URL slug when no title metadata is available.
- **Image filtering** -- detects and skips site logos, favicons, and placeholder images. Cards are created without a teaser image rather than showing the site's logo. Checks for patterns: favicon, logo, icon, apple-touch, brand, default-og, placeholder, and small dimension indicators in the URL.
- **Source name** -- priority: source_override (user-configured) > og:site_name (from metadata) > domain name (e.g. "spiegel.de").
- **Author** -- extracted from metadata fields: `author`, `twitter:data1`, `article:author`.
- **Description dedup** -- Firecrawl sometimes returns duplicated metadata ("text., text."). The mapper strips these.

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- [Supabase](https://supabase.com) project (free tier works)
- [Firecrawl](https://firecrawl.dev) API key (Growth plan, $49/mo)
- [Apify](https://apify.com) API token (optional, for JS fallback)
- tchop Graph API access (staging or production)

### 1. Install dependencies

```bash
bun install
```

### 2. Create Supabase tables

Run `supabase-migration.sql` in your Supabase SQL Editor. Creates three tables:

- `scraper_integrations` -- integration config (URL, schedule, card settings)
- `processed_items` -- URL dedup with unique constraint on (integration_id, url)
- `scraper_last_content` -- change detection for watch-page mode

All tables have RLS enabled with access restricted to the `service_role` key only.

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service_role secret key |
| `FIRECRAWL_API_KEY` | Yes | Firecrawl API key |
| `TCHOP_API_URL` | Yes | tchop GraphQL endpoint (e.g. `https://tchop-staging.com/api/graphql/webapp`) |
| `TCHOP_API_TOKEN` | Yes | tchop auth token |
| `TCHOP_ORG` | Yes | tchop organisation slug (e.g. `quantum`) |
| `APIFY_TOKEN` | No | Apify API token (enables JS fallback for complex pages) |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook for error alerts |
| `PORT` | No | HTTP port (default: 3000) |

### 4. Run

```bash
# Development (with watch mode, auto-restarts on code changes)
bun run dev

# Production
bun run start

# With auto-restart wrapper (local, restarts on crash)
./start.sh
```

## Docker Deployment

### Build and run

```bash
docker build -t tchop-scraper .

docker run -d \
  --name tchop-scraper \
  --restart=unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  tchop-scraper
```

### Auto-restart behavior

| Scenario | Docker behavior |
|----------|----------------|
| Worker crashes | Restarts automatically |
| VPS reboots | Docker daemon starts, restarts container |
| Manual `docker stop` | Stays stopped |
| Out of memory | Restarts automatically |

The Dockerfile includes a `HEALTHCHECK` that pings `/health` every 60s. After 3 failed checks, Docker marks the container unhealthy.

### Current deployment

The service is deployed on a Hetzner Cloud CX22 VPS (Nuremberg, Germany) with Docker CE. The `.env` file on the server contains all credentials. To redeploy:

```bash
# From local machine
rsync -avz --exclude='node_modules' --exclude='bun.lock' \
  scraper-service/ root@<SERVER_IP>:/opt/scraper-service/

ssh root@<SERVER_IP> "cd /opt/scraper-service && \
  docker build -t tchop-scraper . && \
  docker rm -f tchop-scraper && \
  docker run -d --name tchop-scraper --restart=unless-stopped \
    -p 3000:3000 --env-file .env tchop-scraper"
```

### Monitoring

```bash
docker ps                              # container status + health
docker logs tchop-scraper --tail 50    # recent logs
docker logs tchop-scraper -f           # follow logs live
```

## API Endpoints

All endpoints except `/health` require authentication via `x-api-key` header matching the `TCHOP_API_TOKEN`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Service health, integration count, uptime |
| `GET` | `/integrations/status` | Yes | All integrations with cumulative stats and errors |
| `POST` | `/integrations` | Yes | Create a new integration (SSRF-protected) |
| `PATCH` | `/integrations/:id` | Yes | Update integration settings (pause, resume, edit config) |
| `DELETE` | `/integrations/:id` | Yes | Delete an integration and its dedup history |
| `POST` | `/preview` | Yes | Test/preview before saving (runs discovery once, SSRF-protected) |

### Preview request

```json
{
  "monitoring_mode": "crawl",
  "source_url": "https://www.spiegel.de/politik/",
  "max_pages": 5
}
```

Returns discovered articles with title, description, source, and URL. If Firecrawl map returns 0 results and Apify is configured, automatically falls back to browser rendering.

### Create integration

```json
{
  "name": "Spiegel Politik",
  "org_id": "quantum",
  "channel_id": 2381,
  "mix_id": 60962,
  "monitoring_mode": "crawl",
  "source_url": "https://www.spiegel.de/politik/",
  "card_type": "article",
  "auto_publish": true,
  "include_images": true,
  "source_override": "DER SPIEGEL",
  "teaser_style": "SMALL_WITH_TEXT",
  "max_pages": 10,
  "initial_backfill": 5,
  "schedule_interval": "1h",
  "is_active": true
}
```

### Pause / Resume / Edit

```bash
# Pause
PATCH /integrations/:id  {"is_active": false}

# Resume
PATCH /integrations/:id  {"is_active": true}

# Change settings
PATCH /integrations/:id  {"source_override": "SPIEGEL", "teaser_style": "BIG_WITHOUT_TEXT"}
```

## Integration Settings

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | required | Display name for the integration |
| `monitoring_mode` | `"crawl"` | required | Discovery mode (crawl is the primary mode) |
| `source_url` | string | required | URL to monitor. Enter the section page, e.g. `https://www.spiegel.de/politik/` |
| `card_type` | `"article"` or `"longpost"` | `"article"` | Article creates a link card. Long Post (beta) creates native content with the article body |
| `auto_publish` | boolean | `true` | `true` = published immediately. `false` = saved as draft for editor review |
| `include_images` | boolean | `true` | Upload article images to tchop. Logos/favicons are filtered out automatically |
| `source_override` | string or null | null | Custom source name. If empty, uses og:site_name from the page, then falls back to the domain name |
| `teaser_style` | enum or null | null | Teaser layout when image is present: `STANDARD`, `SMALL_WITH_TEXT`, `SMALL_WITHOUT_TEXT`, `BIG_WITHOUT_TEXT` |
| `max_pages` | number | 50 | Max articles discovered per run (1-200). Controls Firecrawl credit usage |
| `initial_backfill` | number | 0 | How many articles to pull on the very first run. 0 = start monitoring from now, no history. Subsequent runs use `max_pages` |
| `schedule_interval` | string | `"1h"` | How often to check for new articles: `15m`, `30m`, `1h`, `4h`, `12h`, `1d` |
| `is_active` | boolean | `false` | Enable/disable. Paused integrations are skipped during polling |
| `mix_id` | number | required | The tchop mix (story) ID where cards are created. Required because tchop's mutation needs a storyId |
| `channel_id` | number | required | The tchop channel ID |
| `org_id` | string | required | The tchop organisation slug |

### Card Type Details

**Article** (default, recommended)
- Creates a link card that opens the original article in a browser
- Extracts: title, description, image, author, source name from page metadata
- Works with both Firecrawl and Apify discovery
- 1 Firecrawl credit per article

**Long Post** (beta)
- Creates a native tchop content card with the full article body
- Uses Firecrawl's LLM-powered extract endpoint to get clean article markdown
- Converts markdown to tchop block format (headings, paragraphs, lists, images, quotes, code)
- Only works when URLs are discovered via Firecrawl map (not Apify). If Apify fallback was used, automatically downgrades to Article card
- Costs more credits (token-based extraction) but produces richer content
- Quality depends on the source page structure. Works well for blog posts and news articles with clear article body. May include unwanted content on pages with complex layouts

### Counters

`items_found` and `items_posted` are **cumulative lifetime totals**, not per-run counts. They accumulate across all poll cycles for the integration's lifetime.

### Pause / Resume Behavior

- Pausing sets `is_active: false`. The worker skips the integration on each poll cycle.
- Resuming sets `is_active: true`. The worker picks up the integration on the next poll cycle.
- On resume, only articles currently visible on the page are discovered. Articles published during the pause that have since rotated off the page are not backfilled.

## Content Field Mapping

### Article Cards

| Firecrawl metadata | tchop articleFields | Notes |
|--------------------|---------------------|-------|
| `metadata.title` (cleaned) | `title` | SEO suffix stripped |
| `metadata.description` | `abstract` | Duplicates removed |
| `metadata.ogImage` | `gallery[].image.id` | Uploaded to tchop, logos filtered out |
| `metadata.ogSiteName` or domain | `sourceName` | Override via `source_override` |
| `metadata.author` | `contentAuthor` | From author, twitter:data1, or article:author |
| `sourceURL` | `url` | Article link (opens in browser) |
| (empty string) | `headline` | Not used (reserved for editorial comments in tchop) |
| `teaser_style` setting | `styles.teaserImageStyle` | Only when image is present |
| `auto_publish` setting | `status` | `PUBLISHED` or `DRAFTED` |

### Long Post Cards

| Source | tchop postFields | Notes |
|--------|------------------|-------|
| Firecrawl extract `body` | `contentBlocks` | Markdown converted to block format |
| Firecrawl extract `title` | `title` | Clean title from LLM extraction |
| Firecrawl scrape `ogImage` | `gallery[].image.id` | From separate scrape call |
| Firecrawl scrape `ogSiteName` | `sourceName` | From separate scrape call |
| Firecrawl extract `author` | `contentAuthor` | From LLM extraction |

## tchop Graph API Integration

The worker uses the `StoryCardPostInStory` mutation from tchop's Graph API. This is the same mutation used by the [n8n-nodes-tchop](https://www.npmjs.com/package/n8n-nodes-tchop) package.

### Authentication

tchop uses custom headers (not standard Bearer auth):

| Header | Value |
|--------|-------|
| `x-tchop-token` | Auth token |
| `x-tchop-webapp-organisation` | Org slug |
| `Authorization` | `Bearer <token>` |
| `Cookie` | `mz-account=<token>` |

### Image Upload

Images are uploaded to tchop before card creation:
1. Download image from source URL
2. Upload to `<tchop-base>/api/fs/upload/image?organisation=<org>`
3. Receive image ID
4. Include `gallery: [{ image: { id } }]` in the mutation

### URL Uniqueness

tchop's API returns `StoryCardUrlUniquenessConflictError` if a card with the same URL already exists in the mix. The worker treats this as a successful dedup (not an error).

## Deduplication

Two layers ensure no duplicate cards:

1. **Per-integration URL dedup** -- atomic `INSERT ON CONFLICT DO NOTHING` on the `processed_items` table with a unique constraint on `(integration_id, url)`. A URL is only processed once per integration. Records are permanent (never pruned) to prevent re-posting.
2. **tchop mutation-level dedup** -- the `StoryCardUrlUniquenessConflictError` prevents duplicate URLs within the same mix, catching edge cases where the same URL appears across different integrations targeting the same mix.

### Credit optimization

The map-then-scrape approach minimizes Firecrawl costs:
1. Map discovers URLs (cheap, single API call)
2. Dedup check filters to only new URLs (free, local DB check)
3. Only genuinely new URLs are scraped (1 credit each)

A typical run: map finds 10 URLs, 8 are already in dedup table, 2 are new = 2 credits (not 10).

## Error Handling and Notifications

### Error surfacing

Errors appear in three places:
- **stdout** -- visible in `docker logs tchop-scraper`
- **Supabase** -- `last_error` column, visible in the status endpoint and test UI
- **Slack** -- if `SLACK_WEBHOOK_URL` is configured, sends to your alert channel

### Slack notifications

| Event | Notification |
|-------|-------------|
| Integration error (scrape/crawl failure, card creation error) | Full error details + integration name, source URL, channel/mix IDs |
| Auth failure (tchop API token expired) | Alert + integration auto-paused |
| Firecrawl quota exhausted | Alert + all integrations paused |

### Auto-recovery

- **Auth failures** automatically pause the affected integration (`is_active: false`) to prevent repeated failed API calls
- **Firecrawl timeouts** are caught per-integration and don't block other integrations
- **Invalid schedule_interval** values are caught per-integration (skipped with error log, doesn't crash the worker)

## Security

- **SSRF protection** -- the `/preview` and `POST /integrations` endpoints validate source URLs. Private/internal addresses (localhost, 10.x, 192.168.x, 169.254.169.254, .local, .internal) are blocked.
- **RLS policies** -- Supabase tables are restricted to the `service_role` key. The `anon` key has no access.
- **Auth on all endpoints** -- every endpoint except `/health` requires the `x-api-key` header.
- **No secrets in browser** -- the test UI stores the API token in localStorage. In production, the tchop proxy handles all auth.

## Test UI

Open `test-ui.html` in a browser. Configure the worker URL and API token once (saved in localStorage).

**Features:**
- Health check with status indicator
- Preview/test before saving (shows discovered articles with titles, descriptions, source names)
- Create new integrations with all settings
- Integration status table with cumulative found/posted counters
- Pause/Resume toggle per integration
- Delete integrations
- All card settings: type (Article / Long Post beta), teaser layout, source override, auto-publish, include images, backfill, schedule

The test UI talks directly to the worker API. In production, the tchop admin frontend replaces this and goes through the tchop backend proxy.

## Project Structure

```
src/
  index.ts              Entry point (Fastify HTTP server + setTimeout polling loop)
  config.ts             Environment config (all from env vars)
  types.ts              Shared TypeScript types (MonitoringMode, CardType, TeaserStyle)
  poll.ts               Polling loop (fetch due integrations, dispatch by mode)
  middleware/
    auth.ts             Shared x-api-key auth check
    validation.ts       URL validation (SSRF protection)
  modes/
    crawl.ts            Find Articles mode (map -> dedup -> scrape/extract -> post)
    scrape.ts           Watch Page mode (single URL change detection)
  services/
    firecrawl.ts        Firecrawl API (map, scrape, extract, title cleaning, image filtering)
    apify.ts            Apify Web Scraper (JS fallback when map returns 0)
    graphapi.ts         tchop Graph API (card creation, image upload, URL dedup)
    supabase.ts         Supabase client (config read, dedup write, state update)
    slack.ts            Slack webhook notifications
  pipeline/
    dedup.ts            Atomic URL claim (INSERT ON CONFLICT)
    mapper.ts           Content -> card field mapping (buildCard, toArticleCard, toLongPostCard)
  handlers/
    preview.ts          POST /preview (discovery + preview response)
    health.ts           GET /health + GET /integrations/status
    integrations.ts     CRUD for integrations (POST, PATCH, DELETE)
```

## Cost

| Service | Plan | Monthly cost | What it covers |
|---------|------|-------------|----------------|
| Hetzner CX22 | VPS (2 vCPU, 4GB) | ~4 EUR | Docker host, auto-restart |
| Firecrawl | Growth (50k credits) | $49 | Map discovery + article scraping |
| Apify | Starter (existing) | $0 extra | JS fallback (~0.004 CU/page) |
| Supabase | Free | $0 | Config DB + dedup table |
| **Total** | | **~$53/mo** | |

### Firecrawl credit usage per operation

| Operation | Credits | When |
|-----------|---------|------|
| Map (discover URLs) | 1 | Every poll cycle per integration |
| Scrape (article metadata) | 1 per article | Only for new articles (after dedup) |
| Extract (Long Post body) | 5-20+ per article | Only for Long Post card type. Token-based, varies by article length. Major cost driver. |

### Cost optimization approach

The service is designed to minimize Firecrawl credits:

1. **Map first, scrape only new.** Map discovers URLs (1 credit per call), dedup filters to only genuinely new URLs, then only those get scraped. A typical hourly cycle: 1 map credit + 1-2 scrape credits = 2-3 total.

2. **Low default `max_pages`.** Default is 10 (not 50). For hourly polling, most sites publish 1-3 new articles per hour. 10 URLs from map is enough to catch them without paying to dedup 40+ already-seen URLs.

3. **Extract only when needed.** The expensive Firecrawl extract endpoint (LLM-powered, 5-20+ credits per article) is only called when `card_type: "longpost"` is set. Article cards (the default) never trigger extract. Use Long Post sparingly for high-value content.

4. **Apify fallback is cheap.** When Firecrawl map returns 0 (JS-heavy pages), Apify renders the page for ~0.004 CU (~$0.001). Negligible cost on the existing Starter plan.

### Estimated credit usage by scenario

| Scenario | Credits/day | Monthly |
|----------|------------|---------|
| 1 Article integration, hourly, max_pages=10 | ~25 | ~750 |
| 5 Article integrations, hourly | ~125 | ~3,750 |
| 10 Article integrations, hourly | ~250 | ~7,500 |
| 1 Long Post integration, hourly | ~50-100 | ~1,500-3,000 |
| 5 Article + 1 Long Post, hourly | ~175-225 | ~5,250-6,750 |

Growth plan (50,000 credits/month) comfortably supports 10-15 Article integrations at hourly polling, or 5 Article + 2 Long Post integrations.

### Avoiding credit waste

- **Don't reset dedup during testing.** Each reset causes all URLs to be re-scraped. Use preview/test mode instead.
- **Use longer poll intervals.** 4h or daily for low-volume sources instead of hourly.
- **Prefer Article over Long Post.** Article = 1 credit/article. Long Post = 6-21 credits/article (extract + scrape).
- **Keep max_pages low.** 10 for hourly, 20 for daily. Only increase if the source publishes many articles per cycle.

## Production Integration with tchop

The test UI talks directly to the worker API. In production, the tchop admin frontend does NOT talk to the worker or Supabase directly. Instead:

```
Admin UI  -->  tchop backend proxy  -->  Supabase (read/write config)
                                    -->  Worker API (preview/test)
```

**Assumptions for production:**

- The tchop backend proxy handles authentication and org scoping. The browser never sees the Supabase service key or the worker API token.
- The proxy forwards preview requests to the worker and returns results to the frontend.
- Integration CRUD goes through the proxy to Supabase. The worker's `/integrations` CRUD endpoints exist for testing but may be bypassed in production if the proxy writes to Supabase directly.
- The worker uses a single tchop API token (`TCHOP_API_TOKEN`) that has permission to create cards in any org. This is intentional -- the service manages integrations across all client orgs from one central process.
- The worker authenticates its own endpoints via `x-api-key` header matching the tchop token. In production, only the tchop proxy should be able to reach the worker (same network or IP allowlist).

## Known Limitations

- **JS-heavy pages without sitemaps** -- Apify fallback handles most cases (spiegel.de/schlagzeilen works), but sites with unusual frontend architectures (bild.de uses web components that jQuery can't traverse) may not extract article links reliably.
- **Long Post content quality** -- depends on the source page structure. Works well for blog posts and news articles with clear body content. Complex layouts or paywalled content may produce incomplete or noisy results.
- **Long Post + Apify** -- Long Post mode is not available when URLs are discovered via the Apify fallback. The worker automatically downgrades to Article cards in this case.
- **Single API token** -- one tchop token for all orgs (by design, the service manages cross-org integrations from a single process).
- **No edit UI** -- the test UI supports create, pause/resume, and delete. Editing integration settings requires using the PATCH API endpoint directly or the Supabase dashboard. The production tchop admin frontend will have full edit support.
- **Watch Page mode** -- exists in the code (scrape.ts) for monitoring a single URL for content changes. Less commonly needed than Find Articles (crawl) mode. Creates a card when the page's title, description, or image changes.

## Tested Sites

| Site | Discovery | Article | Long Post | Notes |
|------|-----------|---------|-----------|-------|
| blog.tchop.io | Firecrawl map | OK | OK | Clean extraction |
| spiegel.de/politik | Firecrawl map | OK | OK | Title suffix stripped |
| spiegel.de/schlagzeilen | Apify fallback | OK | Downgraded to Article | JS-rendered headlines page |
| fr.de/eintracht-frankfurt | Firecrawl map | OK | OK | No og:site_name, uses domain |
| fr.de/politik | Firecrawl map | OK | OK | |
| bild.de/darmstadt | Apify (partial) | Limited | N/A | Unusual frontend, only 1 link extracted |
