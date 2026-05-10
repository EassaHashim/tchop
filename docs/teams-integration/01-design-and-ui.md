# Teams Integration: Design, UI and Mental Model

## The Mental Model

The integration embeds tchop.io's existing React web app inside Microsoft Teams as a personal tab. Users see the tchop icon in the Teams left sidebar, click it, and get the full tchop experience without leaving Teams. No separate window, no browser tab, no second login.

```
+--------------------------------------------------+
| Microsoft Teams                                   |
|                                                   |
| [Activity]  |                                     |
| [Chat]      |   +-----------------------------+  |
| [Teams]     |   | tchop.io web app (iframe)    |  |
| [Calendar]  |   |                              |  |
| [tchop] <-- |   |  Your normal React app       |  |
|             |   |  News feed, channels, cards   |  |
|             |   |  Comments, polls, chat        |  |
|             |   |  Everything works as-is       |  |
|             |   +-----------------------------+  |
+--------------------------------------------------+
```

The tchop icon sits alongside Activity, Chat, Teams, Calendar in the pinned sidebar. Clicking it fills the main content area with the tchop React app, rendered inside an iframe. The Teams chrome (title bar, sidebar navigation) stays visible around it.

The SSO layer handles authentication silently. The user never sees a login screen. They click the icon, the app loads, their content appears. From a user's perspective, tchop is just another part of Teams.

---

## What the User Sees

### Desktop (Windows/Mac)

The Teams desktop client renders the personal tab as a full-width iframe occupying the entire main content area. The layout consists of:

- **A (left):** Teams sidebar with the pinned tchop app icon
- **B (top):** Optional tab navigation if the app exposes multiple tabs (e.g. "Home", "Chat")
- **C (main):** The tchop React web app, identical to what users see at `app.tchop.io`

The popout button (top right) lets users open the tab in a standalone window if they prefer.

### Mobile (iOS/Android)

On Teams mobile, the personal tab renders inside a webview. The tchop icon appears in the "More" section (or pinned to the bottom navigation if configured). Tapping it loads the tchop web app in a mobile webview within Teams.

Since tchop's web app is already responsive (React, mobile-first design), it renders correctly in the constrained mobile viewport. The Teams mobile chrome takes some vertical space (status bar, app header, bottom navigation), so the available height is smaller than a standalone mobile browser.

### First-Run Experience

On first access, one of two things happens:

1. **SSO works silently:** The app loads directly into the user's feed. No interaction required.
2. **SSO requires consent or linking:** A branded welcome screen appears with a "Sign in" button. After one-time authentication, subsequent visits are automatic.

Microsoft's design guidelines recommend always having a welcome/empty state rather than a blank screen, even when SSO handles login silently.

---

## Teams Theme Support

Teams has three visual themes that the embedded app should respect:

| Theme | When used |
|---|---|
| **Default** (light) | Standard Teams appearance |
| **Dark** | User preference or system dark mode |
| **High contrast** | Accessibility requirement |

The Teams JS SDK provides the current theme via `app.getContext()` and fires a `themeChanged` event when the user switches. Your React app reads this and maps it to your existing theming system.

For the initial release, supporting "default" (light) is sufficient. Dark mode and high contrast are required for Microsoft AppSource store approval, but not for admin-deployed (sideloaded) distribution.

---

## Navigation and Deep Linking

Within the personal tab, all navigation happens inside the iframe. Standard React Router navigation works as expected. Teams doesn't interfere with in-iframe routing.

For external links (e.g. Article cards that open URLs), use the Teams SDK's `app.openLink(url)` instead of `window.open()`, since `window.open()` is blocked inside Teams iframes.

Deep links from outside Teams (e.g. from push notifications, emails) can open the tchop personal tab directly using Teams deep link format:

```
https://teams.microsoft.com/l/entity/{app-id}/tchop-home
```

This opens Teams (or focuses it if already open) and navigates directly to the tchop tab.

---

## Visual References

- [Microsoft: Designing your personal app](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/design/personal-apps) -- annotated anatomy diagrams for desktop and mobile
- [Microsoft: Tabs in Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/what-are-tabs) -- screenshots of personal tabs on desktop and mobile
- [How to run any website as a Teams app](https://tech-peanuts.com/2021/01/07/how-to-run-any-website-as-a-teams-app/) -- step-by-step with screenshots of a website embedded as a personal tab
- [SharePoint site as Teams app](https://erik365.blog/2021/01/07/attach-a-sharepoint-online-site-as-a-microsoft-teams-app-to-the-microsoft-teams-navigation-bar/) -- desktop and iOS screenshots of an intranet in Teams
- [Staffbase Microsoft 365 page](https://staffbase.com/microsoft-365) -- Staffbase's marketing positioning for their Teams integration
- [Staffbase Connect on AppSource](https://appsource.microsoft.com/en-us/product/office/wa200007073?tab=overview) -- Staffbase's store listing with screenshots
