# Analytics Dashboard — CSS + Structural Polish

Spec for the analytics dashboard polish applied to `services/AOK-webapp/`.
Patch file: [`analytics-polish.patch`](analytics-polish.patch)
Visual prototype: [`analytics-polish.html`](analytics-polish.html)

---

## Files changed

| File | Change type | Lines |
|------|-------------|-------|
| [`src/pages/Organisation/Analytics/Analytics.module.scss`](../../services/AOK-webapp/src/pages/Organisation/Analytics/Analytics.module.scss) | SCSS — main dashboard styles | +30 / -19 |
| [`src/pages/Organisation/Analytics/Analytics.tsx`](../../services/AOK-webapp/src/pages/Organisation/Analytics/Analytics.tsx) | TSX — COLORS palette, export button, header layout | +16 / -14 |
| [`src/pages/Organisation/Analytics/helpers/components/ChartWrapper/ChartWrapper.tsx`](../../services/AOK-webapp/src/pages/Organisation/Analytics/helpers/components/ChartWrapper/ChartWrapper.tsx) | TSX — info icon color from theme token | +2 / -2 |
| [`src/pages/Organisation/Analytics/helpers/components/TableChart/TableChart.module.scss`](../../services/AOK-webapp/src/pages/Organisation/Analytics/helpers/components/TableChart/TableChart.module.scss) | SCSS — table chart tokens | +4 / -4 |

---

## Level 1: CSS polish (no structural changes)

### 1. Rounded chart cards
- **Before:** `border-radius: 0` (sharp corners on every chart card)
- **After:** `border-radius: 0.25rem` on `.analytics__chart` and tooltips
- **Why:** Every other component in the webapp uses `0.25rem`. Charts were the outlier.

### 2. Hard-coded colors replaced with CSS custom properties
15 instances of `#1e1e1e`, `#43445b`, `#787878`, `#ebebeb` replaced with:
- `var(--card-text-color, #1e1e1e)` — stat labels, values, tooltip text
- `var(--card-text-secondary-color, #787878)` — best-label text
- `var(--card-border-color, #ebebeb)` — all card, stat, and tooltip borders
- `var(--card-bg-color, #fff)` — card and tooltip backgrounds
- `var(--card-hover-bg-color, #f9f9fa)` — table row hover

All use fallbacks matching the current values, so nothing changes visually until the vars are set by the runtime theme config. Once set, the dashboard auto-adapts to any tenant's brand.

### 3. Tighter chart height
- **Before:** `height: 25rem` (400px) for all time series charts
- **After:** `height: 18rem` (288px)
- **Why:** 7-day datasets with 8 data points looked sparse in a 400px tall chart. 288px fits the data density better.

### 4. Reduced bottom margin
- **Before:** `margin-bottom: 10rem` on the analytics wrapper
- **After:** `margin-bottom: 2rem`
- **Why:** 10rem was cargo-cult from the feed's card-bottom-spacing pattern. The analytics page doesn't need it.

### 5. Tighter chart card gap
- **Before:** `gap: 1rem` between chart cards
- **After:** `gap: 0.75rem`
- **Why:** Denser page feel; charts are related, not separate sections.

### 6. Brand-derived chart palette
- **Before:** Generic rainbow: `#33AAFF`, `#F471B6`, `#00D7F3`, `#FFDD33`, ...
- **After:** AOK-rooted: `#005E3F`, `#18AB42`, `#5BC4A0`, `#d4870e`, `#F471B6`, `#33AAFF`, ...
- **Why:** First 3 slots are now org-branded greens. Remaining slots kept for contrast diversity.

### 7. TableChart token cleanup
4 hard-coded colors in `TableChart.module.scss` replaced with the same CSS var tokens used in the main SCSS.

### 8. ChartWrapper info icon
- **Before:** `color={'#B3B3B3'}` (hard-coded)
- **After:** `color={getCssVar('--icon-secondary-color') || '#B3B3B3'}`
- **Why:** Reads from the theme config's icon token. Falls back safely.

---

## Level 2: Structural changes

### 9. Export button demoted to secondary
- **Before:** `ButtonType.primary` (bright AOK Frischgrün)
- **After:** `ButtonType.secondary` (bordered, quiet)
- **Why:** Export is a utility action, not the page's primary CTA. It was competing visually with the data.

### 10. Header layout: absolute → flex row
- **Before:** Export button used `position: absolute; right: 0; top: 2.5rem` — broke on narrow viewports
- **After:** New `.analytics__header-row` wraps title + export in `flex-row(center, space-between)`
- **JSX change:** Added a wrapping `<div className={classes['analytics__header-row']}>` around the header + export button
- **SCSS change:** Removed `position: absolute` from `&__export`, added `&__header-row` flex row

### 11. Filter bar wrapped in a card
- **Before:** Filter controls floated as naked elements below the tabs
- **After:** `.analytics__tab-content-filters` gains `background`, `border`, `border-radius: 0.25rem`, `padding: 0.75rem 1rem`
- **Also:** `gap: 0.25rem` → `0.5rem`, `flex-wrap: wrap` added for narrow viewports
- **Why:** Groups filters as a visual toolbar instead of loose floating elements

---

## Deferred items (need shared component changes)

These require modifying shared components (`Tabs`, `Select`) that affect the whole app. Recommend implementing as new variant props.

### Sub-tab pill styling
The Content and User sections have inner sub-tabs (Activity / Channels & Mixes / Notifications) rendered via the shared `<Tabs>` component. Currently they look identical to the top-level tabs — two underline-tab bars in a row is confusing hierarchy.

**Recommendation:** Add a `variant?: 'underline' | 'pill'` prop to `src/shared/components/Tabs/Tabs.tsx`. The pill variant would render tabs as rounded buttons with a tinted background on active state (like the prototype shows in `analytics-polish.html`). Usage: `<Tabs ... variant={'pill'} />` in Content.tsx and User.tsx.

### KPI summary bar
A new component showing 4 headline numbers (Published / Views / Interaction Rate / Active Users) with trend arrows at the top of the analytics page, before the tabs. Helps admins orient at a glance.

**Recommendation:** Create a `AnalyticsKPI` component that aggregates data from the existing analytics API endpoints. Place it in `Analytics.tsx` before the `<Tabs>` component. ~60 lines of JSX + a new aggregation hook.

### Filter Select visual weight
The bordered-box styling on `Select` dropdowns comes from `Select.module.scss`. Can't override cleanly from Analytics SCSS due to CSS Modules scoping.

**Recommendation:** Add a `compact` or `inline` variant prop to `src/shared/components/Select/Select.tsx` that renders a lighter border/background treatment. Apply it to the analytics filter selects only.

---

## How to apply

### Option A: From the patch file
```bash
cd services/AOK-webapp
git apply ../prototypes/aok-analytics/analytics-polish.patch
```

### Option B: From the working tree (already applied)
The changes are already in the working tree at `~/claude-projects/services/AOK-webapp/`. Commit and push to a branch:
```bash
cd ~/claude-projects/services/AOK-webapp
git checkout -b polish/analytics-dashboard
git add -A
git commit -m "Polish analytics dashboard: rounded cards, brand palette, token colors, layout fixes"
git push origin polish/analytics-dashboard
```

---

## Visual reference

Open [`analytics-polish.html`](analytics-polish.html) in a browser for a side-by-side comparison of the polished vs original look. The debug bar in the bottom-right toggles between states.
