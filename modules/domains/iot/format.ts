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

/**
 * "24 Oct 2026, 14:05 GMT+3" in `locale`, with its zone named (a time read by people in other zones is never ambiguous); in the
 * host's `timeZone` when it passes one, else the browser's.
 */
export function formatDateTime(v: TimeInput, opts: { locale?: string; timeZone?: string; fallback?: string } = {}): string {
  const d = toDate(v);
  if (!d) return opts.fallback ?? '—';
  const parts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
  try {
    return new Intl.DateTimeFormat(opts.locale, { ...parts, timeZone: opts.timeZone }).format(d);
  } catch {
    // an unknown zone name from the host: the browser's zone, still named
    return new Intl.DateTimeFormat(opts.locale, parts).format(d);
  }
}

/** Seconds since `v` (null when unknown). */
export function ageSeconds(v: TimeInput, now = Date.now()): number | null {
  const d = toDate(v);
  return d ? Math.max(0, Math.round((now - d.getTime()) / 1000)) : null;
}

/**
 * A count in words: `forms.one` or `forms.other` by the locale's plural rule ("1 device", "3 devices"), `{n}` filled with the count
 * in the locale's digits.
 */
export function plural(n: number, forms: { one: string; other: string }, locale?: string): string {
  let rule: Intl.LDMLPluralRule = 'other';
  try { rule = new Intl.PluralRules(locale).select(n); } catch { /* an unknown locale: the other form */ }
  let shown = String(n);
  try { shown = new Intl.NumberFormat(locale).format(n); } catch { /* an unknown locale: plain digits */ }
  return fill(rule === 'one' ? forms.one : forms.other, { n: shown });
}

/** A number with at most `digits` decimals in the locale's notation ("1,5" in Turkish). */
export function formatNumber(n: number, locale?: string, digits = 1): string {
  try { return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n); } catch { return String(Math.round(n * 10 ** digits) / 10 ** digits); }
}

/** Fills `{name}` placeholders of a message template. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
