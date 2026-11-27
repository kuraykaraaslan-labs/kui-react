'use client';
/**
 * Lane layout for the month view's continuous bars (`monthBars`). Pure: no React, no DOM.
 * Mirrored in kui-ejs `modules/app/Calendar/scripts/month-range.js` (`layoutWeek`), which must produce the same lanes.
 *
 * Every event that touches a week becomes one segment in that week: a start column, a span in days and a lane (row). An event
 * that runs over several weeks gets one segment per week, flagged as continuing before and / or after. Segments are placed
 * greedily in the first free lane; a segment that finds no free lane below `maxLanes` is hidden and counted in each day's "+N".
 */
import { addDays, startOfDay } from '../date-utils';
import { dayDiff, isRangeEvent, lastDayOf } from './dayRange';

export type MonthSegment<E> = {
  event: E;
  /** 0-based column in the week (0 = the locale's first weekday). */
  startCol: number;
  /** Days covered in this week, 1–7. */
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  /** All-day or multi-day → bar colours; a single-day timed event → pill colours. */
  isRange: boolean;
};

export type WeekLayout<E> = {
  /** Visible segments (lane < maxLanes). */
  segments: MonthSegment<E>[];
  /** Lane rows every cell of the week renders, so bars line up across the row. */
  lanes: number;
  /** Hidden segments per column, for the "+N more" label. */
  hidden: number[];
};

type LayoutEvent = { id: string; start: Date; end: Date; allDay?: boolean };

export function layoutWeek<E extends LayoutEvent>(events: E[], weekStart: Date, maxLanes: number): WeekLayout<E> {
  const ws = startOfDay(weekStart);
  const we = addDays(ws, 7);
  const raw: MonthSegment<E>[] = [];
  for (const event of events) {
    if (!(event.start.getTime() < we.getTime() && event.end.getTime() > ws.getTime())) continue;
    const first = dayDiff(ws, event.start);
    const last = dayDiff(ws, lastDayOf(event));
    const startCol = Math.max(0, first);
    const endCol = Math.min(6, last);
    if (endCol < startCol) continue;
    raw.push({
      event,
      startCol,
      span: endCol - startCol + 1,
      lane: 0,
      continuesBefore: first < 0,
      continuesAfter: last > 6,
      isRange: isRangeEvent(event),
    });
  }
  raw.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.span - a.span ||
      a.event.start.getTime() - b.event.start.getTime() ||
      (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0),
  );

  const taken: boolean[][] = [];
  const hidden = [0, 0, 0, 0, 0, 0, 0];
  const segments: MonthSegment<E>[] = [];
  let lanes = 0;
  for (const seg of raw) {
    let lane = 0;
    for (;;) {
      const row = (taken[lane] ??= []);
      let free = true;
      for (let c = seg.startCol; c < seg.startCol + seg.span; c++) if (row[c]) free = false;
      if (free) break;
      lane++;
    }
    for (let c = seg.startCol; c < seg.startCol + seg.span; c++) taken[lane][c] = true;
    if (lane < maxLanes) {
      segments.push({ ...seg, lane });
      lanes = Math.max(lanes, lane + 1);
    } else {
      for (let c = seg.startCol; c < seg.startCol + seg.span; c++) hidden[c]++;
    }
  }
  return { segments, lanes, hidden };
}

/**
 * Bar width by span. A bar sits in its first day's cell and overflows to the right: each further day adds one cell width
 * (100% of the content box plus the cell's 8px padding and 1px right border).
 */
export const BAR_WIDTH_CLASSES = [
  'w-full',
  'w-[calc(200%+9px)]',
  'w-[calc(300%+18px)]',
  'w-[calc(400%+27px)]',
  'w-[calc(500%+36px)]',
  'w-[calc(600%+45px)]',
  'w-[calc(700%+54px)]',
] as const;

/** Square ends where a bar continues into the previous / next week. */
export function barRadiusClass(continuesBefore: boolean, continuesAfter: boolean): string {
  if (continuesBefore && continuesAfter) return 'rounded-none';
  if (continuesBefore) return 'rounded-r-md';
  if (continuesAfter) return 'rounded-l-md';
  return 'rounded-md';
}
