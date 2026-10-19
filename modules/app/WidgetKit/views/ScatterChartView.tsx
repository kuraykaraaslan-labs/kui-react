'use client';
import { useMemo } from 'react';
import { ScatterChart, type PointShape } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { cssColor, formatValue } from '../settings/style';
import { rowsToScatterSeries, tableCsv } from './chart-data';
import { animateOf, axisProps, legendProps, num, str, thresholdLines, tooltipProps } from './chart-props';

type S = Record<string, unknown>;
const col = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);
const RADIUS: Record<string, number> = { sm: 3, md: 4, lg: 6, xl: 8 };
const SHAPES = new Set(['circle', 'square', 'diamond', 'triangle']);

const pointsOf = (data: WidgetViewProps['data'], s: S, unnamed?: string) => rowsToScatterSeries(data.points?.rows, {
  x: col(s.xColumn, 'x'),
  y: col(s.yColumn, 'y'),
  group: typeof s.groupColumn === 'string' && s.groupColumn ? s.groupColumn : undefined,
  unnamed,
});

/** `chart.scatter`: points from a bound table, one series per group, with an optional trend line each. */
export function ScatterChartView({ settings, data, locale }: WidgetViewProps) {
  const s = settings;
  const m = useKitMessages().charts;
  const raw = useMemo(() => pointsOf(data, s, m.series), [data, s, m.series]);
  const series = useMemo(() => {
    if (!raw) return null;
    const pinned = new Map<string, string>();
    if (Array.isArray(s.groupColors)) {
      for (const g of s.groupColors as Array<{ key?: string; color?: string }>) {
        const c = cssColor(g?.color);
        if (g?.key && c) pinned.set(g.key, c);
      }
    }
    const single = raw.length === 1 ? cssColor(s.pointColor) : undefined;
    return raw.map((g) => ({ ...g, ...(pinned.get(g.id) ?? single ? { color: pinned.get(g.id) ?? single } : {}) }));
  }, [raw, s.groupColors, s.pointColor]);
  // No data draws the empty shape: axes and grid without points.
  const shown = series ?? [];
  const unit = (v: unknown) => str(v);
  return (
    <div className="h-full min-h-0 w-full">
      <ScatterChart
        series={shown}
        fill
        pointRadius={RADIUS[String(s.pointSize)] ?? 4}
        pointShape={SHAPES.has(String(s.pointShape)) ? (s.pointShape as PointShape) : 'circle'}
        pointOpacity={num(s.pointOpacity) ?? 0.8}
        trendLine={s.trendLine === true}
        trendColor={cssColor(s.trendColor)}
        {...legendProps(s, shown.length)}
        {...axisProps(s)}
        {...tooltipProps(s)}
        xMin={num(s.xMin)}
        xMax={num(s.xMax)}
        xFormat={(v) => formatValue(v, { unit: unit(s.xUnit), decimals: num(s.xDecimals) }, {}, locale)}
        yFormat={(v) => formatValue(v, { unit: unit(s.yUnit), decimals: num(s.yDecimals) }, {}, locale)}
        thresholds={thresholdLines(s.thresholds)}
        animate={animateOf(s)}
        ariaLabel={m.scatterChart}
      />
    </div>
  );
}

export const CHART_SCATTER_VIEW: WidgetKindView = {
  View: ScatterChartView,
  isEmpty: (data, settings) => pointsOf(data, settings) === null,
  toCsv: (data) => tableCsv(data.points),
  emptyShape: true,
};
