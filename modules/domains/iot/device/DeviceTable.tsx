'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { KeyedTable, type KeyedTableColumn } from '@/modules/ui/KeyedTable';
import { useIotText } from '../api/IotAdapterProvider';
import { formatRelative } from '../format';
import type { DeviceOnlineState, DeviceRegistryStatus } from '../types/device';
import type { IotMessagesInput } from '../messages';
import { DeviceAddress } from './DeviceAddress';
import { DeviceConnectionBadge } from './DeviceConnectionBadge';
import { DeviceOnlineDot } from './DeviceOnlineDot';

/**
 * DeviceTable — the body of a dashboard's device table (`iot.device-table`, phase 07 §7.1; NB `iot.device_table`): the rows
 * a host delivers (no fetching here), an online dot with "last seen" and a stale threshold computed from `lastSeenAt`,
 * optional telemetry key columns (unit, decimals) merged by row id, and a row click (keyboard too) the host turns into an
 * action (narrow a board, open the device). Loading, error and empty states; columns drop below `md` so it fits 360 px.
 */
export type DeviceTableRow = {
  id: string;
  deviceId?: string;
  name: string;
  label?: string | null;
  type?: string | null;
  profile?: string | null;
  status?: DeviceRegistryStatus;
  state?: DeviceOnlineState;
  online?: boolean | null;
  lastSeenAt?: string | number | Date | null;
  /** The client address of the newest connect (iot-device 03 §3.6), for the `address` column. */
  remoteIp?: string | null;
  /** Latest telemetry values by key (from a latest-values source), shown in `keyColumns`. */
  values?: Record<string, unknown>;
  [extra: string]: unknown;
};

export type DeviceTableKeyColumn = { key: string; label?: string; unit?: string; decimals?: number };

export type DeviceTableColumnId = 'name' | 'connection' | 'profile' | 'type' | 'lastSeen' | 'address';

export type DeviceTableProps = {
  rows: readonly DeviceTableRow[];
  columns?: readonly DeviceTableColumnId[];
  keyColumns?: readonly DeviceTableKeyColumn[];
  /** An online device with no data for longer than this shows as stale. */
  staleAfterSeconds?: number;
  onRowClick?: (row: DeviceTableRow) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyText?: string;
  /** Refresh relative times every this many ms (default 30 s; 0 = never). */
  tickMs?: number;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

const DEFAULT_COLUMNS: readonly DeviceTableColumnId[] = ['name', 'connection', 'profile', 'lastSeen'];

function stateOf(row: DeviceTableRow): DeviceOnlineState {
  if (row.state) return row.state;
  if (row.online === null || row.online === undefined) return 'LAST_SEEN';
  return row.online ? 'ONLINE' : 'OFFLINE';
}

export function formatKeyValue(v: unknown, col: DeviceTableKeyColumn, locale?: string): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') {
    const text = col.decimals !== undefined
      ? new Intl.NumberFormat(locale, { minimumFractionDigits: col.decimals, maximumFractionDigits: col.decimals }).format(v)
      : new Intl.NumberFormat(locale).format(v);
    return col.unit ? `${text} ${col.unit}` : text;
  }
  if (typeof v === 'boolean') return v ? '1' : '0';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

export function DeviceTable({
  rows, columns = DEFAULT_COLUMNS, keyColumns = [], staleAfterSeconds, onRowClick, loading = false, error, onRetry, emptyText,
  tickMs = 30_000, locale, now, messages, className,
}: DeviceTableProps) {
  const { m, locale: lang } = useIotText(messages, locale);
  // a tick re-renders the relative times; the value itself is not read
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!tickMs || now !== undefined) return;
    const id = setInterval(() => setTick((t) => t + 1), tickMs);
    return () => clearInterval(id);
  }, [tickMs, now]);
  const at = now;

  const defs: Record<DeviceTableColumnId, KeyedTableColumn<DeviceTableRow>> = {
    name: {
      key: 'name',
      header: m.devices.name,
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{r.name}</span>
          {r.label && <span className="truncate text-xs text-text-secondary">{r.label}</span>}
        </span>
      ),
    },
    connection: {
      key: 'connection',
      header: m.devices.connection,
      render: (r) => (r.status && r.status !== 'ACTIVE'
        ? <DeviceConnectionBadge online={r.online ?? null} status={r.status} size="sm" locale={lang} messages={messages} />
        : <DeviceOnlineDot state={stateOf(r)} lastSeenAt={r.lastSeenAt} staleAfterSeconds={staleAfterSeconds} locale={lang} now={at} messages={messages} />),
    },
    profile: { key: 'profile', header: m.devices.profile, hideBelow: 'md', render: (r) => r.profile ?? '—' },
    type: { key: 'type', header: m.device.type, hideBelow: 'lg', render: (r) => r.type ?? '—' },
    lastSeen: {
      key: 'lastSeen',
      header: m.devices.lastSeen,
      hideBelow: 'sm',
      render: (r) => <span className="text-xs text-text-secondary">{formatRelative(r.lastSeenAt, { locale: lang, now: at })}</span>,
    },
    address: { key: 'address', header: m.devices.address, hideBelow: 'md', render: (r) => <DeviceAddress ip={r.remoteIp} compact locale={lang} messages={messages} /> },
  };

  const cols: KeyedTableColumn<DeviceTableRow>[] = [
    ...columns.map((id) => defs[id]).filter(Boolean),
    ...keyColumns.map((kc): KeyedTableColumn<DeviceTableRow> => ({
      key: `value:${kc.key}`,
      header: kc.label ?? kc.key,
      align: 'right',
      render: (r) => <span className="tabular-nums">{formatKeyValue(r.values?.[kc.key] ?? r[kc.key], kc, lang)}</span>,
    })),
  ];

  return (
    <KeyedTable
      className={cn('border-0', className)}
      caption={m.deviceTable.caption}
      columns={cols}
      rows={rows}
      getRowKey={(r) => r.id}
      onRowClick={onRowClick}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyText={emptyText ?? m.deviceTable.empty}
      messages={{ loading: m.common.loading, retry: m.common.retry }}
      dense
    />
  );
}
