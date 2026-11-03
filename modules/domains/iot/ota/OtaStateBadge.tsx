'use client';
import { Badge } from '@/modules/ui/Badge';
import { Tooltip } from '@/modules/ui/Tooltip';
import type { OtaMessages, OtaMessagesInput } from './messages';
import { useOtaText } from './OtaText';
import type { OtaPackageStatus, OtaState, OtaWaitReason } from './types';

type Variant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'primary';

const STATE_VARIANT: Record<OtaState, Variant> = {
  QUEUED: 'neutral', INITIATED: 'info', WAITING: 'neutral', DOWNLOADING: 'info', DOWNLOADED: 'info', VERIFIED: 'info', UPDATING: 'info',
  UPDATED: 'success', FAILED: 'error', TIMEOUT: 'error', ROLLED_BACK: 'error', SKIPPED: 'neutral', CANCELLED: 'neutral',
};
const IN_FLIGHT: ReadonlySet<OtaState> = new Set(['INITIATED', 'DOWNLOADING', 'DOWNLOADED', 'VERIFIED', 'UPDATING']);

/** The words of a state, with the wait reason for WAITING. */
export function otaStateLabel(m: OtaMessages, state: OtaState, waitReason?: OtaWaitReason | null): string {
  if (state === 'WAITING' && waitReason && m.wait[waitReason]) return m.wait[waitReason];
  return m.state[state] ?? state;
}

/** The tooltip of a state: the wait reason's explanation, or what the state means. */
export function otaStateHint(m: OtaMessages, state: OtaState, waitReason?: OtaWaitReason | null): string {
  if (state === 'WAITING') return waitReason ? (m.wait as Record<string, string>)[`${waitReason}Hint`] ?? m.wait.generic : m.wait.generic;
  return (m.stateHint as Record<string, string>)[state] ?? '';
}

export interface OtaStateBadgeProps {
  state: OtaState;
  waitReason?: OtaWaitReason | null;
  /** 0–100 while downloading. */
  progress?: number | null;
  messages?: OtaMessagesInput | OtaMessages;
  className?: string;
}

/**
 * OtaStateBadge — one device's update state as a badge with its meaning in a tooltip. WAITING (a metered link, a used-up data quota, or
 * the router waiting for its own approval; OD-7, OD-13) is neutral, never an error: the device holds the update on purpose. States on the
 * way carry a dot; a download shows its percentage.
 */
export function OtaStateBadge({ state, waitReason, progress, messages, className }: OtaStateBadgeProps) {
  const { m } = useOtaText(messages as OtaMessagesInput);
  const label = otaStateLabel(m, state, waitReason);
  const pct = state === 'DOWNLOADING' && typeof progress === 'number' ? ` ${Math.max(0, Math.min(100, Math.round(progress)))}%` : '';
  const hint = otaStateHint(m, state, waitReason);
  const badge = (
    <Badge size="sm" variant={STATE_VARIANT[state] ?? 'neutral'} dot={IN_FLIGHT.has(state)} className={className} data-ota-state={state} data-wait-reason={waitReason ?? undefined}>
      {label}{pct}
    </Badge>
  );
  return hint ? <Tooltip content={hint}><span tabIndex={0} className="inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{badge}</span></Tooltip> : badge;
}

const STATUS_VARIANT: Record<OtaPackageStatus, Variant> = { DRAFT: 'info', REJECTED: 'error', READY: 'success', DEPRECATED: 'neutral', REVOKED: 'error' };

/** A package's status (Being checked, Rejected, Ready, Retired, Revoked) with its meaning in a tooltip. */
export function OtaPackageStatusBadge({ status, messages, className }: { status: OtaPackageStatus; messages?: OtaMessagesInput | OtaMessages; className?: string }) {
  const { m } = useOtaText(messages as OtaMessagesInput);
  return (
    <Tooltip content={m.statusHint[status] ?? ''}>
      <span tabIndex={0} className="inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
        <Badge size="sm" variant={STATUS_VARIANT[status] ?? 'neutral'} dot={status === 'DRAFT'} className={className} data-package-status={status}>{m.status[status] ?? status}</Badge>
      </span>
    </Tooltip>
  );
}
