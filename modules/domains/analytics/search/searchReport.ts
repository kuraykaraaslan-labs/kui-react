import type {
  SiteSearchClickedRow,
  SiteSearchDay,
  SiteSearchLanguageRow,
  SiteSearchQueryRow,
  SiteSearchReport,
  SiteSearchTotals,
} from '../types'

/**
 * Pure helpers of the site search report. The WordPress port (kui-wordpress-saas plugin/kui-search: `Query`,
 * `Report`) implements the same rules, so both sides store and show the same numbers:
 *
 * - A query is cleaned before it is counted: control characters out, trimmed, runs of white space made one space,
 *   then masked (e-mail addresses, phone numbers, card and bank account numbers, and any run of 6 or more digits such
 *   as an order number become a [label]), then lower-cased and cut to 80 characters.
 * - Rows of the same cleaned query merge: counts add up, the CTR is recomputed, `lastSeen` is the latest and the
 *   language is the one of the row with the most searches.
 * - Lists sort by searches, then clicks, then the query; results by clicks, then the address. 25 rows each.
 * - The no-results rate is zero-result searches / searches; the click-through rate clicks / searches.
 */

export const SEARCH_REPORT_LIMIT = 25
export const SEARCH_QUERY_MAX = 80

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

const CONTROL = /[\u0000-\u001F\u007F]+/gu
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?\b/g
const CARD = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g
const PHONE = /(?<![\p{L}\p{N}])\+?\(?\d{1,4}\)?(?:[ .-]?\(?\d{2,4}\)?){2,5}(?![\p{L}\p{N}])/gu
const LONG_NUMBER = /\d{6,}/g

/** Masks what could name or reach a person (kui-ai-chatbot `Policy::redact` plus long reference numbers). */
export function maskSearchQuery(text: string): string {
  return text
    .replace(EMAIL, '[e-mail]')
    .replace(IBAN, '[bank account]')
    .replace(CARD, '[card number]')
    .replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 9 ? '[phone]' : m))
    .replace(LONG_NUMBER, '[number]')
}

/** The query as it is stored and counted ('' = not worth counting: under two characters). */
export function cleanSearchQuery(raw: string): string {
  const spaced = Array.from(String(raw).replace(CONTROL, ' ').replace(/\s+/gu, ' ').trim()).slice(0, 200).join('')
  const q = Array.from(maskSearchQuery(spaced).toLowerCase()).slice(0, SEARCH_QUERY_MAX).join('').trim()
  return Array.from(q).length >= 2 ? q : ''
}

const byQuery = (a: SiteSearchQueryRow, b: SiteSearchQueryRow) =>
  b.searches - a.searches || b.clicks - a.clicks || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)

/** Merges rows of the same cleaned query (see the rules above), most searched first. */
export function mergeSearchQueries(rows: SiteSearchQueryRow[], limit = SEARCH_REPORT_LIMIT): SiteSearchQueryRow[] {
  const map = new Map<string, SiteSearchQueryRow & { langWeight: number }>()
  for (const r of rows) {
    const key = cleanSearchQuery(r.key) || r.key.trim().toLowerCase()
    if (!key) continue
    const searches = num(r.searches)
    const cur = map.get(key)
    if (!cur) {
      map.set(key, { key, searches, zeroResults: num(r.zeroResults), clicks: num(r.clicks), ctr: 0, lastSeen: r.lastSeen ?? null, language: r.language ?? '', langWeight: searches })
      continue
    }
    cur.searches += searches
    cur.zeroResults += num(r.zeroResults)
    cur.clicks += num(r.clicks)
    if (r.lastSeen && (!cur.lastSeen || r.lastSeen > cur.lastSeen)) cur.lastSeen = r.lastSeen
    if (searches > cur.langWeight) {
      cur.language = r.language ?? ''
      cur.langWeight = searches
    }
  }
  return [...map.values()]
    .map(({ langWeight: _w, ...r }) => ({ ...r, ctr: r.searches > 0 ? r.clicks / r.searches : 0 }))
    .sort(byQuery)
    .slice(0, limit)
}

export type SearchRates = { zeroRate: number; clickThrough: number }

/** The no-results and click-through rates of a set of totals (0 without searches). */
export function searchReportRates(t: Partial<SiteSearchTotals>): SearchRates {
  const s = num(t.searches)
  return { zeroRate: s > 0 ? num(t.zeroResult) / s : 0, clickThrough: s > 0 ? num(t.clicks) / s : 0 }
}

export type SearchLanguageShare = SiteSearchLanguageRow & { share: number; zeroRate: number }

export type CombinedSearchReport = {
  totals: SiteSearchTotals & SearchRates
  /** Null when there is nothing to compare with (no searches in the previous period). */
  previous: (SiteSearchTotals & SearchRates) | null
  days: SiteSearchDay[]
  topQueries: SiteSearchQueryRow[]
  zeroResultQueries: SiteSearchQueryRow[]
  topClicked: SiteSearchClickedRow[]
  languages: SearchLanguageShare[]
  /** No search at all in the range. */
  empty: boolean
}

const withRates = (t: Partial<SiteSearchTotals>): SiteSearchTotals & SearchRates => {
  const base = { searches: num(t.searches), searchers: num(t.searchers), zeroResult: num(t.zeroResult), clicks: num(t.clicks), clickThrough: 0 }
  const rates = searchReportRates(base)
  return { ...base, clickThrough: rates.clickThrough, zeroRate: rates.zeroRate }
}

/** Everything the view shows, ready to print: rates, sorted lists, each language's share of the searches. */
export function combineSearchReport(report: SiteSearchReport): CombinedSearchReport {
  const totals = withRates(report.totals ?? {})
  const prev = report.previousTotals ?? {}
  const previous = num(prev.searches) > 0 ? withRates(prev) : null
  const days = [...(report.days ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const langTotal = (report.languages ?? []).reduce((s, l) => s + num(l.searches), 0)
  const languages = [...(report.languages ?? [])]
    .map((l) => ({ ...l, share: langTotal > 0 ? num(l.searches) / langTotal : 0, zeroRate: num(l.searches) > 0 ? num(l.zeroResults) / num(l.searches) : 0 }))
    .sort((a, b) => b.searches - a.searches || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const topClicked = [...(report.topClicked ?? [])]
    .sort((a, b) => b.clicks - a.clicks || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0))
    .slice(0, SEARCH_REPORT_LIMIT)
  return {
    totals,
    previous,
    days,
    topQueries: mergeSearchQueries(report.topQueries ?? []),
    zeroResultQueries: mergeSearchQueries(report.zeroResultQueries ?? []),
    topClicked,
    languages,
    empty: totals.searches === 0,
  }
}

/** A language code in words, in the reader's language ("de" → "German"); '' → `unknown`. */
export function searchLanguageName(code: string, locale: string | undefined, unknown: string): string {
  const c = (code ?? '').trim()
  if (!c) return unknown
  try {
    return new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'language' }).of(c) ?? c.toUpperCase()
  } catch {
    return c.toUpperCase()
  }
}
