'use client';
import { Badge } from '@/modules/ui/Badge';
import { formatRelative } from '../format';
import { fillText, mergeLoraMessages, type LoraMessagesInput } from './messages';
import type { LoraDeviceRow, LoraGatewayRow } from './types';

/** The gateway's state: online (its connection is open), offline with when it was last seen, or disabled. */
export function LoraGatewayStatus({ gateway, now, locale, messages }: { gateway: Pick<LoraGatewayRow, 'status' | 'lastSeenAt' | 'live'>; now?: number; locale?: string; messages?: LoraMessagesInput }) {
  const m = mergeLoraMessages(messages).gateways;
  if (gateway.status === 'DISABLED') return <Badge variant="neutral" size="sm">{m.disabled}</Badge>;
  if (gateway.status === 'PENDING') return <Badge variant="info" size="sm">{m.pending}</Badge>;
  if (gateway.live?.online) return <Badge variant="success" size="sm" dot>{m.online}</Badge>;
  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant="warning" size="sm" dot>{m.offline}</Badge>
      {gateway.lastSeenAt && <span className="text-xs text-text-secondary">{formatRelative(gateway.lastSeenAt, { locale, now })}</span>}
    </span>
  );
}

export function LoraProtocolBadge({ protocol, messages }: { protocol: LoraGatewayRow['protocol']; messages?: LoraMessagesInput }) {
  const m = mergeLoraMessages(messages).gateways;
  return <Badge variant="neutral" size="sm">{protocol === 'ROLTEK_LINK' ? m.protocolRoltekLink : m.protocolBasicsStation}</Badge>;
}

/** The join state the network server recorded for a device: never joined, joined, or why the last join was refused. */
export function LoraJoinStateBadge({ device, messages }: { device: Pick<LoraDeviceRow, 'lastJoin' | 'session'>; messages?: LoraMessagesInput }) {
  const m = mergeLoraMessages(messages).devices;
  const s = device.lastJoin?.state;
  if (!s) return <Badge variant="neutral" size="sm">{device.session ? m.joined : m.neverJoined}</Badge>;
  if (s === 'joined') return <Badge variant="success" size="sm">{m.joined}</Badge>;
  const known = (m as Record<string, string>)[s];
  return <Badge variant="error" size="sm">{known ?? fillText(m.other, { reason: s })}</Badge>;
}
