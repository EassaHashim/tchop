# Event Card -- Overview for Dev Team

**Status:** DRAFT | **Date:** 2026-03-27 | **Full spec:** [event-card-use-cases.md](event-card-use-cases.md)

---

## What

New card type #12: **Event Card**. Lets clients create events with RSVP, waitlist, calendar view, and attendee export. Driven by AOK Plus request + Staffbase competitive parity.

## Scope

tchop handles **discovery + registration**. Event logistics (room booking, catering) stay external. CSV export is the handoff.

**In scope (v1):** Event creation, attend/unattend, waitlist with auto-promotion, calendar view, "My Events", CSV export, .ics download, push reminders, past event state, feature flag per org.

**Out of scope:** Recurring events, calendar API sync (Google/Outlook), check-in tracking, ticketing, video/streaming, email notifications (push only in v1), cross-channel aggregation (org-level).

---

## Architecture Decision Needed

**Events as cards in mixes** (recommended) vs. **Dedicated Event Feed tab** (alternative from briefing doc).

| | Card in Mixes | Event Feed Tab |
|---|---|---|
| Fits existing architecture | Yes | No -- new concept |
| Events appear in normal feed | Yes | Only as promoted copies |
| "All events" view | Via calendar query (F5) | Built-in |
| Effort | M | XL |
| Risk | Low | High |

**Recommendation:** Card in mixes. Calendar view + "My Events" provide the aggregation. Team input needed on query performance.

---

## Use Cases

### UC-1: Admin Creates an Event
**Actor:** Admin/Editor via CMS dashboard
Admin selects "Event" from "Add Content" in any mix. Fills in: headline (required), description, start date/time with timezone (required), end date/time, location (free text), cover image, capacity (null = unlimited), registration deadline (defaults to event start), and show-attendees toggle (default: on). Saves as draft, schedules, or publishes. Default mix tags are auto-assigned. Auto-push fires if enabled on the mix.
**Key complexity:** Field validation (start must be future, end after start, deadline before start, capacity >= 1 if set). Feature flag must be ON for event type to appear.

### UC-2: User Discovers Events in Feed
**Actor:** Reader (app user)
Event card appears in the normal feed alongside other cards. Teaser shows: cover image (or branded date-stamp placeholder if none), title, date/time in user's local timezone, location, attendee count/capacity (e.g. "12/50 attending"), attendee avatar row (first 3-5 profile pics if enabled), and an Attend button. Button shows "Join Waitlist" when full, and is hidden for past events. Past events display greyed-out cover + "This event has ended" badge. Old app versions hide the card entirely (backward compatibility).
**Key complexity:** New card renderer needed on all 3 platforms (iOS, Android, web). Location is tappable (opens Maps).

### UC-3: User Attends an Event (RSVP)
**Actor:** Reader
User taps "Attend" on the card. System checks registration is open and capacity. If spots remain: status = ATTENDING, count incremented atomically. If full: status = WAITLISTED with visible queue position. Button changes to "Attending" or "On Waitlist #N". Double-tap is idempotent. Attend/unattend debounced at 1s. Server enforces userId = currentUser (no attending on behalf of others). UI is pessimistic -- waits for server confirmation before updating, shows inline error on network failure.
**Key complexity:** Atomic capacity check (`UPDATE ... WHERE attendeeCount < capacity`) prevents race conditions when two users click simultaneously for the last spot.

### UC-4: User Cancels Attendance
**Actor:** Reader
User taps "Attending" to toggle off (or explicit cancel action). If user was ATTENDING and a waitlist exists: the next waitlisted user is automatically promoted to ATTENDING via background job. Promoted user receives push notification ("A spot opened up!"). Promotion uses atomic DB state transition (`UPDATE ... SET status = 'ATTENDING' WHERE status = 'WAITLISTED'`) to prevent double-promotion when multiple users unattend simultaneously. FIFO order. Unattend is blocked after event starts or after registration deadline.
**Key complexity:** Waitlist auto-promotion as reliable background job. Must handle: promoted user is deactivated (skip to next), concurrent unattends, job failure/retry.

### UC-5: User Downloads Calendar File (.ics)
**Actor:** Reader (any channel member, regardless of RSVP status)
User taps "Add to Calendar" on event detail. System generates .ics file on-demand with VEVENT (title, start/end, timezone, location, description). File opens in the device's default calendar app (Calendar.app on iOS, default on Android, file download on web). Note: .ics files are inherently shareable -- attendees can forward calendar invites.
**Key complexity:** Cross-platform calendar integration. Event with no end date defaults to start + 1 hour.

### UC-6: Admin Manages Attendees
**Actor:** Admin/Editor via CMS dashboard
Admin opens event card in CMS and sees: total attending count, total waitlisted count, and a paginated attendee list with name, email, department, position, status (ATTENDING/WAITLISTED), and RSVP timestamp. Admin can export as CSV (streaming generation for large events). Export restricted to admin/editor roles (contains PII). Deactivated/deleted users are anonymized in export.
**Key complexity:** Streaming CSV for 10,000+ attendee events. PII access control. Future: manual waitlist promotion, bulk push/email to attendees.

### UC-7: Calendar View (Channel-Level)
**Actor:** Reader or Admin
Dedicated calendar view within a channel showing all published events across all mixes. Month/week navigation. Events displayed as dots/markers on their start dates. Tapping opens the event detail. Past events visually greyed out. Powered by dedicated GraphQL endpoint `eventCardsByChannel(channelId, dateRange)` with channel membership check (prevents IDOR).
**Key complexity:** New aggregation query across all mixes in a channel. Needs composite index on (channel_id, card_type, event_start_date). Day overflow UI for 5+ events on same date.

### UC-8: "My Events" Personal View
**Actor:** Reader
Cross-channel view showing all events the user is attending or waitlisted for, across all channels they have access to. Sorted by date (upcoming first). Shows ATTENDING vs. WAITLISTED status per event. Past events shown separately or filterable. Powered by `eventCardsByUser(page, size)` -- a user-scoped query (not channel scan). Only shows events from organisations with feature flag enabled. Navigation placement TBD with UX team (candidates: profile section, bottom nav tab, channel navigation).
**Key complexity:** Cross-channel but user-scoped (avoids the deferred org-level aggregation). Must respect channel access changes and feature flags.

### UC-9: Push Reminders
**Actor:** System (automated)
Scheduled background job checks for events starting within the configured reminder window. Sends push notification to all ATTENDING users: "[Event Name] starts in [time]" with deep-link to the event card. Reminder timing is an organisation-level setting for v1 (default: 24h + 1h before event start). Uses existing push notification infrastructure.
**Key complexity:** Must handle: event deleted before reminder fires, user unattended after scheduling, event time changed after scheduling. Open question: polling-based job (check every N minutes) vs. event-driven scheduling (schedule specific job on event create/update).

### UC-10: Past Event State
**Actor:** System (automatic transition)
When event start time passes, the event automatically transitions to "past" state. Visual changes: greyed-out cover image, "This event has ended" badge, attend button hidden. No cron job needed -- state is calculated client-side from eventStartDate. Comments and reactions remain open (acts as retrospective thread). Event stays searchable and browsable. Admin can still access attendee list and export CSV.
**Key complexity:** Minimal -- pure client-side calculation. No server-side state change needed.

---

## Feature Matrix (prioritized)

**Phase 1 -- Foundation:**
- F1: Event card type (schema, CRUD)
- F13: Feature flag per org
- F14: Backward compatibility (old apps hide card)
- F2: Attend/unattend mutations (atomic)
- F4: Registration deadline locking
- F10: Past event visual state

**Phase 2 -- Core:**
- F3: Waitlist with auto-promotion
- F7: CSV attendee export
- F8: .ics calendar download
- F11: Location deep-link (Maps)
- F12: Attendee avatars on card

**Phase 3 -- Views:**
- F5: Calendar view (channel-level)
- F6: "My Events" personal view
- F9: Push reminders

**Phase 4 (future):**
- F15: Cross-channel aggregation
- F16: Event analytics dashboard
- F17: Event tags + "Post about this event"
- F18: Email notifications

---

## Key Technical Decisions Already Made

1. **Capacity race condition:** Atomic DB operation (`UPDATE ... WHERE attendeeCount < capacity`)
2. **Waitlist promotion:** Background job with atomic state transition, FIFO order
3. **Times:** UTC with timezone offset, displayed in user's local timezone
4. **Reminder timing:** Organisation-level setting for v1 (default: 24h + 1h before)
5. **RSVP UI:** Pessimistic (wait for server confirmation, no optimistic updates)
6. **Attendee count polling:** 30s feed view, 10s detail view (no WebSocket required for v1)

---

## Open Questions for Team Discussion

1. Calendar query performance -- is composite index sufficient?
2. Waitlist promotion retry strategy -- what if the background job fails?
3. Push reminder scheduling -- polling vs event-driven?
4. Native app release timeline -- how fast can iOS/Android ship the new card renderer?
5. Multi-timezone handling -- already solved for other timestamps?
6. Capacity reduction below current attendees -- confirm no retroactive removal
7. AOK Plus cross-channel problem -- is "My Events" sufficient for initial rollout?

---

## Staffbase Differentiators

tchop beats Staffbase on: waitlist auto-promotion, .ics download, push reminders, integrated calendar view, "My Events", location deep-link, registration deadline, full card feature inheritance (comments, reactions, bookmarks, tags).

Staffbase has that tchop defers: recurring events, event categories with color coding (tchop uses tags).
