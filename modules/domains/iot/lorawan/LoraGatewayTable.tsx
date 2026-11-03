'use client';
import { useMemo } from 'react';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { mergeLoraMessages, type LoraMessagesInput } from './messages';
import { LoraGatewayStatus, LoraProtocolBadge } from './LoraBadges';
import type { LoraGatewayRow } from './types';

/**
 * LoraGatewayTable — the tenant's LoRaWAN gateways: name, EUI, protocol, online state (last seen when offline), round trip (amber from
 * 800 ms: devices with a 1 s RX delay then fall back to RX2) and region. A row opens the gateway (keyboard too). Presentational: the host
 * loads the rows (with their live connection facts).
 *
 * A full list on the DataTable's own toolbar: search (name, EUI), the Filters panel (protocol, status, connection, region), sortable
 * columns (name, EUI, protocol, status, region; one at a time), rows per page and paging. With `onQueryChange` the host serves every page
 * (`mode="manual"`, `total` rows in all): the query's sort keys (`LORA_GATEWAY_SORT_KEYS`) and filter ids (`protocol`, `status`, `online`
 * as `true` / `false`, `region`) are NB iot_lorawan's list parameters. Without it the table pages, sorts, searches and filters `rows`
 * in the browser.
 */
export type LoraGatewayTableProps = {
  rows: readonly LoraGatewayRow[];
  onOpen?: (g: LoraGatewayRow) => void;
  /** With `onQueryChange`: the rows across every page. */
  total?: number;
  /** The host serves the pages: every change of page, rows per page, sort, search or filters, and the first query on mount. */
  onQueryChange?: (query: DataTableQuery) => void;
  /** The query to start from (rows per page, a sort). */
  defaultQuery?: Partial<DataTableQuery>;
  /** The regions the Region filter offers. */
  regions?: readonly string[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  locale?: string;
  now?: number;
  messages?: LoraMessagesInput;
  className?: string;
};

/** The columns a gateway list sorts by, as the host's API names them. */
export const LORA_GATEWAY_SORT_KEYS = ['name', 'eui', 'protocol', 'status', 'region'] as const;
const DEFAULT_REGIONS: readonly string[] = ['EU868'];

export function LoraGatewayTable({
  rows, onOpen, total, onQueryChange, defaultQuery, regions = DEFAULT_REGIONS, loading = false, error, onRetry, locale, now, messages, className,
}: LoraGatewayTableProps) {
  const all = mergeLoraMessages(messages);
  const m = all.gateways;
  const columns: Column<LoraGatewayRow>[] = [
    { key: 'name', header: m.name, sortable: true, render: (g) => <span className="font-medium">{g.name}</span> },
    { key: 'eui', header: m.eui, sortable: true, hideBelow: 'sm', render: (g) => <code className="font-mono text-xs">{g.eui}</code> },
    { key: 'protocol', header: m.protocol, sortable: true, searchable: false, hideBelow: 'lg', render: (g) => <LoraProtocolBadge protocol={g.protocol} messages={messages} /> },
    { key: 'status', header: m.status, sortable: true, searchable: false, render: (g) => <LoraGatewayStatus gateway={g} now={now} locale={locale} messages={messages} /> },
    {
      key: 'rtt', header: m.rtt, hideBelow: 'md', align: 'right', searchable: false,
      render: (g) => (g.live?.online && g.live.rttMs !== null
        ? <span className={g.live.rttMs > 800 ? 'tabular-nums text-xs text-warning-fg' : 'tabular-nums text-xs'} title={g.live.rttMs > 800 ? m.rttSlow : undefined}>{g.live.rttMs} ms</span>
        : <span className="text-xs text-text-secondary">{all.common.none}</span>),
    },
    { key: 'region', header: m.region, sortable: true, searchable: false, hideBelow: 'lg', render: (g) => <span className="text-xs">{g.region}</span> },
  ];
  const filterFields = useMemo((): DataTableFilterField<LoraGatewayRow>[] => [
    {
      id: 'protocol', label: m.protocol, type: 'select',
      options: [{ value: 'BASICS_STATION', label: m.protocolBasicsStation }, { value: 'ROLTEK_LINK', label: m.protocolRoltekLink }],
    },
    {
      id: 'status', label: m.status, type: 'select',
      options: [{ value: 'ACTIVE', label: m.active }, { value: 'PENDING', label: m.pending }, { value: 'DISABLED', label: m.disabled }],
    },
    {
      id: 'online', label: m.connection, type: 'select',
      options: [{ value: 'true', label: m.online }, { value: 'false', label: m.offline }],
      match: (g, v) => String(g.live?.online === true) === v,
    },
    { id: 'region', label: m.region, type: 'select', options: regions.map((r) => ({ value: r, label: r })) },
  ], [m, regions]);
  return (
    <div className={className}>
      <DataTable<LoraGatewayRow>
        {...(onQueryChange
          ? { mode: 'manual' as const, total: total ?? rows.length, onQueryChange, loading, error: error || undefined }
          : { mode: 'paginated' as const, state: error ? 'error' as const : loading && !rows.length ? 'loading' as const : undefined, errorMessage: error || undefined })}
        variant="plain"
        caption={m.caption}
        columns={columns}
        rows={rows as LoraGatewayRow[]}
        rowId={(g) => g.gatewayId}
        onRowClick={onOpen ? (g) => onOpen(g) : undefined}
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
