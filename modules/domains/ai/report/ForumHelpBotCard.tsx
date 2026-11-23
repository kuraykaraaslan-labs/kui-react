'use client';
import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan,
  faCircleCheck,
  faCircleMinus,
  faCircleQuestion,
  faClock,
  faFolderOpen,
  faStar,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Callout } from '@/modules/ui/Callout';
import { Card } from '@/modules/ui/Card';
import { InsightsKpiTile } from '@/modules/domains/analytics/insights/InsightsKpiTile';
import { insightsDelta } from '@/modules/domains/analytics/insights/combineInsights';
import type { ForumBotReport, ForumBotStatus } from './types';
import { FORUM_BOT_STATUSES } from './types';
import { chatbotFormat, type ChatbotFormat } from './format';
import { DEFAULT_CHATBOT_REPORT_MESSAGES, FORUM_STATUS_LABEL_KEY, type ChatbotReportMessages } from './messages';

/** Each status's icon and tone: answered is good, errors are an error, the silent ones neutral or a warning. */
export const FORUM_STATUS_LOOK: Record<ForumBotStatus, { icon: typeof faCircleCheck; classes: string }> = {
  answered: { icon: faCircleCheck, classes: 'bg-success-subtle text-success-fg' },
  noSources: { icon: faFolderOpen, classes: 'bg-surface-sunken text-[color-mix(in_srgb,var(--text-secondary)_60%,var(--text-primary))]' },
  notAnswerable: { icon: faCircleQuestion, classes: 'bg-warning-subtle text-warning-fg' },
  stopped: { icon: faBan, classes: 'bg-warning-subtle text-warning-fg' },
  errors: { icon: faTriangleExclamation, classes: 'bg-error-subtle text-error-fg' },
  skipped: { icon: faCircleMinus, classes: 'bg-surface-sunken text-[color-mix(in_srgb,var(--text-secondary)_60%,var(--text-primary))]' },
  pending: { icon: faClock, classes: 'bg-info-subtle text-info-fg' },
};

type ForumHelpBotCardProps = {
  report: ForumBotReport;
  fmt?: ChatbotFormat;
  locale?: string;
  messages?: Partial<ChatbotReportMessages>;
  className?: string;
};

/** A forum topic status as an icon and words. */
export function ForumBotStatusBadge({ status, label, className }: { status: ForumBotStatus; label: string; className?: string }) {
  const look = FORUM_STATUS_LOOK[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', look.classes, className)}>
      <FontAwesomeIcon icon={look.icon} className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * ForumHelpBotCard — the forum help bot in a period: how many new topics it looked at and what it did with each
 * (answered, no sources, not answerable, stopped, errors, skipped, waiting), against the previous period, how many
 * of its replies were accepted as the solution, and the latest topics with their status.
 */
export function ForumHelpBotCard({ report, fmt: fmtProp, locale, messages, className }: ForumHelpBotCardProps) {
  const m = useMemo(() => ({ ...DEFAULT_CHATBOT_REPORT_MESSAGES, ...messages }), [messages]);
  const fmt = useMemo(() => fmtProp ?? chatbotFormat(locale), [fmtProp, locale]);
  const t = report.totals;
  const p = report.previousTotals;
  const tile = (key: 'topics' | ForumBotStatus | 'accepted', label: string, lowerIsBetter = false) => {
    const delta = insightsDelta(t[key] ?? 0, p?.[key], lowerIsBetter);
    return (
      <InsightsKpiTile
        key={key}
        label={label}
        value={fmt.int(t[key] ?? 0)}
        delta={delta}
        deltaText={delta ? fmt.signedPercent(delta.change) : undefined}
        caption={delta ? m.vsPrevious : m.noPrevious}
      />
    );
  };
  const shown = FORUM_BOT_STATUSES.filter((s) => s !== 'pending' || t.pending > 0);
  return (
    <Card title={m.forumBot} subtitle={m.forumBotIntro} className={cn('min-w-0', className)}>
      <div className="@container flex flex-col gap-4">
        {report.state === 'off' && <Callout variant="info" title={null}>{m.forumBotOff}</Callout>}
        <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
          {tile('topics', m.forumBotTopics)}
          {tile('answered', m.forumAnswered)}
          {tile('accepted', m.forumBotAcceptedShort)}
          {tile('errors', m.forumErrors, true)}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label={m.status}>
          {shown.map((s) => (
            <li key={s} className="inline-flex items-center gap-2">
              <ForumBotStatusBadge status={s} label={m[FORUM_STATUS_LABEL_KEY[s]]} />
              <span className="tabular-nums font-medium text-text-primary">{fmt.int(t[s] ?? 0)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{m.forumBotRecent}</h3>
          {report.recent.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {report.recent.map((topic) => (
                <li key={topic.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
                  <span className="flex min-w-0 flex-col">
                    {topic.url ? (
                      <a href={topic.url} target="_blank" rel="noopener noreferrer" className="truncate rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                        {topic.title}<span className="sr-only"> {m.opensInNewTab}</span>
                      </a>
                    ) : (
                      <span className="truncate text-text-primary">{topic.title}</span>
                    )}
                    <span className="text-xs text-text-secondary">
                      {fmt.dateTime(topic.at)}{topic.detail ? ` · ${topic.detail}` : ''}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    {topic.accepted && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success-fg">
                        <FontAwesomeIcon icon={faStar} className="h-3 w-3" aria-hidden="true" />
                        {m.forumBotAccepted}
                      </span>
                    )}
                    <ForumBotStatusBadge status={topic.status} label={m[FORUM_STATUS_LABEL_KEY[topic.status]]} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">{m.noData}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
