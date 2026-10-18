# BurnChart

- **id:** `burn-chart`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/Chart/charts/BurnChart.tsx`
- **status:** beta
- **since:** 2026-10

An SLO burn view on the Chart primitives: the error budget remaining with a projection that runs to zero at the recent pace, the burn rate with the alerting tiers as labelled thresholds (the SRE workbook's 14.4 / 6 / 3 / 1 by default), and annotations such as a deploy or an incident. Colour is not the only signal: tiers and annotations carry text, the projection is dashed, and a text summary states the budget, the active tier and the projected exhaustion.

## Depends on

- `chart`

## Accessibility

- WCAG: AA
- ARIA patterns: group, img
- Keyboard:
  - `ArrowLeft / ArrowRight / Home / End` — Step the cursor through the points; the tooltip follows
  - `Escape` — Clear the cursor

## Design tokens consumed

- `--primary`
- `--info`
- `--warning`
- `--error`
- `--success`
- `--border`
- `--border-strong`
- `--surface-base`
- `--surface-raised`
- `--text-secondary`
- `--border-focus`

## Variants

### Budget and burn rate, with annotations

```tsx
<BurnChart budget={budget} burnRate={burnRate} windowEnd="2026-10-31" annotations={annotations} />
```

### Budget only, custom tiers

```tsx
<BurnChart budget={budget} projection={{ lookbackMs: 4 * 86_400_000 }} />
```

### Burn rate only, two tiers

```tsx
<BurnChart burnRate={burnRate} tiers={[{ id: 'p', label: 'Page', rate: 6, tone: 'error' }]} />
```

## Full source

```tsx
import { BurnChart } from '@/modules/ui/Chart';

<BurnChart
  budget={[{ t: '2026-10-01', value: 100 }, { t: '2026-10-08', value: 71 }]}   // percent remaining
  burnRate={[{ t: '2026-10-01', value: 1 }, { t: '2026-10-08', value: 4.2 }]}  // multiples of sustainable
  windowEnd="2026-10-31"
  annotations={[{ id: 'd1', t: '2026-10-05', label: 'Deploy 4.12.0' }]}
/>
```
