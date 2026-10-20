'use client';
import type { CSSProperties } from 'react';
import { GaugeChart } from '@/modules/ui/Chart/charts/GaugeChart';
import { formatValue } from '../settings/style';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { IconTile, Metric, MetricHead, MetricLabel } from './ui';
import { gaugeModel, type GaugeSettings as S } from './gauge-logic';

export * from './gauge-logic';

/**
 * `gauge`: one number on an arc, a donut, a bar or a level. A bound min / max wins over the typed
 * one. Label top-left and icon top-right as in every single-value widget; the number is the kit's
 * metric, sized to the gauge. The card dims a stale gauge (`$card.staleDisplay: 'dim'`).
 */
export function GaugeView({ settings, format, data, locale }: WidgetViewProps) {
  const m = useKitMessages().charts;
  const s = settings as S;
  const g = gaugeModel(s, format, data);
  const { value, min, max, scaleFormat, bands, head, chart } = g;
  const fmtScale = (v: number) => formatValue(v, scaleFormat, {}, locale);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      <MetricHead
        label={head.label ? <MetricLabel font={head.label.font} color={head.label.color}>{head.label.text}</MetricLabel> : undefined}
        icon={head.tile ? <IconTile name={head.tile.name} size={head.tile.size} color={head.tile.color} background={head.tile.background} /> : undefined}
      />
      <div className="min-h-0 w-full flex-1">
        <GaugeChart
          value={value}
          min={min}
          max={max}
          layout={chart.layout}
          size="fill"
          bands={bands}
          bandEdges={chart.bandEdges}
          bandDisplay={chart.bandDisplay as 'both' | 'bar' | 'track'}
          bandStyle={chart.bandStyle as 'outer' | 'track'}
          bandOpacity={chart.bandOpacity}
          format={(v) => formatValue(v, format, {}, locale)}
          formatScale={fmtScale}
          valueContent={
            <Metric
              text={g.valueMetric.text(fmtScale)}
              unit={value === null ? undefined : format.unit}
              unitPosition={format.unitPosition}
              font={g.valueMetric.font}
              color={g.valueMetric.color}
              style={g.valueMetric.style as CSSProperties | undefined}
            />
          }
          label={chart.label}
          needle={chart.needle}
          needleStyle={chart.needleStyle}
          needleColor={chart.needleColor}
          color={chart.color}
          trackColor={chart.trackColor}
          thickness={chart.thickness}
          roundedCaps={chart.roundedCaps}
          ticks={chart.ticks}
          tickLabels={chart.tickLabels}
          tickColor={chart.tickColor}
          showMinMax={chart.showMinMax}
          showValue={chart.showValue}
          startAngle={chart.startAngle}
          endAngle={chart.endAngle}
          animate={chart.animate}
          scaleStyle={chart.scaleStyle as CSSProperties}
          scaleColor={chart.scaleColor}
          ariaLabel={s.label || s.unitTitle || m.gauge}
        />
      </div>
    </div>
  );
}

export const GAUGE_VIEW: WidgetKindView = {
  View: GaugeView,
  isEmpty: (data) => data.value?.value === undefined || data.value?.value === null || data.value?.value === '',
  emptyShape: true,
};
