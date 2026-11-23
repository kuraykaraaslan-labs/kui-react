/**
 * The words of the site insights view, English by default. A host passes `messages` (any subset) to translate them.
 * `{count}`, `{date}`, `{start}`, `{end}` and `{days}` are filled in.
 */
export const DEFAULT_SITE_INSIGHTS_MESSAGES = {
  title: 'Site insights',
  rangeLine: '{start} – {end} · compared with the previous {days} days',
  updated: 'Updated {date}',
  neverUpdated: 'Not fetched yet',
  refresh: 'Refresh now',
  refreshing: 'Refreshing…',
  tabOverview: 'Overview',
  stateOk: 'Connected',
  stateOff: 'Not connected',
  stateError: 'Last fetch failed',
  offTitle: 'Not connected',
  offDescription: 'Add this source in the settings to see its data here.',
  errorKept: 'Showing the last data that arrived ({date}).',
  noSearch: 'No search engine is connected yet.',
  noData: 'No data for this period yet.',
  // Metrics
  clicks: 'Clicks',
  impressions: 'Impressions',
  ctr: 'CTR',
  position: 'Avg. position',
  users: 'Visitors',
  sessions: 'Sessions',
  views: 'Page views',
  engagementRate: 'Engagement rate',
  searchClicks: 'Search clicks',
  searchImpressions: 'Search impressions',
  // Sections
  clicksByEngine: 'Search clicks by engine',
  viewsOverTime: 'Page views',
  metricOverTime: '{metric} per day',
  engineShare: 'Share of search clicks',
  engine: 'Engine',
  share: 'Share',
  topQueries: 'Top queries',
  topPages: 'Top pages',
  channels: 'Traffic channels',
  query: 'Query',
  page: 'Page',
  channel: 'Channel',
  vsPrevious: 'vs previous period',
  noPrevious: 'no earlier data',
  lowerIsBetter: 'lower is better',
  chooseMetric: 'Metric shown',
  searchPlaceholder: 'Search…',
}

export type SiteInsightsMessages = typeof DEFAULT_SITE_INSIGHTS_MESSAGES

/** `{name}` placeholders filled from `vars`. */
export function fillInsights(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
