# Setting up the Competitor Comparison Pages in Framer

Step-by-step guide to create the `/compare/:slug` CMS page that powers tchop vs [Competitor] comparison pages.

## What already exists

- **Competitors CMS collection** in Framer with all fields populated for Staffbase, Circle, and Flip (25 fields each)
- The old static `/compare` page has been deleted

## What you will build

A single CMS-connected page at `/compare/:slug` that automatically generates one page per competitor:

- `tchop.io/compare/staffbase`
- `tchop.io/compare/circle`
- `tchop.io/compare/flip`
- (and any new competitors added to the CMS later)

Estimated time: **25-30 minutes**.

---

## Phase 1: Create the CMS page

1. Open the Framer project
2. In the **left sidebar** (Pages panel), click the **+** button at the top
3. In the dialog, choose **"CMS Page"** (not "Page")
4. When asked to select a collection, choose **Competitors**
5. Framer will create a page with an auto-generated path
6. Click the **three dots** next to the new page -> **Settings**
7. Change the path to `/compare/:slug`
8. Save

You now have an empty CMS page connected to the Competitors collection.

---

## Phase 2: Copy the layout from the glossary page

We will not build the layout from scratch. We copy the glossary detail page because it already has the correct background, hero, typography, and responsive breakpoints.

1. Open the **glossary internal-communication detail page**: `/resources/glossary/internal-communication/:slug`
2. In the canvas, click the outer **Desktop** frame to select the root
3. Multi-select these direct children (hold Shift while clicking):
   - **SectionsNavbar** (fixed top nav)
   - **Background** (the frame containing the SVG grid pattern + radial gradient + fade-out)
   - **Stack** (the hero + body wrapper containing Hero and Body)
   - **CTA**
   - **FooterWrap**
4. **Cmd+C** to copy
5. Switch to the new `/compare/:slug` page
6. Click into the empty Desktop frame
7. **Cmd+V** to paste

The page should now look visually identical to the glossary detail page (before binding).

Repeat the copy+paste on the **Tablet** and **Phone** breakpoints if they exist, so responsive behavior carries over.

---

## Phase 3: Rebind the hero to Competitors fields

The hero currently shows glossary fields. Rebind to Competitors fields:

### 3a. Title

1. Click the **Title** text in the hero
2. Right panel -> look for the CMS binding (database icon next to the text input)
3. Currently bound to glossary's **Title**. Change to one of these approaches:

**Option A (preferred if Framer supports text templates):**
- Bind to: `"tchop vs " + Competitors.Name`

**Option B (simpler):**
- Replace the single Title text block with two inline text blocks in a horizontal stack:
  - First: static text "tchop vs "
  - Second: bound to Competitors **Name**

### 3b. Description

1. Click the **description/subtitle text** below the title
2. Rebind from glossary's "Meta description" to Competitors **ShortVerdict**

**Test:** Navigate to the page in preview. Title should show "tchop vs Staffbase" (or whichever competitor). Subtitle should show the short verdict paragraph.

---

## Phase 4: Build the body sections

The glossary body has one rich text block bound to glossary's "Content". We replace it with 7 stacked rich text blocks, each bound to a different Competitors field.

1. Click the existing **Body** frame/rich text block
2. Delete the single rich text content (but keep the Body container)
3. Inside the Body container, insert a **Stack** with these properties:
   - Direction: **vertical**
   - Gap: **60px**
   - Width: **1fr** (fill parent)
   - Max width: **800px**
   - Alignment: **start**
4. Inside this stack, add **7 Rich Text elements** in this exact order. For each, bind to the Competitors CMS field listed:

| Order | Section purpose | Bind to field |
|-------|-----------------|---------------|
| 1 | Feature comparison table | `FeatureComparison` |
| 2 | What the competitor does well | `TheirStrengths` |
| 3 | Where the competitor falls short | `TheirWeaknesses` |
| 4 | Why organizations choose tchop | `TchopAdvantages` |
| 5 | How to evaluate by role | `StakeholderGuide` |
| 6 | What our customers say | `CustomerProof` |
| 7 | Frequently asked questions | `FAQ` |

**Important:** Each of these CMS fields already contains its own `<h3>` heading inside the rich text (e.g., "What Staffbase does well", "Feature comparison"). You do NOT need to add separate heading text blocks above each rich text element -- the headings render automatically.

---

## Phase 5: Add the verdict box

Between the `CustomerProof` and `FAQ` sections (slot it as the 7th element and push FAQ to 8th), add a styled verdict box:

1. Insert a new **Stack** inside the body stack, positioned between section 6 (CustomerProof) and section 7 (FAQ):
   - Width: **1fr**
   - Background color: **/Primary 25** (the light orange from the color styles panel)
   - Border radius: **16px**
   - Padding: **40px** on all sides
   - Direction: **vertical**
   - Gap: **20px**
   - Alignment: **start**

2. Inside the stack, add three text elements:
   - **Text 1:** Static heading "The verdict" with text style **/Heading Medium**
   - **Text 2:** Text block bound to Competitors **BestForThem**, text style **/Text Medium**
   - **Text 3:** Text block bound to Competitors **BestForTchop**, text style **/Text Medium**

The final body order should be:

1. FeatureComparison
2. TheirStrengths
3. TheirWeaknesses
4. TchopAdvantages
5. StakeholderGuide
6. CustomerProof
7. **Verdict box** (BestForThem + BestForTchop)
8. FAQ

---

## Phase 6: SEO settings

1. Click the page in the Pages panel -> **three dots** -> **Settings**
2. Go to the **SEO** or **Metadata** tab
3. Set the following:
   - **Page Title**: bind to `MetaTitleEN`
   - **Description**: bind to `MetaDescriptionEN`
   - **Canonical URL**: leave default or bind to `LocalizedPathEN`
4. If there is an OpenGraph image field, bind to `Logo` (optional)
5. Save

---

## Phase 7: German (DE) variant (optional, can be done later)

Framer supports locale variants. For the German site:

1. In Framer, switch to the **DE locale**
2. The page automatically creates a DE variant at `/de/compare/:slug`
3. Rebind the same fields to the DE variants:
   - Title prefix: "tchop im Vergleich zu " (or similar)
   - Description: `ShortVerdict` (currently EN only -- needs DE translation in CMS)
   - Meta title: `MetaTitleDE`
   - Meta description: `MetaDescriptionDE`
   - Localized path: `LocalizedPathDE`

Note: Most rich text fields (TheirStrengths, etc.) are currently EN only. DE translations need to be added to the CMS fields before the DE variant will show proper German content.

---

## Phase 8: Preview and verify

1. Click the **Preview** button in Framer (top right)
2. Navigate to these URLs in the preview:
   - `/compare/staffbase`
   - `/compare/circle`
   - `/compare/flip`
3. Each should render with the same layout but different content

### Check for these visual issues

- [ ] Hero title shows "tchop vs [Competitor Name]"
- [ ] ShortVerdict paragraph appears below the title
- [ ] FeatureComparison renders as a styled table (not plain text)
- [ ] Strengths, weaknesses, advantages render as bulleted lists with bold headings
- [ ] Verdict box has the light orange background
- [ ] FAQ section renders with question/answer formatting
- [ ] CTA block appears at the bottom
- [ ] Footer appears below CTA

### Check on mobile

Use Framer's responsive preview to switch to Tablet and Phone breakpoints. All sections should reflow cleanly.

---

## Phase 9: Publish

1. Once all three competitor pages look correct, click **Publish** in Framer
2. The new pages go live at:
   - `tchop.io/compare/staffbase`
   - `tchop.io/compare/circle`
   - `tchop.io/compare/flip`
3. Add the URLs to the sitemap if Framer does not auto-generate them

---

## Troubleshooting

### "Can't bind to CMS field"
The page is not connected to the Competitors collection. Check page Settings -> CMS Collection.

### "Rich text shows plain text without formatting"
The field type in the CMS must be `formattedText` (not `string`). All the relevant fields (TheirStrengths, TheirWeaknesses, TchopAdvantages, FeatureComparison, FAQ, CustomerProof, StakeholderGuide) are already `formattedText` -- if one shows as plain text, re-check the binding.

### "Hero title shows 'Name' instead of 'Staffbase'"
The binding did not save. Click the text, look for the CMS database icon in the right panel, and reselect the field.

### "Table in FeatureComparison looks unstyled"
Framer's rich text renderer should support `<table>` by default. If it does not, you may need a custom code component. For now, contact the developer who set up the glossary formatting -- they already solved this for the glossary body.

### "Tablet/Phone layout is broken"
You may have only pasted the Desktop layout. Repeat Phase 2 on the Tablet and Phone breakpoints as well.

---

## Adding more competitors later

When we want to add a new competitor (e.g., Beekeeper, Mighty Networks, Hivebrite):

1. Open the Competitors CMS collection in Framer
2. Click **+ New Item**
3. Fill in all 25 fields (or have Claude populate them via MCP)
4. Set **Published** to true
5. The new page automatically appears at `/compare/[slug]` -- no page changes needed

The full list of competitors we plan to cover (from brand.md):

**Internal comms segment:** Staffbase (done), Flip (done), Beekeeper, Haiilo, Quiply
**Community segment:** Circle (done), Hivebrite, Mighty Networks
**Media segment:** Pugpig, Twipe

---

## Reference: CMS field IDs (for developers)

The Competitors collection ID is `fW8ijKvif`. Field IDs:

| Field name | Field ID | Type |
|------------|----------|------|
| LocalizedPathEN | `Fy7nDIBJp` | string |
| LocalizedPathDE | `EDSWCMSqd` | string |
| Name | `Le2eDj4Ca` | string |
| Tagline | `wAKYHCrwb` | string |
| Logo | `McfNvZJ2j` | image |
| Segment | `emSFlMZzD` | enum |
| ShortVerdict | `Kzio1kwzJ` | string |
| MetaTitleEN | `w5MedQp5n` | string |
| MetaTitleDE | `BhHOmXGw6` | string |
| MetaDescriptionEN | `jNN6u0giO` | string |
| MetaDescriptionDE | `y8ufNAH3j` | string |
| TheirStrengths | `ugH6nnUtA` | formattedText |
| TheirWeaknesses | `wSglgru8s` | formattedText |
| TchopAdvantages | `SRkRcnPmY` | formattedText |
| FeatureComparison | `xE79e5Ld9` | formattedText |
| PricingContext | `QD_PV7BoQ` | string |
| BestForThem | `JI_D1Quhk` | string |
| BestForTchop | `ogt8csegQ` | string |
| FAQ | `rS8qGr7Jx` | formattedText |
| Published | `vHrY0mOfD` | boolean |
| Author | `e3ekp23fG` | string |
| PublishDate | `vmsevySvL` | date |
| CustomerProof | `bPqzk7AN2` | formattedText |
| AnalystValidation | `iARaR67q9` | string |
| StakeholderGuide | `FE7CJUsnf` | formattedText |

Segment enum cases:
- `uLiFHUWXd` = internal-comms
- `AFX9ikWyz` = community
- `y6Uq7f_KI` = media
