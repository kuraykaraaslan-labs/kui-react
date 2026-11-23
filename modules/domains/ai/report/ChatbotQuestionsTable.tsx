'use client';
import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare, faMagnifyingGlass, faUser, faUserSecret } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import type { ChatbotQuestion } from './types';
import { CHATBOT_OUTCOMES } from './types';
import { questionSearchText } from './chatbotReport';
import { chatbotFormat, type ChatbotFormat } from './format';
import { ChatbotOutcomeBadge } from './ChatbotOutcomeBadge';
import { DEFAULT_CHATBOT_REPORT_MESSAGES, OUTCOME_LABEL_KEY, fillChatbot, type ChatbotReportMessages } from './messages';

/** The outcome filter's extra choice: every question the assistant said it could not answer, whatever came next. */
export const COULD_NOT_ANSWER_FILTER = 'could-not-answer';

type ChatbotQuestionsTableProps = {
  questions: ChatbotQuestion[];
  /** Number and date formats; default `chatbotFormat(locale)`. */
  fmt?: ChatbotFormat;
  locale?: string;
  messages?: Partial<ChatbotReportMessages>;
  /** Links sources and page paths when given (e.g. "https://example.com"). */
  siteUrl?: string;
  /** An outcome (or `COULD_NOT_ANSWER_FILTER`) to start filtered on. */
  defaultOutcome?: string;
  pageSize?: number;
  className?: string;
};

const linkClass = 'rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

function Detail({ q, fmt, m, siteUrl }: { q: ChatbotQuestion; fmt: ChatbotFormat; m: ChatbotReportMessages; siteUrl?: string }) {
  const base = siteUrl?.replace(/\/$/, '');
  return (
    <div className="grid gap-4 py-1 text-sm @3xl:grid-cols-[3fr_2fr]">
      <div className="flex min-w-0 flex-col gap-3">
        <p className="whitespace-pre-wrap break-words text-text-primary">{q.text}</p>
        {q.answered !== null && <p className="text-text-secondary">{q.answered ? m.answeredYes : m.answeredNo}</p>}
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{m.sources}</h4>
          {q.sources.length ? (
            <ul className="flex flex-col gap-1">
              {q.sources.map((s) => (
                <li key={s.url} className="min-w-0">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className={cn(linkClass, 'inline-flex items-center gap-1.5 break-words')}>
                    {s.title || s.url}
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="sr-only">{m.opensInNewTab}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary">{m.noSources}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{m.searches}</h4>
          {q.searches.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {q.searches.map((s, i) => (
                <li key={`${s}-${i}`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-base px-2 py-0.5 text-xs text-text-primary">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3 w-3 text-text-secondary" aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary">{m.noSearches}</p>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-text-secondary">{m.askedAt}</dt>
        <dd className="tabular-nums text-text-primary">{fmt.dateTime(q.at)}</dd>
        <dt className="text-text-secondary">{m.page}</dt>
        <dd className="min-w-0 break-words text-text-primary">
          {q.page && base ? <a href={`${base}${q.page}`} target="_blank" rel="noopener noreferrer" className={linkClass}>{q.page}<span className="sr-only"> {m.opensInNewTab}</span></a> : q.page || '–'}
        </dd>
        <dt className="text-text-secondary">{m.conversation}</dt>
        <dd className="min-w-0 break-all text-text-primary">
          <span className="font-mono">{q.conversation.slice(0, 10)}</span> · {fillChatbot(m.turn, { turn: q.turn })}
        </dd>
        <dt className="text-text-secondary">{m.language}</dt>
        <dd className="uppercase text-text-primary">{q.lang || '–'}</dd>
        <dt className="text-text-secondary">{m.model}</dt>
        <dd className="min-w-0 break-words text-text-primary">{q.model || '–'}</dd>
        <dt className="text-text-secondary">{m.tokens}</dt>
        <dd className="tabular-nums text-text-primary">{fillChatbot(m.tokensLine, { in: fmt.int(q.tokensIn), out: fmt.int(q.tokensOut) })}</dd>
        <dt className="text-text-secondary">{m.cost}</dt>
        <dd className="tabular-nums text-text-primary">{q.cost === null ? m.costUnknownOne : fmt.money(q.cost)}</dd>
        <dt className="sr-only">{m.signedIn}</dt>
        <dd className="col-span-2 inline-flex items-center gap-1.5 text-text-secondary">
          <FontAwesomeIcon icon={q.signedIn ? faUser : faUserSecret} className="h-3 w-3" aria-hidden="true" />
          {q.signedIn ? m.signedIn : m.anonymous}
        </dd>
      </dl>
    </div>
  );
}

/**
 * ChatbotQuestionsTable — the visitors' questions to the AI chat, newest first: searchable (text, page, language,
 * search terms, source titles), filtered by outcome or "could not answer", 10 a page. A row opens to show whether
 * the assistant answered, the sources shown, what it searched for, the page, the conversation, model, tokens and cost.
 */
export function ChatbotQuestionsTable({ questions, fmt: fmtProp, locale, messages, siteUrl, defaultOutcome, pageSize = 10, className }: ChatbotQuestionsTableProps) {
  const m = useMemo(() => ({ ...DEFAULT_CHATBOT_REPORT_MESSAGES, ...messages }), [messages]);
  const fmt = useMemo(() => fmtProp ?? chatbotFormat(locale), [fmtProp, locale]);
  const rows = useMemo(() => [...questions].sort((a, b) => b.at.localeCompare(a.at)), [questions]);

  const columns: Column<ChatbotQuestion>[] = [
    {
      key: 'at',
      header: m.askedAt,
      sortable: true,
      searchable: false,
      sortValue: (q) => q.at,
      tdClass: 'whitespace-nowrap',
      hideBelow: 'md',
      render: (q) => <span className="tabular-nums text-text-secondary">{fmt.dateTime(q.at)}</span>,
    },
    {
      key: 'text',
      header: m.question,
      tdClass: 'min-w-[12rem]',
      searchValue: questionSearchText,
      render: (q) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 break-words text-text-primary">{q.text}</span>
          {q.page && <span className="truncate text-xs text-text-secondary">{q.page}</span>}
          {/* On a phone the date column is hidden: the date goes under the question. */}
          <span className="text-xs tabular-nums text-text-secondary md:hidden">{fmt.dateTime(q.at)}</span>
        </span>
      ),
    },
    {
      key: 'lang',
      header: m.language,
      sortable: true,
      searchable: false,
      hideBelow: 'md',
      render: (q) => <span className="uppercase text-text-secondary">{q.lang || '–'}</span>,
    },
    {
      key: 'outcome',
      header: m.outcome,
      sortable: true,
      searchable: false,
      sortValue: (q) => CHATBOT_OUTCOMES.indexOf(q.outcome),
      render: (q) => <ChatbotOutcomeBadge outcome={q.outcome} label={m[OUTCOME_LABEL_KEY[q.outcome]]} size="sm" />,
    },
  ];

  const filterFields: DataTableFilterField<ChatbotQuestion>[] = [
    {
      id: 'outcome',
      label: m.outcome,
      type: 'select',
      placement: 'toolbar',
      placeholder: m.allOutcomes,
      defaultValue: defaultOutcome,
      options: [
        { value: COULD_NOT_ANSWER_FILTER, label: m.couldNotAnswer },
        ...CHATBOT_OUTCOMES.map((o) => ({ value: o, label: m[OUTCOME_LABEL_KEY[o]] })),
      ],
      match: (q, v) => (!v ? true : v === COULD_NOT_ANSWER_FILTER ? q.answered === false : q.outcome === v),
    },
  ];

  return (
    <div className={cn('@container min-w-0', className)}>
      <DataTable<ChatbotQuestion>
        mode="paginated"
        className="overflow-x-auto"
        caption={m.questionsTitle}
        columns={columns}
        rows={rows}
        rowId={(q) => q.id}
        searchable
        searchPlaceholder={m.searchPlaceholder}
        filterFields={filterFields}
        pageSize={pageSize}
        emptyMessage={m.noData}
        renderExpanded={(q) => <Detail q={q} fmt={fmt} m={m} siteUrl={siteUrl} />}
      />
    </div>
  );
}
