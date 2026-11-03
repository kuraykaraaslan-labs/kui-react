# BeforeAfter

- **id:** `landing-before-after`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/media/BeforeAfter.tsx`
- **status:** stable
- **since:** 2026-11

Before / after pictures as a keyboard-operable slider or side by side, with captions and a note on what the pictures are.

## Variants

### Slider

```tsx
<BeforeAfter title="Before and after" pairs={[{ before: '/old.jpg', after: '/new.jpg', caption: 'Kitchen, two weeks' }]} />
```

### Side by side, Turkish labels

```tsx
<BeforeAfter mode="side-by-side" labels={{ before: 'Önce', after: 'Sonra' }} pairs={pairs} />
```

## Full source

```tsx
import { BeforeAfter } from '@/modules/domains/landing/media/BeforeAfter';
<BeforeAfter pairs={[{ before: '/old.jpg', after: '/new.jpg', caption: 'Kitchen' }]} note="Our own jobs." />
```
