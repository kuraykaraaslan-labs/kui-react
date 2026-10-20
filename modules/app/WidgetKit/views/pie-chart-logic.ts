// The pure logic of chart.pie (no React): the slices, and every prop the ui PieChart gets, with the value formatter as a
// `NumberFormatSpec`. `PieChartView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { Series } from '@/modules/ui/Chart';
import type { SlotData } from '../kind';
import type { ChartViewMessages } from '../messages';
import type { ValueFormat } from '../settings/style';
import { rowsToPieSeries, type NumberFormatSpec } from './chart-data';
import { animateOf, formatSpec, legendProps, num, str, textStyleOf } from './chart-props-logic';

type S = Record<string, unknown>;
type Data = Record<string, SlotData | undefined>;

const col = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);
type PieLabels = 'none' | 'percent' | 'value' | 'name' | 'name-percent';
const LABELS = new Set(['none', 'percent', 'value', 'name', 'name-percent']);

/** The slices the `slices` table slot describes under the settings, or null when there are none. */
export const pieSlices = (data: Data, s: S, other?: string): Series[] | null => rowsToPieSeries(data.slices?.rows, {
  label: col(s.labelColumn, 'label'),
  value: col(s.valueColumn, 'value'),
  max: typeof s.maxSlices === 'number' ? s.maxSlices : 8,
  sort: s.sort === 'asc' || s.sort === 'none' ? s.sort : 'desc',
  otherLabel: typeof s.otherLabel === 'string' && s.otherLabel ? s.otherLabel : other,
  colors: s.colors,
});

/** No data draws the empty shape: one grey slice, without labels, legend, tooltip or a made-up total. */
export const EMPTY_PIE: Series[] = [{ id: 'empty', name: '', data: [{ x: '', y: 1, color: 'var(--border)' }] }];

/** The card body's measured size. */
export type BoxSize = { width: number; height: number };

/** Is the card wide enough for a legend at the right? (300 px and 1.45 times as wide as high.) */
export const pieIsWide = (box: BoxSize | undefined) => !!box && box.width > 0 && box.width >= box.height * 1.45 && box.width >= 300;

/**
 * Everything chart.pie draws. The legend in `auto` sits to the right when the card is `wide` (see `pieIsWide`) and
 * below it, in tidy columns, when not; `box` is the card body's measured size when the platform knows it.
 */
export function pieChartModel(s: S, format: ValueFormat, data: Data, m: Pick<ChartViewMessages, 'other' | 'total' | 'pieChart'>, box?: BoxSize) {
  const series = pieSlices(data, s, m.other);
  const layout = s.layout === 'donut' || s.layout === 'donut-total' ? s.layout : 'pie';
  const ring = num(s.donutWidth) ?? 40;
  const innerRadius = layout === 'pie' ? 0 : 1 - ring / 100;
  if (!series) {
    return {
      empty: true as const, layout,
      chart: {
        series: EMPTY_PIE, innerRadius, sliceGap: 0, labels: 'none' as const,
        showLegend: false, showTooltip: false, showCenter: false, animate: false, ariaLabel: m.pieChart,
      },
    };
  }
  const legend = legendProps(s, series[0]?.data.length ?? 0);
  const position = s.legend === 'auto' || s.legend === undefined ? (pieIsWide(box) ? 'right' : 'bottom') : legend.legendPosition;
  return {
    empty: false as const, layout,
    chart: {
      series,
      innerRadius,
      showCenter: layout === 'donut-total',
      centerLabel: str(s.totalLabel) ?? (layout === 'donut-total' ? m.total : undefined),
      labels: (LABELS.has(String(s.valueLabels)) ? (s.valueLabels as PieLabels) : 'percent'),
      labelPosition: s.labelPosition === 'outside' ? 'outside' as const : 'inside' as const,
      labelStyle: textStyleOf(s.labelFont, s.labelColor),
      valueFormat: formatSpec(format) as NumberFormatSpec,
      startAngle: num(s.startAngle) ?? 0,
      sliceGap: num(s.sliceGap) ?? 2,
      showLegend: legend.showLegend,
      legendPosition: position,
      legendLayout: position === 'top' || position === 'bottom' ? 'grid' as const : 'wrap' as const,
      legendStyle: legend.legendStyle,
      legendToggle: true,
      legendValue: s.legendValue === 'value' || s.legendValue === 'percent' ? (s.legendValue as 'value' | 'percent') : 'none' as const,
      showTooltip: s.showTooltip !== false,
      tooltipValue: s.tooltipValue === 'value' || s.tooltipValue === 'percent' ? (s.tooltipValue as 'value' | 'percent') : 'both' as const,
      animate: animateOf(s),
      ariaLabel: m.pieChart,
    },
  };
}
