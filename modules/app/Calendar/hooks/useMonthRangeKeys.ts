'use client';
import { useEffect, useRef, type RefObject } from 'react';
import type { CalendarMessages, CalendarTelemetry, Event } from '../types';
import { addDays } from '../date-utils';
import { useCalStore } from '../store';
import { changeRange, createDayRange, dayRangeText, rangeKeyAction, selectionKeyStep } from './dayRange';

type Options = {
  gridRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  /** The anchor date: the focused day cell. */
  date: Date;
  events: Event[];
  messages: CalendarMessages;
  monthNames: string[];
  onStepDays?: (delta: number) => void;
  onEventCreate?: (range: { start: Date; end: Date; allDay?: boolean }) => void | Promise<void>;
  onEventUpdate?: (event: Event) => void | Promise<void>;
  onTelemetry?: (e: CalendarTelemetry) => void;
};

/**
 * Keyboard equivalents of the month range drags (`monthDrag`), announced through the calendar's live region:
 * - on a day cell: Shift + arrows select days from the focused one, Enter (or Space) creates the selection (or the focused
 *   day), Escape drops the selection; plain arrows still step the focused day (useKeyboardNav) and drop the selection.
 * - on a bar: Alt + arrows move it, Shift + Left / Right change its end, Alt + Shift + Left / Right change its start.
 *
 * Listens natively on the grid so it runs before useKeyboardNav's root listener, which skips a handled (defaultPrevented) key.
 */
export function useMonthRangeKeys({
  gridRef,
  enabled,
  date,
  events,
  messages,
  monthNames,
  onStepDays,
  onEventCreate,
  onEventUpdate,
  onTelemetry,
}: Options) {
  const setDrag = useCalStore((s) => s.setDrag);
  const announce = useCalStore((s) => s.announce);
  const anchor = useRef<Date | null>(null);
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!enabled || !grid) return;
    const clearSelection = () => {
      anchor.current = null;
      setDrag({ kind: 'idle' });
    };

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const bar = target.closest<HTMLElement>('[data-cal-range-bar]');
      if (bar) {
        const action = rangeKeyAction(e);
        const event = action && events.find((x) => x.id === bar.dataset.eventId);
        if (!action || !event) return;
        e.preventDefault();
        const next = changeRange(event, action.change, action.days);
        pendingFocus.current = event.id;
        onEventUpdate?.({ ...event, start: next.start, end: next.end });
        onTelemetry?.({ type: 'event-update', eventId: event.id });
        announce(messages.rangeChanged(event.title, dayRangeText(next, monthNames)));
        return;
      }
      if (!target.hasAttribute('data-cal-month-day')) return;
      const step = selectionKeyStep(e);
      if (step) {
        e.preventDefault();
        const from = anchor.current ?? date;
        anchor.current = from;
        const range = createDayRange(from, addDays(date, step));
        setDrag({ kind: 'range', change: 'create', ghostStart: range.start, ghostEnd: range.end });
        onStepDays?.(step);
        announce(messages.rangeSelected(dayRangeText(range, monthNames)));
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const range = createDayRange(anchor.current ?? date, date);
        clearSelection();
        onEventCreate?.({ start: range.start, end: range.end, allDay: true });
        onTelemetry?.({ type: 'event-create', start: range.start, end: range.end });
        return;
      }
      if (e.key === 'Escape' && anchor.current) {
        e.preventDefault();
        clearSelection();
        return;
      }
      if (anchor.current && e.key.startsWith('Arrow')) clearSelection();
    }

    grid.addEventListener('keydown', onKey);
    return () => grid.removeEventListener('keydown', onKey);
  }, [gridRef, enabled, date, events, messages, monthNames, onStepDays, onEventCreate, onEventUpdate, onTelemetry, setDrag, announce]);

  // A moved bar re-renders in another cell: give it focus back once the new events arrive.
  useEffect(() => {
    const grid = gridRef.current;
    const id = pendingFocus.current;
    if (!grid || !id) return;
    const bar = [...grid.querySelectorAll<HTMLElement>('[data-cal-range-bar]')].find((el) => el.dataset.eventId === id);
    if (!bar) return;
    pendingFocus.current = null;
    if (document.activeElement !== bar) bar.focus();
  }, [gridRef, events]);

  // The focused cell follows the anchor date when it changes from the keyboard.
  useEffect(() => {
    const grid = gridRef.current;
    if (!enabled || !grid) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active || !grid.contains(active) || !active.hasAttribute('data-cal-month-day')) return;
    const cell = grid.querySelector<HTMLElement>('[data-cal-month-day][tabindex="0"]');
    if (cell && cell !== active) cell.focus();
  }, [gridRef, enabled, date]);
}
