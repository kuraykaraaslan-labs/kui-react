'use client';
// The problems list: what is wrong or close to wrong in the diagram (the edit model's checks plus the rules'), grouped by
// severity, each one a button that selects what it is about. With nothing wrong it says so.
import { useMemo } from 'react';
import { cn } from '@/libs/utils/cn';
import { problems, type Problem, type ProblemSeverity } from './scene-edit-problems';
import { mergeMessages, DEFAULT_PROBLEMS_MESSAGES, type DeepPartial, type ProblemsMessages } from './scene-editor-messages-panels';
import type { EditorCtx } from './scene-editor-types';
import { Badge } from './scene-panel-ui';
import { problemTarget, ruleProblems } from './scene-problems-rules';

export interface SceneProblemsProps {
  ctx: EditorCtx;
  /**
   * Called with what a problem is about: a symbol id, `link:<index>`, `shape:<index>`, or `scene`. A rule problem passes
   * its rule's target (a symbol id, `link:<index>`) or `scene` when the rule names nothing that exists.
   */
  onSelect: (id: string) => void;
  /** Also called, before `onSelect`, for a problem about a rule, with the rule's index (a shell opens the Rules tab with it). */
  onOpenRule?: (index: number) => void;
  /** Any part of the panel's texts, in the host's language. */
  messages?: DeepPartial<ProblemsMessages>;
  className?: string;
}

const ORDER: ProblemSeverity[] = ['error', 'warning', 'info'];
const TONE = { error: 'error', warning: 'warning', info: 'info' } as const;

export function SceneProblems({ ctx, onSelect, onOpenRule, messages, className }: SceneProblemsProps) {
  const m = useMemo(() => mergeMessages<ProblemsMessages>(DEFAULT_PROBLEMS_MESSAGES, messages), [messages]);
  const { settings, data, host } = ctx;
  const list = useMemo(
    () => problems(settings, data, { extra: [ruleProblems({ params: host.params, columns: host.columns }), ...(host.problems ? [host.problems] : [])] }),
    [settings, data, host.params, host.columns, host.problems],
  );
  const by = (s: ProblemSeverity) => list.filter((p) => p.severity === s);
  const text = (p: Problem) => m.text?.(p) ?? p.message;

  const pick = (p: Problem) => {
    const to = problemTarget(p, settings);
    if (to.rule !== undefined) onOpenRule?.(to.rule);
    onSelect(to.select);
  };

  return (
    <section aria-label={m.title} className={cn('space-y-3', className)} data-panel="problems">
      {list.length === 0 ? (
        <p role="status" className="rounded-md bg-success-subtle px-3 py-2 text-sm text-success-fg">{m.empty}</p>
      ) : (
        <>
          <p role="status" className="text-xs text-text-secondary">{m.summary(by('error').length, by('warning').length, by('info').length)}</p>
          {ORDER.map((sev) => {
            const items = by(sev);
            if (!items.length) return null;
            return (
              <section key={sev} aria-label={m.groups[sev]} data-severity={sev}>
                <h3 className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                  {m.groups[sev]}
                  <Badge tone={TONE[sev]}>{items.length}</Badge>
                </h3>
                <ul className="space-y-1.5">
                  {items.map((p, i) => (
                    <li key={`${p.code}:${p.id}:${i}`}>
                      <button
                        type="button" data-code={p.code} data-id={p.id} onClick={() => pick(p)} aria-label={m.select(p.id, text(p))}
                        className="flex w-full flex-col gap-0.5 rounded-md border border-border bg-surface-raised px-3 py-2 text-left hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                      >
                        <span className="text-sm leading-snug text-text-primary">{text(p)}</span>
                        <span className="font-mono text-[10px] text-text-secondary">{p.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}
