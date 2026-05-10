# DESIGN.md — tchop: teaser AI agents

## Style Prompt

Cinematic B2B SaaS explainer on tchop's dark illustration canvas. Warm indigo atmosphere (never pure black), one dominant coral accent, restrained weight-contrast typography in Basier Circle. Precise, weighted motion — no bounce. The canvas reads as moody depth with warm highlights, like tchop's product screenshots but in motion. Subtle starfield parallax stays behind all content to give the frame atmospheric weight.

## Colors

| Role                 | Hex                      |
| -------------------- | ------------------------ |
| Canvas (deepest bg)  | `#2D2D46` (Footer Indigo)|
| Canvas (scene bg)    | `#373E4B` (Canvas Navy)  |
| Panel / Surface      | `#43445B` (Bg Indigo)    |
| Primary accent       | `#F6704D` (tchop Orange) |
| Secondary accent     | `#FFD138` (tchop Yellow) |
| Info accent          | `#488ED8` (tchop Blue)   |
| Bone white (text)    | `#F1F1F3`                |
| Muted text           | `#9B9BAB`                |
| CTA glow             | `rgba(246,112,77,0.30)`  |
| Hairline             | `rgba(241,241,243,0.08)` |

Do NOT use pure `#000` or pure `#FFF`. Do NOT introduce any other hue (no cyan, no purple, no neon).

## Typography

- **Display / headings:** `'Basier Circle', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif`, weight 700, letter-spacing `-0.02em` at display sizes.
- **Body / captions:** Basier Circle weight 400, letter-spacing normal.
- **Data / terminal:** `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`, weight 500. `font-variant-numeric: tabular-nums` on any stacked numbers or counters.
- **Weight contrast rule:** 400 recedes, 700 performs. No in-between weights for display.
- Minimum sizes for 1920×1080 video: body 22px, labels 18px, data 20px, display 96px+.

## Motion

- Easings: `power3.out`, `expo.out` for entrances; `power2.inOut` for crossfade transitions. No `back`, no `elastic`, no `bounce`.
- Entrance durations 0.3-0.7s, vary across a scene.
- Counters use tabular-nums; no `Math.random()` — seeded mulberry32 PRNG for any pseudo-random values.
- Crossfade transitions: blur crossfade, 0.6s, `power2.inOut`, 10px blur peak.
- Starfield parallax is slow, low-opacity, subliminal — never foreground attention.

## What NOT to Do

- No gradient text (`background-clip: text`).
- No left-edge accent stripes on cards.
- No pure black `#000` backgrounds — always warm indigo.
- No fonts other than Basier Circle (display) and JetBrains Mono (terminal).
- No bouncy/elastic easing — weighted easing only.
- No decorative animation for its own sake — every motion carries a meaning (data arriving, state changing, focus shifting).
- No centered-everything layouts — lead the eye with asymmetry.

## Scene Canvas & Atmosphere

Every scene renders against this stack (back-to-front):
1. Solid `#2D2D46` base
2. Radial coral glow (top-left, 1200px radius, 8% opacity, slow breathing)
3. Radial blue glow (bottom-right, 900px radius, 5% opacity, counter-breathing)
4. Starfield dots (seeded PRNG, 120 dots, 1-2px, slow parallax drift)
5. Subtle hairline grid (optional, opacity 4%)
6. Scene content
