// The pure logic of the progress widget (no React): the number against its target, the colour ranges as track
// segments, the marker, the texts and the scale. `ProgressView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { FontValue } from '../../SchemaForm/types';
import type { StyleRecord } from '../card-logic';
import type { SlotData } from '../kind';
import type { StatViewMessages } from '../messages';
import { cssColor, fontStyle, formatValue, rangeFor, type ColorRange, type RangeEdges, type ValueFormat } from '../settings/style';

export type ProgressSegment = { from: number; to: number; color: string };
export type ProgressMark = { at: number; color?: string; label?: string };

export const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export type ProgressSettings = {
  layout?: 'bar-labelled' | 'bar' | 'ring' | 'semicircle';
  target?: number;
  label?: string;
  labelFont?: FontValue;
  labelColor?: string;
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  iconBackground?: string;
  valueText?: 'value' | 'percent' | 'both' | 'none';
  textPosition?: 'above' | 'below';
  autoScale?: boolean;
  valueFont?: FontValue;
  valueColor?: string;
  barColor?: string;
  barGradient?: boolean;
  gradientStart?: string;
  trackColor?: string;
  thickness?: number;
  roundedEnds?: boolean;
  ranges?: unknown;
  rangeEdges?: RangeEdges;
  rangeDisplay?: 'bar' | 'track' | 'both';
  showTicks?: boolean;
  tickCount?: number;
  ticksFont?: FontValue;
  ticksColor?: string;
  marker?: number | null;
  markerLabel?: string;
  markerColor?: string;
};

/** Colour ranges on the value → segments in percent of the target. */
export function rangeSegments(ranges: unknown, target: number): ProgressSegment[] {
  if (!Array.isArray(ranges) || target <= 0) return [];
  let prev = 0;
  return (ranges as ColorRange[]).flatMap((r) => {
    const color = cssColor(r?.color);
    if (!r || !color) return [];
    const from = typeof r.from === 'number' ? (r.from / target) * 100 : prev;
    const to = typeof r.to === 'number' ? (r.to / target) * 100 : 100;
    prev = to;
    return to > from ? [{ from, to, color }] : [];
  });
}


/** Everything the progress widget draws, decided once. */
export function progressModel(s: ProgressSettings, format: ValueFormat, data: Record<string, SlotData | undefined>, locale: string | undefined, m: StatViewMessages) {
  const value = num(data.value?.value);
  const target = num(data.target?.value) ?? num(s.target);
  const pct = value !== null && target !== null && target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : null;
  const layout = s.layout ?? 'bar-labelled';
  const mode = s.valueText ?? 'value';
  const rangeDisplay = s.rangeDisplay ?? 'bar';
  const rangeHit = cssColor(rangeFor(value, s.ranges, s.rangeEdges ?? 'from')?.color);
  const barColor = (rangeDisplay !== 'track' ? rangeHit : undefined) ?? cssColor(s.barColor) ?? 'var(--primary)';
  const gradient: [string, string] | undefined = s.barGradient ? [cssColor(s.gradientStart) ?? 'var(--info)', barColor] : undefined;
  const trackColor = cssColor(s.trackColor) ?? 'var(--border)';
  const thickness = s.thickness ?? 8;
  const rounded = s.roundedEnds !== false;
  const segments = rangeDisplay !== 'bar' && target !== null ? rangeSegments(s.ranges, target) : [];
  const markerAt = typeof s.marker === 'number' && target !== null && target > 0 ? (s.marker / target) * 100 : null;
  const marks: ProgressMark[] = markerAt !== null
    ? [{ at: markerAt, color: cssColor(s.markerColor) ?? 'var(--text-primary)', label: s.markerLabel || formatValue(s.marker, format, {}, locale) }]
    : [];

  const bare = { ...format, unit: '' };
  const valueStr = formatValue(value, format, {}, locale);
  const targetStr = target !== null ? formatValue(target, format, {}, locale) : null;
  const pctStr = pct !== null ? `${formatValue(pct, { decimals: 0 }, {}, locale)} %` : null;
  const showsPercent = mode === 'percent' && pctStr !== null;
  const secondary = mode === 'none' ? null
    : mode === 'percent' ? (targetStr !== null ? m.of(targetStr) : null)
      : [targetStr !== null ? m.of(targetStr) : null, mode === 'both' ? pctStr : null].filter(Boolean).join(' · ') || null;
  const aria = m.progress(valueStr, targetStr, pctStr);
  const custom = !!(s.autoScale === false && s.valueFont && Object.keys(s.valueFont).length > 0);
  const hasTarget = target !== null && target > 0;
  const tickN = Math.max(0, Math.min(11, s.tickCount ?? 0));

  /** The number's look for a size (the metric block). */
  const metric = mode === 'none' ? null : {
    text: showsPercent ? formatValue(pct, { decimals: 0 }, {}, locale) : formatValue(value, bare, {}, locale),
    unit: showsPercent ? '%' : value === null ? undefined : format.unit,
    unitPosition: showsPercent ? 'after' as const : format.unitPosition,
    font: custom ? s.valueFont : undefined,
    color: s.valueColor,
    custom,
  };
  const half = layout === 'semicircle';
  const t = Math.min(30, Math.max(2, thickness * 1.25));
  const ratio = half ? 100 / (50 + (rounded ? t / 2 : 0)) : 1;
  return {
    layout, mode, value, target, pct, barColor, gradient, trackColor, thickness, rounded, segments, marks, aria, hasTarget,
    metric, secondary, showTicks: !!s.showTicks && hasTarget && targetStr !== null, targetStr,
    ticks: Array.from({ length: tickN }, (_, i) => (i + 1) / (tickN + 1)).map((f) => ({ left: `${f * 100}%`, text: target === null ? '' : formatValue(target * f, format, {}, locale) })),
    zeroText: formatValue(0, format, {}, locale),
    ticksStyle: fontStyle(s.ticksFont, s.ticksColor) as StyleRecord,
    label: s.label ? { text: s.label, font: s.labelFont, color: s.labelColor } : null,
    tile: s.icon ? { name: s.icon, size: Math.round((s.iconSize ?? 20) * 1.8), color: s.iconColor ?? undefined, background: s.iconBackground } : null,
    ring: { half, thickness: t, ratio, ratioText: ratio.toFixed(4), valueFontSize: half ? 'clamp(1rem, 17cqw, 3rem)' : 'clamp(1rem, 19cqw, 3rem)' },
    below: s.textPosition === 'below',
  };
}
