'use client';
import { cn } from '@/libs/utils/cn';
import { useState } from 'react';

type PaginationSize = 'sm' | 'md' | 'lg';

/** Visible and accessible strings; `{page}` and `{total}` are filled in. */
export type PaginationLabels = {
  navigation: string;
  first: string;
  previous: string;
  next: string;
  last: string;
  page: string;
  goTo: string;
  go: string;
  jumpTo: string;
};

export const DEFAULT_PAGINATION_LABELS: PaginationLabels = {
  navigation: 'Pagination',
  first: 'First page',
  previous: 'Previous page',
  next: 'Next page',
  last: 'Last page',
  page: 'Page {page}',
  goTo: 'Go to',
  go: 'Go',
  jumpTo: 'Jump to page, 1–{total}',
};

const fill = (t: string, v: Record<string, number>) => t.replace(/\{(\w+)\}/g, (a, k: string) => (k in v ? String(v[k]) : a));

const sizeMap: Record<PaginationSize, { page: string; nav: string }> = {
  sm: { page: 'w-7 h-7 text-xs',    nav: 'px-2 py-1 text-xs'    },
  md: { page: 'w-9 h-9 text-sm',    nav: 'px-3 py-1.5 text-sm'  },
  lg: { page: 'w-10 h-10 text-base', nav: 'px-4 py-2 text-base' },
};

export function Pagination({
  page,
  totalPages,
  onPageChange,
  size = 'md',
  showFirstLast = false,
  showJumpTo = false,
  labels,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  size?: PaginationSize;
  showFirstLast?: boolean;
  showJumpTo?: boolean;
  /** Translated strings; any left out keep their English default. */
  labels?: Partial<PaginationLabels>;
  className?: string;
}) {
  const l = { ...DEFAULT_PAGINATION_LABELS, ...labels };
  const [jumpValue, setJumpValue] = useState('');
  const s = sizeMap[size];

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visiblePages = pages.filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );
  const withEllipsis: (number | 'ellipsis')[] = [];
  let prev: number | null = null;
  for (const p of visiblePages) {
    if (prev !== null && p - prev > 1) withEllipsis.push('ellipsis');
    withEllipsis.push(p);
    prev = p;
  }

  function navBtnClass(disabled: boolean) {
    return cn(
      'rounded-md font-medium border transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
      s.nav,
      disabled
        ? 'border-border text-text-disabled cursor-not-allowed opacity-50'
        : 'border-border text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
    );
  }

  function handleJump(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = parseInt(jumpValue, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      onPageChange(n);
      setJumpValue('');
    }
  }

  return (
    <nav aria-label={l.navigation} className={cn('flex items-center gap-1 flex-wrap', className)}>
      {showFirstLast && (
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label={l.first}
          className={navBtnClass(page <= 1)}
        >
          «
        </button>
      )}

      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={l.previous}
        className={navBtnClass(page <= 1)}
      >
        ‹
      </button>

      {withEllipsis.map((item, i) =>
        item === 'ellipsis' ? (
          <span key={`e-${i}`} className={cn('text-text-disabled', s.nav)}>…</span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={fill(l.page, { page: item })}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              'rounded-md font-medium border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              s.page,
              item === page
                ? 'bg-primary text-primary-fg border-primary'
                : 'border-border text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
            )}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={l.next}
        className={navBtnClass(page >= totalPages)}
      >
        ›
      </button>

      {showFirstLast && (
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label={l.last}
          className={navBtnClass(page >= totalPages)}
        >
          »
        </button>
      )}

      {showJumpTo && (
        <form onSubmit={handleJump} className="flex items-center gap-1.5 ml-2">
          <label htmlFor="pagination-jump" className="text-xs text-text-secondary whitespace-nowrap">
            {l.goTo}
          </label>
          <input
            id="pagination-jump"
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            aria-label={fill(l.jumpTo, { total: totalPages })}
            className={cn(
              'w-14 rounded-md border border-border bg-surface-base text-center text-sm text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              'py-1 px-1'
            )}
          />
          <button
            type="submit"
            className={cn(
              'rounded-md border border-border text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              'px-2 py-1 text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
            )}
          >
            {l.go}
          </button>
        </form>
      )}
    </nav>
  );
}
