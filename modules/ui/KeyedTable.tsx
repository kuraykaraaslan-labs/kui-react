'use client';
import { DataTable } from './Table/DataTable';
import type { Column, DataTableRowId } from './Table/types';

/**
 * KeyedTable — a rows-in, events-out table for data that changes under the viewer (live lists, dashboard tables).
 *
 * @deprecated Use `<DataTable mode="manual" rowId={…} rowState={…} keyboardNavigation />`: `DataTable` now has
 * everything this table was made for (rows keyed by a stable id, keyboard rows, `new` / `leaving` row states,
 * selection with refused rows, loading / error with retry / empty states, `hideBelow` columns), and adds sorting,
 * filters and paging reported to the host. Kept as a thin wrapper so existing consumers keep working.
 */
export type KeyedTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  /** Hide the column below this breakpoint (for every viewer), so a phone width needs no horizontal scroll. */
  hideBelow?: 'sm' | 'md' | 'lg';
  className?: string;
};

export type KeyedTableRowState = 'new' | 'leaving' | undefined;

export type KeyedTableSelection<T> = {
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** A row that cannot be selected returns the reason (shown as the checkbox title). */
  isSelectable?: (row: T) => true | string;
  /** Accessible name of a row's checkbox ("Select Pump 4"). */
  rowLabel?: (row: T) => string;
};

export type KeyedTableMessages = {
  loading: string;
  retry: string;
  selectAll: string;
  selectRow: string;
};

const DEFAULT_MESSAGES: KeyedTableMessages = {
  loading: 'Loading…',
  retry: 'Retry',
  selectAll: 'Select all rows on this page',
  selectRow: 'Select row',
};

export type KeyedTableProps<T> = {
  columns: KeyedTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  /** Accessible name of the table. */
  caption: string;
  onRowClick?: (row: T) => void;
  rowState?: (row: T) => KeyedTableRowState;
  rowClassName?: (row: T) => string | undefined;
  selection?: KeyedTableSelection<T>;
  loading?: boolean;
  /** An error replaces the rows; `onRetry` adds a retry button. */
  error?: React.ReactNode;
  onRetry?: () => void;
  emptyText?: React.ReactNode;
  messages?: Partial<KeyedTableMessages>;
  dense?: boolean;
  className?: string;
};

type AnyRow = Record<string, unknown>;

export function KeyedTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  onRowClick,
  rowState,
  rowClassName,
  selection,
  loading = false,
  error,
  onRetry,
  emptyText = 'Nothing to show.',
  messages,
  dense = false,
  className,
}: KeyedTableProps<T>) {
  const m = { ...DEFAULT_MESSAGES, ...messages };
  // DataTable rows are records; KeyedTable never constrained T, so the row type is widened here only.
  const asT = (row: AnyRow) => row as unknown as T;
  const dataColumns: Column<AnyRow>[] = columns.map((col) => ({
    key: col.key,
    header: col.header,
    align: col.align,
    hideBelow: col.hideBelow,
    tdClass: col.className,
    render: col.render ? (row) => col.render?.(asT(row)) : undefined,
  }));

  return (
    <DataTable<AnyRow>
      mode="manual"
      columns={dataColumns}
      rows={rows as unknown as AnyRow[]}
      rowId={(row) => getRowKey(asT(row))}
      caption={caption}
      searchable={false}
      pageSizeOptions={[]}
      keyboardNavigation
      onRowClick={onRowClick ? (row) => onRowClick(asT(row)) : undefined}
      rowState={rowState ? (row) => rowState(asT(row)) : undefined}
      rowClassName={rowClassName ? (row) => rowClassName(asT(row)) : undefined}
      selectable={selection !== undefined}
      selectedRowIds={selection ? [...selection.selected] : undefined}
      onSelectionChange={
        selection ? (ids: DataTableRowId[]) => selection.onChange(new Set(ids.map(String))) : undefined
      }
      isRowSelectable={selection?.isSelectable ? (row) => selection.isSelectable!(asT(row)) : undefined}
      rowSelectLabel={(row) => selection?.rowLabel?.(asT(row)) ?? `${m.selectRow} ${getRowKey(asT(row))}`}
      loading={loading}
      error={error || undefined}
      onRetry={onRetry}
      emptyMessage={emptyText}
      density={dense ? 'compact' : 'comfortable'}
      // KeyedTable's className landed on the bordered box; `border-0` there meant "no frame".
      bordered={!/(^|\s)border-0(\s|$)/.test(className ?? '')}
      messages={{ loading: m.loading, retry: m.retry, selectAllRows: m.selectAll }}
      className={className}
    />
  );
}
