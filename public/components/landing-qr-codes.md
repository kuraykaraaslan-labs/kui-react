# QrCodes

- **id:** `landing-qr-codes`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/media/QrCodes.tsx`
- **status:** stable
- **since:** 2026-11

QR codes to any page, or one per table for a table menu, drawn in the browser and ready to print.

## Variants

### One code

```tsx
<QrCodes url="/menu" caption="Scan for the menu" />
```

### One per table

```tsx
<QrCodes url="/menu" tables={4} labels={{ table: 'Masa' }} />
```

## Full source

```tsx
import { QrCodes } from '@/modules/domains/landing/media/QrCodes';
<QrCodes url="/menu" tables={6} />
```
