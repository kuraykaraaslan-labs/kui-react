// The pure logic of the heatmap (no React): the cells, the colour bands and their legend entries, and every prop the
// ui HeatmapChart gets. Formatters are `NumberFormatSpec`s and the band colouring is the data `bands` + `bandEdges`
// (`heatColorFor` is the function). `HeatmapView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { SlotData } from '../kind';
import type { ChartViewMessages } from '../messages';
import { cssColor, rangeFor, type ColorRange, type RangeEdges, type ValueFormat } from '../settings/style';
import { numberFormatter, rowsToHeatCells } from './chart-data';
import { animateOf, compactSpec, formatSpec, legendProps, num, str, tickStyleOf, valueLabelStyleOf } from './chart-props-logic';

type S = Record<string, unknown>;
type Data = Record<string, SlotData | undefined>;
const col = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);

/** The cells the `cells` table slot describes under the settings. */
export const heatCells = (data: Data, s: S) => rowsToHeatCells(data.cells?.rows, {
  x: col(s.xColumn, 'x'), y: col(s.yColumn, 'y'), value: col(s.valueColumn, 'value'),
});

/** The colour a value gets from the bands (undefined = the gradient applies). */
export const heatColorFor = (bands: ColorRange[], edges: RangeEdges) => (v: number): string | undefined => cssColor(rangeFor(v, bands, edges)?.color);

/** Everything the heatmap draws. Empty = it draws nothing (an empty box). */
export function heatmapModel(s: S, format: ValueFormat, data: Data, locale: string | undefined, m: Pick<ChartViewMessages, 'all' | 'value' | 'heatmap'>) {
  const cells = heatCells(data, s);
  const legend = legendProps(s, 2);
  const compact = numberFormatter(compactSpec(format), locale);
  const bands = s.scale === 'bands' && Array.isArray(s.ranges) ? (s.ranges as ColorRange[]) : null;
  const bandEdges: RangeEdges = s.rangeEdges === 'to' ? 'to' : 'from';
  const legendItems = bands
    ? bands.flatMap((r) => {
      const c = cssColor(r?.color);
      if (!c) return [];
      const from = typeof r.from === 'number' ? compact(r.from) : '';
      const to = typeof r.to === 'number' ? compact(r.to) : '';
      return [{ color: c, label: r.label || (from && to ? `${from} – ${to}` : from ? `≥ ${from}` : to ? `< ${to}` : m.all) }];
    })
    : undefined;
  return {
    empty: cells.length === 0,
    cells,
    min: num(s.min),
    max: num(s.max),
    color: cssColor(s.color) ?? 'var(--primary)',
    colorLow: cssColor(s.colorLow),
    /** The colour bands (colour by `heatColorFor(bands, bandEdges)`), or null for the gradient. */
    bands,
    bandEdges,
    valueFormat: formatSpec(format),
    legendFormat: compactSpec(format),
    valueLabel: str(s.valueName) ?? m.value,
    showValues: s.valueLabels === 'value',
    valueLabelStyle: valueLabelStyleOf(s),
    cellGap: num(s.cellGap) ?? 2,
    cellRadius: num(s.cellRadius) ?? 3,
    showLegend: legend.showLegend,
    legendPosition: legend.legendPosition,
    legendItems,
    showTooltip: s.showTooltip !== false,
    tickStyle: tickStyleOf(s),
    animate: animateOf(s),
    ariaLabel: m.heatmap,
  };
}
