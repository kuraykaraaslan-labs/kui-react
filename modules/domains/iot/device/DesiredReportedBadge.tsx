'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faCodeBranch, faQuestion, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Badge } from '@/modules/ui/Badge';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { DesiredReportedState } from '../types/device';
import type { IotMessagesInput } from '../messages';

/**
 * DesiredReportedBadge — the sync state of a shared (`cfg.*`) attribute: `in_sync`, `pending` (desired newer than the
 * device's last apply), `rejected` (with the device's reason), `drifted` (the device changed it on its own), `unknown_key`
 * (the device does not know the key). NB iot_device 04 §4.3.
 */
export type DesiredReportedBadgeProps = {
  state: DesiredReportedState;
  reason?: string;
  size?: 'sm' | 'md';
  messages?: IotMessagesInput;
  className?: string;
};

const META: Record<DesiredReportedState, { variant: 'success' | 'info' | 'error' | 'warning' | 'neutral'; icon: IconDefinition }> = {
  in_sync:     { variant: 'success', icon: faCheck },
  pending:     { variant: 'info',    icon: faClock },
  rejected:    { variant: 'error',   icon: faXmark },
  drifted:     { variant: 'warning', icon: faCodeBranch },
  unknown_key: { variant: 'neutral', icon: faQuestion },
};

export function DesiredReportedBadge({ state, reason, size = 'sm', messages, className }: DesiredReportedBadgeProps) {
  const { m } = useIotText(messages);
  const meta = META[state] ?? META.unknown_key;
  const title = reason ? fill(m.sync.reason, { reason }) : undefined;
  return (
    <Badge variant={meta.variant} size={size} className={className} title={title} data-sync={state}>
      <FontAwesomeIcon icon={meta.icon} className="h-2.5 w-2.5" aria-hidden="true" />
      {m.sync[state]}
      {reason && state === 'rejected' && <span className="sr-only">{title}</span>}
    </Badge>
  );
}
