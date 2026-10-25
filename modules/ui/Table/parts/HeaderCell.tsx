'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronUp,
  faChevronDown,
  faSort,
} from '@fortawesome/free-solid-svg-icons';
import type { Column, DataTableDensity, DataTableMessages, SortDirection, SortState } from '../types';
import { headerClassFor } from '../core/columnHelpers';
import { FilterPopover } from './FilterPopover';

// TODO M2: column resize handle, drag-reorder handle, pin toggle, hide menu.

const HEADER_PAD: Record<DataTableDensity, string> = {
  comfortable: 'px-4 py-3',
  compact: 'px-3 py-2',
};

export function HeaderCell<T extends Record<string, unknown>>({
  column,
  sort,
  showSortOrder = true,
  filterValue,
  onToggleSort,
  onSetFilter,
  density = 'comfortable',
  msgs,
  unstyled = false,
}: {
  column: Column<T>;
  sort: SortState[];
  /**
   * Show the priority number of a multi-column sort. The table turns it on once the user has sorted, so a default
   * multi-column order shows plain headings.
   */
  showSortOrder?: boolean;
  filterValue: string;
  onToggleSort: (key: string, shiftKey: boolean) => void;
  onSetFilter: (key: string, value: string) => void;
  density?: DataTableDensity;
  msgs?: DataTableMessages;
  /** The host draws the look (`DataTable` `unstyled`): only the column's own classes and style. */
  unstyled?: boolean;
}) {
  const key = String(column.key);
  const sortEntry = sort.find((s) => s.key === key);
  const dir: SortDirection | null = sortEntry?.dir ?? null;
  const ariaSort = column.sortable
    ? dir === 'asc'
      ? 'ascending'
      : dir === 'desc'
        ? 'descending'
        : 'none'
    : undefined;

  const sortOrder =
    showSortOrder && sortEntry && sort.length > 1 ? sort.findIndex((s) => s.key === key) + 1 : null;

  const headerClass = headerClassFor(
    column,
    unstyled ? '' : cn(HEADER_PAD[density], 'text-xs font-semibold text-text-secondary uppercase tracking-wider'),
  );

  const indicators = (
    <>
      {sortOrder !== null && (
        <span
          aria-hidden="true"
          data-part="sort-order"
          className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-fg px-1"
        >
          {sortOrder}
        </span>
      )}
      {column.filter && (
        <FilterPopover
          column={column}
          value={filterValue}
          onChange={(v) => onSetFilter(key, v)}
          msgs={msgs}
        />
      )}
    </>
  );

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={headerClass}
      style={column.width || column.thStyle ? { ...(column.width ? { width: column.width } : {}), ...column.thStyle } : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {column.sortable ? (
          // A real button, so the sort is reachable and operable from the keyboard.
          <button
            type="button"
            onClick={(e) => onToggleSort(key, e.shiftKey)}
            className={cn(
              'inline-flex items-center gap-1 select-none transition-colors',
              unstyled ? 'cursor-pointer rounded-sm' : 'rounded uppercase tracking-wider',
              // An end-aligned heading keeps its text flush right, the arrow before it.
              unstyled && column.align === 'right' && 'flex-row-reverse',
              'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              dir && 'text-text-primary',
            )}
            data-part="sort"
          >
            {column.header}
            <FontAwesomeIcon
              icon={dir === 'asc' ? faChevronUp : dir === 'desc' ? faChevronDown : faSort}
              className={cn('w-2.5 h-2.5', !dir && 'opacity-50')}
              aria-hidden="true"
            />
          </button>
        ) : (
          column.header
        )}
        {indicators}
      </span>
    </th>
  );
}
