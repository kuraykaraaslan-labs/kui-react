'use client';
import { useMemo } from 'react';
import { HeatmapChart } from '@/modules/ui/Chart';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { numberFormatter, tableCsv } from './chart-data';
import { heatCells, heatColorFor, heatmapModel } from './heatmap-logic';

export * from './heatmap-logic';

/** `heatmap`: a colour grid; a low-to-high colour scale, or colour ranges (bands). */
export function HeatmapView({ settings, format, data, locale }: WidgetViewProps) {
  const m = useKitMessages().charts;
  const g = useMemo(() => heatmapModel(settings, format, data, locale, m), [settings, format, data, locale, m]);
  if (g.empty) return <div className="h-full" />;
  return (
    <div className="h-full min-h-0 w-full">
      <HeatmapChart
        cells={g.cells}
        fill
        min={g.min}
        max={g.max}
        color={g.color}
        colorLow={g.colorLow}
        colorFor={g.bands ? heatColorFor(g.bands, g.bandEdges) : undefined}
        valueFormat={numberFormatter(g.valueFormat, locale)}
        legendFormat={numberFormatter(g.legendFormat, locale)}
        valueLabel={g.valueLabel}
        showValues={g.showValues}
        valueLabelStyle={g.valueLabelStyle}
        cellGap={g.cellGap}
        cellRadius={g.cellRadius}
        showLegend={g.showLegend}
        legendPosition={g.legendPosition}
        legendItems={g.legendItems}
        showTooltip={g.showTooltip}
        tickStyle={g.tickStyle}
        animate={g.animate}
        ariaLabel={g.ariaLabel}
      />
    </div>
  );
}

export const HEATMAP_VIEW: WidgetKindView = {
  View: HeatmapView,
  isEmpty: (data, settings) => heatCells(data, settings).length === 0,
  toCsv: (data) => tableCsv(data.cells),
};
