// The look decisions behind the kit's building blocks (metric, change chip, icon tile, status pill) as plain data
// (no React). `ui.tsx` draws them; kui-ejs and KUInative vendor this file, so the blocks look the same in all three.

import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import type { StyleRecord } from '../card-logic';
import { cssColor, fontStyle, tint } from '../settings/style';

export const METRIC_SIZE: Record<'xl' | 'lg' | 'md' | 'sm', string> = {
  xl: 'clamp(1.5rem, min(14cqi, 36cqb), 3rem)',
  lg: '1.5rem',
  md: '1.125rem',
  sm: '0.9375rem',
};

export const METRIC_CLASS = 'inline-flex items-baseline gap-[0.25em] font-semibold leading-none tracking-tight tabular-nums text-text-primary';
export const METRIC_UNIT_CLASS = 'text-[max(0.5em,11px)] font-medium text-text-secondary';

/** The style of a number: an auto size by `size`, unless a font setting names one. */
export function metricStyle(o: { size?: 'xl' | 'lg' | 'md' | 'sm'; font?: FontValue; color?: string; style?: StyleRecord }): StyleRecord {
  const custom = !!o.font && Object.keys(o.font).length > 0;
  return { ...(custom ? {} : { fontSize: METRIC_SIZE[o.size ?? 'xl'] }), ...fontStyle(custom ? o.font : undefined, o.color) as StyleRecord, ...o.style };
}

export const METRIC_LABEL_CLASS = 'block truncate text-xs font-medium text-text-secondary';
export const META_CLASS = 'text-[11px] leading-snug text-text-secondary/80';

/** META_CLASS plus extra classes; an extra text colour replaces the muted one (what tailwind-merge does in the React block). */
export function metaClass(extra?: string): string {
  const own = extra && /(^|\s)text-text-[a-z]+(\/\d+)?(\s|$)/.test(extra) ? META_CLASS.replace(' text-text-secondary/80', '') : META_CLASS;
  return extra ? `${own} ${extra}` : own;
}

/** The change chip: its colour, background and arrow. */
export function deltaModel(o: { direction: 'up' | 'down' | 'flat'; meaning: 'good' | 'bad' | 'neutral'; color?: string }) {
  const c = cssColor(o.color) ?? (o.meaning === 'good' ? 'var(--success)' : o.meaning === 'bad' ? 'var(--error)' : 'var(--text-secondary)');
  return { color: c, background: tint(c, 12), arrow: o.direction === 'up' ? '▲' : o.direction === 'down' ? '▼' : '•' };
}

/** An icon in a tinted tile: the tile's background and the icon's colour. */
export function iconTileModel(o: { color?: string; background?: string; size?: number }) {
  const size = o.size ?? 36;
  const c = cssColor(o.color) ?? 'var(--primary)';
  const bg = o.background === '' ? undefined : cssColor(o.background) ?? tint(c);
  return { size, tileStyle: { width: size, height: size, background: bg } as StyleRecord, iconStyle: { width: size / 2, height: size / 2, fontSize: size / 2, color: c } as StyleRecord };
}

/** A status pill: classes and colours by size and variant. */
export function pillModel(o: { color?: string; background?: string; size?: 'sm' | 'md' | 'lg'; variant?: 'soft' | 'solid' | 'dot' }) {
  const size = o.size ?? 'md';
  const variant = o.variant ?? 'soft';
  const c = cssColor(o.color) ?? 'var(--text-secondary)';
  const pad = size === 'lg' ? 'px-3 py-1.5 text-sm gap-2' : size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5';
  if (variant === 'dot') {
    return { variant, color: c, className: `inline-flex items-center font-medium text-text-primary ${size === 'lg' ? 'gap-2 text-sm' : 'gap-1.5 text-xs'}`, style: {} as StyleRecord, dotColor: c };
  }
  const solid = variant === 'solid';
  return {
    variant, color: c,
    className: `inline-flex items-center rounded-full font-medium ${pad}`,
    style: { color: solid ? 'var(--primary-fg)' : c, background: cssColor(o.background) ?? (solid ? c : tint(c)) } as StyleRecord,
    dotColor: solid ? 'currentColor' : c,
  };
}

export const ROW_CLASS = {
  label: 'min-w-0 truncate text-[13px] text-text-secondary',
  value: 'm-0 shrink-0 text-right text-[13px] font-medium tabular-nums text-text-primary',
};

/** A label/value line in a list (`Row`): dividers between lines, extra classes merged the way tailwind-merge does. */
export function rowClass(divider = true, extra?: string): string {
  return cn('flex min-h-9 items-center justify-between gap-3 py-1.5', divider && 'border-b border-border last:border-b-0', extra);
}

/** Chart text and grid defaults every chart view uses (DESIGN.md: axis 11px secondary, dashed grid). */
export const CHART_AXIS_STYLE = { fontSize: 11, fill: 'var(--text-secondary)' } as const;
export const CHART_GRID_COLOR = 'var(--border)';
