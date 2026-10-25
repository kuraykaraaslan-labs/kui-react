'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import type { KanbanColumn, KanbanMessages } from '../types';

type ColumnHeaderProps<T> = {
  column: KanbanColumn<T>;
  count: number;
  msgs: KanbanMessages;
  collapsed: boolean;
  /** Present when the column can fold. */
  onToggle?: () => void;
  className?: string;
};

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (a, k: string) => (k in v ? String(v[k]) : a));

export function ColumnHeader<T>({ column, count, msgs, collapsed, onToggle, className }: ColumnHeaderProps<T>) {
  const over = column.wipLimit !== undefined && count > column.wipLimit;
  const countLabel = column.wipLimit !== undefined ? `${count}/${column.wipLimit}` : String(count);
  const countPill = (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5',
        'text-[11px] font-medium rounded-full',
        over ? 'bg-error-subtle text-error' : 'bg-surface-overlay text-text-secondary',
      )}
      aria-label={over && column.wipLimit !== undefined ? msgs.wipExceeded(count, column.wipLimit) : fill(msgs.cardCount, { count })}
      data-part="column-count"
    >
      {countLabel}
    </span>
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        aria-label={`${msgs.expandColumn}: ${column.title}`}
        className="flex h-full flex-col items-center gap-2 px-1 py-3 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-lg"
        data-part="column-header"
      >
        <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3 text-text-secondary" aria-hidden="true" />
        {countPill}
        <span className="text-sm font-semibold [writing-mode:vertical-rl]">{column.title}</span>
      </button>
    );
  }

  return (
    <div
      className={cn('border-b border-border bg-surface-raised rounded-t-lg', className)}
      data-part="column-header"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
          <span className="truncate">{column.title}</span>
          {column.badge}
        </h3>
        <span className="flex shrink-0 items-center gap-1">
          {countPill}
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded
              aria-label={`${msgs.collapseColumn}: ${column.title}`}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="h-2.5 w-2.5" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      {column.summary && (
        <div className="px-3 pb-2 text-xs text-text-secondary" data-part="column-summary">{column.summary}</div>
      )}
    </div>
  );
}
