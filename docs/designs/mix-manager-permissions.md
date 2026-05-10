# Feature Design: Mix Manager Permissions

**Status:** Planning (eng + design review complete)
**Date:** 2026-03-20
**Reviews:** CEO Plan Review (Scope Expansion) + Eng Review + Design Review

---

## Problem

The current permission model is role-based and coarse-grained. You can allow "all editors" or "all readers" to post in a mix, but you can't say "user X and user Y are the community managers for this specific mix." This creates bottlenecks: admins have to do all mix-level management themselves, or give users broader roles (editor/admin) than they actually need.

## Solution

Introduce **mix managers**: specific users assigned to manage a specific mix, independent of their global role. A reader can be a mix manager. The permission is additive (on top of existing role-based permissions) and scoped to a single mix.

## Use Cases

- **Enterprise internal comms:** Department heads manage their department's mix without being global admins
- **Brand communities:** Community managers for specific topics own their section
- **Media/news:** Beat reporters manage their topic mix without access to everything else

---

## Scope

### In Scope (v1)

1. **User selector in mix settings** to assign/remove mix managers
2. **Single "mix manager" role** with these capabilities within the assigned mix:
   - Post content
   - Edit/delete any post
   - Moderate comments (approve, delete)
   - Change all mix settings (including posting permission toggles)
   - Add/remove other mix managers (delegation)
3. **Bidirectional visibility:**
   - Mix settings shows assigned managers
   - User profile (admin view) shows which mixes this user manages
   - Both directions navigable with one click
4. **Permission preview** when assigning a manager: shows what capabilities the user will gain
5. **"Managed by" indicator** on mix cards/headers (visible to all users, not just admins)
6. **Push/in-app notification** when assigned or unassigned as mix manager
7. **Per-channel feature flag** for staged rollout

### Not in Scope

- Granular per-mix capabilities (e.g., separate "contributor" vs "manager" roles)
- Transfer/handover workflow
- Mix manager dashboard ("my mixes" filtered view)
- Approval workflows (content submitted by readers, approved by manager)
- Delegation depth limits

---

## Architecture

### Permission Resolution Flow

```
REQUEST: "Can user X do action Y in mix Z?"

1. User deactivated? → DENY
2. Global Admin? → ALLOW (all actions)
3. Global Editor? → ALLOW (all actions)
4. Mix Manager for Z? → ALLOW (all mix actions)
5. Editor Limited + mix allows ed_limited? → ALLOW (post only)
6. Reader + mix allows readers? → ALLOW (post only)
7. → DENY
```

### Data Model

New table: `mix_managers`

| Column | Type | Notes |
|--------|------|-------|
| mix_id | FK | References mixes |
| user_id | FK | References users |
| assigned_by | FK | References users (who made the assignment) |
| assigned_at | timestamp | When the assignment was made |

Primary key / unique constraint on `(mix_id, user_id)`.
Index on `(user_id)` for "which mixes does this user manage?" queries.

### API Endpoints

Both REST and GraphQL:
- Assign manager: `POST /mixes/:id/managers`
- Remove manager: `DELETE /mixes/:id/managers/:userId`
- List managers for mix: `GET /mixes/:id/managers`
- List managed mixes for user: `GET /users/:id/managed-mixes`

### Engineering Decisions (from eng review)

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Auth check location | Service layer | MixManagerService validates caller permissions internally. Every caller (REST, GraphQL) gets the check automatically. Prevents missing-auth-check bugs. |
| Client permission data | Session payload | Backend includes `managedMixIds` array in auth/session response. Clients use locally for UI rendering. All mutations still server-authorized. Avoids N+1 API calls. |
| Permission engine pattern | Modify existing | Add if-block to existing PermissionService. No chain-of-responsibility pattern -- over-engineering for one new check. Refactor to chain only if phase 2 happens. |
| Feature flag placement | Request boundary | Middleware checks flag once per request. If disabled, `managedMixIds` stays empty, permission step 4 is naturally skipped. No hot-path overhead. |
| Mix list loading | Eager-load managers | Mix list API response includes `managers` array per mix (userId + name). One JOIN query. No N+1. |

### Implementation Order

```
Phase 1: Backend foundation
  1.1 DB migration (mix_managers table)
  1.2 MixManager entity/model
  1.3 MixManagerService (assign, remove, list, removeAllForUser)
  1.4 PermissionService modification (add step 4)
  1.5 Feature flag registration
  1.6 REST endpoints (behind flag)
  1.7 GraphQL resolvers (behind flag)
  1.8 Session payload: add managedMixIds + cache invalidation
  1.9 User deactivation hook
  1.10 Backend tests

Phase 2: Web UI
  2.1 Managers tab in MixSettingsPage
  2.2 User selector + permission preview
  2.3 Manager list with remove
  2.4 "Managed by" indicator on mix cards
  2.5 Managed mixes section in user profile
  2.6 Component tests

Phase 3: Mobile
  3.1 iOS: permission model + mix settings UI + indicator
  3.2 Android: permission model + mix settings UI + indicator

Phase 4: Notifications
  4.1 Notification template (EN/DE)
  4.2 Trigger on assign/unassign

Phase 5: Rollout
  5.1 Enable for beta channel
  5.2 Monitor
  5.3 Enable globally
```

---

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Permission granularity | Single "mix manager" role | Keep simple. Can decompose later if demand shows. |
| Interaction with existing system | Additive | Mix manager is a separate layer. Existing role-based permissions unchanged. No breaking changes. |
| Can managers appoint others? | Yes | Scales organically for large orgs. Admin can always override. |
| Manager settings access | Full | Mix managers can change all mix settings including posting permissions. Full ownership. |
| Assigning admins/editors | Allowed with note | "Already has full access as Editor." Acts as safety net if global role changes later. |
| Last manager removes self | Allowed silently | Mix goes to zero managers. Admins can re-assign. No blocking, no warning. |
| User deactivation | Auto-remove assignments | Clean. No orphaned entries. Permission engine also checks user status as first step. |
| API surface | REST + GraphQL | Full parity. Matches existing pattern. |
| Feature flag | Per-channel | Staged rollout. Enable for specific customers first. |

---

## UI Design Specs (from design review)

### Screen Hierarchy

**Mix Settings > Managers Tab**
```
  ┌──────────────────────────────────────────────────────┐
  │  PRIMARY: Manager list (current state)               │
  │  ┌────────────────────────────────────────────────┐  │
  │  │ [Av] Maria Schmidt    Reader    3 days ago     │  │
  │  │      Assigned by Admin               [Remove]  │  │
  │  ├────────────────────────────────────────────────┤  │
  │  │ [Av] Jan Müller       Ed. Ltd   1 day ago      │  │
  │  │      Assigned by Maria               [Remove]  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SECONDARY: Add manager                              │
  │  [ Search users to add as manager... ]               │
  │                                                      │
  │  TERTIARY: Context                                   │
  │  "Mix managers can post, edit, moderate, and         │
  │   manage settings in this mix."                      │
  └──────────────────────────────────────────────────────┘
```

**Empty state (no managers assigned):**
"No managers assigned yet. Mix managers can post, edit, moderate, and manage settings in this mix. Add one below."

**Permission preview:** Confirmation dialog (modal) appears after selecting a user from search. Shows capability list + Confirm/Cancel. For admin/editor users, includes note: "[Name] already has full access as [Role]."

**"Managed by" indicator:** Below mix title on cards. Text + small avatar chips.
- 1 manager: "Managed by Maria"
- 2 managers: "Managed by Maria & Jan"
- 3+: "Managed by Maria +2 more"
- 0 managers: indicator not shown

### Interaction States

```
COMPONENT           | LOADING         | EMPTY                | ERROR            | SUCCESS
--------------------|-----------------|----------------------|------------------|------------------
Manager list        | 3 skeleton rows | Warm context +       | "Couldn't load." | List with avatar,
                    |                 | "No managers yet..." | [Retry]          | name, role, meta
User search         | Spinner in      | "No users found      | "Search failed." | Results with
                    | input field     | matching '[query]'"  | [Retry]          | avatar, name, role
Add manager         | Button spinner  | N/A                  | Toast error      | Row highlight anim
Remove manager      | Button spinner  | N/A                  | Toast error      | Row fade-out
Managed mixes list  | Skeleton rows   | "Not managing any    | "Couldn't load." | Mix names + dates
(user profile)      |                 | mixes."              | [Retry]          | + links
```

### Design System Tokens

```
Manager rows:     bg: white, border: #F1F1F3
Role badge:       #488ED8 (blue), Basier 400 small
Remove button:    #F6704D (orange), text-only
Search input:     border: #ABB5BA, focus-border: #F6704D
Permission modal: bg: white, header: Basier 600
"Managed by":     text: #43445B (indigo), Basier 400 caption
                  avatars: 20px circles
Success signal:   brief #F6704D highlight at 10% opacity
Error toast:      bg: #F6704D, text: white
```

### Responsive Behavior

```
COMPONENT          | DESKTOP (>1024px)       | MOBILE (<768px)
-------------------|-------------------------|--------------------------
Manager list rows  | Full row: all info      | Stacked: name+avatar /
                   | inline                  | role+meta / icon remove
User search        | Dropdown below input    | Full-screen overlay
Permission preview | Modal dialog            | Bottom sheet
"Managed by"       | Text + avatar chips     | Avatar chips only
                   |                         | (tap to see names)
Managed mixes      | Table with columns      | Card list
```

### Accessibility

- Remove buttons: `aria-label="Remove [Name] as mix manager"`, min 44x44px touch target
- Search: `aria-label="Search users to add as manager"`, `aria-live="polite"` on results
- "Managed by": focusable, Enter to expand truncated list, screen reader: "Managed by [Name] and N others"
- All text: 4.5:1 contrast ratio minimum

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Search returns 0 users | Empty state in user selector |
| User already a manager | Disabled in search results, not selectable |
| User is deactivated | Excluded from search results |
| Assigning an admin/editor | Allowed. Note: "Already has full access via [role]" |
| 5+ managers on a mix | "Managed by" shows 2 names + "+3 more" |
| Mix is deleted | Cascade delete all mix_manager entries |
| Manager name very long | Truncate in indicator display |
| Channel has 10,000 users | Server-side typeahead search, not full list |

---

## Deployment Plan

1. Deploy migration (create `mix_managers` table)
2. Deploy API endpoints (behind per-channel feature flag)
3. Deploy web UI changes (behind same flag)
4. Deploy mobile UI changes (behind same flag)
5. Enable flag for beta customer(s)
6. Monitor, iterate
7. Enable globally

**Rollback:** Disable feature flag. Table stays, data stays. Reversibility: 5/5.

---

## Follow-ups (TODOS)

| Item | Priority | Effort |
|------|----------|--------|
| Audit trail for permission changes | P2 | S |
| Mix manager dashboard ("My Mixes") | P3 | M |

---

## Future Phases

- **Phase 2:** Granular per-mix capabilities (separate contributor vs manager)
- **Phase 3:** Mix manager dashboard + analytics ownership
- **Phase 4:** Approval workflows (reader submits, manager approves)
- **Phase 5:** Delegation chains with depth controls
