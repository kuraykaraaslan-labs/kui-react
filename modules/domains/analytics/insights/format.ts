import type { SearchEngineId } from '../types'

/** Each engine's fixed series colour (validated set, `--chart-*` tokens). Identity follows the engine, never its rank. */
export const ENGINE_COLOR: Record<SearchEngineId, string> = {
  gsc: 'var(--chart-1)',
  bing: 'var(--chart-2)',
  yandex: 'var(--chart-3)',
}

/** A single-series chart (one source's metric) uses the first slot. */
export const SINGLE_SERIES_COLOR = 'var(--chart-1)'

export type InsightsFormat = {
  int: (v: number) => string
  compact: (v: number) => string
  percent: (fraction: number) => string
  position: (v: number) => string
  signedPercent: (fraction: number) => string
  day: (iso: string) => string
  date: (iso: string) => string
  dateTime: (iso: string) => string
}

/** Locale-aware number and date formats for the view (Intl only, no library). */
export function insightsFormat(locale?: string): InsightsFormat {
  const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
  const pct = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const signed = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' })
  const pos = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const asDate = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso)
  const safe = (f: Intl.DateTimeFormat, iso: string) => {
    const d = asDate(iso)
    return Number.isNaN(d.getTime()) ? iso : f.format(d)
  }
  return {
    int: (v) => int.format(v),
    compact: (v) => (Math.abs(v) >= 10000 ? compact.format(v) : int.format(v)),
    percent: (v) => pct.format(v),
    position: (v) => (v > 0 ? pos.format(v) : '–'),
    signedPercent: (v) => signed.format(v),
    day: (iso) => safe(day, iso),
    date: (iso) => safe(date, iso),
    dateTime: (iso) => safe(dateTime, iso),
  }
}
