'use client';
import React from 'react';
import {
  LineChart,
  BarChart,
  AreaChart,
  PieChart,
  DonutChart,
  SparkLine,
  type Series,
} from '@/modules/ui/Chart';
import type { ShowcaseComponent } from '../showcase.types';

// ── Demo data ───────────────────────────────────────────────────────
// Interval series (INS-4): 36 hours of readings, then a 24-hour forecast whose band widens with the horizon.
const T0 = Date.UTC(2026, 10, 20, 0);
const wave = (h: number) => 20 + 6 * Math.sin((h / 24) * 2 * Math.PI);
const forecastSeries: Series[] = [
  { id: 'actual', name: 'Temperature', data: Array.from({ length: 36 }, (_, h) => ({ x: T0 + h * 3_600_000, y: Math.round((wave(h) + ((h * 7) % 5) / 5 - 0.4) * 10) / 10 })) },
  {
    id: 'forecast', name: 'Forecast', lineStyle: 'dashed',
    data: Array.from({ length: 25 }, (_, i) => {
      const h = 35 + i; const half = 0.6 + i * 0.12;
      return { x: T0 + h * 3_600_000, y: Math.round(wave(h) * 10) / 10, lower: Math.round((wave(h) - half) * 10) / 10, upper: Math.round((wave(h) + half) * 10) / 10 };
    }),
  },
];
const lineSeries: Series[] = [
  {
    id: 'active',
    name: 'Active users',
    data: [
      { x: 'Mon', y: 1200 },
      { x: 'Tue', y: 1900 },
      { x: 'Wed', y: 1500 },
      { x: 'Thu', y: 2300 },
      { x: 'Fri', y: 2100 },
      { x: 'Sat', y: 2800 },
      { x: 'Sun', y: 1700 },
    ],
  },
  {
    id: 'signups',
    name: 'New signups',
    data: [
      { x: 'Mon', y: 300 },
      { x: 'Tue', y: 480 },
      { x: 'Wed', y: 220 },
      { x: 'Thu', y: 560 },
      { x: 'Fri', y: 410 },
      { x: 'Sat', y: 690 },
      { x: 'Sun', y: 320 },
    ],
  },
];

const barSeries: Series[] = [
  {
    id: 'revenue',
    name: 'Revenue',
    data: [
      { x: 'Jan', y: 4200 },
      { x: 'Feb', y: 5800 },
      { x: 'Mar', y: 4900 },
      { x: 'Apr', y: 7100 },
      { x: 'May', y: 6300 },
      { x: 'Jun', y: 8400 },
    ],
  },
  {
    id: 'expenses',
    name: 'Expenses',
    data: [
      { x: 'Jan', y: 2800 },
      { x: 'Feb', y: 3200 },
      { x: 'Mar', y: 3600 },
      { x: 'Apr', y: 4100 },
      { x: 'May', y: 3900 },
      { x: 'Jun', y: 4700 },
    ],
  },
];

const pieSeries: Series[] = [
  {
    id: 'category-share',
    name: 'Category share',
    data: [
      { x: 'Electronics', y: 35 },
      { x: 'Clothing', y: 25 },
      { x: 'Food', y: 20 },
      { x: 'Books', y: 12 },
      { x: 'Other', y: 8 },
    ],
  },
];

const sparkValues = [12, 14, 11, 17, 19, 16, 22, 21, 24, 27, 23, 29];

// Tiny preview card wrapper so each variant is visually comparable.
function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-border bg-surface-raised p-4 shadow-sm">
      <p className="mb-2 text-xs font-medium text-text-secondary">{title}</p>
      {children}
    </div>
  );
}

export function buildPrimitiveChartsData(): ShowcaseComponent[] {
  return [
    {
      id: 'chart',
      title: 'Chart',
      category: 'Molecule',
      abbr: 'Ch',
      since: '2026-05',
      description:
        'Token-aware primitive chart library at @/modules/ui/Chart. M1 ships seven SVG-based charts (Line, Bar, Area, Pie, Donut, Scatter, SparkLine) that consume a unified `Series` data shape. Colors auto-resolve from --primary / --secondary / --success / --warning / --error / --info, so dark mode and theme swaps work without any extra work. Pixel-identical EJS sibling at modules/ui/Chart/Chart.ejs. GaugeChart, HeatmapChart and the time axis (`xAxis="time"` with drag-to-zoom on Line/Area) have their own pages (gauge-chart, heatmap-chart, time-series-chart); Bar/Area take `stacked`. The remaining M3 stubs (BubbleChart, TreemapChart, RadarChart, FunnelChart, SankeyChart, CandlestickChart) are exported but render null until implemented; see PLANS/38-Charts.md.',
      filePath: 'modules/ui/Chart/index.ts',
      sourceCode: `'use client';
import { LineChart, BarChart, AreaChart, PieChart, DonutChart, ScatterChart, SparkLine, type Series } from '@/modules/ui/Chart';

const series: Series[] = [
  { id: 'a', name: 'Active', data: [{ x: 'Mon', y: 12 }, { x: 'Tue', y: 19 }] },
];

<LineChart series={series} height={240} />
<BarChart series={series} />
<AreaChart series={series} />
<PieChart series={series} />
<DonutChart series={series} innerRadius={0.6} />
<SparkLine values={[12, 14, 11, 17, 19]} />`,
      composes: [],
      designTokens: [
        '--primary',
        '--secondary',
        '--success',
        '--warning',
        '--error',
        '--info',
        '--surface-raised',
        '--border',
        '--text-primary',
        '--text-secondary',
      ],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['img'],
        notes:
          'Each chart SVG uses role="img" + aria-label. M5 will add a visually hidden data table for screen-reader parity and keyboard navigation between data points.',
      },
      variants: [
        {
          title: 'LineChart',
          layout: 'stack' as const,
          preview: (
            <Frame title="Daily active users vs new signups">
              <LineChart series={lineSeries} height={220} />
            </Frame>
          ),
          code: `<LineChart
  series={[
    { id: 'active',  name: 'Active users', data: [{ x: 'Mon', y: 1200 }, /* … */] },
    { id: 'signups', name: 'New signups',  data: [{ x: 'Mon', y: 300 },  /* … */] },
  ]}
  height={220}
/>`,
        },
        {
          title: 'Interval series (forecast band)',
          layout: 'stack' as const,
          preview: (
            <Frame title="Readings and the next day's forecast with its 80 % range">
              <LineChart series={forecastSeries} xAxis="time" curve="linear" yIncludeZero={false} height={220} />
            </Frame>
          ),
          code: `<LineChart
  xAxis="time"
  series={[
    { id: 'actual',   name: 'Temperature', data: [{ x: 1763596800000, y: 20.1 }, /* … */] },
    // a point with lower and upper draws a shaded range under its line; null leaves a gap
    { id: 'forecast', name: 'Forecast', lineStyle: 'dashed', data: [{ x: 1763722800000, y: 23.4, lower: 22.8, upper: 24.0 }, /* … */] },
  ]}
/>`,
        },
        {
          title: 'Stacked bars and areas',
          layout: 'stack' as const,
          preview: (
            <Frame title="Revenue + expenses, stacked">
              <BarChart series={barSeries} stacked height={200} />
              <div className="mt-3"><AreaChart series={barSeries} stacked height={200} /></div>
            </Frame>
          ),
          code: `<BarChart series={series} stacked />\n<AreaChart series={series} stacked />`,
        },
        {
          title: 'BarChart',
          layout: 'stack' as const,
          preview: (
            <Frame title="Revenue vs expenses (monthly)">
              <BarChart series={barSeries} height={220} />
            </Frame>
          ),
          code: `<BarChart
  series={[
    { id: 'revenue',  name: 'Revenue',  data: [{ x: 'Jan', y: 4200 }, /* … */] },
    { id: 'expenses', name: 'Expenses', data: [{ x: 'Jan', y: 2800 }, /* … */] },
  ]}
  radius={4}
/>`,
        },
        {
          title: 'AreaChart',
          layout: 'stack' as const,
          preview: (
            <Frame title="Engagement over the week (smoothed)">
              <AreaChart series={lineSeries} height={220} fillOpacity={0.18} />
            </Frame>
          ),
          code: `<AreaChart series={series} smooth fillOpacity={0.18} />`,
        },
        {
          title: 'PieChart',
          layout: 'stack' as const,
          preview: (
            <Frame title="Sales by category">
              <PieChart series={pieSeries} height={220} />
            </Frame>
          ),
          code: `<PieChart
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
/>`,
        },
        {
          title: 'DonutChart',
          layout: 'stack' as const,
          preview: (
            <Frame title="Sales by category (donut)">
              <DonutChart series={pieSeries} height={220} innerRadius={0.62} />
            </Frame>
          ),
          code: `<DonutChart series={pieSeries} innerRadius={0.62} />`,
        },
        {
          title: 'SparkLine',
          layout: 'stack' as const,
          preview: (
            <Frame title="Inline sparklines">
              <div className="flex items-center gap-4 text-sm text-text-primary">
                <span>MRR&nbsp;</span>
                <SparkLine values={sparkValues} width={120} height={28} filled />
                <span className="ml-2 font-medium text-success">+24%</span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-text-primary">
                <span>DAU&nbsp;</span>
                <SparkLine values={[5, 7, 6, 9, 8, 11, 10, 13]} width={120} height={28} />
                <span className="ml-2 font-medium text-success">+8%</span>
              </div>
            </Frame>
          ),
          code: `<SparkLine values={[12, 14, 11, 17, 19, 16, 22]} width={120} height={28} filled />
<SparkLine values={[5, 7, 6, 9, 8, 11]} width={120} height={28} />`,
        },
      ],
    },
  ];
}
