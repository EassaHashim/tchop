# Teams Integration: Proactive Notifications (Phase 2)

## Why This Matters

Phase 1 gives users access to tchop inside Teams, but they still have to remember to click the icon. Notifications flip that dynamic. When something important gets published, it comes to the user inside Teams automatically. No action required, no app switching.

For internal comms teams, this is the whole point. They're fighting for attention. Meeting people where they already are, inside the tool they have open all day, is the win.

Phase 1 alone is a checkbox: "yes, we integrate with Teams." Phase 2 makes it a real workflow. The notification arrives in Teams, the user taps "Read Article", the tchop tab opens with the full content. No browser, no app switch, no login. The entire loop happens inside Teams.

---

## Two Delivery Mechanisms

Each suited for different situations. Both can coexist.

### Bot Messages (Direct, High-Visibility)

A message appears in the user's Teams chat from the "tchop" bot. It contains an Adaptive Card showing the content teaser.

**Article notification example:**

```
+------------------------------------------+
| [tchop logo] tchop                       |
|                                          |
| +--------------------------------------+ |
| | [Hero image]                         | |
| |                                      | |
| | Breaking: Q4 Town Hall Recording     | |
| | Watch the full recording and read    | |
| | the key takeaways from this quarter. | |
| |                                      | |
| | [Read Article]  [Mark as Read]       | |
| +--------------------------------------+ |
+------------------------------------------+
```

**Poll notification example:**

```
+------------------------------------------+
| [tchop logo] tchop                       |
|                                          |
| +--------------------------------------+ |
| | New poll in "All Hands"              | |
| |                                      | |
| | Which date works for the summer      | |
| | offsite?                             | |
| |                                      | |
| | ( ) June 15-16                       | |
| | ( ) June 22-23                       | |
| | ( ) July 6-7                         | |
| |                                      | |
| | [Vote]         [View in tchop]       | |
| +--------------------------------------+ |
+------------------------------------------+
```

Users can vote directly inside the Adaptive Card. The card updates in place to show results after voting.

**Good for:** Important news, urgent updates, polls, anything that needs immediate attention.

### Activity Feed Notifications (Lightweight, Non-Intrusive)

A notification appears in the Teams Activity Feed (the bell icon). Shows a one-line summary like "New article: Q4 Town Hall Recording". Clicking it deep-links into the tchop tab.

These don't create chat messages. They're quiet, scannable, and don't clutter conversations.

**Good for:** Routine content updates, "FYI" posts, social feedback (likes, replies), less urgent items.

---

## Mapping to tchop's Notification Types

| tchop Notification Type | Teams Delivery | Format |
|---|---|---|
| Editorial push (manual, high priority) | Bot message | Adaptive Card with image, headline, CTA |
| Auto-push from mix (new content) | Activity Feed | One-line notification with deep link |
| Social feedback (like, reply, mention) | Activity Feed | One-line notification with deep link |
| Chat message | Skip | Chat stays in tchop, no duplication |
| Retention push (re-engagement) | Bot message | Adaptive Card with personalized content |
| Poll published | Bot message | Adaptive Card with inline voting |

Chat notifications should stay in tchop's own chat system. Duplicating chat into Teams would confuse users and create split conversations.

---

## How It Works Technically

### Bot Infrastructure

**Azure Bot Service:** Register a bot in the Azure portal. This gives you a bot ID and messaging endpoint URL. The bot runs on your existing Node.js backend as a new endpoint (e.g. `/api/teams/bot`).

**Bot Framework SDK:** Use the `botbuilder` npm package with `TeamsActivityHandler` to handle Teams-specific events.

**Conversation references:** When the tchop Teams app gets installed for a user, Teams fires an `onMembersAdded` event to your bot. Your bot stores the conversation reference, a JSON blob containing `serviceUrl`, `conversationId`, and `tenantId`. This reference is what allows you to send messages to that user later without them initiating a conversation.

```typescript
class TchopBot extends TeamsActivityHandler {
  async onInstallationUpdateAdd(context: TurnContext) {
    const ref = TurnContext.getConversationReference(context.activity);
    // Store ref in database, linked to the user's tchop account
    await db.teamsConversationRefs.upsert({
      usreId: context.activity.from.aadObjectId,
      conversationReference: JSON.stringify(ref),
    });
  }
}
```

### The Notification Pipeline

tchop already fires push notifications when content is published. The Teams delivery plugs into this existing pipeline as an additional channel:

```
Content published in tchop
         |
         v
Push notification system fires
         |
    +----+----+----+
    |         |         |
    v         v         v
 Mobile    Email     Teams
  push               (new)
                       |
                  +----+----+
                  |              |
                  v              v
            Bot message    Activity Feed
           (high priority)  (low priority)
```

**For each notification:**
1. Determine the target users
2. For each user, check if they have a stored Teams conversation reference
3. If yes, determine delivery type (bot message vs. activity feed) based on notification priority
4. Send the Adaptive Card (bot) or Graph API call (activity feed)
5. If no conversation reference exists, skip Teams delivery. Other channels still fire.

### Proactive Bot Messages

Sending a message to a user who hasn't initiated a conversation:

```typescript
import { CloudAdapter, ConversationReference } from 'botbuilder';

async function sendTeamsNotification(
  userId: string,
  card: object
) {
  const ref = await db.teamsConversationRefs.findByUserId(userId);
  if (!ref) return; // User hasn't installed the Teams app

  const conversationRef: ConversationReference = JSON.parse(ref.conversationReference);

  await adapter.continueConversationAsync(
    process.env.BOT_APP_ID,
    conversationRef,
    async (context) => {
      await context.sendActivity({
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        }],
      });
    }
  );
}
```

### Activity Feed Notifications via Graph API

Lighter-weight notifications that appear in the bell icon:

```typescript
import { Client } from '@microsoft/microsoft-graph-client';

async function sendActivityFeedNotification(
  userAadId: string,
  articleTitle: string,
  deepLinkUrl: string
) {
  await graphClient.api(`/users/${userAadId}/teamwork/sendActivityNotification`)
    .post({
      topic: {
        source: 'text',
        value: 'New content',
        webUrl: deepLinkUrl,
      },
      activityType: 'newArticle',
      previewText: { content: articleTitle },
    });
}
```

Requires `TeamsActivity.Send` application permission in your Azure AD app (admin-consented).

Activity types must be declared in the app manifest:

```json
"activities": {
  "activityTypes": [
    {
      "type": "newArticle",
      "description": "A new article was published",
      "templateText": "{actor} published: {articleTitle}"
    },
    {
      "type": "newPoll",
      "description": "A new poll is available",
      "templateText": "New poll: {pollQuestion}"
    }
  ]
}
```

### Adaptive Card Templates

Build one template per content type. Cards are JSON, rendered natively by Teams. Key capabilities:

- `Action.OpenUrl`: "Read Article" button linking to the tchop tab via deep link
- `Action.Submit`: sends data back to your bot (poll votes, "mark as read", "like")
- Cards can be **updated in place** after interaction (show poll results after voting)
- `refresh` property enables user-specific card views ("you voted" vs. "vote now")
- Images, text formatting, columns, and action buttons are all supported

**Limitations:**
- No custom CSS or HTML. The card is rendered by Teams, not by you.
- No embedded video playback. Only thumbnail + link.
- Max card payload: ~28 KB compressed.
- Max 6 action buttons per action set.

---

## Rate Limits

| Mechanism | Limit | Impact |
|---|---|---|
| Bot proactive messages | ~30 messages/minute per bot per tenant | For 5,000 users, full delivery takes ~2-3 hours |
| Activity Feed (Graph API) | ~5 requests/second per app per tenant | Faster than bot messages for bulk delivery |
| Both | Respect `Retry-After` headers | Queue and retry with backoff |

For breaking news that needs to reach everyone fast, use Activity Feed (Graph API) for bulk delivery and bot messages only for high-priority segments. For routine content, Activity Feed is sufficient and faster.

---

## Effort Estimate

| Task | Effort |
|---|---|
| Azure Bot Service registration + bot endpoint | ~3 days |
| Bot installation handler (store conversation references) | ~2 days |
| Proactive messaging pipeline (connect to existing push system) | ~1 week |
| Adaptive Card templates (article, poll, thread, media) | ~3-4 days |
| Activity Feed notifications via Graph API | ~3 days |
| Testing (delivery, throttling, edge cases, mobile) | ~1 week |
| **Total** | **~3-4 weeks** |

---

## Dependencies

- Phase 1 (tab + SSO) must be live first. The bot needs user identity mapping and the tab provides the deep-link target for "Read more" buttons.
- Azure Bot Service registration (separate from the Azure AD App Registration used in Phase 1, though they share the same Azure tenant).
- `TeamsActivity.Send` Graph API permission must be admin-consented per customer tenant.
- Adaptive Card design: decide the visual layout for each content type. Can reuse tchop's existing teaser designs as reference.
