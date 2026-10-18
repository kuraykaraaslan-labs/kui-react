'use client';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle, formatValue, rangeFor, type ValueFormat } from '../settings/style';
import type { Sparse } from '../settings/types';
import { SettingIcon, useKitMessages } from '../WidgetKitContext';
import type { CommonMessages } from '../messages';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { Metric, Row } from './ui';

type FieldRow = { key?: string; label?: string; unit?: string; decimals?: number; color?: string; ranges?: unknown; icon?: string };

type S = {
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
 */
export function attributeRows(
  record: Record<string, unknown> | undefined, settings: Sparse, format: ValueFormat, locale?: string,
  yesNo: CommonMessages = { yes: 'Yes', no: 'No' },
): AttributeRow[] {
  if (!record) return [];
  const s = settings as S;
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
      label: typeof f.label === 'string' && f.label.trim() ? f.label.trim() : humanizeKey(key),
      value,
      ...parts,
      ...(color ? { color } : {}),
      ...(f.icon ? { icon: f.icon } : {}),
    };
  });
}

const GRID: Record<Exclude<NonNullable<S['layout']>, 'list'>, string> = {
  'grid-2': 'grid-cols-2',
  'grid-3': 'grid-cols-3',
  columns: 'grid-flow-col auto-cols-fr',
};

/** `stat.attributes`: a record as label / value rows (the kit's `Row`), or as a grid of small metrics. */
export function StatAttributesView({ settings, format, data, locale }: WidgetViewProps) {
  const s = settings as S;
  const yesNo = useKitMessages().common;
  const rows = attributeRows(data.record?.record, settings, format, locale, yesNo);
  const layout = s.layout ?? 'list';
  const dividers = s.dividers !== false;
  const divider = cssColor(s.dividerColor);
  const labelStyle = fontStyle(s.labelFont, s.labelColor);
  const valueStyle = fontStyle(s.valueFont, s.valueColor);
  const align = s.alignment ?? (layout === 'list' ? 'split' : 'start');
  const icons = s.showIcons !== false;
  const labelOf = (r: AttributeRow): ReactNode => icons && r.icon ? (
    <span className="inline-flex min-w-0 items-center gap-2">
      <SettingIcon name={r.icon} className="shrink-0 text-text-secondary" style={{ width: 14, height: 14, fontSize: 14 }} />
      <span className="truncate">{r.label}</span>
    </span>
  ) : r.label;

  if (layout === 'list') {
    return (
      <div className="flex flex-col" data-layout="list" style={divider ? { ['--wk-divider' as string]: divider } : undefined}>
        {rows.map((r, i) => (
          <Row
            key={`${r.key}-${i}`}
            label={labelOf(r)}
            value={r.value}
            divider={dividers}
            labelStyle={labelStyle}
            valueStyle={{ ...valueStyle, ...(r.color ? { color: r.color } : {}), ...(align !== 'split' ? { textAlign: 'left' } : {}) }}
            className={cn(
              divider && 'border-[color:var(--wk-divider)]',
              s.striped && 'px-2 even:bg-surface-overlay/60',
              s.striped && !dividers && 'rounded-md',
              align === 'start' && 'grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)]',
              align === 'center' && 'grid grid-cols-2',
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-x-4', GRID[layout] ?? GRID['grid-2'], s.striped ? 'gap-y-1' : 'gap-y-0')} data-layout={layout}>
      {rows.map((r, i) => (
        <div
          key={`${r.key}-${i}`}
          className={cn(
            'flex min-w-0 flex-col gap-1 py-2',
            align === 'center' && 'items-center text-center',
            dividers && layout !== 'columns' && 'border-b border-border',
            dividers && layout === 'columns' && 'border-l border-border pl-4 first:border-l-0 first:pl-0',
            s.striped && 'rounded-md bg-surface-overlay/60 px-2',
          )}
          style={dividers && divider ? { borderColor: divider } : undefined}
          data-part="row"
        >
          <span className="block truncate text-xs font-medium text-text-secondary" style={labelStyle}>{labelOf(r)}</span>
          <span style={r.color ? { color: r.color } : undefined}>
            {r.number !== undefined ? (
              <Metric text={r.number} unit={r.unit} unitPosition={r.unitPosition} size="md" font={s.valueFont} color={r.color ?? s.valueColor} />
            ) : (
              <span className="block truncate text-[15px] font-semibold leading-tight text-text-primary" style={{ ...valueStyle, ...(r.color ? { color: r.color } : {}) }}>{r.value}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export const STAT_ATTRIBUTES_VIEW: WidgetKindView = {
  View: StatAttributesView,
  isEmpty: (data) => {
    const rec = data.record?.record;
    return !rec || Object.keys(rec).length === 0;
  },
  toCsv: (data, settings, format) => [
    ['key', 'value'],
    ...attributeRows(data.record?.record, settings, format).map((r) => [r.key, r.value]),
  ],
};
