'use client';
import { useMemo } from 'react';
import { AreaChart, BarChart, LineChart, type CurveType, type PointShape, type Series } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { formatValue } from '../settings/style';
import type { SeriesPreset } from '../templates/series';
import { applySeriesRules, axisFormat, mergeSeriesSlots, ruleFor, seriesCsv, toBandSeries, toTimeSeries } from './chart-data';
import { animateOf, axisProps, legendProps, num, thresholdLines, tooltipProps, valueLabelStyleOf } from './chart-props';

const FILL: Record<string, number> = { none: 0, soft: 0.2, medium: 0.35, solid: 0.6 };
const SHAPES = new Set(['circle', 'square', 'diamond', 'triangle']);

/**
 * The view behind chart.line / chart.bar / chart.area: every source bound to the `series` slot,
 * on a time axis when every x is a date (line, and area unless stacked) or on a band axis of
 * formatted timestamps (bars, stacked areas, non-date x values). A series may sit on a right-hand
 * value axis with its own bounds, title and unit; zoom on the time axis is viewer-local and never
 * changes the board window. The chart fills the card body.
 */
export function SeriesChartView({ preset, settings, format, data, locale }: WidgetViewProps & { preset: SeriesPreset }) {
  const m = useKitMessages().charts;
  const s = settings;
  const anyStack = Array.isArray(s.series) && (s.series as Array<{ stack?: string }>).some((r) => r && typeof r.stack === 'string' && r.stack);
  const stacked = preset !== 'line' && s.stacked === true;
  const result = useMemo(() => mergeSeriesSlots(data), [data]);
  const timeSeries = useMemo(
    () => (preset === 'bar' || (preset === 'area' && (stacked || anyStack)) ? null : toTimeSeries(result)),
    [result, preset, stacked, anyStack],
  );
  const pointShape = SHAPES.has(String(s.pointShape)) ? (s.pointShape as PointShape) : undefined;
  const series: Series[] | null = useMemo(() => {
    const base = timeSeries ?? toBandSeries(result, locale);
    return base
      ? applySeriesRules(base, s.series, {
        format, locale,
        lineWidth: num(s.lineWidth),
        showPoints: s.showPoints === true ? true : undefined,
        defaultColor: s.defaultColor as string | undefined,
        pointShape,
        pointSize: num(s.pointSize),
        fillGradient: preset === 'area' ? s.fillStyle !== 'opacity' : undefined,
      })
      : null;
  }, [timeSeries, result, locale, s.series, s.lineWidth, s.showPoints, s.defaultColor, s.pointSize, s.fillStyle, pointShape, preset, format]);
  const yFormat = useMemo(() => (series ? axisFormat(series, s.series, format, locale, 'left') : undefined), [series, s.series, format, locale]);
  const y2Format = useMemo(() => (series ? axisFormat(series, s.series, format, locale, 'right') : undefined), [series, s.series, format, locale]);

  if (!series) return <div className="h-full" />;

  const tooltipDecimals = num(s.tooltipDecimals);
  const common = {
    series,
    fill: true,
    yFormat,
    y2Format,
    ...legendProps(s, series.length),
    ...axisProps(s),
    yIncludeZero: preset === 'bar' || s.yFromZero !== false,
    ...tooltipProps(s),
    tooltipValueFormat: tooltipDecimals === undefined ? undefined : (v: number, ser: Series) => {
      const r = ruleFor(ser.id, s.series);
      return formatValue(v, format, { unit: r?.unit || undefined, decimals: tooltipDecimals }, locale);
    },
    thresholds: thresholdLines(s.thresholds),
    animate: animateOf(s),
    showValues: s.valueLabels === 'value',
    valueLabelStyle: valueLabelStyleOf(s),
    ariaLabel: preset === 'bar' ? m.barChart : preset === 'area' ? m.areaChart : m.lineChart,
  };
  const curve = (s.curve === 'linear' || s.curve === 'step' ? s.curve : 'smooth') as CurveType;
  const lineWidth = num(s.lineWidth) ?? 2;
  // A host may pass the board window's explicit zone along with the result (next-boilerplate does).
  const timeZone = result?.window?.explicitTimezone;
  const linePos = s.valueLabelPosition === 'bottom' ? 'bottom' : 'top';

  return (
    <div className="h-full min-h-0 w-full">
      {preset === 'bar' ? (
        <BarChart
          {...common}
          stacked={stacked}
          orientation={s.orientation === 'horizontal' ? 'horizontal' : 'vertical'}
          valueLabelPosition={s.valueLabelPosition === 'inside' || s.valueLabelPosition === 'center' ? s.valueLabelPosition : 'outside'}
          radius={num(s.barRadius) ?? 4}
          barWidth={(num(s.barWidth) ?? 70) / 100}
          barGap={num(s.barGap) ?? 2}
        />
      ) : preset === 'area' ? (
        <AreaChart
          {...common}
          stacked={stacked}
          curve={curve}
          strokeWidth={lineWidth}
          fillOpacity={FILL[String(s.fill)] ?? 0.2}
          xAxis={timeSeries ? 'time' : 'band'}
          zoom={s.zoom !== false}
          timeZone={timeZone}
          locale={locale}
          pointShape={pointShape}
          pointSize={num(s.pointSize)}
          valueLabelPosition={linePos}
        />
      ) : (
        <LineChart
          {...common}
          curve={curve}
          strokeWidth={lineWidth}
          xAxis={timeSeries ? 'time' : 'band'}
          zoom={s.zoom !== false}
          timeZone={timeZone}
          locale={locale}
          pointShape={pointShape}
          pointSize={num(s.pointSize)}
          valueLabelPosition={linePos}
        />
      )}
    </div>
  );
}

const isEmpty: WidgetKindView['isEmpty'] = (data) => {
  const r = mergeSeriesSlots(data);
  return !r?.series?.some((s) => s.points.length > 0);
};

const toCsv: WidgetKindView['toCsv'] = (data) => seriesCsv(mergeSeriesSlots(data));

/** The kind view for one series preset. */
export function seriesView(preset: SeriesPreset): WidgetKindView {
  function View(props: WidgetViewProps) {
    return <SeriesChartView preset={preset} {...props} />;
  }
  View.displayName = `SeriesChartView(${preset})`;
  return { View, isEmpty, toCsv };
}
