'use client';
import { cn } from '@/libs/utils/cn';
import { fill } from '../format';
import type { OtaMessages, OtaMessagesInput } from './messages';
import { otaStateLabel } from './OtaStateBadge';
import { useOtaText } from './OtaText';
import { OTA_STATES, type OtaState } from './types';

/** Bar colours per state: done green, failed red, on the way blue, waiting / queued / left out grey. */
const STATE_COLOR: Record<OtaState, string> = {
  UPDATED: 'bg-success', FAILED: 'bg-error', TIMEOUT: 'bg-error', ROLLED_BACK: 'bg-error',
  INITIATED: 'bg-info', DOWNLOADING: 'bg-info', DOWNLOADED: 'bg-info', VERIFIED: 'bg-info', UPDATING: 'bg-primary',
  QUEUED: 'bg-border-strong', WAITING: 'bg-text-disabled', SKIPPED: 'bg-surface-overlay', CANCELLED: 'bg-surface-overlay',
};

export interface OtaStateBarProps {
  counts: Partial<Record<OtaState, number>>;
  messages?: OtaMessagesInput | OtaMessages;
  /** The bar only (a table cell): the counts stay in the bar's accessible name. */
  compact?: boolean;
  className?: string;
}

/** The devices of a package (or of one wave) by state: one stacked bar and its legend (counts in words, so the bar is not the only carrier). */
export function OtaStateBar({ counts, messages, compact, className }: OtaStateBarProps) {
  const { m } = useOtaText(messages as OtaMessagesInput);
  const parts = OTA_STATES.map((s) => ({ s, n: counts[s] ?? 0 })).filter((p) => p.n > 0);
  const total = parts.reduce((a, p) => a + p.n, 0);
  return (
    <div className={cn(compact ? '' : 'space-y-2', className)} data-ota-state-bar>
      <div
        className={cn('flex w-full overflow-hidden rounded-full bg-surface-sunken', compact ? 'h-2' : 'h-3')}
        role="img" aria-label={`${m.rollout.legend}: ${parts.map((p) => `${otaStateLabel(m, p.s)} ${p.n}`).join(', ') || fill(m.rollout.total, { n: 0 })}`}
      >
        {total > 0 && parts.map((p) => <div key={p.s} className={STATE_COLOR[p.s]} style={{ width: `${(p.n / total) * 100}%` }} />)}
      </div>
      {!compact && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
          <li className="font-medium text-text-primary">{fill(m.rollout.total, { n: total })}</li>
          {parts.map((p) => (
            <li key={p.s} className="inline-flex items-center gap-1.5">
              <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', STATE_COLOR[p.s])} aria-hidden />
              {otaStateLabel(m, p.s)} <span className="tabular-nums text-text-primary">{p.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
