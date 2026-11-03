'use client';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { Badge } from '@/modules/ui/Badge';
import { formatDateTime } from '../format';
import { fillText, mergeLoraMessages, type LoraMessagesInput } from './messages';
import type { LoraFrameRow } from './types';

/**
 * LoraFrameTable — the join and uplink log (OD-103: the recent frames only, nothing stored): time, frame type, device, FCnt, FPort, DR and
 * frequency, the receiving gateways with the best RSSI/SNR, and the result (processed, the gateway a downlink went out through, or why a
 * frame was dropped; a foreign network's device is named only as such). The host names devices and gateways (`deviceName`, `gatewayName`).
 */
export type LoraFrameTableProps = {
  rows: readonly LoraFrameRow[];
  deviceName?: (id: string) => string | undefined;
  gatewayName?: (id: string) => string | undefined;
  onOpenDevice?: (deviceId: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  locale?: string;
  messages?: LoraMessagesInput;
  className?: string;
};

const variantOf = (r: LoraFrameRow): 'success' | 'error' | 'info' | 'neutral' => (r.result === 'dropped' ? 'error' : r.result === 'sent' ? 'info' : r.result === 'processed' ? 'success' : 'neutral');

export function LoraFrameTable({ rows, deviceName, gatewayName, onOpenDevice, loading = false, error, onRetry, locale, messages, className }: LoraFrameTableProps) {
  const all = mergeLoraMessages(messages);
  const m = all.frames;
  const text = m as Record<string, string>;
  const result = (r: LoraFrameRow) => {
    if (r.result === 'dropped') return text[`reason_${r.reason}`] ?? fillText(m.reason_other, { reason: r.reason ?? '' });
    if (r.result === 'sent') return fillText(m.sent, { gateway: (r.chosenGatewayId && gatewayName?.(r.chosenGatewayId)) ?? r.chosenGatewayId ?? '' }) + (r.window ? ` (${r.window.toUpperCase()})` : '');
    return text[r.result] ?? r.result;
  };
  const columns: Column<LoraFrameRow>[] = [
    { key: 't', header: m.time, render: (r) => <time className="whitespace-nowrap text-xs tabular-nums">{formatDateTime(r.t, { locale })}</time> },
    { key: 'type', header: m.type, render: (r) => <span className="text-xs">{text[r.type] ?? r.type}</span> },
    {
      key: 'device', header: m.device,
      render: (r) => (r.deviceId
        ? (onOpenDevice ? <button type="button" className="text-xs text-primary hover:underline" onClick={(e) => { e.stopPropagation(); onOpenDevice(r.deviceId!); }}>{deviceName?.(r.deviceId) ?? r.devEui ?? r.deviceId}</button> : <span className="text-xs">{deviceName?.(r.deviceId) ?? r.devEui}</span>)
        : <code className="font-mono text-xs text-text-secondary">{r.devAddr ?? all.common.none}</code>),
    },
    { key: 'fCnt', header: m.fCnt, hideBelow: 'sm', align: 'right', render: (r) => <span className="tabular-nums text-xs">{r.fCnt ?? all.common.none}</span> },
    { key: 'fPort', header: m.fPort, hideBelow: 'md', align: 'right', render: (r) => <span className="tabular-nums text-xs">{r.fPort ?? all.common.none}</span> },
    { key: 'radio', header: m.radio, hideBelow: 'lg', render: (r) => <span className="tabular-nums text-xs">{r.dr !== undefined ? `DR${r.dr}` : ''}{r.freq ? ` · ${(r.freq / 1e6).toFixed(1)}` : ''}</span> },
    {
      key: 'gateways', header: m.gateways, hideBelow: 'md',
      render: (r) => (r.gateways.length
        ? <span className="text-xs">{r.gateways.length} · {fillText(m.best, { rssi: r.gateways[0].rssi, snr: r.gateways[0].snr })}</span>
        : <span className="text-xs text-text-secondary">{all.common.none}</span>),
    },
    { key: 'result', header: m.result, render: (r) => <Badge size="sm" variant={variantOf(r)}>{result(r)}</Badge> },
  ];
  return (
    <div className={className}>
      <DataTable<LoraFrameRow>
        mode="manual" variant="plain" caption={m.caption} columns={columns} rows={rows as LoraFrameRow[]} rowId={(r) => `${r.t}:${r.type}:${r.fCnt ?? ''}:${r.devAddr ?? r.deviceId ?? ''}:${r.result}`}
        loading={loading} error={error || undefined} onRetry={onRetry} emptyMessage={m.empty}
        messages={{ loading: all.common.loading, retry: all.common.retry }} density="compact" searchable={false} pageSizeOptions={[]}
      />
    </div>
  );
}
