import type {
  SecurityCountRow, SecurityRefusalDay, SecuritySignInDay, SecuritySnapshot, SecuritySpamDay, SecurityBanDay,
} from './types'
import type { InsightsRange } from '../types'
import type { SecuritySummaryMessages } from './messages'
import { fillInsights } from '../insights/messages'

/* Pure helpers of the security summary (no React). The WordPress port mirrors them in kui-shield `SecurityReport`. */

export type SecurityTone = 'ok' | 'off' | 'warning' | 'critical'
export type SecurityStatus = { tone: SecurityTone; integrityOpen: number; healthOpen: number }

/** Open alerts decide the status: an integrity alert is critical, a health alert a warning; no server report is `off`. */
export function securityStatus(snapshot: Pick<SecuritySnapshot, 'server'>): SecurityStatus {
  const open = snapshot.server.alerts.filter((a) => a.state === 'open')
  const integrityOpen = open.filter((a) => a.kind === 'integrity').length
  const healthOpen = open.length - integrityOpen
  const tone: SecurityTone = integrityOpen > 0 ? 'critical' : healthOpen > 0 ? 'warning' : snapshot.server.state === 'off' ? 'off' : 'ok'
  return { tone, integrityOpen, healthOpen }
}

/** The status in words: "No alerts open", or "1 integrity alert open · 2 health alerts open". */
export function securityStatusText(status: SecurityStatus, m: SecuritySummaryMessages): string {
  const parts: string[] = []
  if (status.integrityOpen > 0) parts.push(status.integrityOpen === 1 ? m.integrityOpenOne : fillInsights(m.integrityOpenMany, { count: status.integrityOpen }))
  if (status.healthOpen > 0) parts.push(status.healthOpen === 1 ? m.healthOpenOne : fillInsights(m.healthOpenMany, { count: status.healthOpen }))
  if (parts.length) return parts.join(' · ')
  return status.tone === 'off' ? m.statusOff : m.statusOk
}

/** A key's words (`surface_signin`, `reason_country-cap`, `spam_honeypot`, `kind_health`), else the key itself. */
export function keyLabel(m: SecuritySummaryMessages, prefix: 'surface' | 'reason' | 'spam' | 'kind', key: string): string {
  const v = (m as Record<string, string>)[`${prefix}_${key}`]
  return typeof v === 'string' && v !== '' ? v : key
}

/** A country's name in the reader's language (ISO 3166-1 alpha-2), '' = unknown. */
export function countryLabel(code: string, locale: string | undefined, unknown: string): string {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return unknown
  try {
    return new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'region' }).of(c) ?? c
  } catch {
    return c
  }
}

export type ShareRow = SecurityCountRow & { share: number }

/**
 * Rows with each one's share of the total, largest first; equal counts keep the fixed `order` (known keys), then the
 * key. Rows with nothing in either period are dropped.
 */
export function shareRows(rows: SecurityCountRow[], order: readonly string[] = []): ShareRow[] {
  const total = rows.reduce((s, r) => s + (r.count > 0 ? r.count : 0), 0)
  const rank = (k: string) => {
    const i = order.indexOf(k)
    return i < 0 ? order.length : i
  }
  return rows
    .filter((r) => r.count > 0 || (r.previous ?? 0) > 0)
    .map((r) => ({ ...r, share: total > 0 ? Math.max(0, r.count) / total : 0 }))
    .sort((a, b) => b.count - a.count || rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))
}

/** Every date from `range.start` to `range.end` (ISO, UTC days). */
export function rangeDates(range: Pick<InsightsRange, 'start' | 'end'>): string[] {
  const start = Date.parse(`${range.start}T00:00:00Z`)
  const end = Date.parse(`${range.end}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
  const out: string[] = []
  for (let t = start; t <= end && out.length < 800; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

/** One row per date of the range: a missing day is an empty day (zero), never a gap. */
export function fillDays<T extends { date: string }>(range: Pick<InsightsRange, 'start' | 'end'>, days: T[], empty: (date: string) => T): T[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const dates = rangeDates(range)
  return dates.length ? dates.map((d) => byDate.get(d) ?? empty(d)) : [...days].sort((a, b) => a.date.localeCompare(b.date))
}

export const emptyRefusalDay = (date: string): SecurityRefusalDay => ({ date, total: 0, bySurface: {}, byReason: {} })
export const emptySpamDay = (date: string): SecuritySpamDay => ({ date, total: 0, byKind: {}, bySurface: {} })
export const emptyBanDay = (date: string): SecurityBanDay => ({ date, total: 0, byJail: {} })
export const emptySignInDay = (date: string): SecuritySignInDay => ({
  date, failedPasswords: 0, failedSecondSteps: 0, lockouts: 0, recoveryCodesUsed: 0, staffSignIns: 0, enrolments: 0,
})

/**
 * A daily chart's choice: `all`, or a breakdown key such as `bySurface:signin` / `byReason:country`. The value of a day
 * for that choice.
 */
export function dayValue(day: { total: number } & Record<string, unknown>, view: string): number {
  if (view === 'all') return day.total
  const i = view.indexOf(':')
  if (i < 0) {
    const v = day[view]
    return typeof v === 'number' ? v : 0
  }
  const group = day[view.slice(0, i)]
  const v = group && typeof group === 'object' ? (group as Record<string, unknown>)[view.slice(i + 1)] : undefined
  return typeof v === 'number' ? v : 0
}

/** The overview's three daily series (refusals, failed sign-ins = passwords + second steps, spam), every day filled. */
export function overviewDays(snapshot: SecuritySnapshot): Array<{ date: string; refusals: number; failedSignIns: number; spam: number }> {
  const r = new Map(snapshot.refusals.days.map((d) => [d.date, d.total]))
  const s = new Map(snapshot.spam.days.map((d) => [d.date, d.total]))
  const f = new Map(snapshot.signIn.days.map((d) => [d.date, d.failedPasswords + d.failedSecondSteps]))
  let dates = rangeDates(snapshot.range)
  if (!dates.length) dates = [...new Set([...r.keys(), ...s.keys(), ...f.keys()])].sort()
  return dates.map((date) => ({ date, refusals: r.get(date) ?? 0, failedSignIns: f.get(date) ?? 0, spam: s.get(date) ?? 0 }))
}

/**
 * Change against the previous period, without a verdict: more refusals are not good or bad by themselves, so the tile
 * shows the direction only (neutral colour). Null when there is nothing to compare with.
 */
export function neutralDelta(current: number, previous: number | undefined): { change: number; good: null } | null {
  if (previous === undefined || !Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) return null
  return { change: (current - previous) / previous, good: null }
}

export type SecurityKpi = { key: string; current: number; previous?: number }

/** The overview's headline numbers. */
export function securityKpis(snapshot: SecuritySnapshot): SecurityKpi[] {
  const t = snapshot.signIn.totals
  const p = snapshot.signIn.previousTotals
  const failedPrev = p.failedPasswords === undefined && p.failedSecondSteps === undefined ? undefined : (p.failedPasswords ?? 0) + (p.failedSecondSteps ?? 0)
  const out: SecurityKpi[] = [
    { key: 'refusals', current: snapshot.refusals.total, previous: snapshot.refusals.previousTotal },
    { key: 'failedSignIns', current: t.failedPasswords + t.failedSecondSteps, previous: failedPrev },
    { key: 'lockouts', current: t.lockouts, previous: p.lockouts },
    { key: 'spamCaught', current: snapshot.spam.total, previous: snapshot.spam.previousTotal },
    { key: 'staffSignIns', current: t.staffSignIns, previous: p.staffSignIns },
  ]
  if (snapshot.server.state === 'ok') out.splice(4, 0, { key: 'bans', current: snapshot.server.bans.total, previous: snapshot.server.bans.previousTotal })
  return out
}

/** Alerts open first (newest first), then resolved ones (newest first). */
export function sortAlerts<T extends { state: string; openedAt: string }>(alerts: T[]): T[] {
  return [...alerts].sort((a, b) => (a.state === b.state ? b.openedAt.localeCompare(a.openedAt) : a.state === 'open' ? -1 : 1))
}

/** The choices of a breakdown chart: All, then each key seen in the period (known keys in their fixed order). */
export function viewChoices(rows: SecurityCountRow[], group: string, order: readonly string[]): string[] {
  const keys = rows.filter((r) => r.count > 0).map((r) => r.key)
  const known = order.filter((k) => keys.includes(k))
  const other = keys.filter((k) => !order.includes(k)).sort()
  return ['all', ...[...known, ...other].map((k) => `${group}:${k}`)]
}
