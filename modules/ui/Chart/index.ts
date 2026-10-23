// modules/ui/Chart/index.ts
//
// Public barrel for the @/modules/ui/Chart primitive library.
//
// Usage:
//   import { LineChart, BarChart, type Series, type SeriesPoint } from '@/modules/ui/Chart';
//
// Roadmap reference: PLANS/38-Charts.md
//   M1 (this milestone) — Token + theme + primitives + 7 basic charts.
//   M2 — Stacked / horizontal bars, animations, empty + skeleton states.
//   M3 — Heatmap + Gauge done; Treemap / Radar / Funnel / Sankey / Candlestick / Bubble pending.
//   Time axis (`xAxis="time"`) + drag-zoom on Line/Area, `stacked` on Bar/Area (phase 9 §9.1-9.4).
//   M4 — Brush / pan / zoom / synced tooltips / drilldown.
//   M5 — A11y + i18n + PNG / SVG / CSV export.
//   M6 — Annotations, forecast, streaming, thresholds, period overlay.
//
// The existing aggregator at modules/domains/common/charts/Charts.tsx
// remains untouched in M1 — domain charts will be migrated onto these
// primitives in M5.

// ── Charts (M1 implementations) ────────────────────────────────────
export { LineChart } from './charts/LineChart';
export { BarChart } from './charts/BarChart';
export { AreaChart } from './charts/AreaChart';
export { PieChart } from './charts/PieChart';
export { DonutChart } from './charts/DonutChart';
export { ScatterChart } from './charts/ScatterChart';
export { SparkLine } from './charts/SparkLine';

// ── Charts (M3 implementations) ────────────────────────────────────
export { HeatmapChart } from './charts/HeatmapChart';
export type { HeatmapChartProps } from './charts/HeatmapChart';
export type { HeatCell } from './charts/_heatmap';
export { GaugeChart, bandFor, arcPath } from './charts/GaugeChart';
export type { GaugeChartProps, GaugeBand, GaugeTone } from './charts/GaugeChart';

// ── SLO burn chart (error budget, burn-rate tiers, projection, annotations) ──
export { BurnChart, DEFAULT_BURN_CHART_MESSAGES, DEFAULT_BURN_TIERS, projectBudget, activeTier, budgetState } from './charts/BurnChart';
export type { BurnChartProps, BurnChartMessages, BurnPoint, BurnTier, BurnTone, BurnAnnotation } from './charts/BurnChart';

// ── Charts (M3 stubs — render null today) ──────────────────────────
export { BubbleChart } from './charts/BubbleChart';
export { TreemapChart } from './charts/TreemapChart';
export { RadarChart } from './charts/RadarChart';
export { FunnelChart } from './charts/FunnelChart';
export { SankeyChart } from './charts/SankeyChart';
export { CandlestickChart } from './charts/CandlestickChart';

// ── Primitives (escape-hatch for advanced consumers) ───────────────
export { XAxis, YAxis } from './primitives/Axis';
export { Grid } from './primitives/Grid';
export { Legend } from './primitives/Legend';
export { ChartTooltip } from './primitives/Tooltip';
export { Crosshair } from './primitives/Crosshair';
export { Brush } from './primitives/Brush';
export { ResponsiveContainer } from './primitives/ResponsiveContainer';
export { ChartFrame } from './primitives/ChartFrame';
export { Thresholds } from './primitives/Thresholds';
export { AxisTitles } from './primitives/AxisTitles';

// ── Theme + types ──────────────────────────────────────────────────
export { defaultPalette, paletteColor, chartTheme, animationDuration } from './theme';
export type {
  Series,
  SeriesPoint,
  BaseChartProps,
  TooltipDatum,
  PlotRect,
  LineStyle,
  CurveType,
  LegendPosition,
  LegendValue,
  TooltipMode,
  ThresholdLine,
  AxisTextStyle,
  PointShape,
  CategoryMarker,
} from './types';
export type { LineChartProps } from './charts/LineChart';
export type { AreaChartProps } from './charts/AreaChart';
export type { BarChartProps } from './charts/BarChart';
export type { PieChartProps, PieSlice } from './charts/PieChart';
export type { ScatterChartProps } from './charts/ScatterChart';
export { seriesStats, resolveDomain, niceTicks, niceStep, linearRegression } from './charts/_helpers';
export { dayMonthText, clockText } from './charts/_time';
export type { AxisTick } from './primitives/Axis';
