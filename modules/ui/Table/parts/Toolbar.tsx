'use client';
import { cn } from '@/libs/utils/cn';
import { SearchBar } from '../../SearchBar';

// TODO M4: bulk-action toolbar (selected count, Delete/Export/Tag actions).
// TODO M5: column-visibility menu, export menu, density toggle.

export function Toolbar({
  searchable,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  rowsPerPageLabel,
  extra,
  className,
  id,
}: {
  searchable: boolean;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (v: string) => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (n: number) => void;
  rowsPerPageLabel?: string;
  /** Controls after the search bar (the filter-panel toggle). */
  extra?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  if (!searchable && !pageSizeOptions && !extra) return null;
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {searchable && (
        <SearchBar
          id={id ? `${id}-search` : 'dt-search'}
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="flex-1 min-w-40"
        />
      )}
      {extra}
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
            className={cn(
              'rounded-md border border-border bg-surface-base px-2 py-1.5 text-sm text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            )}
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
