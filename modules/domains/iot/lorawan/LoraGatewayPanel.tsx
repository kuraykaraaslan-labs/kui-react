'use client';
import { useMemo } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { DescriptionList } from '@/modules/ui/DescriptionList';
import { fillText, mergeLoraMessages, type LoraMessagesInput } from './messages';
import { LoraGatewayStatus, LoraProtocolBadge } from './LoraBadges';
import { LoraFrameTable } from './LoraFrameTable';
import { LoraStationSetup } from './LoraStationSetup';
import type { LoraFrameRow, LoraGatewayRow, LoraIssuedToken, LoraSetup } from './types';

/**
 * LoraGatewayPanel — the LoRaWAN tab of a device that is a LoRaWAN gateway (NB iot_lorawan: a gateway is a device, shown under Devices),
 * the sibling of `LoraDevicePanel`, one column of sections, no nested tabs: the gateway's connection (online or offline with when it was
 * last seen, round trip with the slow-link mark, connected since) and its facts (EUI, protocol, region, network server mode, location);
 * the Basics Station setup (`LoraStationSetup`: the token only while `issued` holds it, right after an add or a rotation); the frames this
 * gateway heard (the host reads them and refreshes them while the tab is open).
 *
 * The actions are the host's and each is asked through its ConfirmDialog before it runs: Rotate token (a Basics Station gateway with a token),
 * Enable or Disable (by the gateway's status), Remove (danger). A prop left out hides its button (the viewer may not manage gateways).
 */
export type LoraGatewayPanelProps = {
  gateway: LoraGatewayRow | null;
  setup: LoraSetup | null;
  /** A token just issued (after the add or a rotation): shown once, then the host drops it. */
  issued?: LoraIssuedToken | null;
  frames: readonly LoraFrameRow[];
  /** The host saves a Station file (a Blob download). */
  onDownload?: (file: { name: string; content: string }) => void;
  onRotate?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  onRemove?: () => void;
  deviceName?: (deviceId: string) => string | undefined;
  /** Names the gateways of a frame (other gateways may have heard it too); this gateway is named by its own name without it. */
  gatewayName?: (gatewayId: string) => string | undefined;
  onOpenDevice?: (deviceId: string) => void;
  loading?: boolean;
  error?: string | null;
  now?: number;
  locale?: string;
  messages?: LoraMessagesInput;
  className?: string;
};

export function LoraGatewayPanel({
  gateway, setup, issued, frames, onDownload, onRotate, onEnable, onDisable, onRemove, deviceName, gatewayName, onOpenDevice, loading, error, now, locale, messages, className,
}: LoraGatewayPanelProps) {
  const all = mergeLoraMessages(messages);
  const m = all.gatewayTab;
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }), [locale]);
  const nameOf = useMemo(
    () => (id: string) => gatewayName?.(id) ?? (gateway && id === gateway.gatewayId ? gateway.name : undefined),
    [gatewayName, gateway],
  );
  if (error && !gateway) return <Callout variant="danger" className={className}>{error}</Callout>;
  if (!gateway) return <p className={['text-sm text-text-secondary', className].filter(Boolean).join(' ')}>{loading ? all.common.loading : all.deviceTab.notLora}</p>;
  const live = gateway.live;
  const rtt = live?.online && live.rttMs !== null && live.rttMs !== undefined ? live.rttMs : null;
  const placed = typeof gateway.latitude === 'number' && typeof gateway.longitude === 'number';
  const where = placed
    ? fillText(typeof gateway.altitude === 'number' ? m.altitudeValue : m.locationValue, { lat: gateway.latitude as number, lng: gateway.longitude as number, alt: gateway.altitude ?? '' })
    : m.locationNone;
  const canRotate = onRotate && gateway.protocol === 'BASICS_STATION';
  const toggle = gateway.status === 'DISABLED' ? onEnable : onDisable;
  const hasActions = canRotate || toggle || onRemove;
  return (
    <div className={['space-y-6', className].filter(Boolean).join(' ')}>
      {hasActions && (
        <div className="flex flex-wrap gap-2">
          {canRotate && <Button variant="outline" size="sm" onClick={onRotate}>{m.rotate}</Button>}
          {toggle && <Button variant="outline" size="sm" onClick={toggle}>{gateway.status === 'DISABLED' ? m.enable : m.disable}</Button>}
          {onRemove && <Button variant="danger" size="sm" onClick={onRemove}>{m.remove}</Button>}
        </div>
      )}
      {error && <Callout variant="danger">{error}</Callout>}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">{m.identity}<LoraGatewayStatus gateway={gateway} now={now} locale={locale} messages={messages} /></h3>
        <DescriptionList
          dense columns={2}
          messages={{ copy: all.common.copy, copied: all.common.copied }}
          items={[
            { label: m.eui, value: gateway.eui, mono: true, copyValue: gateway.eui },
            { label: m.protocol, value: <LoraProtocolBadge protocol={gateway.protocol} messages={messages} /> },
            { label: m.region, value: gateway.region },
            { label: m.mode, value: gateway.mode === 'LOCAL' ? m.modeLocal : gateway.mode === 'CLOUD' ? m.modeCloud : gateway.mode },
            {
              label: m.rtt,
              value: rtt === null ? undefined : <span className={rtt > 800 ? 'tabular-nums text-warning-fg' : 'tabular-nums'}>{fillText(m.rttValue, { ms: rtt })}</span>,
              hint: rtt !== null && rtt > 800 ? all.gateways.rttSlow : undefined,
            },
            { label: m.lastSeen, value: gateway.lastSeenAt ? date.format(new Date(gateway.lastSeenAt)) : all.common.never },
            { label: m.connectedAt, value: live?.online && live.connectedAt ? date.format(new Date(live.connectedAt)) : undefined },
            { label: m.location, value: where, mono: placed },
          ]}
        />
      </section>
      <LoraStationSetup gateway={gateway} setup={setup} issued={issued} onDownload={onDownload} messages={messages} />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">{m.heard}</h3>
        <LoraFrameTable rows={frames} deviceName={deviceName} gatewayName={nameOf} onOpenDevice={onOpenDevice} messages={messages} locale={locale} />
        <p className="text-xs text-text-secondary">{m.heardNote}</p>
      </section>
    </div>
  );
}
