# PostComposer

- **id:** `forum-post-composer`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/forum/post/PostComposer.tsx`
- **status:** stable
- **since:** 2026-05

Topic creation form: title + category + write/preview tabs + tag input. Composes UI primitives.

## Variants

### Default composer

```tsx
<PostComposer categories={[{ value: 'tech-help', label: 'Tech Help' }]} />
```

### Pre-filled draft

```tsx
<PostComposer initialTitle="…" initialBody="…" initialTags={['nextjs', 'devops']} />
```

## Full source

```tsx
import { PostComposer } from '@/modules/domains/forum/post/PostComposer';
import { AcceptedSolutionBadge, MarkSolutionButton, acceptedSolutionClasses } from '@/modules/domains/forum/post/AcceptedSolution';
import { TranslatedContent } from '@/modules/domains/forum/post/TranslatedContent';
import { TopicSolvedBadge } from '@/modules/domains/forum/topic/TopicStatusBadge';
import { SimilarTopics, SuggestedCategoryHint } from '@/modules/domains/forum/topic/SimilarTopics';
import { StaffBadge } from '@/modules/domains/forum/user/StaffBadge';
import { cn } from '@/libs/utils/cn';
<PostComposer categories={[{ value, label }]} onSubmit={(data) => ...} />
```
