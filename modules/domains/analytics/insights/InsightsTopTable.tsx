'use client';
import { cn } from '@/libs/utils/cn';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import type { SearchEngineId } from '../types';
import { ENGINE_COLOR, type InsightsFormat } from './format';
import type { SiteInsightsMessages } from './messages';

export type InsightsTopRow = {
  key: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  views?: number;
  users?: number;
  /** Clicks per engine (the combined lists). */
  engines?: Partial<Record<SearchEngineId, number>>;
};

type InsightsTopTableProps = {
  /** `queries`: search queries; `pages`: page paths. */
  kind: 'queries' | 'pages';
  rows: InsightsTopRow[];
  /** Search columns (clicks, impressions, CTR, position). */
  search?: boolean;
  /** Analytics columns (views, visitors). */
  analytics?: boolean;
  /** The engines whose clicks get a column each (combined lists). */
  engines?: { id: SearchEngineId; label: string }[];
  fmt: InsightsFormat;
  messages: SiteInsightsMessages;
  /** Page paths link to the site when given (e.g. "https://example.com"). */
  siteUrl?: string;
  className?: string;
};

const num = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * InsightsTopTable — a top-queries or top-pages list: sortable, searchable, 10 rows a page. In a combined list each
 * engine's clicks get their own column, headed by the engine's name and colour swatch.
 */
export function InsightsTopTable({ kind, rows, search = true, analytics = false, engines = [], fmt, messages: m, siteUrl, className }: InsightsTopTableProps) {
  const columns: Column<InsightsTopRow>[] = [
    {
      key: 'key',
      header: kind === 'queries' ? m.query : m.page,
      tdClass: 'min-w-[12rem]',
      sortable: true,
      searchValue: (r) => r.key,
      render: (r) =>
        kind === 'pages' && siteUrl ? (
          <a
            href={`${siteUrl.replace(/\/$/, '')}${r.key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm"
          >
            {r.key}
          </a>
        ) : (
          <span className="break-words text-text-primary">{r.key}</span>
        ),
    },
  ];
  if (analytics) {
    columns.push(
      { key: 'views', header: m.views, align: 'right', sortable: true, searchable: false, sortValue: (r) => num(r.views), render: (r) => <span className="tabular-nums">{fmt.int(num(r.views))}</span> },
      { key: 'users', header: m.users, align: 'right', sortable: true, searchable: false, sortValue: (r) => num(r.users), render: (r) => <span className="tabular-nums">{fmt.int(num(r.users))}</span> },
    );
  }
  if (search) {
    columns.push({ key: 'clicks', header: m.clicks, align: 'right', sortable: true, searchable: false, sortValue: (r) => num(r.clicks), render: (r) => <span className="tabular-nums font-medium">{fmt.int(num(r.clicks))}</span> });
    for (const e of engines) {
      columns.push({
        key: `engine:${e.id}`,
        header: (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ENGINE_COLOR[e.id] }} />
            {e.label}
          </span>
        ),
        align: 'right',
        sortable: true,
        searchable: false,
        sortValue: (r) => num(r.engines?.[e.id]),
        render: (r) => <span className="tabular-nums text-text-secondary">{r.engines?.[e.id] === undefined ? '–' : fmt.int(num(r.engines?.[e.id]))}</span>,
      });
    }
    columns.push(
      { key: 'impressions', header: m.impressions, align: 'right', sortable: true, searchable: false, sortValue: (r) => num(r.impressions), render: (r) => <span className="tabular-nums">{fmt.int(num(r.impressions))}</span> },
      { key: 'ctr', header: m.ctr, align: 'right', sortable: true, searchable: false, sortValue: (r) => num(r.ctr), render: (r) => <span className="tabular-nums">{fmt.percent(num(r.ctr))}</span> },
      // An unknown rank (0) sorts as empty: last in both directions (DataTable's NULLS LAST).
      { key: 'position', header: m.position, align: 'right', sortable: true, searchable: false, sortValue: (r) => (num(r.position) > 0 ? num(r.position) : null), render: (r) => <span className="tabular-nums">{fmt.position(num(r.position))}</span> },
    );
  }
  return (
    <DataTable<InsightsTopRow>
      mode="paginated"
      className={cn('overflow-x-auto', className)}
      caption={kind === 'queries' ? m.topQueries : m.topPages}
      columns={columns}
      rows={rows}
      rowId={(r) => r.key}
      searchable
      pageSize={10}
      searchPlaceholder={m.searchPlaceholder}
      emptyMessage={m.noData}
    />
  );
}
