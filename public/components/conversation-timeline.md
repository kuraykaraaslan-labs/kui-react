# ConversationTimeline

- **id:** `conversation-timeline`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/ConversationTimeline/index.tsx`
- **status:** beta
- **since:** 2026-10

A vertical timeline of an AI investigation: model calls, tool calls, the evidence read, and whether each citation was kept or dropped, with tokens, cost and time per step and a total. Every step names its type in text; arguments and raw results collapse.

## Accessibility

- WCAG: AA
- ARIA patterns: list, region

An ordered list; details toggles are buttons with aria-expanded and aria-controls.

## Design tokens consumed

- `--secondary`
- `--info`
- `--primary`
- `--success`
- `--warning`
- `--error`
- `--border`
- `--surface-raised`
- `--surface-sunken`
- `--text-primary`
- `--text-secondary`

## Variants

### With totals

```tsx
<ConversationTimeline steps={steps} />
```

### Details open, totals hidden

```tsx
<ConversationTimeline steps={steps} defaultExpandedIds={['2']} hideTotals />
```

## Full source

```tsx
import { ConversationTimeline } from '@/modules/ui/ConversationTimeline';

<ConversationTimeline steps={steps} currency="USD" />
```
