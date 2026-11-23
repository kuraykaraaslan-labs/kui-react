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
