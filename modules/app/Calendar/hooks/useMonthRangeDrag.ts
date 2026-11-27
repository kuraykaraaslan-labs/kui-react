'use client';
import { useCallback, type RefObject } from 'react';
import type { CalendarTelemetry, Event } from '../types';
import { useCalStore } from '../store';
import { changeRange, createDayRange, type DayRange, type RangeChange } from './dayRange';

/** Mouse / pen: a bar starts moving after this many px (a shorter press is a click → popover). */
const MOVE_THRESHOLD = 4;
/** Touch: a drag starts after a still press this long, so a swipe keeps scrolling the page. */
const LONG_PRESS_MS = 300;
/** Touch: moving further than this before the long press ends gives the gesture back to scrolling. */
const TOUCH_SLOP = 8;

/** The month cell (`data-cal-month-day`) under a point, by geometry: a bar overflows its own cell, so the DOM parent lies. */
export function monthCellIndexAt(grid: HTMLElement, x: number, y: number): number | null {
  const cells = grid.querySelectorAll<HTMLElement>('[data-cal-month-day]');
  for (const cell of cells) {
    const r = cell.getBoundingClientRect();
    if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return Number(cell.dataset.calMonthDay);
  }
  return null;
}

type GestureHandlers = {
  /** Mouse / pen only: activate on press (create) instead of after MOVE_THRESHOLD (bars). */
  immediate: boolean;
  onIndex: (index: number, originIndex: number) => void;
  onCommit: () => void;
  onCancel: () => void;
};

function suppressNextClick() {
  const stop = (ev: MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  window.addEventListener('click', stop, true);
  setTimeout(() => window.removeEventListener('click', stop, true), 0);
}

function startGesture(e: React.PointerEvent<HTMLElement>, grid: HTMLElement, h: GestureHandlers) {
  const hit = monthCellIndexAt(grid, e.clientX, e.clientY);
  if (hit === null) return;
  const originIndex: number = hit;
  const { pointerId, clientX: x0, clientY: y0 } = e;
  const touch = e.pointerType === 'touch';
  if (!touch) e.preventDefault();
  let active = false;
  let lastIndex = originIndex;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function activate() {
    active = true;
    h.onIndex(lastIndex, originIndex);
  }
  function cleanup() {
    clearTimeout(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('touchmove', onTouchMove);
  }
  function onMove(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;
    if (!active) {
      const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
      if (touch) {
        if (dist > TOUCH_SLOP) cleanup();
        return;
      }
      if (dist < MOVE_THRESHOLD) return;
      activate();
    }
    const index = monthCellIndexAt(grid, ev.clientX, ev.clientY);
    if (index !== null && index !== lastIndex) {
      lastIndex = index;
      h.onIndex(index, originIndex);
    }
  }
  function onUp(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;
    cleanup();
    if (!active) return;
    suppressNextClick();
    h.onCommit();
  }
  function onCancel(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;
    cleanup();
    if (active) h.onCancel();
  }
  function onKey(ev: KeyboardEvent) {
    if (ev.key !== 'Escape') return;
    ev.preventDefault();
    cleanup();
    if (active) h.onCancel();
  }
  function onTouchMove(ev: TouchEvent) {
    if (active) ev.preventDefault();
  }

  if (touch) timer = setTimeout(activate, LONG_PRESS_MS);
  else if (h.immediate) activate();
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('touchmove', onTouchMove, { passive: false });
}

type Options = {
  gridRef: RefObject<HTMLElement | null>;
  /** The 42 days of the month grid, in cell order. */
  cells: Date[];
  onEventCreate?: (range: { start: Date; end: Date; allDay?: boolean }) => void | Promise<void>;
  onEventUpdate?: (event: Event) => void | Promise<void>;
  onTelemetry?: (e: CalendarTelemetry) => void;
};

/**
 * Pointer (mouse, pen, touch) day-range drags on the month grid: create across empty days, move a bar, resize a bar's start
 * or end edge (`[data-cal-range-handle="start|end"]`). Snaps to whole days; Escape cancels.
 */
export function useMonthRangeDrag({ gridRef, cells, onEventCreate, onEventUpdate, onTelemetry }: Options) {
  const setDrag = useCalStore((s) => s.setDrag);

  const onCellPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const grid = gridRef.current;
      if (e.button !== 0 || !grid) return;
      if ((e.target as HTMLElement).closest('[data-event-id]')) return;
      let range: DayRange | null = null;
      startGesture(e, grid, {
        immediate: true,
        onIndex: (index, origin) => {
          range = createDayRange(cells[origin], cells[index]);
          setDrag({ kind: 'range', change: 'create', ghostStart: range.start, ghostEnd: range.end });
        },
        onCommit: () => {
          setDrag({ kind: 'idle' });
          if (!range) return;
          onEventCreate?.({ start: range.start, end: range.end, allDay: true });
          onTelemetry?.({ type: 'event-create', start: range.start, end: range.end });
        },
        onCancel: () => setDrag({ kind: 'idle' }),
      });
    },
    [gridRef, cells, onEventCreate, onTelemetry, setDrag],
  );

  const barPointerDown = useCallback(
    (event: Event) => (e: React.PointerEvent<HTMLElement>) => {
      const grid = gridRef.current;
      if (e.button !== 0 || !grid) return;
      e.stopPropagation();
      const edge = (e.target as HTMLElement).closest<HTMLElement>('[data-cal-range-handle]')?.dataset.calRangeHandle;
      const change: RangeChange = edge === 'start' ? 'resize-start' : edge === 'end' ? 'resize-end' : 'move';
      let next: DayRange | null = null;
      startGesture(e, grid, {
        immediate: false,
        onIndex: (index, origin) => {
          next = changeRange(event, change, index - origin);
          setDrag({ kind: 'range', change, eventId: event.id, ghostStart: next.start, ghostEnd: next.end });
        },
        onCommit: () => {
          setDrag({ kind: 'idle' });
          if (!next) return;
          if (next.start.getTime() === event.start.getTime() && next.end.getTime() === event.end.getTime()) return;
          onEventUpdate?.({ ...event, start: next.start, end: next.end });
          onTelemetry?.({ type: 'event-update', eventId: event.id });
        },
        onCancel: () => setDrag({ kind: 'idle' }),
      });
    },
    [gridRef, onEventUpdate, onTelemetry, setDrag],
  );

  return { onCellPointerDown, barPointerDown };
}
