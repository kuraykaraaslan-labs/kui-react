# ListingCards

- **id:** `landing-listing-cards`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/listing/ListingCards.tsx`
- **status:** stable
- **since:** 2026-11

Website listing cards for a property, a vehicle or a room: picture, status, a free-text price and period, location and key facts. A sold or booked listing stays, dimmed.

## Variants

### Estate agent, with the authorisation footnote

```tsx
<ListingCards title="Current listings" listings={[{ title: '3+1 flat with a sea view', price: '₺8,450,000', status: 'For sale', facts: [{ icon: faBed, text: '3 bedrooms' }] }]} footnote="…" />
```

### Hotel rooms, wide pictures, two columns

```tsx
<ListingCards title="Rooms" columns={2} imageShape="wide" linkLabel="Ask for dates" listings={[{ title: 'Double room', price: '€89', period: '/ night' }]} />
```

### Cars for sale, with marks on the picture

```tsx
<ListingCards columns={2} imageShape="wide" listings={[{ title: 'Hatchback 1.5, 2021', marks: ['360° view'], status: 'For sale' }]} />
```

## Full source

```tsx
import { ListingCards } from '@/modules/domains/landing/listing/ListingCards';
<ListingCards title="Current listings" listings={listings} footnote="Authorisation certificate no. 3500123" />
```
