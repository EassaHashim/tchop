# Design Harness for Claude Code

A practical guide to shipping design work as an engineer using Claude Code, based on the three-layer approach: skills for expertise, canvases for spatial work, inspiration for taste.

---

## Current State

### Already Installed

**Impeccable** (pbakaus) — the core design skill. Provides:
- `/audit` — find accessibility, contrast, spacing, and anti-pattern issues
- `/polish` — final pass for alignment, consistency, detail
- `/delight` — add micro-interactions and moments of joy
- `/typeset` — fix font choices, hierarchy, sizing, weight
- `/arrange` — improve layout, spacing, visual rhythm
- `/animate` — purposeful motion and transitions
- `/colorize` — add strategic color to monochromatic designs
- `/bolder` / `/quieter` — dial intensity up or down
- `/distill` — strip to essence, remove unnecessary complexity
- `/critique` — UX evaluation with actionable feedback
- `/normalize` — match design system, ensure consistency
- `/extract` — pull reusable tokens and components
- `/harden` — error handling, i18n, edge cases
- `/optimize` — performance across loading, rendering, images
- `/adapt` — responsive across screen sizes and contexts
- `/onboard` — first-time user experience flows
- `/overdrive` — technically ambitious implementations
- `/teach-impeccable` — one-time setup, persists design context

**Other installed design skills:**
- `/design-consultation` — creates DESIGN.md with full design system (colors, type, spacing, motion)
- `/design-review` — visual QA with before/after screenshots, iterative fixes
- `/frontend-design` — production-grade frontend interfaces, anti-generic-AI aesthetic
- `/frontend-slides` — HTML presentations with animation

### Not Yet Installed

**Emil Kowalski's Design Engineer Skill** — animation and UI polish from the Linear/Vercel school.
- GitHub: `github.com/emilkowalski/skill`
- Install: `npx skills add emilkowalski/skill`
- Free version covers his design thinking. Paid version bundles with animations.dev course.
- Best for: spring animations, dialog transitions, toast patterns, the small details most skip.

**Interface Design** (Dammyjay93) — persistent design memory across sessions.
- GitHub: `github.com/Dammyjay93/interface-design`
- Install: `npx skills add Dammyjay93/interface-design`
- Stores spacing grids, color palettes, depth strategies, component patterns in a `system.md` that auto-loads.
- Best for: stopping the problem where Claude forgets every design decision between sessions.

**UI Skills** (ibelick / Julien Thibeaut) — 15 open-source skills for baseline coverage.
- GitHub: `github.com/ibelick/ui-skills`
- Install: `npx skills add ibelick/ui-skills`
- Covers baseline UI, accessibility, motion performance, metadata.
- Best for: broad foundational coverage, accessibility checks.

---

## Optimal Setup Sequence

### Phase 1: Foundation (do once)

1. **Install missing skills**
   ```bash
   npx skills add emilkowalski/skill
   npx skills add Dammyjay93/interface-design
   npx skills add ibelick/ui-skills
   ```

2. **Run `/teach-impeccable`** — gathers design context for the project, saves to AI config. This gives Impeccable persistent knowledge of your design decisions.

3. **Run `/design-consultation`** — creates `DESIGN.md` with your full design system: aesthetic direction, typography scale, color palette, spacing grid, motion principles. This becomes the single source of truth that all other skills should reference.

4. **Connect Paper via MCP** — Paper (paper.design) exposes MCP tools for read/write access to a real HTML/CSS canvas. Add the MCP server config so Claude Code can manipulate designs in Paper directly.

5. **Connect Pencil via MCP** (optional) — Pencil (pencil.dev) uses a JSON-based `.pen` format that's Git-diffable. Useful for version-controlled design files in the repo. Swarm mode lets multiple agents work the canvas simultaneously.

### Phase 2: Per-Project Setup

1. **Create or update `DESIGN.md`** via `/design-consultation` for each new project
2. **Run `/teach-impeccable`** if the project has different design constraints
3. **Set up Interface Design's `system.md`** to persist spacing, color, depth, component patterns

### Phase 3: Per-Feature Workflow

```
1. Gather references      — browse Variant/Cosmos/Mobbin, collect visual DNA
2. Design in canvas       — Paper or Pencil via MCP, rough layout
3. Build in code          — /frontend-design for the implementation
4. Audit                  — /audit to catch anti-patterns
5. Typography pass        — /typeset to fix font hierarchy
6. Layout pass            — /arrange to fix spacing and rhythm
7. Polish                 — /polish for alignment and consistency
8. Delight                — /delight for micro-interactions
9. Responsive             — /adapt for screen sizes
10. Final review          — /design-review with screenshots
```

Not every feature needs all ten steps. A small UI change might just be steps 3, 4, 7. A new page or flow gets the full treatment.

---

## Skill Overlap and When to Use What

| Task | Primary Skill | Secondary |
|------|--------------|-----------|
| New page or component from scratch | `/frontend-design` | Impeccable for polish after |
| Fix ugly AI-generated UI | `/audit` then `/polish` | `/typeset` if fonts are the problem |
| Add animation and motion | `/animate` | Emil's skill for spring physics |
| Make something feel alive | `/delight` | `/overdrive` for ambitious effects |
| Responsive breakpoints | `/adapt` | — |
| Design system creation | `/design-consultation` | `/extract` to pull tokens from existing work |
| Session-persistent design memory | Interface Design (`system.md`) | `/teach-impeccable` for Impeccable-specific |
| Accessibility audit | `/audit` | UI Skills for deeper a11y checks |
| Visual QA with screenshots | `/design-review` | `/critique` for UX-focused feedback |
| Tone down aggressive design | `/quieter` | `/distill` to strip further |
| Pump up boring design | `/bolder` | `/colorize` for color specifically |
| Presentation / pitch deck | `/frontend-slides` | Impeccable commands for polish |

---

## Canvas Tools (Layer 2)

### Paper (paper.design)
- Canvas built on real HTML/CSS — what you design is actual code
- MCP tools with full read/write access
- Good for: design systems, design tokens, page iterations
- Use as source of truth alongside building the product
- Free tier with limited MCP call quotas

### Pencil (pencil.dev)
- JSON-based `.pen` format, Git-diffable
- Design files live in your repo, versioned like code
- Swarm mode: up to six agents working the canvas simultaneously
- Currently free
- Good for: version-controlled design, multi-agent collaboration

### How canvases connect to Claude Code
Both expose MCP servers. Claude Code reads the canvas state, makes changes via MCP tools, and the canvas updates live. The gap is visual feedback — Claude can read structure but can't see the rendered result unless you screenshot it or the canvas provides a visual snapshot endpoint.

---

## Inspiration Tools (Layer 3)

### Variant (variant.com)
- Generate non-repeating design interpretations from text prompts
- Style Dropper: absorb visual DNA from any design, transfer to another
- Export as React or copy prompts with HTML references
- Bridge from inspiration to implementation

### Cosmos (cosmos.so)
- Collect and organize visual inspiration across disciplines
- Hex color search, description-based discovery
- Build clusters of references that shape design thinking

### Mobbin (mobbin.com)
- Curated mobile app and website design patterns
- Search by flow type: onboarding, settings, checkout, etc.
- Figma plugin for pulling references directly

### Awwwards (awwwards.com)
- Jury-scored cutting-edge web design
- Conferences and academy for deeper learning

### Current limitation
These tools have no MCP integration. You browse them visually, then translate what you saw into prompts for Claude. The taste transfer happens through your words, which is lossy.

---

## Tasks Left

### High Priority

- [ ] **Install Emil Kowalski's skill** — fills the animation/polish gap between Impeccable's motion commands and what Linear-quality UI requires
- [ ] **Install Interface Design** — solves the session amnesia problem where design decisions get lost between conversations
- [ ] **Install UI Skills** — broader accessibility and baseline coverage
- [ ] **Run `/teach-impeccable`** on the current project to persist design context
- [ ] **Run `/design-consultation`** to create a project-level `DESIGN.md` if one doesn't exist
- [ ] **Set up Paper MCP server** in Claude Code settings — enables direct canvas manipulation

### Medium Priority

- [ ] **Set up Pencil MCP server** — for Git-versioned design files
- [ ] **Create a unified design memory** — right now each skill stores decisions separately (Impeccable in its config, Interface Design in `system.md`, design-consultation in `DESIGN.md`). Consolidate into one `DESIGN.md` that all skills read.
- [ ] **Build a screenshot feedback loop** — connect `preview_screenshot` or canvas screenshot endpoints so Claude can see its design changes after each edit, enabling autonomous iteration

### Low Priority / Future

- [ ] **Variant MCP integration** — if/when Variant exposes an API, build an MCP server so Claude can pull inspiration references and extracted design tokens directly
- [ ] **Cosmos MCP integration** — same idea, pull saved collections as visual references
- [ ] **Cross-skill orchestration** — a meta-command that runs audit, routes findings to the right specialist skill, and iterates until clean. Something like `/design-review` but spanning all installed design skills.
- [ ] **Swarm design workflow** — use Pencil's multi-agent mode with specialized agents (one for typography, one for layout, one for color) working the canvas in parallel

---

## Architecture: How It All Fits Together

```
DESIGN.md (source of truth)
    |
    +-- /teach-impeccable (Impeccable reads this)
    +-- system.md (Interface Design reads this)
    +-- All skills reference this for tokens, palette, type scale
    |
INSPIRATION (manual, no MCP yet)
    |
    +-- Variant: generate directions, extract style
    +-- Cosmos: collect references, discover patterns
    +-- Mobbin/Awwwards: study best-in-class patterns
    |
    v
CANVAS (MCP connected)
    |
    +-- Paper: HTML/CSS canvas, real code output
    +-- Pencil: JSON format, Git-versioned, swarm mode
    |
    v
CLAUDE CODE (the kernel)
    |
    +-- /frontend-design: build from scratch
    +-- /audit: catch problems
    +-- /typeset + /arrange + /colorize: targeted fixes
    +-- /polish + /delight: final quality
    +-- /design-review: visual QA with screenshots
    +-- /adapt: responsive
    +-- preview_screenshot: visual feedback loop
```

The user provides taste and direction. The skills provide expertise. The canvas provides a spatial surface. Claude Code ties it all together and does the actual work.
