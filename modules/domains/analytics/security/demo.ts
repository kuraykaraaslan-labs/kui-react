import type { SecurityAlert, SecurityCountRow, SecuritySnapshot } from './types'

type DemoOptions = {
  /** `off`: the server bridge has never reported. Default `ok`. */
  server?: 'ok' | 'off'
  /** Which alerts are open at the end of the range. Default `none` (every alert resolved). */
  open?: 'none' | 'health' | 'integrity'
  /** A calm site: a few refusals and no spam (empty states). */
  quiet?: boolean
  /** Days shown. Default 30. */
  days?: number
}

/** A small seeded generator, so the demo is the same on every render and in tests. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
const add = (to: Record<string, number>, k: string, n: number) => {
  if (n > 0) to[k] = (to[k] ?? 0) + n
}
const rows = (totals: Record<string, number>, grow: number): SecurityCountRow[] =>
  Object.entries(totals).map(([key, count]) => ({ key, count, previous: Math.round(count / grow) }))

/**
 * A deterministic demo snapshot (showcase and tests): 30 days ending 2026-11-22. Sign-in and sign-up draw most
 * refusals, contact and newsletter forms most spam, sshd most bans; a burst of refusals mid-range. IP addresses are
 * documentation ranges (RFC 5737, RFC 3849).
 */
export function demoSecuritySnapshot(opts: DemoOptions = {}): SecuritySnapshot {
  const days = opts.days ?? 30
  const quiet = opts.quiet ?? false
  const end = Date.UTC(2026, 10, 22)
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
  const dates = Array.from({ length: days }, (_, i) => iso(end - (days - 1 - i) * 86400000))
  const rnd = seeded(20261122)
  const pick = (base: number) => Math.max(0, Math.round(base * (0.55 + rnd() * 0.9)))

  const surfaceWeights: Record<string, number> = quiet
    ? { signin: 1.2, register: 0.4, contact: 0.2 }
    : { signin: 9, register: 4.5, contact: 2.2, forum: 1.6, api: 1.3, comment: 0.8, chat: 0.6, newsletter: 0.5, quote: 0.2 }
  const reasonWeights: Record<string, number> = { country: 0.55, 'address-limit': 0.3, 'country-cap': 0.12, 'staff-country': 0.03 }
  const countries: Array<[string, number]> = [['CN', 0.24], ['RU', 0.19], ['US', 0.12], ['VN', 0.09], ['BR', 0.08], ['IN', 0.07], ['', 0.06], ['NL', 0.05], ['DE', 0.04]]

  const surfaceTotals: Record<string, number> = {}
  const reasonTotals: Record<string, number> = {}
  const refusalDays = dates.map((date, i) => {
    const burst = !quiet && i >= days - 13 && i <= days - 11 ? 3.2 : 1
    const bySurface: Record<string, number> = {}
    const byReason: Record<string, number> = {}
    for (const [s, w] of Object.entries(surfaceWeights)) {
      const n = pick(w * burst)
      if (!n) continue
      add(bySurface, s, n)
      add(surfaceTotals, s, n)
      // Staff-country refusals only happen at sign-in.
      let left = n
      for (const [r, rw] of Object.entries(reasonWeights)) {
        if (r === 'staff-country' && s !== 'signin') continue
        const k = r === 'country' ? 0 : Math.min(left, Math.round(n * rw + rnd() * 0.6))
        add(byReason, r, k)
        add(reasonTotals, r, k)
        left -= k
      }
      add(byReason, 'country', left)
      add(reasonTotals, 'country', left)
    }
    return { date, total: sum(bySurface), bySurface, byReason }
  })
  const refusalTotal = refusalDays.reduce((s, d) => s + d.total, 0)
  let countryLeft = refusalTotal
  const topCountries: SecurityCountRow[] = countries.map(([key, w], i) => {
    const count = i === countries.length - 1 ? Math.max(0, Math.round(countryLeft * 0.4)) : Math.round(refusalTotal * w)
    countryLeft -= count
    return { key, count, previous: Math.round(count / 1.25) }
  }).filter((r) => r.count > 0)

  const signInDays = dates.map((date) => {
    const failedPasswords = pick(quiet ? 1 : 5)
    const failedSecondSteps = pick(quiet ? 0.2 : 0.9)
    return {
      date,
      failedPasswords,
      failedSecondSteps,
      lockouts: failedSecondSteps >= 1 && rnd() > 0.86 ? 1 : 0,
      recoveryCodesUsed: rnd() > 0.94 ? 1 : 0,
      staffSignIns: pick(2.4),
      enrolments: rnd() > 0.93 ? 1 : 0,
    }
  })
  const signInTotals = signInDays.reduce(
    (t, d) => ({
      failedPasswords: t.failedPasswords + d.failedPasswords,
      failedSecondSteps: t.failedSecondSteps + d.failedSecondSteps,
      lockouts: t.lockouts + d.lockouts,
      recoveryCodesUsed: t.recoveryCodesUsed + d.recoveryCodesUsed,
      staffSignIns: t.staffSignIns + d.staffSignIns,
      enrolments: t.enrolments + d.enrolments,
    }),
    { failedPasswords: 0, failedSecondSteps: 0, lockouts: 0, recoveryCodesUsed: 0, staffSignIns: 0, enrolments: 0 },
  )

  const spamKinds: Record<string, number> = quiet ? {} : { honeypot: 3.1, 'too-fast': 1.8, 'bot-trap': 1.2, 'disposable-email': 0.4, 'rate-limit': 0.3 }
  const spamSurface: Record<string, string> = { honeypot: 'contact', 'too-fast': 'newsletter', 'bot-trap': 'forum', 'disposable-email': 'register', 'rate-limit': 'contact' }
  const kindTotals: Record<string, number> = {}
  const spamSurfaceTotals: Record<string, number> = {}
  const spamDays = dates.map((date, i) => {
    const byKind: Record<string, number> = {}
    const bySurface: Record<string, number> = {}
    for (const [k, w] of Object.entries(spamKinds)) {
      const n = pick(w)
      add(byKind, k, n)
      add(kindTotals, k, n)
      // Honeypot spam lands on contact and newsletter in turn.
      const s = k === 'honeypot' && i % 3 === 0 ? 'newsletter' : spamSurface[k]
      add(bySurface, s, n)
      add(spamSurfaceTotals, s, n)
    }
    return { date, total: sum(byKind), byKind, bySurface }
  })
  const spamTotal = spamDays.reduce((s, d) => s + d.total, 0)

  const jails: Record<string, number> = { sshd: 6.5, 'kui-shield': 2.1, 'nginx-limit-req': 0.8, recidive: 0.25 }
  const jailTotals: Record<string, number> = {}
  const banDays = dates.map((date) => {
    const byJail: Record<string, number> = {}
    for (const [j, w] of Object.entries(jails)) {
      const n = pick(w)
      add(byJail, j, n)
      add(jailTotals, j, n)
    }
    return { date, total: sum(byJail), byJail }
  })
  const banTotal = banDays.reduce((s, d) => s + d.total, 0)

  const at = (dayIndex: number, hm: string) => `${dates[Math.max(0, Math.min(days - 1, dayIndex))]}T${hm}:00Z`
  const alerts: SecurityAlert[] = [
    { kind: 'health', key: 'backup', title: 'Database backup', state: 'resolved', openedAt: at(days - 24, '03:05'), resolvedAt: at(days - 24, '09:10') },
    { kind: 'integrity', key: 'integrity', title: 'File integrity: unexpected changes', state: 'resolved', openedAt: at(days - 9, '14:15'), resolvedAt: at(days - 9, '14:47') },
    { kind: 'health', key: 'svc-php8.5-fpm', title: 'Service php8.5-fpm', state: 'resolved', openedAt: at(days - 5, '02:10'), resolvedAt: at(days - 5, '02:15') },
  ]
  if (opts.open === 'health') alerts.push({ kind: 'health', key: 'disk', title: 'Disk space', state: 'open', openedAt: at(days - 1, '22:40'), resolvedAt: null })
  if (opts.open === 'integrity') alerts.push({ kind: 'integrity', key: 'integrity', title: 'File integrity: unexpected changes', state: 'open', openedAt: at(days - 1, '23:30'), resolvedAt: null })

  const ips = ['203.0.113.24', '198.51.100.7', '2001:db8::5f', '203.0.113.181', '192.0.2.44', '198.51.100.230']
  const recentPlan: Array<[string, string, string]> = quiet
    ? [['signin', 'address limit', 'US'], ['register', 'country', 'RU']]
    : [
        ['signin', 'address limit', 'CN'], ['signin', 'country', 'RU'], ['register', 'country', 'VN'], ['contact', 'country cap', 'BR'],
        ['api', 'address limit', 'US'], ['signin', 'staff country', 'NL'], ['forum', 'country', 'IN'], ['newsletter', 'address limit', ''],
        ['signin', 'country', 'CN'], ['chat', 'address limit', 'DE'], ['comment', 'country', 'RU'], ['register', 'address limit', 'CN'],
      ]
  const lastMs = end + 21 * 3600000
  const recent = recentPlan.map(([surface, reason, country], i) => ({
    at: new Date(lastMs - i * 47 * 60000 - i * i * 9 * 60000).toISOString(),
    surface,
    reason: reason.replace(/ /g, '-'),
    country,
    ip: ips[i % ips.length],
  }))

  const server = opts.server ?? 'ok'
  return {
    generatedAt: '2026-11-22T21:30:00Z',
    range: { start: dates[0], end: dates[days - 1], days },
    previousRange: { start: iso(end - (2 * days - 1) * 86400000), end: iso(end - days * 86400000), days },
    retentionMonths: 13,
    refusals: {
      total: refusalTotal,
      previousTotal: Math.round(refusalTotal / 1.21),
      days: refusalDays,
      bySurface: rows(surfaceTotals, 1.21),
      byReason: rows(reasonTotals, 1.18),
      topCountries,
    },
    signIn: {
      totals: signInTotals,
      previousTotals: {
        failedPasswords: Math.round(signInTotals.failedPasswords * 1.1),
        failedSecondSteps: Math.round(signInTotals.failedSecondSteps * 0.8),
        lockouts: 1,
        recoveryCodesUsed: 0,
        staffSignIns: Math.round(signInTotals.staffSignIns * 0.95),
        enrolments: 1,
      },
      days: signInDays,
    },
    spam: {
      total: spamTotal,
      previousTotal: quiet ? 0 : Math.round(spamTotal / 0.9),
      days: spamDays,
      byKind: rows(kindTotals, 0.9),
      bySurface: rows(spamSurfaceTotals, 0.9),
    },
    server:
      server === 'off'
        ? { state: 'off', lastReportAt: null, bans: { total: 0, days: [], byJail: [] }, alerts: [] }
        : {
            state: 'ok',
            lastReportAt: '2026-11-22T21:15:00Z',
            bans: { total: banTotal, previousTotal: Math.round(banTotal / 1.05), days: banDays, byJail: rows(jailTotals, 1.05) },
            alerts,
          },
    recent: { keep: 100, items: recent },
  }
}
