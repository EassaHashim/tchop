# Integration Overview Page Redesign -- React Implementation Spec

## Context

The current integrations page (`/webapp/admin/integrations`) shows a grid of integration type cards. Users must click into each type to discover which have active instances, their source names, and sync status. This redesign surfaces that information directly on the overview page.

**Prototypes** (open locally via static server):
- `prototypes/integration-v1-button.html` -- Recommended: active list + "Add new integration" button with modal picker
- `prototypes/integration-v3-tabs.html` -- Alternative: tabs separating "Active Integrations" and "Add New"

## Data Model

### Integration Instance

The active integrations list needs the following per instance:

```ts
interface IntegrationInstance {
  id: string;
  type: IntegrationType;          // "youtube" | "instagram" | "linkedin" | "facebook" | "tiktok" | "google_news" | "apple_podcast"
  sourceName: string;             // User-visible label, e.g. "AOK Gesundheitskanal", "@aok_gesundheit"
  status: "active" | "paused" | "error";
  lastSyncAt: string | null;      // ISO timestamp of last successful sync
  errorMessage?: string;          // Present when status === "error"
}
```

### Integration Type (existing)

```ts
interface IntegrationType {
  slug: string;
  displayName: string;
  description: string;
  icon: React.ReactNode;          // Existing icon component/SVG
  activeCount: number;            // Derived: count of instances with this type
}
```

### API Surface

The page currently fetches integration types. It also needs a new or extended endpoint that returns all configured instances for the current organization:

```
GET /api/integrations/instances
Response: IntegrationInstance[]
```

If this endpoint does not exist yet, the data can be derived from the existing per-type detail endpoints, but a consolidated endpoint is strongly preferred to avoid N+1 fetching.

## Component Breakdown

### V1: Button + Modal (Recommended)

```
IntegrationsPage
  +-- PageHeader                        // "Integrations" title + description
  +-- ActiveIntegrationsSection
  |     +-- SectionHeader               // "Active Integrations" + count + AddButton
  |     +-- ActiveIntegrationsList
  |           +-- ListHeader            // Search input + TypeDropdown + StatusPills
  |           +-- ActiveIntegrationRow  // One per instance (repeated)
  +-- AddIntegrationModal               // Triggered by AddButton
        +-- ModalHeader                 // Title + close button
        +-- ModalSearch                 // Filter integration types
        +-- IntegrationTypeItem         // One per type (repeated)
```

### V1 Behavior

1. **Page load**: Fetch all integration instances. Group by type for `activeCount` badges.
2. **ActiveIntegrationRow click**: Navigate to the existing detail page for that instance (`/webapp/admin/integrations/{type}/{instanceId}`).
3. **"Add new integration" button**: Opens `AddIntegrationModal`.
4. **Modal type item click**: Navigate to the existing type detail page (`/webapp/admin/integrations/{type}`) which already has the "Add new integration" form.
5. **Filters combine**: Type dropdown + status pills + text search all apply simultaneously. If all filters result in zero rows, show an empty state: "No integrations match your filters."
6. **Empty state (no instances at all)**: Hide the active list section entirely. Show the integration type grid as the current page does today (no behavioral change for orgs without integrations).

## Styling Spec

All values below are extracted from the live staging CSS custom properties. Use the existing theme variables where available; fall back to these literal values only if the variable is not exposed.

### Design Tokens (from staging `<html style="...">`)

| Token | Value | Usage |
|-------|-------|-------|
| `--body-background-color` | `#f8f8f8` | Page background |
| `--card-background-color` | `#ffffff` | Card/list surfaces |
| `--card-border-color` | `#ebebeb` | Card borders, row dividers |
| `--header-border-bottom-color` | `#DDE1E4` | Header bottom border, sidebar border |
| `--tabs-border-color` | `#dfe3e6` | Tab underline, section dividers |
| `--tabs-active-color` | `#005e3f` | Active tab text + underline |
| `--tabs-background-color` | `#E8F4F2` | Active tab badge, active row hover |
| `--tabs-label-color` | `#293033` | Inactive tab text |
| `--btn-primary-background-color` | `#91F54A` | Primary button bg (lime green) |
| `--btn-primary-text-color` | `#004730` | Primary button text |
| `--btn-primary-border-color` | `#91F54A` | Primary button border |
| `--btn-primary-background-hover-color` | `#FFFFFF` | Primary button hover bg |
| `--btn-secondary-background-color` | `#ffffff` | Secondary button bg |
| `--btn-secondary-text-color` | `#005e3f` | Secondary button text |
| `--input-border-color` | `#b3b3b3` | Input borders |
| `--input-border-focus-color` | `#18ab42` | Input focus border |
| `--input-placeholder-color` | `#6d767c` | Input placeholder text |
| `--nav-menu-link-text-color` | `#6D767C` | Sidebar nav links |
| `--nav-menu-link-text-hover-color` | `#005e3f` | Sidebar nav link hover |
| `--nav-menu-link-selected-text-color` | `#005e3f` | Active nav item text |
| `--nav-menu-link-selected-background-color` | `#E8F4F2` | Active nav item bg |
| `--modal-overlay-background-color` | `#23232e` | Modal overlay (use with ~60% opacity) |
| `--modal-background-color` | `#ffffff` | Modal surface |
| `--modal-title-color` | `#005e3f` | Modal title |
| `--dropdown-menu-item-background-hover-color` | `#EEFAEA` | Modal item hover, dropdown hover |
| `--search-input-icon-color` | `#005e3f` | Search icon in header |
| `--search-input-placeholder-color` | `#005e3f` | Search placeholder in header |
| `--input-text-color` | `#293033` | Input text |
| `--filter-active-color` | `#005e3f` | Active filter state |

### Status Indicators

| Status | Dot color | Label color | Label text |
|--------|-----------|-------------|------------|
| Active | `#18AB42` (--switch-color) | `#6d767c` | "Active" |
| Paused | `#f0ad4e` | `#6d767c` | "Paused" |
| Error | `#ff5560` (--input-border-error-color) | `#ff5560` (red label) | "Error" |

Status dot: 7px circle, `border-radius: 50%`.

### Active Integrations List

```css
/* Container */
.active-list {
  background: var(--card-background-color);           /* #ffffff */
  border: 1px solid var(--card-border-color);          /* #ebebeb */
  border-radius: 10px;
  overflow: hidden;
}

/* Row */
.active-row {
  display: grid;
  grid-template-columns: 200px 1fr 100px 140px 32px;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid #f3f3f3;                   /* Lighter than card-border */
  cursor: pointer;
}
.active-row:last-child { border-bottom: none; }
.active-row:hover {
  background: var(--tabs-background-color);            /* #E8F4F2 */
}

/* Type icon container */
.active-type-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #f3f3f3;
}

/* Type name */
.active-type-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--input-text-color);                      /* #293033 */
}

/* Source name */
.active-source {
  font-size: 13px;
  color: var(--input-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Last sync */
.active-sync {
  font-size: 12px;
  color: #98a1a6;
  text-align: right;
}
```

### Filter Bar

```css
/* Filter pill (status) */
.filter-pill {
  padding: 4px 10px;
  border-radius: 100px;
  font-size: 12px;
  border: 1px solid var(--card-border-color);          /* #ebebeb */
  background: #fff;
  color: #6d767c;
}
.filter-pill.active {
  background: var(--tabs-background-color);            /* #E8F4F2 */
  border-color: var(--switch-color);                   /* #18AB42 */
  color: var(--tabs-active-color);                     /* #005e3f */
  font-weight: 500;
}

/* Type dropdown */
.type-select {
  padding: 4px 8px;
  border-radius: 100px;
  font-size: 12px;
  border: 1px solid var(--card-border-color);
  color: #6d767c;
}

/* Separator between dropdown and pills */
.filter-separator {
  width: 1px;
  height: 20px;
  background: var(--card-border-color);
}
```

### "Add new integration" Button

```css
.btn-add {
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid var(--btn-primary-border-color);   /* #91F54A */
  background: var(--btn-primary-background-color);     /* #91F54A */
  color: var(--btn-primary-text-color);                /* #004730 */
  font-size: 13px;
  font-weight: 600;
}
.btn-add:hover {
  background: var(--btn-primary-background-hover-color); /* #FFFFFF */
  border-color: var(--btn-primary-border-color);
  color: var(--btn-primary-text-color);
}
```

### Modal

```css
.modal-overlay {
  background: rgba(35, 35, 46, 0.6);                  /* --modal-overlay-background-color with alpha */
}
.modal {
  background: var(--modal-background-color);           /* #ffffff */
  border-radius: 14px;
  width: 560px;
  max-height: 80vh;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--modal-title-color);                     /* #005e3f */
}
.modal-item:hover {
  background: var(--dropdown-menu-item-background-hover-color); /* #EEFAEA */
}
```

### Page Title

```css
.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #005e3f;                                      /* Matches existing admin page titles */
}
```

### Count Badge (on type cards, if V3 tabs variant is used)

```css
.count-badge {
  padding: 1px 7px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 500;
  background: var(--tabs-background-color);            /* #E8F4F2 */
  color: var(--tabs-active-color);                     /* #005e3f */
}
```

## Last Sync Display

Use relative timestamps. Format rules:

| Elapsed | Display |
|---------|---------|
| < 1 min | "Just now" |
| 1-59 min | "{n} min ago" |
| 1-23 hours | "{n} hour(s) ago" |
| 1-6 days | "{n} day(s) ago" |
| 7+ days | "DD.MM.YYYY" (German date format for AOK) |

If `lastSyncAt` is `null`, display "Never synced" in muted text.

## Empty States

### No active integrations at all

Do not render the active integrations section. Render the existing integration type grid as the page does today. This ensures backward compatibility for orgs that haven't set up any integrations.

### Active integrations exist but filters yield zero results

Show inside the list container:

```
No integrations match your filters.
```

Centered, `color: #6d767c`, `font-size: 14px`, `padding: 32px 16px`.

### Error state on a specific integration

The row shows a red dot + "Error" label in red (`#ff5560`). Clicking the row navigates to the detail page where the user can see the full error and reconfigure.

## Accessibility

- Filter pills should use `role="radiogroup"` and `role="radio"` with `aria-checked`.
- Type dropdown is a native `<select>`, inherently accessible.
- Modal should trap focus when open, close on Escape, and restore focus to the trigger button on close.
- Active integration rows should be keyboard-navigable (focusable, Enter/Space to navigate).
- Status dots should have `aria-label` (e.g. `aria-label="Status: Active"`).

## Responsive Behavior

| Breakpoint | Change |
|------------|--------|
| >= 1024px | Full 5-column grid row layout as spec'd |
| 768-1023px | Collapse "Type" column into the source name row (stack vertically). Hide last-sync column. |
| < 768px | Single-column card layout per row. Type icon + name on top, source below, status + sync on a third line. |

The modal should be full-screen on mobile (< 640px) with `border-radius: 0` and `height: 100vh`.

## Implementation Notes

### Existing Code References

The integrations page uses CSS modules with naming pattern `Integrations_integrations__*`:
- `Integrations_integrations__types-list-item__DKXJP` -- integration type card
- `Integrations_integrations__types-list-item-icon__tZOMN` -- card icon
- `Integrations_integrations__types-list-item-text-name__U3Vw2` -- card name
- `Integrations_integrations__types-list-item-text-description__fQ5HZ` -- card description
- `Integrations_integrations__types-list-item-arrow__AmzFT` -- card chevron

The new active integrations list should follow the same CSS module pattern.

### Feature Flag

Consider gating behind a feature flag (e.g. `integrations_overview_v2`) so it can be rolled out per-org. Orgs with zero integrations should see no difference.

### Performance

The page should not make N requests to fetch instances per type. A single consolidated endpoint is required. If the API does not support this yet, it should be added before the frontend work begins.
