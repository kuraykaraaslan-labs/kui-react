# Chart

- **id:** `chart`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/Chart/index.ts`
- **status:** beta
- **since:** 2026-05

Token-aware primitive chart library at @/modules/ui/Chart. M1 ships seven SVG-based charts (Line, Bar, Area, Pie, Donut, Scatter, SparkLine) that consume a unified `Series` data shape. Colors auto-resolve from --primary / --secondary / --success / --warning / --error / --info, so dark mode and theme swaps work without any extra work. Pixel-identical EJS sibling at modules/ui/Chart/Chart.ejs. GaugeChart, HeatmapChart and the time axis (`xAxis="time"` with drag-to-zoom on Line/Area) have their own pages (gauge-chart, heatmap-chart, time-series-chart); Bar/Area take `stacked`. The remaining M3 stubs (BubbleChart, TreemapChart, RadarChart, FunnelChart, SankeyChart, CandlestickChart) are exported but render null until implemented; see PLANS/38-Charts.md.

## Used by

- `burn-chart`
- `widget-kit`

## Accessibility

- WCAG: AA
- ARIA patterns: img

Each chart SVG uses role="img" + aria-label. M5 will add a visually hidden data table for screen-reader parity and keyboard navigation between data points.

## Design tokens consumed

- `--primary`
- `--secondary`
- `--success`
- `--warning`
- `--error`
- `--info`
- `--surface-raised`
- `--border`
- `--text-primary`
- `--text-secondary`

## Variants

### LineChart

```tsx
<LineChart
  series={[
    { id: 'active',  name: 'Active users', data: [{ x: 'Mon', y: 1200 }, /* … */] },
    { id: 'signups', name: 'New signups',  data: [{ x: 'Mon', y: 300 },  /* … */] },
  ]}
  height={220}
/>
```

### Stacked bars and areas

```tsx
<BarChart series={series} stacked />
<AreaChart series={series} stacked />
```

### BarChart

```tsx
<BarChart
  series={[
    { id: 'revenue',  name: 'Revenue',  data: [{ x: 'Jan', y: 4200 }, /* … */] },
    { id: 'expenses', name: 'Expenses', data: [{ x: 'Jan', y: 2800 }, /* … */] },
  ]}
  radius={4}
/>
```

### AreaChart

```tsx
<AreaChart series={series} smooth fillOpacity={0.18} />
```

### PieChart

```tsx
<PieChart
  series={[{
    id: 'share', name: 'Category share',
    data: [
      { x: 'Electronics', y: 35 },
      { x: 'Clothing',    y: 25 },
      { x: 'Food',        y: 20 },
      { x: 'Books',       y: 12 },
      { x: 'Other',       y: 8 },
    ],
  }]}
/>
```

### DonutChart

```tsx
<DonutChart series={pieSeries} innerRadius={0.62} />
```

### SparkLine

```tsx
<SparkLine values={[12, 14, 11, 17, 19, 16, 22]} width={120} height={28} filled />
<SparkLine values={[5, 7, 6, 9, 8, 11]} width={120} height={28} />
```

## Full source

```tsx
'use client';
import { LineChart, BarChart, AreaChart, PieChart, DonutChart, ScatterChart, SparkLine, type Series } from '@/modules/ui/Chart';

const series: Series[] = [
  { id: 'a', name: 'Active', data: [{ x: 'Mon', y: 12 }, { x: 'Tue', y: 19 }] },
];

<LineChart series={series} height={240} />
<BarChart series={series} />
<AreaChart series={series} />
<PieChart series={series} />
<DonutChart series={series} innerRadius={0.6} />
<SparkLine values={[12, 14, 11, 17, 19]} />
```
