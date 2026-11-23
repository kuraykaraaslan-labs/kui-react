'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleXmark, faGaugeHigh } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { ButtonGroup } from '@/modules/ui/ButtonGroup';
import { Card } from '@/modules/ui/Card';
import { EmptyState } from '@/modules/ui/EmptyState';
import { LineChart } from '@/modules/ui/Chart/charts/LineChart';
import type { Series } from '@/modules/ui/Chart/types';
import { DataTable } from '@/modules/ui/Table/DataTable';
import { Table } from '@/modules/ui/Table/Table';
import type { Column } from '@/modules/ui/Table/types';
import type { VitalFormFactor, VitalMetric, VitalRating, VitalsMetrics, VitalsSource, VitalsUrl } from '../types';
import { SINGLE_SERIES_COLOR, type InsightsFormat } from './format';
import { InsightsVitalRating, InsightsVitalTile, VITAL_RATINGS, VitalRatingIcon, type VitalRatingLabels } from './InsightsVitalTile';
import { fillInsights, type SiteInsightsMessages } from './messages';
import {
  CORE_VITALS, VITAL_ABBR, VITAL_METRICS, VITAL_THRESHOLDS, coreVitalsAssessment, hasVitals, vitalRating, vitalsFormFactors, vitalsFormat, type VitalsFormat,
} from './vitals';

type Shared = { fmt: InsightsFormat; m: SiteInsightsMessages; locale?: string };

const ratingLabels = (m: SiteInsightsMessages): VitalRatingLabels => ({ good: m.ratingGood, 'needs-improvement': m.ratingNeedsImprovement, poor: m.ratingPoor });
const formFactorLabel = (ff: VitalFormFactor, m: SiteInsightsMessages) => (ff === 'phone' ? m.phone : ff === 'desktop' ? m.desktop : m.allDevices);

/** The status legend: every rating's icon with its words (the tables and the summary print icons alone). */
function RatingLegend({ m, className }: { m: SiteInsightsMessages; className?: string }) {
  const labels = ratingLabels(m);
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary', className)} aria-label={m.ratingLegend}>
      {VITAL_RATINGS.map((r) => (
        <li key={r} className="inline-flex items-center gap-1.5"><VitalRatingIcon rating={r} className="h-3 w-3" />{labels[r]}</li>
      ))}
    </ul>
  );
}

/** A p75 with its rating icon (named for screen readers and on hover); "–" without data. */
function VitalCell({ metric, p75, vf, labels }: { metric: VitalMetric; p75: number | undefined; vf: VitalsFormat; labels: VitalRatingLabels }) {
  const rating = vitalRating(metric, p75);
  if (rating === null || p75 === undefined) return <span className="text-text-secondary">–</span>;
  return (
    <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap tabular-nums text-text-primary">
      <VitalRatingIcon rating={rating} label={labels[rating]} className="h-3 w-3" />
      {vf.value(metric, p75)}
    </span>
  );
}

function TableToggle({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group text-sm">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
        {label}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

type TileRow = Record<string, unknown> & { metric: VitalMetric; name: string; p75: string; rating: VitalRating | null; good: string; ni: string; poor: string };

/** The tiles of one form factor, plus their numbers as a table. */
function VitalTiles({ metrics, vf, m }: { metrics: VitalsMetrics | undefined; vf: VitalsFormat; m: SiteInsightsMessages }) {
  const labels = ratingLabels(m);
  const rows: TileRow[] = VITAL_METRICS.map((k) => {
    const v = metrics?.[k];
    return {
      metric: k,
      name: `${VITAL_ABBR[k]} · ${m[k]}`,
      p75: v ? vf.value(k, v.p75) : m.notEnoughData,
      rating: v ? vitalRating(k, v.p75) : null,
      good: v ? vf.share(v.good) : '–',
      ni: v ? vf.share(v.needsImprovement) : '–',
      poor: v ? vf.share(v.poor) : '–',
    };
  });
  const columns: Column<TileRow>[] = [
    { key: 'name', header: m.metric },
    { key: 'p75', header: m.p75, align: 'right', render: (r) => <span className="tabular-nums">{r.p75}</span> },
    { key: 'rating', header: m.rating, render: (r) => (r.rating ? <InsightsVitalRating rating={r.rating} label={labels[r.rating]} /> : '–') },
    { key: 'good', header: m.ratingGood, align: 'right' },
    { key: 'ni', header: m.ratingNeedsImprovement, align: 'right' },
    { key: 'poor', header: m.ratingPoor, align: 'right' },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @5xl:grid-cols-5">
        {VITAL_METRICS.map((k) => {
          const v = metrics?.[k];
          return (
            <InsightsVitalTile
              key={k}
              abbr={VITAL_ABBR[k]}
              name={m[k]}
              value={v ? vf.value(k, v.p75) : undefined}
              rating={v ? vitalRating(k, v.p75) : null}
              shares={v}
              labels={labels}
              formatShare={vf.share}
              caption={m.p75}
              coreLabel={CORE_VITALS.includes(k) ? m.coreVital : undefined}
              notEnoughData={m.notEnoughData}
            />
          );
        })}
      </div>
      <TableToggle label={m.showTable}>
        <Table<TileRow> columns={columns} rows={rows} caption={m.vitalsTitle} />
      </TableToggle>
    </div>
  );
}

/** The assessment of one form factor as a pill: passed / failed / not enough data (icon + words). */
function AssessmentPill({ metrics, m }: { metrics: VitalsMetrics | undefined; m: SiteInsightsMessages }) {
  const a = coreVitalsAssessment(metrics);
  if (a === null) return <span className="text-xs text-text-secondary">{m.notEnoughData}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', a === 'passed' ? 'bg-success-subtle text-success-fg' : 'bg-error-subtle text-error-fg')}>
      <FontAwesomeIcon icon={a === 'passed' ? faCircleCheck : faCircleXmark} className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">{m.assessment}: </span>
      {a === 'passed' ? m.assessmentPassed : m.assessmentFailed}
    </span>
  );
}

/** The origin's p75 of one metric over the weekly collection periods, with the good and poor thresholds. */
function VitalsHistoryChart({ source, ff, vf, fmt, m, locale }: { source: VitalsSource; ff: VitalFormFactor; vf: VitalsFormat } & Shared) {
  const [metric, setMetric] = useState<VitalMetric>('lcp');
  const rows = source.history?.[ff] ?? [];
  const labels = ratingLabels(m);
  const [good, poor] = VITAL_THRESHOLDS[metric];
  const title = fillInsights(m.vitalsHistory, { metric: VITAL_ABBR[metric] });
  // An axis tick of 0 is a plain number ("0", not "0 ms").
  const yFmt = (v: number) => (v === 0 ? '0' : vf.value(metric, v));
  const series: Series[] = [{
    id: metric,
    name: `${VITAL_ABBR[metric]} · ${m.p75}`,
    color: SINGLE_SERIES_COLOR,
    data: rows.map((r) => ({ x: r.end, y: typeof r[metric] === 'number' ? (r[metric] as number) : null })),
  }];
  const hasPoints = rows.some((r) => typeof r[metric] === 'number');
  type HistRow = Record<string, unknown> & { end: string; value: number | null };
  const tableRows: HistRow[] = rows.map((r) => ({ end: r.end, value: typeof r[metric] === 'number' ? (r[metric] as number) : null }));
  return (
    <Card
      title={title}
      headerRight={
        <div aria-label={m.chooseMetric} role="group">
          <ButtonGroup size="xs" value={metric} onChange={(v) => setMetric(v as VitalMetric)} items={VITAL_METRICS.map((k) => ({ value: k, label: VITAL_ABBR[k] }))} />
        </div>
      }
    >
      {hasPoints ? (
        <div className="flex flex-col gap-3">
          <LineChart
            curve="linear"
            series={series}
            xAxis="time"
            zoom={false}
            locale={locale}
            height={260}
            showLegend={false}
            yFormat={yFmt}
            yMin={0}
            thresholds={[
              { value: good, label: fillInsights(m.goodUpTo, { value: yFmt(good) }), color: 'var(--success)', style: 'dashed' },
              { value: poor, label: fillInsights(m.poorOver, { value: yFmt(poor) }), color: 'var(--error)', style: 'dashed' },
            ]}
            ariaLabel={title}
          />
          <TableToggle label={m.showTable}>
            <Table<HistRow>
              caption={title}
              rows={tableRows}
              columns={[
                { key: 'end', header: m.periodEnd, render: (r) => <span className="tabular-nums">{fmt.date(r.end)}</span> },
                { key: 'value', header: m.p75, align: 'right', render: (r) => <VitalCell metric={metric} p75={r.value ?? undefined} vf={vf} labels={labels} /> },
              ]}
            />
          </TableToggle>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-text-secondary">{m.vitalsHistoryEmpty}</p>
      )}
    </Card>
  );
}

type UrlRow = VitalsUrl & Record<string, unknown>;

/** The top pages with each metric's p75 and rating for one form factor; a page without data says so. */
function VitalsUrlTable({ urls, ff, vf, m }: { urls: VitalsUrl[]; ff: VitalFormFactor; vf: VitalsFormat; m: SiteInsightsMessages }) {
  const labels = ratingLabels(m);
  const columns: Column<UrlRow>[] = [
    {
      key: 'key',
      header: m.page,
      tdClass: 'min-w-[12rem]',
      sortable: true,
      searchValue: (r) => r.key,
      render: (r) => (
        <span className="flex flex-col">
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="break-words rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            {r.key}
          </a>
          {!hasVitals(r.vitals?.[ff]) && <span className="text-xs text-text-secondary">{m.notEnoughData}</span>}
        </span>
      ),
    },
    ...VITAL_METRICS.map((k): Column<UrlRow> => ({
      key: k,
      header: <abbr title={m[k]} className="no-underline">{VITAL_ABBR[k]}</abbr>,
      align: 'right',
      sortable: true,
      searchable: false,
      // Pages without data sort last in both directions.
      sortValue: (r) => r.vitals?.[ff]?.[k]?.p75 ?? null,
      render: (r) => <VitalCell metric={k} p75={r.vitals?.[ff]?.[k]?.p75} vf={vf} labels={labels} />,
    })),
  ];
  return (
    <div className="flex flex-col gap-3">
      <RatingLegend m={m} />
      <DataTable<UrlRow>
        mode="paginated"
        className="overflow-x-auto"
        caption={m.vitalsPages}
        columns={columns}
        rows={urls as UrlRow[]}
        rowId={(r) => r.url}
        searchable
        pageSize={10}
        searchPlaceholder={m.searchPlaceholder}
        emptyMessage={m.noData}
      />
    </div>
  );
}

/**
 * InsightsVitalsTab — the Core Web Vitals tab of SiteInsightsView: a device switch, a tile per metric (p75, rating,
 * distribution), the origin's p75 history of one metric with the good and poor thresholds, and the top pages.
 */
export function InsightsVitalsTab({ source, fmt, m, locale }: { source: VitalsSource } & Shared) {
  const formFactors = vitalsFormFactors(source);
  const [chosen, setChosen] = useState<VitalFormFactor | null>(null);
  const ff = chosen && formFactors.includes(chosen) ? chosen : formFactors[0];
  const vf = vitalsFormat(locale);
  if (!ff) {
    return <EmptyState icon={<FontAwesomeIcon icon={faGaugeHigh} aria-hidden="true" />} title={m.notEnoughData} description={m.vitalsNoData} />;
  }
  const metrics = source.originVitals?.[ff];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {source.range && (
            <p className="text-sm text-text-secondary">{fillInsights(m.vitalsPeriod, { start: fmt.date(source.range.start), end: fmt.date(source.range.end) })}</p>
          )}
          {source.origin && <p className="break-all text-xs text-text-secondary">{source.origin}</p>}
        </div>
        {formFactors.length > 1 && (
          <div role="group" aria-label={m.formFactor}>
            <ButtonGroup size="sm" value={ff} onChange={(v) => setChosen(v as VitalFormFactor)} items={formFactors.map((f) => ({ value: f, label: formFactorLabel(f, m) }))} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-text-primary">{m.assessment}</span>
        <AssessmentPill metrics={metrics} m={m} />
      </div>
      <VitalTiles metrics={metrics} vf={vf} m={m} />
      <VitalsHistoryChart key={ff} source={source} ff={ff} vf={vf} fmt={fmt} m={m} locale={locale} />
      <Card title={m.vitalsPages}>
        <VitalsUrlTable urls={source.urls ?? []} ff={ff} vf={vf} m={m} />
      </Card>
    </div>
  );
}

/**
 * InsightsVitalsSummary — the Overview's Core Web Vitals line per device: the assessment and the three Core Web
 * Vitals' p75 with their rating icons (the legend names the icons).
 */
export function InsightsVitalsSummary({ source, m, locale }: { source: VitalsSource; m: SiteInsightsMessages; locale?: string }) {
  const vf = vitalsFormat(locale);
  const labels = ratingLabels(m);
  const rows = vitalsFormFactors(source).filter((ff) => hasVitals(source.originVitals?.[ff]));
  if (!rows.length) return null;
  return (
    <Card title={source.label || m.vitalsTitle}>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((ff) => {
          const metrics = source.originVitals?.[ff];
          return (
            <li key={ff} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2 first:pt-0 last:pb-0">
              <span className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-text-primary">{formFactorLabel(ff, m)}</span>
                <span className="w-28"><AssessmentPill metrics={metrics} m={m} /></span>
              </span>
              <span className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {CORE_VITALS.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <abbr title={m[k]} className="text-xs font-medium text-text-secondary no-underline">{VITAL_ABBR[k]}</abbr>
                    <VitalCell metric={k} p75={metrics?.[k]?.p75} vf={vf} labels={labels} />
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      <RatingLegend m={m} className="mt-3 border-t border-border pt-3" />
    </Card>
  );
}
