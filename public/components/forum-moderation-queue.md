# ModerationQueueView

- **id:** `forum-moderation-queue`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/forum/moderation/ModerationQueueView.tsx`
- **status:** stable
- **since:** 2026-11

The forum moderation screen: Reported (each report with reason, note, reporter for moderators and time), Held (posts the spam rules held back, the reason in words) and Spam, a count per tab; per post the excerpt, topic and forum, author level, title and post count, age; Approve / Not spam, Mark as spam, Trash, Dismiss reports and Open in forum, one at a time or on a selection; spam and trash confirmed in a ConfirmDialog. Container queries: the author moves beside the post from @3xl.

## Variants

### Reports, held posts and spam (actions work)

```tsx
<ModerationQueueView
  queue={queue}                       // wp kui-community moderation --json
  onAction={(action, ids) => api.moderate(action, ids).then(reload)}
/>
```

### Held tab in a narrow column, reporters hidden

```tsx
<ModerationQueueView queue={queue} defaultTab="held" showReporters={false} onAction={run} />
```

### Nothing to moderate

```tsx
<ModerationQueueView queue={{ generatedAt, items: [] }} />
```

## Full source

```tsx
import { ModerationQueueView } from '@/modules/domains/forum/moderation/ModerationQueueView';
<ModerationQueueView queue={queue} onAction={(action, ids) => moderate(action, ids)} />
```
