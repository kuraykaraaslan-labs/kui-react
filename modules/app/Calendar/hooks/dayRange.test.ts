import { describe, it, expect } from 'vitest';
import {
  changeRange,
  createDayRange,
  dayDiff,
  dayRangeText,
  isRangeEvent,
  lastDayOf,
  moveRange,
  rangeKeyAction,
  resizeRangeEnd,
  resizeRangeStart,
  selectionKeyStep,
} from './dayRange';
import { layoutWeek } from './monthLayout';

const d = (day: number, h = 0, m = 0) => new Date(2026, 4, day, h, m);
const key = (k: string, mods: Partial<{ altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key: k,
  altKey: false,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

describe('day range math', () => {
  it('counts whole calendar days, ignoring the time of day', () => {
    expect(dayDiff(d(10, 23), d(11, 1))).toBe(1);
    expect(dayDiff(d(11), d(4))).toBe(-7);
    // Across the March DST change (Europe and US) a day is still one day.
    expect(dayDiff(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
  });

  it('finds the last covered day of an exclusive range', () => {
    expect(lastDayOf({ start: d(14), end: d(17) })).toEqual(d(16));
    expect(lastDayOf({ start: d(14, 10), end: d(16, 18) })).toEqual(d(16));
    expect(lastDayOf({ start: d(14), end: d(14) })).toEqual(d(14));
  });

  it('writes a range as its inclusive days', () => {
    const months = ['', '', '', '', 'May'];
    expect(dayRangeText({ start: d(14), end: d(17) }, months)).toBe('14 May – 16 May');
    expect(dayRangeText({ start: d(14), end: d(15) }, months)).toBe('14 May');
  });

  it('tells bars from single-day timed pills', () => {
    expect(isRangeEvent({ start: d(14, 9), end: d(14, 10) })).toBe(false);
    expect(isRangeEvent({ start: d(14, 9), end: d(15, 10) })).toBe(true);
    expect(isRangeEvent({ start: d(14), end: d(14, 23, 59), allDay: true })).toBe(true);
  });

  it('creates an all-day range from two days in either order, end exclusive', () => {
    expect(createDayRange(d(14, 15), d(16, 9))).toEqual({ start: d(14), end: d(17) });
    expect(createDayRange(d(16), d(14))).toEqual({ start: d(14), end: d(17) });
    expect(createDayRange(d(14), d(14))).toEqual({ start: d(14), end: d(15) });
    // Across a month end.
    expect(createDayRange(d(30), new Date(2026, 5, 2))).toEqual({ start: d(30), end: new Date(2026, 5, 3) });
  });

  it('moves by whole days keeping times of day and length', () => {
    expect(moveRange({ start: d(14, 10), end: d(16, 18) }, 3)).toEqual({ start: d(17, 10), end: d(19, 18) });
    expect(moveRange({ start: d(14), end: d(17) }, -7)).toEqual({ start: d(7), end: d(10) });
    // Over the DST change the wall-clock times stay.
    const moved = moveRange({ start: new Date(2026, 2, 27, 10), end: new Date(2026, 2, 28, 18) }, 2);
    expect([moved.start.getHours(), moved.end.getHours()]).toEqual([10, 18]);
  });

  it('resizes the start, never past the end', () => {
    expect(resizeRangeStart({ start: d(14), end: d(17) }, -2)).toEqual({ start: d(12), end: d(17) });
    expect(resizeRangeStart({ start: d(14), end: d(17) }, 2)).toEqual({ start: d(16), end: d(17) });
    expect(resizeRangeStart({ start: d(14), end: d(17) }, 9)).toEqual({ start: d(16), end: d(17) });
    // A timed range keeps its times; the start stops one day short when its time is after the end's.
    expect(resizeRangeStart({ start: d(14, 10), end: d(16, 9) }, 5)).toEqual({ start: d(15, 10), end: d(16, 9) });
  });

  it('resizes the end, never before the start', () => {
    expect(resizeRangeEnd({ start: d(14), end: d(17) }, 2)).toEqual({ start: d(14), end: d(19) });
    expect(resizeRangeEnd({ start: d(14), end: d(17) }, -9)).toEqual({ start: d(14), end: d(15) });
    expect(resizeRangeEnd({ start: d(14, 10), end: d(16, 18) }, -4)).toEqual({ start: d(14, 10), end: d(14, 18) });
    expect(changeRange({ start: d(14), end: d(17) }, 'resize-end', 1)).toEqual({ start: d(14), end: d(18) });
  });

  it('maps the bar keys', () => {
    expect(rangeKeyAction(key('ArrowRight', { altKey: true }))).toEqual({ change: 'move', days: 1 });
    expect(rangeKeyAction(key('ArrowUp', { altKey: true }))).toEqual({ change: 'move', days: -7 });
    expect(rangeKeyAction(key('ArrowLeft', { shiftKey: true }))).toEqual({ change: 'resize-end', days: -1 });
    expect(rangeKeyAction(key('ArrowRight', { altKey: true, shiftKey: true }))).toEqual({ change: 'resize-start', days: 1 });
    expect(rangeKeyAction(key('ArrowDown', { shiftKey: true }))).toBeNull();
    expect(rangeKeyAction(key('ArrowRight'))).toBeNull();
    expect(rangeKeyAction(key('ArrowRight', { altKey: true, ctrlKey: true }))).toBeNull();
  });

  it('maps the cell selection keys', () => {
    expect(selectionKeyStep(key('ArrowDown', { shiftKey: true }))).toBe(7);
    expect(selectionKeyStep(key('ArrowLeft', { shiftKey: true }))).toBe(-1);
    expect(selectionKeyStep(key('ArrowLeft'))).toBe(0);
    expect(selectionKeyStep(key('ArrowLeft', { shiftKey: true, altKey: true }))).toBe(0);
  });
});

describe('layoutWeek', () => {
  const ev = (id: string, start: Date, end: Date, allDay = true) => ({ id, start, end, allDay });
  const week = d(11); // Monday 11 May 2026

  it('spans a multi-day event and flags continuation into other weeks', () => {
    const { segments, lanes } = layoutWeek([ev('a', d(8), d(13)), ev('b', d(16), d(20))], week, 3);
    expect(lanes).toBe(1);
    expect(segments.map(({ event, startCol, span, continuesBefore, continuesAfter }) => [event.id, startCol, span, continuesBefore, continuesAfter])).toEqual([
      ['a', 0, 2, true, false],
      ['b', 5, 2, false, true],
    ]);
  });

  it('stacks overlapping events in lanes and counts the hidden ones per day', () => {
    const events = [
      ev('long', d(11), d(18)),
      ev('mid', d(12), d(15)),
      ev('one', d(13, 9), d(13, 10), false),
      ev('four', d(13), d(14)),
    ];
    const { segments, lanes, hidden } = layoutWeek(events, week, 3);
    expect(lanes).toBe(3);
    expect(Object.fromEntries(segments.map((s) => [s.event.id, s.lane]))).toEqual({ long: 0, mid: 1, four: 2 });
    expect(segments.find((s) => s.event.id === 'four')?.isRange).toBe(true);
    expect(hidden).toEqual([0, 0, 1, 0, 0, 0, 0]);
  });

  it('skips events outside the week', () => {
    expect(layoutWeek([ev('x', d(1), d(11))], week, 3)).toEqual({ segments: [], lanes: 0, hidden: [0, 0, 0, 0, 0, 0, 0] });
  });
});
