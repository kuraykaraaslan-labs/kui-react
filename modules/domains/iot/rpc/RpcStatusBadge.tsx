'use client';
import { Badge } from '@/modules/ui/Badge';
import { useIotText } from '../api/IotAdapterProvider';
import type { RpcOutcome, RpcStatus } from '../types/rpc';
import type { IotMessagesInput } from '../messages';

/**
 * RpcStatusBadge — a request's status (QUEUED … CANCELLED) and, when there is one, its outcome: a timeout says "outcome unknown"
 * (never "did not run"), an accepted long method "running", a late answer "answered after the end".
 */
export type RpcStatusBadgeProps = { status: RpcStatus; outcome?: RpcOutcome; size?: 'sm' | 'md'; messages?: IotMessagesInput; className?: string };

const VARIANT: Record<RpcStatus, 'neutral' | 'info' | 'primary' | 'success' | 'error' | 'warning'> = {
  QUEUED: 'neutral', SENT: 'info', DELIVERED: 'primary', SUCCESSFUL: 'success', FAILED: 'error', TIMEOUT: 'warning', EXPIRED: 'warning', CANCELLED: 'neutral',
};

export function RpcStatusBadge({ status, outcome, size = 'sm', messages, className }: RpcStatusBadgeProps) {
  const { m } = useIotText(messages);
  const hint = outcome ? m.rpc[outcome] : undefined;
  return (
    <Badge variant={VARIANT[status] ?? 'neutral'} size={size} dot className={className} title={hint} data-status={status}>
      {m.rpc[status] ?? status}
      {hint && <span className="sr-only">: {hint}</span>}
    </Badge>
  );
}
