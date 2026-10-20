'use client';
import { useMemo } from 'react';
import { AreaChart, BarChart, LineChart, type Series } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import type { SeriesPreset } from '../templates/series';
import { mergeSeriesSlots, numberFormatter, seriesCsv, tableCsv, withFormatters } from './chart-data';
import { categoryMode, seriesChartIsEmpty, seriesChartModel, tooltipValueText } from './series-chart-logic';

export * from './series-chart-logic';

/**
 * The view behind chart.line / chart.bar / chart.area: every source bound to the `series` slot,
 * on a time axis when every x is a date (line, and area unless stacked) or on a band axis of
 * formatted timestamps (bars, stacked areas, non-date x values). A series may sit on a right-hand
 * value axis with its own bounds, title and unit; zoom on the time axis is viewer-local and never
 * changes the board window. The chart fills the card body.
 */
export function SeriesChartView({ preset, settings, format, data, locale }: WidgetViewProps & { preset: SeriesPreset }) {
  const m = useKitMessages().charts;
  const model = useMemo(() => seriesChartModel(preset, settings, format, data, locale, m), [preset, settings, format, data, locale, m]);
  const series: Series[] = useMemo(() => withFormatters(model.series, locale), [model.series, locale]);
  const common = {
    series,
    fill: true,
    yFormat: numberFormatter(model.yFormat, locale),
    y2Format: numberFormatter(model.y2Format, locale),
    ...model.legend,
    ...model.axis,
    yIncludeZero: model.yIncludeZero,
    ...model.tooltip,
    tooltipValueFormat: model.tooltipValueFormat ? (() => {
      const text = tooltipValueText(model.tooltipValueFormat, locale);
      return (v: number, ser: Series) => text(v, ser.id);
    })() : undefined,
    thresholds: model.thresholds,
    animate: model.animate,
    showValues: model.showValues,
    valueLabelStyle: model.valueLabelStyle,
    ariaLabel: model.ariaLabel,
  };
  const { line, bar } = model;

  return (
    <div className="h-full min-h-0 w-full">
      {bar ? (
        <BarChart {...common} stacked={model.stacked} {...bar} />
      ) : preset === 'area' ? (
        <AreaChart
          {...common}
          stacked={model.stacked}
          curve={line!.curve}
          strokeWidth={line!.strokeWidth}
          fillOpacity={line!.fillOpacity}
          xAxis={model.xAxis}
          zoom={line!.zoom}
          resetZoomLabel={line!.resetZoomLabel}
          timeZone={line!.timeZone}
          locale={locale}
          pointShape={line!.pointShape}
          pointSize={line!.pointSize}
          valueLabelPosition={line!.valueLabelPosition}
        />
      ) : (
        <LineChart
          {...common}
          curve={line!.curve}
          strokeWidth={line!.strokeWidth}
          xAxis={model.xAxis}
          zoom={line!.zoom}
          resetZoomLabel={line!.resetZoomLabel}
          timeZone={line!.timeZone}
          locale={locale}
          pointShape={line!.pointShape}
          pointSize={line!.pointSize}
          valueLabelPosition={line!.valueLabelPosition}
        />
      )}
    </div>
  );
}

const isEmpty: WidgetKindView['isEmpty'] = (data, settings) => seriesChartIsEmpty(data, settings);

const toCsv: WidgetKindView['toCsv'] = (data, settings) =>
  (settings && categoryMode('bar', settings) ? tableCsv(data.rows) : seriesCsv(mergeSeriesSlots(data)));

/** The kind view for one series preset. */
export function seriesView(preset: SeriesPreset): WidgetKindView {
  function View(props: WidgetViewProps) {
    return <SeriesChartView preset={preset} {...props} />;
  }
  View.displayName = `SeriesChartView(${preset})`;
  return { View, isEmpty, toCsv, emptyShape: true };
}
