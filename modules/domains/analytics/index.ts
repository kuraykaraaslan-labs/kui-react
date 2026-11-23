// Barrel exports for the Analytics domain vertical (site insights: analytics, search engines, Core Web Vitals).
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
export { demoInsightsSnapshot, demoVitalsSource } from './insights/demo';
export {
  VITAL_METRICS, CORE_VITALS, VITAL_FORM_FACTORS, VITAL_ABBR, VITAL_THRESHOLDS,
  vitalRating, coreVitalsAssessment, hasVitals, vitalsFormFactors, activeVitals, vitalsFormat,
} from './insights/vitals';
export type { VitalsFormat } from './insights/vitals';
export { InsightsVitalTile, InsightsVitalRating, VitalRatingIcon, VitalsDistributionBar, VITAL_RATING_STYLE, VITAL_RATINGS } from './insights/InsightsVitalTile';
export type { VitalShares, VitalRatingLabels } from './insights/InsightsVitalTile';
export { InsightsVitalsTab, InsightsVitalsSummary } from './insights/InsightsVitalsTab';
// Security summary: what the site's protections refused, blocked and noticed (kui-shield on WordPress).
export * from './security/types';
export {
  securityStatus, securityStatusText, keyLabel, countryLabel, shareRows, rangeDates, fillDays, dayValue, overviewDays,
  neutralDelta, securityKpis, sortAlerts, viewChoices,
} from './security/summary';
export type { SecurityTone, SecurityStatus, ShareRow, SecurityKpi } from './security/summary';
export { DEFAULT_SECURITY_SUMMARY_MESSAGES } from './security/messages';
export type { SecuritySummaryMessages } from './security/messages';
export { SecurityStatusLine } from './security/SecurityStatusLine';
export { SecurityBreakdown } from './security/SecurityBreakdown';
export { SecuritySummaryView } from './security/SecuritySummaryView';
export { demoSecuritySnapshot } from './security/demo';
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
