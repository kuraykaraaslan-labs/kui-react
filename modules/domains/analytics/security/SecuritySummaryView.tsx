'use client';
import { useId, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { ButtonGroup } from '@/modules/ui/ButtonGroup';
import { Callout } from '@/modules/ui/Callout';
import { Card } from '@/modules/ui/Card';
import { EmptyState } from '@/modules/ui/EmptyState';
import { Select } from '@/modules/ui/Select';
import { TabGroup } from '@/modules/ui/TabGroup';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { LineChart } from '@/modules/ui/Chart/charts/LineChart';
import type { Series } from '@/modules/ui/Chart/types';
import { insightsFormat, type InsightsFormat } from '../insights/format';
import { fillInsights } from '../insights/messages';
import { InsightsKpiTile } from '../insights/InsightsKpiTile';
import {
  REFUSAL_REASONS, SECURITY_SURFACES, SIGN_IN_METRICS, SPAM_KINDS,
  type SecurityAlert, type SecurityCountRow, type SecurityRecentRefusal, type SecuritySnapshot, type SignInMetric,
} from './types';
import { DEFAULT_SECURITY_SUMMARY_MESSAGES, type SecuritySummaryMessages } from './messages';
import {
  countryLabel, dayValue, emptyBanDay, emptyRefusalDay, emptySignInDay, emptySpamDay, fillDays, keyLabel, neutralDelta,
  overviewDays, securityKpis, securityStatus, securityStatusText, shareRows, sortAlerts, viewChoices,
} from './summary';
import { SecurityBreakdown } from './SecurityBreakdown';
import { SecurityStatusLine } from './SecurityStatusLine';

type SecuritySummaryViewProps = {
  /** The snapshot the host built from its daily counters. */
  snapshot: SecuritySnapshot;
  /** Number, date and country-name formats (BCP 47). Default = the browser's. */
  locale?: string;
  /** Any subset of the view's words. */
  messages?: Partial<SecuritySummaryMessages>;
  /** Range choices in days (e.g. [7, 30, 90, 365]); the host builds a new snapshot on `onRangeChange`. */
  rangeOptions?: number[];
  onRangeChange?: (days: number) => void;
  /** `overview` (default), `refusals`, `signin`, `spam`, `server` or `recent`. */
  defaultTab?: string;
  className?: string;
};

/** The three overview series, in their fixed colour slots (validated set, `--chart-1..3`). */
const OVERVIEW_COLOR = { refusals: 'var(--chart-1)', failedSignIns: 'var(--chart-2)', spam: 'var(--chart-3)' } as const;
const SINGLE = 'var(--chart-1)';

type Ctx = { fmt: InsightsFormat; m: SecuritySummaryMessages; locale?: string };

/** The numbers behind a chart, one row a day, behind a disclosure (every number is also in a table). */
function DayTable({ title, dates, columns, ctx }: { title: string; dates: string[]; columns: { name: string; values: number[] }[]; ctx: Ctx }) {
  return (
    <details className="group mt-3 text-sm">
      <summary className="cursor-pointer rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
        {ctx.m.showTable}
      </summary>
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th scope="col" className="py-1 pr-4 text-left font-medium">{ctx.m.date}</th>
              {columns.map((c) => <th key={c.name} scope="col" className="py-1 pr-4 text-right font-medium">{c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {dates.map((d, i) => (
              <tr key={d} className="border-b border-border last:border-0">
                <th scope="row" className="py-1 pr-4 text-left font-normal text-text-secondary">{ctx.fmt.date(d)}</th>
                {columns.map((c) => <td key={c.name} className="py-1 pr-4 text-right tabular-nums text-text-primary">{ctx.fmt.int(c.values[i] ?? 0)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * A daily count chart with an optional picker (one series at a time: one axis, one colour), or a fixed set of series
 * in their colour slots (the overview). The picker is a native select: the choices can be many.
 */
function DailyChartCard({
  title, dates, series, choices, choice, onChoice, ctx, legend = false,
}: {
  title: string;
  dates: string[];
  series: { id: string; name: string; color: string; values: number[] }[];
  choices?: { value: string; label: string }[];
  choice?: string;
  onChoice?: (v: string) => void;
  ctx: Ctx;
  legend?: boolean;
}) {
  const id = useId();
  const chartSeries: Series[] = series.map((s) => ({ id: s.id, name: s.name, color: s.color, data: dates.map((d, i) => ({ x: d, y: s.values[i] ?? 0 })) }));
  const hasAny = series.some((s) => s.values.some((v) => v > 0));
  return (
    <Card
      title={title}
      headerRight={
        choices && choices.length > 1 && onChoice ? (
          <Select id={`${id}-pick`} label={ctx.m.show} hideLabel options={choices} value={choice} onChange={(e) => onChoice(e.target.value)} className="w-56 max-w-full" />
        ) : undefined
      }
    >
      {dates.length && hasAny ? (
        <>
          <LineChart curve="linear" series={chartSeries} xAxis="time" locale={ctx.locale} height={240} showLegend={legend} legendValues={legend ? ['total'] : undefined} yFormat={ctx.fmt.int} ariaLabel={title} />
          <DayTable title={title} dates={dates} columns={series.map((s) => ({ name: s.name, values: s.values }))} ctx={ctx} />
        </>
      ) : (
        <p className="py-8 text-center text-sm text-text-secondary">{ctx.m.noData}</p>
      )}
    </Card>
  );
}

function Kpis({ items, ctx }: { items: { label: string; current: number; previous?: number }[]; ctx: Ctx }) {
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @5xl:grid-cols-6">
      {items.map((k) => {
        const delta = neutralDelta(k.current, k.previous);
        return (
          <InsightsKpiTile
            key={k.label}
            label={k.label}
            value={ctx.fmt.int(k.current)}
            delta={delta}
            deltaText={delta ? ctx.fmt.signedPercent(delta.change) : undefined}
            caption={delta ? ctx.m.vsPrevious : ctx.m.noPrevious}
          />
        );
      })}
    </div>
  );
}

/** A breakdown chart: All or one key of a group (an action, a reason, a jail), picked in the card header. */
function BreakdownChart<D extends { date: string; total: number }>({
  title, allName, days, groups, ctx,
}: {
  title: string;
  /** The series' name while All is shown ("Refusals"). */
  allName: string;
  days: D[];
  groups: { group: string; rows: SecurityCountRow[]; order: readonly string[]; label: (k: string) => string; heading: string }[];
  ctx: Ctx;
}) {
  const [view, setView] = useState('all');
  const choices = [{ value: 'all', label: ctx.m.all }];
  for (const g of groups) {
    for (const v of viewChoices(g.rows, g.group, g.order).slice(1)) choices.push({ value: v, label: `${g.heading}: ${g.label(v.slice(g.group.length + 1))}` });
  }
  const current = choices.find((c) => c.value === view) ?? choices[0];
  return (
    <DailyChartCard
      title={title}
      dates={days.map((d) => d.date)}
      series={[{
        id: current.value,
        name: current.value === 'all' ? allName : current.label,
        color: SINGLE,
        values: days.map((d) => dayValue(d as unknown as { total: number } & Record<string, unknown>, current.value)),
      }]}
      choices={choices}
      choice={current.value}
      onChoice={setView}
      ctx={ctx}
    />
  );
}

function OverviewTab({ snapshot, ctx }: { snapshot: SecuritySnapshot; ctx: Ctx }) {
  const { m, fmt, locale } = ctx;
  const days = overviewDays(snapshot);
  const dates = days.map((d) => d.date);
  const kpiLabel: Record<string, string> = { refusals: m.refusals, failedSignIns: m.failedSignIns, lockouts: m.lockouts, spamCaught: m.spamCaught, bans: m.bans, staffSignIns: m.staffSignIns };
  const open = snapshot.server.alerts.filter((a) => a.state === 'open');
  return (
    <div className="flex flex-col gap-4">
      <Kpis items={securityKpis(snapshot).map((k) => ({ label: kpiLabel[k.key] ?? k.key, current: k.current, previous: k.previous }))} ctx={ctx} />
      <DailyChartCard
        title={m.eventsPerDay}
        dates={dates}
        legend
        series={[
          { id: 'refusals', name: m.refusals, color: OVERVIEW_COLOR.refusals, values: days.map((d) => d.refusals) },
          { id: 'failedSignIns', name: m.failedSignIns, color: OVERVIEW_COLOR.failedSignIns, values: days.map((d) => d.failedSignIns) },
          { id: 'spam', name: m.spamCaught, color: OVERVIEW_COLOR.spam, values: days.map((d) => d.spam) },
        ]}
        ctx={ctx}
      />
      <div className="grid gap-4 @4xl:grid-cols-2">
        <Card title={m.topCountries}>
          <SecurityBreakdown
            rows={shareRows(snapshot.refusals.topCountries)}
            label={(k) => countryLabel(k, locale, m.unknownCountry)}
            fmt={fmt}
            previousLabel={m.previous}
            emptyText={m.noData}
            ariaLabel={m.topCountries}
          />
        </Card>
        <Card title={m.alerts}>
          {snapshot.server.state === 'off' ? (
            <p className="text-sm text-text-secondary">{m.serverOffDescription}</p>
          ) : open.length ? (
            <AlertList alerts={sortAlerts(open)} ctx={ctx} />
          ) : (
            <p className="text-sm text-text-secondary">{m.statusOk}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function RefusalsTab({ snapshot, ctx }: { snapshot: SecuritySnapshot; ctx: Ctx }) {
  const { m, fmt, locale } = ctx;
  const r = snapshot.refusals;
  const days = fillDays(snapshot.range, r.days, emptyRefusalDay);
  const surface = (k: string) => keyLabel(m, 'surface', k);
  const reason = (k: string) => keyLabel(m, 'reason', k);
  return (
    <div className="flex flex-col gap-4">
      <BreakdownChart
        title={fillInsights(m.perDay, { metric: m.refusals })}
        allName={m.refusals}
        days={days}
        groups={[
          { group: 'bySurface', rows: r.bySurface, order: SECURITY_SURFACES, label: surface, heading: m.bySurface },
          { group: 'byReason', rows: r.byReason, order: REFUSAL_REASONS, label: reason, heading: m.byReason },
        ]}
        ctx={ctx}
      />
      <div className="grid gap-4 @4xl:grid-cols-3">
        <Card title={m.bySurface}>
          <SecurityBreakdown rows={shareRows(r.bySurface, SECURITY_SURFACES)} label={surface} fmt={fmt} previousLabel={m.previous} emptyText={m.noData} ariaLabel={m.bySurface} />
        </Card>
        <Card title={m.byReason}>
          <SecurityBreakdown rows={shareRows(r.byReason, REFUSAL_REASONS)} label={reason} fmt={fmt} previousLabel={m.previous} emptyText={m.noData} ariaLabel={m.byReason} />
        </Card>
        <Card title={m.topCountries}>
          <SecurityBreakdown rows={shareRows(r.topCountries)} label={(k) => countryLabel(k, locale, m.unknownCountry)} fmt={fmt} previousLabel={m.previous} emptyText={m.noData} ariaLabel={m.topCountries} />
        </Card>
      </div>
    </div>
  );
}

function SignInTab({ snapshot, ctx }: { snapshot: SecuritySnapshot; ctx: Ctx }) {
  const { m } = ctx;
  const s = snapshot.signIn;
  const days = fillDays(snapshot.range, s.days, emptySignInDay);
  const [metric, setMetric] = useState<SignInMetric>('failedPasswords');
  const label = (k: SignInMetric) => m[k];
  return (
    <div className="flex flex-col gap-4">
      <Kpis items={SIGN_IN_METRICS.map((k) => ({ label: label(k), current: s.totals[k], previous: s.previousTotals[k] }))} ctx={ctx} />
      <DailyChartCard
        title={fillInsights(m.perDay, { metric: label(metric) })}
        dates={days.map((d) => d.date)}
        series={[{ id: metric, name: label(metric), color: SINGLE, values: days.map((d) => d[metric]) }]}
        choices={SIGN_IN_METRICS.map((k) => ({ value: k, label: label(k) }))}
        choice={metric}
        onChoice={(v) => setMetric(v as SignInMetric)}
        ctx={ctx}
      />
    </div>
  );
}

function SpamTab({ snapshot, ctx }: { snapshot: SecuritySnapshot; ctx: Ctx }) {
  const { m, fmt } = ctx;
  const s = snapshot.spam;
  const days = fillDays(snapshot.range, s.days, emptySpamDay);
  const kind = (k: string) => keyLabel(m, 'spam', k);
  const surface = (k: string) => keyLabel(m, 'surface', k);
  return (
    <div className="flex flex-col gap-4">
      <BreakdownChart
        title={fillInsights(m.perDay, { metric: m.spamCaught })}
        allName={m.spamCaught}
        days={days}
        groups={[
          { group: 'byKind', rows: s.byKind, order: SPAM_KINDS, label: kind, heading: m.byKind },
          { group: 'bySurface', rows: s.bySurface, order: SECURITY_SURFACES, label: surface, heading: m.bySurface },
        ]}
        ctx={ctx}
      />
      <div className="grid gap-4 @4xl:grid-cols-2">
        <Card title={m.byKind}>
          <SecurityBreakdown rows={shareRows(s.byKind, SPAM_KINDS)} label={kind} fmt={fmt} previousLabel={m.previous} emptyText={m.noData} ariaLabel={m.byKind} />
        </Card>
        <Card title={m.bySurface}>
          <SecurityBreakdown rows={shareRows(s.bySurface, SECURITY_SURFACES)} label={surface} fmt={fmt} previousLabel={m.previous} emptyText={m.noData} ariaLabel={m.bySurface} />
        </Card>
      </div>
    </div>
  );
}

function AlertList({ alerts, ctx }: { alerts: SecurityAlert[]; ctx: Ctx }) {
  const { m, fmt } = ctx;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{m.alerts}</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-secondary">
            <th scope="col" className="py-2 pr-4 font-medium">{m.alertWhat}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{m.alertKind}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{m.alertOpened}</th>
            <th scope="col" className="py-2 font-medium">{m.alertResolved}</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={`${a.key}-${a.openedAt}`} className="border-b border-border last:border-0 align-top">
              <td className="py-2 pr-4 text-text-primary">{a.title || a.key}</td>
              <td className="py-2 pr-4 text-text-secondary">{keyLabel(m, 'kind', a.kind)}</td>
              <td className="py-2 pr-4 tabular-nums text-text-secondary">{fmt.dateTime(a.openedAt)}</td>
              <td className="py-2 tabular-nums">
                {a.state === 'open' || !a.resolvedAt ? (
                  <span className={cn('inline-flex items-center gap-1 font-medium', a.kind === 'integrity' ? 'text-error-fg' : 'text-warning-fg')}>{m.alertOpen}</span>
                ) : (
                  <span className="text-text-secondary">{fmt.dateTime(a.resolvedAt)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServerTab({ snapshot, ctx }: { snapshot: SecuritySnapshot; ctx: Ctx }) {
  const { m, fmt } = ctx;
  const sv = snapshot.server;
  if (sv.state === 'off') {
    return <EmptyState icon={<FontAwesomeIcon icon={faServer} aria-hidden="true" />} title={m.serverOffTitle} description={m.serverOffDescription} />;
  }
  const days = fillDays(snapshot.range, sv.bans.days, emptyBanDay);
  const jails = sv.bans.byJail.map((r) => r.key).sort();
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 @4xl:grid-cols-[2fr_1fr]">
        <BreakdownChart
          title={fillInsights(m.perDay, { metric: m.bans })}
          allName={m.bans}
          days={days}
          groups={[{ group: 'byJail', rows: sv.bans.byJail, order: jails, label: (k) => k, heading: m.byJail }]}
          ctx={ctx}
        />
        <Card title={m.byJail}>
          <SecurityBreakdown rows={shareRows(sv.bans.byJail, jails)} label={(k) => k} fmt={fmt} previousLabel={m.previous} emptyText={m.noData} ariaLabel={m.byJail} />
        </Card>
      </div>
      <Card title={m.alerts}>
        {sv.alerts.length ? <AlertList alerts={sortAlerts(sv.alerts)} ctx={ctx} /> : <p className="text-sm text-text-secondary">{m.noAlerts}</p>}
      </Card>
    </div>
  );
}

function RecentTab({ snapshot, ctx }: { snapshot: SecuritySnapshot; ctx: Ctx }) {
  const { m, fmt, locale } = ctx;
  const rows = snapshot.recent.items.map((r, i) => ({ ...r, _id: `${i}` })) as Array<SecurityRecentRefusal & { _id: string }>;
  const columns: Column<SecurityRecentRefusal & { _id: string }>[] = [
    { key: 'at', header: m.when, sortable: true, searchable: false, sortValue: (r) => r.at, render: (r) => <span className="whitespace-nowrap tabular-nums">{fmt.dateTime(r.at)}</span> },
    { key: 'surface', header: m.surface, sortable: true, searchValue: (r) => keyLabel(m, 'surface', r.surface), render: (r) => keyLabel(m, 'surface', r.surface) },
    { key: 'reason', header: m.reason, sortable: true, searchValue: (r) => keyLabel(m, 'reason', r.reason), render: (r) => keyLabel(m, 'reason', r.reason) },
    { key: 'country', header: m.country, sortable: true, searchValue: (r) => `${r.country} ${countryLabel(r.country, locale, m.unknownCountry)}`, render: (r) => countryLabel(r.country, locale, m.unknownCountry) },
    { key: 'ip', header: m.address, sortable: true, render: (r) => <code className="text-xs">{r.ip}</code> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Callout variant="info" title={null}>
        {fillInsights(m.recentNote, { keep: snapshot.recent.keep, months: snapshot.retentionMonths })}
      </Callout>
      <Card title={m.tabRecent}>
        <DataTable
          mode="paginated"
          className="overflow-x-auto"
          caption={m.tabRecent}
          columns={columns}
          rows={rows}
          rowId={(r) => r._id}
          searchable
          pageSize={10}
          searchPlaceholder={m.searchPlaceholder}
          emptyMessage={m.noRecent}
        />
      </Card>
    </div>
  );
}

/**
 * SecuritySummaryView — what a site's protections refused, blocked and noticed over a range of days: an overall status
 * line (open server alerts, icon and words), headline counts against the previous period, and a tab each for geo-IP
 * refusals (by action, reason and country), sign-in security, spam the forms caught, the server (fail2ban bans per
 * jail, file-integrity and health alerts) and the short recent-refusals list (the only part that holds IP addresses).
 * One measure per chart axis, one colour per series in fixed slots; every number is also in a table. The host builds
 * the snapshot (`SecuritySnapshot`); the view only reads it.
 */
export function SecuritySummaryView({ snapshot, locale, messages, rangeOptions, onRangeChange, defaultTab = 'overview', className }: SecuritySummaryViewProps) {
  const m = useMemo(() => ({ ...DEFAULT_SECURITY_SUMMARY_MESSAGES, ...messages }), [messages]);
  const fmt = useMemo(() => insightsFormat(locale), [locale]);
  const ctx: Ctx = { fmt, m, locale };
  const status = securityStatus(snapshot);
  const sv = snapshot.server;

  const tabs = [
    { id: 'overview', label: m.tabOverview, content: <OverviewTab snapshot={snapshot} ctx={ctx} /> },
    { id: 'refusals', label: m.tabRefusals, content: <RefusalsTab snapshot={snapshot} ctx={ctx} /> },
    { id: 'signin', label: m.tabSignIn, content: <SignInTab snapshot={snapshot} ctx={ctx} /> },
    { id: 'spam', label: m.tabSpam, content: <SpamTab snapshot={snapshot} ctx={ctx} /> },
    { id: 'server', label: m.tabServer, content: <ServerTab snapshot={snapshot} ctx={ctx} /> },
    { id: 'recent', label: m.tabRecent, content: <RecentTab snapshot={snapshot} ctx={ctx} /> },
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
        {rangeOptions && rangeOptions.length > 1 && onRangeChange && (
          <div role="group" aria-label={m.rangeLabel}>
            <ButtonGroup
              size="sm"
              value={String(snapshot.range.days)}
              onChange={(v) => onRangeChange(Number(v))}
              items={rangeOptions.map((d) => ({ value: String(d), label: fillInsights(m.rangeDays, { days: d }) }))}
            />
          </div>
        )}
      </header>
      <SecurityStatusLine
        tone={status.tone}
        text={securityStatusText(status, m)}
        label={m.statusLabel}
        detail={sv.state === 'ok' && sv.lastReportAt ? fillInsights(m.lastReport, { date: fmt.dateTime(sv.lastReportAt) }) : undefined}
      />
      <TabGroup tabs={tabs} defaultTab={defaultTab} label={m.title} lazy />
    </section>
  );
}
