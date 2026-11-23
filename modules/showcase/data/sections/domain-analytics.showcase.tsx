'use client';
import type { ShowcaseComponent } from '../showcase.types';
import { SiteInsightsView } from '@/modules/domains/analytics/insights/SiteInsightsView';
import { InsightsKpiTile } from '@/modules/domains/analytics/insights/InsightsKpiTile';
import { InsightsSourceBadge } from '@/modules/domains/analytics/insights/InsightsSourceBadge';
import { demoInsightsSnapshot } from '@/modules/domains/analytics/insights/demo';
import { useState } from 'react';
import { SecuritySummaryView } from '@/modules/domains/analytics/security/SecuritySummaryView';
import { SecurityStatusLine } from '@/modules/domains/analytics/security/SecurityStatusLine';
import { SecurityBreakdown } from '@/modules/domains/analytics/security/SecurityBreakdown';
import { demoSecuritySnapshot } from '@/modules/domains/analytics/security/demo';
import { shareRows } from '@/modules/domains/analytics/security/summary';
import { insightsFormat } from '@/modules/domains/analytics/insights/format';

/** The summary with its range buttons wired (the demo only rebuilds the snapshot for the chosen length). */
function SecuritySummaryDemo() {
  const [days, setDays] = useState(30);
  return (
    <SecuritySummaryView
      snapshot={demoSecuritySnapshot({ days, open: 'health' })}
      locale="en-US"
      rangeOptions={[7, 30, 90]}
      onRangeChange={setDays}
    />
  );
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
      id: 'analytics-security-summary-view',
      title: 'SecuritySummaryView',
      category: 'Domain',
      abbr: 'YS',
      description:
        'What a site\'s protections refused, blocked and noticed over a range of days: a status line (open file-integrity and health alerts, icon and words), headline counts against the previous period, and tabs for geo-IP refusals (by action, reason, country), sign-in security, spam the forms caught, the server (fail2ban bans per jail, alerts) and the short recent-refusals list, the only part that holds IP addresses. One measure per chart axis, every number also in a table.',
      filePath: 'modules/domains/analytics/security/SecuritySummaryView.tsx',
      sourceCode: `import { SecuritySummaryView } from '@/modules/domains/analytics';
<SecuritySummaryView snapshot={snapshot} locale="en-US" rangeOptions={[7, 30, 90, 365]} onRangeChange={load} />`,
      variants: [
        {
          title: 'Overview with a health alert open, range buttons',
          layout: 'stack',
          preview: <SecuritySummaryDemo />,
          code: `<SecuritySummaryView snapshot={snapshot} locale="en-US" rangeOptions={[7, 30, 90]} onRangeChange={setDays} />`,
        },
        {
          title: 'Integrity alert open, Server tab',
          layout: 'stack',
          preview: <SecuritySummaryView snapshot={demoSecuritySnapshot({ open: 'integrity' })} locale="en-US" defaultTab="server" />,
          code: `<SecuritySummaryView snapshot={snapshot} defaultTab="server" />`,
        },
        {
          title: 'Server not reporting yet, quiet site, recent refusals (holds IP addresses)',
          layout: 'stack',
          preview: <SecuritySummaryView snapshot={demoSecuritySnapshot({ server: 'off', quiet: true })} locale="en-US" defaultTab="recent" />,
          code: `<SecuritySummaryView snapshot={snapshot} defaultTab="recent" />`,
        },
      ],
    },
    {
      id: 'analytics-security-status-line',
      title: 'SecurityStatusLine',
      category: 'Domain',
      abbr: 'YL',
      description: 'The one-line verdict of the security summary: an icon and words for the state (no alerts, a health alert, an integrity alert, the server not reporting), never colour alone; a live region.',
      filePath: 'modules/domains/analytics/security/SecurityStatusLine.tsx',
      sourceCode: `<SecurityStatusLine tone="critical" text="1 integrity alert open" label="Status" />`,
      variants: [
        {
          title: 'Tones',
          layout: 'stack',
          preview: (
            <div className="flex flex-col gap-2">
              <SecurityStatusLine tone="ok" text="No alerts open" label="Status" detail="Last server report Nov 22, 2026, 12:10 AM" />
              <SecurityStatusLine tone="warning" text="1 health alert open" label="Status" />
              <SecurityStatusLine tone="critical" text="1 integrity alert open · 2 health alerts open" label="Status" />
              <SecurityStatusLine tone="off" text="No alerts open on this site; the server has not reported yet" label="Status" />
            </div>
          ),
          code: `<SecurityStatusLine tone="warning" text="1 health alert open" label="Status" />`,
        },
        {
          title: 'Translated words',
          layout: 'stack',
          preview: <SecurityStatusLine tone="ok" text="Keine offenen Warnungen" label="Status" />,
          code: `<SecurityStatusLine tone="ok" text="Keine offenen Warnungen" label="Status" />`,
        },
      ],
    },
    {
      id: 'analytics-security-breakdown',
      title: 'SecurityBreakdown',
      category: 'Domain',
      abbr: 'YB',
      description: 'Counts of one period split by a key (action, reason, spam kind, jail, country): words, count, share and the previous period\'s count, with a bar to scale. Every number printed, so the list is its own table.',
      filePath: 'modules/domains/analytics/security/SecurityBreakdown.tsx',
      sourceCode: `<SecurityBreakdown rows={shareRows(snapshot.refusals.byReason)} label={reasonLabel} fmt={fmt} previousLabel="Previous period" emptyText="Nothing recorded." ariaLabel="By reason" />`,
      variants: [
        {
          title: 'Refusals by reason',
          layout: 'stack',
          preview: (
            <div className="max-w-md">
              <SecurityBreakdown
                rows={shareRows(demoSecuritySnapshot().refusals.byReason, ['country', 'address-limit', 'country-cap', 'staff-country'])}
                label={(k) => ({ country: 'Country rule', 'address-limit': 'Address limit', 'country-cap': 'Country cap', 'staff-country': 'Staff country' } as Record<string, string>)[k] ?? k}
                fmt={insightsFormat('en-US')}
                previousLabel="Previous period"
                emptyText="Nothing recorded in this period."
                ariaLabel="By reason"
              />
            </div>
          ),
          code: `<SecurityBreakdown rows={shareRows(byReason, REFUSAL_REASONS)} label={reasonLabel} fmt={insightsFormat('en-US')} previousLabel="Previous period" emptyText="Nothing recorded in this period." ariaLabel="By reason" />`,
        },
        {
          title: 'Empty',
          layout: 'stack',
          preview: <SecurityBreakdown rows={[]} label={(k) => k} fmt={insightsFormat('en-US')} previousLabel="Previous period" emptyText="Nothing recorded in this period." ariaLabel="By kind" />,
          code: `<SecurityBreakdown rows={[]} label={(k) => k} fmt={fmt} previousLabel="Previous period" emptyText="Nothing recorded in this period." ariaLabel="By kind" />`,
        },
      ],
    },
  ];
}
