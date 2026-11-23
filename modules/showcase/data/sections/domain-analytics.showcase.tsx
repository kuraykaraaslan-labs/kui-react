'use client';
import type { ShowcaseComponent } from '../showcase.types';
import { SiteInsightsView } from '@/modules/domains/analytics/insights/SiteInsightsView';
import { InsightsKpiTile } from '@/modules/domains/analytics/insights/InsightsKpiTile';
import { InsightsSourceBadge } from '@/modules/domains/analytics/insights/InsightsSourceBadge';
import { demoInsightsSnapshot } from '@/modules/domains/analytics/insights/demo';
import { useState } from 'react';
import { SearchReportView } from '@/modules/domains/analytics/search/SearchReportView';
import { SearchQueryTable } from '@/modules/domains/analytics/search/SearchQueryTable';
import { demoSearchReport } from '@/modules/domains/analytics/search/demo';

/** The report with a working period picker (the host aggregates again; here the demo is rebuilt). */
function SearchReportDemo() {
  const [days, setDays] = useState(28);
  return <SearchReportView report={demoSearchReport({ days })} locale="en-US" siteUrl="https://example.com" onRangeChange={setDays} />;
}

export function buildAnalyticsDomainData(): ShowcaseComponent[] {
  return [
    {
      id: 'analytics-site-insights-view',
      title: 'SiteInsightsView',
      category: 'Domain',
      abbr: 'IV',
      description:
        'A site\'s analytics and search data in one place: an Overview combining every connected search engine (Google, Bing, Yandex) beside Google Analytics, and a tab per source. KPIs against the previous period, one measure per chart axis, every number also in a table; sources that are not connected or failing say so.',
      filePath: 'modules/domains/analytics/insights/SiteInsightsView.tsx',
      sourceCode: `import { SiteInsightsView } from '@/modules/domains/analytics';
<SiteInsightsView snapshot={snapshot} locale="en-US" siteUrl="https://example.com" onRefresh={refresh} />`,
      variants: [
        {
          title: 'Overview (Google Analytics, Google Search and Bing connected; Yandex not)',
          layout: 'stack',
          preview: <SiteInsightsView snapshot={demoInsightsSnapshot()} locale="en-US" siteUrl="https://example.com" onRefresh={() => {}} />,
          code: `<SiteInsightsView snapshot={snapshot} locale="en-US" siteUrl="https://example.com" onRefresh={refresh} />`,
        },
        {
          title: 'One engine failing (its last data kept), all four connected',
          layout: 'stack',
          preview: <SiteInsightsView snapshot={demoInsightsSnapshot({ yandex: 'ok', bing: 'error' })} locale="en-US" defaultTab="bing" />,
          code: `<SiteInsightsView snapshot={snapshot} defaultTab="bing" />`,
        },
      ],
    },
    {
      id: 'analytics-kpi-tile',
      title: 'InsightsKpiTile',
      category: 'Domain',
      abbr: 'IK',
      description: 'A headline number with its change against the previous period: arrow for direction, colour for good or bad (flipped for lower-is-better metrics such as average position).',
      filePath: 'modules/domains/analytics/insights/InsightsKpiTile.tsx',
      sourceCode: `<InsightsKpiTile label="Clicks" value="1,912" delta={{ change: 0.18, good: true }} deltaText="+18%" caption="vs previous period" />`,
      variants: [
        {
          title: 'Up, down, lower is better, nothing to compare',
          layout: 'stack',
          preview: (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <InsightsKpiTile label="Clicks" value="1,912" delta={{ change: 0.18, good: true }} deltaText="+18%" caption="vs previous period" />
              <InsightsKpiTile label="CTR" value="3.9%" delta={{ change: -0.04, good: false }} deltaText="-4%" caption="vs previous period" />
              <InsightsKpiTile label="Avg. position" value="12.4" delta={{ change: -0.06, good: true }} deltaText="-6%" caption="vs previous period" hint="lower is better" />
              <InsightsKpiTile label="Visitors" value="3,048" caption="no earlier data" />
            </div>
          ),
          code: `<InsightsKpiTile label="Avg. position" value="12.4" delta={{ change: -0.06, good: true }} deltaText="-6%" caption="vs previous period" hint="lower is better" />`,
        },
        {
          title: 'Unchanged',
          layout: 'stack',
          preview: (
            <div className="grid max-w-xs">
              <InsightsKpiTile label="Sessions" value="5,120" delta={{ change: 0, good: null }} deltaText="0%" caption="vs previous period" />
            </div>
          ),
          code: `<InsightsKpiTile label="Sessions" value="5,120" delta={{ change: 0, good: null }} deltaText="0%" caption="vs previous period" />`,
        },
      ],
    },
    {
      id: 'analytics-source-badge',
      title: 'InsightsSourceBadge',
      category: 'Domain',
      abbr: 'IB',
      description: 'A data source and its state (connected, not connected, last fetch failed) with an icon and words, never colour alone.',
      filePath: 'modules/domains/analytics/insights/InsightsSourceBadge.tsx',
      sourceCode: `<InsightsSourceBadge label="Bing" state="error" stateLabel="Last fetch failed" detail="The API answered 401" />`,
      variants: [
        {
          title: 'States',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              <InsightsSourceBadge label="Google Search" state="ok" stateLabel="Connected" />
              <InsightsSourceBadge label="Yandex" state="off" stateLabel="Not connected" />
              <InsightsSourceBadge label="Bing" state="error" stateLabel="Last fetch failed" detail="The API answered 401" />
            </div>
          ),
          code: `<InsightsSourceBadge label="Google Search" state="ok" stateLabel="Connected" />
<InsightsSourceBadge label="Yandex" state="off" stateLabel="Not connected" />
<InsightsSourceBadge label="Bing" state="error" stateLabel="Last fetch failed" detail="The API answered 401" />`,
        },
        {
          title: 'Translated state words',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              <InsightsSourceBadge label="Google Analytics" state="ok" stateLabel="Verbunden" />
              <InsightsSourceBadge label="Yandex" state="off" stateLabel="Nicht verbunden" />
            </div>
          ),
          code: `<InsightsSourceBadge label="Google Analytics" state="ok" stateLabel="Verbunden" />`,
        },
      ],
    },
    {
      id: 'analytics-search-report-view',
      title: 'SearchReportView',
      category: 'Domain',
      abbr: 'SQ',
      description:
        'What visitors search for on the site itself: searches, searchers, the share that found nothing and the click-through against the previous period, searches per day (all and those that found nothing, one axis), the top searches, the searches that found nothing (content gaps), the results opened most and the search languages. Every number is also in a table; queries arrive masked.',
      filePath: 'modules/domains/analytics/search/SearchReportView.tsx',
      sourceCode: `import { SearchReportView } from '@/modules/domains/analytics';
<SearchReportView report={report} locale="en-US" siteUrl="https://example.com" onRangeChange={(days) => load(days)} />`,
      variants: [
        {
          title: '28 days with the period picker (English, German, Turkish and French searches)',
          layout: 'stack',
          preview: <SearchReportDemo />,
          code: `<SearchReportView report={report} locale="en-US" siteUrl="https://example.com" onRangeChange={(days) => load(days)} />`,
        },
        {
          title: 'Nobody searched yet',
          layout: 'stack',
          preview: <SearchReportView report={demoSearchReport({ empty: true })} locale="en-US" />,
          code: `<SearchReportView report={emptyReport} />`,
        },
        {
          title: 'Translated (German words and formats), 7 days',
          layout: 'stack',
          preview: (
            <SearchReportView
              report={demoSearchReport({ days: 7 })}
              locale="de-DE"
              messages={{
                title: 'Website-Suche', searches: 'Suchen', searchers: 'Suchende', noResultsRate: 'Ohne Treffer', clickThrough: 'Klickrate',
                vsPrevious: 'ggü. Vorzeitraum', lowerIsBetter: 'niedriger ist besser', perDay: 'Suchen pro Tag', seriesSearches: 'Suchen', seriesNoResults: 'Ohne Treffer',
                topQueries: 'Häufigste Suchen', zeroQueries: 'Suchen ohne Treffer', topClicked: 'Am häufigsten geöffnet', languages: 'Suchsprachen',
                rangeLine: '{start} – {end} · verglichen mit den vorherigen {days} Tagen',
              }}
            />
          ),
          code: `<SearchReportView report={report} locale="de-DE" messages={{ title: 'Website-Suche', searches: 'Suchen' }} />`,
        },
      ],
    },
    {
      id: 'analytics-search-query-table',
      title: 'SearchQueryTable',
      category: 'Domain',
      abbr: 'QT',
      description: 'Site search queries in a sortable, searchable table: searches, how often each found nothing, clicks, CTR, language and when last searched. A query that never found anything carries a "nothing found" tag (icon and words); the zero-result list keeps only searches, language and date.',
      filePath: 'modules/domains/analytics/search/SearchQueryTable.tsx',
      sourceCode: `<SearchQueryTable kind="top" rows={report.topQueries} locale="en-US" />`,
      variants: [
        {
          title: 'Top searches',
          layout: 'stack',
          preview: <SearchQueryTable kind="top" rows={demoSearchReport().topQueries} locale="en-US" />,
          code: `<SearchQueryTable kind="top" rows={report.topQueries} locale="en-US" />`,
        },
        {
          title: 'Searches that found nothing',
          layout: 'stack',
          preview: <SearchQueryTable kind="zero" rows={demoSearchReport().zeroResultQueries} locale="en-US" />,
          code: `<SearchQueryTable kind="zero" rows={report.zeroResultQueries} locale="en-US" />`,
        },
      ],
    },
  ];
}
