# Branches

- **id:** `landing-branches`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/locations/Branches.tsx`
- **status:** stable
- **since:** 2026-11

A business's branches: cards with address, phone, hours and directions, and every branch as a pin on one map; picking a card moves the map, clicking a pin picks the card.

## Variants

### Three branches on one map

```tsx
<Branches title="Our branches" branches={branches} />
```

### Cards only, Turkish labels

```tsx
<Branches showMap={false} branches={branches} labels={{ directions: 'Yol tarifi' }} />
```

## Full source

```tsx
import { Branches } from '@/modules/domains/landing/locations/Branches';
<Branches title="Our branches" branches={[{ name: 'City centre', address: '…', position: [41.03, 28.97] }]} />
```
