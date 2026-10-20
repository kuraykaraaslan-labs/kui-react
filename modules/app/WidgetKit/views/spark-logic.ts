// The pure logic of the stat-with-trend widget (no React): the series' points, the change chip, the
// time-span text and the line's geometry in a 100 × 40 box. `StatSparklineView.tsx` draws it; kui-ejs and
// KUInative vendor this file so all three share one implementation.

import type { FontValue } from '../../SchemaForm/types';
import { cssColor, formatValue, rangeFor, type RangeEdges, type ValueFormat } from '../settings/style';
import type { SlotData } from '../kind';
import { DEFAULT_WIDGET_KIT_MESSAGES, type StatViewMessages } from '../messages';

export type StatSparklineSettings = {
  layout?: 'stacked' | 'value-top' | 'inline' | 'overlay' | 'chart-only';
  autoScale?: boolean;
  valueFont?: FontValue;
  valueColor?: string;
  label?: string;
  labelFont?: FontValue;
  labelColor?: string;
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  iconBackground?: string;
  curve?: 'smooth' | 'linear' | 'step';
  lineColor?: string;
  lineWidth?: number;
  fill?: 'none' | 'opacity' | 'gradient';
  fillOpacity?: number;
  showMinMax?: boolean;
  showLast?: boolean;
  ranges?: unknown;
  rangeEdges?: RangeEdges;
  rangeTarget?: 'value' | 'line' | 'both';
  showChange?: 'off' | 'percent' | 'delta';
  increaseIs?: 'good' | 'bad' | 'neutral';
  showArrow?: boolean;
  upColor?: string;
  downColor?: string;
  timeRange?: 'auto' | 'custom' | 'off';
  timeRangeText?: string;
  compareLabel?: string;
  showUpdated?: boolean;
};

export type TV = { t: number; v: number };

/** The first series' finite points in time order; non-finite points are dropped, not zeroed. */
export function sparkPoints(slot: SlotData | undefined, max = 500): TV[] {
  const first = slot?.series?.[0];
  if (!first) return [];
  const pts = first.points.filter((p) => Number.isFinite(p.v)).map((p) => ({ t: Date.parse(p.t), v: p.v }));
  // Sort only when every timestamp parses; otherwise the source's own order stands.
  if (pts.every((p) => Number.isFinite(p.t))) pts.sort((a, b) => a.t - b.t);
  return pts.length > max ? pts.slice(pts.length - max) : pts;
}

/** The first series' finite values in time order. */
export function sparkValues(slot: SlotData | undefined, max = 500): number[] {
  return sparkPoints(slot, max).map((p) => p.v);
}

export type Pt = { x: number; y: number };

/** The line's path in a 100 × 40 box. */
export function sparkPath(points: Pt[], curve: StatSparklineSettings['curve']): string {
  if (points.length === 0) return '';
  const f = (n: number) => n.toFixed(2);
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    if (curve === 'step') d += ` H${f(q.x)} V${f(q.y)}`;
    else if (curve === 'linear') d += ` L${f(q.x)} ${f(q.y)}`;
    else {
      const mx = (p.x + q.x) / 2;
      d += ` C${f(mx)} ${f(p.y)} ${f(mx)} ${f(q.y)} ${f(q.x)} ${f(q.y)}`;
    }
  }
  return d;
}

/** "12 h", "3 d", "45 min": the span the line covers; `texts` words it. */
export function spanText(
  ms: number,
  texts: Pick<StatViewMessages, 'spanMinutes' | 'spanHours' | 'spanDays'> = DEFAULT_WIDGET_KIT_MESSAGES.stat,
): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const min = ms / 60_000;
  if (min < 90) return texts.spanMinutes(Math.round(min));
  const h = min / 60;
  if (h < 48) return texts.spanHours(Math.round(h));
  return texts.spanDays(Math.round(h / 24));
}

export const W = 100;
export const H = 40;

export interface SparklineChange {
  text: string;
  direction: 'up' | 'down' | 'flat';
  meaning: 'good' | 'bad' | 'neutral';
  color?: string;
}

/** Everything the three renderers draw from, computed once. */
export function sparklineModel(
  s: StatSparklineSettings,
  format: ValueFormat,
  data: Record<string, SlotData | undefined>,
  locale: string | undefined,
  m: StatViewMessages = DEFAULT_WIDGET_KIT_MESSAGES.stat,
) {
  const points = sparkPoints(data.series);
  const values = points.map((p) => p.v);
  const last = values.length ? values[values.length - 1] : null;
  // A bound `compare` scalar (the same quantity over an earlier window) replaces "first point of the line" as the base.
  const compareValue = data.compare?.value;
  const compared = typeof compareValue === 'number' ? compareValue : typeof compareValue === 'string' && compareValue.trim() !== '' && Number.isFinite(Number(compareValue)) ? Number(compareValue) : null;
  const first = compared !== null ? compared : values.length > 1 ? values[0] : null;
  const layout = s.layout ?? 'stacked';
  const rangeColor = cssColor(rangeFor(last, s.ranges, s.rangeEdges ?? 'from')?.color);
  const target = s.rangeTarget ?? 'value';
  const lineColor = (target !== 'value' ? rangeColor : undefined) ?? cssColor(s.lineColor) ?? 'var(--primary)';
  const fillMode = s.fill ?? 'gradient';
  const fillOpacity = Math.min(100, Math.max(0, s.fillOpacity ?? 20)) / 100;
  const width = s.lineWidth ?? 2;

  // Change from the first to the last point, in Stat's change chip.
  const mode = s.showChange ?? 'percent';
  let change: SparklineChange | null = null;
  if (mode !== 'off' && last !== null && first !== null && !(mode === 'percent' && first === 0)) {
    const diff = last - first;
    const direction = diff > 0 ? 'up' as const : diff < 0 ? 'down' as const : 'flat' as const;
    const inc = s.increaseIs ?? 'neutral';
    const meaning = inc === 'neutral' || diff === 0 ? 'neutral' as const : (diff > 0) === (inc === 'good') ? 'good' as const : 'bad' as const;
    // Signed like Stat's change: +12.0 % / -3.9.
    const sign = diff > 0 ? '+' : '';
    const amount = mode === 'percent'
      ? `${sign}${formatValue((diff / Math.abs(first)) * 100, { decimals: 1 }, {}, locale)} %`
      : `${sign}${formatValue(diff, { ...format, unit: '' }, {}, locale)}`;
    change = {
      text: amount,
      direction: s.showArrow === false ? 'flat' : direction,
      meaning,
      color: meaning === 'good' ? cssColor(s.upColor) : meaning === 'bad' ? cssColor(s.downColor) : undefined,
    };
  }
  const span = points.length > 1 && Number.isFinite(points[0].t) ? spanText(points[points.length - 1].t - points[0].t, m) : null;
  const timeMode = s.timeRange ?? 'auto';
  const timeText = compared !== null
    ? (s.compareLabel || null)
    : timeMode === 'off' ? null : timeMode === 'custom' ? (s.timeRangeText || null) : span ? `${change ? 'over' : 'last'} ${span}` : null;

  // Points in the drawing box (y grows downwards; a flat line sits in the middle).
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = 3;
  const pts: Pt[] = values.map((v, i) => ({
    x: values.length === 1 ? W / 2 : (i / (values.length - 1)) * W,
    y: hi === lo ? H / 2 : pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2),
  }));
  const line = sparkPath(pts, s.curve ?? 'smooth');
  const area = fillMode !== 'none' && fillOpacity > 0 && pts.length > 1 ? `${line} L${W} ${H} L0 ${H} Z` : '';
  const iMin = values.indexOf(lo);
  const iMax = values.indexOf(hi);
  return {
    points, values, last, first, compared, layout, rangeColor, target, lineColor, fillMode, fillOpacity, width,
    change, span, timeText, lo, hi, pts, line, area, iMin, iMax,
  };
}
