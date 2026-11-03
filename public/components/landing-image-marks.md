# ImageMarks

- **id:** `landing-image-marks`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/media/ImageMarks.tsx`
- **status:** stable
- **since:** 2026-11

Large marks set into a picture (2D, 3D, Map, Live), so a card says what kind of screen it shows. Dark glass, white text, real text for screen readers.

## Variants

### On a screenshot, large and medium

```tsx
<ImageMarks marks={['2D', '3D']} />
<ImageMarks marks={['Map', 'Live']} size="md" position="top-left" />
```

## Full source

```tsx
import { ImageMarks } from '@/modules/domains/landing/media/ImageMarks';
<div className="relative"><img src="…" alt="" /><ImageMarks marks={['2D', '3D']} /></div>
```
