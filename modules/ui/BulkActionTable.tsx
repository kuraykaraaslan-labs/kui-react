'use client';

import { useMemo, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Table } from './Table/Table';
import type { Column } from './Table/types';

/**
 * A table with row selection and a bulk-action bar.
 *
 * `DataTable` has id-keyed selection too (`selectable` + `rowId`). Use this
 * component when you need the bulk-action bar and "select all N matching";
 * DataTable's own bulk-action toolbar is still a `TODO M4`.
 *
 * ## Selection is by id, and "select all" is honest
 *
 * The header checkbox selects the rows currently rendered, and the bar says so.
 * "Select all 40 on this page" and "select all 1,240 matching" are different
 * operations, and conflating them is how a bulk enrich spends credits on twelve
 * hundred companies nobody chose. When more rows match than are shown, the bar
 * offers the wider selection explicitly rather than assuming it.
 */

export type BulkAction<Id> = {
  /** Stable key, used for React and for telemetry. */
  key: string;
  label: string;
  icon?: ReactNode;
  /** Rendered in a way that reads as destructive. */
  destructive?: boolean;
  onAction: (ids: Id[]) => void;
  /** Disable for the current selection, with a reason for the tooltip. */
  disabled?: (ids: Id[]) => string | false;
};

export type BulkActionTableProps<T extends Record<string, unknown>, Id extends string | number> = {
  columns: Column<T>[];
  rows: T[];
  /** Stable identity for a row. Never the array index. */
  rowId: (row: T) => Id;
  selected: readonly Id[];
  onSelectedChange: (ids: Id[]) => void;
  actions?: BulkAction<Id>[];
  /**
   * Total rows matching the current filter, when more exist than are rendered.
   * Supplying it turns on the "select all N matching" affordance.
   */
  totalMatching?: number;
  /** Called when the user asks for every matching row, not just this page. */
  onSelectAllMatching?: () => void;
  /** Rows that cannot be selected, with the reason shown on the checkbox. */
  isRowSelectable?: (row: T) => string | true;
  caption?: string;
  emptyMessage?: string;
  className?: string;
  labels?: Partial<typeof DEFAULT_LABELS>;
};

const DEFAULT_LABELS = {
  selectRow: 'Select row',
  selectAllOnPage: 'Select all rows on this page',
  selectedCount: (n: number) => `${n} selected`,
  selectAllMatching: (n: number) => `Select all ${n} matching`,
  clear: 'Clear selection',
};

export function BulkActionTable<
  T extends Record<string, unknown>,
  Id extends string | number,
>({
  columns,
  rows,
  rowId,
  selected,
  onSelectedChange,
  actions = [],
  totalMatching,
  onSelectAllMatching,
  isRowSelectable,
  caption,
  emptyMessage,
  className,
  labels: labelOverrides,
}: BulkActionTableProps<T, Id>) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const selectedSet = useMemo(() => new Set<Id>(selected), [selected]);

  const selectableRows = useMemo(
    () => rows.filter((row) => (isRowSelectable ? isRowSelectable(row) === true : true)),
    [rows, isRowSelectable],
  );

  const visibleSelectedCount = selectableRows.filter((r) => selectedSet.has(rowId(r))).length;
  const allVisibleSelected =
    selectableRows.length > 0 && visibleSelectedCount === selectableRows.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  function toggleRow(id: Id) {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange([...next]);
  }

  function toggleAllVisible() {
    const next = new Set(selectedSet);
    if (allVisibleSelected) {
      // Deselect only what is visible. A selection made on page 1 must survive
      // clearing page 2, or the header checkbox quietly discards work.
      for (const row of selectableRows) next.delete(rowId(row));
    } else {
      for (const row of selectableRows) next.add(rowId(row));
    }
    onSelectedChange([...next]);
  }

  const headerCheckbox = (
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-border-strong accent-[var(--primary)]"
      checked={allVisibleSelected}
      // `indeterminate` is a DOM property, not an attribute — setting it via a
      // ref callback is the only way it renders, and without it a partial
      // selection looks identical to none at all.
      ref={(el) => {
        if (el) el.indeterminate = someVisibleSelected;
      }}
      onChange={toggleAllVisible}
      aria-label={labels.selectAllOnPage}
      disabled={selectableRows.length === 0}
    />
  );

  const selectionColumn: Column<T> = {
    key: '__selection',
    header: headerCheckbox,
    thClass: 'w-10',
    tdClass: 'w-10',
    render: (row) => {
      const id = rowId(row);
      const selectable = isRowSelectable ? isRowSelectable(row) : true;
      const reason = selectable === true ? undefined : selectable;

      return (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border-strong accent-[var(--primary)] disabled:opacity-40"
          checked={selectedSet.has(id)}
          disabled={reason !== undefined}
          title={reason}
          onChange={() => toggleRow(id)}
          aria-label={`${labels.selectRow} ${String(id)}`}
        />
      );
    },
  };

  const columnsWithSelection: Column<T>[] = [selectionColumn, ...columns];

  const hasMoreMatching =
    typeof totalMatching === 'number' && totalMatching > rows.length && onSelectAllMatching;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {selected.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className={cn(
            'flex flex-wrap items-center gap-3 rounded-lg border border-border',
            'bg-surface-overlay px-3 py-2',
          )}
        >
          <span className="text-sm font-medium text-text-primary">
            {labels.selectedCount(selected.length)}
          </span>

          {hasMoreMatching && (
            <button
              type="button"
              onClick={onSelectAllMatching}
              className="text-sm text-primary hover:underline"
            >
              {labels.selectAllMatching(totalMatching)}
            </button>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {actions.map((action) => {
              const disabledReason = action.disabled?.([...selected]);
              return (
                <button
                  key={action.key}
                  type="button"
                  disabled={Boolean(disabledReason)}
                  title={disabledReason || undefined}
                  onClick={() => action.onAction([...selected])}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm',
                    'transition-colors motion-reduce:transition-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    action.destructive
                      ? 'bg-error text-white hover:opacity-90'
                      : 'bg-primary text-primary-fg hover:bg-primary-hover',
                  )}
                >
                  {action.icon}
                  {action.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => onSelectedChange([])}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              {labels.clear}
            </button>
          </div>
        </div>
      )}

      <Table<T>
        columns={columnsWithSelection}
        rows={rows}
        caption={caption}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
