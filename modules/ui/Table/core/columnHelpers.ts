// Small helpers shared by every Table mode.

import type { Column, ColumnBreakpoint, DataTableDensity } from '../types';

/** `Column.hideBelow`: the class that hides a header, cell or footer cell under the breakpoint. */
export const hideBelowClass: Record<ColumnBreakpoint, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

/** Cell padding per density; header cells use the same horizontal padding. */
export const densityCellClass: Record<DataTableDensity, string> = {
  comfortable: 'px-4 py-3',
  compact: 'px-3 py-1.5',
};

export const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

/**
 * Returns the standard set of <th> classes for a column header.
 */
export function headerClassFor<T>(col: Column<T>, base: string): string {
  const parts: string[] = [base];
  if (col.align === 'center') parts.push(alignClass.center);
  else if (col.align === 'right') parts.push(alignClass.right);
  else parts.push(alignClass.left);
  if (col.hideBelow) parts.push(hideBelowClass[col.hideBelow]);
  if (col.thClass) parts.push(col.thClass);
  return parts.join(' ');
}

/**
 * Returns the standard set of <td> classes for a column cell.
 */
export function cellClassFor<T>(col: Column<T>, base: string): string {
  const parts: string[] = [base];
  if (col.align === 'center') parts.push(alignClass.center);
  else if (col.align === 'right') parts.push(alignClass.right);
  if (col.hideBelow) parts.push(hideBelowClass[col.hideBelow]);
  if (col.tdClass) parts.push(col.tdClass);
  return parts.join(' ');
}

/**
 * Returns the stringified raw value of a column cell (no `render` applied).
 */
export function rawCellValue<T extends Record<string, unknown>>(
  row: T,
  col: Column<T>,
): string {
  const v = row[col.key as keyof T];
  return v === undefined || v === null ? '' : String(v);
}

/** The column's outward sort key (`Column.sortKey`, else its `key`). */
export function sortKeyOf<T>(col: Column<T>): string {
  return col.sortKey ?? String(col.key);
}

/** Maps sort entries between column keys and outward sort keys (`Column.sortKey`). */
export function sortMappers<T>(columns: readonly Column<T>[]) {
  const out = new Map<string, string>();
  const back = new Map<string, string>();
  for (const col of columns) {
    if (!col.sortKey) continue;
    out.set(String(col.key), col.sortKey);
    back.set(col.sortKey, String(col.key));
  }
  return {
    toWire: <S extends { key: string }>(sort: S[]) => sort.map((s) => ({ ...s, key: out.get(s.key) ?? s.key })),
    fromWire: <S extends { key: string }>(sort: S[]) => sort.map((s) => ({ ...s, key: back.get(s.key) ?? s.key })),
  };
}
