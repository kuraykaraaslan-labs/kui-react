'use client';
import { useCallback, useMemo, useState } from 'react';
import type {
  DataTableDatePreset,
  DataTableFilterField,
  DataTableFilterValue,
  DataTableFilterValues,
  DataTableMessages,
  DataTableNumberRange,
} from '../types';

// Filter panel (`filterFields`): which values count as set, how a row matches
// them client-side, the applied-values state and the text of the active-filter chips.

function isNumberRange(value: DataTableFilterValue | undefined): value is DataTableNumberRange {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && ('min' in value || 'max' in value);
}

/** Whether a field's value narrows the rows at all. */
export function isFilterValueActive<T>(
  field: DataTableFilterField<T>,
  value: DataTableFilterValue | undefined,
): boolean {
  if (value === undefined || value === null || value === '' || value === false) return false;
  if (typeof value === 'number') return !Number.isNaN(value);
  if (Array.isArray(value)) {
    if (field.type === 'range') return value[0] !== field.min || value[1] !== field.max;
    return value.length > 0;
  }
  if (isNumberRange(value)) return value.min !== null || value.max !== null;
  if (typeof value === 'object') return Boolean(value.from || value.to);
  return true;
}

/** The set values only, in field order — what a server receives. */
export function activeFilterValues<T>(
  fields: readonly DataTableFilterField<T>[],
  values: DataTableFilterValues,
): DataTableFilterValues {
  const out: DataTableFilterValues = {};
  for (const field of fields) {
    if (isFilterValueActive(field, values[field.id])) out[field.id] = values[field.id];
  }
  return out;
}

/** Every field's `defaultValue`, keyed by field id. */
export function defaultFilterValues<T>(fields: readonly DataTableFilterField<T>[]): DataTableFilterValues {
  const out: DataTableFilterValues = {};
  for (const field of fields) {
    if (field.defaultValue !== undefined) out[field.id] = field.defaultValue;
  }
  return out;
}

const day = (raw: unknown) => (raw === undefined || raw === null ? '' : String(raw).slice(0, 10));

/** Default client-side match: compares `row[field.id]` by field type. */
export function matchFilterField<T extends Record<string, unknown>>(
  field: DataTableFilterField<T>,
  row: T,
  value: DataTableFilterValue,
): boolean {
  if (field.match) return field.match(row, value);
  const raw = row[field.id];
  const rawList = Array.isArray(raw) ? raw.map(String) : [String(raw ?? '')];
  switch (field.type) {
    case 'text':
      return String(raw ?? '').toLowerCase().includes(String(value).toLowerCase());
    case 'number':
      return Number(raw) === value;
    case 'select':
    case 'radio':
      return rawList.includes(String(value));
    case 'multiselect':
    case 'checkboxes':
      return rawList.some((r) => (value as string[]).includes(r));
    case 'checkbox':
      return Boolean(raw);
    case 'date':
      return day(raw) === value;
    case 'daterange': {
      const d = day(raw);
      const { from, to } = value as { from: string | null; to: string | null };
      return d !== '' && (!from || d >= from) && (!to || d <= to);
    }
    case 'range': {
      const n = Number(raw);
      const [lo, hi] = value as [number, number];
      return n >= lo && n <= hi;
    }
    case 'numberrange': {
      if (raw === undefined || raw === null || raw === '') return false;
      const n = Number(raw);
      const { min, max } = value as DataTableNumberRange;
      return (min === null || n >= min) && (max === null || n <= max);
    }
    case 'custom':
      // Without `match` a custom field only reaches the server.
      return true;
  }
}

export type UseFilterPanelArgs<T> = {
  fields: readonly DataTableFilterField<T>[];
  /** Controlled applied values. */
  value?: DataTableFilterValues;
  /** Initial applied values when uncontrolled; each field's `defaultValue` fills the gaps. */
  defaultValue?: DataTableFilterValues;
  onChange?: (values: DataTableFilterValues) => void;
};

/** Applied filter-panel values (controlled or not) and the subset that is set. */
export function useFilterPanel<T>({ fields, value, defaultValue, onChange }: UseFilterPanelArgs<T>) {
  const [inner, setInner] = useState<DataTableFilterValues>(() => ({
    ...defaultFilterValues(fields),
    ...defaultValue,
  }));
  const controlled = value !== undefined;
  const applied = controlled ? value : inner;
  const active = useMemo(() => activeFilterValues(fields, applied), [fields, applied]);

  const commit = useCallback(
    (next: DataTableFilterValues) => {
      if (!controlled) setInner(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );

  return { applied, active, activeCount: Object.keys(active).length, commit };
}

export type UseFilterPanelReturn = ReturnType<typeof useFilterPanel>;

// ---------------------------------------------------------------------------
// Date-range presets
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` in local time, the wire format of date filters. */
export function toDay(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The built-in presets (`presets: true`), relative to `today`. */
export function builtInDatePresets(msgs: DataTableMessages, today: Date = new Date()): DataTableDatePreset[] {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const back = (days: number) => toDay(new Date(y, m, d - days));
  return [
    { label: msgs.presetToday ?? 'Today', from: toDay(today), to: toDay(today) },
    { label: msgs.presetLast7Days ?? 'Last 7 days', from: back(6), to: toDay(today) },
    { label: msgs.presetLast30Days ?? 'Last 30 days', from: back(29), to: toDay(today) },
    { label: msgs.presetThisMonth ?? 'This month', from: toDay(new Date(y, m, 1)), to: toDay(today) },
    {
      label: msgs.presetLastMonth ?? 'Last month',
      from: toDay(new Date(y, m - 1, 1)),
      to: toDay(new Date(y, m, 0)),
    },
  ];
}

// ---------------------------------------------------------------------------
// Active-filter chips
// ---------------------------------------------------------------------------

function optionLabel(options: readonly { label: string; value: string }[], v: string): string {
  return options.find((o) => o.value === v)?.label ?? v;
}

/** Readable text of a set value, without the field label. */
export function filterValueText<T>(
  field: DataTableFilterField<T>,
  value: DataTableFilterValue,
): string {
  if (field.formatChip) return field.formatChip(value);
  switch (field.type) {
    case 'select':
    case 'radio':
      return optionLabel(field.options, String(value));
    case 'multiselect':
    case 'checkboxes':
      return (value as string[]).map((v) => optionLabel(field.options, v)).join(', ');
    case 'checkbox':
      return '';
    case 'daterange': {
      const { from, to } = value as { from: string | null; to: string | null };
      if (from && to) return from === to ? from : `${from} – ${to}`;
      return from ? `≥ ${from}` : `≤ ${to}`;
    }
    case 'range': {
      const [lo, hi] = value as [number, number];
      return `${lo} – ${hi}`;
    }
    case 'numberrange': {
      const { min, max } = value as DataTableNumberRange;
      if (min !== null && max !== null) return `${min} – ${max}`;
      return min !== null ? `≥ ${min}` : `≤ ${max}`;
    }
    default:
      return Array.isArray(value) ? value.join(', ') : String(value);
  }
}

/** One chip per set field: `Status: Paid`; a checkbox field shows its label alone. */
export function filterChipText<T>(field: DataTableFilterField<T>, value: DataTableFilterValue): string {
  const text = filterValueText(field, value);
  return text ? `${field.label}: ${text}` : field.label;
}
