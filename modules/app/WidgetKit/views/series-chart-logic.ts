// The pure logic of chart.line / chart.bar / chart.area (no React): which series are drawn on which axis, the per-series
// rules as data, and every prop the ui Chart gets, with each formatter described as a `NumberFormatSpec`. The result
// is JSON: `SeriesChartView.tsx` turns the specs into functions (`numberFormatter`, `withFormatters`) and draws it;
// kui-ejs and KUInative vendor this file and rebuild the same formatters from the same specs.

import type { CurveType, PointShape } from '@/modules/ui/Chart';
import type { SlotData } from '../kind';
import type { ChartViewMessages } from '../messages';
import { formatValue, type ValueFormat } from '../settings/style';
import type { SeriesPreset } from '../templates/series';
import {
  axisFormatSpec, mergeSeriesSlots, rowsToCategorySeries, ruleFor, styleSeries, toBandSeries, toTimeSeries,
  type NumberFormatSpec, type SeriesSpec,
} from './chart-data';
import { animateOf, axisProps, legendProps, num, thresholdLines, tooltipProps, valueLabelStyleOf } from './chart-props-logic';

type S = Record<string, unknown>;
type Data = Record<string, SlotData | undefined>;

/** Category mode of chart.bar: one bar per row of the `rows` slot. */
export const categoryMode = (preset: SeriesPreset, s: S) => preset === 'bar' && s.xAxis === 'category';

/** The columns / ordering the category mode reads from the settings. */
export const categoryOptions = (s: S) => ({
  label: typeof s.categoryColumn === 'string' ? s.categoryColumn : undefined,
  value: typeof s.valueColumn === 'string' ? s.valueColumn : undefined,
  sort: (s.categorySort === 'desc' || s.categorySort === 'asc' ? s.categorySort : 'none') as 'none' | 'desc' | 'asc',
  max: typeof s.maxBars === 'number' ? s.maxBars : undefined,
});

/** The area's fill by the `fill` setting. */
export const FILL: Record<string, number> = { none: 0, soft: 0.2, medium: 0.35, solid: 0.6 };
const SHAPES = new Set(['circle', 'square', 'diamond', 'triangle']);

/** Has the widget nothing to draw (no category rows, or no series with a point)? */
export function seriesChartIsEmpty(data: Data, s: S | undefined): boolean {
  if (s && categoryMode('bar', s)) return !rowsToCategorySeries(data.rows?.rows, categoryOptions(s));
  const r = mergeSeriesSlots(data);
  return !r?.series?.some((x) => x.points.length > 0);
}

/** The tooltip's value format as data: one spec per series id (its rule's unit), and the one for any other id. */
export interface TooltipValueFormat { fallback: NumberFormatSpec; bySeries: Record<string, NumberFormatSpec> }

/** Everything chart.line / chart.bar / chart.area draw, decided once. */
export function seriesChartModel(
  preset: SeriesPreset, s: S, format: ValueFormat, data: Data, locale: string | undefined,
  m: Pick<ChartViewMessages, 'total' | 'lineChart' | 'areaChart' | 'barChart' | 'resetZoom'>,
) {
  const anyStack = Array.isArray(s.series) && (s.series as Array<{ stack?: string }>).some((r) => r && typeof r.stack === 'string' && r.stack);
  const stacked = preset !== 'line' && s.stacked === true;
  const result = mergeSeriesSlots(data);
  const byCategory = categoryMode(preset, s);
  const timeSeries = preset === 'bar' || (preset === 'area' && (stacked || anyStack)) ? null : toTimeSeries(result, locale);
  const pointShape = SHAPES.has(String(s.pointShape)) ? (s.pointShape as PointShape) : undefined;
  const base = byCategory
    ? rowsToCategorySeries(data.rows?.rows, { ...categoryOptions(s), name: data.rows?.columns?.find((c) => c.key === s.valueColumn)?.label })
    : timeSeries ?? toBandSeries(result, locale);
  const styled: SeriesSpec[] | null = base
    ? styleSeries(base, s.series, {
      format, locale,
      lineWidth: num(s.lineWidth),
      showPoints: s.showPoints === true ? true : undefined,
      defaultColor: s.defaultColor as string | undefined,
      pointShape,
      pointSize: num(s.pointSize),
      fillGradient: preset === 'area' ? s.fillStyle !== 'opacity' : undefined,
    })
    : null;
  // No data draws the empty shape: axes and grid without series. A null `timeSeries` keeps the x axis a band, never 1970.
  const series = styled ?? [];
  const tooltipDecimals = num(s.tooltipDecimals);
  const tooltipValueFormat: TooltipValueFormat | null = tooltipDecimals === undefined ? null : {
    fallback: { base: format, override: { unit: undefined, decimals: tooltipDecimals } },
    bySeries: Object.fromEntries(series.map((x) => [x.id, { base: format, override: { unit: ruleFor(x.id, s.series)?.unit || undefined, decimals: tooltipDecimals } }])),
  };
  const lineWidth = num(s.lineWidth) ?? 2;
  const line = preset === 'bar' ? null : {
    curve: (s.curve === 'linear' || s.curve === 'step' ? s.curve : 'smooth') as CurveType,
    strokeWidth: lineWidth,
    zoom: s.zoom !== false,
    resetZoomLabel: m.resetZoom,
    // A host may pass the board window's explicit zone along with the result (next-boilerplate does).
    timeZone: result?.window?.explicitTimezone,
    pointShape,
    pointSize: num(s.pointSize),
    valueLabelPosition: s.valueLabelPosition === 'bottom' ? 'bottom' as const : 'top' as const,
    ...(preset === 'area' ? { fillOpacity: FILL[String(s.fill)] ?? 0.2 } : {}),
  };
  const bar = preset !== 'bar' ? null : {
    orientation: s.orientation === 'horizontal' ? 'horizontal' as const : 'vertical' as const,
    valueLabelPosition: s.valueLabelPosition === 'inside' || s.valueLabelPosition === 'center' ? (s.valueLabelPosition as 'inside' | 'center') : 'outside' as const,
    radius: num(s.barRadius) ?? 4,
    barWidth: (num(s.barWidth) ?? 70) / 100,
    barGap: num(s.barGap) ?? 2,
  };
  return {
    preset, byCategory, stacked,
    /** `time` = x values are epoch ms; `band` = formatted labels. */
    xAxis: (timeSeries ? 'time' : 'band') as 'time' | 'band',
    series,
    yFormat: axisFormatSpec(series, s.series, format, 'left'),
    y2Format: axisFormatSpec(series, s.series, format, 'right'),
    legend: legendProps(s, series.length),
    axis: axisProps(s),
    yIncludeZero: preset === 'bar' || s.yFromZero !== false,
    tooltip: { ...tooltipProps(s), tooltipTotalLabel: m.total },
    tooltipValueFormat,
    thresholds: thresholdLines(s.thresholds),
    animate: animateOf(s),
    showValues: s.valueLabels === 'value',
    valueLabelStyle: valueLabelStyleOf(s),
    ariaLabel: preset === 'bar' ? m.barChart : preset === 'area' ? m.areaChart : m.lineChart,
    line,
    bar,
  };
}

/** The tooltip value function of a `TooltipValueFormat`: (value, series id) → text. */
export const tooltipValueText = (f: TooltipValueFormat, locale: string | undefined) => (v: number, id: string): string => {
  const spec = f.bySeries[id] ?? f.fallback;
  return formatValue(v, spec.base, spec.override ?? {}, locale);
};
