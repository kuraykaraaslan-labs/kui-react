'use client';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { Button } from '@/modules/ui/Button';
import { useIotText } from '../api/IotAdapterProvider';
import { formatDateTime, formatRelative, toDate } from '../format';
import type { RpcRequest } from '../types/rpc';
import type { IotMessagesInput } from '../messages';
import { RpcStatusBadge } from './RpcStatusBadge';

/**
 * RpcRequestList — requests newest first: method, status (with the outcome), who sent it, created, completed and duration; a row
 * opens the detail (keyboard too). `showDevice` adds the device column for the fleet log. Rows the host just changed can be
 * highlighted (`fresh`).
 */
export type RpcRequestListProps = {
  requests: readonly RpcRequest[];
  onOpen?: (request: RpcRequest) => void;
  showDevice?: boolean;
  fresh?: ReadonlySet<string>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

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
  requests, onOpen, showDevice = false, fresh, loading = false, error, onRetry, hasMore = false, onLoadMore, locale, now, messages, className,
}: RpcRequestListProps) {
  const { m, locale: lang } = useIotText(messages, locale);
  const sourceLabel = (s: string) => (m.rpc as Record<string, string>)[`source_${s}`] ?? s;
  const columns: Column<RpcRequest>[] = [
    { key: 'method', header: m.rpc.method, render: (r) => <code className="font-mono text-xs">{r.method}</code> },
    ...(showDevice ? [{ key: 'device', header: m.rpc.device, hideBelow: 'md' as const, render: (r: RpcRequest) => r.deviceName ?? r.deviceId }] : []),
    { key: 'status', header: m.rpc.status, render: (r) => <RpcStatusBadge status={r.status} outcome={r.outcome} /> },
    { key: 'source', header: m.rpc.sentBy, hideBelow: 'md', render: (r) => sourceLabel(r.source) },
    {
      key: 'created', header: m.rpc.created, hideBelow: 'sm',
      render: (r) => <time className="text-xs text-text-secondary" title={formatDateTime(r.createdAt, { locale: lang })}>{formatRelative(r.createdAt, { locale: lang, now })}</time>,
    },
    { key: 'duration', header: m.rpc.duration, hideBelow: 'lg', align: 'right', render: (r) => <span className="tabular-nums text-xs">{duration(rpcDurationMs(r))}</span> },
  ];
  return (
    <div className={className}>
      <DataTable<RpcRequest>
        mode="manual"
        caption={m.rpc.history}
        columns={columns}
        rows={requests as RpcRequest[]}
        rowId={(r) => r.rpcId}
        onRowClick={onOpen ? (r) => onOpen(r) : undefined}
        rowState={(r) => (fresh?.has(r.rpcId) ? 'new' : undefined)}
        loading={loading}
        error={error || undefined}
        onRetry={onRetry}
        emptyMessage={m.rpc.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        density="compact"
        searchable={false}
        pageSizeOptions={[]}
        keyboardNavigation
      />
      {hasMore && onLoadMore && (
        <div className="mt-2 flex justify-center"><Button variant="outline" size="sm" loading={loading} onClick={onLoadMore}>{m.rpc.loadMore}</Button></div>
      )}
    </div>
  );
}
