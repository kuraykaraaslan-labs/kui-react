# DayBarChart

- **id:** `day-bar-chart`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/DayBarChart/index.tsx`
- **status:** beta
- **since:** 2026-10

One bar per day, the 90-day uptime strip of a status page. Coloured by availability, with height, an incident marker and the day's accessible name carrying the same meaning, a tooltip on hover and focus, a pinned details dialog on click, and a legend. Reusable per component and per region: pass a label.

## Accessibility

- WCAG: AA
- ARIA patterns: group, dialog, tooltip
- Keyboard:
  - `ArrowLeft / ArrowRight` — Previous or next day (mirrored in right-to-left pages)
  - `Home / End` — First or last day
  - `Enter / Space` — Pin the day's details
  - `Escape` — Close the details

## Design tokens consumed

- `--success`
- `--warning`
- `--error`
- `--surface-sunken`
- `--border`
- `--primary`
- `--text-primary`
- `--text-secondary`
- `--surface-raised`
- `--border-focus`

## Variants

### API, 90 days

```tsx
<DayBarChart label="API" days={days} />
```

### Per region, with a gap and custom thresholds

```tsx
<DayBarChart label="EU region" days={days} thresholds={{ operational: 99.95, degraded: 99.5 }} />
```

## Full source

```tsx
import { DayBarChart } from '@/modules/ui/DayBarChart';

<DayBarChart label="API" days={days} />   // { date: 'YYYY-MM-DD', availability: 99.95 | null, incidents? }[]
```
