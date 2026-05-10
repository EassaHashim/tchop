# Teams Integration: SSO Token Exchange Flow

## Overview

When a user opens the tchop tab inside Teams, authentication happens silently in the background. Teams provides a Microsoft JWT token, the tchop backend validates it and maps the Microsoft identity to a tchop user account, then issues a normal tchop session token. The user never sees a login screen.

---

## The Full Sequence

```
User clicks tchop icon in Teams
         |
         v
[1] Teams loads the React app in an iframe (contentUrl from manifest)
         |
         v
[2] React app calls app.initialize() then authentication.getAuthToken()
         |
         v
[3] Teams silently requests an Azure AD token scoped to the tchop app
    (no popup, no redirect, invisible to the user)
         |
         v
[4] Teams returns a JWT (ID token) to the React app
         |
         v
[5] React app sends this token to the tchop backend
    POST /api/auth/teams-sso  { token: "eyJhbG..." }
         |
         v
[6] Backend validates the Microsoft JWT
    - Verify signature against Microsoft's JWKS endpoint
    - Check iss = https://login.microsoftonline.com/{tenant}/v2.0
    - Check aud = the Azure AD App ID
    - Check exp (not expired)
    - Check tid (tenant ID)
         |
         v
[7] Backend extracts user identity from the token claims
    - oid:                Azure AD user object ID (stable, unique per user per tenant)
    - preferred_username: user's email (e.g. maria@company.com)
    - name:               display name
    - tid:                tenant ID
         |
         v
[8] Backend maps Microsoft identity to a tchop user
    (see User Mapping section below)
         |
         v
[9] Backend issues a tchop session token (the normal auth token)
         |
         v
[10] React app stores the tchop token, user is authenticated
     The app renders normally from here
```

---

## User Mapping (Step 8)

This is where all the complexity lives. Three scenarios must be handled.

### Scenario A: Customer already uses Azure AD SSO with tchop

Some enterprise clients already authenticate to tchop via OIDC or SAML with Microsoft Entra ID as their identity provider. For these customers, the Azure AD `oid` is already stored in the user table as an external identity.

```
token.oid  -->  lookup in user_external_identities by (provider='azure_ad', external_id=oid)
           -->  found
           -->  issue tchop session
```

No extra work needed. The identity link already exists.

### Scenario B: Customer uses email/password, emails match

Most common scenario for early adopters. The user has a tchop account with `maria@company.com` and a Microsoft account with the same email.

```
token.preferred_username = "maria@company.com"
    --> lookup in user_external_identities by oid  --> not found
    --> fallback: lookup in users table by email    --> found
    --> link the Azure AD oid to this user (store in user_external_identities)
    --> issue tchop session
```

The first login links the accounts via email matching. All subsequent logins go directly via the stored `oid`, skipping the email lookup.

### Scenario C: No matching user found

The Teams user has no tchop account. Three options, configurable per organisation:

1. **Auto-provision:** Create a tchop user from the Microsoft token claims (name, email). Assign to the correct organisation based on the tenant ID mapping. Assign to a default channel. Best for large rollouts where IT wants zero friction.

2. **Show onboarding:** Display a screen: "Your company uses tchop. Enter your invitation code or contact your admin." User completes signup, then accounts are linked.

3. **Block with message:** "No account found. Contact your IT administrator." Simplest, used when the organisation wants to control user provisioning manually.

The choice is exposed as a per-organisation setting in the tchop CMS dashboard.

---

## Backend Implementation

### Token Validation and User Mapping

```typescript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const microsoftJwksUri = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';

const client = jwksClient({ jwksUri: microsoftJwksUri, cache: true });

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    client.getSigningKey(header.kid!, (err, key) => {
      if (err) return reject(err);
      resolve(key!.getPublicKey());
    });
  });
}

async function handleTeamsSso(microsoftToken: string) {
  // Validate the JWT
  const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
    jwt.verify(
      microsoftToken,
      (header, callback) => {
        getSigningKey(header)
          .then(key => callback(null, key))
          .catch(callback);
      },
      {
        audience: process.env.AZURE_AD_APP_ID,
        issuer: /^https:\/\/login\.microsoftonline\.com\/.*\/v2\.0$/,
        algorithms: ['RS256'],
      },
      (err, payload) => err ? reject(err) : resolve(payload as jwt.JwtPayload)
    );
  });

  const { oid, preferred_username, name, tid } = decoded;

  // Try by linked Azure AD identity
  let user = await db.users.findByExternalId('azure_ad', oid);

  if (!user) {
    // Try by email match
    user = await db.users.findByEmail(preferred_username);
    if (user) {
      // Link for future logins
      await db.users.linkExternalId(user.id, 'azure_ad', oid, tid);
    }
  }

  if (!user) {
    // No account found -- check org config
    const org = await db.organisations.findByAzureTenantId(tid);
    if (org?.teamsAutoProvision) {
      user = await db.users.create({
        email: preferred_username,
        name: name,
        organisationId: org.id,
        externalId: { provider: 'azure_ad', id: oid },
      });
    } else {
      throw new NoAccountError(tid, preferred_username);
    }
  }

  // Issue normal tchop session token
  const tchopToken = await issueSessionToken(user);
  return { token: tchopToken, user };
}
```

---

## React Implementation

### Silent SSO (Primary Path)

```typescript
import { app, authentication } from '@microsoft/teams-js';

async function initTeamsAuth() {
  await app.initialize();

  try {
    // Get Microsoft token silently -- no popup, no redirect
    const msToken = await authentication.getAuthToken();

    // Exchange for tchop session
    const response = await fetch('/api/auth/teams-sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: msToken }),
    });

    if (response.ok) {
      const { token } = await response.json();
      setAuthToken(token);
      // App renders normally from here
    } else if (response.status === 404) {
      // No account found
      showTeamsOnboarding();
    }
  } catch (err) {
    // SSO failed -- fall back to interactive login
    showLoginForm();
  }
}
```

### Interactive Fallback

If silent SSO fails (admin hasn't consented to the app's permissions, or the user isn't in Azure AD), fall back to an interactive popup:

```typescript
async function authenticateViaTeamsInteractive(): Promise<string> {
  const result = await authentication.authenticate({
    url: 'https://app.tchop.io/auth/teams-start',
    width: 600,
    height: 535,
  });
  return result;
}
```

The popup page at `/auth/teams-start` shows the normal tchop login form. After successful login, it calls `authentication.notifySuccess(token)` to return the token to the parent iframe and close the popup.

---

## Azure AD App Registration

| Setting | Value |
|---|---|
| **Application ID URI** | `api://app.tchop.io/{client-id}` |
| **Exposed scope** | `api://app.tchop.io/{client-id}/access_as_user` |
| **Authorized client applications** | `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop/mobile), `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web) |
| **Supported account types** | Accounts in any organizational directory (multi-tenant) |
| **ID token claims** | `oid`, `preferred_username`, `name`, `tid` (included by default) |

No client secret is needed for the SSO token validation itself. A client secret is only required if you later implement the On-Behalf-Of (OBO) flow to call Microsoft Graph API on the user's behalf (e.g. to fetch profile photos or read calendar data).

---

## Data Model

### user_external_identities

Stores the link between a tchop user and their Azure AD identity.

```sql
CREATE TABLE user_external_identities (
  user_id        UUID REFERENCES users(id),
  provider       VARCHAR(50),     -- 'azure_ad', 'google', 'saml', etc.
  external_id    VARCHAR(255),    -- the oid from Azure AD
  tenant_id      VARCHAR(255),    -- Azure AD tenant ID
  email          VARCHAR(255),    -- for reference/debugging
  linked_at      TIMESTAMP,
  PRIMARY KEY (provider, external_id)
);
```

### organisation_azure_tenants

Maps Azure AD tenants to tchop organisations. Required for multi-tenant support (each customer has their own Azure AD tenant).

```sql
CREATE TABLE organisation_azure_tenants (
  organisation_id  UUID REFERENCES organisations(id),
  azure_tenant_id  VARCHAR(255) UNIQUE,
  auto_provision   BOOLEAN DEFAULT false,
  created_at       TIMESTAMP
);
```

---

## Edge Cases

### Admin consent not granted

`getAuthToken()` throws an error because the organisation's Azure AD admin hasn't approved the app's permissions yet. The React app catches this and shows a "Sign in" button that uses the interactive fallback (`authentication.authenticate()`).

First-time deployment requires an admin to grant consent in the Teams Admin Center (Permissions tab of the app). This is a one-time action per tenant.

### Multi-tenant token validation

Because different customers have different Azure AD tenants, validate against the `common` JWKS endpoint (`https://login.microsoftonline.com/common/discovery/v2.0/keys`), not a tenant-specific one. The `tid` claim in the token tells you which tenant the user belongs to, which maps to the correct tchop organisation.

The issuer claim varies per tenant: `https://login.microsoftonline.com/{tid}/v2.0`. Use a regex pattern for validation, not a fixed string.

### Token expiry and refresh

The Microsoft token from `getAuthToken()` is short-lived (~1 hour). Your tchop session token should have its own expiry policy (whatever you use today). When the tchop token expires, call `getAuthToken()` again to get a fresh Microsoft token and re-exchange it. This is silent and invisible to the user.

### User email changed in Azure AD

If a user's email changes in Azure AD, the `oid` stays the same. This is why you store and match on `oid` after the initial linking, not on email. Email is only the fallback for first-time account linking.

### Multiple tchop organisations, same Azure AD tenant

Possible if a company runs separate tchop instances for different departments. Handle by either:
- Including an organisation identifier in the manifest's `contentUrl` (different manifests per org)
- Presenting a chooser on first login and storing the selection

### User removed from Azure AD

If an employee leaves the company and their Azure AD account is disabled, `getAuthToken()` will fail. The user can't access the Teams tab. No action needed on your side -- Azure AD handles the access revocation.

### Rate limiting

The `/api/auth/teams-sso` endpoint exchanges tokens on every app load. Standard rate limiting applies. Since this is per-user (not bulk), normal API rate limits are sufficient. No special throttling needed.
