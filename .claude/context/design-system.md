# Design System: tchop.io

Source: Notion Corporate Identity page + Figma illustration file + tchop.io marketing site.
Last updated: 2026-04-02.

---

## 1. Visual Theme & Atmosphere

tchop's visual language is warm, confident, and deliberately un-corporate -- a B2B SaaS that refuses to look like one. The canvas is clean white, but the accent palette brings warmth through a signature coral-orange (`#F6704D`) that reads as energetic without being aggressive. Where most enterprise platforms default to cold blues and sterile grays, tchop leans into earthy warmth: soft indigo backgrounds (`#43445B`), creamy off-whites (`#F1F1F3`), and generous white space that lets content breathe.

The typography is built entirely on Basier Circle -- a geometric sans-serif with soft, rounded terminals that reinforces the "approachable professional" character. It's used across all weights and sizes, giving the brand a cohesive voice whether in a 4rem hero headline or a 0.75rem caption. The font's circular geometry pairs naturally with the rounded UI elements: pill-shaped buttons, 20-24px card radii, and soft shadows that create friendly depth without heaviness.

The illustration style is dark-first -- product mockups live on deep navy canvases (`#373E4B`) where the brand's orange, yellow, and blue pop as accents against white UI elements. This creates a distinctive contrast: the marketing site is light and airy, but product imagery is moody and rich, signaling depth beneath a simple surface.

**Key Characteristics:**
- Light marketing canvas (`#FFFFFF` / `#F1F1F3`) with warm coral-orange as the dominant accent
- Basier Circle as the sole typeface -- geometric, rounded, never swapped for Inter or system fonts
- Pill-shaped primary CTAs (border-radius: 100px) in tchop Orange (`#F6704D`)
- Generous spacing: 80-180px between sections, 20-50px internal padding
- Soft, multi-layer shadows with low opacity for friendly depth
- Rounded cards (20-24px radius) with subtle 1px borders
- Dark navy illustration canvases (`#373E4B`) for product screenshots and mockups
- Motion: subtle-functional -- snappy micro-interactions, not decorative animation

---

## 2. Color Palette & Roles

### Brand Primary
| Name | Hex | Role |
|------|-----|------|
| tchop Orange | `#F6704D` | Primary CTA, accent, brand highlight, interactive elements |
| Yellow | `#FFD138` | Secondary accent, highlights, feature callouts |
| Blue | `#488ED8` | Informational, links, tertiary accent |

### Backgrounds & Surfaces
| Name | Hex | Role |
|------|-----|------|
| White | `#FFFFFF` | Primary page background, card surfaces |
| Background Light | `#F1F1F3` | Alternating section backgrounds, subtle surface tint |
| Background Warm | `#FAF7F7` | Card fills, warm surface variant |
| Background Indigo | `#43445B` | Dark sections, hero backgrounds, feature showcases |
| Footer Indigo | `#2D2D46` | Footer, deepest dark background |
| Canvas Dark Navy | `#373E4B` | Illustration canvas background |

### Text
| Name | Hex / Value | Role |
|------|-------------|------|
| Primary Text | `#2D2D46` | Headings, strong labels -- uses Footer Indigo for warmth over pure black |
| Body Text | `#43445B` | Body copy, descriptions -- Background Indigo doubles as dark text |
| Secondary Text | `#6B6B7B` | Captions, metadata, muted content |
| Disabled Text | `#9B9BAB` | Placeholder, disabled states |
| White Text | `#FFFFFF` | Text on dark backgrounds, button labels on primary CTA |

### Borders & Dividers
| Name | Value | Role |
|------|-------|------|
| Border Default | `1px solid rgba(0,0,0,0.08)` | Standard card borders, dividers |
| Border Subtle | `1px solid rgba(0,0,0,0.05)` | Whisper-weight separation |
| Border Dark | `1px solid #ABB5BA` | Illustration canvas section borders |

### Status (for UI contexts)
| Name | Hex | Role |
|------|-----|------|
| Success Green | `#2ECC71` | Positive states, confirmations |
| Warning Yellow | `#FFD138` | Warnings (reuses brand Yellow) |
| Error Red | `#E74C3C` | Errors, destructive actions |
| Info Blue | `#488ED8` | Informational (reuses brand Blue) |

### CSS Custom Properties
```css
--color-primary:    #F6704D;
--color-secondary:  #FFD138;
--color-accent:     #488ED8;
--color-bg-light:   #F1F1F3;
--color-bg-warm:    #FAF7F7;
--color-bg-dark:    #43445B;
--color-bg-footer:  #2D2D46;
--color-text:       #43445B;
--color-heading:    #2D2D46;
--color-muted:      #6B6B7B;
--color-white:      #FFFFFF;
--color-border:     rgba(0,0,0,0.08);
```

---

## 3. Typography Rules

### Font Family
- **Primary:** `Basier Circle`, with fallbacks: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
- **Presentation font:** Basier Circle (presentation variant available, see Notion CI page)
- **Load via web font** -- never substitute Inter, Roboto, or system fonts

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Display / Hero | `clamp(2.5rem, 5vw, 4rem)` | 700 | 1.05 (tight) | -1.5px | Maximum impact, homepage heroes |
| H1 | `clamp(2rem, 4vw, 3rem)` | 700 | 1.10 (tight) | -1.0px | Page titles, major section headers |
| H2 | `clamp(1.5rem, 3vw, 2.25rem)` | 600 | 1.15 | -0.5px | Section headings |
| H3 | `clamp(1.25rem, 2.5vw, 1.75rem)` | 600 | 1.20 | -0.25px | Sub-section headings, card titles |
| Body Large | `clamp(1.125rem, 1.5vw, 1.25rem)` | 400 | 1.60 (relaxed) | normal | Introduction text, feature descriptions |
| Body | `clamp(1rem, 1.25vw, 1.125rem)` | 400 | 1.55 | normal | Standard reading text |
| Body Medium | `1rem` | 500 | 1.55 | normal | Navigation, emphasized labels |
| Small / Caption | `clamp(0.75rem, 1vw, 0.875rem)` | 400 | 1.40 | normal | Metadata, timestamps, fine print |
| Badge / Tag | `0.75rem` | 600 | 1.33 | 0.5px | Pill badges, status labels |
| Button | `1rem` | 600 | 1.00 | normal | CTA and button text |

### Principles
- **`clamp()` everywhere:** All type and spacing uses `clamp()` for responsive scaling in HTML/CSS deliverables. No fixed pixel values for text above caption size.
- **Two-tier weight system:** 400 for reading, 600-700 for emphasis. Weight 500 appears only in navigation and UI labels.
- **Compression at scale:** Letter-spacing tightens progressively at display sizes (-1.5px at 4rem, -1.0px at 3rem, normal at 1rem and below).
- **Generous line-height for body:** 1.55-1.60 for body text ensures comfortable reading. Headings tighten to 1.05-1.20.
- **No italic abuse:** Reserve italic for emphasis within body text, not for entire blocks or headings.

---

## 4. Component Stylings

### Buttons

**Primary CTA (Pill)**
- Background: `#F6704D` (tchop Orange)
- Text: `#FFFFFF`
- Padding: 12px 28px
- Radius: 100px (full pill)
- Shadow: `0 2px 8px rgba(246,112,77,0.3)`
- Hover: darken to `#E5603D`, shadow intensifies
- Use: Primary actions ("Book a demo", "Get started", "Try for free")

**Secondary Button**
- Background: transparent
- Text: `#43445B`
- Padding: 12px 28px
- Radius: 100px (full pill)
- Border: `1px solid rgba(0,0,0,0.15)`
- Hover: background `#F1F1F3`
- Use: Secondary actions, paired with primary CTA

**Ghost / Text Button**
- Background: transparent
- Text: `#F6704D` or `#488ED8`
- Padding: 8px 16px
- Decoration: underline on hover
- Use: Tertiary actions, inline links, "Learn more" links

**Dark Background Button**
- Background: `#FFFFFF`
- Text: `#2D2D46`
- Padding: 12px 28px
- Radius: 100px
- Use: CTA on dark/indigo sections

### Cards & Containers

**Standard Card**
- Background: `#FFFFFF`
- Border: `1px solid rgba(0,0,0,0.08)`
- Radius: 20px
- Padding: 24px-32px
- Shadow: `0 4px 16px rgba(0,0,0,0.06)`
- Hover: shadow deepens to `0 8px 24px rgba(0,0,0,0.1)`

**Warm Card (Alternate)**
- Background: `#FAF7F7`
- Border: `1px solid rgba(0,0,0,0.05)`
- Radius: 24px
- Shadow: `0 4px 12px rgba(0,0,0,0.04)`

**Feature Card (Dark)**
- Background: `#43445B`
- Text: `#FFFFFF`
- Radius: 24px
- Shadow: `0 8px 24px rgba(0,0,0,0.2)`
- Use: Feature showcases, product screenshots on dark canvas

### Badges & Tags

**Brand Badge**
- Background: `rgba(246,112,77,0.1)`
- Text: `#F6704D`
- Padding: 4px 12px
- Radius: 100px (pill)
- Font: 0.75rem weight 600, letter-spacing 0.5px

**Neutral Badge**
- Background: `#F1F1F3`
- Text: `#43445B`
- Padding: 4px 12px
- Radius: 100px
- Font: 0.75rem weight 500

### Navigation
- Clean horizontal header on white, sticky with subtle border-bottom
- Logo left-aligned (SVG preferred)
- Links: Basier Circle 1rem weight 500, color `#43445B`
- Hover: color shifts to `#F6704D`
- CTA: pill button (tchop Orange) right-aligned
- Mobile: hamburger collapse at 768px

### Image & Screenshot Treatment
- Product screenshots on dark navy canvas (`#373E4B`)
- Card-wrapped screenshots: 20px radius, subtle shadow
- Illustrations: flat/semi-flat style with brand colors (orange dominant, yellow and blue supporting)
- White UI elements rendered on dark scenes

---

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 48px, 64px, 80px, 120px
- Section gaps: 80-180px vertical spacing between major sections
- Internal padding: 20-50px within cards and containers
- All spacing values should use `clamp()` in responsive deliverables

### Grid & Container
- Max content width: 1200px, centered
- Hero: centered single-column, generous vertical padding (80-120px top)
- Feature sections: 2-3 column grids for cards
- Alternating section backgrounds: white and `#F1F1F3` for visual rhythm
- Full-width dark sections (`#43445B`) for product showcases

### Whitespace Philosophy
- **Warmth through space:** Generous vertical spacing (80px+) between sections prevents the corporate-dense feeling. Let content breathe.
- **Alternating rhythm:** White and warm-white (`#F1F1F3`) sections create gentle visual rhythm without hard dividers or borders.
- **Content islands:** Body text blocks are compact (line-height 1.55) but surrounded by ample margin, creating focused reading zones.

### Border Radius Scale
| Size | Value | Use |
|------|-------|-----|
| Standard | 8px | Small containers, inputs |
| Comfortable | 12px | Medium containers, form elements |
| Card | 20px | Standard cards, panels |
| Featured | 24px | Hero cards, feature blocks |
| Pill | 100px | Buttons, badges, tags |
| Circle | 50% | Avatars, icon buttons |

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No shadow | Page background, inline text blocks |
| Subtle (Level 1) | `0 2px 8px rgba(0,0,0,0.04)` | Resting cards, subtle containers |
| Standard (Level 2) | `0 4px 16px rgba(0,0,0,0.06)` | Active cards, content panels |
| Elevated (Level 3) | `0 8px 24px rgba(0,0,0,0.1)` | Hovered cards, dropdowns, popovers |
| Deep (Level 4) | `0 12px 36px rgba(0,0,0,0.15)` | Modals, dialogs, floating panels |
| CTA Glow | `0 2px 8px rgba(246,112,77,0.3)` | Primary buttons (orange-tinted shadow) |

**Shadow Philosophy:** tchop uses soft, low-opacity shadows that create friendly depth without heaviness. Shadows are always neutral gray -- never colored or blue-tinted (except the CTA glow on orange buttons, which uses the brand color at low opacity). Elevation is gentle and inviting: elements feel resting on a surface, not floating aggressively above it. Multi-layer shadows are acceptable for deeper levels but individual opacity should stay below 0.15.

---

## 7. Do's and Don'ts

### Do
- Load Basier Circle via web font -- it is the brand's typographic identity
- Use tchop Orange (`#F6704D`) as the only primary CTA color
- Use pill-shaped buttons (100px radius) for all primary and secondary CTAs
- Apply `clamp()` for all responsive type and spacing values
- Use dark sections with Background Indigo (`#43445B`) for product showcases, not pure black
- Alternate white and warm-white (`#F1F1F3`) section backgrounds for rhythm
- Use `#2D2D46` (Footer Indigo) for heading text -- warmer than black
- Keep card radius at 20-24px -- friendly and rounded
- Use generous spacing (80px+) between sections

### Don't
- Don't substitute Inter, Roboto, or system fonts for Basier Circle
- Don't use blue (`#488ED8`) as a primary CTA color -- blue is informational/tertiary only
- Don't use pure black (`#000000`) for text or backgrounds -- always use the warm dark palette
- Don't use light backgrounds (`#F1F1F3` or white) for illustration scenes -- illustrations are dark-first on `#373E4B`
- Don't use sharp corners (radius < 8px) on cards or containers -- the system is rounded
- Don't overuse the Yellow accent (`#FFD138`) -- it's a highlight, not a primary color
- Don't create heavy shadows (opacity > 0.15) -- depth should be felt, not seen
- Don't add decorative animation -- motion is subtle-functional only (hover reveals, page transitions, loading states)
- Don't use emoji, gradients, or neon colors -- the palette is warm and muted

---

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <640px | Single column, stacked cards, reduced section spacing (48px) |
| Tablet | 640-1024px | 2-column grids, moderate padding |
| Desktop | 1024-1280px | Full layout, 3-column feature grids |
| Large Desktop | >1280px | Centered content, generous margins |

### Touch Targets
- Primary buttons: minimum 44px height, 12px+ vertical padding
- Navigation links: adequate spacing for touch (minimum 44px tap target)
- Pill badges: 8px+ horizontal padding for tap accessibility
- Mobile hamburger menu: prominent, easy-to-reach toggle

### Collapsing Strategy
- Hero: display text scales via `clamp()` -- no abrupt size jumps
- Navigation: horizontal links + pill CTA collapse to hamburger at 768px
- Feature cards: 3-column to 2-column to single-column stacked
- Dark product sections: maintain full-width treatment, reduce internal padding
- Section spacing: 80-120px on desktop, 48-64px on mobile
- Cards: maintain 20px radius at all sizes, reduce internal padding on mobile

### Image Behavior
- Product screenshots maintain dark canvas treatment at all sizes
- Card images use responsive sizing with consistent border radius
- Illustrations scale proportionally, never crop

---

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary CTA: tchop Orange (`#F6704D`)
- CTA Hover: Dark Orange (`#E5603D`)
- Page Background: White (`#FFFFFF`)
- Alt Background: Warm Light (`#F1F1F3`)
- Dark Section: Background Indigo (`#43445B`)
- Footer: Footer Indigo (`#2D2D46`)
- Heading text: `#2D2D46`
- Body text: `#43445B`
- Muted text: `#6B6B7B`
- Link: `#488ED8`
- Border: `rgba(0,0,0,0.08)`
- CTA shadow: `rgba(246,112,77,0.3)`

### Example Component Prompts
- "Create a hero section on white background. Headline at `clamp(2.5rem, 5vw, 4rem)` Basier Circle weight 700, line-height 1.05, letter-spacing -1.5px, color `#2D2D46`. Subtitle at `clamp(1.125rem, 1.5vw, 1.25rem)` weight 400, line-height 1.60, color `#6B6B7B`. Primary CTA pill button (`#F6704D`, 100px radius, 12px 28px padding, white text, shadow `0 2px 8px rgba(246,112,77,0.3)`) and secondary pill button (transparent, `1px solid rgba(0,0,0,0.15)`, `#43445B` text, 100px radius)."
- "Design a feature card: white background, `1px solid rgba(0,0,0,0.08)` border, 20px radius, 24px padding. Shadow: `0 4px 16px rgba(0,0,0,0.06)`. Title at `clamp(1.25rem, 2.5vw, 1.75rem)` Basier Circle weight 600, color `#2D2D46`. Body at 1rem weight 400, color `#43445B`. Hover: shadow deepens to `0 8px 24px rgba(0,0,0,0.1)`."
- "Build a brand badge: `rgba(246,112,77,0.1)` background, `#F6704D` text, 100px radius, 4px 12px padding, 0.75rem Basier Circle weight 600, letter-spacing 0.5px."
- "Create navigation: white sticky header with bottom border `1px solid rgba(0,0,0,0.05)`. Basier Circle 1rem weight 500 for links, `#43445B` text. Orange pill CTA right-aligned (`#F6704D` bg, white text, 100px radius, 12px 28px padding)."
- "Design a dark product section: `#43445B` background. Headline at `clamp(2rem, 4vw, 3rem)` Basier Circle weight 700, line-height 1.10, letter-spacing -1.0px, color `#FFFFFF`. Body at 1rem weight 400, `rgba(255,255,255,0.75)`. White pill CTA (`#FFFFFF` bg, `#2D2D46` text, 100px radius). Product screenshot card with 24px radius on dark navy canvas (`#373E4B`)."
- "Create alternating sections: white section followed by `#F1F1F3` section. Each section has 80px vertical padding, max-width 1200px centered. Section heading at `clamp(1.5rem, 3vw, 2.25rem)` weight 600, letter-spacing -0.5px, color `#2D2D46`."

### Iteration Guide
1. Always use Basier Circle -- never Inter, Roboto, or system fonts. This is non-negotiable.
2. Letter-spacing compresses at scale: -1.5px at 4rem, -1.0px at 3rem, -0.5px at 2.25rem, normal at 1rem.
3. Two weights: 400 (read) and 600-700 (emphasize). Use 500 only for navigation/UI labels.
4. Buttons are always pill-shaped (100px radius). Cards are always rounded (20-24px radius).
5. tchop Orange (`#F6704D`) is the only CTA color. Blue is for links/info, Yellow is for highlights only.
6. Dark sections use `#43445B`, never pure black. Heading text uses `#2D2D46`, never `#000000`.
7. Shadows are soft and warm: max opacity 0.15, except CTA glow which uses brand orange at 0.3 opacity.
8. Section rhythm: alternate white and `#F1F1F3` backgrounds with 80px+ vertical spacing between them.
9. All sizing uses `clamp()` -- no fixed pixel values for text or spacing in responsive deliverables.

---

## Logo

Three variants available (see Notion CI page):
- **Without background** (PNG) -- use on light backgrounds
- **With background** (PNG) -- use on dark/colored backgrounds
- **Vector** (SVG) -- preferred for web and scalable contexts

---

## Illustrations

### Style Reference
Figma file: [tchop new Illus 2022-2024](https://www.figma.com/design/QXBh2hlCxJdNx6Ot740Nlf/tchop-new-Illus-2022-2024?node-id=1-57)

### Canvases
- **Illustrations 2024** (`1:57`) -- current; sections: Mobile App, Desktop Browser
- **Illustrations 2022** (`93:848`) -- reference/legacy

### Style Characteristics
- Dark navy canvas backgrounds (`#373E4B`)
- Flat/semi-flat style with tchop brand colors
- Orange (`#F6704D`) as dominant accent
- Yellow (`#FFD138`) and Blue (`#488ED8`) as supporting colors
- White UI elements on dark scenes
- Product UI mockups (mobile + desktop browser)

---

## Icon Set

- Source: Envato Elements -- [Super Basic Icons 1+2](https://elements.envato.com/de/super-basic-icons-1-2-NLSLGW2)
- Used in master charts / decks
