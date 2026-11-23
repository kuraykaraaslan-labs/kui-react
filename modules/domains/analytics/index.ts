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
