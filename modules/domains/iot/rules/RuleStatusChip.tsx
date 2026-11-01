'use client';
import { Badge } from '@/modules/ui/Badge';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { IotMessagesInput } from '../messages';
import type { RuleItem } from '../types/rules';
import { countdown, ruleState } from './rule-format';

/**
 * RuleStatusChip — one word of what a rule is doing: Idle · Waiting 3:20 (a hold counting down) · Running · Stopped: Manual · Paused by
 * a guard · Needs attention · Off. The first that applies; `now` is the host's clock (a countdown re-renders with it).
 */
export type RuleStatusChipProps = {
  rule: Pick<RuleItem, 'enabled' | 'status' | 'stoppedByManual' | 'pausedByGuard' | 'waitingUntil'>;
  now: number;
  messages?: IotMessagesInput;
  className?: string;
};

const VARIANT = { off: 'neutral', attention: 'error', manual: 'warning', paused: 'warning', waiting: 'info', running: 'success', idle: 'neutral' } as const;

export function RuleStatusChip({ rule, now, messages, className }: RuleStatusChipProps) {
  const { m } = useIotText(messages);
  const state = ruleState(rule, now);
  const text = {
    off: m.rules.statusOff, attention: m.rules.statusAttention, manual: m.rules.statusManual, paused: m.rules.statusPaused,
    waiting: fill(m.rules.statusWaiting, { time: countdown((rule.waitingUntil ?? now) - now) }), running: m.rules.statusRunning, idle: m.rules.statusIdle,
  }[state];
  return <Badge variant={VARIANT[state]} size="sm" className={className} data-state={state}>{text}</Badge>;
}
