import type { InsightsSnapshot, InsightsSourceState } from '../types'

/**
 * A deterministic demo snapshot (showcase and tests): 28 days ending 2026-11-22, Google Analytics, Google Search and
 * Bing connected, Yandex as asked. Numbers follow a weekly rhythm with a slow rise, so charts look like a real site.
 */
export function demoInsightsSnapshot(opts: { yandex?: InsightsSourceState; bing?: InsightsSourceState; analytics?: InsightsSourceState } = {}): InsightsSnapshot {
  const days = 28
  const end = Date.UTC(2026, 10, 22)
  const dates = Array.from({ length: days }, (_, i) => new Date(end - (days - 1 - i) * 86400000).toISOString().slice(0, 10))
  const wave = (i: number, base: number, amp: number, rise: number) => {
    const weekday = new Date(`${dates[i]}T00:00:00Z`).getUTCDay()
    const weekend = weekday === 0 || weekday === 6 ? 0.62 : 1
    return Math.round((base + rise * i + amp * Math.sin(i * 0.9)) * weekend)
  }
  const searchDays = (base: number, rise: number, ctr: number, position: number) =>
    dates.map((date, i) => {
      const clicks = wave(i, base, base * 0.08, rise)
      const impressions = Math.round(clicks / ctr)
      return { date, clicks, impressions, ctr: clicks / impressions, position: position - i * 0.01 }
    })
  const total = (rows: { clicks: number; impressions: number; position: number }[]) => {
    const clicks = rows.reduce((s, r) => s + r.clicks, 0)
    const impressions = rows.reduce((s, r) => s + r.impressions, 0)
    const position = rows.reduce((s, r) => s + r.position * r.impressions, 0) / Math.max(impressions, 1)
    return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position }
  }
  const gscDays = searchDays(64, 1.1, 0.041, 14.2)
  const bingDays = searchDays(11, 0.2, 0.052, 9.8)
  const yandexDays = searchDays(3, 0.05, 0.06, 7.4)
  const gaDays = dates.map((date, i) => {
    const sessions = wave(i, 180, 14, 2.1)
    return { date, users: Math.round(sessions * 0.81), sessions, views: Math.round(sessions * 2.35) }
  })
  const range = { start: dates[0], end: dates[days - 1], days }
  const previousRange = { start: new Date(end - (2 * days - 1) * 86400000).toISOString().slice(0, 10), end: new Date(end - days * 86400000).toISOString().slice(0, 10), days }
  const queries = [
    ['modbus rtu gateway', 0.31], ['iot platform', 0.18], ['mqtt telemetry topic', 0.12], ['scada web', 0.09],
    ['Modbus RTU Gateway', 0.0], ['remote device monitoring', 0.07], ['lorawan sensor dashboard', 0.05], ['opc ua to mqtt', 0.04],
  ] as const
  const pages = [
    ['/', 0.28], ['/pricing/', 0.14], ['/scada/', 0.11], ['/docs/getting-started/', 0.09], ['/topic/modbus-rtu-meter-reads-0-after-gateway-restart/', 0.07],
    ['/blog/mqtt-topic-design/', 0.05], ['/platform/devices/', 0.04],
  ] as const
  const searchRows = (t: { clicks: number; impressions: number; position: number }, list: readonly (readonly [string, number])[], posBase: number) =>
    list.filter(([, w]) => w > 0).map(([key, w], i) => {
      const clicks = Math.round(t.clicks * w)
      const impressions = Math.round(t.impressions * w * (1.4 - i * 0.08))
      return { key, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: posBase + i * 1.7 }
    })
  const scale = (t: ReturnType<typeof total>, f: number) => ({ clicks: Math.round(t.clicks * f), impressions: Math.round(t.impressions * f), ctr: t.ctr * 0.96, position: t.position + 0.8 })
  const gscT = total(gscDays)
  const bingT = total(bingDays)
  const yandexT = total(yandexDays)
  const gaT = { users: gaDays.reduce((s, d) => s + d.users, 0), sessions: gaDays.reduce((s, d) => s + d.sessions, 0), views: gaDays.reduce((s, d) => s + d.views, 0), engagementRate: 0.583 }
  const fetchedAt = '2026-11-23T06:00:00Z'
  const searchSource = (id: 'gsc' | 'bing' | 'yandex', label: string, state: InsightsSourceState, rows: typeof gscDays, t: ReturnType<typeof total>, posBase: number, grow: number) =>
    state === 'off'
      ? { id, kind: 'search' as const, label, state, message: '', fetchedAt: null, totals: {}, previousTotals: {}, days: [], topQueries: [], topPages: [] }
      : {
          id, kind: 'search' as const, label, state,
          message: state === 'error' ? 'The API answered 401: the key was refused.' : '',
          fetchedAt: state === 'error' ? '2026-11-21T06:00:00Z' : fetchedAt,
          range, totals: t, previousTotals: scale(t, 1 / grow), days: rows,
          topQueries: searchRows(t, queries, posBase), topPages: searchRows(t, pages, posBase - 2),
        }
  return {
    generatedAt: fetchedAt,
    range,
    previousRange,
    sources: [
      opts.analytics === 'off'
        ? { id: 'ga4', kind: 'analytics', label: 'Google Analytics', state: 'off', message: '', fetchedAt: null, totals: {}, previousTotals: {}, days: [], topPages: [], channels: [] }
        : {
            id: 'ga4', kind: 'analytics', label: 'Google Analytics', state: opts.analytics ?? 'ok', message: '', fetchedAt, range,
            totals: gaT,
            previousTotals: { users: Math.round(gaT.users / 1.12), sessions: Math.round(gaT.sessions / 1.1), views: Math.round(gaT.views / 1.15), engagementRate: 0.561 },
            days: gaDays,
            topPages: pages.map(([key, w]) => ({ key, views: Math.round(gaT.views * w), users: Math.round(gaT.users * w * 0.9) })),
            channels: [
              { key: 'Organic Search', sessions: Math.round(gaT.sessions * 0.46) },
              { key: 'Direct', sessions: Math.round(gaT.sessions * 0.27) },
              { key: 'Referral', sessions: Math.round(gaT.sessions * 0.14) },
              { key: 'Organic Social', sessions: Math.round(gaT.sessions * 0.09) },
              { key: 'Unassigned', sessions: Math.round(gaT.sessions * 0.04) },
            ],
          },
      searchSource('gsc', 'Google Search', 'ok', gscDays, gscT, 6.2, 1.18),
      searchSource('bing', 'Bing', opts.bing ?? 'ok', bingDays, bingT, 4.1, 1.07),
      searchSource('yandex', 'Yandex', opts.yandex ?? 'off', yandexDays, yandexT, 3.3, 0.94),
    ],
  }
}
