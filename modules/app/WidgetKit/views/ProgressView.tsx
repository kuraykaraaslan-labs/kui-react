'use client';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Progress, type ProgressMark, type ProgressSegment } from '@/modules/ui/Progress';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle, formatValue, rangeFor, type ColorRange, type RangeEdges } from '../settings/style';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { IconTile, Meta, Metric, MetricHead, MetricLabel } from './ui';

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

type S = {
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
function rangeSegments(ranges: unknown, target: number): ProgressSegment[] {
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

/**
 * `progress`: a bound number against a target, in Stat's order (label and icon on top, the number,
 * its meta, the bar). A bound target wins over the typed one. A zero or negative target has no
 * percentage: the number still shows, only the bar goes.
 */
export function ProgressView({ settings, format, data, locale }: WidgetViewProps) {
  const m = useKitMessages().stat;
  const s = settings as S;
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
  const custom = s.autoScale === false && s.valueFont && Object.keys(s.valueFont).length > 0;

  const metric = (size: 'xl' | 'lg' | 'md', style?: CSSProperties) => mode === 'none' ? null : (
    <span data-part="value">
      <Metric
        text={showsPercent ? formatValue(pct, { decimals: 0 }, {}, locale) : formatValue(value, bare, {}, locale)}
        unit={showsPercent ? '%' : format.unit}
        unitPosition={showsPercent ? 'after' : format.unitPosition}
        size={size}
        font={custom ? s.valueFont : undefined}
        color={s.valueColor}
        style={custom ? undefined : style}
      />
    </span>
  );
  const meta = secondary ? <Meta><span data-part="secondary">{secondary}</span></Meta> : null;
  const head = (
    <MetricHead
      label={s.label ? <MetricLabel font={s.labelFont} color={s.labelColor}>{s.label}</MetricLabel> : undefined}
      icon={s.icon ? <IconTile name={s.icon} size={Math.round((s.iconSize ?? 20) * 1.8)} color={s.iconColor ?? undefined} background={s.iconBackground} /> : undefined}
    />
  );

  if (layout === 'ring' || layout === 'semicircle') {
    const half = layout === 'semicircle';
    const t = Math.min(30, Math.max(2, thickness * 1.25));
    const ratio = half ? 100 / (50 + (rounded ? t / 2 : 0)) : 1;
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        {head}
        <div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
          <div className="relative" style={{ width: `min(100cqw, calc(100cqh * ${ratio.toFixed(4)}))`, aspectRatio: ratio.toFixed(4), containerType: 'inline-size' }}>
            <Progress
              shape={half ? 'semicircle' : 'circle'}
              value={pct ?? 0}
              diameter="fill"
              thickness={t}
              color={barColor}
              gradient={gradient}
              trackColor={trackColor}
              segments={segments}
              marks={marks}
              rounded={rounded}
              showLabel={mode !== 'none'}
              label={aria}
              labelContent={
                <span className={cn('flex flex-col items-center gap-1 leading-none', half && 'pb-[2%]')}>
                  {metric('xl', { fontSize: half ? 'clamp(1rem, 17cqw, 3rem)' : 'clamp(1rem, 19cqw, 3rem)' })}
                  {meta}
                </span>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  const bar = pct !== null ? (
    <Progress value={pct} color={barColor} gradient={gradient} trackColor={trackColor} thickness={thickness} rounded={rounded}
      segments={segments} marks={marks} label={aria} className="min-w-0 flex-1" />
  ) : null;
  const tickN = Math.max(0, Math.min(11, s.tickCount ?? 0));
  const scale: ReactNode = s.showTicks && pct !== null && targetStr !== null ? (
    <div className="relative mt-1 h-3 text-[11px] leading-none tabular-nums text-text-secondary" style={fontStyle(s.ticksFont, s.ticksColor)} data-part="ticks">
      <span className="absolute left-0">{formatValue(0, format, {}, locale)}</span>
      {tickN > 0 && Array.from({ length: tickN }, (_, i) => (i + 1) / (tickN + 1)).map((f) => (
        <span key={f} className="absolute -translate-x-1/2" style={{ left: `${f * 100}%` }}>{formatValue((target as number) * f, format, {}, locale)}</span>
      ))}
      <span className="absolute right-0">{targetStr}</span>
    </div>
  ) : null;

  if (layout === 'bar') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2" data-layout="bar">
        {head}
        <div className="mt-auto flex flex-col gap-1">
          <div className="flex items-center gap-3">
            {bar}
            {metric('lg')}
          </div>
          {scale}
          {meta}
        </div>
      </div>
    );
  }

  const text = (mode !== 'none' || meta) ? (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">{metric('xl')}{meta}</div>
  ) : null;
  const below = s.textPosition === 'below';
  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-layout="bar-labelled">
      {head}
      <div className="mt-auto flex flex-col gap-2.5">
        {!below && text}
        {bar && <div className="flex flex-col">{bar}{scale}</div>}
        {below && text}
      </div>
    </div>
  );
}

export const PROGRESS_VIEW: WidgetKindView = {
  View: ProgressView,
  isEmpty: (data) => num(data.value?.value) === null,
};
