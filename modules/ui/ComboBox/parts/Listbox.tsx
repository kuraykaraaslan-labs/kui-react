'use client';
// Listbox — renders the option list with M1 fixed-height windowing.
// TODO M1+: swap manual windowing for TanStack Virtual (lazy-import) once the
// dep budget is approved. Today: simple visibleStart/visibleEnd slice.

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import type { ComboBoxOption } from '../types';

// 36 px ≈ py-2 + 2 lines of text. Matches the previous unvirtualized row height
// (px-3 py-2 + text-sm + optional description). Keep in lockstep with the EJS
// row height so screenshot parity holds.
const ROW_HEIGHT = 36;
const OVERSCAN = 4;
const DEFAULT_THRESHOLD = 50;

type ListboxProps = {
  id: string;
  listboxId: string;
  options: ComboBoxOption[];
  selectedValue: string;
  highlightedIndex: number;
  loading: boolean;
  loadingMore: boolean;
  noResultsText: string;
  /** Screen-reader text while the skeleton rows show. */
  loadingText: string;
  loadingMoreText: string;
  virtualize: boolean | number;
  sentinelRef?: React.RefObject<HTMLLIElement | null>;
  onHighlight: (index: number) => void;
  onSelect: (option: ComboBoxOption) => void;
};

export function Listbox({
  id,
  listboxId,
  options,
  selectedValue,
  highlightedIndex,
  loading,
  loadingMore,
  noResultsText,
  loadingText,
  loadingMoreText,
  virtualize,
  sentinelRef,
  onHighlight,
  onSelect,
}: ListboxProps) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Decide windowing threshold.
  const threshold = typeof virtualize === 'number'
    ? virtualize
    : virtualize === true ? 0 : DEFAULT_THRESHOLD;
  const windowed = options.length > threshold;

  // Keep the highlighted option in view while navigating with keys.
  useEffect(() => {
    if (highlightedIndex < 0 || !scrollRef.current) return;
    const top = highlightedIndex * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    const el = scrollRef.current;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  }, [highlightedIndex]);

  let visibleStart = 0;
  let visibleEnd = options.length;
  if (windowed) {
    const containerHeight = 240; // max-h-60 = 15rem = 240px
    visibleStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    visibleEnd = Math.min(
      options.length,
      Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
    );
  }

  const topPad = windowed ? visibleStart * ROW_HEIGHT : 0;
  const bottomPad = windowed ? (options.length - visibleEnd) * ROW_HEIGHT : 0;

  return (
    <ul
      ref={scrollRef}
      id={listboxId}
      role="listbox"
      data-combobox-list
      onScroll={windowed ? (e) => setScrollTop((e.target as HTMLUListElement).scrollTop) : undefined}
      className="z-20 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg"
    >
      {loading ? (
        // Skeleton rows while async search is pending.
        <>
          <li className="sr-only" role="status">{loadingText}</li>
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={`sk-${i}`} className="px-3 py-2" aria-hidden="true">
              <div className="h-3 w-full animate-pulse rounded bg-surface-overlay" />
            </li>
          ))}
        </>
      ) : options.length === 0 ? (
        <li className="px-3 py-3 text-sm text-text-secondary">{noResultsText}</li>
      ) : (
        <>
          {topPad > 0 && <li aria-hidden="true" style={{ height: topPad }} />}
          {options.slice(visibleStart, visibleEnd).map((option, sliceIdx) => {
            const index = visibleStart + sliceIdx;
            const isSelected = option.value === selectedValue;
            const isHighlighted = index === highlightedIndex;

            return (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={isSelected}
              >
                <button
                  type="button"
                  disabled={option.disabled}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                    'focus-visible:outline-none',
                    isHighlighted ? 'bg-surface-overlay' : 'hover:bg-surface-overlay',
                    isSelected && 'font-medium text-primary',
                    option.disabled && 'cursor-not-allowed opacity-50'
                  )}
                  onMouseEnter={() => onHighlight(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(option)}
                >
                  {option.icon && <span className="mt-0.5 shrink-0" aria-hidden="true">{option.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-xs text-text-secondary">{option.description}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {bottomPad > 0 && <li aria-hidden="true" style={{ height: bottomPad }} />}
          {sentinelRef && (
            <li ref={sentinelRef} aria-hidden="true" data-combobox-sentinel className="h-1" />
          )}
          {loadingMore && (
            <li className="px-3 py-2 text-xs text-text-secondary" aria-live="polite">{loadingMoreText}</li>
          )}
        </>
      )}
    </ul>
  );
}
