# tchop — Marketing & Communication DESIGN.md

Visual system for marketing and communication artefacts: landing pages, pitch decks, social graphics, sales collateral, ads, newsletter, blog headers, conference assets.

This file complements `DESIGN.md` (the broader product+brand system). When a deliverable touches **product UI**, follow the parent DESIGN.md. When it speaks to the **market** — prospects, journalists, customers as audience — follow this file.

Source: tchop.io live site, `.claude/context/brand.md`, `.claude/context/tone-and-voice.md`, Notion CI page, Figma illustrations.

Last updated: 2026-04-25.

---

## 1. Register

**brand** — design IS the artefact. Marketing surfaces don't serve a workflow, they sell a worldview. Generosity, contrast, opinionated typography, considered illustration. Never apply product-UI restraint here by reflex.

---

## 2. Audience & Scene

Marketing pieces are read by a comms lead, HR director, publisher, or community manager — usually on a 14–16 inch laptop in a daytime office, often skimming between meetings. Pitch decks are presented in conference rooms or on a shared screen. Newsletter is read in Outlook or Gmail on mobile, in commute or coffee mode.

The dominant scene is **bright, professional, mid-energy daylight**. Light theme is the default. Dark sections appear as deliberate contrast moments, not as the canvas.

---

## 3. Color

### Strategy

**Committed** with strategic Drenched moments.

- Marketing pages carry the brand identity — orange does real work, 30–40% of the visual weight on hero and key sections.
- Dark Indigo sections (`#43445B`, `#2D2D46`) appear as drenched contrast moments: hero backgrounds, dividers between content blocks, footer.
- Yellow and Blue are supporting voices — used in illustrations, charts, callouts, never for primary CTAs.

The product UI uses Restrained color (orange ≤10%). Marketing reverses that ratio on purpose.

### Primary palette

| Name | Hex | OKLCH | Use |
|------|-----|-------|-----|
| tchop Orange | `#F6704D` | `oklch(0.69 0.16 35)` | Primary CTA, brand accent, hero highlights, pull-quote color, illustration dominant |
| Indigo Dark | `#43445B` | `oklch(0.34 0.04 273)` | Drenched dark sections, hero alternates, illustration canvas |
| Indigo Footer | `#2D2D46` | `oklch(0.25 0.05 274)` | Footer, deepest contrast, video backgrounds |
| Yellow | `#FFD138` | `oklch(0.87 0.16 90)` | Highlight bursts, illustration accents, occasional eyebrow text on dark |
| Blue | `#488ED8` | `oklch(0.63 0.13 245)` | Informational callouts, links in body copy, illustration accents |

### Surface palette

| Name | Hex | Use |
|------|-----|-----|
| Off-white | `#F1F1F3` | Page background — never `#FFFFFF` |
| Paper | `#F8F8FA` | Card background, subtle alternation between sections |
| White | `#FFFFFF` | Reserved for product screenshots, mobile mockups, foreground panels on dark |

**Never use `#000` or `#FFF` for surfaces.** Pure black and pure white look cheap next to the warm orange. Tint every neutral toward Indigo (chroma ≈ 0.005–0.01).

### Text on backgrounds

| On surface | Text | Hex |
|------------|------|-----|
| Off-white / Paper | Indigo Dark | `#1A1A2E` |
| Indigo Dark / Footer | Off-white | `#F1F1F3` |
| Orange (any) | Off-white | `#F1F1F3` |
| Yellow | Indigo Dark | `#1A1A2E` |
| Blue | Off-white | `#F1F1F3` |

Body links on light surfaces: Blue `#488ED8`. Never orange — orange is reserved for CTAs and brand emphasis, otherwise it dilutes.

### Bans

- No purple/violet gradients.
- No teal-on-black SaaS palette (the AI-slop reflex for "tech B2B").
- No pastel washes.
- No second accent color competing with orange. If a piece needs another color, it's Yellow or Blue from the palette, used briefly.

---

## 4. Typography

### Typeface

**Basier Circle** — sole brand typeface across web, decks, social, email.

- Web: self-hosted woff2, latin + latin-extended subset (covers ä ö ü ß).
- Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`.
- **Never substitute** Inter, Roboto, Manrope, or system fonts in marketing artefacts. If Basier Circle is unavailable in the tool (e.g. a quick LinkedIn carousel), prefer setting the file in the fallback stack rather than reaching for Inter.

Italic: not used. Emphasis is by weight, color, or size — never italic body type.

### Marketing scale (display-leaning)

Marketing types larger than product UI. The Display step matters here — it doesn't exist in dashboards.

| Role | Size | Weight | Line height | Tracking |
|------|------|--------|-------------|----------|
| Display XL (hero, pitch deck title) | `clamp(3rem, 7vw, 6rem)` | 700 | 1.05 | -0.025em |
| Display L (section opener) | `clamp(2.5rem, 5vw, 4rem)` | 700 | 1.1 | -0.02em |
| H1 | `clamp(2rem, 4vw, 3rem)` | 700 | 1.15 | -0.015em |
| H2 | `clamp(1.5rem, 3vw, 2.25rem)` | 600 | 1.2 | -0.01em |
| Lead (sub-hero, pitch deck body) | `clamp(1.25rem, 2vw, 1.5rem)` | 400 | 1.45 | 0 |
| Body | `clamp(1rem, 1.5vw, 1.125rem)` | 400 | 1.6 | 0 |
| Small / caption | `clamp(0.875rem, 1.25vw, 1rem)` | 400 | 1.5 | 0 |
| Eyebrow / kicker | `clamp(0.75rem, 1vw, 0.875rem)` | 600 | 1.3 | 0.08em, UPPERCASE |

The eyebrow above section headlines is a marketing convention worth keeping — it gives editorial rhythm. Use it sparingly, never on every section.

### Pull quotes

Set at H2–H3 size, weight 400 (lighter than headline weight to feel quoted, not shouted), Indigo Dark color on light surfaces or Orange `#F6704D` color on dark Indigo. Open and close with proper German typographic quotes when in DE: „…" — not `"…"`. EN uses curly: "…".

### Body copy line length

Cap at 65–75ch on landing pages and blog posts. Pitch deck body cap shorter, 50–60ch. Newsletter content is 600–680px column; line length follows naturally.

---

## 5. Headline voice in design

The voice from `tone-and-voice.md` constrains the *shape* of marketing typography. Headlines are direct, declarative, often two clauses joined by a comma — never em dash, never semicolon. Examples from tchop.io:

- "Community built for humans, empowered by AI agents."
- "Run a powerful community without a large team."
- "A social layer that fits your brand."

Design implications:
- Headlines wrap to 2–3 lines on desktop. Don't force single-line setting at huge widths — it loses rhythm. Use `text-wrap: balance` for a tidy wrap.
- Avoid all-caps display headlines. The brand's confidence comes from tight tracking and weight contrast, not shouting.
- One headline per fold. No stacked H1 + H1.

---

## 6. Layout

### Container

Max content width **1200px** for landing pages, **1280px** for blog editorial, **1440px** for media-heavy hero compositions. Sides have generous breathing room — never edge-to-edge text on desktop.

### Grid

12-column on desktop, 8 on tablet, 4 on mobile. Marketing layout is *grid-disciplined but not grid-shy*: half-offsets, single-column hero asides, and asymmetric two-column splits (e.g. 7+5, 4+8) are all in scope when they earn their place.

### Vertical rhythm

| Token | Value | Use |
|-------|-------|-----|
| Section S | 64px | Tight content blocks within a section |
| Section M | 96px | Standard section gap |
| Section L | 128px | Major divisions (hero → next, dark → light) |
| Section XL | 192px | Premium pages: hero closer, big claim, customer logos block |

Breaking these is allowed when a piece feels cramped — never when it feels too sparse. The site's default mistake is *too tight*, not too airy.

### Section rhythm

Alternate light → light-with-pattern → dark → light again. Two consecutive light sections without contrast becomes a wall. Two consecutive dark sections becomes oppressive.

The pattern overlay observed on tchop.io (faint white-square SVG grid on dark Indigo) is a brand signature. Use it on the first dark section of any page; don't repeat on every dark band.

### Cards and containers

Cards are not the default. Most marketing layouts read better as headline + supporting paragraph + image, separated by whitespace, not bordered.

When cards are the right answer (customer logos with quote, feature trio):

| Property | Value |
|----------|-------|
| Background | `#F8F8FA` on light surfaces, `#373E4B` on dark |
| Border | none (use background tint to separate, not 1px lines) |
| Radius | 16px (`--radius-xl`) — marketing cards are softer than product cards |
| Shadow | none, or single `0 1px 2px rgba(26,26,46,0.06)` for subtle lift |
| Padding | 32px (S) / 40px (M) / 48px (L) |

Never stack a card inside a card. Never apply a side-stripe accent border.

---

## 7. Imagery

### Three families, one rule per family

**Family A — Illustrations.** Source: Figma `tchop new Illus 2022-2024`. Flat/semi-flat, dark Indigo `#373E4B` canvas, orange-dominant accents, optional yellow + blue, occasional white UI element layered in.

Use for: hero scenes on top-funnel pages, blog cover art, abstract concept communication ("community", "automation", "AI agents").

**Family B — Product screenshots.** Real mobile and web tchop UI, framed in light or dark device mockup, often on a tinted Off-white or Indigo background. Crop to show the meaningful interface element, not the whole chrome of the device.

Use for: feature pages, pricing page, case studies, anywhere the product story is the message.

**Family C — Customer photography (rare).** Only headshots in testimonial circles, ~64px diameter, on light surface. No lifestyle stock, no team photos in landing heroes, no abstract photography of crowds or laptops. The brand's anti-stock stance is non-negotiable.

### When to use what

| Surface | Primary | Secondary |
|---------|---------|-----------|
| Top-funnel hero | Illustration | — |
| Feature / solution page | Product screenshot | Illustration accent |
| Pricing | Product screenshot | — |
| Case study | Customer logo + product screenshot | Headshot for quote |
| Blog cover | Illustration | Branded typographic banner (HTML+Playwright) |
| Pitch deck | Mix: illustration on dividers, screenshot on feature slides | Customer logo grid |
| Social (LinkedIn, X) | Branded typographic card or product screenshot on color | Illustration crop |
| Newsletter header | Typographic banner | Illustration crop |

### Screenshot treatment

- Device frame: yes for full-app context (mobile mockup, browser frame). No for cropped UI details.
- Shadow: `0 24px 48px rgba(26,26,46,0.12)` on light surface. Drop the shadow on dark surface — let the device blend.
- Background: tinted Off-white `#F1F1F3` or Orange tint at 10% opacity. Never gradient backgrounds.
- Cropping: show only what supports the headline. Whole-screen screenshots are usually wrong.

### Illustration usage rules

- The dark Indigo canvas is part of the illustration — don't cut it off.
- If placing an illustration on a light section, use the version on dark canvas as a card; don't strip the canvas.
- Never recolor brand illustrations. If they don't fit, find another or commission new ones.

---

## 8. Pattern signatures

Two visual signatures recur across tchop marketing. Treat as brand grammar.

**Grid overlay.** Light SVG grid of small white squares on dark Indigo, 8px grid at ~6% opacity. Used once per page, on the hero or first dark section. Not a generic decorative texture — it's a quiet wink to "platform / structure / system".

**Soft shadow wash.** SVG asset `Baclground.svg` (sic — preserve the filename) is an organic light wash used as a hero background overlay on light pages. Subtle, off-center, drifts diagonally. Apply at low opacity. Don't tile, don't repeat across sections.

Both should appear infrequently. Their power is in restraint.

---

## 9. Buttons & CTAs

| Variant | Background | Text | Border | Radius | When |
|---------|-----------|------|--------|--------|------|
| Primary | `#F6704D` | `#FFFFFF` | none | 8px | The single most important action on a page. One per fold. |
| Primary on dark | `#F6704D` | `#FFFFFF` | none | 8px | Same — orange against Indigo Dark is the strongest contrast. |
| Secondary | transparent | `#F6704D` | 1.5px `#F6704D` | 8px | Adjacent to primary ("Talk to sales" next to "Get a demo"). |
| Ghost | transparent | Indigo Dark on light, Off-white on dark | none | 8px | In nav, in repeating contexts. |

Padding: 14px vertical / 24px horizontal for default size. 18px / 32px for hero CTA.

Label voice (from tchop.io): direct verbs, often a short noun phrase. "Request your free branded app." "See how AOK uses tchop." Avoid generic "Learn more" except as a tertiary tail link. Never "Click here," never "Submit."

---

## 10. Motion (marketing-specific)

Marketing motion budget is larger than product motion, but still restrained. Animation must support comprehension or anticipation, never decoration.

Permitted:
- Fade-and-rise on scroll for hero illustration (12–16px translateY, 400ms, ease-out-quart)
- Cross-fade on testimonial carousel (250ms)
- Hover lift on cards (`transform: translateY(-2px)`, 200ms)
- Underline grow on text links (200ms ease-out)

Forbidden:
- Parallax of any kind
- Scroll-jacking
- Bouncing or elastic easing
- Decorative particle backgrounds
- Auto-playing video as hero (acceptable as inline mute loop only if it shows the product)

Easing defaults: ease-out-quart `cubic-bezier(0.165, 0.84, 0.44, 1)` for entrances. Linear or ease-in-out for cross-fades. Never the CSS `bounce` or `elastic` keywords.

Respect `prefers-reduced-motion` — collapse all entrance animation to instant fade.

---

## 11. Pitch deck conventions

A separate `STYLE_PRESETS.md` exists for the Frontend Slides skill — this section is the *brand* layer that sits on top.

- Hero / divider slides: drenched in Orange `#F6704D` or Indigo Dark `#43445B`, Display XL headline, no body copy. Quietly opinionated.
- Content slides: Off-white background, single H1, supporting body capped at 60ch, one chart or screenshot.
- Number slides ("8 weeks to launch", "47% retention lift"): Display XL number in Orange, Body label in Indigo Dark below. Frame with whitespace, don't add icons.
- Customer logo grid: greyscale logos at uniform optical weight on Off-white. Resist the urge to add color logos — they fight each other.
- Closing slide: deep Indigo Footer `#2D2D46`, single line of copy, single CTA, contact email in caption size. No social icon row.

One slide, one idea. The deck conventions in the existing DESIGN.md (viewport fitting, clamp, no scroll) all apply.

---

## 12. Email & newsletter

The monthly newsletter follows a simpler subset of this system. See `tone-and-voice.md` for copy rules; for layout:

- Container 600–680px, Off-white background.
- Single H1 per email, Display L scale.
- Section dividers: 1px Gray-200 line, 64px above and below.
- One Primary CTA per email, never two competing.
- Images: max 600px wide, no oversized assets. Illustrations preferred over screenshots for top-of-email — screenshots in the second half.
- Footer: Indigo Footer background, off-white type, unsubscribe + address.
- Dark mode email clients: ensure logo and orange remain legible. Test in Apple Mail dark.

---

## 13. Social graphics

LinkedIn, X, Instagram. Square or 1080×1350.

- Default canvas: Off-white background with Orange typographic statement, or Indigo Dark with Off-white typography and one Orange word.
- Use Display L or XL — these formats live on small screens, type needs to dominate.
- Logo always present, top-left or bottom-right, never centered.
- No stock imagery, no AI-generated photography. Branded typographic design uses HTML + CSS + Playwright (per memory `feedback_typographic-design-via-html`).
- Carousels: alternate Off-white / Indigo Dark across slides for rhythm.
- Avoid centered-everything layouts. Asymmetric pulls more attention in feed.

---

## 14. Anti-patterns (marketing-specific)

These are bans on top of the parent DESIGN.md anti-patterns:

- No "AI tech" tropes: glowing orbs, neural network background SVGs, gradient mesh hero, particle fields. tchop is AI-built, not aesthetically AI-cliché.
- No purple-on-white SaaS gradient. Ever.
- No "hero metric template": big number + label + supporting stats trio with gradient accent. Use the number-slide convention above instead.
- No identical 3-column feature card grids with icon-on-top. Vary layouts; if three features, consider 1+2 or 2+1.
- No stock photography of teams in offices.
- No quote slides with giant quotation mark watermark behind them.
- No customer logo bar saying "Trusted by industry leaders" — name them or skip.
- No banner cookie consent that uses Orange — that color is reserved for the value action, not the dismissal.

---

## 15. Decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-25 | Created `DESIGN-marketing.md` as marketing-only companion to root DESIGN.md | Marketing register requires Committed/Drenched color and display typography; the product DESIGN.md documents Restrained defaults that don't apply to landing/decks/social |
