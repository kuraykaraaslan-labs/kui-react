# ForumHelpBotCard

- **id:** `ai-forum-help-bot-card`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/ai/report/ForumHelpBotCard.tsx`
- **status:** stable
- **since:** 2026-11

The forum help bot in a period: topics it looked at and what it did with each (answered, no sources, not answerable, stopped, errors, skipped, waiting) against the previous period, replies accepted as the solution, and the latest topics with their status.

## Variants

### On

```tsx
<ForumHelpBotCard report={forumBot} locale="en-US" />
```

### Switched off (earlier topics still counted), 7 days

```tsx
<ForumHelpBotCard report={forumBot} />
```

## Full source

```tsx
<ForumHelpBotCard report={report.forumBot} locale="en-US" />
```
