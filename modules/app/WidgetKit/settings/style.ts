// Colour, font and number helpers shared by the card, the widget views and the validator.
// Pure TypeScript.

import type { CSSProperties } from 'react';
import type { FontValue } from '../../SchemaForm/types';

/**
 * A colour setting is any CSS colour or a theme token (owner decision D-21.1: free colour).
 * Accepted: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(), hsl()/hsla(), var(--token), `transparent`.
 * Anything else (url(), expression(), a `;`) is refused, so a setting can never smuggle CSS.
 */
const COLOR_RE = new RegExp(
  '^(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})' +
  '|rgba?\\(\\s*\\d{1,3}%?\\s*[,\\s]\\s*\\d{1,3}%?\\s*[,\\s]\\s*\\d{1,3}%?\\s*(?:[,/]\\s*(?:0|1|0?\\.\\d+|\\d{1,3}%)\\s*)?\\)' +
  '|hsla?\\(\\s*\\d{1,3}(?:deg)?\\s*[,\\s]\\s*\\d{1,3}%\\s*[,\\s]\\s*\\d{1,3}%\\s*(?:[,/]\\s*(?:0|1|0?\\.\\d+|\\d{1,3}%)\\s*)?\\)' +
  '|var\\(--[a-z][a-z0-9-]{0,63}\\)' +
  '|transparent)$',
);

export function isColor(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 80 && COLOR_RE.test(value.trim());
}

/** A colour safe to put in `style`, or `undefined` when the setting is empty or not a colour. */
export function cssColor(value: unknown): string | undefined {
  return isColor(value) ? value.trim() : undefined;
}

const FAMILIES: Record<NonNullable<FontValue['family']>, string | undefined> = {
  inherit: undefined,
  sans: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
  serif: 'ui-serif, Georgia, serif',
  mono: 'var(--font-mono, ui-monospace, monospace)',
};

/** Inline style for a `font` setting plus its colour. Unset parts inherit the theme. */
export function fontStyle(font: FontValue | undefined, color?: unknown): CSSProperties {
  const out: CSSProperties = {};
  if (font) {
    if (typeof font.size === 'number' && font.size > 0) out.fontSize = `${font.size}${font.unit ?? 'px'}`;
    if (font.weight) out.fontWeight = font.weight;
    if (font.style === 'italic') out.fontStyle = 'italic';
    if (font.family && FAMILIES[font.family]) out.fontFamily = FAMILIES[font.family];
    if (typeof font.lineHeight === 'number') out.lineHeight = font.lineHeight;
  }
  const c = cssColor(color);
  if (c) out.color = c;
  return out;
}

/** `settings.$format` (`core:format`). */
export interface ValueFormat {
  unit?: string;
  unitPosition?: 'after' | 'before';
  /** Empty = automatic: integers as they are, otherwise up to 2 decimals. */
  decimals?: number;
  notation?: 'standard' | 'compact';
}

/** Per-item overrides (a series, a column, a record field): absent = inherit. */
export type ValueFormatOverride = Pick<ValueFormat, 'unit' | 'decimals'>;

/** The number as text, with its unit placed as configured. `null`/NaN render as an em dash. */
export function formatValue(value: unknown, base: ValueFormat = {}, override: ValueFormatOverride = {}, locale?: string): string {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return value === null || value === undefined || value === '' ? '—' : String(value);
  const decimals = override.decimals ?? base.decimals;
  const unit = override.unit ?? base.unit ?? '';
  const opts: Intl.NumberFormatOptions = { notation: base.notation === 'compact' ? 'compact' : 'standard' };
  if (typeof decimals === 'number') {
    opts.minimumFractionDigits = decimals;
    opts.maximumFractionDigits = decimals;
  } else if (opts.notation !== 'compact') {
    opts.maximumFractionDigits = Number.isInteger(n) ? 0 : 2;
  }
  const text = new Intl.NumberFormat(locale, opts).format(n);
  if (!unit) return text;
  return base.unitPosition === 'before' ? `${unit} ${text}` : `${text} ${unit}`;
}

/** One colour range on the raw value. Either end may be open. */
export interface ColorRange {
  from?: number;
  to?: number;
  color: string;
  label?: string;
}

/** 'from' = from <= v < to (ThingsBoard); 'to' = from < v <= to. */
export type RangeEdges = 'from' | 'to';

/** The first range the value falls in, or `undefined`. */
export function rangeFor(value: unknown, ranges: unknown, edges: RangeEdges = 'from'): ColorRange | undefined {
  // No value is no range: `Number(null)` and `Number('')` are 0, and would take the colour of a range around 0.
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Array.isArray(ranges)) return undefined;
  for (const r of ranges as ColorRange[]) {
    if (!r || typeof r !== 'object') continue;
    const from = typeof r.from === 'number' ? r.from : undefined;
    const to = typeof r.to === 'number' ? r.to : undefined;
    const aboveFrom = from === undefined || (edges === 'from' ? n >= from : n > from);
    const belowTo = to === undefined || (edges === 'from' ? n < to : n <= to);
    if (aboveFrom && belowTo) return r;
  }
  return undefined;
}

/** The colour of the first matching range, safe for `style`. */
export function rangeColor(value: unknown, ranges: unknown, edges: RangeEdges = 'from'): string | undefined {
  return cssColor(rangeFor(value, ranges, edges)?.color);
}
