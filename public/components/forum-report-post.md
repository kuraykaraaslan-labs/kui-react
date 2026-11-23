# ReportPostDialog

- **id:** `forum-report-post`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/forum/moderation/ReportPostDialog.tsx`
- **status:** stable
- **since:** 2026-11

A member reports a post: the Report button under someone else's post opens a dialog with the reason (spam, abuse or harassment, off-topic, personal data, something else) and an optional note (500 characters); after sending it says "Reported, thank you" and the button reads "Reported".

## Variants

### Report button under a post

```tsx
<ReportPostButton onReport={({ reason, note }) => api.report(postId, reason, note)} />
```

### Already reported

```tsx
<ReportPostButton reported onReport={send} />
```

### Sending fails (the dialog stays open with an error)

```tsx
<ReportPostButton onReport={() => Promise.reject(new Error('offline'))} />
```

## Full source

```tsx
import { ReportPostButton } from '@/modules/domains/forum/moderation/ReportPostDialog';
<ReportPostButton reported={alreadyReported} onReport={({ reason, note }) => report(postId, reason, note)} />
```
