/**
 * The words of the site search report, English by default. A host passes `messages` (any subset) to translate them.
 * `{start}`, `{end}`, `{days}`, `{date}` and `{rate}` are filled in (`fillInsights`).
 */
export const DEFAULT_SEARCH_REPORT_MESSAGES = {
  title: 'Site search',
  rangeLine: '{start} – {end} · compared with the previous {days} days',
  updated: 'Updated {date}',
  privacy: 'Searches are masked (e-mail addresses, phone and long numbers) and kept {days} days; only daily totals are kept longer. No IP address, cookie or account is stored.',
  chooseRange: 'Period',
  rangeDays: '{days} days',
  // KPIs
  searches: 'Searches',
  searchers: 'Searchers',
  searchersHint: 'search sessions, counted per day',
  noResults: 'No results',
  noResultsRate: 'Found nothing',
  clickThrough: 'Click-through',
  vsPrevious: 'vs previous period',
  noPrevious: 'no earlier data',
  lowerIsBetter: 'lower is better',
  // Chart
  perDay: 'Searches per day',
  seriesSearches: 'Searches',
  seriesNoResults: 'Found nothing',
  dailyNumbers: 'Daily numbers',
  date: 'Date',
  // Lists
  topQueries: 'Top searches',
  zeroQueries: 'Searches that found nothing',
  zeroHint: 'Each is a page to write, a word to add to an existing page, or a spelling to cover.',
  topClicked: 'Most opened results',
  languages: 'Search languages',
  query: 'Search',
  clicks: 'Clicks',
  ctr: 'CTR',
  language: 'Language',
  lastSeen: 'Last searched',
  result: 'Result',
  fromQueries: 'Searched as',
  nothingFound: 'nothing found',
  share: 'Share',
  languageZero: '{rate} found nothing',
  unknownLanguage: 'Unknown',
  searchPlaceholder: 'Search…',
  noData: 'Nothing in this period yet.',
  emptyTitle: 'No searches yet',
  emptyDescription: 'Searches appear here once visitors use the site search.',
  opensInNewTab: '(opens in a new tab)',
}

export type SearchReportMessages = typeof DEFAULT_SEARCH_REPORT_MESSAGES
