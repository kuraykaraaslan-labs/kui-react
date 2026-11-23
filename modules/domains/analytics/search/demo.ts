import type { SiteSearchQueryRow, SiteSearchReport } from '../types'

const QUERIES: ReadonlyArray<readonly [key: string, weight: number, zeroShare: number, ctr: number, language: string]> = [
  ['pricing', 0.14, 0, 0.62, 'en'],
  ['api key', 0.09, 0, 0.55, 'en'],
  ['webhook retry', 0.07, 0, 0.48, 'en'],
  ['export csv', 0.06, 0, 0.51, 'en'],
  ['preise', 0.05, 0, 0.58, 'de'],
  ['single sign-on', 0.045, 0, 0.44, 'en'],
  ['two-factor', 0.04, 0, 0.5, 'en'],
  ['fiyatlar', 0.035, 0, 0.6, 'tr'],
  ['invoice download', 0.03, 0, 0.39, 'en'],
  ['delete account', 0.028, 0, 0.47, 'en'],
  ['tarifs', 0.024, 0, 0.53, 'fr'],
  ['rate limit', 0.022, 0, 0.42, 'en'],
  ['dark mode', 0.02, 0.4, 0.21, 'en'],
  ['on-premises install', 0.018, 1, 0, 'en'],
  ['gantt pdf export', 0.015, 1, 0, 'en'],
  ['status page', 0.012, 1, 0, 'en'],
  ['bestellung [number]', 0.009, 1, 0, 'de'],
  ['[e-mail]', 0.007, 1, 0, 'en'],
  ['fatura iptali', 0.006, 1, 0, 'tr'],
]

const RESULTS: ReadonlyArray<readonly [url: string, title: string, weight: number, from: readonly string[]]> = [
  ['/pricing/', 'Pricing', 0.27, ['pricing', 'preise', 'fiyatlar', 'tarifs']],
  ['/docs/api/keys/', 'API keys', 0.13, ['api key', 'rate limit']],
  ['/docs/webhooks/retries/', 'Webhook retries and delivery', 0.1, ['webhook retry']],
  ['/docs/export/', 'Exporting your data', 0.09, ['export csv', 'invoice download']],
  ['/docs/security/sso/', 'Single sign-on (SAML and OIDC)', 0.08, ['single sign-on']],
  ['/docs/security/two-factor/', 'Two-factor sign-in', 0.07, ['two-factor']],
  ['/help/account/delete/', 'Deleting an account', 0.06, ['delete account']],
  ['/blog/a-darker-theme-for-long-evenings-and-everything-we-changed-to-get-there/', 'A darker theme for long evenings', 0.03, ['dark mode']],
]

/**
 * A deterministic demo report (showcase and tests): 28 days ending 2026-11-22 (or `days`), English with German,
 * Turkish and French searches, a few that find nothing (two of them masked). `empty` gives a site nobody searched yet.
 */
export function demoSearchReport(opts: { days?: number; empty?: boolean } = {}): SiteSearchReport {
  const days = Math.max(1, Math.round(opts.days ?? 28))
  const end = Date.UTC(2026, 10, 22)
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  const dates = Array.from({ length: days }, (_, i) => iso(end - (days - 1 - i) * 86400000))
  const range = { start: dates[0], end: dates[days - 1], days }
  const previousRange = { start: iso(end - (2 * days - 1) * 86400000), end: iso(end - days * 86400000), days }
  const generatedAt = '2026-11-22T18:40:00Z'
  if (opts.empty) {
    return {
      generatedAt, range, previousRange, retentionDays: 90,
      totals: { searches: 0, searchers: 0, zeroResult: 0, clicks: 0, clickThrough: 0 },
      previousTotals: {},
      days: dates.map((date) => ({ date, searches: 0, searchers: 0, zeroResult: 0, clicks: 0 })),
      topQueries: [], zeroResultQueries: [], topClicked: [], languages: [],
    }
  }

  const dayRows = dates.map((date, i) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    const weekend = weekday === 0 || weekday === 6 ? 0.55 : 1
    const searches = Math.round((46 + i * 0.6 + 6 * Math.sin(i * 0.8)) * weekend)
    const zeroResult = Math.round(searches * (0.105 - i * 0.0012))
    const clicks = Math.round(searches * 0.47)
    return { date, searches, searchers: Math.round(searches * 0.71), zeroResult, clicks }
  })
  const sum = (k: 'searches' | 'searchers' | 'zeroResult' | 'clicks') => dayRows.reduce((s, d) => s + d[k], 0)
  const totals = { searches: sum('searches'), searchers: sum('searchers'), zeroResult: sum('zeroResult'), clicks: sum('clicks'), clickThrough: 0 }
  totals.clickThrough = totals.searches ? totals.clicks / totals.searches : 0
  const prevSearches = Math.round(totals.searches / 1.16)
  const previousTotals = {
    searches: prevSearches,
    searchers: Math.round(prevSearches * 0.7),
    zeroResult: Math.round(prevSearches * 0.122),
    clicks: Math.round(prevSearches * 0.43),
    clickThrough: 0.43,
  }

  const lastSeen = (i: number) => new Date(end + 17 * 3600000 - i * 7 * 3600000).toISOString()
  const rows: SiteSearchQueryRow[] = QUERIES.map(([key, w, zeroShare, ctr, language], i) => {
    const searches = Math.max(1, Math.round(totals.searches * w))
    const zeroResults = Math.round(searches * zeroShare)
    const clicks = Math.round((searches - zeroResults) * ctr)
    return { key, searches, zeroResults, clicks, ctr: searches ? clicks / searches : 0, lastSeen: lastSeen(i), language }
  })
  // Each language's share of the searches, and how much more (or less) often than average it finds nothing.
  const LANGS: ReadonlyArray<readonly [string, number, number]> = [['en', 0.78, 0.9], ['de', 0.11, 1.4], ['tr', 0.07, 1.6], ['fr', 0.04, 0.7]]
  const languages = LANGS.map(([key, share, zeroFactor]) => {
    const searches = Math.round(totals.searches * share)
    return {
      key,
      searches,
      zeroResults: Math.round(searches * (totals.zeroResult / totals.searches) * zeroFactor),
      clicks: Math.round(searches * (totals.clicks / totals.searches) * (2 - zeroFactor)),
    }
  })
  return {
    generatedAt,
    range,
    previousRange,
    retentionDays: 90,
    totals,
    previousTotals,
    days: dayRows,
    topQueries: rows.slice().sort((a, b) => b.searches - a.searches),
    zeroResultQueries: rows.filter((r) => r.searches > 0 && r.zeroResults === r.searches),
    topClicked: RESULTS.map(([url, title, w, from]) => ({ url, title, clicks: Math.round(totals.clicks * w), fromQueries: [...from] })),
    languages,
  }
}
