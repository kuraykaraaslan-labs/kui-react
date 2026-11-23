// Barrel exports for the Analytics domain vertical (site insights: analytics + search engines).
export * from './types';
export { combineInsights, insightsDelta, activeEngines, activeAnalytics, INSIGHTS_TOP_LIMIT } from './insights/combineInsights';
export type { CombinedInsights, CombinedDay, CombinedPage, CombinedQuery, EngineShare } from './insights/combineInsights';
export { ENGINE_COLOR, SINGLE_SERIES_COLOR, insightsFormat } from './insights/format';
export type { InsightsFormat } from './insights/format';
export { DEFAULT_SITE_INSIGHTS_MESSAGES, fillInsights } from './insights/messages';
export type { SiteInsightsMessages } from './insights/messages';
export { InsightsKpiTile } from './insights/InsightsKpiTile';
export { InsightsSourceBadge } from './insights/InsightsSourceBadge';
export { InsightsTopTable } from './insights/InsightsTopTable';
export type { InsightsTopRow } from './insights/InsightsTopTable';
export { SiteInsightsView } from './insights/SiteInsightsView';
export { demoInsightsSnapshot } from './insights/demo';
// Site search report (what visitors search for on the site itself).
export {
  combineSearchReport, mergeSearchQueries, cleanSearchQuery, maskSearchQuery, searchReportRates, searchLanguageName,
  SEARCH_REPORT_LIMIT, SEARCH_QUERY_MAX,
} from './search/searchReport';
export type { CombinedSearchReport, SearchRates, SearchLanguageShare } from './search/searchReport';
export { DEFAULT_SEARCH_REPORT_MESSAGES } from './search/messages';
export type { SearchReportMessages } from './search/messages';
export { SearchQueryTable } from './search/SearchQueryTable';
export { SearchReportView, SEARCH_SERIES_COLOR } from './search/SearchReportView';
export { demoSearchReport } from './search/demo';
