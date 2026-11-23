'use client';
import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { ButtonGroup } from '@/modules/ui/ButtonGroup';
import { Card } from '@/modules/ui/Card';
import { EmptyState } from '@/modules/ui/EmptyState';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { LineChart } from '@/modules/ui/Chart/charts/LineChart';
import type { Series } from '@/modules/ui/Chart/types';
import type { SiteSearchClickedRow, SiteSearchReport } from '../types';
import { insightsDelta } from '../insights/combineInsights';
import { insightsFormat, type InsightsFormat } from '../insights/format';
import { InsightsKpiTile } from '../insights/InsightsKpiTile';
import { fillInsights } from '../insights/messages';
import { DEFAULT_SEARCH_REPORT_MESSAGES, type SearchReportMessages } from './messages';
import { SearchQueryTable } from './SearchQueryTable';
import { combineSearchReport, searchLanguageName, type CombinedSearchReport } from './searchReport';

/** Series colours: every search `--chart-1`, the ones that found nothing `--chart-2` (identity, not status). */
export const SEARCH_SERIES_COLOR = { searches: 'var(--chart-1)', zeroResult: 'var(--chart-2)' } as const;

type SearchReportViewProps = {
  /** The report the host aggregated from its search log. */
  report: SiteSearchReport;
  /** Number, date and language-name formats (BCP 47). Default = the browser's. */
  locale?: string;
  /** Any subset of the view's words. */
  messages?: Partial<SearchReportMessages>;
  /** The periods offered (days) when `onRangeChange` is given. Default 7, 28 and 90. */
  rangeOptions?: number[];
  /** Shows the period picker; the host aggregates again and passes the new report. */
  onRangeChange?: (days: number) => void;
  /** The site's address, to link result paths (e.g. "https://example.com"). */
  siteUrl?: string;
  className?: string;
};

type Kpi = { label: string; value: string; current: number; previous?: number; lowerIsBetter?: boolean; title?: string };

function KpiRow({ c, fmt, m }: { c: CombinedSearchReport; fmt: InsightsFormat; m: SearchReportMessages }) {
  const p = c.previous;
  const items: Kpi[] = [
    { label: m.searches, value: fmt.int(c.totals.searches), current: c.totals.searches, previous: p?.searches },
    { label: m.searchers, value: fmt.int(c.totals.searchers), current: c.totals.searchers, previous: p?.searchers, title: m.searchersHint },
    { label: m.noResultsRate, value: fmt.percent(c.totals.zeroRate), current: c.totals.zeroRate, previous: p?.zeroRate, lowerIsBetter: true },
    { label: m.clickThrough, value: fmt.percent(c.totals.clickThrough), current: c.totals.clickThrough, previous: p?.clickThrough },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
      {items.map((k) => {
        const delta = insightsDelta(k.current, k.previous, k.lowerIsBetter);
        return (
          <InsightsKpiTile
            key={k.label}
            label={k.label}
            value={k.value}
            title={k.title}
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

function DailyChart({ c, fmt, m, locale }: { c: CombinedSearchReport; fmt: InsightsFormat; m: SearchReportMessages; locale?: string }) {
  // One measure (searches) on one axis: all of them, and the part that found nothing.
  const series: Series[] = [
    { id: 'searches', name: m.seriesSearches, color: SEARCH_SERIES_COLOR.searches, data: c.days.map((d) => ({ x: d.date, y: d.searches })) },
    { id: 'zeroResult', name: m.seriesNoResults, color: SEARCH_SERIES_COLOR.zeroResult, data: c.days.map((d) => ({ x: d.date, y: d.zeroResult })) },
  ];
  return (
    <Card title={m.perDay}>
      {c.days.length ? (
        <div className="flex flex-col gap-3">
          <LineChart curve="linear" series={series} xAxis="time" locale={locale} height={260} showLegend legendValues={['total']} yFormat={fmt.int} ariaLabel={m.perDay} />
          <details className="group text-sm">
            <summary className="cursor-pointer select-none rounded-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
              {m.dailyNumbers}
            </summary>
            <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-xs">
                <caption className="sr-only">{m.perDay}</caption>
                <thead className="sticky top-0 bg-surface-raised text-text-secondary">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">{m.date}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{m.seriesSearches}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{m.seriesNoResults}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{m.clicks}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{m.searchers}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {c.days.map((d) => (
                    <tr key={d.date} className="border-t border-border">
                      <th scope="row" className="px-3 py-1.5 text-left font-normal text-text-primary">{fmt.date(d.date)}</th>
                      <td className="px-3 py-1.5 text-right">{fmt.int(d.searches)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt.int(d.zeroResult)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt.int(d.clicks)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt.int(d.searchers)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-text-secondary">{m.noData}</p>
      )}
    </Card>
  );
}

function LanguageBars({ c, fmt, m, locale }: { c: CombinedSearchReport; fmt: InsightsFormat; m: SearchReportMessages; locale?: string }) {
  if (!c.languages.length) return <p className="py-6 text-center text-sm text-text-secondary">{m.noData}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {c.languages.map((l) => (
        <li key={l.key || 'unknown'} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
            <span className="font-medium text-text-primary">{searchLanguageName(l.key, locale, m.unknownLanguage)}</span>
            <span className="tabular-nums text-text-secondary">
              {fmt.int(l.searches)} · <span className="font-medium text-text-primary">{fmt.percent(l.share)}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-sunken" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.max(l.share * 100, l.share > 0 ? 2 : 0)}%`, background: SEARCH_SERIES_COLOR.searches }} />
          </div>
          <span className="text-xs tabular-nums text-text-secondary">{fillInsights(m.languageZero, { rate: fmt.percent(l.zeroRate) })}</span>
        </li>
      ))}
    </ul>
  );
}

function ClickedTable({ rows, fmt, m, siteUrl }: { rows: SiteSearchClickedRow[]; fmt: InsightsFormat; m: SearchReportMessages; siteUrl?: string }) {
  const base = siteUrl ? siteUrl.replace(/\/$/, '') : '';
  const columns: Column<SiteSearchClickedRow>[] = [
    {
      key: 'url',
      header: m.result,
      tdClass: 'min-w-[14rem]',
      sortable: true,
      sortValue: (r) => (r.title || r.url).toLowerCase(),
      searchValue: (r) => `${r.title} ${r.url}`,
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          {base ? (
            <a
              href={`${base}${r.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {r.title || r.url}
              <span className="sr-only"> {m.opensInNewTab}</span>
            </a>
          ) : (
            <span className="break-words font-medium text-text-primary">{r.title || r.url}</span>
          )}
          {r.title && <span className="break-all text-xs text-text-secondary">{r.url}</span>}
        </span>
      ),
    },
    {
      key: 'clicks', header: m.clicks, align: 'right', sortable: true, searchable: false,
      sortValue: (r) => r.clicks,
      render: (r) => <span className="font-medium tabular-nums">{fmt.int(r.clicks)}</span>,
    },
    {
      key: 'fromQueries',
      header: m.fromQueries,
      tdClass: 'min-w-[12rem]',
      searchValue: (r) => r.fromQueries.join(' '),
      render: (r) => (
        <ul className="flex flex-wrap gap-1" aria-label={m.fromQueries}>
          {r.fromQueries.slice(0, 4).map((q) => (
            <li key={q} className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs text-text-primary">{q}</li>
          ))}
          {r.fromQueries.length > 4 && <li className="px-1 py-0.5 text-xs text-text-secondary">+{fmt.int(r.fromQueries.length - 4)}</li>}
        </ul>
      ),
    },
  ];
  return (
    <DataTable<SiteSearchClickedRow>
      mode="paginated"
      className="overflow-x-auto"
      caption={m.topClicked}
      columns={columns}
      rows={rows}
      rowId={(r) => r.url}
      searchable
      pageSize={10}
      searchPlaceholder={m.searchPlaceholder}
      emptyMessage={m.noData}
    />
  );
}

/**
 * SearchReportView — what visitors search for on the site itself: how many searches and searchers, how many found
 * nothing and how many ended in an opened result (each against the previous period), searches per day, the top
 * searches, the searches that found nothing (content gaps), the results opened most and the languages searched in.
 * The host aggregates its own (masked, short-lived) search log into a `SiteSearchReport`; this view only reads it.
 * Charts show one measure per axis and every number is also in a table.
 */
export function SearchReportView({ report, locale, messages, rangeOptions = [7, 28, 90], onRangeChange, siteUrl, className }: SearchReportViewProps) {
  const m = useMemo(() => ({ ...DEFAULT_SEARCH_REPORT_MESSAGES, ...messages }), [messages]);
  const fmt = useMemo(() => insightsFormat(locale), [locale]);
  const c = useMemo(() => combineSearchReport(report), [report]);

  return (
    <section className={cn('@container flex w-full min-w-0 flex-col gap-4', className)} aria-label={m.title}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-bold text-text-primary">{m.title}</h2>
          <p className="text-sm text-text-secondary">
            {fillInsights(m.rangeLine, { start: fmt.date(report.range.start), end: fmt.date(report.range.end), days: report.range.days })}
          </p>
          {report.generatedAt && <p className="text-xs text-text-secondary">{fillInsights(m.updated, { date: fmt.dateTime(report.generatedAt) })}</p>}
        </div>
        {onRangeChange && rangeOptions.length > 1 && (
          <div role="group" aria-label={m.chooseRange}>
            <ButtonGroup
              size="sm"
              value={String(report.range.days)}
              onChange={(v) => onRangeChange(Number(v))}
              items={rangeOptions.map((d) => ({ value: String(d), label: fillInsights(m.rangeDays, { days: d }) }))}
            />
          </div>
        )}
      </header>

      {c.empty ? (
        <EmptyState
          icon={<FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />}
          title={m.emptyTitle}
          description={m.emptyDescription}
        />
      ) : (
        <>
          <KpiRow c={c} fmt={fmt} m={m} />
          <DailyChart c={c} fmt={fmt} m={m} locale={locale} />
          <Card title={m.topQueries}>
            <SearchQueryTable kind="top" rows={c.topQueries} locale={locale} messages={m} />
          </Card>
          <div className="grid gap-4 @5xl:grid-cols-[3fr_2fr]">
            <Card title={m.zeroQueries} subtitle={m.zeroHint}>
              <SearchQueryTable kind="zero" rows={c.zeroResultQueries} locale={locale} messages={m} />
            </Card>
            <Card title={m.languages}>
              <LanguageBars c={c} fmt={fmt} m={m} locale={locale} />
            </Card>
          </div>
          <Card title={m.topClicked}>
            <ClickedTable rows={c.topClicked} fmt={fmt} m={m} siteUrl={siteUrl} />
          </Card>
        </>
      )}
      <p className="text-xs text-text-secondary">{fillInsights(m.privacy, { days: report.retentionDays })}</p>
    </section>
  );
}
