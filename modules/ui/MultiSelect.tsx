'use client';
// MultiSelect — chip-based multi-select. M1: shares filter + async + load-more
// hooks with ComboBox (see modules/ui/ComboBox/hooks). Single-file by design
// per the M1 plan; M2 will lift more into shared parts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown, faCheck, faXmark, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { useFilter } from './ComboBox/hooks/useFilter';
import { useAsync } from './ComboBox/hooks/useAsync';
import { useLoadMore } from './ComboBox/hooks/useLoadMore';
import type { ComboBoxOption } from './ComboBox/types';
import { fillMessage } from './_shared/format';

export type MultiSelectOption = ComboBoxOption;

/** Built-in strings, overridable per instance through `messages` (to translate them). */
export type MultiSelectMessages = {
  /** Shown in the list when the search matches nothing. */
  noResults: string;
  /** Placeholder and accessible name of the search box. */
  search: string;
  /** Accessible name of a chip's remove button; `{label}` is the option's label. */
  remove: string;
  /** Shown while `onLoadMore` fetches the next page. */
  loadingMore: string;
};

export const DEFAULT_MULTI_SELECT_MESSAGES: MultiSelectMessages = {
  noResults: 'No results found.',
  search: 'Search…',
  remove: 'Remove {label}',
  loadingMore: 'Loading more…',
};

type MultiSelectProps = {
  id: string;
  label: string;
  options: MultiSelectOption[];
  value?: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  // M1 — async search; signature mirrors ComboBox.
  onSearch?: (q: string, signal?: AbortSignal) => MultiSelectOption[] | Promise<MultiSelectOption[]>;
  // M1 — cursor pagination.
  onLoadMore?: () => Promise<MultiSelectOption[]>;
  debounceMs?: number;
  /** Overrides for the built-in English strings. */
  messages?: Partial<MultiSelectMessages>;
  // TODO M2: maxItems?: number; pasteSeparator?: string | RegExp; reorderable?: boolean;
};

export function MultiSelect({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  hint,
  error,
  disabled,
  searchable,
  className,
  onSearch,
  onLoadMore,
  debounceMs = 300,
  messages,
}: MultiSelectProps) {
  const m = { ...DEFAULT_MULTI_SELECT_MESSAGES, ...messages };
  const [internal, setInternal] = useState<string[]>(value ?? []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLLIElement | null>(null);

  const selected = value !== undefined ? value : internal;

  // Async search wiring — only enabled when caller passes onSearch.
  const { results: asyncResults, loading, appendResults } = useAsync(
    open && !!onSearch,
    search,
    onSearch,
    debounceMs
  );
  const loadingMore = useLoadMore(open, sentinelRef, onLoadMore, appendResults);

  const sourceOptions = asyncResults ?? options;

  // Local filter only when neither async nor non-searchable mode.
  const localFiltered = useFilter(sourceOptions, searchable ? search : '');
  const filtered: MultiSelectOption[] = onSearch
    ? sourceOptions
    : searchable
      ? localFiltered
      : sourceOptions;

  function toggle(v: string) {
    const next = selected.includes(v)
      ? selected.filter((s) => s !== v)
      : [...selected, v];
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  function remove(v: string, e: React.MouseEvent) {
    e.stopPropagation();
    toggle(v);
  }

  // Closing the menu clears the search box.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setSearch('');
  }

  useEffect(() => {
    if (!open) return;
    if (searchable || onSearch) setTimeout(() => searchRef.current?.focus(), 30);
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open, searchable, onSearch]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); }
  }

  // Escape anywhere in an open list (trigger, search box, an option) closes the
  // list only: it is marked handled so an enclosing Modal / Drawer stays open.
  // With the list closed, Escape passes through to the overlay as usual.
  function onRootKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    triggerRef.current?.focus();
  }

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const listboxId = `${id}-listbox`;

  // Pre-compute optionsById map so chip rendering still finds labels for
  // chips whose option went out of the async page (M1 best-effort).
  const optionsById = useMemo(() => {
    const m = new Map<string, MultiSelectOption>();
    for (const o of options) m.set(o.value, o);
    for (const o of sourceOptions) if (!m.has(o.value)) m.set(o.value, o);
    return m;
  }, [options, sourceOptions]);

  return (
    <div ref={containerRef} className={cn('space-y-1', className)} onKeyDown={onRootKeyDown}>
      <label id={`${id}-label`} className="block text-sm font-medium text-text-primary">
        {label}
      </label>

      <div className="relative">
        <div
          ref={triggerRef}
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          aria-disabled={disabled}
          id={id}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          className={cn(
            'min-h-[2.5rem] w-full rounded-md border px-3 py-1.5 text-sm transition-colors cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            'flex flex-wrap gap-1 items-center',
            error ? 'border-error ring-1 ring-error bg-error-subtle'
                  : 'border-border bg-surface-base',
            disabled && 'opacity-50 cursor-not-allowed bg-surface-sunken'
          )}
        >
          {selected.length === 0 ? (
            <span className="text-text-disabled">{placeholder}</span>
          ) : (
            selected.map((v) => {
              const opt = optionsById.get(v);
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-subtle text-primary text-xs font-medium px-2 py-0.5"
                >
                  {opt?.icon && <span className="shrink-0">{opt.icon}</span>}
                  {opt?.label ?? v}
                  <button
                    type="button"
                    aria-label={fillMessage(m.remove, { label: opt?.label ?? v })}
                    onClick={(e) => remove(v, e)}
                    className="hover:opacity-70 focus-visible:outline-none"
                  >
                    <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })
          )}
          <FontAwesomeIcon
            icon={open ? faChevronUp : faChevronDown}
            className="ml-auto w-3 h-3 text-text-disabled"
            aria-hidden="true"
          />
        </div>

        {open && (
          <div className="absolute z-20 w-full rounded-md border border-border bg-surface-raised shadow-lg overflow-hidden top-full left-0 mt-1">
            {(searchable || onSearch) && (
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <FontAwesomeIcon
                    icon={faMagnifyingGlass}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-disabled"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={m.search}
                    aria-label={m.search}
                    aria-autocomplete="list"
                    aria-controls={listboxId}
                    className={cn(
                      'block w-full rounded-md border border-border bg-surface-base pl-7 pr-3 py-1.5 text-sm',
                      'text-text-primary placeholder:text-text-disabled',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
                    )}
                  />
                </div>
              </div>
            )}
            <ul
              id={listboxId}
              role="listbox"
              aria-labelledby={`${id}-label`}
              aria-multiselectable="true"
              data-combobox-list
              className="py-1 max-h-48 overflow-y-auto"
            >
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <li key={`sk-${i}`} className="px-3 py-2" aria-hidden="true">
                    <div className="h-3 w-full animate-pulse rounded bg-surface-overlay" />
                  </li>
                ))
              ) : filtered.length === 0 ? (
                <li className="px-3 py-4 text-sm text-center text-text-secondary">{m.noResults}</li>
              ) : (
                <>
                  {filtered.map((opt) => {
                    const checked = selected.includes(opt.value);
                    return (
                      <li
                        key={opt.value}
                        role="option"
                        aria-selected={checked}
                        aria-disabled={opt.disabled}
                        onClick={() => !opt.disabled && toggle(opt.value)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !opt.disabled) {
                            e.preventDefault();
                            toggle(opt.value);
                          }
                        }}
                        tabIndex={opt.disabled ? -1 : 0}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none',
                          'hover:bg-surface-overlay transition-colors',
                          'focus-visible:outline-none focus-visible:bg-surface-overlay',
                          checked && 'text-primary font-medium',
                          opt.disabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 text-[10px]',
                            checked ? 'bg-primary border-primary text-primary-fg' : 'border-border bg-surface-base'
                          )}
                        >
                          {checked && <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" />}
                        </span>
                        {opt.icon && <span className="shrink-0" aria-hidden="true">{opt.icon}</span>}
                        {opt.label}
                      </li>
                    );
                  })}
                  {onLoadMore && (
                    <li ref={sentinelRef} aria-hidden="true" data-combobox-sentinel className="h-1" />
                  )}
                  {loadingMore && (
                    <li className="px-3 py-2 text-xs text-text-secondary" aria-live="polite">{m.loadingMore}</li>
                  )}
                </>
              )}
            </ul>
          </div>
        )}
      </div>

      {hint && !error && <p id={hintId} className="text-xs text-text-secondary">{hint}</p>}
      {error && <p id={errorId} className="text-xs text-error" role="alert">{error}</p>}
    </div>
  );
}
