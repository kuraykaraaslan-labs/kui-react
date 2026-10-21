'use client';
// The rules editor of the diagram editor: the rules that target the selection first, then the other rules grouped by
// target, then the `*` rules. Each rule is a sentence card ("When Temperature of this symbol is above 24, set the state
// to warning and show 'High'") with a form for the condition, the effects, the order and whether it is on, and a live
// mark for whether it holds for the data right now. Every change is one `scene-rules-edit` operation through `ctx.apply`.
import { useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FieldControl } from '../../SchemaForm/fields/FieldControl';
import { MEDIUM_OPTIONS } from '../templates/scada';
import { SCADA_SYMBOL_DEFS, isScadaSymbol, type SymbolDef } from './scada-logic';
import { SCENE_COLUMNS } from './scada-scene-logic';
import { elementIds, isRec, linkIds, targetNames, type EditResult, type Rec } from './scene-edit-core';
import { mergeMessages, DEFAULT_RULES_MESSAGES, type DeepPartial, type RulesMessages } from './scene-editor-messages-panels';
import type { EditorCtx } from './scene-editor-types';
import { Badge, CONTROL, PanelField, SMALL_BUTTON } from './scene-panel-ui';
import {
  addRule, describeRule, duplicateRule, moveRule, removeRule, ruleContext, ruleMatchFor, rulesFor, rulesOf, ruleTargets, updateRule, type RuleMatch,
} from './scene-rules-edit';
import { validateRules } from './scene-rules-logic';

export interface SceneRulesEditorProps {
  ctx: EditorCtx;
  /** Any part of the editor's texts, in the host's language. */
  messages?: DeepPartial<RulesMessages>;
  className?: string;
}

const NEEDS_VALUE = new Set(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in']);
const NUMERIC = new Set(['gt', 'gte', 'lt', 'lte', 'between']);
const OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'set', 'unset', 'true', 'false'] as const;
const STATES = ['idle', 'running', 'warning', 'critical', 'off'] as const;
const MODES = ['auto', 'manual', 'local', 'maintenance', 'lockout', 'simulation'] as const;
const QUALITIES = ['good', 'stale', 'bad', 'offline'] as const;
const TOKENS = ['{value}', '{value2}', '{label}', '{id}'] as const;

const MEDIUMS = MEDIUM_OPTIONS.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

interface Env {
  m: RulesMessages;
  base: string;
  ctx: EditorCtx;
  run: (op: (s: EditorCtx['settings']) => EditResult, group?: string) => EditResult;
  /** Symbols then connection ids, as the pickers list them. */
  names: Array<{ id: string; text: string }>;
  columns: Array<{ key: string; label?: string }>;
  params: NonNullable<EditorCtx['host']['params']>;
  issue: (index: number, field: string) => string | undefined;
}

export function SceneRulesEditor({ ctx, messages, className }: SceneRulesEditorProps) {
  const m = useMemo(() => mergeMessages<RulesMessages>(DEFAULT_RULES_MESSAGES, messages), [messages]);
  const base = useId();
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState('');
  const s = ctx.settings;
  const list = rulesOf(s);

  const run: Env['run'] = (op, group) => {
    const r = ctx.apply(op, group);
    setError(r.refused ? m.refused(r.refused) : '');
    return r;
  };

  const targets = ruleTargets(s, ctx.selection);
  const groups = rulesFor(s, targets);
  const names = useMemo(() => {
    const out: Array<{ id: string; text: string }> = [];
    for (const e of Array.isArray(s.elements) ? (s.elements as unknown[]) : []) {
      if (!isRec(e) || typeof e.id !== 'string') continue;
      const own = typeof e.label === 'string' && e.label ? e.label : isScadaSymbol(e.symbol) ? (SCADA_SYMBOL_DEFS[e.symbol] as SymbolDef).label : '';
      out.push({ id: e.id, text: own ? `${e.id} (${own})` : e.id });
    }
    for (const id of linkIds(s)) out.push({ id, text: id });
    return out;
  }, [s]);

  const columns = useMemo((): Array<{ key: string; label?: string }> => {
    if (ctx.host.columns?.length) return ctx.host.columns;
    const declared = ctx.data.points?.columns;
    if (declared?.length) return declared.map((c) => ({ key: c.key, label: c.label }));
    return SCENE_COLUMNS.map((key) => ({ key }));
  }, [ctx.host.columns, ctx.data.points?.columns]);
  const params = ctx.host.params ?? [];

  const issues = useMemo(() => {
    const out = new Map<number, Map<string, string>>();
    for (const i of validateRules(list, { elementIds: elementIds(s), linkIds: linkIds(s) })) {
      const hit = /^rules\.(\d+)\.(\w+)$/.exec(i.path);
      if (!hit) continue;
      const at = out.get(Number(hit[1])) ?? new Map<string, string>();
      if (!at.has(hit[2])) at.set(hit[2], i.message);
      out.set(Number(hit[1]), at);
    }
    return out;
  }, [list, s]);

  // Whether each rule holds for the real data right now.
  const matches = useMemo(() => {
    const rc = ruleContext(s, ctx.data.points, ctx.params);
    const all = [...targetNames(s)];
    const out = new Map<number, RuleMatch>();
    list.forEach((r, i) => { if (isRec(r)) out.set(i, ruleMatchFor(r, all, rc)); });
    return out;
  }, [list, s, ctx.data.points, ctx.params]);

  const env: Env = { m, base, ctx, run, names, columns, params, issue: (i, f) => issues.get(i)?.get(f) };
  const labels = {
    columnLabel: (key: string) => columns.find((c) => c.key === key)?.label,
    paramLabel: (key: string) => params.find((p) => p.key === key)?.label,
  };

  const add = () => {
    const r = run((cur) => addRule(cur, targets[0] ? { target: targets[0] } : {}));
    if (r.index !== undefined && !r.refused) setOpen(r.index);
  };
  const after = (r: { index?: number; refused?: string }) => { if (!r.refused && r.index !== undefined) setOpen(r.index); };

  const card = (index: number, group: readonly number[]) => {
    const rule = list[index];
    if (!isRec(rule)) return null;
    const isOpen = open === index;
    const match = matches.get(index);
    const problems = issues.get(index)?.size ?? 0;
    const n = index + 1;
    const at = group.indexOf(index);
    const ruleName = m.ruleN(n);
    return (
      <li key={index} data-rule={index} className={cn('rounded-lg border bg-surface-raised', isOpen ? 'border-primary' : 'border-border')}>
        <div className="flex items-start gap-2 p-2">
          <input
            type="checkbox" checked={rule.enabled !== false} aria-label={`${m.enabled}: ${ruleName}`} className="mt-1 h-4 w-4 shrink-0 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus"
            onChange={(e) => run((cur) => updateRule(cur, index, { enabled: e.target.checked }))}
          />
          <button
            type="button" aria-expanded={isOpen} aria-controls={`${base}-rule-${index}`} onClick={() => setOpen(isOpen ? null : index)}
            className={cn('min-w-0 flex-1 rounded text-left text-sm leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', rule.enabled === false ? 'text-text-secondary' : 'text-text-primary')}
          >
            {describeRule(rule, m.words, labels)}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
          <MatchBadge m={m} rule={rule} match={match} />
          {problems > 0 && <Badge tone="error">{problems === 1 ? '1 problem' : `${problems} problems`}</Badge>}
          <span className="ml-auto flex items-center gap-0.5">
            <button type="button" className={SMALL_BUTTON} disabled={at <= 0} aria-label={`${m.moveUp}: ${ruleName}`} onClick={() => after(run((cur) => moveRule(cur, index, 'up', group)))}>↑</button>
            <button type="button" className={SMALL_BUTTON} disabled={at < 0 || at >= group.length - 1} aria-label={`${m.moveDown}: ${ruleName}`} onClick={() => after(run((cur) => moveRule(cur, index, 'down', group)))}>↓</button>
            <button type="button" className={SMALL_BUTTON} aria-label={`${m.duplicate}: ${ruleName}`} onClick={() => after(run((cur) => duplicateRule(cur, index)))}>{m.duplicate}</button>
            <button
              type="button" className={cn(SMALL_BUTTON, 'hover:text-error')} aria-label={`${m.delete}: ${ruleName}`}
              onClick={() => {
                const r = run((cur) => removeRule(cur, index));
                if (!r.refused) setOpen((o) => (o === null ? null : o === index ? null : o > index ? o - 1 : o));
              }}
            >
              {m.delete}
            </button>
          </span>
        </div>
        {isOpen && (
          <div id={`${base}-rule-${index}`} className="space-y-3 border-t border-border p-3">
            <RuleForm env={env} index={index} rule={rule} />
          </div>
        )}
      </li>
    );
  };

  const section = (title: string, indices: readonly number[], key: string, heading: 'h3' | 'h4' = 'h3') => {
    const H = heading;
    return (
      <section key={key} aria-labelledby={`${base}-${key}`} className="space-y-2" data-group={key}>
        <H id={`${base}-${key}`} className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{title}</H>
        <ul className="space-y-2">{indices.map((i) => card(i, indices))}</ul>
      </section>
    );
  };

  const selectionName = targets.length === 1 ? names.find((x) => x.id === targets[0])?.text ?? targets[0] : targets.join(', ');
  const total = [...issues.values()].reduce((n, x) => n + x.size, 0);

  return (
    <div className={cn('space-y-4', className)} data-panel="rules">
      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-xs text-text-secondary">{m.summary(list.filter(isRec).length, total)}</p>
        <button
          type="button" onClick={add}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          {m.add}
        </button>
      </div>
      {error && <p role="alert" className="rounded-md bg-error-subtle px-3 py-2 text-xs text-error-fg">{error}</p>}
      {list.filter(isRec).length === 0 && <p className="text-xs leading-snug text-text-secondary">{m.empty}</p>}
      {targets.length > 0 && groups.own.length > 0 && section(m.forSelection(selectionName), groups.own, 'own')}
      {groups.star.length > 0 && section(m.everything, groups.star, 'star')}
      {groups.others.length > 0 && (
        <section aria-label={m.others} className="space-y-3" data-group="others">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{m.others}</h3>
          {groups.others.map((g) => section(g.target || m.noTarget, g.indices, `t-${g.target || 'none'}`, 'h4'))}
        </section>
      )}
    </div>
  );
}

function MatchBadge({ m, rule, match }: { m: RulesMessages; rule: Rec; match: RuleMatch | undefined }) {
  if (rule.enabled === false) return <Badge>{m.disabled}</Badge>;
  if (!match || match.total === 0) return <Badge tone="warning" title={m.matchingTitle}>{m.noTarget}</Badge>;
  const n = match.matching.length;
  if (n === 0) return <Badge title={m.matchingTitle}>{m.notMatching}</Badge>;
  if (match.total > 1 && n < match.total) return <Badge tone="success" title={match.matching.join(', ')}>{m.matchingSome(n, match.total)}</Badge>;
  return <Badge tone="success" title={m.matchingTitle}>{m.matching}</Badge>;
}

// ─── One rule's form ─────────────────────────────────────────────────────────

function RuleForm({ env, index, rule }: { env: Env; index: number; rule: Rec }) {
  const { m, base, run } = env;
  const [second, setSecond] = useState(false);
  const label = useRef<HTMLInputElement>(null);
  const id = (k: string) => `${base}-${index}-${k}`;
  const set = (patch: Rec, group?: string) => run((cur) => updateRule(cur, index, patch), group ?? `rule:${index}:${Object.keys(patch).join(',')}`);
  const hasSecond = !!str(rule.op2) || second;
  const target = str(rule.target);

  const choices = (current: string, extra: Array<{ value: string; label: string }>) => {
    const known = new Set(extra.map((o) => o.value));
    return current && !known.has(current) ? [...extra, { value: current, label: m.missing(current) }] : extra;
  };
  const rowOptions = env.names.map((x) => ({ value: x.id, label: x.text }));

  const tri = (key: 'dim' | 'blink' | 'hidden' | 'animate' | 'reverse' | 'ack' | 'pending' | 'failed', title: string, yes: string, no: string) => (
    <PanelField id={id(key)} label={title} error={env.issue(index, key)}>
      <select id={id(key)} className={CONTROL} value={str(rule[key])} onChange={(e) => set({ [key]: e.target.value })}>
        <option value="">{m.noChange}</option>
        <option value="true">{yes}</option>
        <option value="false">{no}</option>
      </select>
    </PanelField>
  );

  const insertToken = (token: string) => {
    const el = label.current;
    const cur = str(rule.label);
    const at = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? at;
    set({ label: `${cur.slice(0, at)}${token}${cur.slice(end)}` }, `rule:${index}:label`);
    el?.focus();
  };
  const paramTokens = env.params.slice(0, 4).map((p) => `{param:${p.key}}`);

  return (
    <>
      <PanelField id={id('target')} label={m.appliesTo} error={env.issue(index, 'target')}>
        <select id={id('target')} className={CONTROL} value={target} aria-invalid={!!env.issue(index, 'target') || undefined} onChange={(e) => set({ target: e.target.value })}>
          {!target && <option value="" disabled>-</option>}
          {choices(target === '*' ? '' : target, [{ value: '*', label: m.anySymbol }, ...rowOptions]).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          <button type="button" className={SMALL_BUTTON} onClick={() => { setSecond(false); set({ op2: '', key2: '', of2: '', value2: '', to2: '', source2: 'column' }); }}>{m.removeSecond}</button>
        </fieldset>
      )}

      <fieldset className="space-y-3 rounded-md border border-border p-2.5">
        <legend className="px-1 text-xs font-medium text-text-secondary">{m.then}</legend>
        <PanelField id={id('state')} label={m.state} error={env.issue(index, 'state')}>
          <select id={id('state')} className={CONTROL} value={str(rule.state)} onChange={(e) => set({ state: e.target.value })}>
            <option value="">{m.noChange}</option>
            {STATES.map((st) => <option key={st} value={st}>{m.states[st]}</option>)}
          </select>
        </PanelField>
        <ColorField id={id('color')} title={m.color} value={str(rule.color)} onChange={(v) => set({ color: v })} error={env.issue(index, 'color')} />
        <ColorField id={id('fillColor')} title={m.fillColor} value={str(rule.fillColor)} onChange={(v) => set({ fillColor: v })} error={env.issue(index, 'fillColor')} />
        <div className="grid grid-cols-2 gap-2">
          {tri('dim', m.passive, m.yes, m.no)}
          {tri('blink', m.blink, m.yes, m.no)}
          {tri('hidden', m.hidden, m.yes, m.no)}
          {tri('animate', m.motion, m.motionOn, m.motionStop)}
        </div>
        <fieldset className="space-y-3 rounded-md border border-border p-2.5">
          <legend className="px-1 text-xs font-medium text-text-secondary">{m.statesLegend}</legend>
          <div className="grid grid-cols-2 gap-2">
            <PanelField id={id('mode')} label={m.mode} error={env.issue(index, 'mode')}>
              <select id={id('mode')} className={CONTROL} value={str(rule.mode)} onChange={(e) => set({ mode: e.target.value })}>
                <option value="">{m.noChange}</option>
                {MODES.map((x) => <option key={x} value={x}>{m.modes[x]}</option>)}
              </select>
            </PanelField>
            <PanelField id={id('quality')} label={m.quality} error={env.issue(index, 'quality')}>
              <select id={id('quality')} className={CONTROL} value={str(rule.quality)} onChange={(e) => set({ quality: e.target.value })}>
                <option value="">{m.noChange}</option>
                {QUALITIES.map((x) => <option key={x} value={x}>{m.qualities[x]}</option>)}
              </select>
            </PanelField>
            <PanelField id={id('speed')} label={m.speed} error={env.issue(index, 'speed')}>
              <input id={id('speed')} type="number" className={CONTROL} value={str(rule.speed)} min={0} max={400} placeholder="100" aria-describedby={`${id('speed')}-help`} onChange={(e) => set({ speed: e.target.value === '' ? '' : Number(e.target.value) }, `rule:${index}:speed`)} />
              <p id={`${id('speed')}-help`} className="mt-1 text-xs text-text-secondary">{m.speedHelp}</p>
            </PanelField>
            <PanelField id={id('position')} label={m.position} error={env.issue(index, 'position')}>
              <input id={id('position')} type="number" className={CONTROL} value={str(rule.position)} min={0} max={100} onChange={(e) => set({ position: e.target.value === '' ? '' : Number(e.target.value) }, `rule:${index}:position`)} />
            </PanelField>
            {tri('reverse', m.direction, m.reverse, m.forward)}
            {tri('ack', m.ack, m.ackYes, m.ackNo)}
            {tri('pending', m.pending, m.yes, m.no)}
            {tri('failed', m.failedCommand, m.yes, m.no)}
          </div>
        </fieldset>
        <PanelField id={id('label')} label={m.label} error={env.issue(index, 'label')}>
          <input
            ref={label} id={id('label')} type="text" className={CONTROL} value={str(rule.label)} maxLength={80} placeholder="High: {value}"
            aria-describedby={`${id('label')}-tokens`} onChange={(e) => set({ label: e.target.value }, `rule:${index}:label`)}
          />
          <div id={`${id('label')}-tokens`} role="group" aria-label={m.tokens} className="mt-1.5 flex flex-wrap gap-1">
            {[...TOKENS, ...paramTokens].map((t) => (
              <button key={t} type="button" aria-label={m.insertToken(t)} onClick={() => insertToken(t)}
                className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                {t}
              </button>
            ))}
          </div>
        </PanelField>
        <PanelField id={id('medium')} label={m.medium} error={env.issue(index, 'medium')}>
          <select id={id('medium')} className={CONTROL} value={str(rule.medium)} onChange={(e) => set({ medium: e.target.value })}>
            <option value="">{m.noChange}</option>
            {MEDIUMS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </PanelField>
        <label htmlFor={id('stop')} className="flex items-start gap-2 text-sm text-text-secondary">
          <input id={id('stop')} type="checkbox" checked={rule.stop === true} aria-describedby={`${id('stop')}-help`} onChange={(e) => set({ stop: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus" />
          <span>
            {m.stop}
            <span id={`${id('stop')}-help`} className="block text-[11px] leading-snug">{m.stopHelp}</span>
          </span>
        </label>
      </fieldset>
    </>
  );
}

function ColorField({ id, title, value, onChange, error }: { id: string; title: string; value: string; onChange: (v: string | undefined) => void; error?: string }) {
  return (
    <PanelField id={id} label={title} error={error}>
      <FieldControl id={id} field={{ label: title, type: 'color' }} value={value || undefined} onChange={(v) => onChange(typeof v === 'string' ? v : undefined)} invalid={!!error} />
    </PanelField>
  );
}

type Choices = (current: string, extra: Array<{ value: string; label: string }>) => Array<{ value: string; label: string }>;

function Condition({
  env, index, rule, n, set, choices, rowOptions,
}: { env: Env; index: number; rule: Rec; n: '' | '2'; set: (patch: Rec, group?: string) => void; choices: Choices; rowOptions: Array<{ value: string; label: string }> }) {
  const { m, base } = env;
  const k = (name: string) => `${name}${n}`;
  const id = (name: string) => `${base}-${index}-${k(name)}`;
  const param = rule[k('source')] === 'param';
  const op = str(rule[k('op')]);
  const key = str(rule[k('key')]);
  const suggestions = param ? env.params.map((p) => ({ key: p.key, label: p.label })) : env.columns;
  const values = param ? env.params.find((p) => p.key === key)?.values ?? [] : [];
  const err = (name: string) => env.issue(index, k(name));
  const typing = (name: string, value: string) => set({ [k(name)]: value }, `rule:${index}:${k(name)}`);

  return (
    <div className="space-y-2" data-condition={n || '1'}>
      <PanelField id={id('source')} label={m.read} error={err('source')}>
        <select id={id('source')} className={CONTROL} value={param ? 'param' : 'column'} onChange={(e) => set({ [k('source')]: e.target.value })}>
          <option value="column">{m.column}</option>
          <option value="param">{m.parameter}</option>
        </select>
      </PanelField>
      <PanelField id={id('key')} label={param ? m.parameterLabel : m.columnLabel} error={err('key')}>
        <input
          id={id('key')} type="text" list={`${id('key')}-list`} className={CONTROL} value={key} maxLength={64} autoComplete="off" spellCheck={false}
          aria-invalid={!!err('key') || undefined} onChange={(e) => typing('key', e.target.value)}
        />
        <datalist id={`${id('key')}-list`}>
          {suggestions.map((c) => <option key={c.key} value={c.key}>{c.label && c.label !== c.key ? c.label : undefined}</option>)}
        </datalist>
      </PanelField>
      {!param && (
        <PanelField id={id('of')} label={m.ofRow} error={err('of')}>
          <select id={id('of')} className={CONTROL} value={str(rule[k('of')])} onChange={(e) => set({ [k('of')]: e.target.value })}>
            {choices(str(rule[k('of')]), [{ value: '', label: m.ownRow }, ...rowOptions]).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </PanelField>
      )}
      <PanelField id={id('op')} label={m.operator} error={err('op')}>
        <select id={id('op')} className={CONTROL} value={op} onChange={(e) => set({ [k('op')]: e.target.value })}>
          {!n && <option value="">{m.alwaysOption}</option>}
          {OPS.map((o) => <option key={o} value={o}>{m.opLabels[o]}</option>)}
        </select>
      </PanelField>
      {NEEDS_VALUE.has(op) && (
        <div className={cn('grid gap-2', op === 'between' ? 'grid-cols-2' : 'grid-cols-1')}>
          <PanelField id={id('value')} label={op === 'in' ? m.list : m.value} error={err('value')}>
            <input
              id={id('value')} type="text" inputMode={NUMERIC.has(op) ? 'decimal' : undefined} className={CONTROL} value={str(rule[k('value')])} maxLength={80}
              list={values.length ? `${id('value')}-list` : undefined} aria-invalid={!!err('value') || undefined} autoComplete="off"
              onChange={(e) => typing('value', e.target.value)}
            />
            {values.length > 0 && <datalist id={`${id('value')}-list`}>{values.map((v) => <option key={v} value={v} />)}</datalist>}
          </PanelField>
          {op === 'between' && (
            <PanelField id={id('to')} label={m.upTo} error={err('to')}>
              <input id={id('to')} type="text" inputMode="decimal" className={CONTROL} value={str(rule[k('to')])} maxLength={40} aria-invalid={!!err('to') || undefined}
                autoComplete="off" onChange={(e) => typing('to', e.target.value)} />
            </PanelField>
          )}
        </div>
      )}
    </div>
  );
}
