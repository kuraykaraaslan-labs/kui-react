'use client';
import { cn } from '@/libs/utils/cn';
import { fill } from '../format';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';

/**
 * DeviceAddress — the client address of a device's newest connect, as the platform's gateway saw it (iot-device 03 §3.6), with the
 * transport it came over: `203.0.113.7 · MQTT`. A dash before the first connect. The address is the one behind a trusted balancer or
 * edge (PROXY protocol, X-Forwarded-For), so a NATed device shows its public address, not its LAN one.
 */
export type DeviceAddressProps = {
  ip?: string | null;
  transport?: string | null;
  /** Hide the transport (a narrow cell). */
  compact?: boolean;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function DeviceAddress({ ip, transport, compact = false, locale, messages, className }: DeviceAddressProps) {
  const { m } = useIotText(messages, locale);
  if (!ip) return <span className={cn('text-text-secondary', className)}>—</span>;
  const via = transport ? transport.toUpperCase() : null;
  return (
    <span className={cn('inline-flex min-w-0 items-baseline gap-1.5', className)} title={via ? fill(m.device.addressVia, { ip, transport: via }) : ip}>
      <code className="truncate font-mono text-xs text-text-primary">{ip}</code>
      {via && !compact && <span className="shrink-0 text-[11px] uppercase tracking-wide text-text-secondary">{via}</span>}
    </span>
  );
}
