// The pure logic of the gauge widget (no React): the scale, the colour ranges as bands and the props the gauge chart
// is drawn with. `GaugeView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { FontValue } from '../../SchemaForm/types';
import type { StyleRecord } from '../card-logic';
import type { SlotData } from '../kind';
import { cssColor, fontStyle, type ColorRange, type RangeEdges, type ValueFormat } from '../settings/style';

export type GaugeLayout = 'arc' | 'donut' | 'bar-horizontal' | 'bar-vertical' | 'level';
export type GaugeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type GaugeBand = { from?: number; to: number; tone?: GaugeTone; color?: string; label?: string };

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export type GaugeSettings = {
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


/** Everything the gauge widget draws, decided once: the chart's props, with the formatting left to the caller. */
export function gaugeModel(s: GaugeSettings, format: ValueFormat, data: Record<string, SlotData | undefined>) {
  const value = num(data.value?.value);
  const min = num(data.min?.value) ?? num(s.min) ?? 0;
  const rawMax = num(data.max?.value) ?? num(s.max) ?? 100;
  const max = rawMax > min ? rawMax : min + 1;
  const scaleFormat = { ...format, unit: undefined };
  const byRange = (s.barColorMode ?? 'range') === 'range';
  const display = s.rangeDisplay ?? 'outer';
  const bands = !byRange && display === 'off' ? [] : rangesToBands(s.ranges);
  const customFont = !!s.valueFont && Object.keys(s.valueFont).length > 0;
  return {
    value, min, max, scaleFormat, bands, customFont,
    head: {
      label: s.label ? { text: s.label, font: s.labelFont, color: s.labelColor } : null,
      tile: s.icon ? { name: s.icon, size: Math.round((s.iconSize ?? 20) * 1.8), color: s.iconColor, background: s.iconBackground } : null,
    },
    chart: {
      layout: s.layout ?? 'arc',
      bandEdges: s.rangeEdges ?? 'to',
      bandDisplay: byRange ? (display === 'off' ? 'bar' : 'both') : 'track',
      bandStyle: display === 'track' ? 'track' : 'outer',
      bandOpacity: Math.min(100, Math.max(0, s.rangeOpacity ?? 35)) / 100,
      label: s.unitTitle || undefined,
      needle: !!s.needle,
      needleStyle: s.needleStyle ?? 'line',
      needleColor: cssColor(s.needleColor),
      color: cssColor(s.barColor),
      trackColor: cssColor(s.trackColor),
      thickness: s.thickness ?? 14,
      roundedCaps: s.roundedCaps !== false,
      ticks: s.ticks ?? 0,
      tickLabels: !!s.tickLabels,
      tickColor: cssColor(s.tickColor),
      showMinMax: s.showMinMax !== false,
      showValue: s.showValue !== false,
      startAngle: s.startAngle ?? -135,
      endAngle: s.endAngle ?? 135,
      animate: s.animation !== false,
      scaleStyle: fontStyle(s.minMaxFont) as StyleRecord,
      scaleColor: cssColor(s.minMaxColor),
    },
    valueMetric: {
      text: (fmt: (v: number) => string) => (value === null ? '—' : fmt(value)),
      color: cssColor(s.valueColor),
      font: customFont ? s.valueFont : undefined,
      style: customFont && s.valueFont?.size ? undefined : { fontSize: '1em' } as StyleRecord,
    },
  };
}
