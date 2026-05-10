# tchop.io — Product Architecture

Reference for understanding the product domain model, terminology, entity relationships, and how the platform works structurally. Use this when building prototypes, writing product copy, creating API integrations, or answering product questions.

For marketing positioning, see: `brand.md`
For infrastructure and tech stack, see: `tech-stack.md`

---

## Core Hierarchy

The platform follows a strict four-layer content hierarchy:

```
Organisation
  └── Channel (1..n)
        └── Mix (1..n)
              └── Card (0..n)
```

Every piece of content lives inside this tree. There are no orphaned cards or free-floating mixes.

---

## Glossary

### Organisation

The top-level entity. One organisation = one app instance. Holds all content, settings, and users. Organisations are strictly isolated from each other for security and privacy.

Contains:
- Global settings (branding, fonts, colors, icons)
- Organisation-level user management
- Push notification configuration
- Tag definitions (both hidden and visible)
- Analytics across all channels
- API tokens and integrations

Only the owner and organisation admins can access organisation-level settings.

### Channel

A self-contained space within an organisation. Channels define who sees what. Each channel has its own content, settings, editors, and user assignments.

Typical use cases for channels:
- Target groups (e.g. management vs. all employees)
- Departments or regions
- Topics or interest groups
- Events or time-limited projects

Channels are dynamic. They can be created, archived, or deleted at any time and changes are reflected instantly in the app. Users with access to multiple channels switch between them inside the app.

Each channel has its own dashboard where editors and admins manage content, community features, user rights, and chat groups.

### Mix

The structural backbone of content within a channel. A mix is a curated feed, section, or topic area. Every card must belong to at least one mix.

Think of mixes as sections on a news site or categories in an intranet. They can hold either live, constantly updating content or static, manually sorted collections.

Mixes control where and how content appears in the app:
- **News feed**: One or more mixes compose the main feed (first screen users see)
- **Navigation list**: Displayed in a browsable list of sections
- **Pinned tab**: Accessible via a fixed tab in the app's bottom navigation
- **Horizontal module**: A swipeable carousel within the news feed

Each mix has a title, optional description, and optional title image. Mixes carry rich settings organized into tabs:

| Tab | Controls |
|-----|----------|
| Display | Where and how the mix appears in the app |
| Content | Comments, likes, sharing, update behavior, language, author display |
| Tags | Default hidden/visible tags auto-assigned to new cards |
| Media | Copyright defaults |
| Rights | Who can post content, by user role |
| Other | Card sync, timestamp display, duplicate prevention, card limits |
| Push | Auto-send push notifications for new cards |
| Sync | Cross-channel mix synchronization |

Mixes can be synced between channels. A synced mix mirrors content from its source, and all edits must happen on the source mix.

### Card

The atomic content unit. All published content exists as a card. Cards live inside mixes and can be synced across multiple mixes.

Every card carries these common fields:
- **Posted time**: When published (updates on repost or pin)
- **Updated time**: Last modification
- **Created time**: Original creation timestamp
- **Author**: The creator (can be reassigned to another user)

All card types support optional comments, reactions, and author display. These social features are toggled per mix, not per card.

---

## Card Types

tchop offers 11 card types covering editorial content, media, community interaction, and data collection.

### Content & Curation Cards

| Type | Purpose | Opens to |
|------|---------|----------|
| **Article** | Links to any external URL. The primary curation card. Scrapes teaser data from the URL. | In-app browser (mobile) or new tab (web) |
| **Long Post** | Native longform article with a block-based editor. The editorial workhorse. | Native reader view inside the app |
| **Social** | Mirrors social media posts (X, Facebook, LinkedIn, Instagram) in a native preview. | Original social post URL |

### Native Short-Form Cards

| Type | Purpose | Required field |
|------|---------|---------------|
| **Text** | Simple text post, like a status update. Supports basic formatting (bold, italic, underline, hyperlink). | Text |
| **Image** | Image with optional text. | Image file |
| **Gallery** | Multiple images (2-20) with individual captions. | 2+ images |
| **Video** | Video with teaser image and text, plays natively. | Video file |
| **Audio** | Audio/podcast with teaser image, plays natively. | Audio file |
| **PDF** | PDF document with auto-generated teaser from first page. | PDF file |

### Interactive Cards

| Type | Purpose | Required field |
|------|---------|---------------|
| **Thread** | Discussion starter. Opens directly into a comment view, works like a forum thread. | Headline |
| **Poll** | Interactive voting (single or multi-select). Results update dynamically. Supports time limits, anonymous voting, and visibility controls for results. | Question + options |

### Teaser Styles

Article and Long Post cards with images support four teaser layouts:
1. **Standard** (default)
2. **Small with intro**
3. **Small without intro**
4. **Big without intro**

Mixing teaser styles within a feed prevents visual monotony.

### Long Post Block Editor

Long Post cards use a block-based editor supporting these block types:

| Block | Notes |
|-------|-------|
| Heading | H1 through H6 |
| Paragraph | Standard text block |
| List | Numbered or bulleted, supports nesting |
| Checkbox | Checklist, no nesting |
| Delimiter | Visual line break |
| Image Gallery | Up to 10 images with captions |
| Embed Link | Any URL, social posts, Google Maps |
| Quote | Left or center aligned, optional author |
| Callout | Highlighted text block |
| Table | Rows/columns with optional header row |
| Code Block | Monospace formatted code |
| Audio | .mp3, .wav, .aiff |
| Video | Any format |
| File | .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt, .rtf, .odt, .ods, .odp |
| PDF | Opens in app or browser |
| Card Block | Embeds a published card |
| Mix Block | Embeds a published mix |
| User Block | Embeds a user profile |

All text blocks support inline formatting: bold, italic, underline, hyperlink, marker, inline code, superscript, subscript.

### Field Limits (Common Across Card Types)

| Field | Max length |
|-------|-----------|
| Headline | 360 chars |
| Title (Article/Long Post) | 160 chars |
| Abstract | 700 chars |
| Source | 160 chars |
| Comment (editor note) | 360 chars |
| Text body | 20,000 chars |
| Author field | 60 chars |
| Copyright text | 160 chars |
| Media files | 100 MB each |
| Gallery images | 2-20 per card |

---

## Tags

Tags categorize cards across the platform. Defined at the organisation level, applied to individual cards.

### Hidden Tags
- Internal use only, not visible to app users
- Only admins and editors can assign them via the CMS
- Used for filtering content in the dashboard and for analytics segmentation
- Useful for editorial workflows, content tracking, campaign attribution

### Visible Tags
- Shown to all users in the app
- Clickable: opens a dynamic tag feed showing all cards with that tag, sorted by posted time
- Can be assigned by editors, limited editors, and readers (depending on permissions)
- Drive content discovery and cross-mix browsing

### Tag Management
- Org admins create, rename, and delete tags in organisation settings
- Tags can be converted between hidden and visible without retagging cards
- Default tags can be set at the mix level (auto-assigned to every new card in that mix)
- Deleting a tag removes it from all associated cards immediately

---

## User Roles & Permissions

### Roles (Hierarchical)

| Role | Dashboard Access | Scope | Typical User |
|------|-----------------|-------|-------------|
| **Organisation Admin** | Full | Entire organisation | Platform owner, IT admin |
| **Channel Admin** | Full (channel) | Single channel | Department head, community manager |
| **Editor** | Content management | Single channel | Content creator, comms team |
| **Editor Limited** | None | App only | Contributor, reporter, influencer |
| **Reader** | None | App only | End user, employee, community member |

Organisation Admin has fixed, immutable permissions. All other roles have configurable permissions set by org admins.

### Permission Categories

**Content management**
- Create/manage own mixes
- Manage mixes created by others

**Push notifications**
- Send push messages via channel dashboard

**User management**
- Add/delete curators (admins/editors)
- Add/delete readers (limited editors/readers)

**Chat**
- Direct chat with org admins, editors, curators, channel readers, or org-wide readers
- Create group chats at channel level

### Authentication

tchop supports multiple authentication methods:
- Email/password (default)
- SSO via OAuth 2.0, OpenID Connect, or SAML 2.0
- Integration with external identity providers
- API and webhook-based user sync

Users can be added manually, in bulk via CSV import, or synced from external systems. Mobile-first design means no corporate email or VPN is required (critical for deskless workers).

---

## Chat System

Integrated real-time messaging with four channel types:
- **1:1 chat**: Private conversations between two users
- **Closed group**: Invite-only group conversations
- **Open group**: Accessible to all channel users
- **Read-only group**: Broadcast-style, only admins can post

Chat groups can be linked to specific mixes or content. Users can share any content type into chats. Push notifications trigger for new messages (configurable per user).

The chat feature is optional and can be restricted to selected user groups.

---

## Push Notifications

Four distinct notification types serve different communication layers:

### 1. Editorial Push
Manually crafted or scheduled notifications linked to content or any URL. Sent to all users or targeted segments. Controlled via the CMS.

### 2. Social Feedback Push (Automatic)
Triggered when users receive interactions: likes, replies, mentions. These are the core engagement driver and fire automatically.

### 3. Chat Push (Automatic)
Real-time notifications for new chat messages (1:1 and group). Works like any modern messaging app.

### 4. Retention Push (Automatic)
Automated re-engagement messages sent to users who haven't opened the app within a configurable period. Headline, text, and image are customizable.

### Automated Content Push
At the mix level, editors can enable auto-push for every new card added to a mix. Supports a configurable prefix added to the notification text. Should be used sparingly to avoid notification fatigue.

### User Control
Users manage their own notification preferences:
- Opt in/out globally
- Filter by channel or chat group
- Mute specific conversations
- Configure sound, banners, or silent delivery
- Manage editorial, chat, and social feedback notifications separately

---

## Deeplinks

Deeplinks let external URLs (from newsletters, social media, messaging apps) open directly inside the native app instead of the browser.

Built on:
- **Apple Universal Links** (iOS)
- **Android App Links** (Android)

Requires two files hosted at the client's domain under `/.well-known/`:
- `apple-app-site-association` (iOS)
- `assetlinks.json` (Android)

tchop provides the necessary app credentials (bundle ID, team ID, package name, SHA-256 fingerprints). The client uploads the files and ensures their web server serves them with proper MIME types.

---

## Customisation & White-Labeling

Every app is fully white-labeled to the client's brand. No tchop branding is visible to end users.

### Colors
- Primary color
- Secondary color
- Background color (welcome, login, loading screens)
- Teaser background color
- Primary font color
- Secondary font color

All colors provided as HEX codes.

### Fonts
- Custom brand font (.ttf format, licensed for app use) or selection from Google Fonts
- Separate fonts for headlines and body text supported

### Icons
- Channel and tab bar navigation icons are customizable
- Upload via the CMS at any time
- Sizes: 24x24px (Android), 72x72px (iOS), PNG format

### Web App
- Deployable on any custom subdomain (e.g. community.yourdomain.com)
- Content can be embedded on external websites
- Same feature set as native apps

### Transactional Emails
- Custom sender domain (e.g. notifications@yourcompany.com instead of support@tchop.io)
- Requires DKIM and return-path DNS records (SPF handled automatically by tchop)
- Setup process: tchop adds sender signature, client confirms via email, tchop connects the domain

---

## Content Flows

### Manual Content Creation
1. Editor opens a mix in the CMS
2. Clicks "Add Content" and selects a card type
3. Fills in required and optional fields
4. Saves as draft, schedules, or publishes immediately
5. Default tags (if configured on the mix) are auto-assigned
6. Optional: auto-push notification fires if enabled on the mix

### Content Curation (URL-based)
1. Editor pastes a URL into the Article card creator
2. tchop scrapes/parses the URL for title, image, description
3. Editor customizes the teaser
4. Publishes into a mix

### Automated Content Import
Content can flow in automatically via:
- RSS feeds
- Website scraping
- Social media APIs (X, Facebook, LinkedIn, Instagram)
- YouTube and podcast feeds
- Slack or custom APIs
- n8n workflows or custom integrations via the tchop API

### Content Sync Between Channels
- A mix can be synced from one channel to another
- The synced copy is read-only; edits happen on the source
- Card position sync is configurable

---

## API Surface

Two primary API directions:

### Input API
Automated import of structured content from external systems into tchop. Used for feed integrations, CMS sync, and workflow automation.

### Output API / Data Stream
Export of published content (channels, mixes, cards) to external websites, apps, or systems. Enables content reuse beyond the tchop app.

### Protocols
- GraphQL (primary, used by Web App)
- GraphQL (also supported, used by mobile apps)
- OpenAPI / Swagger documentation available in the CMS

API tokens are managed within the CMS with secure token management.

---

## Platform Coverage

| Platform | Technology | Min Version |
|----------|-----------|------------|
| iOS | Swift 5 (native) | iOS 16+ |
| Android | Kotlin (native) | Android 12+ |
| Web | React (responsive) | All modern browsers |

Native development ensures best-in-class UX, performance, and access to latest OS features. App updates are released approximately every two months and handled entirely by tchop (including app store submission and maintenance).

### Platform Differences
- Long Post cards can only be edited via the web app
- Deeplinks require native app installation to redirect from browser
- Article cards open in-app browser on mobile, new browser tab on web
- iOS supports optional home-screen widgets

---

## Analytics

The analytics dashboard covers three categories: Content, User, and Organisation.

Key metrics tracked:
- Posts published, views, reactions, comments, shares per card type
- Engagement rates and interaction percentages by content type
- Top-performing cards and comments
- Channel and mix-level performance
- Push notification send/open rates and reach
- Session data: active vs. engaged users, session duration by platform, sessions per day
- Behavioral funnels: registered > active > engaged
- User role performance (content output vs. consumption by role)

Data is collected via backend and frontend SDK instrumentation. Only aggregated or anonymized data is used, in compliance with GDPR.

Filters available: timeframe, channel, mix, category, tags (both hidden and visible).
