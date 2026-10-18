'use client';
import { GaugeChart, type GaugeBand, type GaugeLayout } from '@/modules/ui/Chart/charts/GaugeChart';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle, formatValue, type ColorRange, type RangeEdges } from '../settings/style';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { IconTile, Metric, MetricHead, MetricLabel } from './ui';

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

type S = {
  layout?: GaugeLayout;
  label?: string;
  labelFont?: FontValue;
  labelColor?: string;
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  iconBackground?: string;
  startAngle?: number;
  endAngle?: number;
  min?: number;
  max?: number;
  showMinMax?: boolean;
  minMaxFont?: FontValue;
  minMaxColor?: string;
  ticks?: number;
  tickLabels?: boolean;
  tickColor?: string;
  showValue?: boolean;
  valueFont?: FontValue;
  valueColor?: string;
  unitTitle?: string;
  needle?: boolean;
  needleStyle?: 'line' | 'arrow' | 'marker';
  needleColor?: string;
  barColorMode?: 'range' | 'constant';
  barColor?: string;
  trackColor?: string;
  thickness?: number;
  roundedCaps?: boolean;
  ranges?: unknown;
  rangeEdges?: RangeEdges;
  rangeDisplay?: 'outer' | 'track' | 'off';
  rangeOpacity?: number;
  animation?: boolean;
};

/** Colour ranges → gauge bands. An open lower end starts where the previous range ended; an open upper end runs to the top. */
export function rangesToBands(ranges: unknown): GaugeBand[] {
  if (!Array.isArray(ranges)) return [];
  const out: GaugeBand[] = [];
  for (const r of ranges as ColorRange[]) {
    const color = cssColor(r?.color);
    if (!r || typeof r !== 'object' || !color) continue;
    out.push({
      ...(typeof r.from === 'number' ? { from: r.from } : {}),
      to: typeof r.to === 'number' ? r.to : Number.POSITIVE_INFINITY,
      color,
      ...(r.label ? { label: r.label } : {}),
    });
  }
  return out;
}

/**
 * `gauge`: one number on an arc, a donut, a bar or a level. A bound min / max wins over the typed
 * one. Label top-left and icon top-right as in every single-value widget; the number is the kit's
 * metric, sized to the gauge. The card dims a stale gauge (`$card.staleDisplay: 'dim'`).
 */
export function GaugeView({ settings, format, data, locale }: WidgetViewProps) {
  const m = useKitMessages().charts;
  const s = settings as S;
  const value = num(data.value?.value);
  const min = num(data.min?.value) ?? num(s.min) ?? 0;
  const rawMax = num(data.max?.value) ?? num(s.max) ?? 100;
  const max = rawMax > min ? rawMax : min + 1;
  const scaleFormat = { ...format, unit: undefined };
  const byRange = (s.barColorMode ?? 'range') === 'range';
  const display = s.rangeDisplay ?? 'outer';
  const bands = !byRange && display === 'off' ? [] : rangesToBands(s.ranges);
  const customFont = !!s.valueFont && Object.keys(s.valueFont).length > 0;

  const head = (
    <MetricHead
      label={s.label ? <MetricLabel font={s.labelFont} color={s.labelColor}>{s.label}</MetricLabel> : undefined}
      icon={s.icon ? <IconTile name={s.icon} size={Math.round((s.iconSize ?? 20) * 1.8)} color={s.iconColor} background={s.iconBackground} /> : undefined}
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      {head}
      <div className="min-h-0 w-full flex-1">
        <GaugeChart
          value={value}
          min={min}
          max={max}
          layout={s.layout ?? 'arc'}
          size="fill"
          bands={bands}
          bandEdges={s.rangeEdges ?? 'to'}
          bandDisplay={byRange ? (display === 'off' ? 'bar' : 'both') : 'track'}
          bandStyle={display === 'track' ? 'track' : 'outer'}
          bandOpacity={Math.min(100, Math.max(0, s.rangeOpacity ?? 35)) / 100}
          format={(v) => formatValue(v, format, {}, locale)}
          formatScale={(v) => formatValue(v, scaleFormat, {}, locale)}
          valueContent={
            <Metric
              text={value === null ? '—' : formatValue(value, scaleFormat, {}, locale)}
              unit={format.unit}
              unitPosition={format.unitPosition}
              font={customFont ? s.valueFont : undefined}
              color={cssColor(s.valueColor)}
              style={customFont && s.valueFont?.size ? undefined : { fontSize: '1em' }}
            />
          }
          label={s.unitTitle || undefined}
          needle={!!s.needle}
          needleStyle={s.needleStyle ?? 'line'}
          needleColor={cssColor(s.needleColor)}
          color={cssColor(s.barColor)}
          trackColor={cssColor(s.trackColor)}
          thickness={s.thickness ?? 14}
          roundedCaps={s.roundedCaps !== false}
          ticks={s.ticks ?? 0}
          tickLabels={!!s.tickLabels}
          tickColor={cssColor(s.tickColor)}
          showMinMax={s.showMinMax !== false}
          showValue={s.showValue !== false}
          startAngle={s.startAngle ?? -135}
          endAngle={s.endAngle ?? 135}
          animate={s.animation !== false}
          scaleStyle={fontStyle(s.minMaxFont)}
          scaleColor={cssColor(s.minMaxColor)}
          ariaLabel={s.label || s.unitTitle || m.gauge}
        />
      </div>
    </div>
  );
}

export const GAUGE_VIEW: WidgetKindView = {
  View: GaugeView,
  isEmpty: (data) => data.value?.value === undefined || data.value?.value === null || data.value?.value === '',
};
