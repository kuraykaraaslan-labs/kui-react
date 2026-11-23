import { z } from 'zod'

/* =========================================================
   SITE INSIGHTS — one snapshot of a site's analytics and search data
   (Google Analytics 4, Google Search Console, Bing Webmaster, Yandex Webmaster) and its real-user
   Core Web Vitals (Chrome UX Report).
   The host fetches and caches it; the view only reads it. The WordPress port
   (kui-wordpress-saas plugin/kui-insights) produces exactly this shape.
========================================================= */

export const InsightsSourceIdEnum = z.enum(['ga4', 'gsc', 'bing', 'yandex', 'crux'])
export const InsightsSourceKindEnum = z.enum(['analytics', 'search', 'vitals'])
/** `off`: not configured. `error`: the last fetch failed (its last good data, if any, is kept). */
export const InsightsSourceStateEnum = z.enum(['ok', 'off', 'error'])

export const InsightsRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
  days: z.number().int().nonnegative(),
})

/** Search metrics: `ctr` is a fraction (0.034), `position` the average rank (1 = top, 0 = unknown). */
export const SearchMetricsSchema = z.object({
  clicks: z.number().nonnegative().default(0),
  impressions: z.number().nonnegative().default(0),
  ctr: z.number().nonnegative().default(0),
  position: z.number().nonnegative().default(0),
})

/** Analytics metrics: `engagementRate` is a fraction. */
export const AnalyticsMetricsSchema = z.object({
  users: z.number().nonnegative().default(0),
  sessions: z.number().nonnegative().default(0),
  views: z.number().nonnegative().default(0),
  engagementRate: z.number().nonnegative().default(0),
})

export const SearchDaySchema = SearchMetricsSchema.extend({ date: z.string() })
export const AnalyticsDaySchema = AnalyticsMetricsSchema.omit({ engagementRate: true }).extend({ date: z.string() })

/** A query (search) or a page path (search and analytics). */
export const SearchRowSchema = SearchMetricsSchema.extend({ key: z.string() })
export const AnalyticsPageRowSchema = z.object({ key: z.string(), views: z.number().nonnegative().default(0), users: z.number().nonnegative().default(0) })
export const ChannelRowSchema = z.object({ key: z.string(), sessions: z.number().nonnegative().default(0) })

const SourceBaseSchema = z.object({
  id: InsightsSourceIdEnum,
  label: z.string(),
  state: InsightsSourceStateEnum,
  message: z.string().default(''),
  fetchedAt: z.string().nullable().default(null),
  range: InsightsRangeSchema.optional(),
})

export const AnalyticsSourceSchema = SourceBaseSchema.extend({
  kind: z.literal('analytics'),
  totals: AnalyticsMetricsSchema.partial().default({}),
  previousTotals: AnalyticsMetricsSchema.partial().default({}),
  days: z.array(AnalyticsDaySchema).default([]),
  topPages: z.array(AnalyticsPageRowSchema).default([]),
  channels: z.array(ChannelRowSchema).default([]),
})

export const SearchSourceSchema = SourceBaseSchema.extend({
  kind: z.literal('search'),
  totals: SearchMetricsSchema.partial().default({}),
  previousTotals: SearchMetricsSchema.partial().default({}),
  days: z.array(SearchDaySchema).default([]),
  topQueries: z.array(SearchRowSchema).default([]),
  topPages: z.array(SearchRowSchema).default([]),
})

/* ---------------------------------------------------------
   CORE WEB VITALS (Chrome UX Report): real Chrome users over a 28-day collection period
--------------------------------------------------------- */

/** Largest Contentful Paint, Interaction to Next Paint, Cumulative Layout Shift, First Contentful Paint, Time to First Byte. */
export const VitalMetricEnum = z.enum(['lcp', 'inp', 'cls', 'fcp', 'ttfb'])
/** CrUX's device split; `all` when the data has no split (too few visits per device). */
export const VitalFormFactorEnum = z.enum(['phone', 'desktop', 'all'])
export const VitalRatingEnum = z.enum(['good', 'needs-improvement', 'poor'])

const share = z.number().min(0).max(1).default(0)

/**
 * One metric: its 75th percentile (milliseconds; CLS unitless) and the share of page loads rated good, needs
 * improvement and poor (fractions adding up to 1). A metric CrUX has no data for is left out.
 */
export const VitalValueSchema = z.object({
  p75: z.number().nonnegative(),
  good: share,
  needsImprovement: share,
  poor: share,
})

export const VitalsMetricsSchema = z.object({
  lcp: VitalValueSchema.optional(),
  inp: VitalValueSchema.optional(),
  cls: VitalValueSchema.optional(),
  fcp: VitalValueSchema.optional(),
  ttfb: VitalValueSchema.optional(),
})

/** A value per form factor; a form factor without data is left out. */
const byFormFactor = <T extends z.ZodTypeAny>(item: T) => z.object({ phone: item.optional(), desktop: item.optional(), all: item.optional() })

export const VitalsByFormFactorSchema = byFormFactor(VitalsMetricsSchema)

/** A page of the site: `url` absolute (what CrUX was asked), `key` its path. No form factor = not enough data. */
export const VitalsUrlSchema = z.object({
  url: z.string(),
  key: z.string(),
  vitals: VitalsByFormFactorSchema.default({}),
})

const p75 = z.number().nonnegative().nullable().optional()

/** One collection period of the history (28 days ending `end`, a week apart): the origin's p75s, null without data. */
export const VitalsHistoryRowSchema = z.object({
  start: z.string(),
  end: z.string(),
  lcp: p75,
  inp: p75,
  cls: p75,
  fcp: p75,
  ttfb: p75,
})

export const VitalsHistorySchema = byFormFactor(z.array(VitalsHistoryRowSchema))

/**
 * Core Web Vitals of the site's origin and of its top pages, per form factor, with up to 25 weekly collection
 * periods of the origin's p75s (oldest first). `range` is the latest collection period.
 */
export const VitalsSourceSchema = SourceBaseSchema.extend({
  kind: z.literal('vitals'),
  origin: z.string().default(''),
  originVitals: VitalsByFormFactorSchema.default({}),
  urls: z.array(VitalsUrlSchema).default([]),
  history: VitalsHistorySchema.default({}),
})

export const InsightsSourceSchema = z.discriminatedUnion('kind', [AnalyticsSourceSchema, SearchSourceSchema, VitalsSourceSchema])

export const InsightsSnapshotSchema = z.object({
  generatedAt: z.string().nullable().default(null),
  range: InsightsRangeSchema,
  previousRange: InsightsRangeSchema.optional(),
  sources: z.array(InsightsSourceSchema),
})

/* =========================================================
   TYPES
========================================================= */

export type InsightsSourceId = z.infer<typeof InsightsSourceIdEnum>
export type InsightsSourceState = z.infer<typeof InsightsSourceStateEnum>
export type InsightsRange = z.infer<typeof InsightsRangeSchema>
export type SearchMetrics = z.infer<typeof SearchMetricsSchema>
export type AnalyticsMetrics = z.infer<typeof AnalyticsMetricsSchema>
export type SearchDay = z.infer<typeof SearchDaySchema>
export type AnalyticsDay = z.infer<typeof AnalyticsDaySchema>
export type SearchRow = z.infer<typeof SearchRowSchema>
export type AnalyticsPageRow = z.infer<typeof AnalyticsPageRowSchema>
export type ChannelRow = z.infer<typeof ChannelRowSchema>
export type AnalyticsSource = z.infer<typeof AnalyticsSourceSchema>
export type SearchSource = z.infer<typeof SearchSourceSchema>
export type VitalsSource = z.infer<typeof VitalsSourceSchema>
export type VitalMetric = z.infer<typeof VitalMetricEnum>
export type VitalFormFactor = z.infer<typeof VitalFormFactorEnum>
export type VitalRating = z.infer<typeof VitalRatingEnum>
export type VitalValue = z.infer<typeof VitalValueSchema>
export type VitalsMetrics = z.infer<typeof VitalsMetricsSchema>
export type VitalsByFormFactor = z.infer<typeof VitalsByFormFactorSchema>
export type VitalsUrl = z.infer<typeof VitalsUrlSchema>
export type VitalsHistoryRow = z.infer<typeof VitalsHistoryRowSchema>
export type InsightsSource = z.infer<typeof InsightsSourceSchema>
export type InsightsSnapshot = z.infer<typeof InsightsSnapshotSchema>

/** The search engines, in their fixed chart order (colour slot follows the engine, never its rank). */
export const SEARCH_ENGINES = ['gsc', 'bing', 'yandex'] as const
export type SearchEngineId = (typeof SEARCH_ENGINES)[number]
