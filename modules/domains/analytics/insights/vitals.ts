import type { InsightsSnapshot, VitalFormFactor, VitalMetric, VitalRating, VitalsMetrics, VitalsSource } from '../types'

/**
 * Core Web Vitals rules, pure. The WordPress port (kui-wordpress-saas plugin/kui-insights, `CruxReport` and
 * assets/insights.js) uses the same thresholds and formats.
 */

/** The metrics in their display order: the three Core Web Vitals first. */
export const VITAL_METRICS: readonly VitalMetric[] = ['lcp', 'inp', 'cls', 'fcp', 'ttfb']

/** The three metrics of Google's Core Web Vitals assessment. */
export const CORE_VITALS: readonly VitalMetric[] = ['lcp', 'inp', 'cls']

/** The form factors in their display order. */
export const VITAL_FORM_FACTORS: readonly VitalFormFactor[] = ['phone', 'desktop', 'all']

/** The metric abbreviations (the same in every language). */
export const VITAL_ABBR: Record<VitalMetric, string> = { lcp: 'LCP', inp: 'INP', cls: 'CLS', fcp: 'FCP', ttfb: 'TTFB' }

/**
 * Good up to the first value, poor above the second (web.dev): milliseconds, CLS unitless. A p75 equal to a
 * threshold is on the better side.
 */
export const VITAL_THRESHOLDS: Record<VitalMetric, readonly [good: number, poor: number]> = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
}

/** The rating of a p75, or null when there is none. */
export function vitalRating(metric: VitalMetric, p75: number | null | undefined): VitalRating | null {
  if (typeof p75 !== 'number' || !Number.isFinite(p75) || p75 < 0) return null
  const [good, poor] = VITAL_THRESHOLDS[metric]
  if (p75 <= good) return 'good'
  return p75 > poor ? 'poor' : 'needs-improvement'
}

/**
 * Google's Core Web Vitals assessment of one form factor: passed when LCP, INP and CLS are all good at the 75th
 * percentile. Without INP data it is decided by LCP and CLS; without LCP or CLS there is no assessment (null).
 */
export function coreVitalsAssessment(metrics: VitalsMetrics | undefined): 'passed' | 'failed' | null {
  if (!metrics?.lcp || !metrics.cls) return null
  const ratings = CORE_VITALS.filter((k) => metrics[k]).map((k) => vitalRating(k, metrics[k]?.p75))
  return ratings.every((r) => r === 'good') ? 'passed' : 'failed'
}

/** Whether a metrics map holds any metric. */
export const hasVitals = (m: VitalsMetrics | undefined): boolean => !!m && VITAL_METRICS.some((k) => m[k])

/** The form factors with any data (origin, a page or history), in display order. */
export function vitalsFormFactors(source: VitalsSource): VitalFormFactor[] {
  return VITAL_FORM_FACTORS.filter(
    (ff) => hasVitals(source.originVitals?.[ff]) || (source.history?.[ff]?.length ?? 0) > 0 || (source.urls ?? []).some((u) => hasVitals(u.vitals?.[ff])),
  )
}

/** The Core Web Vitals source when it is not off and has data. */
export function activeVitals(snapshot: InsightsSnapshot): VitalsSource | null {
  const s = snapshot.sources.find((x): x is VitalsSource => x.kind === 'vitals')
  return s && s.state !== 'off' && vitalsFormFactors(s).length > 0 ? s : null
}

export type VitalsFormat = {
  /** A metric's value: "180 ms", "2.5 s" (from 1000 ms, one decimal), CLS "0.05". */
  value: (metric: VitalMetric, v: number) => string
  /** A share of page loads, whole percent ("78%"). */
  share: (fraction: number) => string
}

/** Locale-aware Web Vitals formats (Intl only). Units are the SI symbols, the same in every language. */
export function vitalsFormat(locale?: string): VitalsFormat {
  const ms = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const cls = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })
  return {
    value: (metric, v) => {
      if (!Number.isFinite(v)) return '–'
      if (metric === 'cls') return cls.format(v)
      return Math.round(v) >= 1000 ? `${s.format(v / 1000)} s` : `${ms.format(v)} ms`
    },
    share: (f) => pct.format(Number.isFinite(f) ? f : 0),
  }
}
