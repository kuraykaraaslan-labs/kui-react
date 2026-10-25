'use client';
import { cn } from '@/libs/utils/cn';
import type { Column } from '../types';
import { cellClassFor } from '../core/columnHelpers';

// TODO M5: inline edit.

export function BodyRow<T extends Record<string, unknown>>({
  row,
  columns,
  onClick,
  leading,
  actions,
  selected = false,
  detail,
}: {
  row: T;
  columns: Column<T>[];
  onClick?: (row: T) => void;
  /** Cells before the data columns (selection checkbox, expand toggle). */
  leading?: React.ReactNode;
  /** A trailing cell (the row-actions menu). */
  actions?: React.ReactNode;
  selected?: boolean;
  /** An open detail row rendered right below this one. */
  detail?: { id: string; content: React.ReactNode; colSpan: number };
}) {
  return (
    <>
      <tr
        onClick={onClick ? () => onClick(row) : undefined}
        data-selected={selected || undefined}
        className={cn(
          'hover:bg-surface-overlay transition-colors',
          selected && 'bg-primary-subtle',
          onClick && 'cursor-pointer',
        )}
      >
        {leading}
        {columns.map((col) => (
          <td
            key={String(col.key)}
            className={cellClassFor(col, 'px-4 py-3 text-text-primary')}
          >
            {col.render
              ? col.render(row)
              : String(row[col.key as keyof T] ?? '')}
          </td>
        ))}
        {actions}
      </tr>
      {detail && (
        <tr id={detail.id} className="bg-surface-sunken" data-part="detail">
          <td colSpan={detail.colSpan} className="px-6 py-3 text-sm text-text-secondary">
            {detail.content}
          </td>
        </tr>
      )}
    </>
  );
}
