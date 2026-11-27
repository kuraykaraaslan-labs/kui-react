/**
 * Countdown maths and words, kept free of React so kui-ejs's browser script and other ports follow the same rules.
 *
 * Remaining time is elapsed time (end − now in milliseconds), never calendar arithmetic: a countdown that crosses a
 * daylight-saving change shows the real hours left, and a "day" is always 24 hours.
 */

export type CountdownDateInput = Date | string | number;

export type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds';

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Milliseconds left, 0 once ended. */
  totalMs: number;
  ended: boolean;
};

export type CountdownLabels = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  daysShort: string;
  hoursShort: string;
  minutesShort: string;
  secondsShort: string;
  /** Read before the end date by screen readers ("Ends 1 Dec 2026, 18:00"). */
  endsAt: string;
  /** Shown instead of the numbers once the end date has passed. */
  ended: string;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_COUNTDOWN_LABELS: Record<'en' | 'tr', CountdownLabels> = {
  en: {
    days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds',
    daysShort: 'd', hoursShort: 'h', minutesShort: 'm', secondsShort: 's',
    endsAt: 'Ends', ended: 'Ended',
  },
  tr: {
    days: 'Gün', hours: 'Saat', minutes: 'Dakika', seconds: 'Saniye',
    daysShort: 'g', hoursShort: 'sa', minutesShort: 'dk', secondsShort: 'sn',
    endsAt: 'Bitiş', ended: 'Sona erdi',
  },
};

/** The default words for a locale: Turkish for `tr`/`tr-*`, English otherwise. */
export function countdownLabels(locale?: string, overrides?: Partial<CountdownLabels>): CountdownLabels {
  const base = locale && /^tr(-|$)/i.test(locale) ? DEFAULT_COUNTDOWN_LABELS.tr : DEFAULT_COUNTDOWN_LABELS.en;
  return { ...base, ...overrides };
}

/** Milliseconds since the epoch, or NaN for an unreadable input. */
export function toEpochMs(input: CountdownDateInput): number {
  if (input instanceof Date) return input.getTime();
  if (typeof input === 'number') return input;
  return Date.parse(input);
}

/**
 * Splits the time left until `endsAt` into days/hours/minutes/seconds (floored). Without seconds the minutes still
 * floor, so "0m" shows during the last minute and the countdown ends at the real end time, not a minute early.
 */
export function splitRemaining(endsAt: CountdownDateInput, now: CountdownDateInput): CountdownParts {
  const end = toEpochMs(endsAt);
  const at = toEpochMs(now);
  const left = Number.isFinite(end) && Number.isFinite(at) ? end - at : 0;
  if (left <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, ended: true };
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor((left % DAY) / HOUR),
    minutes: Math.floor((left % HOUR) / MINUTE),
    seconds: Math.floor((left % MINUTE) / SECOND),
    totalMs: left,
    ended: false,
  };
}

/** How often the display changes: every second with seconds shown, every minute without. */
export function tickStep(showSeconds: boolean): number {
  return showSeconds ? SECOND : MINUTE;
}

/**
 * Milliseconds until the shown value next changes (the next whole step of the time left), at least 1 and at most
 * one step. Used to schedule the next tick so a minute countdown wakes once a minute, on the minute.
 */
export function msUntilNextTick(endsAt: CountdownDateInput, now: CountdownDateInput, step: number): number {
  const left = toEpochMs(endsAt) - toEpochMs(now);
  if (!Number.isFinite(left) || left <= 0) return step;
  const rest = left % step;
  return rest === 0 ? step : rest;
}

/** The units drawn, in order. */
export function countdownUnits(showSeconds: boolean): CountdownUnit[] {
  return showSeconds ? ['days', 'hours', 'minutes', 'seconds'] : ['days', 'hours', 'minutes'];
}

/** A unit's text: boxed pads hours/minutes/seconds to two digits, compact never pads; days are never padded. */
export function formatUnit(unit: CountdownUnit, value: number, variant: 'compact' | 'boxed'): string {
  return variant === 'boxed' && unit !== 'days' ? String(value).padStart(2, '0') : String(value);
}

/** The end date for screen readers, in the viewer's (or the given) time zone. */
export function formatEndDate(endsAt: CountdownDateInput, locale?: string, timeZone?: string): string {
  const ms = toEpochMs(endsAt);
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(ms);
  } catch {
    return new Date(ms).toISOString();
  }
}

/** The ISO string for `<time datetime>`, or '' for an unreadable input. */
export function toIsoString(input: CountdownDateInput): string {
  const ms = toEpochMs(input);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}
