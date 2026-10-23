'use client';
import { useMemo } from 'react';
import { PieChart, type PieSlice } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { numberFormatter, tableCsv } from './chart-data';
import { useBoxSize } from './chart-props';
import { pieChartModel, pieSliceRows, pieSlices } from './pie-chart-logic';

export * from './pie-chart-logic';

/**
 * `chart.pie`: slices from a bound table; pie, donut or donut with the total in the centre. The
 * legend in `auto` sits to the right when the card is wide and below it, in tidy columns, when not.
 * With `onSliceClick` the slices are buttons: a click (Enter, Space) reports the table row the slice
 * came from, the folded "Other" slice its aggregate.
 */
export function PieChartView({ settings, format, data, locale, onSliceClick }: WidgetViewProps) {
  const m = useKitMessages().charts;
  const [ref, box] = useBoxSize();
  const model = useMemo(() => pieChartModel(settings, format, data, m, box), [settings, format, data, m, box]);
  // The rows are looked up only when a host listens: the model (and its golden) stays the same without the prop.
  const rows = useMemo(() => (onSliceClick ? pieSliceRows(data, settings, m.other) : null), [onSliceClick, data, settings, m.other]);
  const sliceClick = useMemo(() => (onSliceClick && rows ? (slice: PieSlice) => { const row = rows[slice.index]; if (row) onSliceClick(row); } : undefined), [onSliceClick, rows]);
  if (model.empty) {
    return (
      <div ref={ref} className="h-full min-h-0 w-full">
        <PieChart {...model.chart} fill />
      </div>
    );
  }
  const { valueFormat, ...chart } = model.chart;
  return (
    <div ref={ref} className="h-full min-h-0 w-full">
      <PieChart {...chart} fill valueFormat={numberFormatter(valueFormat, locale)} onSliceClick={sliceClick} />
    </div>
  );
}

export const CHART_PIE_VIEW: WidgetKindView = {
  View: PieChartView,
  isEmpty: (data, settings) => pieSlices(data, settings) === null,
  toCsv: (data) => tableCsv(data.slices),
  emptyShape: true,
};
