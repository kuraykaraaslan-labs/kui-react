// Time-axis maths for the Chart family (phase 9 §9.1). Dependency-free and pure.
// kui-ejs mirror (`scripts/chart-helpers.js`) is still to do (phase 9 §9.1).

import type { Series, PlotRect } from '../types';

export type TimeDomain = [number, number];

/** A series x value as epoch milliseconds: a number is taken as ms, a string must be a parsable date. */
export function toTime(x: string | number): number | null {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  // A date-only string ("2026-10-06") is a calendar DAY, not an instant: Date.parse reads it as
  // UTC midnight, which a viewer west of UTC would see labelled as the previous day.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime();
  const t = Date.parse(x);
  return Number.isNaN(t) ? null : t;
}

/** True when EVERY point of EVERY series has a time-like x (and there is at least one point). */
export function isTimeSeries(series: Series[]): boolean {
  let any = false;
  for (const s of series) {
    for (const p of s.data) {
      if (toTime(p.x) === null) return false;
      any = true;
    }
  }
  return any;
}

/** Full extent of the data. A single instant is widened so the scale has a width. */
export function timeExtent(series: Series[]): TimeDomain {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) {
    for (const p of s.data) {
      const t = toTime(p.x);
      if (t === null) continue;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
  }
  if (!Number.isFinite(lo)) return [0, 1];
  if (lo === hi) return [lo - 30 * 60_000, hi + 30 * 60_000];
  return [lo, hi];
}

/** Points of each series that fall inside the domain (inclusive), as `{ t, y, label }`. */
export interface TimePoint { t: number; y: number | null; label?: string }
export function timePoints(series: Series[]): TimePoint[][] {
  return series.map((s) => {
    const out: TimePoint[] = [];
    for (const p of s.data) {
      const t = toTime(p.x);
      if (t !== null) out.push({ t, y: p.y, label: p.label });
    }
    return out.sort((a, b) => a.t - b.t);
  });
}

export function inDomain(points: TimePoint[], [lo, hi]: TimeDomain): TimePoint[] {
  return points.filter((p) => p.t >= lo && p.t <= hi);
}

/** y extent over the visible points; always includes zero, like the band charts. */
export function visibleYExtent(all: TimePoint[][], domain: TimeDomain, includeZero = true): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const pts of all) {
    for (const p of inDomain(pts, domain)) {
      if (p.y === null || p.y === undefined) continue;
      if (p.y < min) min = p.y;
      if (p.y > max) max = p.y;
    }
  }
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 1;
  if (includeZero) {
    if (min > 0) min = 0;
    if (max < 0) max = 0;
  }
  return { min, max };
}

export function xTime(t: number, [lo, hi]: TimeDomain, rect: PlotRect): number {
  if (hi === lo) return rect.x + rect.width / 2;
  return rect.x + ((t - lo) / (hi - lo)) * rect.width;
}

export function invTime(px: number, [lo, hi]: TimeDomain, rect: PlotRect): number {
  if (rect.width <= 0) return lo;
  return lo + ((px - rect.x) / rect.width) * (hi - lo);
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const STEPS = [
  SECOND, 5 * SECOND, 15 * SECOND, 30 * SECOND,
  MINUTE, 5 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
  DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 91 * DAY, 182 * DAY, 365 * DAY,
];

/** The tick step (ms) for a span, giving at most about `target` ticks. */
export function tickStep(span: number, target: number): number {
  const want = Math.max(1, target);
  return STEPS.find((s) => span / s <= want) ?? STEPS[STEPS.length - 1];
}

/**
 * The offset of `timeZone` from UTC at an instant, in ms (east is positive). `undefined` or an unknown zone
 * is the browser's own.
 */
export function zoneOffsetMs(ms: number, timeZone?: string): number {
  if (!timeZone) return -new Date(ms).getTimezoneOffset() * MINUTE;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(ms / 1000) * 1000;
  } catch {
    return -new Date(ms).getTimezoneOffset() * MINUTE;
  }
}

/** Ticks aligned to the step in the axis zone (the browser's, or `timeZone`), so day ticks land on midnight, not 02:00. */
export function timeTicks(domain: TimeDomain, target = 6, timeZone?: string): number[] {
  const [lo, hi] = domain;
  if (!(hi > lo)) return [lo];
  const step = tickStep(hi - lo, target);
  const off = -zoneOffsetMs(lo, timeZone);
  const out: number[] = [];
  for (let t = Math.ceil((lo - off) / step) * step + off; t <= hi; t += step) out.push(t);
  return out.length ? out : [lo, hi];
}

/** `HH:mm` (24 h), with seconds when asked. */
export function clockText(ms: number, locale?: string, timeZone?: string, seconds = false): string {
  return new Date(ms).toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), hourCycle: 'h23', ...(timeZone ? { timeZone } : {}),
  });
}

/** `d MMM` (6 Oct), with the year (`d MMM yyyy`) when asked; the month name follows the locale. */
export function dayMonthText(ms: number, locale?: string, timeZone?: string, year = false): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), ...(timeZone ? { timeZone } : {}) })
      .formatToParts(new Date(ms));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return [get('day'), get('month').replace(/\.$/, ''), year ? get('year') : ''].filter(Boolean).join(' ');
  } catch {
    return new Date(ms).toDateString();
  }
}

/** Compact tick label for the visible span (`HH:mm`, `d MMM`, `MMM yy`), in `timeZone` when given. */
export function formatTick(ms: number, span: number, locale?: string, timeZone?: string): string {
  const d = new Date(ms);
  const z = timeZone ? { timeZone } : {};
  if (span <= 10 * MINUTE) return clockText(ms, locale, timeZone, true);
  if (span <= 2 * DAY) return clockText(ms, locale, timeZone);
  if (span <= 7 * DAY) return `${dayMonthText(ms, locale, timeZone)} ${clockText(ms, locale, timeZone)}`;
  if (span <= 400 * DAY) return dayMonthText(ms, locale, timeZone);
  return d.toLocaleDateString(locale, { year: '2-digit', month: 'short', ...z });
}

/** Full label for the tooltip header (`d MMM yyyy`, or `d MMM HH:mm`), in `timeZone` when given. */
export function formatFull(ms: number, span: number, locale?: string, timeZone?: string): string {
  return span > 2 * DAY
    ? dayMonthText(ms, locale, timeZone, true)
    : `${dayMonthText(ms, locale, timeZone)} ${clockText(ms, locale, timeZone, span <= 10 * MINUTE)}`;
}

/** Smallest zoom window: a brush narrower than this (ms) is ignored. */
export const MIN_ZOOM_MS = 1000;
/** Smallest brush in pixels that counts as a zoom gesture (not a click). */
export const MIN_BRUSH_PX = 8;

/** The domain a brush from `px0` to `px1` selects, clamped to `full`; null when it is too small. */
export function brushDomain(px0: number, px1: number, domain: TimeDomain, full: TimeDomain, rect: PlotRect): TimeDomain | null {
  if (Math.abs(px1 - px0) < MIN_BRUSH_PX) return null;
  const a = invTime(Math.min(px0, px1), domain, rect);
  const b = invTime(Math.max(px0, px1), domain, rect);
  const lo = Math.max(full[0], a);
  const hi = Math.min(full[1], b);
  return hi - lo < MIN_ZOOM_MS ? null : [lo, hi];
}

// ── A range the viewer selects for the host (dashboard phase 35: a brush that moves the board window) ──

/** What a brush or a keyboard selection reports: epoch ms, `from < to`. */
export interface TimeRange { from: number; to: number }

/** A keyboard selection along the x axis, in data units (ms, or a category index): where it started and where its end is. */
export interface KeySelection { anchor: number; focus: number }

/** The range a time-axis brush from `px0` to `px1` reports (the zoom rules: at least `MIN_BRUSH_PX` wide and `MIN_ZOOM_MS` long). */
export function brushRange(px0: number, px1: number, domain: TimeDomain, full: TimeDomain, rect: PlotRect): TimeRange | null {
  const d = brushDomain(px0, px1, domain, full, rect);
  return d ? { from: d[0], to: d[1] } : null;
}

/** The category index under `along` px from the start of a band axis of `count` categories `step` px wide (clamped). */
export function bandIndex(along: number, step: number, count: number): number {
  if (count <= 0 || !(step > 0)) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(along / step)));
}

/**
 * The time range of the categories `i0` to `i1` (either order) of a band axis whose categories are instants: from the
 * first one's instant to the END of the last one's bucket (the next category's instant, or the last gap carried past the
 * end). Null without a second instant to size a bucket from.
 */
export function bandRange(times: readonly number[], i0: number, i1: number): TimeRange | null {
  if (times.length < 2) return null;
  const a = Math.max(0, Math.min(i0, i1));
  const b = Math.min(times.length - 1, Math.max(i0, i1));
  if (!(b >= a)) return null;
  const from = times[a];
  const to = b + 1 < times.length ? times[b + 1] : times[b] + (times[b] - times[b - 1]);
  return Number.isFinite(from) && Number.isFinite(to) && to > from ? { from, to } : null;
}

/**
 * The selection after an arrow key: the arrows move its end (`focus`) by `step`, Shift + arrows move its start
 * (`anchor`); both stay inside `lo..hi` and the start never passes the end. The first key starts both at `lo`.
 */
export function keyRange(sel: KeySelection | null, dir: -1 | 1, shift: boolean, lo: number, hi: number, step: number): KeySelection {
  const cur = sel ?? { anchor: lo, focus: lo };
  const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
  if (shift) {
    const anchor = clamp(cur.anchor + dir * step);
    return { anchor: Math.min(anchor, cur.focus), focus: cur.focus };
  }
  const focus = clamp(cur.focus + dir * step);
  return { anchor: Math.min(cur.anchor, focus), focus };
}

/** The range a keyboard selection on a time axis reports (too short = nothing). */
export function keyedTimeRange(sel: KeySelection): TimeRange | null {
  return sel.focus - sel.anchor >= MIN_ZOOM_MS ? { from: sel.anchor, to: sel.focus } : null;
}

/** Index of the time in the sorted `times` nearest to `t`. */
export function nearestIndex(times: number[], t: number): number {
  if (times.length === 0) return -1;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(times[lo - 1] - t) <= Math.abs(times[lo] - t)) return lo - 1;
  return lo;
}
