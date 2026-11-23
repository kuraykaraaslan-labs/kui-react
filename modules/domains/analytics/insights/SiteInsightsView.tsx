'use client';
import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsRotate, faPlug } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { ButtonGroup } from '@/modules/ui/ButtonGroup';
import { Callout } from '@/modules/ui/Callout';
import { Card } from '@/modules/ui/Card';
import { EmptyState } from '@/modules/ui/EmptyState';
import { TabGroup } from '@/modules/ui/TabGroup';
import { LineChart } from '@/modules/ui/Chart/charts/LineChart';
import type { Series } from '@/modules/ui/Chart/types';
import type { AnalyticsSource, InsightsSnapshot, InsightsSource, SearchEngineId, SearchSource } from '../types';
import { combineInsights, insightsDelta } from './combineInsights';
import { ENGINE_COLOR, SINGLE_SERIES_COLOR, insightsFormat, type InsightsFormat } from './format';
import { InsightsKpiTile } from './InsightsKpiTile';
import { InsightsSourceBadge } from './InsightsSourceBadge';
import { InsightsTopTable } from './InsightsTopTable';
import { DEFAULT_SITE_INSIGHTS_MESSAGES, fillInsights, type SiteInsightsMessages } from './messages';

type SiteInsightsViewProps = {
  /** The cached snapshot the host fetched (GA4, Search Console, Bing, Yandex). */
  snapshot: InsightsSnapshot;
  /** Number and date formats (BCP 47). Default = the browser's. */
  locale?: string;
  /** Any subset of the view's words. */
  messages?: Partial<SiteInsightsMessages>;
  /** Shows "Refresh now"; the host fetches again and passes the new snapshot. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** The site's address, to link page paths (e.g. "https://example.com"). */
  siteUrl?: string;
  /** `overview` (default) or a source id. */
  defaultTab?: string;
  className?: string;
};

type Kpi = { label: string; value: string; current: number; previous?: number; lowerIsBetter?: boolean };

function KpiRow({ items, fmt, m }: { items: Kpi[]; fmt: InsightsFormat; m: SiteInsightsMessages }) {
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @5xl:grid-cols-6">
      {items.map((k) => {
        const delta = insightsDelta(k.current, k.previous, k.lowerIsBetter);
        return (
          <InsightsKpiTile
            key={k.label}
            label={k.label}
            value={k.value}
            delta={delta}
            deltaText={delta ? fmt.signedPercent(delta.change) : undefined}
            caption={delta ? m.vsPrevious : m.noPrevious}
            hint={delta && k.lowerIsBetter ? m.lowerIsBetter : undefined}
          />
        );
      })}
    </div>
  );
}

const engineSeries = (id: SearchEngineId, name: string, data: Series['data']): Series => ({ id, name, data, color: ENGINE_COLOR[id] });

/** One metric of one source over time, picked with a button row (one axis, one series). */
function MetricChart<K extends string>({
  title, metrics, days, m, locale, initial,
}: {
  title: (metricLabel: string) => string;
  metrics: { key: K; label: string; format: (v: number) => string }[];
  days: Array<Record<string, unknown> & { date: string }>;
  m: SiteInsightsMessages;
  locale?: string;
  initial: K;
}) {
  const [metric, setMetric] = useState<K>(initial);
  const def = metrics.find((x) => x.key === metric) ?? metrics[0];
  const series: Series[] = [{
    id: def.key,
    name: def.label,
    color: SINGLE_SERIES_COLOR,
    // An unknown average position (0) is a gap, not a line at rank 0.
    data: days.map((d) => {
      const v = d[def.key];
      return { x: d.date, y: typeof v === 'number' && !(def.key === 'position' && v <= 0) ? v : null };
    }),
  }];
  return (
    <Card
      title={title(def.label)}
      headerRight={
        <div aria-label={m.chooseMetric} role="group">
          <ButtonGroup size="xs" value={metric} onChange={(v) => setMetric(v as K)} items={metrics.map((x) => ({ value: x.key, label: x.label }))} />
        </div>
      }
    >
      {days.length ? (
        <LineChart curve="linear" series={series} xAxis="time" locale={locale} height={260} showLegend={false} yFormat={def.format} ariaLabel={title(def.label)} />
      ) : (
        <p className="py-8 text-center text-sm text-text-secondary">{m.noData}</p>
      )}
    </Card>
  );
}

function StateNotes({ source, fmt, m }: { source: InsightsSource; fmt: InsightsFormat; m: SiteInsightsMessages }) {
  if (source.state !== 'error') return null;
  return (
    <Callout variant="warning" title={m.stateError}>
      {source.message && <span className="block">{source.message}</span>}
      {source.fetchedAt && <span className="block">{fillInsights(m.errorKept, { date: fmt.dateTime(source.fetchedAt) })}</span>}
    </Callout>
  );
}

function OffState({ m }: { m: SiteInsightsMessages }) {
  return <EmptyState icon={<FontAwesomeIcon icon={faPlug} aria-hidden="true" />} title={m.offTitle} description={m.offDescription} />;
}

function SearchTab({ source, fmt, m, locale, siteUrl }: { source: SearchSource; fmt: InsightsFormat; m: SiteInsightsMessages; locale?: string; siteUrl?: string }) {
  if (source.state === 'off') return <OffState m={m} />;
  const t = source.totals ?? {};
  const p = source.previousTotals ?? {};
  return (
    <div className="flex flex-col gap-4">
      <StateNotes source={source} fmt={fmt} m={m} />
      <KpiRow
        fmt={fmt}
        m={m}
        items={[
          { label: m.clicks, value: fmt.int(t.clicks ?? 0), current: t.clicks ?? 0, previous: p.clicks },
          { label: m.impressions, value: fmt.compact(t.impressions ?? 0), current: t.impressions ?? 0, previous: p.impressions },
          { label: m.ctr, value: fmt.percent(t.ctr ?? 0), current: t.ctr ?? 0, previous: p.ctr },
          { label: m.position, value: fmt.position(t.position ?? 0), current: t.position ?? 0, previous: p.position, lowerIsBetter: true },
        ]}
      />
      <MetricChart
        title={(label) => fillInsights(m.metricOverTime, { metric: label })}
        initial="clicks"
        metrics={[
          { key: 'clicks', label: m.clicks, format: fmt.int },
          { key: 'impressions', label: m.impressions, format: fmt.compact },
          { key: 'ctr', label: m.ctr, format: fmt.percent },
          { key: 'position', label: m.position, format: fmt.position },
        ]}
        days={source.days ?? []}
        m={m}
        locale={locale}
      />
      <div className="grid gap-4 @7xl:grid-cols-2">
        <Card title={m.topQueries}><InsightsTopTable kind="queries" rows={source.topQueries ?? []} fmt={fmt} messages={m} /></Card>
        <Card title={m.topPages}><InsightsTopTable kind="pages" rows={source.topPages ?? []} fmt={fmt} messages={m} siteUrl={siteUrl} /></Card>
      </div>
    </div>
  );
}

function AnalyticsTab({ source, fmt, m, locale, siteUrl }: { source: AnalyticsSource; fmt: InsightsFormat; m: SiteInsightsMessages; locale?: string; siteUrl?: string }) {
  if (source.state === 'off') return <OffState m={m} />;
  const t = source.totals ?? {};
  const p = source.previousTotals ?? {};
  const channelTotal = (source.channels ?? []).reduce((s, c) => s + (c.sessions ?? 0), 0);
  return (
    <div className="flex flex-col gap-4">
      <StateNotes source={source} fmt={fmt} m={m} />
      <KpiRow
        fmt={fmt}
        m={m}
        items={[
          { label: m.users, value: fmt.int(t.users ?? 0), current: t.users ?? 0, previous: p.users },
          { label: m.sessions, value: fmt.int(t.sessions ?? 0), current: t.sessions ?? 0, previous: p.sessions },
          { label: m.views, value: fmt.int(t.views ?? 0), current: t.views ?? 0, previous: p.views },
          { label: m.engagementRate, value: fmt.percent(t.engagementRate ?? 0), current: t.engagementRate ?? 0, previous: p.engagementRate },
        ]}
      />
      <MetricChart
        title={(label) => fillInsights(m.metricOverTime, { metric: label })}
        initial="views"
        metrics={[
          { key: 'views', label: m.views, format: fmt.int },
          { key: 'users', label: m.users, format: fmt.int },
          { key: 'sessions', label: m.sessions, format: fmt.int },
        ]}
        days={source.days ?? []}
        m={m}
        locale={locale}
      />
      <div className="grid gap-4 @6xl:grid-cols-[2fr_1fr]">
        <Card title={m.topPages}><InsightsTopTable kind="pages" rows={source.topPages ?? []} search={false} analytics fmt={fmt} messages={m} siteUrl={siteUrl} /></Card>
        <Card title={m.channels}>
          {(source.channels ?? []).length ? (
            <ul className="flex flex-col gap-3">
              {(source.channels ?? []).map((c) => {
                const share = channelTotal > 0 ? (c.sessions ?? 0) / channelTotal : 0;
                return (
                  <li key={c.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-text-primary">{c.key}</span>
                      <span className="tabular-nums text-text-secondary">{fmt.int(c.sessions ?? 0)} · {fmt.percent(share)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-sunken" aria-hidden="true">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%`, background: SINGLE_SERIES_COLOR }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">{m.noData}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function OverviewTab({ snapshot, fmt, m, locale, siteUrl }: { snapshot: InsightsSnapshot; fmt: InsightsFormat; m: SiteInsightsMessages; locale?: string; siteUrl?: string }) {
  const c = useMemo(() => combineInsights(snapshot), [snapshot]);
  const engines = c.byEngine.map((e) => ({ id: e.id, label: e.label }));
  const a = c.analytics;
  const kpis: Kpi[] = [];
  if (engines.length) {
    kpis.push(
      { label: m.searchClicks, value: fmt.int(c.totals.clicks), current: c.totals.clicks, previous: c.previousTotals.clicks },
      { label: m.searchImpressions, value: fmt.compact(c.totals.impressions), current: c.totals.impressions, previous: c.previousTotals.impressions },
      { label: m.ctr, value: fmt.percent(c.totals.ctr), current: c.totals.ctr, previous: c.previousTotals.ctr },
      { label: m.position, value: fmt.position(c.totals.position), current: c.totals.position, previous: c.previousTotals.position, lowerIsBetter: true },
    );
  }
  if (a) {
    kpis.push(
      { label: m.users, value: fmt.int(a.totals.users ?? 0), current: a.totals.users ?? 0, previous: a.previousTotals.users },
      { label: m.views, value: fmt.int(a.totals.views ?? 0), current: a.totals.views ?? 0, previous: a.previousTotals.views },
    );
  }
  if (!engines.length && !a) return <OffState m={m} />;

  const clickSeries: Series[] = c.byEngine.map((e) =>
    engineSeries(e.id, e.label, c.days.map((d) => ({ x: d.date, y: d.engines[e.id] ?? null }))),
  );
  const viewSeries: Series[] = a
    ? [{ id: 'views', name: m.views, color: SINGLE_SERIES_COLOR, data: c.days.map((d) => ({ x: d.date, y: d.views })) }]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <KpiRow items={kpis} fmt={fmt} m={m} />
      <div className={cn('grid gap-4', a && engines.length ? '@4xl:grid-cols-2' : '')}>
        {engines.length > 0 && (
          <Card title={m.clicksByEngine}>
            <LineChart curve="linear" series={clickSeries} xAxis="time" locale={locale} height={260} showLegend legendValues={['total']} yFormat={fmt.int} ariaLabel={m.clicksByEngine} />
          </Card>
        )}
        {a && (
          <Card title={m.viewsOverTime}>
            <LineChart curve="linear" series={viewSeries} xAxis="time" locale={locale} height={260} showLegend={false} yFormat={fmt.int} ariaLabel={m.viewsOverTime} />
          </Card>
        )}
      </div>
      {!engines.length && <Callout variant="info" title={null}>{m.noSearch}</Callout>}
      {engines.length > 0 && (
        <Card title={m.engineShare}>
          <ul className="flex flex-col gap-3">
            {c.byEngine.map((e) => (
              <li key={e.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-text-primary">
                    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ENGINE_COLOR[e.id] }} />
                    {e.label}
                  </span>
                  <span className="tabular-nums text-text-secondary">
                    {fmt.int(e.clicks)} {m.clicks.toLowerCase()} · {fmt.compact(e.impressions)} {m.impressions.toLowerCase()} · <span className="font-medium text-text-primary">{fmt.percent(e.share)}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-sunken" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(e.share * 100, e.share > 0 ? 2 : 0)}%`, background: ENGINE_COLOR[e.id] }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-4">
        {engines.length > 0 && (
          <Card title={m.topQueries}><InsightsTopTable kind="queries" rows={c.topQueries} engines={engines.length > 1 ? engines : []} fmt={fmt} messages={m} /></Card>
        )}
        <Card title={m.topPages}>
          <InsightsTopTable kind="pages" rows={c.topPages} search={engines.length > 0} analytics={!!a} engines={engines.length > 1 ? engines : []} fmt={fmt} messages={m} siteUrl={siteUrl} />
        </Card>
      </div>
    </div>
  );
}

/**
 * SiteInsightsView — a site's analytics and search data in one place: an Overview that combines every connected
 * search engine (and puts the analytics source beside it), and a tab per source (Google Analytics, Google Search,
 * Bing, Yandex). Headline numbers compare with the previous period of the same length; charts show one measure per
 * axis; every number is also in a table. The host fetches and caches the snapshot (`InsightsSnapshot`); this view
 * only reads it. Sources that are not connected say so instead of showing empty charts.
 */
export function SiteInsightsView({ snapshot, locale, messages, onRefresh, refreshing = false, siteUrl, defaultTab = 'overview', className }: SiteInsightsViewProps) {
  const m = useMemo(() => ({ ...DEFAULT_SITE_INSIGHTS_MESSAGES, ...messages }), [messages]);
  const fmt = useMemo(() => insightsFormat(locale), [locale]);
  const stateLabel = (s: InsightsSource) => (s.state === 'ok' ? m.stateOk : s.state === 'off' ? m.stateOff : m.stateError);

  const tabs = [
    { id: 'overview', label: m.tabOverview, content: <OverviewTab snapshot={snapshot} fmt={fmt} m={m} locale={locale} siteUrl={siteUrl} /> },
    ...snapshot.sources.map((s) => ({
      id: s.id,
      label: s.label,
      content: s.kind === 'analytics'
        ? <AnalyticsTab source={s} fmt={fmt} m={m} locale={locale} siteUrl={siteUrl} />
        : <SearchTab source={s} fmt={fmt} m={m} locale={locale} siteUrl={siteUrl} />,
    })),
  ];

  return (
    <section className={cn('@container flex w-full min-w-0 flex-col gap-4', className)} aria-label={m.title}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-bold text-text-primary">{m.title}</h2>
          <p className="text-sm text-text-secondary">
            {fillInsights(m.rangeLine, { start: fmt.date(snapshot.range.start), end: fmt.date(snapshot.range.end), days: snapshot.range.days })}
          </p>
          <p className="text-xs text-text-secondary">
            {snapshot.generatedAt ? fillInsights(m.updated, { date: fmt.dateTime(snapshot.generatedAt) }) : m.neverUpdated}
          </p>
        </div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing} disabled={refreshing} iconLeft={<FontAwesomeIcon icon={faArrowsRotate} aria-hidden="true" />}>
            {refreshing ? m.refreshing : m.refresh}
          </Button>
        )}
      </header>
      <ul className="flex flex-wrap gap-2" aria-label={m.title}>
        {snapshot.sources.map((s) => (
          <li key={s.id}>
            <InsightsSourceBadge
              label={s.label}
              state={s.state}
              stateLabel={stateLabel(s)}
              detail={s.state === 'error' ? s.message : s.fetchedAt ? fillInsights(m.updated, { date: fmt.dateTime(s.fetchedAt) }) : stateLabel(s)}
            />
          </li>
        ))}
      </ul>
      <TabGroup tabs={tabs} defaultTab={defaultTab} label={m.title} lazy />
    </section>
  );
}
