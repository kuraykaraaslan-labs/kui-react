// What a data source says about its own values (next-boilerplate dashboard phase 23): the label, unit,
// decimals, value-to-word map, kind and the direction that is "good". Pure; server and browser.
//
// A source applies its own scale before it answers, so there is no `scale` here: a widget never multiplies.
// Precedence, lowest first: widget type defaults < the source < a saved definition's defaults < the placement.

import type { Sparse } from './types';
import type { ValueFormat } from './style';

/** One raw value's presentation. */
export interface ValueMapEntry {
  label: string;
  color?: string;
  icon?: string;
}

/** Text, or one text per language (`{ en: 'Door', tr: 'Kapı' }`). */
export type MetaLabel = string | Record<string, string>;

export interface ColumnMeta {
  label?: MetaLabel;
  unit?: string;
  decimals?: number;
  /** Raw value (as text) → word, colour and icon. */
  valueMap?: Record<string, ValueMapEntry>;
  kind?: 'number' | 'boolean' | 'enum' | 'string' | 'json';
  /** Which way is good for a number: drives the colour of a change on a stat card. */
  direction?: 'higherIsBetter' | 'lowerIsBetter' | 'neutral';
}

/** The meta label for a language: the exact tag, its base language, English, then the first entry. */
export function metaLabel(label: MetaLabel | undefined, locale?: string): string | undefined {
  if (label === undefined) return undefined;
  if (typeof label === 'string') return label || undefined;
  const lang = (locale ?? '').toLowerCase();
  const pick = label[lang] ?? label[lang.split('-')[0]] ?? label.en ?? Object.values(label)[0];
  return pick || undefined;
}

/** The unit and decimals a source states, as a partial `core:format`. */
export function metaFormat(meta: ColumnMeta | undefined): Pick<ValueFormat, 'unit' | 'decimals'> {
  const out: Pick<ValueFormat, 'unit' | 'decimals'> = {};
  if (!meta) return out;
  if (typeof meta.unit === 'string' && meta.unit) out.unit = meta.unit;
  if (typeof meta.decimals === 'number' && Number.isInteger(meta.decimals) && meta.decimals >= 0) out.decimals = meta.decimals;
  return out;
}

/** The `increaseIs` option a direction means. */
export function directionOption(direction: ColumnMeta['direction']): 'good' | 'bad' | 'neutral' | undefined {
  if (direction === 'higherIsBetter') return 'good';
  if (direction === 'lowerIsBetter') return 'bad';
  if (direction === 'neutral') return 'neutral';
  return undefined;
}

/** A value map as the table's list form (`valueMap` setting rows), empty when the source gave none. */
export function valueMapList(meta: ColumnMeta | undefined): Array<{ value: string; label: string; color?: string; icon?: string }> {
  if (!meta?.valueMap || typeof meta.valueMap !== 'object') return [];
  return Object.entries(meta.valueMap).flatMap(([value, e]) => (e && typeof e.label === 'string'
    ? [{ value, label: e.label, ...(e.color ? { color: e.color } : {}), ...(e.icon ? { icon: e.icon } : {}) }]
    : []));
}

/** The entry for a raw value (trimmed, case-insensitive, like the table's own map). */
export function metaValue(meta: ColumnMeta | undefined, raw: unknown): ValueMapEntry | undefined {
  if (!meta?.valueMap || raw === null || raw === undefined) return undefined;
  const key = (typeof raw === 'object' ? JSON.stringify(raw) : String(raw)).trim().toLowerCase();
  for (const [k, e] of Object.entries(meta.valueMap)) if (k.trim().toLowerCase() === key) return e;
  return undefined;
}

/** What a result may say about its values, by shape: a scalar and each series carry `meta`, a table its columns, a record `recordMeta`. */
export interface MetaCarrier {
  shape: 'scalar' | 'series' | 'table' | 'record';
  meta?: ColumnMeta;
  series?: Array<{ meta?: ColumnMeta }>;
}

/**
 * The meta that styles a card's one shared format: the first bound slot (in the type's own slot order)
 * that carries one. A scalar's or the first series' own meta; tables and records style per column or field.
 */
export function primaryMeta(
  slots: Array<{ key: string }>, data: Record<string, MetaCarrier | undefined>,
): ColumnMeta | undefined {
  for (const s of slots) {
    const d = data[s.key];
    if (!d) continue;
    if (d.shape === 'scalar' && d.meta) return d.meta;
    if (d.shape === 'series') {
      const m = d.series?.find((x) => x.meta)?.meta ?? d.meta;
      if (m) return m;
    }
  }
  return undefined;
}

/** The type-layer defaults a source's meta implies for a template that names its direction field. */
export function metaTypeDefaults(directionField: string | undefined, meta: ColumnMeta | undefined): Sparse {
  const option = directionOption(meta?.direction);
  return directionField && option ? { [directionField]: option } : {};
}
