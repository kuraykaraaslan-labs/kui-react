'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import { DEFAULT_MESSAGES, formatMessage, type Column, type DataTableMessages } from '../types';

// TODO M2: date and range filter kinds, multi-value select, filter chain.

export function FilterPopover<T extends Record<string, unknown>>({
  column,
  value,
  onChange,
  msgs = DEFAULT_MESSAGES,
}: {
  column: Column<T>;
  value: string;
  onChange: (next: string) => void;
  msgs?: DataTableMessages;
}) {
  const heading =
    typeof column.header === 'string' || typeof column.header === 'number'
      ? String(column.header)
      : String(column.key);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [draft, setDraft] = useState(value);

  // Re-seed the draft when the applied filter value changes from outside.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = !!value;

  function apply() {
    onChange(draft.trim());
    setOpen(false);
  }

  function clear() {
    setDraft('');
    onChange('');
    setOpen(false);
  }

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={formatMessage(
          active ? (msgs.editColumnFilter ?? 'Edit filter on {column}') : (msgs.columnFilter ?? 'Filter {column}'),
          { column: heading },
        )}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          'inline-flex items-center justify-center rounded p-1 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          active
            ? 'text-primary hover:text-primary-hover'
            : 'text-text-disabled hover:text-text-primary',
        )}
      >
        <FontAwesomeIcon icon={faFilter} className="w-2.5 h-2.5" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={formatMessage(msgs.columnFilter ?? 'Filter {column}', { column: heading })}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute top-full left-0 mt-1 z-[70] min-w-[12rem] rounded-lg border border-border bg-surface-raised shadow-xl p-3',
          )}
        >
          {column.filter?.kind === 'select' ? (
            <select
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={cn(
                'w-full rounded-md border border-border bg-surface-base px-2 py-1.5 text-sm text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            >
              <option value="">{msgs.columnFilterAll ?? 'All'}</option>
              {(column.filter?.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              autoFocus
              type="text"
              value={draft}
              placeholder={column.filter?.placeholder ?? msgs.columnFilterContains ?? 'Contains…'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') apply();
              }}
              className={cn(
                'w-full rounded-md border border-border bg-surface-base px-2 py-1.5 text-sm text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            />
          )}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={clear}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium text-text-secondary',
                'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            >
              {msgs.clearFilter}
            </button>
            <button
              type="button"
              onClick={apply}
              className={cn(
                'rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-fg',
                'hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            >
              {msgs.apply}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
