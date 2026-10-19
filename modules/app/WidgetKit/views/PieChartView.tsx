'use client';
import { useMemo } from 'react';
import { PieChart } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { formatValue } from '../settings/style';
import { rowsToPieSeries, tableCsv } from './chart-data';
import { animateOf, legendProps, num, str, textStyleOf, useBoxSize } from './chart-props';

type S = Record<string, unknown>;
const col = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);
const LABELS = new Set(['none', 'percent', 'value', 'name', 'name-percent']);

const slicesOf = (data: WidgetViewProps['data'], s: S, other?: string) => rowsToPieSeries(data.slices?.rows, {
  label: col(s.labelColumn, 'label'),
  value: col(s.valueColumn, 'value'),
  max: typeof s.maxSlices === 'number' ? s.maxSlices : 8,
  sort: s.sort === 'asc' || s.sort === 'none' ? s.sort : 'desc',
  otherLabel: typeof s.otherLabel === 'string' && s.otherLabel ? s.otherLabel : other,
  colors: s.colors,
});

const EMPTY_PIE = [{ id: 'empty', name: '', data: [{ x: '', y: 1, color: 'var(--border)' }] }];

/**
 * `chart.pie`: slices from a bound table; pie, donut or donut with the total in the centre. The
 * legend in `auto` sits to the right when the card is wide and below it, in tidy columns, when not.
 */
export function PieChartView({ settings, format, data, locale }: WidgetViewProps) {
  const s = settings;
  const m = useKitMessages().charts;
  const series = useMemo(() => slicesOf(data, s, m.other), [data, s, m.other]);
  const [ref, box] = useBoxSize();
  const legend = legendProps(s, series?.[0]?.data.length ?? 0);
  const layout = s.layout === 'donut' || s.layout === 'donut-total' ? s.layout : 'pie';
  const ring = num(s.donutWidth) ?? 40;
  // No data draws the empty shape: one grey slice, without labels, legend, tooltip or a made-up total.
  if (!series) {
    return (
      <div ref={ref} className="h-full min-h-0 w-full">
        <PieChart series={EMPTY_PIE} fill innerRadius={layout === 'pie' ? 0 : 1 - ring / 100} sliceGap={0} labels="none"
          showLegend={false} showTooltip={false} showCenter={false} animate={false} ariaLabel={m.pieChart} />
      </div>
    );
  }
  const wide = box.width > 0 && box.width >= box.height * 1.45 && box.width >= 300;
  const position = s.legend === 'auto' || s.legend === undefined ? (wide ? 'right' : 'bottom') : legend.legendPosition;
  const labels = LABELS.has(String(s.valueLabels)) ? (s.valueLabels as 'none') : 'percent';
  return (
    <div ref={ref} className="h-full min-h-0 w-full">
      <PieChart
        series={series}
        fill
        innerRadius={layout === 'pie' ? 0 : 1 - ring / 100}
        showCenter={layout === 'donut-total'}
        centerLabel={str(s.totalLabel) ?? (layout === 'donut-total' ? m.total : undefined)}
        labels={labels}
        labelPosition={s.labelPosition === 'outside' ? 'outside' : 'inside'}
        labelStyle={textStyleOf(s.labelFont, s.labelColor)}
        valueFormat={(v) => formatValue(v, format, {}, locale)}
        startAngle={num(s.startAngle) ?? 0}
        sliceGap={num(s.sliceGap) ?? 2}
        showLegend={legend.showLegend}
        legendPosition={position}
        legendLayout={position === 'top' || position === 'bottom' ? 'grid' : 'wrap'}
        legendStyle={legend.legendStyle}
        legendToggle
        legendValue={s.legendValue === 'value' || s.legendValue === 'percent' ? s.legendValue : 'none'}
        showTooltip={s.showTooltip !== false}
        tooltipValue={s.tooltipValue === 'value' || s.tooltipValue === 'percent' ? s.tooltipValue : 'both'}
        animate={animateOf(s)}
        ariaLabel={m.pieChart}
      />
    </div>
  );
}

export const CHART_PIE_VIEW: WidgetKindView = {
  View: PieChartView,
  isEmpty: (data, settings) => slicesOf(data, settings) === null,
  toCsv: (data) => tableCsv(data.slices),
  emptyShape: true,
};
