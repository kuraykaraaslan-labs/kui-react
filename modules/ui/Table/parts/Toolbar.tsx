'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { SearchBar } from '../../SearchBar';

// TODO M4: bulk-action toolbar (selected count, Delete/Export/Tag actions).
// TODO M5: column-visibility menu, export menu, density toggle.

const selectClass = cn(
  'rounded-md border border-border bg-surface-base px-2 py-1.5 text-sm text-text-primary',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
);

/**
 * The search box's text, committed after `delayMs` of quiet (0 = at once). A committed value
 * changed from outside (cleared by "Clear all", a controlled query) replaces the text.
 */
function useDebouncedSearch(committed: string, commit: (v: string) => void, delayMs: number) {
  const [text, setText] = useState(committed);
  const [seen, setSeen] = useState(committed);
  if (seen !== committed) {
    setSeen(committed);
    setText(committed);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function change(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    // Clearing the box applies at once; typing waits for a pause.
    if (delayMs <= 0 || v === '') commitRef.current(v);
    else timer.current = setTimeout(() => commitRef.current(v), delayMs);
  }
  return [text, change] as const;
}

export type SortByOption = { value: string; label: string };

export function Toolbar({
  searchable,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  searchDebounceMs = 0,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  rowsPerPageLabel,
  extra,
  start,
  end,
  sortBy,
  className,
  id,
}: {
  searchable: boolean;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (v: string) => void;
  /** Wait this long after the last keystroke before searching (server and manual modes). */
  searchDebounceMs?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (n: number) => void;
  rowsPerPageLabel?: string;
  /** Controls after the search bar (the filter-panel toggle). */
  extra?: React.ReactNode;
  /** Host controls before the search bar (`toolbarStart`). */
  start?: React.ReactNode;
  /** Host controls after the filter toggle (`toolbarEnd`). */
  end?: React.ReactNode;
  /** Card layout: the "Sort by" select (there is no header row to click). */
  sortBy?: { label: string; value: string; options: SortByOption[]; onChange: (value: string) => void };
  className?: string;
  id?: string;
}) {
  const [text, change] = useDebouncedSearch(searchValue, onSearchChange, searchDebounceMs);
  if (!searchable && !pageSizeOptions && !extra && !start && !end && !sortBy) return null;
  const sortId = id ? `${id}-sortby` : 'dt-sortby';
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)} data-part="toolbar">
      {start}
      {searchable && (
        <SearchBar
          id={id ? `${id}-search` : 'dt-search'}
          value={text}
          onChange={change}
          placeholder={searchPlaceholder}
          className="flex-1 min-w-40"
        />
      )}
      {extra}
      {sortBy && (
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor={sortId} className="text-xs text-text-secondary whitespace-nowrap">
            {sortBy.label}
          </label>
          <select
            id={sortId}
            value={sortBy.value}
            onChange={(e) => sortBy.onChange(e.target.value)}
            className={selectClass}
            data-part="sort-by"
          >
            {sortBy.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {end}
      {pageSizeOptions && onPageSizeChange && pageSize !== undefined && (
        <div className="flex items-center gap-2 shrink-0">
          <label
            htmlFor={id ? `${id}-pagesize` : 'dt-pagesize'}
            className="text-xs text-text-secondary whitespace-nowrap"
          >
            {rowsPerPageLabel ?? 'Rows per page:'}
          </label>
          <select
            id={id ? `${id}-pagesize` : 'dt-pagesize'}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={selectClass}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
