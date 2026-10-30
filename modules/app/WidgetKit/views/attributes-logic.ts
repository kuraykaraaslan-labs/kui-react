// The pure logic of the attribute list widget (no React): a record as label / value rows, with the unit, decimals and
// colour of each field, and the classes of the list and grid layouts. `StatAttributesView.tsx` draws it; kui-ejs and
// KUInative vendor this file.

import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import type { StyleRecord } from '../card-logic';
import { cssColor, fontStyle, formatValue, rangeFor, type ValueFormat } from '../settings/style';
import type { Sparse } from '../settings/types';
import type { CommonMessages } from '../messages';
import type { ColumnMeta, SlotData } from '../kind';
import { metaLabel } from '../settings/source-meta';
import { ROW_CLASS, rowClass } from './ui-logic';

export type FieldRow = { key?: string; label?: string; unit?: string; decimals?: number; color?: string; ranges?: unknown; icon?: string };

export type AttributesSettings = {
  layout?: 'list' | 'grid-2' | 'grid-3' | 'columns';
  fields?: unknown;
  labelFont?: FontValue;
  labelColor?: string;
  valueFont?: FontValue;
  valueColor?: string;
  maxRows?: number;
  emptyValue?: string;
  dividers?: boolean;
  dividerColor?: string;
  striped?: boolean;
  alignment?: 'split' | 'start' | 'center';
  showIcons?: boolean;
};

export interface AttributeRow {
  key: string;
  label: string;
  /** The value as text, unit included (CSV, accessible text). */
  value: string;
  /** A number's text without its unit, and the unit, for the metric look. */
  number?: string;
  unit?: string;
  unitPosition?: 'before' | 'after';
  color?: string;
  icon?: string;
}

/** `last_seen_at` / `lastSeenAt` → `Last seen at`. */
export function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').trim();
  const lower = spaced.toLowerCase();
  return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : key;
}

/**
 * A record → label / value rows. With configured fields only those are shown, in that order, and a
 * missing key shows the empty text (a configured row must not silently disappear). With none every
 * key is shown. Decimals: the field's, else the widget's, else automatic (17.4, not 17.40).
 * A field's colour ranges colour its value; its plain colour applies when no range matches.
 * A row's label: the field's own, else the one the source gives the key (`recordMeta`, in the
 * viewer's language), else the key in words.
 */
export function attributeRows(
  record: Record<string, unknown> | undefined, settings: Sparse, format: ValueFormat, locale?: string,
  yesNo: CommonMessages = { yes: 'Yes', no: 'No' },
  meta?: Record<string, ColumnMeta>,
): AttributeRow[] {
  if (!record) return [];
  const s = settings as AttributesSettings;
  const empty = typeof s.emptyValue === 'string' ? s.emptyValue : '—';
  const configured = (Array.isArray(s.fields) ? (s.fields as FieldRow[]) : [])
    .filter((f) => f && typeof f.key === 'string' && f.key.trim() !== '');
  const source: FieldRow[] = configured.length ? configured : Object.keys(record).map((key) => ({ key }));
  const max = Math.max(1, Number(s.maxRows) || 20);
  return source.slice(0, max).map((f) => {
    const key = (f.key as string).trim();
    const raw = record[key];
    const unit = typeof f.unit === 'string' && f.unit ? f.unit : format.unit;
    let value: string;
    let parts: Pick<AttributeRow, 'number' | 'unit' | 'unitPosition'> = {};
    if (raw === null || raw === undefined || raw === '') value = empty;
    else if (typeof raw === 'boolean') value = raw ? yesNo.yes : yesNo.no;
    else if (typeof raw === 'number') {
      if (Number.isFinite(raw)) {
        const decimals = typeof f.decimals === 'number' ? f.decimals : Number.isInteger(raw) ? 0 : format.decimals;
        const over = { ...(typeof f.unit === 'string' && f.unit ? { unit: f.unit } : {}), ...(typeof decimals === 'number' ? { decimals } : {}) };
        value = formatValue(raw, format, over, locale);
        parts = { number: formatValue(raw, { ...format, unit: '' }, { ...over, unit: '' }, locale), ...(unit ? { unit } : {}), unitPosition: format.unitPosition ?? 'after' };
      } else value = empty;
    } else if (typeof raw === 'object') {
      const json = JSON.stringify(raw);
      value = json.length > 120 ? `${json.slice(0, 117)}…` : json;
    } else value = f.unit ? `${String(raw)} ${f.unit}` : String(raw);
    const color = cssColor(rangeFor(raw, f.ranges)?.color) ?? cssColor(f.color);
    return {
      key,
      label: typeof f.label === 'string' && f.label.trim() ? f.label.trim() : (metaLabel(metaOf(meta, key)?.label, locale) ?? humanizeKey(key)),
      value,
      ...parts,
      ...(color ? { color } : {}),
      ...(f.icon ? { icon: f.icon } : {}),
    };
  });
}

/** The source's meta of `key`, read only as the record's own property. */
const metaOf = (meta: Record<string, ColumnMeta> | undefined, key: string): ColumnMeta | undefined =>
  (meta && Object.prototype.hasOwnProperty.call(meta, key) ? meta[key] : undefined);

const GRID: Record<Exclude<NonNullable<AttributesSettings['layout']>, 'list'>, string> = {
  'grid-2': 'grid-cols-2',
  'grid-3': 'grid-cols-3',
  columns: 'grid-flow-col auto-cols-fr',
};


export interface AttributesRowView extends AttributeRow {
  /** The label with its icon, when icons are on and the row has one. */
  iconName?: string;
  /** List layout: the row's class (and the extra part the `Row` block merges) and the value's style. */
  rowClass: string;
  rowExtra: string;
  valueStyle: StyleRecord;
  /** Grid layouts: the cell's class and style. */
  cellClass: string;
  cellStyle?: StyleRecord;
  /** Grid layouts: the plain (non-number) value's style. */
  textValueStyle: StyleRecord;
}

/** Everything the attribute list draws, decided once. */
export function attributesModel(
  s: AttributesSettings, format: ValueFormat, data: Record<string, SlotData | undefined>, locale: string | undefined, yesNo: CommonMessages,
) {
  // No record still lists the configured fields, each with the empty value: the empty shape.
  const rows = attributeRows(data.record?.record ?? {}, s as Sparse, format, locale, yesNo, data.record?.recordMeta);
  const layout = s.layout ?? 'list';
  const dividers = s.dividers !== false;
  const divider = cssColor(s.dividerColor);
  const labelStyle = fontStyle(s.labelFont, s.labelColor) as StyleRecord;
  const valueStyle = fontStyle(s.valueFont, s.valueColor) as StyleRecord;
  const align = s.alignment ?? (layout === 'list' ? 'split' : 'start');
  const icons = s.showIcons !== false;
  const rowExtra = () => cn(
    divider && 'border-[color:var(--wk-divider)]',
    s.striped && 'px-2 even:bg-surface-overlay/60',
    s.striped && !dividers && 'rounded-md',
    align === 'start' && 'grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)]',
    align === 'center' && 'grid grid-cols-2',
  );
  const views: AttributesRowView[] = rows.map((r) => ({
    ...r,
    iconName: icons && r.icon ? r.icon : undefined,
    rowExtra: rowExtra(),
    rowClass: rowClass(dividers, rowExtra()),
    valueStyle: { ...valueStyle, ...(r.color ? { color: r.color } : {}), ...(align !== 'split' ? { textAlign: 'left' } : {}) },
    cellClass: cn(
      'flex min-w-0 flex-col gap-1 py-2',
      align === 'center' && 'items-center text-center',
      dividers && layout !== 'columns' && 'border-b border-border',
      dividers && layout === 'columns' && 'border-l border-border pl-4 first:border-l-0 first:pl-0',
      s.striped && 'rounded-md bg-surface-overlay/60 px-2',
    ),
    cellStyle: dividers && divider ? { borderColor: divider } : undefined,
    textValueStyle: { ...valueStyle, ...(r.color ? { color: r.color } : {}) },
  }));
  return {
    layout, rows: views, labelStyle, valueStyle, divider, align,
    dividers,
    listStyle: (divider ? { '--wk-divider': divider } : undefined) as StyleRecord | undefined,
    gridClass: cn('grid gap-x-4', GRID[layout === 'list' ? 'grid-2' : layout] ?? GRID['grid-2'], s.striped ? 'gap-y-1' : 'gap-y-0'),
    metricColor: (r: AttributeRow) => r.color ?? s.valueColor,
    rowTag: ROW_CLASS,
  };
}
