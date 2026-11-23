import { z } from 'zod'

/* =========================================================
   SITE INSIGHTS — one snapshot of a site's analytics and search data
   (Google Analytics 4, Google Search Console, Bing Webmaster, Yandex Webmaster).
   The host fetches and caches it; the view only reads it. The WordPress port
   (kui-wordpress-saas plugin/kui-insights) produces exactly this shape.
========================================================= */

export const InsightsSourceIdEnum = z.enum(['ga4', 'gsc', 'bing', 'yandex'])
export const InsightsSourceKindEnum = z.enum(['analytics', 'search'])
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

export const InsightsSourceSchema = z.discriminatedUnion('kind', [AnalyticsSourceSchema, SearchSourceSchema])

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
export type InsightsSource = z.infer<typeof InsightsSourceSchema>
export type InsightsSnapshot = z.infer<typeof InsightsSnapshotSchema>

/** The search engines, in their fixed chart order (colour slot follows the engine, never its rank). */
export const SEARCH_ENGINES = ['gsc', 'bing', 'yandex'] as const
export type SearchEngineId = (typeof SEARCH_ENGINES)[number]
