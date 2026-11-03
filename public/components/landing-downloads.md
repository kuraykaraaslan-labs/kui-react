# Downloads

- **id:** `landing-downloads`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/downloads/Downloads.tsx`
- **status:** stable
- **since:** 2026-11

Files to download with an icon for their kind, their size and a named download link.

## Variants

### Brochures and forms

```tsx
<Downloads title="Downloads" files={files} />
```

## Full source

```tsx
import { Downloads } from '@/modules/domains/landing/downloads/Downloads';
<Downloads files={[{ title: 'Catalogue 2026', href: '/catalogue.pdf', size: '2.4 MB' }]} />
```
