'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { MapCanvas } from '@/modules/ui/MapView/MapCanvas';
import type { MapMarker } from '@/modules/ui/MapView/types';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { mergeLoraMessages, type LoraMessagesInput } from './messages';
import { LoraGatewayStatus } from './LoraBadges';
import type { LoraGatewayRow } from './types';

/**
 * LoraGatewayMap — the tenant's gateways on the map (NB iot_lorawan 13 §13.1; kui-react iot 10.2), on the kit's one map (`MapCanvas`, the same
 * map as the Sites & assets map; no other map library). A placed gateway is a pin coloured by its state (green online, red offline, grey
 * never connected or disabled) with its name, state and round trip in the tooltip; a click opens it (`onOpen`). Gateways without a
 * location are never drawn at 0,0: they are listed beside the map ("Not on the map", a DataTable) with "Place on the map", which puts the
 * pin in the middle of the placed ones (or of the map) for the person to drag where the gateway stands. With `onMove` every pin can be
 * dragged; the host saves the new position (NB `PATCH …/gateways/[id] { latitude, longitude }`).
 */
export type LoraGatewayMapProps = {
  gateways: readonly LoraGatewayRow[];
  onOpen?: (g: LoraGatewayRow) => void;
  /** Saves a gateway's position; absent: the pins stay where they are and nothing can be placed. */
  onMove?: (g: LoraGatewayRow, position: [number, number]) => void;
  /** Where "Place on the map" puts a pin when no gateway is placed yet. */
  defaultCenter?: [number, number];
  now?: number;
  locale?: string;
  messages?: LoraMessagesInput;
  className?: string;
};

export type LoraPinState = 'online' | 'offline' | 'never';

/** A gateway's pin state: online, offline after it was seen, or never connected (a disabled one counts as never). Pure. */
export function loraPinState(g: Pick<LoraGatewayRow, 'status' | 'lastSeenAt' | 'live'>): LoraPinState {
  if (g.status !== 'DISABLED' && g.live?.online) return 'online';
  return g.status !== 'DISABLED' && g.lastSeenAt ? 'offline' : 'never';
}

const VARIANT = { online: 'success', offline: 'error', never: 'neutral' } as const;
const DOT = { online: 'bg-success', offline: 'bg-error', never: 'bg-text-disabled' } as const;

export const isPlaced = (g: Pick<LoraGatewayRow, 'latitude' | 'longitude'>): g is { latitude: number; longitude: number } =>
  typeof g.latitude === 'number' && typeof g.longitude === 'number' && Number.isFinite(g.latitude) && Number.isFinite(g.longitude);

/** The middle of the placed gateways (where a newly placed pin starts), or the fallback. Pure. */
export function middleOf(rows: readonly LoraGatewayRow[], fallback: [number, number]): [number, number] {
  const placed = rows.filter(isPlaced) as Array<LoraGatewayRow & { latitude: number; longitude: number }>;
  if (!placed.length) return fallback;
  return [placed.reduce((a, g) => a + g.latitude, 0) / placed.length, placed.reduce((a, g) => a + g.longitude, 0) / placed.length];
}

export function LoraGatewayMap({ gateways, onOpen, onMove, defaultCenter = [39.9334, 32.8597], now, locale, messages, className }: LoraGatewayMapProps) {
  const all = mergeLoraMessages(messages);
  const m = all.map;
  const [fitRound, setFitRound] = useState(0);
  const [placedNow, setPlacedNow] = useState<string | null>(null);
  const placed = useMemo(() => gateways.filter(isPlaced), [gateways]);
  const unplaced = useMemo(() => gateways.filter((g) => !isPlaced(g)), [gateways]);
  const markers = useMemo((): MapMarker[] => placed.map((g) => {
    const state = loraPinState(g);
    const rtt = g.live?.online && g.live.rttMs !== null ? ` · ${g.live.rttMs} ms` : '';
    return {
      id: g.gatewayId,
      position: [g.latitude as number, g.longitude as number],
      variant: VARIANT[state],
      label: g.name,
      draggable: !!onMove,
      tooltip: { title: g.name, description: `${state === 'online' ? m.legendOnline : state === 'offline' ? m.legendOffline : m.legendNever}${rtt} · ${g.eui}` },
    };
  }), [placed, onMove, m]);
  const byId = useMemo(() => new Map(gateways.map((g) => [g.gatewayId, g])), [gateways]);
  const columns: Column<LoraGatewayRow>[] = [
    {
      key: 'name', header: m.gateway, sortable: true,
      render: (g) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-text-primary">{g.name}</span>
          <span className="flex items-center gap-2 text-xs text-text-secondary"><code className="font-mono">{g.eui}</code><LoraGatewayStatus gateway={g} now={now} locale={locale} messages={messages} /></span>
        </span>
      ),
    },
    {
      key: 'place', header: '', searchable: false,
      render: (g) => (onMove
        ? <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setPlacedNow(g.gatewayId); onMove(g, middleOf(gateways, defaultCenter)); setFitRound((n) => n + 1); }}>{m.place}</Button>
        : null),
    },
  ];
  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary" aria-label={m.title}>
        {(['online', 'offline', 'never'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', DOT[s])} />
            {s === 'online' ? m.legendOnline : s === 'offline' ? m.legendOffline : m.legendNever}
          </span>
        ))}
        {onMove && placed.length > 0 && <span>{m.dragHint}</span>}
        {placed.length > 0 && <Button variant="outline" size="sm" className="ml-auto" onClick={() => setFitRound((n) => n + 1)}>{m.fitAll}</Button>}
      </div>
      {placedNow && <Callout variant="tip">{m.placeHint}</Callout>}
      <div className="flex min-h-0 flex-col gap-3 lg:flex-row-reverse">
        <div className="relative h-80 overflow-hidden rounded-xl border border-border sm:h-[28rem] lg:flex-1" data-testid="lora-gateway-map">
          {markers.length
            ? (
              <MapCanvas
                key={fitRound}
                markers={markers}
                onMarkerClick={(id) => { const g = byId.get(id); if (g && onOpen) onOpen(g); }}
                onMarkerMove={onMove ? (id, p) => { const g = byId.get(id); if (g) onMove(g, p); } : undefined}
                loadingLabel={all.common.loading}
                ariaLabel={m.title}
                cluster
              />
            )
            : <p className="flex h-full items-center justify-center p-6 text-center text-sm text-text-secondary">{m.noGateways}</p>}
        </div>
        <div className="min-h-0 rounded-xl border border-border lg:w-80 lg:shrink-0" data-testid="lora-gateway-unplaced">
          <h3 className="border-b border-border px-3 py-2 text-sm font-semibold text-text-primary">{m.unplaced}</h3>
          <DataTable<LoraGatewayRow>
            mode="paginated" variant="plain" bordered={false} density="compact" tableClassName="table-fixed"
            caption={m.unplaced} columns={columns} rows={unplaced as LoraGatewayRow[]} rowId={(g) => g.gatewayId}
            onRowClick={onOpen ? (g) => onOpen(g) : undefined}
            pageSize={10} searchPlaceholder={m.search} emptyMessage={m.unplacedEmpty}
            messages={{ loading: all.common.loading, retry: all.common.retry }}
          />
        </div>
      </div>
    </div>
  );
}
