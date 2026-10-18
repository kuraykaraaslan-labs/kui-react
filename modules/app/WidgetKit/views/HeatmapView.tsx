'use client';
import { useMemo } from 'react';
import { HeatmapChart } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { cssColor, formatValue, rangeFor, type ColorRange, type RangeEdges } from '../settings/style';
import { rowsToHeatCells, tableCsv } from './chart-data';
import { animateOf, compactFormatter, legendProps, num, str, tickStyleOf, valueLabelStyleOf } from './chart-props';

type S = Record<string, unknown>;
const col = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);

const cellsOf = (data: WidgetViewProps['data'], s: S) => rowsToHeatCells(data.cells?.rows, {
  x: col(s.xColumn, 'x'), y: col(s.yColumn, 'y'), value: col(s.valueColumn, 'value'),
});

/** `heatmap`: a colour grid; a low-to-high colour scale, or colour ranges (bands). */
export function HeatmapView({ settings, format, data, locale }: WidgetViewProps) {
  const s = settings;
  const m = useKitMessages().charts;
  const cells = useMemo(() => cellsOf(data, s), [data, s]);
  if (cells.length === 0) return <div className="h-full" />;
  const legend = legendProps(s, 2);
  const fmt = (v: number) => formatValue(v, format, {}, locale);
  const compact = compactFormatter(format, locale);
  const bands = s.scale === 'bands' && Array.isArray(s.ranges) ? (s.ranges as ColorRange[]) : null;
  const edges: RangeEdges = s.rangeEdges === 'to' ? 'to' : 'from';
  const legendItems = bands
    ? bands.flatMap((r) => {
      const c = cssColor(r?.color);
      if (!c) return [];
      const from = typeof r.from === 'number' ? compact(r.from) : '';
      const to = typeof r.to === 'number' ? compact(r.to) : '';
      return [{ color: c, label: r.label || (from && to ? `${from} – ${to}` : from ? `≥ ${from}` : to ? `< ${to}` : m.all) }];
    })
    : undefined;
  return (
    <div className="h-full min-h-0 w-full">
      <HeatmapChart
        cells={cells}
        fill
        min={num(s.min)}
        max={num(s.max)}
        color={cssColor(s.color) ?? 'var(--primary)'}
        colorLow={cssColor(s.colorLow)}
        colorFor={bands ? (v) => cssColor(rangeFor(v, bands, edges)?.color) : undefined}
        valueFormat={fmt}
        legendFormat={compact}
        valueLabel={str(s.valueName) ?? m.value}
        showValues={s.valueLabels === 'value'}
        valueLabelStyle={valueLabelStyleOf(s)}
        cellGap={num(s.cellGap) ?? 2}
        cellRadius={num(s.cellRadius) ?? 3}
        showLegend={legend.showLegend}
        legendPosition={legend.legendPosition}
        legendItems={legendItems}
        showTooltip={s.showTooltip !== false}
        tickStyle={tickStyleOf(s)}
        animate={animateOf(s)}
        ariaLabel={m.heatmap}
      />
    </div>
  );
}

export const HEATMAP_VIEW: WidgetKindView = {
  View: HeatmapView,
  isEmpty: (data, settings) => cellsOf(data, settings).length === 0,
  toCsv: (data) => tableCsv(data.cells),
};
