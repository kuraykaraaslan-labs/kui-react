'use client';
import { useMemo } from 'react';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { useIotText } from '../api/IotAdapterProvider';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { formatDateTime, formatRelative, toDate } from '../format';
import { RPC_STATUSES, type RpcRequest } from '../types/rpc';
import type { IotMessagesInput } from '../messages';
import { RpcStatusBadge } from './RpcStatusBadge';

/**
 * RpcRequestList — requests newest first: method, status (with the outcome), who sent it, created, completed and duration; a row
 * opens the detail (keyboard too). `showDevice` adds the device column for the fleet log. Rows the host just changed can be
 * highlighted (`fresh`).
 *
 * A full list on the DataTable's own toolbar: search (the method), the Filters panel (status, sent by), sortable columns (method,
 * status, sent by, created, completed; one at a time), rows per page and paging. With `onQueryChange` the host serves every page
 * (`mode="manual"`, `total` rows in all; the sort keys are `RPC_SORT_KEYS`, the filter ids `status` and `source`, both lists).
 * Without it the table pages, sorts, searches and filters `requests` in the browser.
 */
export type RpcRequestListProps = {
  requests: readonly RpcRequest[];
  onOpen?: (request: RpcRequest) => void;
  showDevice?: boolean;
  fresh?: ReadonlySet<string>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** With `onQueryChange`: the rows across every page. */
  total?: number;
  /** The host serves the pages: every change of page, rows per page, sort, search or filters, and the first query on mount. */
  onQueryChange?: (query: DataTableQuery) => void;
  /** The query to start from (rows per page, a sort). */
  defaultQuery?: Partial<DataTableQuery>;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

/** The sources a history's "Sent by" filter offers. */
const RPC_SOURCES = ['console', 'api', 'automation', 'ota', 'alarm_action', 'dashboard_control'] as const;

export function rpcDurationMs(r: Pick<RpcRequest, 'createdAt' | 'completedAt'>): number | null {
  const a = toDate(r.createdAt);
  const b = toDate(r.completedAt);
  return a && b ? Math.max(0, b.getTime() - a.getTime()) : null;
}

function duration(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;
}

export function RpcRequestList({
  requests, onOpen, showDevice = false, fresh, loading = false, error, onRetry, total, onQueryChange, defaultQuery, locale, now, messages, className,
}: RpcRequestListProps) {
  const { m, locale: lang } = useIotText(messages, locale);
  const sourceLabel = (s: string) => (m.rpc as Record<string, string>)[`source_${s}`] ?? s;
  const statusLabel = (s: string) => (m.rpc as Record<string, string>)[s] ?? s;
  const columns: Column<RpcRequest>[] = [
    { key: 'method', header: m.rpc.method, sortable: true, render: (r) => <code className="font-mono text-xs">{r.method}</code> },
    ...(showDevice ? [{ key: 'device', header: m.rpc.device, hideBelow: 'md' as const, searchValue: (r: RpcRequest) => r.deviceName ?? r.deviceId, render: (r: RpcRequest) => r.deviceName ?? r.deviceId }] : []),
    { key: 'status', header: m.rpc.status, sortable: true, searchable: false, render: (r) => <RpcStatusBadge status={r.status} outcome={r.outcome} /> },
    { key: 'source', header: m.rpc.sentBy, sortable: true, searchable: false, hideBelow: 'md', render: (r) => sourceLabel(r.source) },
    {
      key: 'createdAt', header: m.rpc.created, sortable: true, searchable: false, hideBelow: 'sm',
      render: (r) => <time className="text-xs text-text-secondary" title={formatDateTime(r.createdAt, { locale: lang })}>{formatRelative(r.createdAt, { locale: lang, now })}</time>,
    },
    {
      key: 'completedAt', header: m.rpc.duration, sortable: true, searchable: false, hideBelow: 'lg', align: 'right',
      render: (r) => <span className="tabular-nums text-xs" title={r.completedAt ? formatDateTime(r.completedAt, { locale: lang }) : undefined}>{duration(rpcDurationMs(r))}</span>,
    },
  ];
  const filterFields = useMemo((): DataTableFilterField<RpcRequest>[] => [
    { id: 'status', label: m.rpc.status, type: 'checkboxes', options: RPC_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })) },
    { id: 'source', label: m.rpc.sentBy, type: 'checkboxes', options: RPC_SOURCES.map((s) => ({ value: s, label: sourceLabel(s) })) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [m]);
  return (
    <div className={className}>
      <DataTable<RpcRequest>
        {...(onQueryChange
          ? { mode: 'manual' as const, total: total ?? requests.length, onQueryChange, loading, error: error || undefined }
          : { mode: 'paginated' as const, state: error ? 'error' as const : loading && !requests.length ? 'loading' as const : undefined, errorMessage: error || undefined })}
        variant="plain"
        caption={m.rpc.history}
        columns={columns}
        rows={requests as RpcRequest[]}
        rowId={(r) => r.rpcId}
        onRowClick={onOpen ? (r) => onOpen(r) : undefined}
        rowState={(r) => (fresh?.has(r.rpcId) ? 'new' : undefined)}
        onRetry={onRetry}
        defaultQuery={defaultQuery}
        multiSort={false}
        searchPlaceholder={m.rpc.search}
        filterFields={filterFields}
        pageSize={defaultQuery?.pageSize ?? 25}
        pageSizeOptions={LIST_PAGE_SIZES.includes(defaultQuery?.pageSize ?? 25) ? LIST_PAGE_SIZES : [...LIST_PAGE_SIZES, defaultQuery?.pageSize ?? 25].sort((a, b) => a - b)}
        emptyMessage={m.rpc.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        density="compact"
        keyboardNavigation
      />
    </div>
  );
}
