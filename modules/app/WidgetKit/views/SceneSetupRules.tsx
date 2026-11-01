'use client';
// The Rules step of the Scene drawer (next-boilerplate phase 42.6, D42-11): the rules of a 3D design as a list of sentence cards
// with a form each. A rule targets a scene key of the chosen document (or every item), reads up to two conditions (a column of a
// row, or a board parameter) and sets the effects the 3D card shows: colour, hide, label, pulse, outline. The condition form and
// the colour control are the diagram editor's (`SceneRulesEditor`); the edits, the sentence and the checks are `design-rules-logic.ts`.
//
// Controlled: the drawer holds the rules and passes every change on. A saved row this kind does not read is listed as it is and kept
// until the author deletes it (never dropped on its own); a rule that names a key the document does not have is flagged and kept.
import { useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Badge, CONTROL, PanelField, SMALL_BUTTON } from './scene-panel-ui';
import { ColorField, Condition, type ConditionEnv } from './scene-rules-form';
import { DEFAULT_RULES_MESSAGES } from './scene-editor-messages-panels';
import {
  DESIGN_ALL_TARGET, addDesignRule, describeDesignRule, designRuleIssues, duplicateDesignRule, isDesignRule, moveDesignRule, removeDesignRule,
  staleReferences, updateDesignRule, type RuleDialect, type RulesEdit,
} from './design-rules-logic';
import { RULE_STATES } from './scene-rules-logic';
import type { SceneSetupRulesMessages } from './scene-setup-messages';
import type { SceneKey } from './scene-binding-logic';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const TOKENS = ['{value}', '{value2}', '{label}', '{id}'] as const;

export interface SceneSetupRulesProps {
  rules: readonly unknown[];
  onChange: (next: unknown[]) => void;
  /** The scene keys of the chosen document: the targets (and the rows a condition may read). */
  keys: readonly SceneKey[];
  keysLoading?: boolean;
  /** The columns a condition may read (suggestions; any name may be typed). */
  columns?: ReadonlyArray<{ key: string; label?: string }>;
  /** The board parameters a condition may read (suggestions). */
  params?: ReadonlyArray<{ key: string; label?: string }>;
  messages: SceneSetupRulesMessages;
  /** `design` (default): the 3D card's effects (colour, hide, label, pulse, outline). `diagram`: a stored 2D diagram's (state, colour, hide, blink, label). */
  dialect?: RuleDialect;
  className?: string;
}

export function SceneSetupRules({ rules, onChange, keys, keysLoading, columns = [], params = [], messages: m, dialect = 'design', className }: SceneSetupRulesProps) {
  const base = useId();
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState('');
  const keyNames = useMemo(() => keys.map((k) => k.key), [keys]);
  const rowOptions = useMemo(() => keys.map((k) => ({ value: k.key, label: k.label && k.label !== k.key ? `${k.key} (${k.label})` : k.key })), [keys]);
  const issues = useMemo(() => {
    const out = new Map<number, Map<string, string>>();
    for (const i of designRuleIssues(rules, dialect)) {
      const hit = /^rules\.(\d+)(?:\.(\w+))?$/.exec(i.path);
      if (!hit) continue;
      const at = out.get(Number(hit[1])) ?? new Map<string, string>();
      // in the host's words when it has them (V1-B4): the code, worded by the messages; else the English sentence
      if (!at.has(hit[2] ?? '')) at.set(hit[2] ?? '', (i.ruleCode && m.issues?.[i.ruleCode]?.(i.n)) || i.message);
      out.set(Number(hit[1]), at);
    }
    return out;
  }, [rules, dialect, m]);
  const stale = useMemo(() => (keysLoading || keys.length === 0 ? [] : staleReferences(rules, keyNames)), [rules, keyNames, keys.length, keysLoading]);
  const staleOf = (index: number) => stale.filter((s) => s.index === index);

  const run = (edit: RulesEdit): RulesEdit => {
    setError(edit.refused ?? '');
    if (!edit.refused) onChange(edit.rules);
    return edit;
  };
  const env: ConditionEnv & { m: SceneSetupRulesMessages } = {
    m, base, columns: columns as ConditionEnv['columns'], params: params as ConditionEnv['params'],
    issue: (i, f) => {
      const own = issues.get(i)?.get(f);
      if (own || (f !== 'of' && f !== 'of2')) return own;
      const s = stale.find((x) => x.index === i && x.field === f);
      return s ? m.staleOf(s.name) : undefined;
    },
  };
  const labels = {
    // a value by the name a person knows it by ("Reading", never `value`; next-boilerplate e2e round 5, E14)
    columnLabel: (key: string) => columns.find((c) => c.key === key && c.label && c.label !== c.key)?.label ?? (m.valueNames ?? DEFAULT_RULES_MESSAGES.valueNames)?.[key],
    paramLabel: (key: string) => params.find((p) => p.key === key)?.label,
  };
  const total = [...issues.values()].reduce((n, x) => n + x.size, 0);
  const canAdd = keys.length > 0;

  const add = () => {
    const r = run(addDesignRule(rules, {}, undefined, dialect));
    if (r.index !== undefined && !r.refused) setOpen(r.index);
  };

  return (
    <div className={cn('space-y-3', className)} data-panel="design-rules">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-xs text-text-secondary">{m.summary(rules.length, total)}</p>
        <button
          type="button" onClick={add} disabled={!canAdd}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50"
        >
          {m.add}
        </button>
      </div>
      {!canAdd && !keysLoading && <p className="text-xs text-text-secondary">{m.needKeys}</p>}
      {error && <p role="alert" className="rounded-md bg-error-subtle px-3 py-2 text-xs text-error-fg">{error}</p>}
      {rules.length === 0 && canAdd && <p className="text-xs text-text-secondary">{m.empty}</p>}
      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((rule, index) => {
            const name = m.ruleN(index + 1);
            if (!isDesignRule(rule, dialect)) {
              return (
                <li key={index} data-rule={index} data-foreign="true" className="rounded-lg border border-error bg-surface-raised p-2">
                  <p className="text-sm font-medium text-text-primary">{dialect === 'diagram' ? m.foreignTitle2d : m.foreignTitle} ({name})</p>
                  <p className="text-xs text-text-secondary">{dialect === 'diagram' ? m.foreignBody2d : m.foreignBody}</p>
                  <pre className="mt-1 max-h-24 overflow-auto rounded bg-surface-sunken p-1.5 text-[11px] text-text-secondary">{safeJson(rule)}</pre>
                  <button type="button" className={cn(SMALL_BUTTON, 'mt-1 hover:text-error')} aria-label={`${m.delete}: ${name}`} onClick={() => run(removeDesignRule(rules, index))}>{m.delete}</button>
                </li>
              );
            }
            const isOpen = open === index;
            const problems = issues.get(index)?.size ?? 0;
            const stales = staleOf(index);
            return (
              <li key={index} data-rule={index} className={cn('rounded-lg border bg-surface-raised', isOpen ? 'border-primary' : 'border-border')}>
                <div className="flex items-start gap-2 p-2">
                  <input
                    type="checkbox" checked={rule.enabled !== false && rule.enabled !== 'false'} aria-label={`${m.enabled}: ${name}`}
                    className="mt-1 h-4 w-4 shrink-0 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus"
                    onChange={(e) => run(updateDesignRule(rules, index, { enabled: e.target.checked }, dialect))}
                  />
                  <button
                    type="button" aria-expanded={isOpen} aria-controls={`${base}-rule-${index}`} onClick={() => setOpen(isOpen ? null : index)}
                    className="min-w-0 flex-1 rounded text-left text-sm leading-snug text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    {describeDesignRule(rule, m.words, { withTarget: true, ...labels })}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
                  {problems > 0 && <Badge tone="error">{m.problems(problems)}</Badge>}
                  {stales.length > 0 && <Badge tone="warning" title={stales.map((s) => (s.field === 'target' ? m.staleTarget(s.name) : m.staleOf(s.name))).join(' ')}>{m.staleBadge}</Badge>}
                  <span className="ml-auto flex items-center gap-0.5">
                    <button type="button" className={SMALL_BUTTON} disabled={index === 0} aria-label={`${m.moveUp}: ${name}`} onClick={() => { const r = run(moveDesignRule(rules, index, 'up')); if (r.index !== undefined && open === index) setOpen(r.index); }}>↑</button>
                    <button type="button" className={SMALL_BUTTON} disabled={index >= rules.length - 1} aria-label={`${m.moveDown}: ${name}`} onClick={() => { const r = run(moveDesignRule(rules, index, 'down')); if (r.index !== undefined && open === index) setOpen(r.index); }}>↓</button>
                    <button type="button" className={SMALL_BUTTON} aria-label={`${m.duplicate}: ${name}`} onClick={() => { const r = run(duplicateDesignRule(rules, index)); if (r.index !== undefined && !r.refused) setOpen(r.index); }}>{m.duplicate}</button>
                    <button
                      type="button" className={cn(SMALL_BUTTON, 'hover:text-error')} aria-label={`${m.delete}: ${name}`}
                      onClick={() => { const r = run(removeDesignRule(rules, index)); if (!r.refused) setOpen((o) => (o === null || o === index ? null : o > index ? o - 1 : o)); }}
                    >
                      {m.delete}
                    </button>
                  </span>
                </div>
                {isOpen && (
                  <div id={`${base}-rule-${index}`} className="space-y-3 border-t border-border p-3">
                    <RuleForm env={env} index={index} rule={rule} rules={rules} rowOptions={rowOptions} stale={stales} run={run} dialect={dialect} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 1).slice(0, 400);
  } catch {
    return String(v);
  }
}

function RuleForm({
  env, index, rule, rules, rowOptions, stale, run, dialect,
}: {
  env: ConditionEnv & { m: SceneSetupRulesMessages }; index: number; rule: Rec; rules: readonly unknown[]; rowOptions: Array<{ value: string; label: string }>;
  stale: ReturnType<typeof staleReferences>; run: (edit: RulesEdit) => RulesEdit; dialect: RuleDialect;
}) {
  const { m, base } = env;
  const [second, setSecond] = useState(false);
  const label = useRef<HTMLInputElement>(null);
  const id = (k: string) => `${base}-${index}-${k}`;
  const set = (patch: Rec) => run(updateDesignRule(rules, index, patch, dialect));
  const hasSecond = !!str(rule.op2) || second;
  const target = str(rule.target);

  const choices = (current: string, extra: Array<{ value: string; label: string }>) => {
    const known = new Set(extra.map((o) => o.value));
    return current && !known.has(current) ? [...extra, { value: current, label: m.missing(current) }] : extra;
  };
  const tri = (key: 'hidden' | 'pulse' | 'highlight' | 'blink', title: string, yes: string, no: string) => {
    const v = rule[key] === true || rule[key] === 'true' ? 'true' : rule[key] === false || rule[key] === 'false' ? 'false' : '';
    return (
      <PanelField id={id(key)} label={title} error={env.issue(index, key)}>
        <select id={id(key)} className={CONTROL} value={v} onChange={(e) => set({ [key]: e.target.value })}>
          <option value="">{m.noChange}</option>
          <option value="true">{yes}</option>
          <option value="false">{no}</option>
        </select>
      </PanelField>
    );
  };
  const insertToken = (token: string) => {
    const el = label.current;
    const cur = str(rule.label);
    const at = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? at;
    set({ label: `${cur.slice(0, at)}${token}${cur.slice(end)}` });
    el?.focus();
  };
  const paramTokens = env.params.slice(0, 4).map((p) => `{param:${p.key}}`);

  return (
    <>
      <PanelField id={id('target')} label={m.appliesTo} error={env.issue(index, 'target') ?? (stale.some((s) => s.field === 'target' && s.name === target) ? m.staleTarget(target) : undefined)}>
        <select id={id('target')} className={CONTROL} value={target} aria-invalid={!!env.issue(index, 'target') || undefined} onChange={(e) => set({ target: e.target.value })}>
          {!target && <option value="" disabled>-</option>}
          {choices(target === DESIGN_ALL_TARGET ? '' : target, [{ value: DESIGN_ALL_TARGET, label: m.allItems }, ...rowOptions]).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </PanelField>

      <fieldset className="space-y-2 rounded-md border border-border p-2.5">
        <legend className="px-1 text-xs font-medium text-text-secondary">{m.when}</legend>
        <Condition env={env} index={index} rule={rule} n="" set={set} choices={choices} rowOptions={rowOptions} />
        {!!str(rule.op) && !hasSecond && (
          <button type="button" className={SMALL_BUTTON} onClick={() => { setSecond(true); set({ op2: 'eq', source2: 'column', join: str(rule.join) || 'all' }); }}>{m.addSecond}</button>
        )}
      </fieldset>

      {hasSecond && !!str(rule.op) && (
        <fieldset className="space-y-2 rounded-md border border-border p-2.5">
          <legend className="px-1 text-xs font-medium text-text-secondary">{m.secondCondition}</legend>
          <PanelField id={id('join')} label={m.join} error={env.issue(index, 'join')}>
            <select id={id('join')} className={CONTROL} value={str(rule.join) || 'all'} onChange={(e) => set({ join: e.target.value })}>
              <option value="all">{m.joinAll}</option>
              <option value="any">{m.joinAny}</option>
            </select>
          </PanelField>
          <Condition env={env} index={index} rule={rule} n="2" set={set} choices={choices} rowOptions={rowOptions} />
          <button type="button" className={SMALL_BUTTON} onClick={() => { setSecond(false); set({ op2: '', key2: '', of2: '', value2: '', to2: '', source2: '', join: '' }); }}>{m.removeSecond}</button>
        </fieldset>
      )}

      <fieldset className="space-y-3 rounded-md border border-border p-2.5">
        <legend className="px-1 text-xs font-medium text-text-secondary">{m.then}</legend>
        {dialect === 'diagram' && (
          <PanelField id={id('state')} label={m.state} error={env.issue(index, 'state')}>
            <select id={id('state')} className={CONTROL} value={str(rule.state)} onChange={(e) => set({ state: e.target.value })}>
              <option value="">{m.noChange}</option>
              {RULE_STATES.map((st) => <option key={st} value={st}>{m.states[st] ?? st}</option>)}
            </select>
          </PanelField>
        )}
        <ColorField id={id('color')} title={m.colour} value={str(rule.color)} onChange={(v) => set({ color: v })} error={env.issue(index, 'color')} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {tri('hidden', m.hidden, m.hide, m.show)}
          {dialect === 'diagram' ? tri('blink', m.blink, m.blinkOn, m.blinkOff) : (
            <>
              {tri('pulse', m.pulse, m.pulseOn, m.pulseOff)}
              {tri('highlight', m.highlight, m.highlightOn, m.highlightOff)}
            </>
          )}
        </div>
        <PanelField id={id('label')} label={m.label} error={env.issue(index, 'label')}>
          <input
            ref={label} id={id('label')} type="text" className={CONTROL} value={str(rule.label)} maxLength={80} placeholder="High: {value}"
            aria-describedby={`${id('label')}-tokens`} onChange={(e) => set({ label: e.target.value })}
          />
          <div id={`${id('label')}-tokens`} role="group" aria-label={m.tokens} className="mt-1.5 flex flex-wrap gap-1">
            {[...TOKENS, ...paramTokens].map((t) => (
              <button
                key={t} type="button" aria-label={m.insertToken(t)} onClick={() => insertToken(t)}
                className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                {t}
              </button>
            ))}
          </div>
        </PanelField>
        <label htmlFor={id('stop')} className="flex items-start gap-2 text-sm text-text-secondary">
          <input
            id={id('stop')} type="checkbox" checked={rule.stop === true || rule.stop === 'true'} aria-describedby={`${id('stop')}-help`} onChange={(e) => set({ stop: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus"
          />
          <span>
            {m.stop}
            <span id={`${id('stop')}-help`} className="block text-[11px] leading-snug">{m.stopHelp}</span>
          </span>
        </label>
      </fieldset>
    </>
  );
}
