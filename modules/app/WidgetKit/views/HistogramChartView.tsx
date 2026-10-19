'use client';
import { useMemo } from 'react';
import { BarChart, type CategoryMarker, type Series } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { cssColor, formatValue, type ValueFormat } from '../settings/style';
import { histogramBins, valueStats, type HistogramBin } from './chart-data';
import { animateOf, axisProps, num, str, tooltipProps, valueLabelStyleOf } from './chart-props';

type S = Record<string, unknown>;
const nul = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const valuesOf = (data: WidgetViewProps['data'], s: S): unknown[] => {
  const col = typeof s.valueColumn === 'string' && s.valueColumn ? s.valueColumn : 'value';
  return (data.values?.rows ?? []).map((r) => r[col]);
};
const binsOf = (data: WidgetViewProps['data'], s: S): HistogramBin[] =>
  histogramBins(valuesOf(data, s), nul(s.bins), nul(s.min), nul(s.max), s.binEdges !== 'exact');

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
export function binSeries(bins: HistogramBin[], format: ValueFormat, name: string, locale?: string, color?: string): Series[] | null {
  if (bins.length === 0) return null;
  const d = edgeDecimals(bins, format);
  const edge = (n: number) => formatValue(n, { ...format, unit: '', decimals: d }, {}, locale);
  const unit = format.unit ? (format.unitPosition === 'before' ? '' : ` ${format.unit}`) : '';
  const pre = format.unit && format.unitPosition === 'before' ? `${format.unit} ` : '';
  return [{
    id: 'histogram',
    name,
    ...(color ? { color } : {}),
    format: (v: number) => String(Math.round(v)),
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

/** `chart.histogram`: equal-width bins (on round edges by default) of one numeric column, drawn as bars. */
export function HistogramChartView({ settings, format, data, locale }: WidgetViewProps) {
  const s = settings;
  const m = useKitMessages().charts;
  const bins = useMemo(() => binsOf(data, s), [data, s]);
  const series = useMemo(
    () => binSeries(bins, format, str(s.countLabel) ?? m.count, locale, cssColor(s.barColor)),
    [bins, s.countLabel, s.barColor, format, locale, m.count],
  );
  const markers = useMemo(() => {
    const stats = s.showMean === true || s.showMedian === true ? valueStats(valuesOf(data, s)) : null;
    if (!stats || bins.length === 0) return undefined;
    const lo = bins[0].from;
    const w = bins[0].to - bins[0].from || 1;
    const color = cssColor(s.markerColor) ?? 'var(--text-primary)';
    const out: CategoryMarker[] = [];
    const text = (v: number) => formatValue(v, { ...format, decimals: undefined }, {}, locale);
    if (s.showMean === true) out.push({ at: (stats.mean - lo) / w, label: m.mean(text(stats.mean)), color, style: 'dashed' });
    if (s.showMedian === true) out.push({ at: (stats.median - lo) / w, label: m.median(text(stats.median)), color, style: 'dotted' });
    return out;
  }, [s, data, bins, format, locale, m]);
  // No data draws the empty shape: axes without bars (and no edge ticks, which need a bin).
  return (
    <div className="h-full min-h-0 w-full">
      <BarChart
        series={series ?? []}
        fill
        showLegend={false}
        showValues={s.valueLabels === 'value'}
        valueLabelPosition={s.valueLabelPosition === 'inside' ? 'inside' : 'outside'}
        valueLabelStyle={valueLabelStyleOf(s)}
        radius={num(s.barRadius) ?? 3}
        barWidth={(num(s.barWidth) ?? 92) / 100}
        categoryTicks={bins.length > 0 ? edgeTicks(bins, format, locale) : undefined}
        markers={markers}
        yFormat={(v) => String(Math.round(v * 100) / 100)}
        {...axisProps(s)}
        {...tooltipProps(s)}
        animate={animateOf(s)}
        ariaLabel={m.histogram}
      />
    </div>
  );
}

export const CHART_HISTOGRAM_VIEW: WidgetKindView = {
  View: HistogramChartView,
  isEmpty: (data, settings) => binsOf(data, settings).length === 0,
  toCsv: (data, settings) => [['from', 'to', 'count'], ...binsOf(data, settings).map((b) => [String(b.from), String(b.to), String(b.count)])],
  emptyShape: true,
};
