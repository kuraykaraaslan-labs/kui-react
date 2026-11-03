'use client';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { mergeLoraMessages, type LoraMessagesInput } from './messages';
import { LoraGatewayStatus, LoraProtocolBadge } from './LoraBadges';
import type { LoraGatewayRow } from './types';

/**
 * LoraGatewayTable — the tenant's LoRaWAN gateways: name, EUI, protocol, online state (last seen when offline), round trip (amber from
 * 800 ms: devices with a 1 s RX delay then fall back to RX2) and region. A row opens the gateway (keyboard too). Presentational: the host
 * loads the rows (with their live connection facts) and pages them.
 */
export type LoraGatewayTableProps = {
  rows: readonly LoraGatewayRow[];
  onOpen?: (g: LoraGatewayRow) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  locale?: string;
  now?: number;
  messages?: LoraMessagesInput;
  className?: string;
};

export function LoraGatewayTable({ rows, onOpen, loading = false, error, onRetry, locale, now, messages, className }: LoraGatewayTableProps) {
  const all = mergeLoraMessages(messages);
  const m = all.gateways;
  const columns: Column<LoraGatewayRow>[] = [
    { key: 'name', header: m.name, render: (g) => <span className="font-medium">{g.name}</span> },
    { key: 'eui', header: m.eui, hideBelow: 'sm', render: (g) => <code className="font-mono text-xs">{g.eui}</code> },
    { key: 'protocol', header: m.protocol, hideBelow: 'lg', render: (g) => <LoraProtocolBadge protocol={g.protocol} messages={messages} /> },
    { key: 'status', header: m.status, render: (g) => <LoraGatewayStatus gateway={g} now={now} locale={locale} messages={messages} /> },
    {
      key: 'rtt', header: m.rtt, hideBelow: 'md', align: 'right',
      render: (g) => (g.live?.online && g.live.rttMs !== null
        ? <span className={g.live.rttMs > 800 ? 'tabular-nums text-xs text-warning-fg' : 'tabular-nums text-xs'} title={g.live.rttMs > 800 ? m.rttSlow : undefined}>{g.live.rttMs} ms</span>
        : <span className="text-xs text-text-secondary">{all.common.none}</span>),
    },
    { key: 'region', header: m.region, hideBelow: 'lg', render: (g) => <span className="text-xs">{g.region}</span> },
  ];
  return (
    <div className={className}>
      <DataTable<LoraGatewayRow>
        mode="manual"
        variant="plain"
        caption={m.caption}
        columns={columns}
        rows={rows as LoraGatewayRow[]}
        rowId={(g) => g.gatewayId}
        onRowClick={onOpen ? (g) => onOpen(g) : undefined}
        loading={loading}
        error={error || undefined}
        onRetry={onRetry}
        emptyMessage={m.empty}
        messages={{ loading: all.common.loading, retry: all.common.retry }}
        density="compact"
        searchable={false}
        pageSizeOptions={[]}
        keyboardNavigation
      />
    </div>
  );
}
