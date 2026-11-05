'use client';
import { useMemo } from 'react';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { formatRelative } from '../format';
import { RecoveryStatusBadge } from './RecoveryRequestCard';
import { mergePkiMessages, type PkiMessagesInput } from './messages';
import type { RecoveryRequest } from './types';

/** The columns the recovery list sorts by, as NB's API names them (`RECOVERY_SORTABLE`). */
export const RECOVERY_SORT_KEYS = ['deviceSerial', 'status', 'requestedAt', 'expiresAt'] as const;
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'USED', 'EXPIRED'] as const;

export type RecoveryRequestTableProps = {
  rows: readonly RecoveryRequest[];
  onOpen?: (r: RecoveryRequest) => void;
  total?: number;
  onQueryChange?: (query: DataTableQuery) => void;
  defaultQuery?: Partial<DataTableQuery>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  now?: number;
  locale?: string;
  messages?: PkiMessagesInput;
  className?: string;
};

/**
 * RecoveryRequestTable — certificate recovery requests (NB iot_pki 03 §3.2): the device serial, the state, when it was asked, until when
 * it stands and the attempts with another key (amber above 0). A row opens the request (`RecoveryRequestCard`, where the owner decides).
 * The DataTable's own search (serial), Filters (status, several), sortable columns (`RECOVERY_SORT_KEYS`), rows per page and paging;
 * `onQueryChange` = the host serves the pages (`status` is NB's list parameter), else everything happens in the browser.
 */
export function RecoveryRequestTable({ rows, onOpen, total, onQueryChange, defaultQuery, loading = false, error, onRetry, now, locale, messages, className }: RecoveryRequestTableProps) {
  const all = mergePkiMessages(messages);
  const m = all.recoveries;
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }), [locale]);
  const columns: Column<RecoveryRequest>[] = [
    { key: 'deviceSerial', header: m.serial, sortable: true, render: (r) => <span className="font-mono text-xs font-medium">{r.deviceSerial}</span> },
    { key: 'status', header: m.status, sortable: true, searchable: false, render: (r) => <RecoveryStatusBadge status={r.status} messages={messages} /> },
    { key: 'requestedAt', header: m.requested, sortable: true, searchable: false, render: (r) => <span className="text-xs" title={date.format(new Date(r.requestedAt))}>{formatRelative(r.requestedAt, { locale, now })}</span> },
    { key: 'expiresAt', header: m.expires, sortable: true, searchable: false, hideBelow: 'md', render: (r) => <span className="tabular-nums text-xs">{date.format(new Date(r.expiresAt))}</span> },
    {
      key: 'otherKeyAttempts', header: m.otherKeys, searchable: false, align: 'right', hideBelow: 'sm',
      render: (r) => <span className={r.otherKeyAttempts > 0 ? 'tabular-nums text-xs text-warning-fg' : 'tabular-nums text-xs'}>{r.otherKeyAttempts}</span>,
    },
  ];
  const filterFields = useMemo((): DataTableFilterField<RecoveryRequest>[] => [
    { id: 'status', label: m.status, type: 'multiselect', options: STATUSES.map((s) => ({ value: s, label: all.recovery[s] })) },
  ], [m, all]);
  return (
    <div className={className}>
      <DataTable<RecoveryRequest>
        {...(onQueryChange
          ? { mode: 'manual' as const, total: total ?? rows.length, onQueryChange, loading, error: error || undefined }
          : { mode: 'paginated' as const, state: error ? 'error' as const : loading && !rows.length ? 'loading' as const : undefined, errorMessage: error || undefined })}
        variant="plain"
        caption={m.caption}
        columns={columns}
        rows={rows as RecoveryRequest[]}
        rowId={(r) => r.recoveryId}
        onRowClick={onOpen ? (r) => onOpen(r) : undefined}
        onRetry={onRetry}
        defaultQuery={defaultQuery}
        multiSort={false}
        searchPlaceholder={m.search}
        filterFields={filterFields}
        pageSize={defaultQuery?.pageSize ?? 20}
        pageSizeOptions={LIST_PAGE_SIZES}
        emptyMessage={m.empty}
        messages={{ loading: all.common.loading, retry: all.common.retry }}
        density="compact"
        keyboardNavigation
      />
    </div>
  );
}
