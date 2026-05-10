# Microsoft Teams Integration for tchop.io

## Why We're Doing This

A growing number of our enterprise clients, including AOK, rely on Microsoft Teams as their primary workplace tool. Their employees spend most of their day inside Teams. Right now, that means they have to leave Teams and open a separate app or browser tab to access tchop. For deskless workers and busy teams, that extra step is a real barrier. Many simply don't bother.

Our direct competitor Staffbase already ships a Teams integration. In enterprise sales conversations, "Does it work with Teams?" comes up regularly. Not having an answer costs us deals.

## What We Want to Build

We want to bring the full tchop experience into Microsoft Teams. Users should see a tchop icon in their Teams sidebar, click it, and land directly in their content feed. No separate login, no browser, no context switching. The same news, channels, cards, polls, and chat they already know from the tchop app, just inside Teams.

Technically, this means embedding our existing React web app as a Teams personal tab with silent SSO via Azure AD. We're not rebuilding anything. We're making our web app available inside the Teams window and handling authentication automatically in the background.

## Scope

Phase 1 focuses exclusively on the tab integration with SSO. We ship a small app package (a manifest file and two icons) that IT admins deploy via the Teams Admin Center. On our side, the work is: Teams SDK integration in the React app, a new SSO endpoint on the backend, and some header adjustments in our hosting config.

Notifications inside Teams (Phase 2) and a public Teams Store listing come after that. One thing at a time.

## Documentation

The full technical details are split across four documents in this folder:

1. **[Design and UI](01-design-and-ui.md)** -- what the integration looks like for users, layout, themes, navigation
2. **[Options and Priorities](02-options-and-priorities.md)** -- what Staffbase does, what we should build, in what order, and what to skip
3. **[Implementation Guide](03-implementation-guide.md)** -- the technical spec for Phase 1: Azure AD setup, manifest, React and backend changes, testing
4. **[SSO Flow](04-sso-flow.md)** -- deep dive into the authentication flow, user mapping, code examples, edge cases
5. **[Store Listing](05-store-listing.md)** -- AppSource publishing: requirements, review process, timeline
6. **[Notifications](06-notifications.md)** -- proactive notifications in Teams: bot messages, Activity Feed, Adaptive Cards, pipeline architecture
