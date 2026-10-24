'use client';
import { useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';

/**
 * KeyedTable — a rows-in, events-out table for data that changes under the viewer (live lists, dashboard tables).
 *
 * What the other tables do not give (DataTable's M4/M6 plans): rows keyed by a stable id (a live upsert keeps focus and
 * selection on the right row), keyboard row focus (one row in the tab order, Arrow Up/Down, Home/End, Enter or Space runs
 * `onRowClick`), a per-row state (`new` highlights, `leaving` fades out before the host drops the row), optional selection
 * checkboxes for bulk actions across server pages, and loading / error (with retry) / empty states. Paging, sorting and
 * fetching stay with the host. Columns can hide below a breakpoint so a phone width needs no horizontal scroll.
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

const HIDE: Record<NonNullable<KeyedTableColumn<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

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
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const keys = useMemo(() => rows.map(getRowKey), [rows, getRowKey]);
  // The one row in the tab order: the focused one while it exists, else the first.
  const tabKey = focusKey !== null && keys.includes(focusKey) ? focusKey : (keys[0] ?? null);
  const cellPad = dense ? 'px-3 py-1.5' : 'px-4 py-2.5';
  const colCount = columns.length + (selection ? 1 : 0);

  const selectable = selection
    ? rows.filter((r) => (selection.isSelectable ? selection.isSelectable(r) === true : true)).map(getRowKey)
    : [];
  const selectedVisible = selection ? selectable.filter((k) => selection.selected.has(k)).length : 0;
  const allSelected = selectable.length > 0 && selectedVisible === selectable.length;

  function focusRow(index: number) {
    const key = keys[Math.max(0, Math.min(keys.length - 1, index))];
    if (key === undefined) return;
    setFocusKey(key);
    const rowsEl = bodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row-key]') ?? [];
    Array.from(rowsEl).find((el) => el.dataset.rowKey === key)?.focus();
  }

  function onRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>, row: T, index: number) {
    if (e.target !== e.currentTarget) return; // a control inside the row handles its own keys
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusRow(index + 1); break;
      case 'ArrowUp': e.preventDefault(); focusRow(index - 1); break;
      case 'Home': e.preventDefault(); focusRow(0); break;
      case 'End': e.preventDefault(); focusRow(keys.length - 1); break;
      case 'Enter':
      case ' ':
        if (onRowClick) { e.preventDefault(); onRowClick(row); }
        break;
      default:
    }
  }

  function toggleAll() {
    if (!selection) return;
    const next = new Set(selection.selected);
    for (const k of selectable) {
      if (allSelected) next.delete(k);
      else next.add(k);
    }
    selection.onChange(next);
  }

  function toggleOne(key: string) {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onChange(next);
  }

  let body: React.ReactNode;
  if (error) {
    body = (
      <tr>
        <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-error" role="alert">
          <div className="flex flex-col items-center gap-2">
            <span>{error}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-border px-3 py-1 text-xs font-medium text-text-primary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                {m.retry}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  } else if (rows.length === 0) {
    body = (
      <tr>
        <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-text-secondary">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              {/* not <Spinner>: its screen-reader text is fixed English; the visible text here is the translated one */}
              <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
              {m.loading}
            </span>
          ) : emptyText}
        </td>
      </tr>
    );
  } else {
    body = rows.map((row, index) => {
      const key = keys[index];
      const state = rowState?.(row);
      const canSelect = selection ? (selection.isSelectable ? selection.isSelectable(row) : true) : true;
      return (
        <tr
          key={key}
          data-row-key={key}
          data-state={state}
          tabIndex={key === tabKey ? 0 : -1}
          aria-selected={selection ? selection.selected.has(key) : undefined}
          onFocus={(e) => { if (e.target === e.currentTarget) setFocusKey(key); }}
          onKeyDown={(e) => onRowKeyDown(e, row, index)}
          onClick={onRowClick ? (e) => {
            // a click on a control inside the row (a checkbox, a link, a button) is that control's
            if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label')) return;
            onRowClick(row);
          } : undefined}
          className={cn(
            'transition-[background-color,opacity] duration-500 hover:bg-surface-overlay',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus',
            onRowClick && 'cursor-pointer',
            state === 'new' && 'bg-primary-subtle',
            state === 'leaving' && 'opacity-40',
            rowClassName?.(row),
          )}
        >
          {selection && (
            <td className={cn(cellPad, 'w-10')}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border-strong accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                checked={selection.selected.has(key)}
                disabled={canSelect !== true}
                title={canSelect === true ? undefined : canSelect}
                aria-label={selection.rowLabel?.(row) ?? `${m.selectRow} ${key}`}
                onChange={() => toggleOne(key)}
              />
            </td>
          )}
          {columns.map((col) => (
            <td
              key={col.key}
              className={cn(cellPad, 'text-text-primary', ALIGN[col.align ?? 'left'], col.hideBelow && HIDE[col.hideBelow], col.className)}
            >
              {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
            </td>
          ))}
        </tr>
      );
    });
  }

  return (
    <div
      className={cn('w-full overflow-x-auto rounded-lg border border-border', className)}
      aria-busy={loading || undefined}
    >
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-surface-sunken">
          <tr>
            {selection && (
              <th scope="col" className={cn(cellPad, 'w-10')}>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border-strong accent-[var(--primary)] disabled:opacity-40"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = selectedVisible > 0 && !allSelected; }}
                  disabled={selectable.length === 0}
                  aria-label={m.selectAll}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  cellPad,
                  'text-xs font-semibold uppercase tracking-wider text-text-secondary',
                  ALIGN[col.align ?? 'left'],
                  col.hideBelow && HIDE[col.hideBelow],
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={bodyRef} className="divide-y divide-border bg-surface-base">
          {body}
        </tbody>
      </table>
    </div>
  );
}
