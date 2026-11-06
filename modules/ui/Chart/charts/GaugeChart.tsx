'use client';
// Gauge with threshold bands, centred value and optional needle
// (docs/phases/09-data-and-realtime-components.md §9.3). `role="meter"`.
//
// Layouts: `arc` (half circle, the original look), `donut` (an arc between two free angles),
// `bar-horizontal`, `bar-vertical` and `level` (a thermometer: a tube with a bulb). Every colour is
// a CSS colour or a theme token supplied by the caller; the defaults are theme tokens.
//
// The arc is drawn in SVG; every text (the value, min / max, tick labels, the caption) is HTML laid
// over it, so text keeps the kit's type sizes instead of growing and shrinking with the drawing.
// The drawing's box is cropped to the arc, so labels sit right at its ends.
//
// A value off the scale is never drawn past an end: the bar and the needle stop there, and a note under
// the value says which side it left by ("Above the scale"); the meter's text says it too.

import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { animationDuration } from '../theme';

export type GaugeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export type GaugeLayout = 'arc' | 'donut' | 'bar-horizontal' | 'bar-vertical' | 'level';

/**
 * A band of the scale. `to` is its upper end; `from` defaults to the previous band's `to` (or the
 * minimum). `color` (any CSS colour or token) wins over `tone`. `label` names the band in the
 * meter's accessible text.
 */
export type GaugeBand = { from?: number; to: number; tone?: GaugeTone; color?: string; label?: string };

export type GaugeChartProps = {
  value: number | null | undefined;
  min?: number;
  max?: number;
  /** Threshold bands, ascending by `to`. */
  bands?: GaugeBand[];
  /**
   * Which band a value exactly on a boundary belongs to. 'to' (default, the original rule):
   * `from < v <= to`; 'from': `from <= v < to`.
   */
  bandEdges?: 'from' | 'to';
  /**
   * Where bands show. 'both' (default): bands are drawn on the scale and the bar takes the band's
   * colour. 'bar': only the bar takes the band's colour. 'track': bands on the scale, the bar
   * keeps `color`.
   */
  bandDisplay?: 'both' | 'bar' | 'track';
  /** How bands are drawn on the scale: a thin full-colour ring outside the bar (default) or tinted track. */
  bandStyle?: 'outer' | 'track';
  /** Opacity of bands drawn on the track, 0–1. Default 0.35. */
  bandOpacity?: number;
  unit?: string;
  /** A caption under the value (a units title such as "Temperature"). */
  label?: string;
  format?: (v: number) => string;
  /** Formats the min / max and tick labels. Default: the raw number. */
  formatScale?: (v: number) => string;
  /** Replaces the value text (e.g. a styled metric sized `1em`: it inherits the gauge-relative size); `format` still feeds the accessible text. */
  valueContent?: ReactNode;
  needle?: boolean;
  /** 'line' from the centre (default), 'arrow' (a tapered pointer) or 'marker' (a notch outside the scale). */
  needleStyle?: 'line' | 'arrow' | 'marker';
  needleColor?: string;
  size?: 'sm' | 'md' | 'lg' | 'fill';
  layout?: GaugeLayout;
  /** Bar colour when no band colours it. Default `var(--primary)`. */
  color?: string;
  /** Track (unfilled part) colour. Default `var(--border)`. */
  trackColor?: string;
  /** Arc stroke in drawing units (the arc is 160 across), bar thickness in px. Default 16. */
  thickness?: number;
  roundedCaps?: boolean;
  /** Evenly spaced tick marks, ends included; 0 or 1 = none. */
  ticks?: number;
  /** Write the scale value at each tick. */
  tickLabels?: boolean;
  tickColor?: string;
  showMinMax?: boolean;
  showValue?: boolean;
  /** Donut only: start / end angle in degrees, clockwise from 12 o'clock. Default -135 / 135. */
  startAngle?: number;
  endAngle?: number;
  /** Animate value changes (still off under reduced motion). Default true. */
  animate?: boolean;
  /** Extra style for the value text (font size, weight, …). */
  valueStyle?: CSSProperties;
  valueColor?: string;
  /** Extra style for the min / max and tick labels. */
  scaleStyle?: CSSProperties;
  scaleColor?: string;
  ariaLabel?: string;
  /** Dim the arc and show a hint: the value is older than the consumer allows. */
  stale?: boolean;
  staleLabel?: string;
  /** The note under the value while it is over `max` (the bar stops at the end). Default 'Above the scale'. */
  aboveScaleLabel?: string;
  /** The note under the value while it is under `min`. Default 'Below the scale'. */
  belowScaleLabel?: string;
  /** A line under that note while the value is off the scale, e.g. where the scale is set. */
  offScaleHint?: string;
  className?: string;
};

const TONE_COLOR: Record<GaugeTone, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  info: 'var(--info)',
  neutral: 'var(--text-disabled, var(--border-strong))',
};

const SIZE_PX: Record<Exclude<NonNullable<GaugeChartProps['size']>, 'fill'>, number> = { sm: 140, md: 200, lg: 280 };

const CX = 100;
const CY = 100;
const R = 80;
const STROKE = 16;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Point at `deg` (clockwise from 12 o'clock) on a circle around the gauge centre. */
function polar(deg: number, radius = R): { x: number; y: number } {
  return { x: CX + radius * Math.sin(rad(deg)), y: CY - radius * Math.cos(rad(deg)) };
}

/** SVG arc between two angles (clockwise). A full turn is drawn as two halves. */
function anglePath(a0: number, a1: number, radius = R): string {
  const sweep = Math.min(360, Math.max(0, a1 - a0));
  if (sweep >= 359.99) return `${anglePath(a0, a0 + 180, radius)} ${anglePath(a0 + 180, a0 + 360, radius).replace(/^M[^A]+/, '')}`;
  const a = polar(a0, radius);
  const b = polar(a0 + sweep, radius);
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** SVG arc path between two fractions of the half circle. */
export function arcPath(from: number, to: number): string {
  const f = Math.max(0, Math.min(1, from));
  const t = Math.max(0, Math.min(1, to));
  return anglePath(-90 + 180 * f, -90 + 180 * t);
}

const bandColor = (b: GaugeBand) => b.color ?? TONE_COLOR[b.tone ?? 'neutral'];

/**
 * Which band a value falls in. Without any `from`, the original rule: the first band whose `to`
 * it does not exceed, else the last. With `from`, `edges` decides the boundaries and a value in
 * no band has none.
 */
export function bandFor(value: number, bands: GaugeBand[] | undefined, edges: 'from' | 'to' = 'to'): GaugeBand | null {
  if (!bands || bands.length === 0) return null;
  const legacy = bands.every((b) => b.from === undefined);
  if (legacy && edges === 'to') return bands.find((b) => value <= b.to) ?? bands[bands.length - 1];
  let prev: number | undefined;
  for (const b of bands) {
    const from = b.from ?? prev;
    prev = b.to;
    const aboveFrom = from === undefined || (edges === 'from' ? value >= from : value > from);
    const belowTo = edges === 'from' ? value < b.to : value <= b.to;
    if (aboveFrom && belowTo) return b;
  }
  return legacy ? bands[bands.length - 1] : null;
}

/** The drawing's bounding box for an arc between two angles, with everything drawn around it. */
function arcBox(a0: number, a1: number, rOut: number, rIn: number, extra: Array<{ x: number; y: number }>) {
  const pts = [...extra];
  for (let a = a0; a < a1; a += 2) pts.push(polar(a, rOut), polar(a, rIn));
  pts.push(polar(a1, rOut), polar(a1, rIn));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 2;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

const pctOf = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;

export function GaugeChart({
  value, min = 0, max = 100, bands, bandEdges = 'to', bandDisplay = 'both', bandStyle = 'outer', bandOpacity = 0.35,
  unit, label, format, formatScale, valueContent, needle = false, needleStyle = 'line', needleColor, size = 'md', layout = 'arc',
  color, trackColor, thickness = STROKE, roundedCaps = false, ticks = 0, tickLabels = false, tickColor, showMinMax = true,
  showValue = true, startAngle = -135, endAngle = 135, animate = true, valueStyle, valueColor, scaleStyle, scaleColor,
  ariaLabel, stale = false, staleLabel = 'stale', aboveScaleLabel = 'Above the scale', belowScaleLabel = 'Below the scale',
  offScaleHint, className,
}: GaugeChartProps) {
  const span = max - min || 1;
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const clamped = hasValue ? Math.min(max, Math.max(min, value)) : min;
  const offScale = hasValue ? (value > max ? 'above' : value < min ? 'below' : null) : null;
  const offScaleText = offScale === 'above' ? aboveScaleLabel : offScale === 'below' ? belowScaleLabel : undefined;
  const fraction = (clamped - min) / span;
  const band = hasValue ? bandFor(value, bands, bandEdges) : null;
  const baseColor = color ?? 'var(--primary)';
  const barColor = band && bandDisplay !== 'track' ? bandColor(band) : baseColor;
  const animMs = animate ? animationDuration(400) : 0;
  const text = hasValue ? (format ? format(value) : String(Math.round(value * 100) / 100)) : '—';
  const bandName = band ? band.label || band.tone : undefined;
  const scaleText = (v: number) => (formatScale ? formatScale(v) : String(v));
  const track = trackColor ?? 'var(--border)';
  const needleFill = needleColor ?? 'var(--text-primary)';
  const ticksStroke = tickColor ?? 'var(--border-strong)';

  const segments = useMemo(() => {
    if (!bands || bands.length === 0 || bandDisplay === 'bar') return [];
    let prev = 0;
    return bands.map((b) => {
      const from = b.from !== undefined ? Math.min(1, Math.max(0, (b.from - min) / span)) : prev;
      const to = Math.min(1, Math.max(0, (b.to - min) / span));
      prev = Math.max(prev, to);
      return { from, to, color: bandColor(b) };
    }).filter((s) => s.to > s.from);
  }, [bands, bandDisplay, min, span]);

  const tickFractions = ticks >= 2 ? Array.from({ length: ticks }, (_, i) => i / (ticks - 1)) : [];
  const scaleTextStyle: CSSProperties = { color: scaleColor ?? 'var(--text-secondary)', ...scaleStyle };
  const scaleCls = 'whitespace-nowrap text-[11px] leading-none tabular-nums';
  const transition = (props: string) => (animMs ? props.split(',').map((p) => `${p.trim()} ${animMs}ms ease-out`).join(', ') : undefined);
  const customSize = !!valueStyle && valueStyle.fontSize !== undefined;

  /** The value block: the number (or the caller's content), the caption and the off-scale note. */
  const valueBlock = (fontSize: string, align: 'center' | 'start' = 'center') => (showValue || label || offScaleText) ? (
    <span className={cn('flex flex-col gap-1', align === 'center' ? 'items-center text-center' : 'items-start')}>
      {showValue && (valueContent ? <span className="leading-none" style={{ fontSize }}>{valueContent}</span> : (
        <span className="inline-flex items-baseline gap-[0.25em] font-semibold leading-none tracking-tight tabular-nums"
          style={{ fontSize: customSize ? undefined : fontSize, color: valueColor ?? 'var(--text-primary)', ...valueStyle }} data-part="value">
          <span>{text}</span>
          {unit && hasValue ? <span className="text-[0.5em] font-medium text-text-secondary">{unit}</span> : null}
        </span>
      ))}
      {label && <span className="text-[11px] leading-none text-text-secondary" data-part="caption">{label}</span>}
      {offScaleText && (
        <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-medium text-warning-fg" data-part="off-scale">{offScaleText}</span>
      )}
      {offScaleText && offScaleHint && (
        <span className="text-[11px] leading-snug text-text-secondary" data-part="off-scale-hint">{offScaleHint}</span>
      )}
    </span>
  ) : null;

  const fill = size === 'fill';
  const fixedWidth = fill ? undefined : SIZE_PX[size as keyof typeof SIZE_PX];
  let body: ReactNode;

  if (layout === 'bar-horizontal') {
    const t = Math.min(48, Math.max(4, thickness));
    const outerBands = bandStyle === 'outer' && segments.length > 0;
    body = (
      <div className="flex w-full flex-col justify-center gap-2" style={{ width: fixedWidth }}>
        {valueBlock('clamp(1.5rem, min(14cqi, 30cqb), 3rem)', 'start')}
        <div className="relative w-full" style={{ paddingTop: needle && needleStyle === 'marker' ? 7 : 0 }}>
          {outerBands && (
            <div className="relative mb-1 h-1 w-full" aria-hidden="true">
              {segments.map((s, i) => (
                <span key={i} className="absolute inset-y-0 rounded-full" data-part="band"
                  style={{ left: pctOf(s.from, 1), width: pctOf(s.to - s.from, 1), background: s.color }} />
              ))}
            </div>
          )}
          <div className={cn('relative w-full overflow-hidden', roundedCaps ? 'rounded-full' : 'rounded-sm')} style={{ height: t, background: track }} data-part="track">
            {!outerBands && segments.map((s, i) => (
              <span key={i} className="absolute inset-y-0" data-part="band"
                style={{ left: pctOf(s.from, 1), width: pctOf(s.to - s.from, 1), background: s.color, opacity: bandOpacity }} />
            ))}
            {hasValue && fraction > 0 && (
              <span className={cn('absolute inset-y-0 left-0', roundedCaps ? 'rounded-full' : 'rounded-sm')} data-part="bar"
                style={{ width: pctOf(fraction, 1), background: barColor, transition: transition('width, background-color') }} />
            )}
          </div>
          {needle && hasValue && (needleStyle === 'marker' ? (
            <span className="absolute top-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent" data-part="needle"
              style={{ left: pctOf(fraction, 1), borderTopColor: needleFill, transition: transition('left') }} />
          ) : (
            <span className="absolute w-[3px] -translate-x-1/2 rounded-full" data-part="needle"
              style={{ left: pctOf(fraction, 1), bottom: -4, height: t + 8, background: needleFill, transition: transition('left') }} />
          ))}
          {tickFractions.length > 0 && (
            <div className="relative h-1.5 w-full" aria-hidden="true">
              {tickFractions.map((f) => (
                <span key={f} className="absolute top-0.5 h-1 w-px" data-part="tick" style={{ left: pctOf(f, 1), background: ticksStroke }} />
              ))}
            </div>
          )}
        </div>
        {(showMinMax || (tickLabels && tickFractions.length > 0)) && (
          <div className="relative h-3 w-full" style={scaleTextStyle}>
            {showMinMax && <span className={cn(scaleCls, 'absolute left-0 top-0')} data-part="min">{scaleText(min)}</span>}
            {showMinMax && <span className={cn(scaleCls, 'absolute right-0 top-0')} data-part="max">{scaleText(max)}</span>}
            {tickLabels && tickFractions.filter((f) => !showMinMax || (f > 0 && f < 1)).map((f) => (
              <span key={f} className={cn(scaleCls, 'absolute top-0 -translate-x-1/2')} style={{ left: pctOf(f, 1) }} data-part="tick-label">
                {scaleText(min + span * f)}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  } else if (layout === 'bar-vertical' || layout === 'level') {
    const level = layout === 'level';
    const t = Math.min(48, Math.max(level ? 8 : 4, thickness));
    const bulb = level ? Math.round(t * 2) : 0;
    const outerBands = bandStyle === 'outer' && segments.length > 0;
    const scaleLabels = (showMinMax || (tickLabels && tickFractions.length > 0));
    // The scale runs bottom to top. In a level the bulb sits under the tube and is always full.
    const column = (
      <div className="relative flex h-full min-h-0 flex-col items-center" style={{ width: Math.max(t, bulb) }}>
        <div className="relative w-full min-h-0 flex-1" style={{ display: 'flex', justifyContent: 'center' }}>
          {outerBands && (
            <div className="absolute inset-y-0" style={{ left: `calc(50% + ${t / 2 + 3}px)`, width: 4 }} aria-hidden="true">
              {segments.map((s, i) => (
                <span key={i} className="absolute inset-x-0 rounded-full" data-part="band"
                  style={{ bottom: pctOf(s.from, 1), height: pctOf(s.to - s.from, 1), background: s.color }} />
              ))}
            </div>
          )}
          <div className={cn('relative h-full overflow-hidden', roundedCaps || level ? 'rounded-t-full' : 'rounded-sm', !level && roundedCaps && 'rounded-full')}
            style={{ width: t, background: track, ...(level ? { marginBottom: -bulb / 2 } : {}) }} data-part="track">
            {!outerBands && segments.map((s, i) => (
              <span key={i} className="absolute inset-x-0" data-part="band"
                style={{ bottom: pctOf(s.from, 1), height: pctOf(s.to - s.from, 1), background: s.color, opacity: bandOpacity }} />
            ))}
            {hasValue && (fraction > 0 || level) && (
              <span className={cn('absolute inset-x-0 bottom-0', !level && (roundedCaps ? 'rounded-full' : 'rounded-sm'))} data-part="bar"
                style={{ height: level ? `calc(${pctOf(fraction, 1)} + ${bulb / 2}px)` : pctOf(fraction, 1), maxHeight: '100%', background: barColor, transition: transition('height, background-color') }} />
            )}
          </div>
          {needle && hasValue && (
            <span className="absolute" data-part="needle" style={{
              bottom: level ? `calc(${bulb / 2}px + (100% - ${bulb / 2}px) * ${fraction.toFixed(4)})` : pctOf(fraction, 1),
              left: `calc(50% - ${t / 2 + 6}px)`, width: needleStyle === 'marker' ? 0 : t + 12, height: needleStyle === 'marker' ? 0 : 3,
              ...(needleStyle === 'marker'
                ? { borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: `6px solid ${needleFill}`, transform: 'translateY(50%)' }
                : { background: needleFill, borderRadius: 9999, transform: 'translateY(50%)' }),
              transition: transition('bottom'),
            }} />
          )}
        </div>
        {level && (
          <div className="relative shrink-0 rounded-full" style={{ width: bulb, height: bulb, background: hasValue ? barColor : track, transition: transition('background-color') }} data-part="bulb" />
        )}
      </div>
    );
    // Scale labels sit on the tube's length (above the bulb).
    const scaleCol = (scaleLabels || tickFractions.length > 0) ? (
      <div className="relative h-full min-h-0" style={{ paddingBottom: level ? bulb / 2 : 0, ...scaleTextStyle }}>
        <div className="relative h-full" style={{ minWidth: 28 }}>
          {tickFractions.map((f) => (
            <span key={f} className="absolute left-0 h-px w-1.5" data-part="tick" style={{ bottom: pctOf(f, 1), background: ticksStroke }} />
          ))}
          {showMinMax && <span className={cn(scaleCls, 'absolute left-2.5 translate-y-1/2')} style={{ bottom: 0 }} data-part="min">{scaleText(min)}</span>}
          {showMinMax && <span className={cn(scaleCls, 'absolute left-2.5 -translate-y-1/2')} style={{ top: 0 }} data-part="max">{scaleText(max)}</span>}
          {tickLabels && tickFractions.filter((f) => !showMinMax || (f > 0 && f < 1)).map((f) => (
            <span key={f} className={cn(scaleCls, 'absolute left-2.5 translate-y-1/2')} style={{ bottom: pctOf(f, 1) }} data-part="tick-label">
              {scaleText(min + span * f)}
            </span>
          ))}
        </div>
      </div>
    ) : null;
    body = (
      <div className="flex h-full min-h-0 w-full items-stretch gap-2 py-1.5" style={{ width: fixedWidth, height: fill ? undefined : (fixedWidth ?? 200) * 0.9 }}>
        {column}
        {scaleCol}
        <div className="flex min-w-0 flex-1 items-end justify-end pb-0.5">
          {valueBlock('clamp(1.5rem, min(14cqi, 30cqb), 3rem)', 'start')}
        </div>
      </div>
    );
  } else {
    const donut = layout === 'donut';
    const t = Math.min(48, Math.max(1, thickness));
    const cap = roundedCaps ? 'round' : 'butt';
    const a0 = donut ? startAngle : -90;
    const a1 = donut ? Math.max(startAngle + 1, Math.min(startAngle + 360, endAngle)) : 90;
    const angleAt = (f: number) => a0 + (a1 - a0) * f;
    const full = a1 - a0 >= 300;
    const outerBands = bandStyle === 'outer' && segments.length > 0;
    const bw = Math.max(3, Math.round(t * 0.28));
    const rBand = R + t / 2 + 3 + bw / 2;
    const marker = needle && needleStyle === 'marker';
    const rOut = outerBands ? rBand + bw / 2 : marker ? R + t / 2 + 9 : R + t / 2;
    const pointer = needle && needleStyle !== 'marker';
    const extra: Array<{ x: number; y: number }> = [];
    if (pointer) extra.push({ x: CX - 7, y: CY - 7 }, { x: CX + 7, y: CY + 7 });
    if (roundedCaps) for (const a of [a0, a1]) { const p = polar(a); for (let k = 0; k < 8; k++) extra.push({ x: p.x + (t / 2) * Math.cos(k * Math.PI / 4), y: p.y + (t / 2) * Math.sin(k * Math.PI / 4) }); }
    // An arc with a pointer keeps room under the pivot for the number.
    const arcValueRoom = !donut && pointer && showValue ? 34 : 0;
    if (arcValueRoom) extra.push({ x: CX, y: CY + arcValueRoom });
    const box = arcBox(a0, a1, rOut, R - t / 2, extra);
    const ratio = box.w / box.h;
    const X = (x: number) => pctOf(x - box.x, box.w);
    const Y = (y: number) => pctOf(y - box.y, box.h);
    const nAngle = angleAt(fraction);
    const tip = polar(nAngle, R - t / 2 - 4);
    const start = polar(a0);
    const end = polar(a1);
    // Min / max under the ends of the scale, flush with the stroke's outer edge on a half circle.
    const reserve = showMinMax && !full ? 16 : 0;
    const valueFont = donut ? 'clamp(0.875rem, 15cqw, 3rem)' : 'clamp(0.875rem, 16cqw, 3rem)';
    const valuePos: CSSProperties = donut
      ? { left: '50%', top: pointer ? Y(CY + R * 0.42) : Y(CY), transform: 'translate(-50%, -50%)' }
      : pointer
        ? { left: '50%', top: Y(CY + 8) }
        : { left: '50%', bottom: pctOf(box.y + box.h - CY - 1, box.h), transform: 'translateX(-50%)' };
    const arrow = (() => {
      const base = 4.5;
      const l = polar(nAngle - 90, base);
      const r = polar(nAngle + 90, base);
      return `M${l.x.toFixed(2)} ${l.y.toFixed(2)} L${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L${r.x.toFixed(2)} ${r.y.toFixed(2)} Z`;
    })();
    const markerPath = (() => {
      const r0 = R + t / 2 + 1;
      const p = polar(nAngle, r0);
      const l = polar(nAngle - 3.2, r0 + 8);
      const r = polar(nAngle + 3.2, r0 + 8);
      return `M${p.x.toFixed(2)} ${p.y.toFixed(2)} L${l.x.toFixed(2)} ${l.y.toFixed(2)} L${r.x.toFixed(2)} ${r.y.toFixed(2)} Z`;
    })();
    const sizer: CSSProperties = fill
      ? { width: `min(100cqw, calc((100cqh - ${reserve}px) * ${ratio.toFixed(4)}))`, aspectRatio: `${ratio.toFixed(4)}` }
      : { width: fixedWidth, aspectRatio: `${ratio.toFixed(4)}` };
    body = (
      <div className="relative" style={{ ...sizer, containerType: 'inline-size', marginBottom: reserve }}>
        <svg viewBox={`${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <path d={anglePath(a0, a1)} fill="none" stroke={track} strokeWidth={t} strokeLinecap={cap} data-part="track" />
          {!outerBands && segments.map((s, i) => (
            <path key={i} d={anglePath(angleAt(s.from), angleAt(s.to))} fill="none" stroke={s.color} strokeOpacity={bandOpacity} strokeWidth={t} data-part="band" />
          ))}
          {outerBands && segments.map((s, i) => (
            <path key={i} d={anglePath(angleAt(s.from), angleAt(s.to), rBand)} fill="none" stroke={s.color} strokeWidth={bw} data-part="band" />
          ))}
          {hasValue && fraction > 0 && (
            <path d={anglePath(a0, a1)} pathLength={1} fill="none" stroke={barColor} strokeWidth={t} strokeLinecap={cap}
              strokeDasharray={`${fraction} 1`} style={{ transition: transition('stroke, stroke-dasharray') }} data-part="bar" />
          )}
          {tickFractions.map((f) => {
            const p = polar(angleAt(f), R - t / 2 - 2);
            const q = polar(angleAt(f), R - t / 2 - 7);
            return <line key={f} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={ticksStroke} strokeWidth={1.2} data-part="tick" />;
          })}
          {needle && hasValue && needleStyle === 'line' && (
            <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke={needleFill} strokeWidth={3} strokeLinecap="round" data-part="needle" />
          )}
          {needle && hasValue && needleStyle === 'arrow' && <path d={arrow} fill={needleFill} data-part="needle" />}
          {pointer && hasValue && <circle cx={CX} cy={CY} r={6} fill={needleFill} />}
          {marker && hasValue && <path d={markerPath} fill={needleFill} data-part="needle" />}
        </svg>
        {(showValue || label || offScaleText) && (
          <div className="absolute" style={valuePos}>{valueBlock(valueFont)}</div>
        )}
        {tickLabels && tickFractions.filter((f) => !showMinMax || full || (f > 0 && f < 1)).map((f) => {
          const p = polar(angleAt(f), R - t / 2 - 15);
          return (
            <span key={f} className={cn(scaleCls, 'absolute -translate-x-1/2 -translate-y-1/2')} style={{ left: X(p.x), top: Y(p.y), ...scaleTextStyle }} data-part="tick-label">
              {scaleText(min + span * f)}
            </span>
          );
        })}
        {showMinMax && !full && (donut ? (
          <>
            <span className={cn(scaleCls, 'absolute -translate-x-1/2')} style={{ left: X(start.x), top: `calc(${Y(start.y)} + ${(t / 2 / box.h) * 100}% + 4px)`, ...scaleTextStyle }} data-part="min">{scaleText(min)}</span>
            <span className={cn(scaleCls, 'absolute -translate-x-1/2')} style={{ left: X(end.x), top: `calc(${Y(end.y)} + ${(t / 2 / box.h) * 100}% + 4px)`, ...scaleTextStyle }} data-part="max">{scaleText(max)}</span>
          </>
        ) : (
          <>
            <span className={cn(scaleCls, 'absolute')} style={{ left: X(CX - R - t / 2), top: `calc(${Y(CY + (roundedCaps ? t / 2 : 0))} + 4px)`, ...scaleTextStyle }} data-part="min">{scaleText(min)}</span>
            <span className={cn(scaleCls, 'absolute')} style={{ right: pctOf(box.x + box.w - (CX + R + t / 2), box.w), top: `calc(${Y(CY + (roundedCaps ? t / 2 : 0))} + 4px)`, ...scaleTextStyle }} data-part="max">{scaleText(max)}</span>
          </>
        ))}
      </div>
    );
  }

  return (
    <div
      role="meter"
      aria-label={ariaLabel ?? label ?? 'Gauge'}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={hasValue ? clamped : undefined}
      aria-valuetext={hasValue ? `${text}${unit ? ` ${unit}` : ''}${bandName ? `, ${bandName}` : ''}${offScaleText ? `, ${offScaleText}` : ''}${stale ? `, ${staleLabel}` : ''}` : 'no value'}
      className={cn('relative flex flex-col items-center justify-center', fill ? 'h-full w-full min-h-0' : 'inline-flex', stale && 'opacity-60', className)}
      style={fill ? { containerType: 'size' } : { maxWidth: '100%' }}
      data-layout={layout}
      data-off-scale={offScale ?? undefined}
    >
      {body}
      {stale && <div className="text-[10px] uppercase tracking-wide text-text-secondary">{staleLabel}</div>}
    </div>
  );
}
