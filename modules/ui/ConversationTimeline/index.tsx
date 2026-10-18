'use client';
// modules/ui/ConversationTimeline/index.tsx
//
// ConversationTimeline — a vertical timeline of an AI investigation: model calls, tool calls, evidence it read, and
// whether each citation was kept or dropped, with tokens, cost and time per step and a total. Every step names its
// type in text, so the timeline reads without the icons or colours. Details (arguments, raw results) collapse.

import { useId, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan, faCheck, faChevronDown, faFileLines, faSpinner, faTriangleExclamation, faWandMagicSparkles, faWrench,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { cn } from '@/libs/utils/cn';
import { fillMessage, formatCompact, formatDurationMs } from '../_shared/format';
import { computeTotals, formatCost, type ConversationStep, type StepType, type Totals } from './model';

export type { ConversationStep, StepType, StepStatus, StepTokens, Totals } from './model';
export { computeTotals, formatCost } from './model';

export type ConversationTimelineMessages = {
  label: string;
  totalLabel: string;
  steps: string;
  tokens: string;
  cost: string;
  time: string;
  /** `{input}`, `{output}` */
  tokensInOut: string;
  /** `{count}` */
  cached: string;
  /** `{kept}`, `{dropped}` */
  citations: string;
  /** `{count}` */
  errors: string;
  types: Record<StepType, string>;
  citationKept: string;
  citationDropped: string;
  running: string;
  failed: string;
  show: string;
  hide: string;
  input: string;
  output: string;
  reason: string;
  empty: string;
};

export const DEFAULT_CONVERSATION_TIMELINE_MESSAGES: ConversationTimelineMessages = {
  label: 'Investigation timeline',
  totalLabel: 'Total',
  steps: 'Steps',
  tokens: 'Tokens',
  cost: 'Cost',
  time: 'Time',
  tokensInOut: '{input} in · {output} out',
  cached: '{count} cached',
  citations: 'Citations',
  errors: '{count} failed',
  types: { model: 'Model call', tool: 'Tool call', evidence: 'Evidence', citation: 'Citation' },
  citationKept: 'kept',
  citationDropped: 'dropped',
  running: 'running',
  failed: 'failed',
  show: 'Show details',
  hide: 'Hide details',
  input: 'Input',
  output: 'Output',
  reason: 'Reason',
  empty: 'Nothing has happened yet.',
};

export type ConversationTimelineProps = {
  steps: ConversationStep[];
  /** Totals to show instead of the sums of the steps (when the steps are a page of a longer run). */
  totals?: Partial<Totals>;
  /** ISO currency code of `cost`. Default = USD. */
  currency?: string;
  locale?: string;
  /** Expanded step ids (controlled). */
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Hide the totals block. */
  hideTotals?: boolean;
  messages?: Partial<ConversationTimelineMessages>;
  className?: string;
};

const TYPE_ICON: Record<StepType, IconDefinition> = {
  model: faWandMagicSparkles,
  tool: faWrench,
  evidence: faFileLines,
  citation: faCheck,
};

const RAIL: Record<StepType, string> = {
  model: 'border-secondary text-secondary',
  tool: 'border-info text-info',
  evidence: 'border-primary text-primary',
  citation: 'border-success text-success',
};

export function ConversationTimeline({
  steps,
  totals,
  currency = 'USD',
  locale,
  expandedIds,
  defaultExpandedIds,
  onExpandedChange,
  hideTotals = false,
  messages,
  className,
}: ConversationTimelineProps) {
  const msg = useMemo(() => ({ ...DEFAULT_CONVERSATION_TIMELINE_MESSAGES, ...messages, types: { ...DEFAULT_CONVERSATION_TIMELINE_MESSAGES.types, ...messages?.types } }), [messages]);
  const uid = useId();
  const total = useMemo(() => ({ ...computeTotals(steps), ...totals }), [steps, totals]);
  const [local, setLocal] = useState<string[]>(defaultExpandedIds ?? []);
  const open = new Set(expandedIds ?? local);
  const toggle = (id: string) => {
    const next = open.has(id) ? [...open].filter((x) => x !== id) : [...open, id];
    if (expandedIds === undefined) setLocal(next);
    onExpandedChange?.(next);
  };
  const hasTokens = total.inputTokens > 0 || total.outputTokens > 0;

  return (
    <section aria-label={msg.label} className={cn('flex flex-col gap-4', className)}>
      {!hideTotals && steps.length > 0 && (
        <dl data-part="totals" aria-label={msg.totalLabel} className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface-raised p-3 text-sm sm:grid-cols-4">
          <Stat label={msg.steps} value={String(total.steps)} />
          <Stat
            label={msg.tokens}
            value={hasTokens ? fillMessage(msg.tokensInOut, { input: formatCompact(total.inputTokens), output: formatCompact(total.outputTokens) }) : '–'}
            note={total.cachedTokens > 0 ? fillMessage(msg.cached, { count: formatCompact(total.cachedTokens) }) : undefined}
          />
          <Stat label={msg.cost} value={total.cost > 0 ? formatCost(total.cost, currency, locale) : '–'} />
          <Stat
            label={msg.time}
            value={total.durationMs > 0 ? formatDurationMs(total.durationMs) : '–'}
            note={total.errors > 0 ? fillMessage(msg.errors, { count: total.errors }) : undefined}
            noteTone="error"
          />
          {total.citationsKept + total.citationsDropped > 0 && (
            <Stat
              label={msg.citations}
              value={`${total.citationsKept} ${msg.citationKept}`}
              note={total.citationsDropped > 0 ? `${total.citationsDropped} ${msg.citationDropped}` : undefined}
              noteTone="warning"
            />
          )}
        </dl>
      )}

      {steps.length === 0 ? (
        <p className="text-sm text-text-secondary">{msg.empty}</p>
      ) : (
        <ol className="flex flex-col">
          {steps.map((s, i) => {
            const dropped = s.type === 'citation' && !s.citation?.kept;
            const failed = s.status === 'error';
            const running = s.status === 'running';
            const icon = running ? faSpinner : failed ? faTriangleExclamation : dropped ? faBan : TYPE_ICON[s.type];
            const typeText = s.type === 'citation'
              ? `${msg.types.citation} ${s.citation?.kept ? msg.citationKept : msg.citationDropped}`
              : msg.types[s.type];
            const details = Boolean(s.input || s.output || (dropped && s.citation?.reason));
            const expanded = open.has(s.id);
            const metrics: string[] = [];
            if (s.tokens && (s.tokens.input || s.tokens.output)) metrics.push(fillMessage(msg.tokensInOut, { input: formatCompact(s.tokens.input ?? 0), output: formatCompact(s.tokens.output ?? 0) }));
            if (s.cost !== undefined) metrics.push(formatCost(s.cost, currency, locale));
            if (s.durationMs !== undefined) metrics.push(formatDurationMs(s.durationMs));
            return (
              <li key={s.id} data-step-type={s.type} data-dropped={dropped || undefined} data-status={s.status} className="relative flex gap-3 pb-5 last:pb-0">
                {i < steps.length - 1 && <span aria-hidden="true" className="absolute inset-y-0 start-3.5 w-px bg-border" />}
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-surface-base text-xs',
                    dropped ? 'border-dashed border-warning text-warning-fg' : failed ? 'border-error text-error' : RAIL[s.type],
                  )}
                >
                  <FontAwesomeIcon icon={icon} className={cn('h-3 w-3', running && 'animate-spin motion-reduce:animate-none')} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-text-secondary">{typeText}</span>
                    <h4 className={cn('min-w-0 break-words text-sm font-medium text-text-primary', dropped && 'line-through decoration-warning')}>{s.title}</h4>
                    {s.model && <span className="text-xs text-text-secondary">{s.model}</span>}
                    {running && <span className="text-xs font-medium text-text-secondary">({msg.running})</span>}
                    {failed && <span className="text-xs font-medium text-error-fg">({msg.failed})</span>}
                  </div>
                  {s.summary && <p className="break-words text-sm text-text-secondary">{s.summary}</p>}
                  {metrics.length > 0 && <p className="text-xs text-text-disabled" data-part="metrics">{metrics.join(' · ')}</p>}
                  {details && (
                    <>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`${uid}-${s.id}`}
                        onClick={() => toggle(s.id)}
                        className="inline-flex w-fit items-center gap-1 rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                      >
                        <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" className={cn('h-2.5 w-2.5 transition-transform motion-reduce:transition-none', !expanded && '-rotate-90 rtl:rotate-90')} />
                        {expanded ? msg.hide : msg.show}
                      </button>
                      <div id={`${uid}-${s.id}`} hidden={!expanded} className="flex flex-col gap-2">
                        {dropped && s.citation?.reason && <p className="text-xs text-warning-fg">{msg.reason}: {s.citation.reason}</p>}
                        {s.input && <Block label={msg.input} text={s.input} />}
                        {s.output && <Block label={msg.output} text={s.output} />}
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Stat({ label, value, note, noteTone }: { label: string; value: string; note?: string; noteTone?: 'error' | 'warning' }) {
  return (
    <div>
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="font-semibold text-text-primary">{value}</dd>
      {note && <dd className={cn('text-xs', noteTone === 'error' ? 'text-error-fg' : noteTone === 'warning' ? 'text-warning-fg' : 'text-text-secondary')}>{note}</dd>}
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-sunken p-2 font-mono text-xs text-text-primary">{text}</pre>
    </div>
  );
}
