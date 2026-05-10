# Teams Integration: Options, Staffbase Benchmark and Priorities

## What Staffbase Ships

Staffbase offers three separate integration components for Microsoft Teams, built up over several years:

### 1. Staffbase Connect App (the main integration)

The core offering. Embeds the full Staffbase intranet as a Teams personal tab app. Technically, it's an iframe wrapper around their existing web application with Azure AD SSO.

**What users get:**
- Full intranet newsfeed, pages, and targeted content inside Teams
- Custom branding (organisation logo and name visible in Teams)
- Language-targeted and audience-segmented content
- Same experience as the standalone Staffbase web app

**Technical approach:** Personal tab app + iframe + Azure AD SSO. No native Teams UI rebuild.

### 2. Staffbase News Connector (channel notifications)

A Teams channel connector that posts notification cards when new Staffbase articles are published. Configurable: all new posts or only posts flagged with push notifications. Also embeds a Staffbase news tab within the Teams channel.

**Technical approach:** Office 365 Connector / webhook mechanism posting Adaptive Cards into channels + iframe tab.

**Note:** Microsoft is deprecating O365 Connectors. New registrations are blocked. Existing ones still work but migration to bot-based approaches is recommended. Building a new connector today would be a dead end.

### 3. Staffbase Agent for Microsoft 365 Copilot (newest)

An AI-powered extension that feeds Staffbase content to Microsoft 365 Copilot. Employees can ask Copilot questions and get answers sourced from Staffbase content. Source links render as Adaptive Cards with previews.

**Requirements:** Microsoft 365 Copilot license ($30/user/month), SSO via Entra ID.

**Adoption reality:** Very early. Most enterprises don't yet have broad Copilot rollout.

### Additional: Viva Connections Dashboard Card

A SharePoint Framework Adaptive Card Extension (ACE) that shows recent Staffbase news headlines on the Viva Connections dashboard. Clicking through opens the full article in Staffbase.

### Additional: Power Automate Connector

Premium connector exposing 18+ operations (channels, posts, users, media, notifications, comments). Enables no-code automation workflows connecting Staffbase to other Microsoft 365 tools.

---

## Mapping to tchop.io

| Staffbase Component | tchop.io Equivalent | Priority | Effort |
|---|---|---|---|
| Connect App (tab + SSO) | Embed tchop web app as personal tab | **P1 -- Must have** | 3-5 weeks |
| News Connector (channel notifications) | Bot-based proactive messaging (not connector) | **P2 -- High value** | 3-4 weeks |
| Messaging Extension + Link Unfurling | Search tchop content from compose box | **P3 -- Nice to have** | 2-3 weeks |
| Teams Store Listing | AppSource publication | **P2 -- Do in parallel** | 2-4 weeks (waiting) |
| Copilot Agent | AI Q&A over tchop content | **P4 -- Future** | TBD |
| Viva Connections Card | Dashboard card for Viva | **P5 -- Skip** | Not worth it |
| Power Automate Connector | Automation connector | **P4 -- Future** | TBD |

---

## Recommended Phases

### Phase 1: Teams Tab App with SSO (Priority 1)

**What:** Embed tchop's React web app as a personal tab in Teams. Silent SSO via Azure AD. Users click the tchop icon in their Teams sidebar and get the full content experience.

**Why start here:**
- Lowest effort, highest impact
- Gives Teams users access to 100% of tchop functionality immediately
- Directly matches what Staffbase ships as their primary integration
- Unblocks the "we need Teams integration" checkbox in enterprise sales
- No new UI to build, your React app already exists

**Deliverable:** A `.zip` app package (manifest + icons) that IT admins deploy via Teams Admin Center.

**Effort:** 3-5 weeks including testing.

### Phase 2: Proactive Notifications (Priority 2)

**What:** When tchop fires a push notification (new article, poll, mention), also deliver it as a message or Activity Feed alert inside Teams.

**Why this matters:**
- This is the real value for internal comms buyers
- Employees who live in Teams get reached without opening another app
- Transforms tchop from "another app to check" into "it comes to me where I already am"
- Direct equivalent of Staffbase's News Connector, but built on bots (future-proof, not deprecated connectors)

**Technical approach:**
- Azure Bot Service for proactive messaging
- Adaptive Card templates for article teasers, polls, threads
- Activity Feed notifications via Microsoft Graph API for lighter-touch alerts

**Effort:** 3-4 weeks.

### Phase 3: Messaging Extension + Link Unfurling (Priority 3)

**What:** Users search tchop content from the Teams compose box. When someone pastes a tchop link in a Teams chat, it auto-expands into a rich preview card with headline, image, and summary.

**Why:** Useful but not essential. Makes tchop content more shareable within Teams conversations. Lower urgency than notifications.

**Effort:** 2-3 weeks.

### Phase 4: Teams Store Listing (Priority 2, parallel track)

**What:** Publish the app to Microsoft AppSource for public discoverability.

**Why do in parallel:** Having an AppSource listing builds trust with IT/procurement teams. Shows up in the Teams app catalog when admins search for employee communication tools.

**Requirements:** Partner Network enrollment, Publisher Attestation, privacy policy, terms of use, screenshots, Microsoft review.

**Note:** You can distribute without the store by having IT admins sideload the .zip directly. This is the faster path for early customers while the store listing is pending.

**Effort:** 2-4 weeks (mostly waiting for Microsoft review).

---

## What NOT to Build

- **Don't build a Viva Connections card.** Low adoption, deep SharePoint dependency, not worth the effort unless a specific customer demands it.
- **Don't build a Copilot agent yet.** Requires customers to have M365 Copilot licenses, adoption is still early. Revisit in 12 months.
- **Don't use O365 Connectors.** They're being deprecated by Microsoft. Go straight to bot-based notifications.
- **Don't rebuild the content experience in Adaptive Cards.** Cards are for notifications and previews. The full reading/interaction experience stays in your web app via the tab. Staffbase does the same.

---

## Competitive Positioning

Once Phases 1 and 2 ship, you can claim:

> "tchop works inside Microsoft Teams. Your employees get company news, community content, and push notifications without leaving Teams."

That matches what Staffbase offers with their Connect app and News connector.

Your existing advantage over Staffbase extends to the Teams integration: faster setup, lower complexity, lower price, better suited for small teams. The Teams integration doesn't change the competitive dynamic, it removes a blocker that was preventing Teams-heavy organisations from choosing tchop.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Azure AD SSO complexity** | User mapping between AAD accounts and tchop accounts can be messy if customers don't already use Azure AD SSO | Prioritize customers who already use Azure AD SSO. Build email-based fallback linking for others |
| **iframe restrictions** | Teams has strict CSP requirements. Your web app must work inside an iframe | Test early. Fix X-Frame-Options, cookie SameSite, and window.top navigation |
| **Mobile Teams client** | Tab iframes in mobile Teams are cramped | Your web app is already responsive. Test on Teams mobile specifically |
| **Rate limits for notifications** | ~30 messages/minute/tenant for bot proactive messaging | Queue and batch. Use Activity Feed for lighter-touch alerts |
| **Store review rejection** | Common: auth flow breaks, themes not handled, mobile doesn't work | Follow Microsoft's validation checklist, test all platforms before submission |
| **Connector deprecation** | O365 Connectors being phased out | Already mitigated: we're using bot-based approach, not connectors |
| **Maintenance burden** | Teams platform changes, manifest schema updates | Budget ongoing maintenance at ~10% of one developer |
| **Scope creep** | Temptation to rebuild native card-based UIs for every content type | Resist. iframe approach is correct. Cards only for notifications and search results |
