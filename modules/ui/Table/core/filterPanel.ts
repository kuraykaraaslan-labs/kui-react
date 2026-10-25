'use client';
import { useCallback, useMemo, useState } from 'react';
import type {
  DataTableFilterField,
  DataTableFilterValue,
  DataTableFilterValues,
} from '../types';

// Filter panel (`filterFields`): which values count as set, how a row matches
// them client-side, and the applied-values state.

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
    case 'custom':
      // Without `match` a custom field only reaches the server.
      return true;
  }
}

export type UseFilterPanelArgs<T> = {
  fields: readonly DataTableFilterField<T>[];
  /** Controlled applied values. */
  value?: DataTableFilterValues;
  /** Initial applied values when uncontrolled. */
  defaultValue?: DataTableFilterValues;
  onChange?: (values: DataTableFilterValues) => void;
};

/** Applied filter-panel values (controlled or not) and the subset that is set. */
export function useFilterPanel<T>({ fields, value, defaultValue, onChange }: UseFilterPanelArgs<T>) {
  const [inner, setInner] = useState<DataTableFilterValues>(defaultValue ?? {});
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
