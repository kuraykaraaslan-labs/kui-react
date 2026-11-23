'use client';
import { cn } from '@/libs/utils/cn';
import type { InsightsFormat } from '../insights/format';
import type { ShareRow } from './summary';

type SecurityBreakdownProps = {
  /** From `shareRows`: largest first, each with its share of the total. */
  rows: ShareRow[];
  /** A row key's words (an action, a reason, a country). */
  label: (key: string) => string;
  fmt: InsightsFormat;
  /** Words for the previous period's count ("Previous period"). */
  previousLabel: string;
  emptyText: string;
  /** The list's accessible name (the card title). */
  ariaLabel: string;
  /** The bar colour: one series, so one token (default the first chart slot). */
  color?: string;
  className?: string;
};

/**
 * SecurityBreakdown — counts of one period split by a key (action, reason, spam kind, jail, country): the words, the
 * count, its share and the previous period's count, with a bar to scale. Every number is printed, so the list is its
 * own table; the bar only helps the eye.
 */
export function SecurityBreakdown({ rows, label, fmt, previousLabel, emptyText, ariaLabel, color = 'var(--chart-1)', className }: SecurityBreakdownProps) {
  if (!rows.length) return <p className={cn('text-sm text-text-secondary', className)}>{emptyText}</p>;
  const top = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className={cn('flex flex-col gap-3', className)} aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
            <span className="min-w-0 break-words text-text-primary">{label(r.key)}</span>
            <span className="tabular-nums text-text-secondary">
              <span className="font-medium text-text-primary">{fmt.int(r.count)}</span>
              {' · '}
              {fmt.percent(r.share)}
              {r.previous !== undefined && (
                <span className="text-xs">
                  {' · '}
                  {previousLabel} {fmt.int(r.previous)}
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-sunken" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${r.count > 0 ? Math.max((r.count / top) * 100, 2) : 0}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
