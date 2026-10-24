'use client';
// ComboBox — split entrypoint. Composes Trigger + Listbox and wires the shared
// useFilter / useAsync / useLoadMore hooks. Controlled/uncontrolled both work
// (mirrors the old top-level ComboBox.tsx API exactly).

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Trigger } from './parts/Trigger';
import { Listbox } from './parts/Listbox';
import { useFilter } from './hooks/useFilter';
import { useAsync } from './hooks/useAsync';
import { useLoadMore } from './hooks/useLoadMore';
import { DEFAULT_COMBOBOX_MESSAGES } from './types';
import type { ComboBoxOption, ComboBoxProps } from './types';

export { DEFAULT_COMBOBOX_MESSAGES } from './types';
export type { ComboBoxMessages, ComboBoxOption, ComboBoxProps } from './types';

export function ComboBox({
  id,
  label,
  options,
  value,
  onChange,
  onSearch,
  onLoadMore,
  placeholder,
  hint,
  error,
  disabled,
  required,
  clearable = true,
  noResultsText,
  className,
  debounceMs = 300,
  virtualize = false,
  messages,
}: ComboBoxProps) {
  const m = { ...DEFAULT_COMBOBOX_MESSAGES, ...messages };
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLLIElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // True once the user has typed since the list opened. Until then the input
  // still shows the selected label, but the list is not filtered by it.
  const [typed, setTyped] = useState(false);
  const [internalValue, setInternalValue] = useState(value ?? '');

  const selectedValue = value !== undefined ? value : internalValue;

  // The text the list is filtered (or searched) by: empty until the user types,
  // so an opened ComboBox lists every option rather than only the current one.
  const searchQuery = open && typed ? query : '';

  // Async — debounced + AbortController + cache (M1).
  const { results: asyncResults, loading, appendResults } = useAsync(
    open && !!onSearch,
    searchQuery,
    onSearch,
    debounceMs
  );

  // IntersectionObserver-backed cursor pagination (M1).
  const loadingMore = useLoadMore(open, sentinelRef, onLoadMore, appendResults);

  const sourceOptions = asyncResults ?? options;

  const selectedOption = useMemo(
    () => sourceOptions.find((opt) => opt.value === selectedValue)
      ?? options.find((opt) => opt.value === selectedValue),
    [options, selectedValue, sourceOptions]
  );

  // Local fuzzy filter only when async is NOT in play.
  const localFiltered = useFilter(sourceOptions, searchQuery);
  const filteredOptions = onSearch ? sourceOptions : localFiltered;

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const listboxId = `${id}-listbox`;
  const labelId = `${id}-label`;
  const inputId = `${id}-input`;

  // While closed, the input mirrors the selected option's label.
  const selectedLabel = selectedOption?.label;
  const [syncedClosedState, setSyncedClosedState] = useState<{ open: boolean; label?: string } | null>(null);
  if (!syncedClosedState || syncedClosedState.open !== open || syncedClosedState.label !== selectedLabel) {
    setSyncedClosedState({ open, label: selectedLabel });
    if (!open) {
      // Reset on close, not on open: a keystroke that opens the list counts as typed.
      setTyped(false);
      setQuery(selectedLabel ?? '');
      setHighlightedIndex(-1);
    }
  }

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current || rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function commitValue(next: string) {
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
  }

  function handleSelect(option: ComboBoxOption) {
    if (option.disabled) return;
    commitValue(option.value);
    setQuery(option.label);
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function handleClear(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (disabled) return;
    commitValue('');
    setQuery('');
    setOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }

  function moveHighlight(direction: 1 | -1) {
    if (filteredOptions.length === 0) return;
    let idx = highlightedIndex;
    for (let i = 0; i < filteredOptions.length; i += 1) {
      idx = (idx + direction + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[idx]?.disabled) {
        setHighlightedIndex(idx);
        break;
      }
    }
  }

  function jumpHighlight(target: 'first' | 'last') {
    if (filteredOptions.length === 0) return;
    if (target === 'first') {
      for (let i = 0; i < filteredOptions.length; i += 1) {
        if (!filteredOptions[i]?.disabled) { setHighlightedIndex(i); return; }
      }
    } else {
      for (let i = filteredOptions.length - 1; i >= 0; i -= 1) {
        if (!filteredOptions[i]?.disabled) { setHighlightedIndex(i); return; }
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      moveHighlight(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      moveHighlight(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      if (!open) setOpen(true);
      jumpHighlight('first');
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      if (!open) setOpen(true);
      jumpHighlight('last');
      return;
    }
    if (event.key === 'Enter') {
      if (!open || highlightedIndex < 0) return;
      event.preventDefault();
      const opt = filteredOptions[highlightedIndex];
      if (opt) handleSelect(opt);
      return;
    }
    if (event.key === 'Escape') {
      // Only an open list consumes Escape; a closed ComboBox lets it reach the
      // enclosing overlay (a Modal closes as usual).
      if (!open) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn('space-y-1', className)}>
      <label id={labelId} htmlFor={inputId} className="block text-sm font-medium text-text-primary">
        {label}
        {required && <span className="ml-1 text-error" aria-hidden="true">*</span>}
      </label>

      <Trigger
        ref={inputRef}
        id={id}
        inputId={inputId}
        labelId={labelId}
        listboxId={listboxId}
        describedBy={describedBy}
        value={open ? query : (selectedOption?.label ?? query)}
        placeholder={placeholder ?? m.placeholder}
        clearLabel={m.clear}
        disabled={disabled}
        required={required}
        error={error}
        clearable={clearable}
        open={open}
        highlightedIndex={highlightedIndex}
        showClear={!!selectedValue}
        onFocus={() => { if (!disabled) setOpen(true); }}
        onChange={(next) => {
          setQuery(next);
          setTyped(true);
          setOpen(true);
          setHighlightedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
          // Select the shown label so the first keystroke replaces it.
          if (!typed) inputRef.current?.select();
          setOpen(true);
        }}
        onClear={handleClear}
      />

      {open && (
        <Listbox
          id={id}
          listboxId={listboxId}
          options={filteredOptions}
          selectedValue={selectedValue}
          highlightedIndex={highlightedIndex}
          loading={loading}
          loadingMore={loadingMore}
          noResultsText={noResultsText ?? m.noResults}
          loadingText={m.loading}
          loadingMoreText={m.loadingMore}
          virtualize={virtualize}
          sentinelRef={onLoadMore ? sentinelRef : undefined}
          onHighlight={setHighlightedIndex}
          onSelect={handleSelect}
        />
      )}

      {hint && !error && <p id={hintId} className="text-xs text-text-secondary">{hint}</p>}
      {error && <p id={errorId} className="text-xs text-error" role="alert">{error}</p>}
    </div>
  );
}
