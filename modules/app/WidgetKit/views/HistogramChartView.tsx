'use client';
import { useMemo } from 'react';
import { BarChart } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { numberFormatter, withFormatters } from './chart-data';
import { histogramBinsOf, histogramChartModel } from './histogram-chart-logic';

export * from './histogram-chart-logic';

/** `chart.histogram`: equal-width bins (on round edges by default) of one numeric column, drawn as bars. */
export function HistogramChartView({ settings, format, data, locale }: WidgetViewProps) {
  const m = useKitMessages().charts;
  const g = useMemo(() => histogramChartModel(settings, format, data, locale, m), [settings, format, data, locale, m]);
  const series = useMemo(() => withFormatters(g.series, locale), [g.series, locale]);
  return (
    <div className="h-full min-h-0 w-full">
      <BarChart
        series={series}
        fill
        showLegend={g.showLegend}
        showValues={g.showValues}
        valueLabelPosition={g.valueLabelPosition}
        valueLabelStyle={g.valueLabelStyle}
        radius={g.radius}
        barWidth={g.barWidth}
        categoryTicks={g.categoryTicks}
        markers={g.markers}
        yFormat={numberFormatter(g.yFormat, locale)}
        {...g.axis}
        {...g.tooltip}
        animate={g.animate}
        ariaLabel={g.ariaLabel}
      />
    </div>
  );
}

export const CHART_HISTOGRAM_VIEW: WidgetKindView = {
  View: HistogramChartView,
  isEmpty: (data, settings) => histogramBinsOf(data, settings).length === 0,
  toCsv: (data, settings) => [['from', 'to', 'count'], ...histogramBinsOf(data, settings).map((b) => [String(b.from), String(b.to), String(b.count)])],
  emptyShape: true,
};
