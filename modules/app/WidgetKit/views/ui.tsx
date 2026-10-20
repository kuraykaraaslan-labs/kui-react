'use client';
// The building blocks every widget view uses (see ../DESIGN.md). One look for the whole kit: a view
// composes these and passes setting overrides (a font, a colour) through, it never restyles them.
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle, tint } from '../settings/style';
import { SettingIcon } from '../WidgetKitContext';

export { tint };

const METRIC_SIZE: Record<'xl' | 'lg' | 'md' | 'sm', string> = {
  xl: 'clamp(1.5rem, min(14cqi, 36cqb), 3rem)',
  lg: '1.5rem',
  md: '1.125rem',
  sm: '0.9375rem',
};

/** A number with its unit, in the kit's metric style. `text` is already formatted (unit included or not). */
export function Metric({
  text, unit, unitPosition = 'after', size = 'xl', color, font, className, style,
}: {
  text: ReactNode;
  unit?: string;
  unitPosition?: 'after' | 'before';
  size?: 'xl' | 'lg' | 'md' | 'sm';
  color?: string;
  /** A font setting replaces the auto size. */
  font?: FontValue;
  className?: string;
  style?: CSSProperties;
}) {
  const custom = font && Object.keys(font).length > 0;
  // The unit is half the number's size, but never smaller than readable text.
  const u = unit ? <span className="text-[max(0.5em,11px)] font-medium text-text-secondary">{unit}</span> : null;
  return (
    <span
      className={cn('inline-flex items-baseline gap-[0.25em] font-semibold leading-none tracking-tight tabular-nums text-text-primary', className)}
      style={{ ...(custom ? {} : { fontSize: METRIC_SIZE[size] }), ...fontStyle(custom ? font : undefined, color), ...style }}
    >
      {unitPosition === 'before' && u}
      <span>{text}</span>
      {unitPosition !== 'before' && u}
    </span>
  );
}

/** What a number is ("Orders today"): small, muted, one line. */
export function MetricLabel({ children, font, color, className }: { children: ReactNode; font?: FontValue; color?: string; className?: string }) {
  if (children === null || children === undefined || children === '') return null;
  return <span className={cn('block truncate text-xs font-medium text-text-secondary', className)} style={fontStyle(font, color)}>{children}</span>;
}

/** Secondary information (a time, "of 100K", a caption). */
export function Meta({ children, className, style, title }: { children: ReactNode; className?: string; style?: CSSProperties; title?: string }) {
  if (children === null || children === undefined || children === '') return null;
  return <span title={title} className={cn('text-[11px] leading-snug text-text-secondary/80', className)} style={style}>{children}</span>;
}

/** A change chip: ▲ +12 % in the colour of what the change means. */
export function Delta({
  text, direction, meaning, color, label,
}: {
  text: string;
  direction: 'up' | 'down' | 'flat';
  meaning: 'good' | 'bad' | 'neutral';
  /** Overrides the meaning's colour. */
  color?: string;
  label?: string;
}) {
  const c = cssColor(color) ?? (meaning === 'good' ? 'var(--success)' : meaning === 'bad' ? 'var(--error)' : 'var(--text-secondary)');
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '•';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium tabular-nums" style={{ color: c, background: tint(c, 12) }}>
        <span aria-hidden="true" className="text-[0.7em]">{arrow}</span>{text}
      </span>
      {label && <span className="text-text-secondary">{label}</span>}
    </span>
  );
}

/** An icon in a tinted tile. */
export function IconTile({ name, color, background, size = 36 }: { name?: string; color?: string; background?: string; size?: number }) {
  if (!name) return null;
  const c = cssColor(color) ?? 'var(--primary)';
  const bg = background === '' ? undefined : cssColor(background) ?? tint(c);
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-lg" style={{ width: size, height: size, background: bg }}>
      <SettingIcon name={name} style={{ width: size / 2, height: size / 2, fontSize: size / 2, color: c }} />
    </span>
  );
}

/** A status: a dot (or icon) and a word, tinted with its colour. */
export function Pill({
  label, color, background, icon, size = 'md', variant = 'soft', className,
}: {
  label: ReactNode;
  color?: string;
  background?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'soft' | 'solid' | 'dot';
  className?: string;
}) {
  const c = cssColor(color) ?? 'var(--text-secondary)';
  const pad = size === 'lg' ? 'px-3 py-1.5 text-sm gap-2' : size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5';
  if (variant === 'dot') {
    return (
      <span className={cn('inline-flex items-center font-medium text-text-primary', size === 'lg' ? 'gap-2 text-sm' : 'gap-1.5 text-xs', className)}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />{label}
      </span>
    );
  }
  const solid = variant === 'solid';
  return (
    <span className={cn('inline-flex items-center rounded-full font-medium', pad, className)}
      style={{ color: solid ? 'var(--primary-fg)' : c, background: cssColor(background) ?? (solid ? c : tint(c)) }}>
      {icon ? <SettingIcon name={icon} style={{ width: '1em', height: '1em', fontSize: '1em' }} /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: solid ? 'currentColor' : c }} />}
      {label}
    </span>
  );
}

/** A label/value line in a list. `as`/`labelAs`/`valueAs` allow list semantics (`div`/`dt`/`dd`). */
export function Row({
  label, value, divider = true, labelStyle, valueStyle, className, as: Tag = 'div', labelAs: L = 'span', valueAs: V = 'span', ...rest
}: {
  label: ReactNode;
  value: ReactNode;
  divider?: boolean;
  labelStyle?: CSSProperties;
  valueStyle?: CSSProperties;
  className?: string;
  as?: 'div' | 'li';
  labelAs?: 'span' | 'dt';
  valueAs?: 'span' | 'dd';
} & Omit<React.HTMLAttributes<HTMLElement>, 'children'>) {
  return (
    <Tag className={cn('flex min-h-9 items-center justify-between gap-3 py-1.5', divider && 'border-b border-border last:border-b-0', className)} {...rest}>
      <L className="min-w-0 truncate text-[13px] text-text-secondary" style={labelStyle}>{label}</L>
      <V className="m-0 shrink-0 text-right text-[13px] font-medium tabular-nums text-text-primary" style={valueStyle}>{value}</V>
    </Tag>
  );
}

/** The shared head of single-value widgets: label left, icon right. */
export function MetricHead({ label, icon }: { label?: ReactNode; icon?: ReactNode }) {
  if (!label && !icon) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 pt-0.5">{label}</div>
      {icon}
    </div>
  );
}

/** Chart text and grid defaults every chart view uses (DESIGN.md: axis 11px secondary, dashed grid). */
export const CHART_AXIS_STYLE: CSSProperties = { fontSize: 11, fill: 'var(--text-secondary)' };
export const CHART_GRID_COLOR = 'var(--border)';
