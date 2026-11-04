'use client';
import { useMemo } from 'react';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { formatRelative } from '../format';
import { mergeLoraMessages, type LoraMessagesInput } from './messages';
import { LoraJoinStateBadge, loraJoinStateOf } from './LoraBadges';
import type { LoraDeviceRow } from './types';

/**
 * LoraDeviceTable — the tenant's LoRaWAN end devices: name, DevEUI, join state (why a join was refused: "wrong AppKey?"), DevAddr and last
 * uplink of the active session, frame counter, class, LoRaWAN version and when it was added. Never a key: the AppKey is not part of a row.
 *
 * A full list on the DataTable's own toolbar: search (name, DevEUI, JoinEUI), the Filters panel (class, LoRaWAN version, join state),
 * sortable columns (name, DevEUI, class, LoRaWAN version, added; one at a time), rows per page and paging. With `onQueryChange` the host serves
 * every page (`mode="manual"`, `total` rows in all): the query's sort keys (`LORA_DEVICE_SORT_KEYS`) and filter ids (`class`,
 * `macVersion`, `joinState` as `joined` / `refused` / `never`, the rule of `loraJoinStateOf`) are NB iot_lorawan's list parameters.
 * Without it the table pages, sorts, searches and filters `rows` in the browser.
 */
export type LoraDeviceTableProps = {
  rows: readonly LoraDeviceRow[];
  onOpen?: (d: LoraDeviceRow) => void;
  /** With `onQueryChange`: the rows across every page. */
  total?: number;
  /** The host serves the pages: every change of page, rows per page, sort, search or filters, and the first query on mount. */
  onQueryChange?: (query: DataTableQuery) => void;
  /** The query to start from (rows per page, a sort). */
  defaultQuery?: Partial<DataTableQuery>;
  /** The LoRaWAN versions the version filter offers. */
  macVersions?: readonly string[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  locale?: string;
  now?: number;
  messages?: LoraMessagesInput;
  className?: string;
};

/** The columns a device list sorts by, as the host's API names them. */
export const LORA_DEVICE_SORT_KEYS = ['name', 'devEui', 'class', 'macVersion', 'createdAt'] as const;
const DEFAULT_MAC_VERSIONS: readonly string[] = ['1.0.2', '1.0.3', '1.0.4'];

export function LoraDeviceTable({
  rows, onOpen, total, onQueryChange, defaultQuery, macVersions = DEFAULT_MAC_VERSIONS, loading = false, error, onRetry, locale, now, messages, className,
}: LoraDeviceTableProps) {
  const all = mergeLoraMessages(messages);
  const m = all.devices;
  const dash = <span className="text-xs text-text-secondary">{all.common.none}</span>;
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);
  const columns: Column<LoraDeviceRow>[] = [
    { key: 'name', header: m.name, sortable: true, searchValue: (d) => d.name ?? d.devEui, render: (d) => <span className="font-medium">{d.name ?? d.devEui}</span> },
    { key: 'devEui', header: m.devEui, sortable: true, hideBelow: 'sm', render: (d) => <code className="font-mono text-xs">{d.devEui}</code> },
    { key: 'join', header: m.joinState, searchable: false, render: (d) => <LoraJoinStateBadge device={d} messages={messages} /> },
    { key: 'devAddr', header: m.devAddr, hideBelow: 'lg', searchValue: (d) => d.session?.devAddr ?? '', render: (d) => (d.session ? <code className="font-mono text-xs">{d.session.devAddr}</code> : dash) },
    { key: 'lastUplink', header: m.lastUplink, hideBelow: 'md', searchable: false, render: (d) => (d.session?.lastUplinkAt ? <time className="text-xs text-text-secondary">{formatRelative(d.session.lastUplinkAt, { locale, now })}</time> : dash) },
    { key: 'fCnt', header: m.fCnt, hideBelow: 'lg', align: 'right', searchable: false, render: (d) => (d.session?.fCntUp !== null && d.session?.fCntUp !== undefined ? <span className="tabular-nums text-xs">{d.session.fCntUp}</span> : dash) },
    { key: 'class', header: m.class, sortable: true, hideBelow: 'lg', searchable: false, render: (d) => <span className="text-xs">{d.class}</span> },
    { key: 'macVersion', header: m.macVersion, sortable: true, hideBelow: 'lg', searchable: false, render: (d) => <span className="text-xs">{d.macVersion}</span> },
    {
      key: 'createdAt', header: m.createdAt, sortable: true, hideBelow: 'lg', searchable: false, sortValue: (d) => d.createdAt ?? '',
      render: (d) => (d.createdAt ? <span className="text-xs">{date.format(new Date(d.createdAt))}</span> : dash),
    },
  ];
  const filterFields = useMemo((): DataTableFilterField<LoraDeviceRow>[] => [
    { id: 'class', label: m.class, type: 'select', options: [{ value: 'A', label: 'A' }, { value: 'C', label: 'C' }] },
    { id: 'macVersion', label: m.macVersion, type: 'select', options: macVersions.map((v) => ({ value: v, label: v })) },
    {
      id: 'joinState', label: m.joinState, type: 'select',
      options: [{ value: 'joined', label: m.joined }, { value: 'refused', label: m.refused }, { value: 'never', label: m.neverJoined }],
      match: (d, v) => loraJoinStateOf(d) === v,
    },
  ], [m, macVersions]);
  return (
    <div className={className}>
      <DataTable<LoraDeviceRow>
        {...(onQueryChange
          ? { mode: 'manual' as const, total: total ?? rows.length, onQueryChange, loading, error: error || undefined }
          : { mode: 'paginated' as const, state: error ? 'error' as const : loading && !rows.length ? 'loading' as const : undefined, errorMessage: error || undefined })}
        variant="plain"
        caption={m.caption}
        columns={columns}
        rows={rows as LoraDeviceRow[]}
        rowId={(d) => d.deviceId}
        onRowClick={onOpen ? (d) => onOpen(d) : undefined}
        onRetry={onRetry}
        defaultQuery={defaultQuery}
        multiSort={false}
        searchPlaceholder={m.search}
        searchText={(d) => d.joinEui}
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
