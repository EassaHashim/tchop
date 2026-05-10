# Teams Integration: AppSource Store Listing

## Why Publish to the Store

Phase 1 deploys via sideloading: you hand a `.zip` file to the customer's IT admin, they upload it to their Teams Admin Center. That works, but it has limits.

Publishing to Microsoft AppSource (the Teams app store) changes the distribution model:

- Any Teams admin can find tchop by searching the built-in app catalog. No file exchange needed.
- Adds credibility with IT/procurement teams. Being in the Microsoft store signals that the app passed Microsoft's security and quality review.
- The listing itself works as a marketing surface: description, screenshots, links, reviews.
- Updates roll out automatically to all tenants that installed the app.

---

## What's Required

### Microsoft AI Cloud Partner Program

Join the program (formerly Microsoft Partner Network). Free, takes a day. This gives you access to Partner Center where you manage your store listing.

### Publisher Attestation

A self-service security questionnaire covering data handling, privacy, and compliance practices. Takes 1-2 hours to fill out. Given the existing ISO 27001 certification (TUeV Sued, October 2025), most answers are straightforward.

This is the minimum trust level required for a store listing. It's self-attested, not audited.

Optional next level: **Microsoft 365 Certification** requires a third-party audit (SOC 2 Type 2 or equivalent). Strongly recommended for enterprise adoption but not required for launch. Can take 2-6 months if you don't already have SOC 2. Worth considering later.

### App Requirements for Store Approval

| Requirement | Detail |
|---|---|
| **HTTPS everywhere** | All URLs in manifest, all tab content, all endpoints must be HTTPS |
| **Privacy policy** | Public URL required, must explain data collection, storage, sharing |
| **Terms of use** | Public URL required |
| **Support contact** | Public support URL or email |
| **Publisher verification** | Azure AD app must have verified MPN ID linked |
| **Dark mode** | App must handle the Teams dark theme |
| **High contrast** | App must handle the Teams high-contrast theme |
| **Mobile support** | Tabs must render correctly on Teams iOS and Android |
| **Responsive design** | Works across desktop, web, and mobile Teams clients |
| **Auth handling** | Silent SSO first, graceful fallback to interactive. Must show a clear sign-in prompt, never a blank screen |
| **No extraneous permissions** | Only request Azure AD scopes actually used |
| **Manifest validation** | Must pass schema validation, `validDomains` must list all domains loaded in iframes |

### Listing Assets

| Asset | Specification |
|---|---|
| **Short description** | Max 80 characters |
| **Long description** | Max 4,000 characters |
| **Screenshots** | Min 1, recommended 3-5. Size: 1366x768 px. Show the app inside Teams. |
| **App icons** | 192x192 px (color), 32x32 px (outline) |
| **Category** | Select from Microsoft's predefined list (e.g. "Productivity", "Human Resources") |
| **Supported languages** | Declare EN, DE |

---

## The Review Process

### Step by Step

1. **Prepare the app package.** Manifest, icons, all URLs live and HTTPS.
2. **Run the Teams App Validation tool.** Built into Teams Toolkit and Partner Center. Catches manifest errors, broken URLs, missing fields.
3. **Create the Partner Center listing.** Fill in descriptions, upload screenshots, set privacy policy URL, terms of use URL, support URL.
4. **Submit for review.**
5. **Automated validation runs first (~hours).** Checks manifest schema, URL accessibility, basic functionality.
6. **Manual review by Microsoft testers (~1-4 weeks).** They install the app, test all declared capabilities, verify auth flows, check policy compliance.
7. **Approved or rejected with feedback.**

### Common Rejection Reasons

- Auth flow fails or shows a blank screen in some scenario
- Tab doesn't handle all three themes (default, dark, high contrast)
- App doesn't work on mobile Teams
- Missing or vague privacy policy
- Broken deep links
- App description doesn't match actual functionality
- Interactive fallback auth not graceful

### After Rejection

Fix the issues, resubmit. Each resubmission goes through review again, typically 1-2 weeks for resubmissions.

### After Approval

The app appears in AppSource within 24-48 hours. Subsequent version updates also go through review but are typically faster (1-2 weeks) for minor changes.

---

## Timeline

| Task | Duration |
|---|---|
| Partner Network enrollment | ~1 day |
| Publisher Attestation questionnaire | ~1-2 days |
| Dark mode + high contrast support in the app | ~3-5 days dev |
| Screenshots and listing copy | ~1 day |
| Submission + automated validation | ~1 day |
| Microsoft manual review | 1-4 weeks |
| **Total from start to live listing** | **~3-6 weeks** |

Most of the time is waiting for Microsoft's review. The actual dev work (dark mode, listing assets) is small.

---

## Recommendation

Start the store listing process in parallel with Phase 2 (notifications). The listing doesn't block any customer deployment since sideloading works immediately for any customer whose IT admin uploads the `.zip`. The store listing is about discoverability and trust, not access.

For the first 2-3 enterprise customers, sideloading is fine. The store listing pays off once you want Teams-using organisations to find tchop on their own.
