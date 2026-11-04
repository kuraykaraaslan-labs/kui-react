'use client';
import { useMemo } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { mergeLoraMessages, type LoraMessagesInput } from './messages';
import type { LoraCodecRow } from './types';

/**
 * LoraCodecTable — the LoRaWAN codec library and the tenant's own codecs in one list (NB iot_lorawan_codecs 05; kui-react iot 10.7): id
 * (monospace), name, vendor, models, FPorts, kind (`tlv` / `layout`), source (Library / Yours), verified, revision and last update; with
 * `showStatus` (the platform's own view) also Published / Withdrawn. A row opens the codec (keyboard too). Presentational.
 *
 * A full list on the DataTable's own toolbar: search (id, name, vendor, models, OUI), the Filters panel (source, kind, verified, and
 * status with `showStatus`), sortable columns (id, name, vendor, kind, revision, updated, source), rows per page and paging. With
 * `onQueryChange` the host serves every page (`mode="manual"`; the sort keys are `LORA_CODEC_SORT_KEYS`, the filter ids `scope`,
 * `kind`, `verified` as `true` / `false`, `status`: NB's list parameters). Without it the table does all of it in the browser.
 */
export type LoraCodecTableProps = {
  rows: readonly LoraCodecRow[];
  onOpen?: (c: LoraCodecRow) => void;
  total?: number;
  onQueryChange?: (query: DataTableQuery) => void;
  defaultQuery?: Partial<DataTableQuery>;
  /** The platform's view: the Status column and filter (withdrawn library codecs are listed). */
  showStatus?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  locale?: string;
  messages?: LoraMessagesInput;
  className?: string;
};

export const LORA_CODEC_SORT_KEYS = ['id', 'title', 'vendor', 'kind', 'rev', 'updatedAt', 'scope'] as const;

const short = (list: readonly (string | number)[], n = 3): string => (list.length > n ? `${list.slice(0, n).join(', ')} +${list.length - n}` : list.join(', '));

export function LoraCodecTable({
  rows, onOpen, total, onQueryChange, defaultQuery, showStatus = false, loading = false, error, onRetry, locale, messages, className,
}: LoraCodecTableProps) {
  const all = mergeLoraMessages(messages);
  const m = all.codecs;
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);
  const columns: Column<LoraCodecRow>[] = [
    { key: 'id', header: m.id, sortable: true, render: (c) => <code className="font-mono text-xs">{c.id}</code> },
    { key: 'title', header: m.name, sortable: true, render: (c) => <span className="font-medium">{c.title}</span> },
    { key: 'vendor', header: m.vendor, sortable: true, hideBelow: 'sm' },
    { key: 'models', header: m.models, hideBelow: 'lg', render: (c) => <span className="text-xs" title={c.models.join(', ')}>{c.models.length ? short(c.models) : all.common.none}</span> },
    { key: 'fports', header: m.fports, searchable: false, hideBelow: 'lg', render: (c) => <span className="tabular-nums text-xs">{c.fports.length ? short(c.fports) : all.common.none}</span> },
    { key: 'kind', header: m.kind, sortable: true, searchable: false, hideBelow: 'md', render: (c) => <code className="font-mono text-xs">{c.kind}</code> },
    {
      key: 'scope', header: m.scope, sortable: true, searchable: false,
      render: (c) => <Badge variant={c.scope === 'tenant' ? 'primary' : 'neutral'} size="sm">{c.scope === 'tenant' ? m.scopeTenant : m.scopePublic}</Badge>,
    },
    {
      key: 'verified', header: m.verified, searchable: false, hideBelow: 'lg',
      render: (c) => (c.verified ? <Badge variant="success" size="sm">{m.verifiedYes}</Badge> : <span className="text-xs text-text-secondary">{m.verifiedNo}</span>),
    },
    { key: 'rev', header: m.rev, sortable: true, searchable: false, align: 'right', hideBelow: 'md', render: (c) => <span className="tabular-nums text-xs">{c.rev}</span> },
    { key: 'updatedAt', header: m.updated, sortable: true, searchable: false, hideBelow: 'lg', render: (c) => <span className="text-xs">{date.format(new Date(c.updatedAt))}</span> },
    ...(showStatus ? [{
      key: 'status', header: m.status, searchable: false,
      render: (c: LoraCodecRow) => <Badge variant={c.status === 'WITHDRAWN' ? 'warning' : 'success'} size="sm">{c.status === 'WITHDRAWN' ? m.withdrawn : m.published}</Badge>,
    } as Column<LoraCodecRow>] : []),
  ];
  const filterFields = useMemo((): DataTableFilterField<LoraCodecRow>[] => [
    { id: 'scope', label: m.scope, type: 'select', options: [{ value: 'public', label: m.scopePublic }, { value: 'tenant', label: m.scopeTenant }] },
    { id: 'kind', label: m.kind, type: 'select', options: [{ value: 'tlv', label: 'tlv' }, { value: 'layout', label: 'layout' }] },
    {
      id: 'verified', label: m.verified, type: 'select',
      options: [{ value: 'true', label: m.verifiedYes }, { value: 'false', label: m.verifiedNo }],
      match: (c, v) => String(c.verified) === v,
    },
    ...(showStatus ? [{ id: 'status', label: m.status, type: 'select' as const, options: [{ value: 'PUBLISHED', label: m.published }, { value: 'WITHDRAWN', label: m.withdrawn }] }] : []),
  ], [m, showStatus]);
  return (
    <div className={className}>
      <DataTable<LoraCodecRow>
        {...(onQueryChange
          ? { mode: 'manual' as const, total: total ?? rows.length, onQueryChange, loading, error: error || undefined }
          : { mode: 'paginated' as const, state: error ? 'error' as const : loading && !rows.length ? 'loading' as const : undefined, errorMessage: error || undefined })}
        variant="plain"
        caption={m.caption}
        columns={columns}
        rows={rows as LoraCodecRow[]}
        rowId={(c) => c.id}
        onRowClick={onOpen ? (c) => onOpen(c) : undefined}
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
