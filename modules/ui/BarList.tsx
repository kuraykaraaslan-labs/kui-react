'use client';
import { useMemo } from 'react';
import { cn } from '@/libs/utils/cn';

/**
 * BarList — a ranked breakdown: label, a horizontal bar to scale and the value (phase 11.12).
 *
 * For report pages ("carts by status", "top coupons", "revenue by channel"): rows sort by value unless told otherwise,
 * every bar is scaled to the largest value (or `max`), the value column lines up, and a row can be a link. Empty data
 * shows `emptyMessage`. Use a DataTable when the reader needs to sort by several columns; use this when one number per
 * label is the point.
 */
export type BarListItem = {
  id?: string;
  label: React.ReactNode;
  value: number;
  /** Text after the label (a count, a badge). */
  meta?: React.ReactNode;
  href?: string;
  /** A tone class for the bar (`bg-success`, `bg-warning`); defaults to the primary colour. */
  barClassName?: string;
};

export function BarList({
  items,
  sort = 'value',
  max,
  valueFormatter = (v) => v.toLocaleString(),
  showPercent = false,
  limit,
  emptyMessage = 'No data.',
  ariaLabel,
  className,
}: {
  items: BarListItem[];
  /** `value` (largest first), `label` (A–Z) or `none` (as given). */
  sort?: 'value' | 'label' | 'none';
  /** Full-width value; defaults to the largest value. */
  max?: number;
  valueFormatter?: (value: number) => string;
  /** Adds each row's share of the total after the value. */
  showPercent?: boolean;
  /** Show the first N rows only. */
  limit?: number;
  emptyMessage?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  const rows = useMemo(() => {
    const out = [...items];
    if (sort === 'value') out.sort((a, b) => b.value - a.value);
    else if (sort === 'label') out.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
    return limit ? out.slice(0, limit) : out;
  }, [items, sort, limit]);

  if (rows.length === 0) {
    return <p className={cn('text-sm text-text-secondary', className)} data-part="empty">{emptyMessage}</p>;
  }
  const top = Math.max(1, max ?? Math.max(...items.map((i) => i.value)));
  const sum = items.reduce((s, i) => s + i.value, 0) || 1;

  return (
    <ul className={cn('space-y-3', className)} aria-label={ariaLabel} data-part="bar-list">
      {rows.map((r, i) => {
        const width = `${Math.max(0, Math.min(100, (r.value / top) * 100))}%`;
        const head = (
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-text-primary">{r.label}</span>
              {r.meta && <span className="shrink-0 text-xs text-text-secondary">{r.meta}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-text-secondary">
              {valueFormatter(r.value)}
              {showPercent && <span className="ml-1.5 text-xs text-text-disabled">{((r.value / sum) * 100).toFixed(1)}%</span>}
            </span>
          </div>
        );
        const bar = (
          <div className="h-2 w-full rounded bg-surface-sunken" aria-hidden="true">
            <div className={cn('h-2 rounded', r.barClassName ?? 'bg-primary')} style={{ width }} />
          </div>
        );
        return (
          <li key={r.id ?? (typeof r.label === 'string' ? r.label : i)} data-part="bar-row">
            {r.href ? (
              <a
                href={r.href}
                className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus hover:[&_span.truncate]:underline"
              >
                {head}
                {bar}
              </a>
            ) : (
              <>
                {head}
                {bar}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
