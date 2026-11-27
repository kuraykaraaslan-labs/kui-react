'use client';
import { useEffect, type RefObject } from 'react';

type Options = {
  rootRef: RefObject<HTMLElement | null>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Step the anchor date by N days. Drives ArrowLeft/Right ±1 day and
   * ArrowUp/Down ±7 days for week-row navigation in the month grid (M6). */
  onStepDays?: (delta: number) => void;
  enabled?: boolean;
};

/**
 * Keyboard navigation for the calendar root.
 *
 * - Page Up    → previous period
 * - Page Down  → next period
 * - T          → jump to today
 * - Arrow Left → −1 day
 * - Arrow Right → +1 day
 * - Arrow Up   → −7 days (previous week-row)
 * - Arrow Down → +7 days (next week-row)
 *
 * Focus must be inside `rootRef` (or the calendar must be focused) for the
 * shortcuts to fire — keeps the calendar from hijacking global keys.
 */
export function useKeyboardNav({ rootRef, onPrev, onNext, onToday, onStepDays, enabled = true }: Options) {
  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    function onKey(e: KeyboardEvent) {
      // A child already handled the key (the month range drag's Shift / Alt + arrows, Enter on a day).
      if (e.defaultPrevented) return;
      // Ignore when user is typing into an input / textarea / contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'PageUp') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        onNext();
      } else if (e.key === 't' || e.key === 'T') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        onToday();
      } else if (onStepDays && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -7 : 7;
        e.preventDefault();
        onStepDays(delta);
      }
    }

    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [rootRef, onPrev, onNext, onToday, onStepDays, enabled]);
}
