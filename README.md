# tchop claude-config

Shared Claude Code configuration for the tchop team -- skills, brand context, product domain knowledge, and project settings.

Clone this repo, keep it in sync with `git pull`, and Claude Code will automatically pick up the latest skills and context.

---

## Quick start

```bash
git clone git@github.com:HeikoScherer/claude-config.git claude-projects
cd claude-projects
```

Create a `.env` file in the project root with your API keys:

```bash
cp .env.example .env   # if an example exists, or create from scratch
```

```bash
DATAFORSEO_USERNAME="your-username"
DATAFORSEO_PASSWORD="your-password"
# Add other MCP server keys as needed
```

Then add this to your `~/.bash_profile` (or `~/.zshrc`) so keys are available in every session:

```bash
# Load .env keys into environment
set -a; source ~/claude-projects/.env; set +a
```

Restart your terminal, then open Claude Code in this directory -- everything loads automatically.

---

## What is this?

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) is Anthropic's AI coding agent that runs in your terminal. It reads configuration from `CLAUDE.md` and the `.claude/` directory at the repo root.

This repo stores that configuration so the whole team works from the same foundation: same brand context, same skills, same rules. Pull regularly to stay in sync. Push if you add or improve something.

---

## What are skills?

Skills are reusable prompt workflows stored as `SKILL.md` files. Each skill is a focused agent with specific instructions for a particular task -- SEO audits, cold email, frontend slides, copywriting, and more.

Claude Code loads skills automatically. Invoke them with `/skill-name` in the chat.

Skills live in two locations:

**`.claude/skills/`** -- 52 general-purpose skills:

```
.claude/skills/
├── ab-test-setup/           # A/B test planning and implementation
├── ad-creative/             # Ad headlines, descriptions, creative iteration
├── ai-seo/                  # Optimize content for AI search (GEO/AEO)
├── analytics-tracking/      # Analytics setup and measurement
├── churn-prevention/        # Cancellation flows, save offers, retention
├── cold-email/              # B2B cold email and outreach sequences
├── competitor-alternatives/  # Competitor comparison and alternatives pages
├── content-strategy/        # Content planning and topic selection
├── copy-editing/            # Edit and improve existing marketing copy
├── copywriting/             # Marketing copy for any page
├── cost-optimization/       # Cloud cost optimization
├── email-sequence/          # Drip campaigns and email sequences
├── find-skills/             # Discover and install new skills
├── form-cro/                # Form conversion optimization
├── free-tool-strategy/      # Free tool marketing strategy
├── frontend-slide/          # Single slide builder
├── frontend-slides/         # Full HTML presentation builder
├── last30days/              # Deep research across 10+ sources (last 30 days)
├── launch-strategy/         # Product launch planning
├── marketing-ideas/         # Marketing ideation and strategy
├── marketing-psychology/    # Psychological principles for marketing
├── onboarding-cro/          # Post-signup onboarding optimization
├── page-cro/                # Landing page conversion optimization
├── paid-ads/                # Google Ads, Meta Ads campaigns
├── paywall-upgrade-cro/     # In-app paywall and upgrade optimization
├── popup-cro/               # Popup and modal optimization
├── pricing-strategy/        # Pricing and packaging decisions
├── product-marketing-context/ # Product marketing context docs
├── programmatic-seo/        # Programmatic SEO at scale
├── referral-program/        # Referral and affiliate programs
├── revops/                  # Revenue operations and lead lifecycle
├── sales-enablement/        # Pitch decks, one-pagers, objection docs
├── schema-markup/           # Schema.org structured data
├── seo/                     # Comprehensive SEO analysis
├── seo-audit/               # Full technical SEO audit
├── seo-competitor-pages/    # SEO-optimized competitor pages
├── seo-content/             # Content quality and E-E-A-T analysis
├── seo-geo/                 # AI Overviews and AI search optimization
├── seo-hreflang/            # Hreflang and international SEO
├── seo-images/              # Image SEO and performance
├── seo-page/                # Single-page deep SEO analysis
├── seo-plan/                # Strategic SEO planning
├── seo-programmatic/        # Programmatic SEO analysis
├── seo-schema/              # Schema.org detection and generation
├── seo-sitemap/             # XML sitemap analysis and generation
├── seo-technical/           # Technical SEO checks
├── signup-flow-cro/         # Signup and registration optimization
├── site-architecture/       # Website structure and IA planning
├── social-content/          # Social media content creation
├── stop-slop/               # Remove AI writing patterns from prose
├── wordpress-pro/           # WordPress theme and plugin development
└── wp-rest-api/             # WordPress REST API development
```

**`.agents/skills/`** -- 5 specialized agent workflows:

```
.agents/skills/
├── frontend-design/     # Production-grade frontend interfaces
├── lead-scraper/        # LinkedIn lead scraping via PhantomBuster
├── linkedin-scout/      # LinkedIn prospect research
├── newsletter/          # Monthly newsletter generation
└── seo-audit/           # SEO audit workflow
```

Most skills come from the [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) collection. Feel free to test new skills and push them here if they're valuable.

---

## Repo structure

```
.
├── CLAUDE.md                           # Project instructions -- auto-loaded by Claude Code
├── .env                                # API keys and credentials (gitignored)
├── skills-lock.json                    # Tracks installed skill sources
│
├── .claude/
│   ├── skills/                         # All installed skills (52)
│   ├── commands/                       # Custom slash commands
│   │   ├── lead-scraper.md
│   │   └── newsletter.md
│   ├── context/                        # Brand and product context files (11)
│   │   ├── brand.md                    # Product positioning, voice, competitors, pricing
│   │   ├── product-architecture.md     # Product domain model, entity hierarchy, card types, roles
│   │   ├── tone-and-voice.md           # Writing style (EN)
│   │   ├── tone-and-voice-de.md        # Writing style (DE)
│   │   ├── messaging.md               # Key messaging and value props (EN)
│   │   ├── messaging-de.md            # Key messaging and value props (DE)
│   │   ├── sales-objections.md        # Objection handling by ICP segment
│   │   ├── tech-stack.md              # Infrastructure, security, technical facts
│   │   ├── design-system.md           # Brand colors, typography, illustration style
│   │   ├── content-inventory.md       # Full site and blog content inventory
│   │   └── icp-context.md            # ICP summary (compact version)
│   ├── settings.json                   # Shared permissions (committed)
│   └── settings.local.json             # Local overrides (gitignored)
│
├── .agents/
│   ├── icp-context.md                  # Detailed ICP profiles -- personas, pain points, decision makers
│   └── skills/                         # Specialized agent workflows (5)
│       ├── frontend-design/
│       ├── lead-scraper/
│       ├── linkedin-scout/
│       ├── newsletter/
│       └── seo-audit/
│
├── frontend-slides/                    # HTML presentation assets and templates
├── newsletter-editions/                # Generated newsletter files (MJML + ZIP)
├── output/                             # Exported data (lead CSVs, etc.)
├── tchop-SEO/                          # SEO audit reports and action plans
│
└── .gitignore
```

---

## Context files

All content and marketing skills load context from `.claude/context/` as configured in `CLAUDE.md`. The files split into three groups:

### Product & positioning

| File | When it's loaded |
|------|-----------------|
| [`brand.md`](./.claude/context/brand.md) | Every piece of content -- positioning, pricing, competitors, use cases |
| [`product-architecture.md`](./.claude/context/product-architecture.md) | Product domain work -- entity hierarchy (org > channel > mix > card), card types, roles, permissions, API surface, platform behavior |
| [`tech-stack.md`](./.claude/context/tech-stack.md) | IT/security copy, procurement objections, infrastructure claims |

### Voice & messaging

| File | When it's loaded |
|------|-----------------|
| [`tone-and-voice.md`](./.claude/context/tone-and-voice.md) | Any copywriting (EN) -- style rules, approved phrases, words to avoid |
| [`tone-and-voice-de.md`](./.claude/context/tone-and-voice-de.md) | Any copywriting (DE) |
| [`messaging.md`](./.claude/context/messaging.md) | Key messaging, value propositions, taglines (EN) |
| [`messaging-de.md`](./.claude/context/messaging-de.md) | Key messaging, value propositions, taglines (DE) |

### Sales & audience

| File | When it's loaded |
|------|-----------------|
| [`sales-objections.md`](./.claude/context/sales-objections.md) | Cold email, sequences, sales enablement -- objections by segment |
| [`icp-context.md`](./.claude/context/icp-context.md) | ICP summary -- compact version for quick reference |
| [`.agents/icp-context.md`](./.agents/icp-context.md) | Segment-specific content -- detailed personas, pain points, decision makers |

### Design

| File | When it's loaded |
|------|-----------------|
| [`design-system.md`](./.claude/context/design-system.md) | Frontend and design tasks -- brand colors, fonts, illustration guidelines |
| [`content-inventory.md`](./.claude/context/content-inventory.md) | Content planning -- what pages and posts exist, what's missing |

---

## Adding and updating skills

**Add a skill manually:** Create `.claude/skills/<skill-name>/SKILL.md`.

**From a GitHub repo:**
```bash
cp -r /path/to/cloned/repo/skills/cold-email .claude/skills/cold-email
```

**Share with the team:** Push your changes so others get them on next pull.

Skills can include additional reference files alongside `SKILL.md` that provide extra briefing.

After adding skills, restart Claude Code to load them.

---

## Settings and secrets

| File | Committed? | Purpose |
|------|-----------|---------|
| `.claude/settings.json` | Yes | Shared tool permissions |
| `.claude/settings.local.json` | No (gitignored) | Personal overrides |
| `.env` | No (gitignored) | API keys and credentials for MCP servers |

Store all API keys and MCP credentials in `.env` at the project root and source it from your shell profile (see Quick Start). Never commit real credentials.

---

## Keeping in sync

```bash
# Pull latest config from the team
git pull

# After making changes you want to share
git add -A
git commit -m "Add/update description of change"
git push
```

---

## Related

- [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code)
- [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) -- source for most skills in this repo
