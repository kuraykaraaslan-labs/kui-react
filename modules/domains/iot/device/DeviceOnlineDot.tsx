'use client';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import { ageSeconds, fill, formatDateTime, formatRelative, type TimeInput } from '../format';
import type { DeviceOnlineState } from '../types/device';
import type { IotMessagesInput } from '../messages';

/**
 * DeviceOnlineDot — a dot and a short text for a device's connection (OD-57): green "Online", grey "Offline · last seen 5 min
 * ago", or a neutral "Last seen 3 h ago" for a profile that only knows last seen (never a red "offline"). With
 * `staleAfterSeconds`, an online device whose last data is older turns amber ("Stale"), computed here from `lastSeenAt`.
 */
export type DeviceOnlineDotProps = {
  state: DeviceOnlineState;
  lastSeenAt?: TimeInput;
  staleAfterSeconds?: number;
  /** Dot only (the text stays for screen readers and as the tooltip). */
  compact?: boolean;
  locale?: string;
  /** Fixed "now" for tests and deterministic demos. */
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

type Look = 'online' | 'offline' | 'lastSeen' | 'stale';

const DOT: Record<Look, string> = {
  online: 'bg-success',
  offline: 'bg-text-disabled',
  lastSeen: 'bg-info',
  stale: 'bg-warning',
};

export function DeviceOnlineDot({ state, lastSeenAt, staleAfterSeconds, compact = false, locale, now, messages, className }: DeviceOnlineDotProps) {
  const { m, locale: loc } = useIotText(messages, locale);
  const lang = loc;
  const age = ageSeconds(lastSeenAt, now);
  const rel = formatRelative(lastSeenAt, { locale: lang, now });
  let look: Look;
  let text: string;
  if (state === 'ONLINE') {
    const stale = staleAfterSeconds !== undefined && age !== null && age > staleAfterSeconds;
    look = stale ? 'stale' : 'online';
    text = stale ? fill(m.device.stale, { time: rel }) : m.device.online;
  } else if (state === 'OFFLINE') {
    look = 'offline';
    text = lastSeenAt ? `${m.device.offline} · ${fill(m.device.lastSeen, { time: rel })}` : `${m.device.offline} · ${m.device.neverConnected}`;
  } else {
    look = 'lastSeen';
    text = lastSeenAt ? fill(m.device.lastSeen, { time: rel }) : m.device.neverConnected;
  }
  const title = lastSeenAt ? formatDateTime(lastSeenAt, { locale: lang }) : undefined;
  return (
    <span
      data-state={state}
      data-look={look}
      title={compact ? text : title}
      className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs text-text-secondary', className)}
    >
      <span
        aria-hidden="true"
        className={cn('h-2 w-2 shrink-0 rounded-full', DOT[look], look === 'online' && 'ring-2 ring-success-subtle')}
      />
      {compact ? <span className="sr-only">{text}</span> : <span className="truncate">{text}</span>}
    </span>
  );
}
