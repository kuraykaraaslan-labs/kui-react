'use client';
import { useMemo } from 'react';
import { ScatterChart } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { numberFormatter, tableCsv } from './chart-data';
import { scatterChartModel, scatterPoints } from './scatter-chart-logic';

export * from './scatter-chart-logic';

/** `chart.scatter`: points from a bound table, one series per group, with an optional trend line each. */
export function ScatterChartView({ settings, data, locale }: WidgetViewProps) {
  const m = useKitMessages().charts;
  const g = useMemo(() => scatterChartModel(settings, data, m), [settings, data, m]);
  return (
    <div className="h-full min-h-0 w-full">
      <ScatterChart
        series={g.series}
        fill
        pointRadius={g.pointRadius}
        pointShape={g.pointShape}
        pointOpacity={g.pointOpacity}
        trendLine={g.trendLine}
        trendColor={g.trendColor}
        {...g.legend}
        {...g.axis}
        {...g.tooltip}
        xMin={g.xMin}
        xMax={g.xMax}
        xFormat={numberFormatter(g.xFormat, locale)}
        yFormat={numberFormatter(g.yFormat, locale)}
        thresholds={g.thresholds}
        animate={g.animate}
        ariaLabel={g.ariaLabel}
      />
    </div>
  );
}

export const CHART_SCATTER_VIEW: WidgetKindView = {
  View: ScatterChartView,
  isEmpty: (data, settings) => scatterPoints(data, settings) === null,
  toCsv: (data) => tableCsv(data.points),
  emptyShape: true,
};
