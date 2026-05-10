# Lilien Matchday Curator

Automatically curates social media posts from a trusted list of Bluesky and X
accounts around SV Darmstadt 98 match windows, and publishes the best ones as
social cards to the Lilien News tchop mix.

## How it works

1. **Cron** runs `curate.py` every 5 minutes.
2. Script checks `matches.json`. If the current time is not within the match
   window (60 min before kickoff, full match, 60 min after final whistle), it
   exits immediately.
3. In-window: fetches recent original posts (no replies, no reposts) from every
   account listed in `config.json` via the Bluesky public API and X v2 API.
4. Filters out posts older than the window start and any URL already posted.
5. Sends the remaining candidates to Claude for ranking against the curation
   prompt (first-hand content, fan voice, no offensive or off-topic posts).
6. Publishes up to N cards per 20 minutes (rate-limited) to the configured
   tchop mix. `auto_publish=false` by default -- cards land as DRAFT until you
   flip the flag.

## Setup

```bash
cd lilien-matchday
python3 -m venv .venv        # optional
pip install -r requirements.txt   # zero deps -- uses stdlib only
```

Create or reuse a `.env` in the parent directory
(`/Users/heiko_scherer/claude-projects/.env`) with:

```
ANTHROPIC_API_KEY=...
X_BEARER_TOKEN=...
TCHOP_ORG=lilien
TCHOP_AUTH_TOKEN=...
TCHOP_API_CLIENT_ID=...
TCHOP_API_URL=https://tchop.io/api/graphql/webapp
```

(The script auto-loads `.env` from either `lilien-matchday/.env` or the parent
directory.)

## Configuration

### `config.json`
- `tchop.mix_id` -- target mix (19922 = Lilien News "news")
- `accounts.x` -- X usernames (without @)
- `accounts.bluesky` -- Bluesky handles
- `match_window` -- minutes before kickoff, match duration, minutes after
- `rate_limit` -- `max_posts` per `window_minutes` (default 3 per 20 min)
- `publishing.auto_publish` -- `false` = drafts only, `true` = publish live
- `curation_prompt` -- the Claude rubric for ranking posts

### `matches.json`
Manual list of upcoming fixtures. `kickoff` is an ISO 8601 timestamp with
timezone. Add new matches before each weekend.

### `state.json`
Auto-maintained. Tracks posted URLs (dedup, 14-day TTL) and publish log (rate
limit, 24h TTL). Do not edit by hand while the cron is running.

## Deployment (24/7 cron)

On any small VPS or local machine:

```cron
*/5 * * * * cd /path/to/lilien-matchday && /usr/bin/python3 curate.py >> curate.log 2>&1
```

Check `curate.log` for run history.

## Test locally

Dry-run with `auto_publish: false` -- nothing goes live, cards land as drafts:

```bash
python3 curate.py
```

To test outside a real match window, temporarily edit `matches.json` so the
window includes "now", then revert.

## Safety rails

- Only posts from the watched account list, never from anyone else.
- Only original posts -- replies and reposts are skipped.
- Match window gating prevents off-hours posting.
- Rate limit caps burst posting to 3 per 20 min.
- Drafts by default -- flip `auto_publish` after you trust the rankings.
