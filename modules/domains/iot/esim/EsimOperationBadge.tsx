'use client';
import { Badge } from '@/modules/ui/Badge';
import type { EsimMessages } from './messages';
import type { EsimOperationKind, EsimOperationState } from './types';

type Shown = keyof EsimMessages['state'];

/** The word an operation's state is shown with: a switch reads "Switching" / "Switched" (D60's apply and confirm). */
export function esimStateWord(kind: EsimOperationKind, state: EsimOperationState): Shown {
  if (kind === 'enable' && state === 'running') return 'switching';
  if (kind === 'enable' && state === 'succeeded') return 'switched';
  return state;
}

const VARIANT: Record<Shown, 'neutral' | 'info' | 'success' | 'error' | 'warning'> = {
  sent: 'neutral', running: 'info', switching: 'info', succeeded: 'success', switched: 'success', failed: 'error', reverted: 'warning', unknown: 'warning',
};

export interface EsimOperationBadgeProps {
  kind: EsimOperationKind;
  state: EsimOperationState;
  messages: EsimMessages;
  size?: 'sm' | 'md';
}

/** An operation's state as a badge, its meaning as the tooltip. */
export function EsimOperationBadge({ kind, state, messages: m, size = 'sm' }: EsimOperationBadgeProps) {
  const w = esimStateWord(kind, state);
  return (
    <Badge variant={VARIANT[w]} size={size} dot={state === 'sent' || state === 'running'} title={m.stateHint[w]}>
      {m.state[w]}
    </Badge>
  );
}
