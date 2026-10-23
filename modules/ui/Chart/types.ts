// modules/ui/Chart/types.ts
//
// Shared type definitions for the kui-react modules/ui/Chart primitive library.
//
// All chart primitives below operate on the same `Series<T>` shape so a
// caller can swap chart types without rewriting data. The companion EJS
// renderer at modules/ui/Chart/Chart.ejs accepts a JSON-equivalent of
// these structures for pixel-identical output.

import type { CSSProperties } from 'react';

export type SeriesPoint = {
  /** Categorical or numeric x value. Strings are placed on a band scale. */
  x: string | number;
  /** Numeric y value. `null` skips the point (line gaps, missing bars). */
  y: number | null;
  /** Optional override color (else picked from theme palette by series index). */
  color?: string;
  /** Free-form label override for tooltips / a11y. */
  label?: string;
};

export type Series = {
  /** Stable identifier; used for legend toggle (M4) and series lookup. */
  id: string;
  /** Human-readable label shown in the legend + tooltip. */
  name: string;
  /** Points in plotted order. */
  data: SeriesPoint[];
  /** Optional override color. Falls back to defaultPalette[seriesIndex]. */
  color?: string;
  /** Line / Area / time axis: stroke pattern. Default = 'solid'. */
  lineStyle?: LineStyle;
  /** Line / Area / time axis: stroke width in px. Default = the chart's `strokeWidth` (2). */
  strokeWidth?: number;
  /** Line / Area / time axis: draw a dot on every point. Default = false. */
  showPoints?: boolean;
  /** Area: this series' fill alpha (0..1), else the chart's. Line: a value above 0 fills under the line. */
  fillOpacity?: number;
  /** Starts toggled off; the viewer shows it from the legend (which then becomes interactive). */
  hidden?: boolean;
  /** Line / Area / Bar (vertical): the value axis this series is drawn against. Default = 'left'. */
  yAxis?: 'left' | 'right';
  /** Line / Area / Scatter: the point mark. Default = 'circle'. */
  pointShape?: PointShape;
  /** Line / Area / Scatter: the point mark's radius in px. Default = stroke width + 1.5 (line), the chart's (scatter). */
  pointSize?: number;
  /** Area (and a filled line): fade the fill from `fillOpacity` at the line to clear at the baseline. */
  fillGradient?: boolean;
  /**
   * Bar / Area (band axis): series with the same stack key stack on each other; different keys stand
   * side by side (bars) or overlap (areas). With the chart's `stacked`, series without a key share one stack.
   */
  stack?: string;
  /** Value text for this series' tooltip rows, legend values and value labels (else the chart's `yFormat`). */
  format?: (value: number) => string;
};

/** A stroke pattern. */
export type LineStyle = 'solid' | 'dashed' | 'dotted';

/** A point mark. */
export type PointShape = 'circle' | 'square' | 'diamond' | 'triangle';

/** A vertical reference line on a category axis (a histogram's mean). `at` is a fractional band index: 0 = start of the first band, n = end of the last. */
export type CategoryMarker = {
  at: number;
  label?: string;
  color?: string;
  style?: LineStyle;
  width?: number;
};

/** How Line / Area connect points: curved, straight, or held until the next point (step-after). */
export type CurveType = 'smooth' | 'linear' | 'step';

/** Where the legend sits relative to the plot. */
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

/** Per-series statistics a legend can print next to each name. */
export type LegendValue = 'latest' | 'min' | 'max' | 'avg' | 'total';

/** 'axis' = every series at the hovered x; 'point' = the series nearest the pointer; 'none' = off. */
export type TooltipMode = 'axis' | 'point' | 'none';

/** A fixed reference line (a limit, a target) across the plot at a value. */
export type ThresholdLine = {
  value: number;
  label?: string;
  /** Any CSS colour or token. Default = `var(--warning)`. */
  color?: string;
  style?: LineStyle;
  /** Stroke width in px. Default = 1. */
  width?: number;
  /** The value axis the line belongs to. Default = 'left'. */
  yAxis?: 'left' | 'right';
};

/** Text style for axis tick labels and axis titles (SVG text). */
export type AxisTextStyle = {
  color?: string;
  fontSize?: number | string;
  fontWeight?: number | string;
  fontFamily?: string;
  fontStyle?: string;
};

/**
 * Common props every chart accepts. Individual chart components may extend
 * this with chart-specific options (e.g. `stacked` on BarChart).
 */
export type BaseChartProps = {
  /** Series array. At least one series is required for non-empty charts. */
  series: Series[];
  /** Optional fixed height (px). Default = 240. Width is 100% of parent. */
  height?: number;
  /** Show the legend strip below the chart. Default = true. */
  showLegend?: boolean;
  /** Show grid lines behind plotted shapes. Default = true. */
  showGrid?: boolean;
  /** Show hover tooltip. Default = true. */
  showTooltip?: boolean;
  /** Optional ARIA label override for the chart wrapper. */
  ariaLabel?: string;
  /** Extra className applied to the outer responsive container. */
  className?: string;
  /**
   * `'time'` places points by their timestamp (ISO string or
   * epoch ms in `x`) instead of by index and enables viewer-local drag-to-zoom (`zoom`, default on).
   * Line and Area only; ignored with `stacked`. Default = `'band'`.
   */
  xAxis?: 'band' | 'time';
  /** Documented phase-9 §9.1 spelling of `xAxis="time"` (`'band'` | `'time'`); `xAxis` wins when both are set. */
  xScale?: 'band' | 'time';
  /** Time axis only: label of the zoom-reset button. Default = "Reset zoom". */
  resetZoomLabel?: string;
  /** Time axis only: drag a range to zoom, double-click or "Reset zoom" to leave it. Default = true. */
  zoom?: boolean;
  /**
   * Line / Area / Bar on an axis of instants: the viewer selects a range for the host instead of zooming locally. A
   * pointer drag across the plot (mouse, pen or touch) draws a selection band and, on release, reports the range in
   * epoch ms (`from < to`; on a band axis whole categories, see `categoryTimes`); a double click, and Escape while a
   * band shows, report `null` (reset). Keyboard: the plot is focusable; the arrow keys move the selection's end, Shift
   * + arrows its start, Enter reports it, Escape clears it. Absent = the chart behaves as before and no band appears.
   */
  onRangeSelect?: (range: { from: number; to: number } | null) => void;
  /**
   * Band axis only: the instant of each category (epoch ms, one per category, in order), so a selection of bars or of
   * a stacked area's columns can be reported as a time range (`onRangeSelect`): from the first selected category to
   * the end of the last one's bucket. Without it a band axis offers no range selection.
   */
  categoryTimes?: readonly number[];
  /** Format a y tick / tooltip value (e.g. `(v) => v + '%'`). Band and time axes. */
  yFormat?: (value: number) => string;
  /** Time axis only: an IANA zone the axis and tooltip are drawn in (e.g. `Europe/Istanbul`). Default = the browser's. */
  timeZone?: string;
  /** Legend placement. Default = 'bottom'. */
  legendPosition?: LegendPosition;
  /** Statistics printed after each legend name. Default = none. */
  legendValues?: LegendValue[];
  /** Inline style for the legend text (font, colour). */
  legendStyle?: CSSProperties;
  /** Legend entries are buttons that show/hide their series. Default = on when any series starts `hidden`. */
  legendToggle?: boolean;
  /** Fixed value-axis bounds; default = from the data (and thresholds). */
  yMin?: number;
  yMax?: number;
  /** Value-axis title. */
  yLabel?: string;
  /** Category / time / x axis title. */
  xLabel?: string;
  /** Reference lines across the plot. */
  thresholds?: ThresholdLine[];
  /** Tooltip behaviour. Default = 'axis' ('none' when `showTooltip` is false). */
  tooltipMode?: TooltipMode;
  /** Grid line colour. Default = the theme's grid token. */
  gridColor?: string;
  /** Axis tick label / title style. Default = the theme's axis text. */
  tickStyle?: AxisTextStyle;
  /** Take the parent's height (the parent must have a definite height); `height` is then the first-paint fallback. */
  fill?: boolean;
  /** The value axis always reaches zero (bars and areas need it; a line may span only its data). Default = true. */
  yIncludeZero?: boolean;
  /** About how many value-axis intervals to draw (the step stays a round number). Default = 4. */
  yTickCount?: number;
  /** Category / time / x axis tick labels. Default = true. */
  showXAxis?: boolean;
  /** Value axis tick labels. Default = true. */
  showYAxis?: boolean;
  /** Grid line pattern. Default = 'dashed'. */
  gridStyle?: LineStyle;
  /** Right value axis (series with `yAxis: 'right'`): fixed bounds, title and tick text. */
  y2Min?: number;
  y2Max?: number;
  y2Label?: string;
  y2Format?: (value: number) => string;
  /** The tooltip's heading (the time or category). Default = true. */
  tooltipHeader?: boolean;
  /** Tooltip value text, overriding the series' own format. */
  tooltipValueFormat?: (value: number, series: Series) => string;
  /** Stacked charts: a "Total" row in the tooltip. Default = false. */
  tooltipTotal?: boolean;
  /** The label of that "Total" row. Default = "Total". */
  tooltipTotalLabel?: string;
  /** Entrance animation (skipped when the OS asks for reduced motion). Default = true. */
  animate?: boolean;
  /** Text style of value labels (bars, points). */
  valueLabelStyle?: AxisTextStyle;
};

/**
 * Tooltip payload passed to consumers wanting to customise rendering
 * (M2+). The default tooltip is rendered by primitives/Tooltip.tsx.
 */
export type TooltipDatum = {
  seriesId: string;
  seriesName: string;
  color: string;
  x: string | number;
  y: number | null;
  /** A ready-made value text that replaces `y` in the tooltip (`SeriesPoint.label` or the series' `format`). */
  valueLabel?: string;
};

/** Computed pixel rectangle of the plotting area (inside axes/padding). */
export type PlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
