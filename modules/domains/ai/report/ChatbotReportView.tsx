'use client';
import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { ButtonGroup } from '@/modules/ui/ButtonGroup';
import { Callout } from '@/modules/ui/Callout';
import { Card } from '@/modules/ui/Card';
import { EmptyState } from '@/modules/ui/EmptyState';
import { LineChart } from '@/modules/ui/Chart/charts/LineChart';
import type { Series } from '@/modules/ui/Chart/types';
import { InsightsKpiTile } from '@/modules/domains/analytics/insights/InsightsKpiTile';
import { insightsDelta } from '@/modules/domains/analytics/insights/combineInsights';
import type { ChatbotKeyCount, ChatbotReport } from './types';
import {
  CHATBOT_OUTCOME_GROUPS,
  OUTCOME_GROUP_COLOR,
  chatbotKpis,
  couldNotAnswer,
  hasPrevious,
  outcomeRows,
  share,
  trendPoints,
  type ChatbotKpis,
} from './chatbotReport';
import { chatbotFormat, type ChatbotFormat } from './format';
import { ChatbotOutcomeBadge } from './ChatbotOutcomeBadge';
import { ChatbotQuestionsTable } from './ChatbotQuestionsTable';
import { ForumHelpBotCard } from './ForumHelpBotCard';
import { DEFAULT_CHATBOT_REPORT_MESSAGES, GROUP_LABEL_KEY, OUTCOME_LABEL_KEY, fillChatbot, type ChatbotReportMessages } from './messages';

type ChatbotReportViewProps = {
  /** The report the host built (`ChatbotReportSchema`). */
  report: ChatbotReport;
  /** Number and date formats (BCP 47). Default = the browser's. */
  locale?: string;
  /** Any subset of the view's words. */
  messages?: Partial<ChatbotReportMessages>;
  /** The site's address, to link page paths (e.g. "https://example.com"). */
  siteUrl?: string;
  /** Period choices in days (e.g. [7, 30, 90]); shown with `onRangeChange`. */
  rangeOptions?: number[];
  onRangeChange?: (days: number) => void;
  /** How many "could not answer" questions the card lists before pointing to the table. */
  unansweredLimit?: number;
  className?: string;
};

type Kpi = { key: keyof ChatbotKpis; label: string; value: string; caption?: string; lowerIsBetter?: boolean; neutral?: boolean };

function KpiRow({ items, current, previous, fmt, m }: { items: Kpi[]; current: ChatbotKpis; previous: ChatbotKpis | null; fmt: ChatbotFormat; m: ChatbotReportMessages }) {
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4 @6xl:grid-cols-8">
      {items.map((k) => {
        const raw = previous ? insightsDelta(current[k.key], previous[k.key], k.lowerIsBetter) : null;
        // A cost is neither good nor bad by itself: its change is shown without a verdict.
        const delta = raw && k.neutral ? { change: raw.change, good: null } : raw;
        return (
          <InsightsKpiTile
              key={k.key}
              label={k.label}
              value={k.value}
              delta={delta}
              deltaText={delta ? fmt.signedPercent(delta.change) : undefined}
              caption={delta ? m.vsPrevious : m.noPrevious}
              hint={delta && k.lowerIsBetter ? m.lowerIsBetter : undefined}
              title={k.caption}
            />
        );
      })}
    </div>
  );
}

/** A ranked list with a bar per row (languages, pages, search terms): the numbers are text, the bars only help. */
function CountBars({ rows, total, fmt, m, color, link, upper, limit = 10 }: {
  rows: ChatbotKeyCount[]; total: number; fmt: ChatbotFormat; m: ChatbotReportMessages; color: string; link?: string; upper?: boolean; limit?: number;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-text-secondary">{m.noData}</p>;
  const base = link?.replace(/\/$/, '');
  return (
    <ul className="flex flex-col gap-3">
      {rows.slice(0, limit).map((r) => {
        const s = share(r.count, total);
        return (
          <li key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {base ? (
                <a href={`${base}${r.key}`} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                  {r.key}<span className="sr-only"> {m.opensInNewTab}</span>
                </a>
              ) : (
                <span className={cn('min-w-0 truncate text-text-primary', upper && 'uppercase')}>{r.key}</span>
              )}
              <span className="shrink-0 tabular-nums text-text-secondary">{fmt.int(r.count)} · {fmt.percent(s)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-sunken" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${Math.max(s * 100, s > 0 ? 2 : 0)}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * ChatbotReportView — how a site's AI chat assistant is used and what it could and could not answer: KPIs against
 * the previous period (conversations, questions, answered from pages, handed on, could not answer, declined or held
 * back, errors, estimated cost), how questions ended, questions per day in three groups (answered, handed on, not
 * answered), languages, the pages chats start on, what the assistant searched for, the questions it could not
 * answer, every stored question (searchable, filterable, with its sources) and the forum help bot. Questions are kept
 * `retentionDays` (30), daily counts 13 months; the view says so. The host builds `ChatbotReport`; this view only
 * reads it.
 */
export function ChatbotReportView({ report, locale, messages, siteUrl, rangeOptions, onRangeChange, unansweredLimit = 8, className }: ChatbotReportViewProps) {
  const m = useMemo(() => ({ ...DEFAULT_CHATBOT_REPORT_MESSAGES, ...messages }), [messages]);
  const fmt = useMemo(() => chatbotFormat(locale, report.currency), [locale, report.currency]);
  const cur = chatbotKpis(report.totals);
  const prev = hasPrevious(report.previousTotals) ? chatbotKpis(report.previousTotals) : null;
  const o = report.totals.outcomes;
  const points = useMemo(() => trendPoints(report.days), [report.days]);
  const unanswered = useMemo(() => couldNotAnswer(report.questions), [report.questions]);
  const empty = report.totals.questions === 0 && report.questionsTotal === 0;

  const kpis: Kpi[] = [
    { key: 'conversations', label: m.conversations, value: fmt.int(cur.conversations) },
    { key: 'questions', label: m.questions, value: fmt.int(cur.questions) },
    { key: 'sourcedRate', label: m.sourcedRate, value: fmt.percent(cur.sourcedRate) },
    {
      key: 'handoffs',
      label: m.handoffs,
      value: fmt.int(cur.handoffs),
      caption: fillChatbot(m.handoffsDetail, { forum: fmt.int(o.forum), quote: fmt.int(o.quote), contact: fmt.int(o.contact) }),
    },
    { key: 'couldNotAnswer', label: m.couldNotAnswer, value: fmt.int(cur.couldNotAnswer), lowerIsBetter: true },
    { key: 'refusedBlocked', label: m.refusedBlocked, value: fmt.int(cur.refusedBlocked), lowerIsBetter: true },
    { key: 'errors', label: m.errors, value: fmt.int(cur.errors), lowerIsBetter: true },
    { key: 'cost', label: m.cost, value: fmt.money(cur.cost), neutral: true },
  ];

  const series: Series[] = CHATBOT_OUTCOME_GROUPS.map((g) => ({
    id: g,
    name: m[GROUP_LABEL_KEY[g]],
    color: OUTCOME_GROUP_COLOR[g],
    data: points.map((p) => ({ x: p.date, y: p[g] })),
  }));
  const rows = outcomeRows(o);
  const langTotal = report.languages.reduce((s, r) => s + r.count, 0);
  const pageTotal = report.pages.reduce((s, r) => s + r.count, 0);
  const termTotal = report.searchTerms.reduce((s, r) => s + r.count, 0);

  return (
    <section className={cn('@container flex w-full min-w-0 flex-col gap-4', className)} aria-label={m.title}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-bold text-text-primary">{m.title}</h2>
          <p className="text-sm text-text-secondary">
            {fillChatbot(m.rangeLine, { start: fmt.date(report.range.start), end: fmt.date(report.range.end), days: report.range.days })}
          </p>
          <p className="text-xs text-text-secondary">
            {report.generatedAt ? fillChatbot(m.updated, { date: fmt.dateTime(report.generatedAt) }) : m.neverUpdated}
            {report.model && <> · {fillChatbot(m.modelLine, { model: report.model })}</>}
          </p>
        </div>
        {onRangeChange && rangeOptions && rangeOptions.length > 1 && (
          <div role="group" aria-label={m.rangeLabel}>
            <ButtonGroup
              size="sm"
              value={String(report.range.days)}
              onChange={(v) => onRangeChange(Number(v))}
              items={rangeOptions.map((d) => ({ value: String(d), label: fillChatbot(m.rangeDays, { days: d }) }))}
            />
          </div>
        )}
      </header>

      <Callout variant="info" title={null}>
        <span className="block">{fillChatbot(m.retention, { days: report.retentionDays })}</span>
        {report.listsRange.days < report.range.days && <span className="block">{fillChatbot(m.listsShorter, { days: report.listsRange.days })}</span>}
      </Callout>

      {empty ? (
        <EmptyState icon={<FontAwesomeIcon icon={faComments} aria-hidden="true" />} title={m.emptyTitle} description={m.emptyDescription} />
      ) : (
        <>
          <KpiRow items={kpis} current={cur} previous={prev} fmt={fmt} m={m} />
          {report.totals.costUnknown > 0 && (
            <p className="text-xs text-text-secondary">{fillChatbot(m.costUnknown, { count: fmt.int(report.totals.costUnknown) })}</p>
          )}

          <div className="grid gap-4 @4xl:grid-cols-[3fr_2fr]">
            <Card title={m.trend} className="min-w-0">
              {points.length ? (
                <LineChart curve="linear" series={series} xAxis="time" locale={locale} height={260} showLegend legendValues={['total']} yFormat={fmt.int} ariaLabel={m.trend} />
              ) : (
                <p className="py-8 text-center text-sm text-text-secondary">{m.noData}</p>
              )}
            </Card>
            <Card title={m.outcomes} className="min-w-0">
              <ul className="flex flex-col gap-3">
                {rows.map((r) => (
                  <li key={r.outcome} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <ChatbotOutcomeBadge outcome={r.outcome} label={m[OUTCOME_LABEL_KEY[r.outcome]]} size="sm" />
                      <span className="shrink-0 tabular-nums text-text-secondary">
                        <span className="font-medium text-text-primary">{fmt.int(r.count)}</span> · {fmt.percent(r.share)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-sunken" aria-hidden="true">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(r.share * 100, r.share > 0 ? 2 : 0)}%`, background: OUTCOME_GROUP_COLOR[r.group] }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 @4xl:grid-cols-2 @7xl:grid-cols-3">
            <Card title={m.languages} className="min-w-0"><CountBars rows={report.languages} total={langTotal} fmt={fmt} m={m} color={OUTCOME_GROUP_COLOR.answered} upper /></Card>
            <Card title={m.pages} className="min-w-0"><CountBars rows={report.pages} total={pageTotal} fmt={fmt} m={m} color={OUTCOME_GROUP_COLOR.answered} link={siteUrl} /></Card>
            <Card title={m.searchTerms} className="min-w-0 @4xl:col-span-2 @7xl:col-span-1"><CountBars rows={report.searchTerms} total={termTotal} fmt={fmt} m={m} color={OUTCOME_GROUP_COLOR.answered} /></Card>
          </div>

          <Card title={m.unansweredTitle} className="min-w-0">
            {unanswered.length ? (
              <div className="flex flex-col gap-3">
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {unanswered.slice(0, unansweredLimit).map((q) => (
                    <li key={q.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-3 py-2.5">
                      <span className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                        <span className="break-words text-sm text-text-primary">{q.text}</span>
                        <span className="text-xs text-text-secondary">
                          {fmt.dateTime(q.at)}{q.lang ? <> · <span className="uppercase">{q.lang}</span></> : null}{q.page ? ` · ${q.page}` : ''}
                        </span>
                      </span>
                      <ChatbotOutcomeBadge outcome={q.outcome} label={m[OUTCOME_LABEL_KEY[q.outcome]]} size="sm" />
                    </li>
                  ))}
                </ul>
                {unanswered.length > unansweredLimit && (
                  <p className="text-xs text-text-secondary">{fillChatbot(m.unansweredMore, { count: fmt.int(unanswered.length - unansweredLimit) })}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">{m.unansweredNone}</p>
            )}
          </Card>

          <Card title={m.questionsTitle} className="min-w-0">
            <div className="flex flex-col gap-3">
              {report.questionsTotal > report.questions.length && (
                <p className="text-xs text-text-secondary">{fillChatbot(m.questionsShown, { shown: fmt.int(report.questions.length), total: fmt.int(report.questionsTotal) })}</p>
              )}
              <ChatbotQuestionsTable questions={report.questions} fmt={fmt} messages={m} siteUrl={siteUrl} />
            </div>
          </Card>
        </>
      )}

      {report.forumBot && <ForumHelpBotCard report={report.forumBot} fmt={fmt} messages={m} />}
    </section>
  );
}
