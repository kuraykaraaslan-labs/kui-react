'use client';
import { useMemo } from 'react';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { Badge } from '@/modules/ui/Badge';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { formatDateTime } from '../format';
import { fillText, mergeLoraMessages, type LoraMessagesInput } from './messages';
import type { LoraFrameRow } from './types';

/**
 * LoraFrameTable — the join and uplink log (OD-103: the recent frames only, nothing stored): time, frame type, device, FCnt, FPort, DR and
 * frequency, the receiving gateways with the best RSSI/SNR, and the result (processed, the gateway a downlink went out through, or why a
 * frame was dropped; a foreign network's device is named only as such). A device is named by the host's `deviceName` lookup, else by the
 * row's own `deviceName` (a frame of a device that is not on the host's current page), else by its DevEUI; gateways by `gatewayName`.
 *
 * The log is short and held whole (the host passes every recent frame it read), so the table pages, sorts (time, FCnt, FPort; newest
 * first), searches (device name, DevEUI, DevAddr, the result's words) and filters (frame type, result) it in the browser.
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

const FRAME_TYPES = ['up', 'cup', 'join', 'join_accept', 'down', 'dropped'] as const;
const FRAME_RESULTS = ['processed', 'sent', 'retransmission', 'dropped'] as const;
const NEWEST_FIRST = [{ key: 't', dir: 'desc' as const }];

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
  const nameOf = (r: LoraFrameRow) => (r.deviceId ? deviceName?.(r.deviceId) : undefined) ?? r.deviceName;
  const columns: Column<LoraFrameRow>[] = [
    { key: 't', header: m.time, sortable: true, searchable: false, render: (r) => <time className="whitespace-nowrap text-xs tabular-nums">{formatDateTime(r.t, { locale })}</time> },
    { key: 'type', header: m.type, searchValue: (r) => text[r.type] ?? r.type, render: (r) => <span className="text-xs">{text[r.type] ?? r.type}</span> },
    {
      key: 'device', header: m.device,
      searchValue: (r) => [nameOf(r), r.devEui, r.devAddr].filter(Boolean).join(' '),
      render: (r) => (r.deviceId
        ? (onOpenDevice ? <button type="button" className="text-xs text-primary hover:underline" onClick={(e) => { e.stopPropagation(); onOpenDevice(r.deviceId!); }}>{nameOf(r) ?? r.devEui ?? r.deviceId}</button> : <span className="text-xs">{nameOf(r) ?? r.devEui}</span>)
        : <code className="font-mono text-xs text-text-secondary">{r.devAddr ?? all.common.none}</code>),
    },
    { key: 'fCnt', header: m.fCnt, sortable: true, searchable: false, hideBelow: 'sm', align: 'right', render: (r) => <span className="tabular-nums text-xs">{r.fCnt ?? all.common.none}</span> },
    { key: 'fPort', header: m.fPort, sortable: true, searchable: false, hideBelow: 'md', align: 'right', render: (r) => <span className="tabular-nums text-xs">{r.fPort ?? all.common.none}</span> },
    { key: 'radio', header: m.radio, hideBelow: 'lg', searchable: false, render: (r) => <span className="tabular-nums text-xs">{r.dr !== undefined ? `DR${r.dr}` : ''}{r.freq ? ` · ${(r.freq / 1e6).toFixed(1)}` : ''}</span> },
    {
      key: 'gateways', header: m.gateways, hideBelow: 'md', searchable: false,
      render: (r) => (r.gateways.length
        ? <span className="text-xs">{r.gateways.length} · {fillText(m.best, { rssi: r.gateways[0].rssi, snr: r.gateways[0].snr })}</span>
        : <span className="text-xs text-text-secondary">{all.common.none}</span>),
    },
    { key: 'result', header: m.result, searchValue: result, render: (r) => <Badge size="sm" variant={variantOf(r)}>{result(r)}</Badge> },
  ];
  const filterFields = useMemo((): DataTableFilterField<LoraFrameRow>[] => [
    { id: 'type', label: m.type, type: 'select', options: FRAME_TYPES.map((v) => ({ value: v, label: text[v] ?? v })) },
    { id: 'result', label: m.result, type: 'select', options: FRAME_RESULTS.map((v) => ({ value: v, label: v === 'sent' ? m.sentAny : text[v] ?? v })) },
  ], [m, text]);
  return (
    <div className={className}>
      <DataTable<LoraFrameRow>
        mode="paginated" variant="plain" caption={m.caption} columns={columns} rows={rows as LoraFrameRow[]} rowId={(r) => `${r.t}:${r.type}:${r.fCnt ?? ''}:${r.devAddr ?? r.deviceId ?? ''}:${r.result}`}
        state={error ? 'error' : loading && !rows.length ? 'loading' : undefined} errorMessage={error || undefined} onRetry={onRetry} emptyMessage={m.empty}
        initialSort={NEWEST_FIRST} multiSort={false} searchPlaceholder={m.search} filterFields={filterFields} pageSize={20} pageSizeOptions={LIST_PAGE_SIZES}
        messages={{ loading: all.common.loading, retry: all.common.retry }} density="compact"
      />
    </div>
  );
}
