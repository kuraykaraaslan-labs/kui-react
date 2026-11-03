'use client';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { formatRelative } from '../format';
import { mergeLoraMessages, type LoraMessagesInput } from './messages';
import { LoraJoinStateBadge } from './LoraBadges';
import type { LoraDeviceRow } from './types';

/**
 * LoraDeviceTable — the tenant's LoRaWAN end devices: name, DevEUI, class, LoRaWAN version, join state (why a join was refused: "wrong
 * AppKey?"), DevAddr and last uplink of the active session, frame counter. Never a key: the AppKey is not part of a row.
 */
export type LoraDeviceTableProps = {
  rows: readonly LoraDeviceRow[];
  onOpen?: (d: LoraDeviceRow) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  locale?: string;
  now?: number;
  messages?: LoraMessagesInput;
  className?: string;
};

export function LoraDeviceTable({ rows, onOpen, loading = false, error, onRetry, locale, now, messages, className }: LoraDeviceTableProps) {
  const all = mergeLoraMessages(messages);
  const m = all.devices;
  const dash = <span className="text-xs text-text-secondary">{all.common.none}</span>;
  const columns: Column<LoraDeviceRow>[] = [
    { key: 'name', header: m.name, render: (d) => <span className="font-medium">{d.name ?? d.devEui}</span> },
    { key: 'devEui', header: m.devEui, hideBelow: 'sm', render: (d) => <code className="font-mono text-xs">{d.devEui}</code> },
    { key: 'join', header: m.joinState, render: (d) => <LoraJoinStateBadge device={d} messages={messages} /> },
    { key: 'devAddr', header: m.devAddr, hideBelow: 'lg', render: (d) => (d.session ? <code className="font-mono text-xs">{d.session.devAddr}</code> : dash) },
    { key: 'lastUplink', header: m.lastUplink, hideBelow: 'md', render: (d) => (d.session?.lastUplinkAt ? <time className="text-xs text-text-secondary">{formatRelative(d.session.lastUplinkAt, { locale, now })}</time> : dash) },
    { key: 'fCnt', header: m.fCnt, hideBelow: 'lg', align: 'right', render: (d) => (d.session?.fCntUp !== null && d.session?.fCntUp !== undefined ? <span className="tabular-nums text-xs">{d.session.fCntUp}</span> : dash) },
    { key: 'class', header: m.class, hideBelow: 'lg', render: (d) => <span className="text-xs">{d.class} · {d.macVersion}</span> },
  ];
  return (
    <div className={className}>
      <DataTable<LoraDeviceRow>
        mode="manual" variant="plain" caption={m.caption} columns={columns} rows={rows as LoraDeviceRow[]} rowId={(d) => d.deviceId}
        onRowClick={onOpen ? (d) => onOpen(d) : undefined} loading={loading} error={error || undefined} onRetry={onRetry} emptyMessage={m.empty}
        messages={{ loading: all.common.loading, retry: all.common.retry }} density="compact" searchable={false} pageSizeOptions={[]} keyboardNavigation
      />
    </div>
  );
}
