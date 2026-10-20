// The pure logic of chart.histogram (no React): the bins, the bar series with each bar's range as its category, the
// axis ticks on the bin edges, the mean / median markers and every prop the ui BarChart gets. Formatters are
// `NumberFormatSpec`s. `HistogramChartView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { CategoryMarker } from '@/modules/ui/Chart';
import type { SlotData } from '../kind';
import type { ChartViewMessages } from '../messages';
import { cssColor, formatValue, type ValueFormat } from '../settings/style';
import { histogramBins, valueStats, type HistogramBin, type NumberFormatSpec, type SeriesSpec } from './chart-data';
import { animateOf, axisProps, num, str, tooltipProps, valueLabelStyleOf } from './chart-props-logic';

type S = Record<string, unknown>;
type Data = Record<string, SlotData | undefined>;
const nul = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The values of the `values` table slot's value column. */
export const histogramValues = (data: Data, s: S): unknown[] => {
  const col = typeof s.valueColumn === 'string' && s.valueColumn ? s.valueColumn : 'value';
  return (data.values?.rows ?? []).map((r) => r[col]);
};

/** The bins under the settings (`bins`, `min`, `max`, round edges unless `binEdges` is `exact`). */
export const histogramBinsOf = (data: Data, s: S): HistogramBin[] =>
  histogramBins(histogramValues(data, s), nul(s.bins), nul(s.min), nul(s.max), s.binEdges !== 'exact');

/** Decimals a bin edge needs: none for whole steps, else enough for the step (0.25 → 2). */
function edgeDecimals(bins: HistogramBin[], format: ValueFormat): number | undefined {
  if (typeof format.decimals === 'number') return format.decimals;
  const w = bins.length ? bins[0].to - bins[0].from : 1;
  if (!(w > 0)) return undefined;
  const allWhole = bins.every((b) => Number.isInteger(Math.round(b.from * 1e9) / 1e9));
  return allWhole && Number.isInteger(Math.round(w * 1e9) / 1e9) ? 0 : Math.min(4, Math.max(1, -Math.floor(Math.log10(w)) + 1));
}

/**
 * Bins as one bar series. Each bar's category is its range in the widget format (`100–140 ms`, the
 * tooltip heading); the axis prints the bin edges compactly (`100`, `140`, …) via `edgeTicks`.
 */
export function binSeries(bins: HistogramBin[], format: ValueFormat, name: string, locale?: string, color?: string): SeriesSpec[] | null {
  if (bins.length === 0) return null;
  const d = edgeDecimals(bins, format);
  const edge = (n: number) => formatValue(n, { ...format, unit: '', decimals: d }, {}, locale);
  const unit = format.unit ? (format.unitPosition === 'before' ? '' : ` ${format.unit}`) : '';
  const pre = format.unit && format.unitPosition === 'before' ? `${format.unit} ` : '';
  return [{
    id: 'histogram',
    name,
    ...(color ? { color } : {}),
    format: { base: {}, mode: 'round' } as NumberFormatSpec,
    data: bins.map((b) => ({ x: bins.length === 1 && b.from === b.to ? `${pre}${edge(b.from)}${unit}` : `${pre}${edge(b.from)}–${edge(b.to)}${unit}`, y: b.count })),
  }];
}

/** Axis ticks on the bin edges, compact numbers with the unit. */
export function edgeTicks(bins: HistogramBin[], format: ValueFormat, locale?: string): Array<{ at: number; label: string }> {
  const d = edgeDecimals(bins, format);
  const f = (n: number) => formatValue(n, { ...format, notation: Math.abs(n) >= 10_000 ? 'compact' : format.notation, decimals: d }, {}, locale);
  if (bins.length === 1) return [{ at: 0.5, label: f(bins[0].from) }];
  return [...bins.map((b, i) => ({ at: i, label: f(b.from) })), { at: bins.length, label: f(bins[bins.length - 1].to) }];
}

/** The mean / median lines, as positions in bin units (null when neither is asked for or there is nothing to mark). */
export function histogramMarkers(
  bins: HistogramBin[], values: unknown[], s: S, format: ValueFormat, locale: string | undefined, m: Pick<ChartViewMessages, 'mean' | 'median'>,
): CategoryMarker[] | undefined {
  const stats = s.showMean === true || s.showMedian === true ? valueStats(values) : null;
  if (!stats || bins.length === 0) return undefined;
  const lo = bins[0].from;
  const w = bins[0].to - bins[0].from || 1;
  const color = cssColor(s.markerColor) ?? 'var(--text-primary)';
  const out: CategoryMarker[] = [];
  const text = (v: number) => formatValue(v, { ...format, decimals: undefined }, {}, locale);
  if (s.showMean === true) out.push({ at: (stats.mean - lo) / w, label: m.mean(text(stats.mean)), color, style: 'dashed' });
  if (s.showMedian === true) out.push({ at: (stats.median - lo) / w, label: m.median(text(stats.median)), color, style: 'dotted' });
  return out;
}

/** Everything chart.histogram draws. */
export function histogramChartModel(
  s: S, format: ValueFormat, data: Data, locale: string | undefined,
  m: Pick<ChartViewMessages, 'count' | 'mean' | 'median' | 'histogram'>,
) {
  const bins = histogramBinsOf(data, s);
  const series = binSeries(bins, format, str(s.countLabel) ?? m.count, locale, cssColor(s.barColor));
  return {
    bins,
    /** No data draws the empty shape: axes without bars (and no edge ticks, which need a bin). */
    empty: bins.length === 0,
    series: series ?? [],
    showLegend: false,
    showValues: s.valueLabels === 'value',
    valueLabelPosition: s.valueLabelPosition === 'inside' ? 'inside' as const : 'outside' as const,
    valueLabelStyle: valueLabelStyleOf(s),
    radius: num(s.barRadius) ?? 3,
    barWidth: (num(s.barWidth) ?? 92) / 100,
    categoryTicks: bins.length > 0 ? edgeTicks(bins, format, locale) : undefined,
    markers: histogramMarkers(bins, histogramValues(data, s), s, format, locale, m),
    yFormat: { base: {}, mode: 'round2' } as NumberFormatSpec,
    axis: axisProps(s),
    tooltip: tooltipProps(s),
    animate: animateOf(s),
    ariaLabel: m.histogram,
  };
}
