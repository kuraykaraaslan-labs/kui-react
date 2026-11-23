'use client';
import type { ShowcaseComponent } from '../showcase.types';
import { SiteInsightsView } from '@/modules/domains/analytics/insights/SiteInsightsView';
import { InsightsKpiTile } from '@/modules/domains/analytics/insights/InsightsKpiTile';
import { InsightsSourceBadge } from '@/modules/domains/analytics/insights/InsightsSourceBadge';
import { demoInsightsSnapshot } from '@/modules/domains/analytics/insights/demo';

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
  ];
}
