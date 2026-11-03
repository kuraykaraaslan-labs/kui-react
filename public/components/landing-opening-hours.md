# OpeningHours

- **id:** `landing-opening-hours`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/hours/OpeningHours.tsx`
- **status:** stable
- **since:** 2026-11

A business's weekly opening hours: split days, spans past midnight, today marked and an "open now" line in the business's own time zone.

## Variants

### Card with "open now"

```tsx
<OpeningHours hours={hours} timeZone="Europe/Istanbul" note="Closed on public holidays." />
```

### Plain, split day and late nights

```tsx
<OpeningHours variant="plain" title="Kitchen hours" hours={[{ day: 'tu', open: '12:00', close: '15:00' }, { day: 'tu', open: '18:00', close: '23:00' }]} />
```

### Turkish labels, no status

```tsx
<OpeningHours title="Çalışma saatleri" showStatus={false} labels={{ closed: 'Kapalı', mo: 'Pazartesi' /* … */ }} hours={hours} />
```

## Full source

```tsx
import { OpeningHours } from '@/modules/domains/landing/hours/OpeningHours';
<OpeningHours hours={hours} timeZone="Europe/Istanbul" />
```
