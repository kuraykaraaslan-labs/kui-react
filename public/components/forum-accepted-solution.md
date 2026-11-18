# AcceptedSolution

- **id:** `forum-accepted-solution`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/forum/post/AcceptedSolution.tsx`
- **status:** stable
- **since:** 2026-11

Accepted solution: the "Accepted solution" chip, the "Mark as solution" / "Unmark solution" toggle for the topic author or a moderator, acceptedSolutionClasses that turn the post card green, and the "Solved" topic badge.

## Variants

### Chip, toggle and Solved badge

```tsx
<AcceptedSolutionBadge />
<MarkSolutionButton isSolution={false} onToggle={(next) => save(next)} />
<TopicSolvedBadge size="sm" />
```

### Green post card

```tsx
<article className={cn('rounded border border-border', isSolution && acceptedSolutionClasses.card)}>
  <aside className={cn('bg-surface-raised', isSolution && acceptedSolutionClasses.author)}>…</aside>
  <header className={cn('bg-surface-raised/50', isSolution && acceptedSolutionClasses.meta)}>
    {isSolution && <AcceptedSolutionBadge />}
  </header>
</article>
```

## Full source

```tsx
import { AcceptedSolutionBadge, MarkSolutionButton, acceptedSolutionClasses } from '@/modules/domains/forum/post/AcceptedSolution';
<MarkSolutionButton isSolution={isSolution} onToggle={setSolution} />
```
