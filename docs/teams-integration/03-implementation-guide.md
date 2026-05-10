# Teams Integration: Implementation Guide (Phase 1)

## Overview

Phase 1 embeds tchop.io's existing React web app as a Microsoft Teams personal tab with silent SSO. No new UI is built. The React app detects it's running inside Teams, authenticates via Azure AD, maps the user to a tchop account, and renders the normal content experience.

---

## Prerequisites

- Azure AD tenant access (for App Registration)
- Microsoft Teams admin access (for testing and deployment)
- tchop.io React web app codebase
- tchop.io Node.js backend codebase
- A publicly accessible HTTPS domain for the web app (e.g. `app.tchop.io`)

---

## 1. Azure AD App Registration

Create a new App Registration in the Azure portal (portal.azure.com > Azure Active Directory > App registrations).

| Setting | Value |
|---|---|
| **Name** | tchop.io Teams Integration |
| **Supported account types** | Accounts in any organizational directory (multi-tenant) |
| **Application ID URI** | `api://app.tchop.io/{client-id}` |
| **Exposed scope** | `api://app.tchop.io/{client-id}/access_as_user` |
| **Authorized client applications** | `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop/mobile), `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web) |

Multi-tenant is required because different customers have different Azure AD tenants. No client secret is needed for the SSO token itself. A client secret is only needed later if you want to call Microsoft Graph on behalf of the user (e.g. profile photos).

---

## 2. App Manifest

The deliverable is a `.zip` file containing three files:

### manifest.json

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
  "version": "1.0.0",
  "manifestVersion": "1.17",
  "id": "{{your-app-guid}}",
  "name": {
    "short": "tchop",
    "full": "tchop.io Communication Platform"
  },
  "description": {
    "short": "Company news and community in Teams",
    "full": "Access your organization's content, news, and community directly inside Microsoft Teams. tchop.io brings your branded communication platform into Teams so employees never miss important updates."
  },
  "developer": {
    "name": "tchop GmbH",
    "websiteUrl": "https://tchop.io",
    "privacyUrl": "https://tchop.io/privacy",
    "termsOfUseUrl": "https://tchop.io/terms"
  },
  "icons": {
    "color": "color.png",
    "outline": "outline.png"
  },
  "staticTabs": [
    {
      "entityId": "tchop-home",
      "name": "Home",
      "contentUrl": "https://app.tchop.io/teams",
      "scopes": ["personal"]
    }
  ],
  "validDomains": [
    "app.tchop.io",
    "*.tchop.io"
  ],
  "webApplicationInfo": {
    "id": "{{aad-app-client-id}}",
    "resource": "api://app.tchop.io/{{aad-app-client-id}}"
  },
  "permissions": ["identity"],
  "devicePermissions": []
}
```

### Icons

- `color.png`: 192x192 px, full-color app icon (the tchop logo on a colored background)
- `outline.png`: 32x32 px, monochrome outline icon (white icon on transparent background, used in the Teams sidebar)

---

## 3. React App Changes

### Install Teams JS SDK

Add `@microsoft/teams-js` to the React project. This is a lightweight client-side library (~50KB).

### Teams Detection and Initialization

Create a Teams context provider that wraps the app when running inside Teams:

```typescript
import { app, authentication } from '@microsoft/teams-js';

type TeamsContext = {
  isInTeams: boolean;
  theme: string;
  userObjectId?: string;
  tenantId?: string;
};

async function detectTeams(): Promise<TeamsContext> {
  try {
    await app.initialize();
    const context = await app.getContext();
    return {
      isInTeams: true,
      theme: context.app.theme || 'default',
      userObjectId: context.user?.id,
      tenantId: context.user?.tenant?.id,
    };
  } catch {
    return { isInTeams: false, theme: 'default' };
  }
}
```

### SSO Authentication Flow

When the app detects it's in Teams, use the Teams SSO flow instead of the normal login:

```typescript
async function authenticateViaTeams(): Promise<string> {
  // Get Microsoft token silently (no popup)
  const msToken = await authentication.getAuthToken();

  // Exchange for tchop session token
  const response = await fetch('/api/auth/teams-sso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: msToken }),
  });

  if (!response.ok) {
    throw new Error(`Teams SSO failed: ${response.status}`);
  }

  const { token } = await response.json();
  return token; // This is a normal tchop auth token
}
```

### Fallback for Failed SSO

If `getAuthToken()` fails (admin hasn't consented, user not in Azure AD), fall back to interactive auth:

```typescript
async function authenticateViaTeamsInteractive(): Promise<string> {
  const result = await authentication.authenticate({
    url: `https://app.tchop.io/auth/teams-start`,
    width: 600,
    height: 535,
  });
  return result; // token returned via authentication.notifySuccess()
}
```

This opens a popup within Teams where the user can sign in normally, then the popup closes and returns the token.

### Theme Handling

Map Teams themes to your existing theming system:

```typescript
app.registerOnThemeChangeHandler((theme: string) => {
  // theme is 'default', 'dark', or 'contrast'
  applyTheme(theme);
});
```

For Phase 1, mapping 'default' to your standard light theme is sufficient. Dark and high-contrast are needed for AppSource store approval but not for admin-sideloaded deployment.

### Link Handling

Replace any `window.open()` calls with the Teams SDK when running inside Teams:

```typescript
function openLink(url: string) {
  if (teamsContext.isInTeams) {
    app.openLink(url);
  } else {
    window.open(url, '_blank');
  }
}
```

### Route

Add a `/teams` route (or detect via URL parameter) as the entry point referenced in the manifest's `contentUrl`. This route triggers the Teams initialization path instead of the normal auth flow.

---

## 4. Backend Changes

### New Endpoint: POST /api/auth/teams-sso

Validates the Microsoft JWT and maps the user to a tchop account. See the [SSO Flow document](04-sso-flow.md) for the complete implementation.

### Data Model

Add a table for external identity linking (if not already present):

```sql
CREATE TABLE user_external_identities (
  user_id        UUID REFERENCES users(id),
  provider       VARCHAR(50),     -- 'azure_ad'
  external_id    VARCHAR(255),    -- Azure AD oid
  tenant_id      VARCHAR(255),    -- Azure AD tenant ID
  email          VARCHAR(255),    -- for reference
  linked_at      TIMESTAMP,
  PRIMARY KEY (provider, external_id)
);
```

Add a tenant-to-organisation mapping:

```sql
CREATE TABLE organisation_azure_tenants (
  organisation_id  UUID REFERENCES organisations(id),
  azure_tenant_id  VARCHAR(255) UNIQUE,
  auto_provision   BOOLEAN DEFAULT false,
  created_at       TIMESTAMP
);
```

### CMS Configuration

Add a section in the organisation settings (CMS dashboard) where admins can:
- Enter their Azure AD tenant ID
- Toggle auto-provisioning for new users from Teams
- Set the default channel assignment for auto-provisioned users

---

## 5. Infrastructure Changes

### NGINX / Hosting

Update headers to allow Teams to embed your app in an iframe:

```nginx
# Allow Teams to frame the app
add_header Content-Security-Policy "frame-ancestors teams.microsoft.com *.teams.microsoft.com *.skype.com" always;

# Remove X-Frame-Options if currently set to DENY or SAMEORIGIN
# (CSP frame-ancestors supersedes X-Frame-Options)
```

Update cookie settings for cross-origin iframe:

```nginx
# Session cookies must work inside the Teams iframe
proxy_cookie_flags ~ SameSite=None Secure;
```

If your app sets cookies via application code (not NGINX), update the cookie configuration there instead.

---

## 6. Testing

### Local Development

Use the Teams Toolkit VS Code extension or the `teamsapp` CLI to sideload your app locally. The toolkit provides a dev tunnel (replaces ngrok) so Teams can reach your local dev server.

### Test Matrix

| Scenario | Desktop | Web | Mobile |
|---|---|---|---|
| SSO silent login | Test | Test | Test |
| SSO fallback (interactive) | Test | Test | Test |
| No account found | Test | Test | Test |
| Content feed rendering | Test | Test | Test |
| Article card navigation | Test | Test | Test |
| Push notification links | Test | Test | Test |
| Theme: default (light) | Test | Test | Test |
| Theme: dark | Test | -- | -- |
| Theme: high contrast | Test | -- | -- |

### Deployment

1. Package the manifest: `zip -r tchop-teams.zip manifest.json color.png outline.png`
2. IT admin uploads to Teams Admin Center > Manage Apps > Upload Custom App
3. Admin creates a Setup Policy and pins the app for target users
4. Users see the tchop icon in their Teams sidebar

No Microsoft review required for admin-deployed apps.

---

## Effort Estimate

| Task | Effort |
|---|---|
| Azure AD App Registration + configuration | ~1 day |
| React: Teams SDK integration, SSO flow, theme handling, link handling | ~1-2 weeks |
| Backend: SSO endpoint, token validation, user mapping | ~1 week |
| Infrastructure: CSP headers, cookie SameSite | ~1 day |
| Manifest + icons + packaging | ~1 day |
| Testing across Teams clients + edge cases | ~1-2 weeks |
| **Total** | **~3-5 weeks** |

---

## Dependencies

- Access to an Azure AD tenant for App Registration (can use a free Microsoft 365 developer tenant for initial development)
- At least one test customer willing to deploy the app in their Teams environment
- Design team for the 192x192 and 32x32 app icons
