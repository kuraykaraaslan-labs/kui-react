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

/* =========================================================
   SITE SEARCH REPORT — what visitors search for on the site itself (the header's search window and the full results
   page), which searches find nothing and which results they open. The host aggregates its own log and passes one
   report; the view only reads it. The WordPress port (kui-wordpress-saas plugin/kui-search) produces exactly this
   shape. Queries arrive normalised (trimmed, single spaces, lower case) and masked (e-mail addresses, phone, card,
   account and long reference numbers replaced by a [label]); no field names a visitor.
========================================================= */

/** Headline counts. `searchers`: distinct search sessions per day, added up over the range (a session id lives one day, so the same visitor on two days counts twice). `clickThrough`: the fraction of searches that ended in a click on a result. */
export const SiteSearchTotalsSchema = z.object({
  searches: z.number().int().nonnegative().default(0),
  searchers: z.number().int().nonnegative().default(0),
  zeroResult: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  clickThrough: z.number().nonnegative().default(0),
})

export const SiteSearchDaySchema = z.object({
  date: z.string(),
  searches: z.number().int().nonnegative().default(0),
  searchers: z.number().int().nonnegative().default(0),
  zeroResult: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
})

/** One normalised query. `language`: the language it was searched in most (two-letter code, '' = unknown); `lastSeen`: ISO date-time of its latest search; `ctr` = clicks / searches. */
export const SiteSearchQueryRowSchema = z.object({
  key: z.string(),
  searches: z.number().int().nonnegative().default(0),
  zeroResults: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  ctr: z.number().nonnegative().default(0),
  lastSeen: z.string().nullable().default(null),
  language: z.string().default(''),
})

/** A result visitors opened from the search: its address (a path on the site), its title when known, and the queries that led there (most first). */
export const SiteSearchClickedRowSchema = z.object({
  url: z.string(),
  title: z.string().default(''),
  clicks: z.number().int().nonnegative().default(0),
  fromQueries: z.array(z.string()).default([]),
})

export const SiteSearchLanguageRowSchema = z.object({
  key: z.string(),
  searches: z.number().int().nonnegative().default(0),
  zeroResults: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
})

export const SiteSearchReportSchema = z.object({
  generatedAt: z.string().nullable().default(null),
  range: InsightsRangeSchema,
  previousRange: InsightsRangeSchema.optional(),
  /** Days the query rows are kept (the lists cannot reach further back). */
  retentionDays: z.number().int().nonnegative().default(90),
  totals: SiteSearchTotalsSchema,
  /** Empty when there was nothing to compare with. */
  previousTotals: SiteSearchTotalsSchema.partial().default({}),
  /** Every day of the range, ascending; a day without searches is a zero. */
  days: z.array(SiteSearchDaySchema).default([]),
  topQueries: z.array(SiteSearchQueryRowSchema).default([]),
  /** Queries whose every search in the range found nothing. */
  zeroResultQueries: z.array(SiteSearchQueryRowSchema).default([]),
  topClicked: z.array(SiteSearchClickedRowSchema).default([]),
  languages: z.array(SiteSearchLanguageRowSchema).default([]),
})

export type SiteSearchTotals = z.infer<typeof SiteSearchTotalsSchema>
export type SiteSearchDay = z.infer<typeof SiteSearchDaySchema>
export type SiteSearchQueryRow = z.infer<typeof SiteSearchQueryRowSchema>
export type SiteSearchClickedRow = z.infer<typeof SiteSearchClickedRowSchema>
export type SiteSearchLanguageRow = z.infer<typeof SiteSearchLanguageRowSchema>
export type SiteSearchReport = z.infer<typeof SiteSearchReportSchema>
