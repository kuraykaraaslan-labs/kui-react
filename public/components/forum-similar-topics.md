# SimilarTopics

- **id:** `forum-similar-topics`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/forum/topic/SimilarTopics.tsx`
- **status:** stable
- **since:** 2026-11

Composer assistant: earlier topics that look like the title being typed (Solved chip, forum, replies) and the AI-suggested forum hint. PostComposer shows both from similarTopics / suggestedCategoryValue.

## Variants

### Similar topics and suggested forum

```tsx
<SimilarTopics topics={[{ title, href, solved: true, forumName: 'Tech Help', replyCount: 17 }]} />
<SuggestedCategoryHint categoryName="Tech Help" />
```

### In PostComposer

```tsx
<PostComposer
  categories={categories}
  onTitleChange={lookUp}          // debounced on the host
  similarTopics={similar}
  suggestedCategoryValue={suggested}
/>
```

## Full source

```tsx
import { SimilarTopics, SuggestedCategoryHint } from '@/modules/domains/forum/topic/SimilarTopics';
<SimilarTopics topics={similar} />
```
