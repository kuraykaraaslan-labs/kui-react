'use client';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Tooltip } from '@/modules/ui/Tooltip';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, formatRelative, type TimeInput } from '../format';
import { onlineStateOf, type DeviceRegistryStatus } from '../types/device';
import type { IotMessages, IotMessagesInput } from '../messages';

/**
 * DeviceConnectionBadge — online / offline with a relative "last seen", in the visual language of `DeviceStatusBadge`
 * (Badge with a dot), and a tooltip with the last disconnect reason. It follows the profile's online rule (OD-57): `online`
 * null is "last seen only" (neutral, never red). The registry status wins over the connection (OD-1): a QUARANTINED device
 * shows "Quarantined" (waiting for activation, data not stored, counts toward the limit, OD-75), a DISABLED one "Disabled".
 * The disconnect reason is a code (`keepalive_timeout`); it reads as words (`disconnectReasonText`), an unknown code as it is.
 */
export type DeviceConnectionBadgeProps = {
  online: boolean | null;
  status?: DeviceRegistryStatus;
  lastActivityAt?: TimeInput;
  lastDisconnectReason?: string | null;
  size?: 'sm' | 'md';
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

/** A disconnect reason code in words (NB 41-ui-fixes/21 1.21); a code the kit does not know shows as it is. */
export function disconnectReasonText(m: IotMessages, reason: string): string {
  const words = (m.disconnectReason as Record<string, string | undefined>)[reason];
  return words ?? reason;
}

export function DeviceConnectionBadge({
  online, status = 'ACTIVE', lastActivityAt, lastDisconnectReason, size = 'md', locale, now, messages, className,
}: DeviceConnectionBadgeProps) {
  const { m, locale: lang } = useIotText(messages, locale);
  const rel = formatRelative(lastActivityAt, { locale: lang, now });
  const seen = lastActivityAt ? fill(m.device.lastSeen, { time: rel }) : m.device.neverConnected;

  if (status === 'QUARANTINED') {
    return (
      <Tooltip content={m.device.quarantinedHint}>
        <Badge variant="warning" size={size} dot className={cn('cursor-help', className)} data-state="QUARANTINED">
          {m.device.quarantined}
        </Badge>
      </Tooltip>
    );
  }
  if (status === 'DISABLED') {
    return (
      <Badge variant="neutral" size={size} className={className} data-state="DISABLED">
        {m.device.disabled}
      </Badge>
    );
  }

  const state = onlineStateOf(online);
  const variant = state === 'ONLINE' ? 'success' : state === 'OFFLINE' ? 'neutral' : 'info';
  const label = state === 'ONLINE' ? m.device.online : state === 'OFFLINE' ? m.device.offline : seen;
  const tip = [
    state === 'LAST_SEEN' ? null : seen,
    state === 'OFFLINE' && lastDisconnectReason ? fill(m.device.lastDisconnect, { reason: disconnectReasonText(m, lastDisconnectReason) }) : null,
  ].filter(Boolean).join(' · ');
  const badge = (
    <Badge variant={variant} size={size} dot className={className} data-state={state}>
      {label}
    </Badge>
  );
  return tip ? <Tooltip content={tip}>{badge}</Tooltip> : badge;
}
