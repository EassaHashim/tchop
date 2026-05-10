# tchop.io — Frontend Design Context

When building frontend interfaces for tchop.io, apply these brand constraints **on top of** the generic SKILL.md guidelines.

---

## Required Context Files

Load these before any tchop frontend work:

| File | What it provides |
|------|-----------------|
| `.claude/context/design-system.md` | Colors, typography, logo variants, illustration style |
| `.claude/context/brand.md` | Product positioning, voice, key pages |

---

## Typography Override

**Always use Basier Circle** as the sole typeface. Do not substitute with Inter, Roboto, Space Grotesk, or any other font.

- Load via web font (files available from Notion CI page)
- Fallback stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
- Use `clamp()` for all sizing — see type scale in `design-system.md`

---

## Color Rules

```css
--color-primary:    #F6704D;   /* tchop Orange — only CTA color */
--color-secondary:  #FFD138;   /* Yellow — accent */
--color-accent:     #488ED8;   /* Blue — informational, links */
--color-bg-light:   #F1F1F3;   /* Light backgrounds (not pure white) */
--color-bg-dark:    #43445B;   /* Dark sections (not pure black) */
--color-bg-footer:  #2D2D46;   /* Footer / deepest dark */
--color-white:      #FFFFFF;   /* Text on dark, light UI elements */
```

- Orange (`#F6704D`) is the **only** primary CTA color — never use blue as primary
- Dark sections use Indigo (`#43445B`), never pure black
- Light backgrounds use `#F1F1F3`, not pure white
- Yellow and Blue are supporting accents, not primaries

---

## Visual Identity

### Illustration Style
- Flat/semi-flat with brand colors on dark navy canvas (`#373E4B`)
- Product UI mockups (mobile + desktop browser) as hero visuals
- Figma reference: [tchop Illustrations 2022-2024](https://www.figma.com/design/QXBh2hlCxJdNx6Ot740Nlf/tchop-new-Illus-2022-2024?node-id=1-57)

### Decorative Elements
- Colored "bubble" shapes (orange, yellow, blue, pink) used as background accents
- Available as PNGs in `frontend-slides/tchop-assets/`
- Gradient backgrounds and blurred bubble overlays for atmosphere

### Icons
- Source set: Envato Elements — Super Basic Icons 1+2

### Logo
- Three variants: transparent PNG, background PNG, SVG (preferred for web)
- Logo assets in `frontend-slides/tchop-assets/master_tchop-logo.png*`

---

## Tone for UI Copy

- Professional, direct, confident — not salesy
- Lead with outcomes, not features
- "tchop.io" always lowercase, always with .io
- German text: always use proper Umlaute (ä, ö, ü, ß)

---

## Default Aesthetic Direction

When no specific direction is given, default to:

- **Dark-first** hero sections (Indigo `#43445B` background)
- **Orange as dominant accent** with restrained use of yellow/blue
- **Clean, modern SaaS feel** — generous whitespace, clear hierarchy
- **Mobile-first** — tchop is a mobile platform, designs should reflect that
- Subtle bubble/gradient decorations for depth, not flat solid backgrounds
