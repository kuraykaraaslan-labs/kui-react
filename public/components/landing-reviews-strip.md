# ReviewsStrip

- **id:** `landing-reviews-strip`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/reviews/ReviewsStrip.tsx`
- **status:** stable
- **since:** 2026-11

Reviews copied from Google, Instagram, Facebook or Tripadvisor with stars and source, the overall score and a link to the source.

## Variants

### Google reviews

```tsx
<ReviewsStrip title="What guests say" score={4.8} count={128} source="google" reviews={reviews} />
```

## Full source

```tsx
import { ReviewsStrip } from '@/modules/domains/landing/reviews/ReviewsStrip';
<ReviewsStrip score={4.8} count={120} source="google" reviews={reviews} />
```
