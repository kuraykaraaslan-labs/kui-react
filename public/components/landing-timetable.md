# Timetable

- **id:** `landing-timetable`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/schedule/Timetable.tsx`
- **status:** stable
- **since:** 2026-11

A weekly class or lesson timetable: a column per day, time, class, who and where, with chips that filter by class.

## Variants

### Gym week with a class filter

```tsx
<Timetable title="This week" sessions={sessions} note="Book your place at the front desk." />
```

### Turkish, empty days left out

```tsx
<Timetable sessions={sessions} hideEmptyDays days={['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']} labels={{ all: 'Tümü', none: 'Ders yok' }} />
```

## Full source

```tsx
import { Timetable } from '@/modules/domains/landing/schedule/Timetable';
<Timetable title="This week" sessions={[{ day: 0, start: '07:00', end: '08:00', name: 'Spin', who: 'Ayşe' }]} />
```
