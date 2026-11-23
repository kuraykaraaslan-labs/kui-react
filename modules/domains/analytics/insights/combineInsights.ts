import type {
  AnalyticsMetrics,
  AnalyticsSource,
  InsightsRange,
  InsightsSnapshot,
  SearchEngineId,
  SearchMetrics,
  SearchRow,
  SearchSource,
} from '../types'
import { SEARCH_ENGINES } from '../types'

/**
 * Every search engine of a snapshot in one picture, plus the analytics source beside it. Pure; the WordPress port
 * (`Kui\Insights\Combine::combine`) implements the same rules, so both sides show the same numbers:
 *
 * - An engine counts when it is not `off` and has data (a source in `error` keeps its last good data and still counts).
 * - Clicks and impressions add up; CTR is recomputed (clicks / impressions); the average position is weighted by
 *   impressions over the engines that report one (0 = none).
 * - Days: every date any engine or the analytics source has, ascending; an engine without that date is absent from
 *   `engines` (a gap, not a zero).
 * - Queries are merged case-insensitively (trimmed, lower-cased); pages by path. Top lists keep 25 rows: queries by
 *   clicks, then impressions; pages by views, then clicks; then by key.
 */

export type EngineShare = { id: SearchEngineId; label: string; clicks: number; impressions: number; share: number }

export type CombinedDay = {
  date: string
  clicks: number
  impressions: number
  /** Clicks per engine that has this date. */
  engines: Partial<Record<SearchEngineId, number>>
  /** Analytics page views and users; null when there is no analytics source. */
  views: number | null
  users: number | null
}

export type CombinedQuery = SearchMetrics & { key: string; engines: Partial<Record<SearchEngineId, number>> }
export type CombinedPage = SearchMetrics & { key: string; engines: Partial<Record<SearchEngineId, number>>; views: number; users: number }

export type CombinedInsights = {
  range: InsightsRange
  previousRange?: InsightsRange
  totals: SearchMetrics
  previousTotals: SearchMetrics
  byEngine: EngineShare[]
  days: CombinedDay[]
  topQueries: CombinedQuery[]
  topPages: CombinedPage[]
  analytics: { totals: Partial<AnalyticsMetrics>; previousTotals: Partial<AnalyticsMetrics> } | null
}

export const INSIGHTS_TOP_LIMIT = 25

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** A source counts when it is not off and has days or any totals (the PHP port's rule, byte for byte). */
function hasData(s: { days?: unknown[]; totals?: Record<string, unknown> }): boolean {
  return (s.days ?? []).length > 0 || Object.keys(s.totals ?? {}).length > 0
}

/** The engines that count, in the fixed engine order. */
export function activeEngines(snapshot: InsightsSnapshot): SearchSource[] {
  const found = snapshot.sources.filter((s): s is SearchSource => s.kind === 'search' && s.state !== 'off' && hasData(s))
  return SEARCH_ENGINES.flatMap((id) => found.filter((s) => s.id === id))
}

/** The analytics source when it is not off and has data. */
export function activeAnalytics(snapshot: InsightsSnapshot): AnalyticsSource | null {
  const s = snapshot.sources.find((x): x is AnalyticsSource => x.kind === 'analytics')
  return s && s.state !== 'off' && hasData(s) ? s : null
}

type Acc = { clicks: number; impressions: number; posWeight: number; posImpr: number }
const acc = (): Acc => ({ clicks: 0, impressions: 0, posWeight: 0, posImpr: 0 })
function add(a: Acc, m: Partial<SearchMetrics>): void {
  const impressions = num(m.impressions)
  const position = num(m.position)
  a.clicks += num(m.clicks)
  a.impressions += impressions
  if (position > 0) {
    a.posWeight += position * impressions
    a.posImpr += impressions
  }
}
function done(a: Acc): SearchMetrics {
  return {
    clicks: a.clicks,
    impressions: a.impressions,
    ctr: a.impressions > 0 ? a.clicks / a.impressions : 0,
    position: a.posImpr > 0 ? a.posWeight / a.posImpr : 0,
  }
}

function sumTotals(engines: SearchSource[], pick: 'totals' | 'previousTotals'): SearchMetrics {
  const a = acc()
  for (const e of engines) add(a, e[pick] ?? {})
  return done(a)
}

const byKey = (x: { key: string }, y: { key: string }) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0)

export function combineInsights(snapshot: InsightsSnapshot): CombinedInsights {
  const engines = activeEngines(snapshot)
  const analytics = activeAnalytics(snapshot)

  const totals = sumTotals(engines, 'totals')
  const previousTotals = sumTotals(engines, 'previousTotals')
  const byEngine: EngineShare[] = engines.map((e) => {
    const clicks = num(e.totals?.clicks)
    return { id: e.id as SearchEngineId, label: e.label, clicks, impressions: num(e.totals?.impressions), share: totals.clicks > 0 ? clicks / totals.clicks : 0 }
  })

  // Days
  const dayMap = new Map<string, CombinedDay>()
  const day = (date: string): CombinedDay => {
    let d = dayMap.get(date)
    if (!d) {
      d = { date, clicks: 0, impressions: 0, engines: {}, views: analytics ? 0 : null, users: analytics ? 0 : null }
      dayMap.set(date, d)
    }
    return d
  }
  for (const e of engines) {
    for (const row of e.days ?? []) {
      const d = day(row.date)
      d.clicks += num(row.clicks)
      d.impressions += num(row.impressions)
      d.engines[e.id as SearchEngineId] = (d.engines[e.id as SearchEngineId] ?? 0) + num(row.clicks)
    }
  }
  if (analytics) {
    for (const row of analytics.days ?? []) {
      const d = day(row.date)
      d.views = num(d.views) + num(row.views)
      d.users = num(d.users) + num(row.users)
    }
  }
  const days = [...dayMap.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  // Queries
  const queries = new Map<string, { a: Acc; engines: Partial<Record<SearchEngineId, number>> }>()
  for (const e of engines) {
    for (const row of e.topQueries ?? []) {
      const key = row.key.trim().toLowerCase()
      if (!key) continue
      const q = queries.get(key) ?? { a: acc(), engines: {} }
      add(q.a, row)
      q.engines[e.id as SearchEngineId] = (q.engines[e.id as SearchEngineId] ?? 0) + num(row.clicks)
      queries.set(key, q)
    }
  }
  const topQueries: CombinedQuery[] = [...queries.entries()]
    .map(([key, q]) => ({ key, ...done(q.a), engines: q.engines }))
    .sort((x, y) => y.clicks - x.clicks || y.impressions - x.impressions || byKey(x, y))
    .slice(0, INSIGHTS_TOP_LIMIT)

  // Pages
  const pages = new Map<string, { a: Acc; engines: Partial<Record<SearchEngineId, number>>; views: number; users: number }>()
  const page = (key: string) => {
    let p = pages.get(key)
    if (!p) {
      p = { a: acc(), engines: {}, views: 0, users: 0 }
      pages.set(key, p)
    }
    return p
  }
  for (const e of engines) {
    for (const row of (e.topPages ?? []) as SearchRow[]) {
      if (!row.key) continue
      const p = page(row.key)
      add(p.a, row)
      p.engines[e.id as SearchEngineId] = (p.engines[e.id as SearchEngineId] ?? 0) + num(row.clicks)
    }
  }
  if (analytics) {
    for (const row of analytics.topPages ?? []) {
      if (!row.key) continue
      const p = page(row.key)
      p.views += num(row.views)
      p.users += num(row.users)
    }
  }
  const topPages: CombinedPage[] = [...pages.entries()]
    .map(([key, p]) => ({ key, ...done(p.a), engines: p.engines, views: p.views, users: p.users }))
    .sort((x, y) => y.views - x.views || y.clicks - x.clicks || byKey(x, y))
    .slice(0, INSIGHTS_TOP_LIMIT)

  return {
    range: snapshot.range,
    previousRange: snapshot.previousRange,
    totals,
    previousTotals,
    byEngine,
    days,
    topQueries,
    topPages,
    analytics: analytics ? { totals: analytics.totals ?? {}, previousTotals: analytics.previousTotals ?? {} } : null,
  }
}

/**
 * The change from `previous` to `current` as a fraction (0.12 = +12 %), or null when there is nothing to compare
 * (no previous value). `lowerIsBetter` (average position) flips which direction is good.
 */
export function insightsDelta(current: number, previous: number | undefined, lowerIsBetter = false): { change: number; good: boolean | null } | null {
  if (previous === undefined || !Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) return null
  const change = (current - previous) / previous
  if (change === 0) return { change: 0, good: null }
  return { change, good: lowerIsBetter ? change < 0 : change > 0 }
}
