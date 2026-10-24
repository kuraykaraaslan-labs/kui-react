/*
 * Time formatting shared by the IoT components: relative ("3 min ago") through Intl.RelativeTimeFormat and absolute through
 * Intl.DateTimeFormat, both in the caller's locale, so a host never re-implements them. Pure; `now` is injectable for tests
 * and for deterministic demos.
 */

export type TimeInput = Date | string | number | null | undefined;

export function toDate(v: TimeInput): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** "3 minutes ago" / "in 2 hours" in `locale`; `fallback` for a missing time. */
export function formatRelative(v: TimeInput, opts: { locale?: string; now?: number; fallback?: string } = {}): string {
  const d = toDate(v);
  if (!d) return opts.fallback ?? '—';
  const diffSec = Math.round((d.getTime() - (opts.now ?? Date.now())) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(opts.locale, { numeric: 'auto', style: 'short' });
  for (const [unit, size] of UNITS) {
    if (abs >= size || unit === 'second') return rtf.format(Math.trunc(diffSec / size), unit);
  }
  return rtf.format(0, 'second');
}

/** "24 Oct 2026, 14:05" in `locale`. */
export function formatDateTime(v: TimeInput, opts: { locale?: string; timeZone?: string; fallback?: string } = {}): string {
  const d = toDate(v);
  if (!d) return opts.fallback ?? '—';
  return new Intl.DateTimeFormat(opts.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: opts.timeZone }).format(d);
}

/** Seconds since `v` (null when unknown). */
export function ageSeconds(v: TimeInput, now = Date.now()): number | null {
  const d = toDate(v);
  return d ? Math.max(0, Math.round((now - d.getTime()) / 1000)) : null;
}

/** Fills `{name}` placeholders of a message template. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
