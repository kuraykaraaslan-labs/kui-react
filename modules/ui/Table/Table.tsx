'use client';
import { cn } from '@/libs/utils/cn';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown, faSort } from '@fortawesome/free-solid-svg-icons';
import { headerClassFor, cellClassFor } from './core/columnHelpers';
import { applySort } from './core/useTable';
import type { Column, SortDirection } from './types';

// Low-level "dumb" table primitive. Identical surface to the legacy
// `modules/ui/Table.tsx` — defaultSortKey/Dir + single-column sort cycle.
// Stateless except for the (optional) sort cycle.

export function Table<T extends Record<string, unknown>>({
  columns,
  rows,
  caption,
  emptyMessage = 'No results found.',
  defaultSortKey,
  defaultSortDir,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  caption?: string;
  emptyMessage?: string;
  defaultSortKey?: string;
  defaultSortDir?: SortDirection;
  className?: string;
}) {
  const [sortKey, setSortKey] = useState<string>(defaultSortKey ?? '');
  const [sortDir, setSortDir] = useState<SortDirection | null>(
    defaultSortDir ?? null,
  );

  function handleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortDir(null);
    setSortKey('');
  }

  // The DataTable's sort: numbers and dates by value, empty cells last in both directions.
  const sorted = sortKey && sortDir ? applySort(rows, [{ key: sortKey, dir: sortDir }]) : rows;
  const sourceIndex = new Map(rows.map((r, i) => [r, i]));

  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-lg border border-border',
        className,
      )}
      tabIndex={0}
      role="region"
      aria-label={caption ?? 'Table'}
    >
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface-sunken border-b border-border">
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === String(col.key);
              const dir = isSorted ? sortDir : null;
              return (
                <th
                  key={String(col.key)}
                  scope="col"
                  aria-sort={
                    col.sortable
                      ? isSorted && dir === 'asc'
                        ? 'ascending'
                        : isSorted && dir === 'desc'
                          ? 'descending'
                          : 'none'
                      : undefined
                  }
                  className={cn(
                    headerClassFor(
                      col,
                      'px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider',
                    ),
                    col.sortable &&
                      'cursor-pointer select-none hover:text-text-primary transition-colors',
                  )}
                  onClick={
                    col.sortable ? () => handleSort(String(col.key)) : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <FontAwesomeIcon
                        icon={
                          dir === 'asc'
                            ? faChevronUp
                            : dir === 'desc'
                              ? faChevronDown
                              : faSort
                        }
                        className="w-2.5 h-2.5"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface-base">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-text-secondary"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-surface-overlay transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cellClassFor(col, 'px-4 py-3 text-text-primary')}
                  >
                    {col.render
                      ? col.render(row, { index: sourceIndex.get(row) ?? i, id: sourceIndex.get(row) ?? i })
                      : String(row[col.key as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
