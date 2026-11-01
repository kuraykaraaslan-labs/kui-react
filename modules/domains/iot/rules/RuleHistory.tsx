'use client';
import { cn } from '@/libs/utils/cn';
import { EmptyState } from '@/modules/ui/EmptyState';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import type { RuleRun } from '../types/rules';
import { when } from './rule-format';

/**
 * RuleHistory — what a rule did the last times it ran, newest first, each one line in words with its time and a mark that says whether
 * it went through (docs/concepts/iot-rules 05 §5.1). The host keeps the list (a short, bounded one); this only draws it.
 */
export interface RuleHistoryProps {
  runs: readonly RuleRun[];
  now: number;
  loading?: boolean;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
}

export function RuleHistory({ runs, now, loading = false, locale, messages, className }: RuleHistoryProps) {
  const { m } = useIotText(messages);
  if (loading) return <p role="status" className="text-sm text-text-secondary">{m.rules.historyLoading}</p>;
  if (!runs.length) return <EmptyState title={m.rules.historyEmpty} />;
  return (
    <ol className={cn('flex flex-col divide-y divide-border', className)} aria-label={m.rules.history}>
      {runs.map((r, i) => (
        <li key={`${r.at}-${i}`} className="flex items-start gap-3 py-2 text-sm" data-ok={r.ok}>
          <span className={cn('mt-0.5 shrink-0 text-xs font-medium', r.ok ? 'text-success-fg' : 'text-error-fg')}>{r.ok ? m.rules.runOk : m.rules.runFailed}</span>
          <span className="min-w-0 flex-1 text-text-primary">{r.text}</span>
          <time className="shrink-0 text-xs text-text-secondary" dateTime={new Date(r.at).toISOString()}>{when(r.at, now, locale)}</time>
        </li>
      ))}
    </ol>
  );
}
