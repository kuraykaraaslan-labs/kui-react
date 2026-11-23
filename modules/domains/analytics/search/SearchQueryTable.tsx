'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import type { SiteSearchQueryRow } from '../types';
import { insightsFormat, type InsightsFormat } from '../insights/format';
import { DEFAULT_SEARCH_REPORT_MESSAGES, type SearchReportMessages } from './messages';
import { searchLanguageName } from './searchReport';

type SearchQueryTableProps = {
  /** `top`: every column (searches, nothing found, clicks, CTR); `zero`: the searches that found nothing (searches only). */
  kind?: 'top' | 'zero';
  rows: SiteSearchQueryRow[];
  /** Number, date and language-name formats (BCP 47). Default = the browser's. */
  locale?: string;
  /** Any subset of the report's words. */
  messages?: Partial<SearchReportMessages>;
  /** Rows a page. Default 10. */
  pageSize?: number;
  className?: string;
};

const num = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The "nothing found" state of a query: icon and words, never colour alone. */
function NothingFound({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-fg">
      <FontAwesomeIcon icon={faCircleExclamation} className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * SearchQueryTable — what visitors typed into the site search: sortable, searchable, 10 rows a page. The top list shows
 * how often each query found nothing and how often a result was opened; a query that never found anything carries a
 * "nothing found" tag. The zero-result list keeps only what matters for it: how often, in which language, and when last.
 */
export function SearchQueryTable({ kind = 'top', rows, locale, messages, pageSize = 10, className }: SearchQueryTableProps) {
  const m = { ...DEFAULT_SEARCH_REPORT_MESSAGES, ...messages };
  const fmt: InsightsFormat = insightsFormat(locale);
  const columns: Column<SiteSearchQueryRow>[] = [
    {
      key: 'key',
      header: m.query,
      tdClass: 'min-w-[12rem]',
      sortable: true,
      searchValue: (r) => r.key,
      render: (r) => (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-words text-text-primary">{r.key}</span>
          {kind === 'top' && num(r.searches) > 0 && num(r.zeroResults) >= num(r.searches) && <NothingFound label={m.nothingFound} />}
        </span>
      ),
    },
    {
      key: 'searches', header: m.searches, align: 'right', sortable: true, searchable: false,
      sortValue: (r) => num(r.searches),
      render: (r) => <span className="font-medium tabular-nums">{fmt.int(num(r.searches))}</span>,
    },
  ];
  if (kind === 'top') {
    columns.push(
      { key: 'zeroResults', header: m.noResults, align: 'right', sortable: true, searchable: false, sortValue: (r) => num(r.zeroResults), render: (r) => <span className="tabular-nums">{fmt.int(num(r.zeroResults))}</span> },
      { key: 'clicks', header: m.clicks, align: 'right', sortable: true, searchable: false, sortValue: (r) => num(r.clicks), render: (r) => <span className="tabular-nums">{fmt.int(num(r.clicks))}</span> },
      { key: 'ctr', header: m.ctr, align: 'right', sortable: true, searchable: false, sortValue: (r) => num(r.ctr), render: (r) => <span className="tabular-nums">{fmt.percent(num(r.ctr))}</span> },
    );
  }
  columns.push(
    {
      key: 'language', header: m.language, sortable: true,
      searchValue: (r) => searchLanguageName(r.language, locale, m.unknownLanguage),
      sortValue: (r) => searchLanguageName(r.language, locale, m.unknownLanguage),
      render: (r) => <span className="whitespace-nowrap text-text-secondary">{searchLanguageName(r.language, locale, m.unknownLanguage)}</span>,
    },
    {
      key: 'lastSeen', header: m.lastSeen, align: 'right', sortable: true, searchable: false,
      // No date sorts as empty: last in both directions.
      sortValue: (r) => (r.lastSeen ? r.lastSeen : null),
      render: (r) => <span className="whitespace-nowrap tabular-nums text-text-secondary">{r.lastSeen ? fmt.date(r.lastSeen) : '–'}</span>,
    },
  );
  return (
    <DataTable<SiteSearchQueryRow>
      mode="paginated"
      className={cn('overflow-x-auto', className)}
      caption={kind === 'top' ? m.topQueries : m.zeroQueries}
      columns={columns}
      rows={rows}
      rowId={(r) => r.key}
      searchable
      pageSize={pageSize}
      searchPlaceholder={m.searchPlaceholder}
      emptyMessage={m.noData}
    />
  );
}
