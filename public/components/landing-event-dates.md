# EventDates

- **id:** `landing-event-dates`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/events/EventDates.tsx`
- **status:** stable
- **since:** 2026-11

Tour dates, fixtures or performances: a calendar badge, the venue, a status and a ticket link; past dates drop off in the visitor's browser.

## Variants

### Tour dates

```tsx
<EventDates title="Tour dates" dates={[{ date: '2030-10-02', time: '20:00', title: 'Live at the Arena', venue: 'Arena', city: 'Lisbon', href: '/tickets' }]} />
```

## Full source

```tsx
import { EventDates } from '@/modules/domains/landing/events/EventDates';
<EventDates title="Tour dates" dates={dates} />
```
