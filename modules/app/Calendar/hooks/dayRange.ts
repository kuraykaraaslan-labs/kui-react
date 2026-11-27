'use client';
/**
 * Whole-day range math for the month view's drag-create, drag-move and edge-resize (and their keyboard equivalents).
 * Pure functions: no React, no DOM. Mirrored in kui-ejs `modules/app/Calendar/scripts/month-range.js`.
 *
 * Ranges are `[start, end)`: `end` is exclusive. Moving or resizing by days goes through `addDays` (local calendar days), so the
 * times of day stay as they were, also across a daylight-saving change.
 */
import { addDays, startOfDay } from '../date-utils';

export type DayRange = { start: Date; end: Date };

/** Whole calendar days from `a` to `b` (negative when `b` is earlier). Time of day is ignored; DST-safe. */
export function dayDiff(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** The last day a range covers: the day of `end - 1ms`, never before the start day. */
export function lastDayOf(range: DayRange): Date {
  const first = startOfDay(range.start);
  const last = startOfDay(new Date(range.end.getTime() - 1));
  return last.getTime() < first.getTime() ? first : last;
}

/** "14 May – 16 May", or "14 May" for a one-day range (the last day is the inclusive one). */
export function dayRangeText(range: DayRange, monthNames: string[]): string {
  const day = (d: Date) => `${d.getDate()} ${monthNames[d.getMonth()]}`;
  const last = lastDayOf(range);
  return dayDiff(range.start, last) > 0 ? `${day(range.start)} – ${day(last)}` : day(range.start);
}

/** True when an event shows as a bar: all-day, or covering more than one day. */
export function isRangeEvent(e: DayRange & { allDay?: boolean }): boolean {
  return !!e.allDay || dayDiff(e.start, lastDayOf(e)) > 0;
}

/** The all-day range between two picked days, in either order: first day 00:00 to the day after the last day 00:00. */
export function createDayRange(a: Date, b: Date): DayRange {
  const [lo, hi] = a.getTime() <= b.getTime() ? [a, b] : [b, a];
  return { start: startOfDay(lo), end: addDays(startOfDay(hi), 1) };
}

/** Move the whole range by whole days, keeping the times of day and the length in days. */
export function moveRange(range: DayRange, days: number): DayRange {
  return { start: addDays(range.start, days), end: addDays(range.end, days) };
}

/** Move the start by whole days; it never reaches the end (the range keeps at least one day). */
export function resizeRangeStart(range: DayRange, days: number): DayRange {
  let start = addDays(range.start, days);
  while (start.getTime() >= range.end.getTime()) start = addDays(start, -1);
  return { start, end: range.end };
}

/** Move the end by whole days; it never reaches the start (the range keeps at least one day). */
export function resizeRangeEnd(range: DayRange, days: number): DayRange {
  let end = addDays(range.end, days);
  while (end.getTime() <= range.start.getTime()) end = addDays(end, 1);
  return { start: range.start, end };
}

export type RangeChange = 'move' | 'resize-start' | 'resize-end';

/** Apply a change by whole days. */
export function changeRange(range: DayRange, change: RangeChange, days: number): DayRange {
  if (change === 'move') return moveRange(range, days);
  if (change === 'resize-start') return resizeRangeStart(range, days);
  return resizeRangeEnd(range, days);
}

type KeyLike = { key: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };

/**
 * The keyboard change on a focused bar, or null when the key is not one:
 * - Alt + Left / Right → move by a day; Alt + Up / Down → move by a week
 * - Shift + Left / Right → change the end by a day
 * - Alt + Shift + Left / Right → change the start by a day
 */
export function rangeKeyAction(e: KeyLike): { change: RangeChange; days: number } | null {
  if (e.ctrlKey || e.metaKey) return null;
  const horizontal = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
  const vertical = e.key === 'ArrowUp' ? -7 : e.key === 'ArrowDown' ? 7 : 0;
  if (e.altKey && e.shiftKey) return horizontal ? { change: 'resize-start', days: horizontal } : null;
  if (e.shiftKey) return horizontal ? { change: 'resize-end', days: horizontal } : null;
  if (e.altKey) {
    const days = horizontal || vertical;
    return days ? { change: 'move', days } : null;
  }
  return null;
}

/** Shift + Arrow on a day cell: the number of days the selection's moving end steps, or 0. */
export function selectionKeyStep(e: KeyLike): number {
  if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return 0;
  if (e.key === 'ArrowLeft') return -1;
  if (e.key === 'ArrowRight') return 1;
  if (e.key === 'ArrowUp') return -7;
  if (e.key === 'ArrowDown') return 7;
  return 0;
}
