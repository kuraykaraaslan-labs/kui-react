'use client';
import { cn } from '@/libs/utils/cn';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import type { CellContext, Column, DataTableDensity, DataTableRowState } from '../types';
import { cellClassFor, densityCellClass } from '../core/columnHelpers';

// TODO M5: inline edit.

/** Controls whose own click and keys a row must leave alone. */
const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role="button"],[role="menuitem"],[role="checkbox"],[contenteditable="true"]';

/** A plain join (no class merging), like `cellClassFor`: the host's per-row classes come last. */
function withExtra(base: string, extra: string | undefined): string {
  return extra ? `${base} ${extra}` : base;
}

export function BodyRow<T extends Record<string, unknown>>({
  row,
  columns,
  onClick,
  onDoubleClick,
  leading,
  actions,
  selected = false,
  detail,
  rowKey,
  state,
  className,
  style,
  unstyled = false,
  density = 'comfortable',
  focusable = false,
  tabbable = false,
  onFocusRow,
  onKeyNav,
  cell,
}: {
  row: T;
  /** What `Column.render` gets besides the row (its source index and id). */
  cell?: CellContext;
  columns: Column<T>[];
  onClick?: (row: T, event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>) => void;
  /** Double click on the row (not on a control inside it); Enter / Space run it when there is no `onClick`. */
  onDoubleClick?: (row: T, event: MouseEvent<HTMLTableRowElement>) => void;
  /** Cells before the data columns (selection checkbox, expand toggle). */
  leading?: React.ReactNode;
  /** A trailing cell (the row-actions menu). */
  actions?: React.ReactNode;
  selected?: boolean;
  /** An open detail row rendered right below this one. */
  detail?: { id: string; content: React.ReactNode; colSpan: number };
  /** Stable key of the row (`data-row-key`), used by keyboard navigation. */
  rowKey?: string;
  /** Live state: `new` highlights the row, `leaving` fades it. */
  state?: DataTableRowState;
  className?: string;
  style?: CSSProperties;
  /** The host draws the look: no row hover, no cell padding or colour of the table's own. */
  unstyled?: boolean;
  density?: DataTableDensity;
  /** Keyboard rows: the row takes focus (roving tab index). */
  focusable?: boolean;
  /** This row is the one in the tab order. */
  tabbable?: boolean;
  onFocusRow?: () => void;
  /** Arrow Up/Down, Home, End on the row itself. */
  onKeyNav?: (key: 'ArrowUp' | 'ArrowDown' | 'Home' | 'End') => void;
}) {
  return (
    <>
      <tr
        data-row-key={rowKey}
        data-state={state}
        data-selected={selected || undefined}
        tabIndex={focusable ? (tabbable ? 0 : -1) : undefined}
        aria-selected={selected || undefined}
        onFocus={focusable ? (e) => { if (e.target === e.currentTarget) onFocusRow?.(); } : undefined}
        onKeyDown={
          focusable
            ? (e) => {
                // A control inside the row handles its own keys.
                if (e.target !== e.currentTarget) return;
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End') {
                  e.preventDefault();
                  onKeyNav?.(e.key);
                } else if ((e.key === 'Enter' || e.key === ' ') && onClick) {
                  e.preventDefault();
                  onClick(row, e);
                } else if ((e.key === 'Enter' || e.key === ' ') && onDoubleClick) {
                  // A row whose only action is a double click still runs it from the keyboard.
                  e.preventDefault();
                  onDoubleClick(row, e as unknown as MouseEvent<HTMLTableRowElement>);
                }
              }
            : undefined
        }
        onClick={
          onClick
            ? (e) => {
                // A click on a control inside the row (or in a portal opened from it) belongs to that control.
                const target = e.target as Element;
                if (!e.currentTarget.contains(target)) return;
                const control = target.closest(INTERACTIVE);
                if (control && e.currentTarget.contains(control)) return;
                onClick(row, e);
              }
            : undefined
        }
        onDoubleClick={
          onDoubleClick
            ? (e) => {
                const target = e.target as Element;
                if (!e.currentTarget.contains(target)) return;
                const control = target.closest(INTERACTIVE);
                if (control && e.currentTarget.contains(control)) return;
                onDoubleClick(row, e);
              }
            : undefined
        }
        style={style}
        className={cn(
          !unstyled && 'hover:bg-surface-overlay transition-[background-color,opacity] duration-500',
          selected && 'bg-primary-subtle',
          state === 'new' && 'bg-primary-subtle',
          state === 'leaving' && 'opacity-40',
          (onClick || onDoubleClick) && 'cursor-pointer',
          focusable && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus',
          className,
        )}
      >
        {leading}
        {columns.map((col) => (
          <td
            key={String(col.key)}
            className={withExtra(cellClassFor(col, unstyled ? '' : cn(densityCellClass[density], 'text-text-primary')), col.cellClassName?.(row))}
            style={col.cellStyle?.(row)}
          >
            {col.render
              ? col.render(row, cell ?? { index: 0, id: rowKey ?? '' })
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
