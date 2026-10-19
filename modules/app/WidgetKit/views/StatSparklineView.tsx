'use client';
import { useId } from 'react';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, formatValue, rangeFor, type RangeEdges } from '../settings/style';
import type { SlotData, WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { DEFAULT_WIDGET_KIT_MESSAGES, type StatViewMessages } from '../messages';
import { Delta, IconTile, Meta, Metric, MetricHead, MetricLabel } from './ui';

type S = {
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
};

type TV = { t: number; v: number };

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

type Pt = { x: number; y: number };

/** The line's path in a 100 × 40 box. */
export function sparkPath(points: Pt[], curve: S['curve']): string {
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

const W = 100;
const H = 40;

/** `stat.sparkline`: Stat's label, icon, number and change, plus the trend line of the series. */
export function StatSparklineView({ settings, format, data, locale }: WidgetViewProps) {
  const s = settings as S;
  const m = useKitMessages().stat;
  const gid = `ks${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const points = sparkPoints(data.series);
  const values = points.map((p) => p.v);
  const last = values.length ? values[values.length - 1] : null;
  const first = values.length > 1 ? values[0] : null;
  const layout = s.layout ?? 'stacked';
  const rangeColor = cssColor(rangeFor(last, s.ranges, s.rangeEdges ?? 'from')?.color);
  const target = s.rangeTarget ?? 'value';
  const lineColor = (target !== 'value' ? rangeColor : undefined) ?? cssColor(s.lineColor) ?? 'var(--primary)';
  const fillMode = s.fill ?? 'gradient';
  const fillOpacity = Math.min(100, Math.max(0, s.fillOpacity ?? 20)) / 100;
  const width = s.lineWidth ?? 2;

  // Change from the first to the last point, in Stat's change chip.
  const mode = s.showChange ?? 'percent';
  let change: { text: string; direction: 'up' | 'down' | 'flat'; meaning: 'good' | 'bad' | 'neutral'; color?: string } | null = null;
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
  const timeText = timeMode === 'off' ? null : timeMode === 'custom' ? (s.timeRangeText || null) : span ? `${change ? 'over' : 'last'} ${span}` : null;

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
  // Markers are HTML dots over the stretched drawing so they stay round.
  const marker = (i: number, part: string, title: string) => (
    <span key={part} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-raised" data-part={part} title={title}
      style={{ left: `${(pts[i].x / W) * 100}%`, top: `${(pts[i].y / H) * 100}%`, background: lineColor }} />
  );

  const chart = (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 block h-full w-full overflow-visible"
        role="img" aria-label={m.trend(span, values.length, formatValue(first ?? last, format, {}, locale), formatValue(last, format, {}, locale))}>
        {fillMode === 'gradient' && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={fillOpacity} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        {area && (
          <path d={area} stroke="none" data-part="area"
            fill={fillMode === 'gradient' ? `url(#${gid})` : lineColor} fillOpacity={fillMode === 'gradient' ? undefined : fillOpacity} />
        )}
        {pts.length === 0 && (
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--border)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" data-part="baseline" />
        )}
        <path d={line} fill="none" stroke={lineColor} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke" data-part="line" />
      </svg>
      {s.showMinMax && pts.length > 2 && hi !== lo && [marker(iMin, 'min', m.min(formatValue(lo, format, {}, locale))), marker(iMax, 'max', m.max(formatValue(hi, format, {}, locale)))]}
      {s.showLast !== false && pts.length > 1 && marker(pts.length - 1, 'last', m.latest(formatValue(last, format, {}, locale)))}
    </div>
  );

  const label = s.label ? <MetricLabel font={s.labelFont} color={s.labelColor}>{s.label}</MetricLabel> : null;
  const icon = s.icon ? (
    <IconTile name={s.icon} size={Math.round((s.iconSize ?? 20) * 1.8)} background={s.iconBackground}
      color={(rangeColor && target !== 'line' ? rangeColor : undefined) ?? s.iconColor} />
  ) : null;
  const metric = (
    <span data-part="value">
      <Metric
        text={formatValue(last, { ...format, unit: '' }, {}, locale)}
        unit={format.unit}
        unitPosition={format.unitPosition}
        size={layout === 'inline' ? 'lg' : 'xl'}
        font={s.autoScale === false ? s.valueFont : undefined}
        color={(rangeColor && target !== 'line' ? rangeColor : undefined) ?? s.valueColor}
      />
    </span>
  );
  const delta = change ? (
    <span data-part="change"><Delta text={change.text} direction={change.direction} meaning={change.meaning} color={change.color} label={timeText ?? undefined} /></span>
  ) : timeText ? <Meta>{timeText}</Meta> : null;
  const numberBlock = (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">{metric}{delta}</div>
  );

  if (layout === 'chart-only') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <MetricHead label={label} icon={icon} />
        <div className="min-h-0 flex-1">{chart}</div>
      </div>
    );
  }
  if (layout === 'inline') {
    return (
      <div className="flex h-full min-h-0 items-end gap-4">
        <div className="flex min-w-0 shrink-0 flex-col gap-1.5 self-stretch">
          <MetricHead label={label} icon={null} />
          <div className="mt-auto flex flex-col gap-1.5">{metric}{delta}</div>
        </div>
        <div className="h-full max-h-24 min-w-0 flex-1 self-end">{chart}</div>
      </div>
    );
  }
  if (layout === 'overlay') {
    // The line fills the lower part of the card behind the number (Grafana's stat with graph).
    return (
      <div className="relative flex h-full min-h-0 flex-col gap-2">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-40">{chart}</div>
        <div className="relative"><MetricHead label={label} icon={icon} /></div>
        <div className="relative mt-auto flex flex-col gap-1.5">{metric}{delta}</div>
      </div>
    );
  }
  if (layout === 'value-top') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <MetricHead label={label} icon={icon} />
        {numberBlock}
        <div className="min-h-0 flex-1">{chart}</div>
      </div>
    );
  }
  // stacked: Stat's order (label, icon, number at the bottom) with the line between them.
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <MetricHead label={label} icon={icon} />
      <div className="min-h-6 flex-1">{chart}</div>
      <div className="shrink-0">{numberBlock}</div>
    </div>
  );
}

export const STAT_SPARKLINE_VIEW: WidgetKindView = {
  View: StatSparklineView,
  isEmpty: (data) => sparkValues(data.series).length === 0,
  emptyShape: true,
};
