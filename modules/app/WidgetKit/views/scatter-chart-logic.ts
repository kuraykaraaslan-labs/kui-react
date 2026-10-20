// The pure logic of chart.scatter (no React): the groups as series and every prop the ui ScatterChart gets, with the
// axis formatters as `NumberFormatSpec`s. `ScatterChartView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { PointShape, Series } from '@/modules/ui/Chart';
import type { SlotData } from '../kind';
import type { ChartViewMessages } from '../messages';
import { cssColor } from '../settings/style';
import { rowsToScatterSeries, type NumberFormatSpec } from './chart-data';
import { animateOf, axisProps, legendProps, num, str, thresholdLines, tooltipProps } from './chart-props-logic';

type S = Record<string, unknown>;
type Data = Record<string, SlotData | undefined>;

const col = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);
/** The `pointSize` setting as a radius in px. */
export const SCATTER_RADIUS: Record<string, number> = { sm: 3, md: 4, lg: 6, xl: 8 };
const SHAPES = new Set(['circle', 'square', 'diamond', 'triangle']);

/** The groups the `points` table slot describes under the settings (null when no row has a finite x and y). */
export const scatterPoints = (data: Data, s: S, unnamed?: string): Series[] | null => rowsToScatterSeries(data.points?.rows, {
  x: col(s.xColumn, 'x'),
  y: col(s.yColumn, 'y'),
  group: typeof s.groupColumn === 'string' && s.groupColumn ? s.groupColumn : undefined,
  unnamed,
});

/** Everything chart.scatter draws. */
export function scatterChartModel(s: S, data: Data, m: Pick<ChartViewMessages, 'series' | 'scatterChart'>) {
  const raw = scatterPoints(data, s, m.series);
  let series: Series[] = [];
  if (raw) {
    const pinned = new Map<string, string>();
    if (Array.isArray(s.groupColors)) {
      for (const g of s.groupColors as Array<{ key?: string; color?: string }>) {
        const c = cssColor(g?.color);
        if (g?.key && c) pinned.set(g.key, c);
      }
    }
    const single = raw.length === 1 ? cssColor(s.pointColor) : undefined;
    series = raw.map((g) => ({ ...g, ...(pinned.get(g.id) ?? single ? { color: pinned.get(g.id) ?? single } : {}) }));
  }
  const axisFormat = (unit: unknown, decimals: unknown): NumberFormatSpec => ({ base: { unit: str(unit), decimals: num(decimals) } });
  return {
    /** No data draws the empty shape: axes and grid without points. */
    empty: raw === null,
    series,
    pointRadius: SCATTER_RADIUS[String(s.pointSize)] ?? 4,
    pointShape: (SHAPES.has(String(s.pointShape)) ? (s.pointShape as PointShape) : 'circle'),
    pointOpacity: num(s.pointOpacity) ?? 0.8,
    trendLine: s.trendLine === true,
    trendColor: cssColor(s.trendColor),
    legend: legendProps(s, series.length),
    axis: axisProps(s),
    tooltip: tooltipProps(s),
    xMin: num(s.xMin),
    xMax: num(s.xMax),
    xFormat: axisFormat(s.xUnit, s.xDecimals),
    yFormat: axisFormat(s.yUnit, s.yDecimals),
    thresholds: thresholdLines(s.thresholds),
    animate: animateOf(s),
    ariaLabel: m.scatterChart,
  };
}
