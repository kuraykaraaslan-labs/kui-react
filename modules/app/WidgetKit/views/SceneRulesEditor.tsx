'use client';
// The rules editor of the diagram editor: the rules that target the selection first, then the other rules grouped by
// target, then the `*` rules. Each rule is a sentence card ("When Temperature of this symbol is above 24, set the state
// to warning and show 'High'") with a form for the condition, the effects, the order and whether it is on, and a live
// mark for whether it holds for the data right now. Every change is one `scene-rules-edit` operation through `ctx.apply`.
import { useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
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
import { THINGS_TARGET, validateRules } from './scene-rules-logic';
import { thingIdsOf } from './scene-editor-state';
import { ColorField, Condition } from './scene-rules-form';

export interface SceneRulesEditorProps {
  ctx: EditorCtx;
  /** Any part of the editor's texts, in the host's language. */
  messages?: DeepPartial<RulesMessages>;
  className?: string;
}

const STATES = ['idle', 'running', 'warning', 'critical', 'off'] as const;
const MODES = ['auto', 'manual', 'local', 'maintenance', 'lockout', 'simulation'] as const;
const QUALITIES = ['good', 'stale', 'bad', 'offline'] as const;
/** The label's tokens; the condition's reading (`{condition}`, D584) sits after the symbol's own two, in the host's word for it. */
const tokensOf = (condition: string): string[] => ['{value}', '{value2}', condition, '{label}', '{id}'];

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
  /** The values each symbol draws, when the host knows them: "Which value" offers them (E14). */
  valuesOf?: (symbolId: string) => ReadonlyArray<{ key: string; label?: string }> | undefined;
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
  // every symbol by the name the author sees ("Dock door 1"), its id only to tell two equal names apart (next-boilerplate e2e round 5, V1-B2:
  // "logistics3 (Dock door 1)" on every picker, raw ids as the group headings and "of logistics3" in the sentence)
  const names = useMemo(() => {
    const out: Array<{ id: string; text: string }> = [];
    const named: Array<{ id: string; own: string }> = [];
    for (const e of Array.isArray(s.elements) ? (s.elements as unknown[]) : []) {
      if (!isRec(e) || typeof e.id !== 'string') continue;
      const own = typeof e.label === 'string' && e.label.trim() ? e.label.trim() : isScadaSymbol(e.symbol) ? (SCADA_SYMBOL_DEFS[e.symbol] as SymbolDef).label : '';
      named.push({ id: e.id, own });
    }
    const count = new Map<string, number>();
    for (const n of named) if (n.own) count.set(n.own.toLowerCase(), (count.get(n.own.toLowerCase()) ?? 0) + 1);
    for (const n of named) out.push({ id: n.id, text: !n.own ? n.id : (count.get(n.own.toLowerCase()) ?? 0) > 1 ? `${n.own} (${n.id})` : n.own });
    for (const id of linkIds(s)) out.push({ id, text: id });
    // With a things table: every thing, and each thing the table brings now, by id.
    if (ctx.data.things) {
      out.push({ id: THINGS_TARGET, text: THINGS_TARGET });
      for (const id of thingIdsOf(ctx.data, s).slice(0, 100)) out.push({ id, text: id });
    }
    return out;
  }, [s, ctx.data]);

  const columns = useMemo((): Array<{ key: string; label?: string }> => {
    if (ctx.host.columns?.length) return ctx.host.columns;
    const declared = ctx.data.points?.columns;
    if (declared?.length) return declared.map((c) => ({ key: c.key, label: c.label }));
    return SCENE_COLUMNS.map((key) => ({ key }));
  }, [ctx.host.columns, ctx.data.points?.columns]);
  const params = ctx.host.params ?? [];

  const issues = useMemo(() => {
    const out = new Map<number, Map<string, string>>();
    // A bound things table may bring any id later: an id it does not have now is not an error then.
    for (const i of validateRules(list, { elementIds: elementIds(s), linkIds: linkIds(s), thingIds: thingIdsOf(ctx.data, s), things: !!ctx.data.things })) {
      const hit = /^rules\.(\d+)\.(\w+)$/.exec(i.path);
      if (!hit) continue;
      const at = out.get(Number(hit[1])) ?? new Map<string, string>();
      // in the host's words (V1-B4): the code, worded by the messages; the English sentence only for a code they do not know
      if (!at.has(hit[2])) at.set(hit[2], (i.ruleCode && m.issues[i.ruleCode]?.(i.n)) || i.message);
      out.set(Number(hit[1]), at);
    }
    return out;
  }, [list, s, ctx.data, m]);

  // Whether each rule holds for the real data right now.
  const matches = useMemo(() => {
    const rc = ruleContext(s, ctx.data.points, ctx.params, ctx.data.things);
    const all = [...targetNames(s)];
    const out = new Map<number, RuleMatch>();
    list.forEach((r, i) => { if (isRec(r)) out.set(i, ruleMatchFor(r, all, rc)); });
    return out;
  }, [list, s, ctx.data.points, ctx.data.things, ctx.params]);

  // the values of a symbol of the drawing, from the host, by the library key it is drawn with
  const symbolValues = ctx.host.symbolValues;
  const symbolOf = useMemo(() => {
    const out = new Map<string, string>();
    for (const e of Array.isArray(s.elements) ? (s.elements as unknown[]) : []) if (isRec(e) && typeof e.id === 'string') out.set(e.id, typeof e.symbol === 'string' ? e.symbol : '');
    return out;
  }, [s]);
  const valuesOf = symbolValues ? (id: string) => (symbolOf.has(id) ? symbolValues({ id, symbol: symbolOf.get(id) ?? '' }) : undefined) : undefined;
  const env: Env = { m, base, ctx, run, names, columns, params, issue: (i, f) => issues.get(i)?.get(f), ...(valuesOf ? { valuesOf } : {}) };
  const valueNames = m.valueNames ?? {};
  const nameOf = (id: string): string | undefined => names.find((x) => x.id === id)?.text;
  const labels = {
    columnLabel: (key: string) => columns.find((c) => c.key === key && c.label && c.label !== c.key)?.label ?? valueNames[key],
    paramLabel: (key: string) => params.find((p) => p.key === key)?.label,
    symbolName: nameOf,
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
          {problems > 0 && <Badge tone="error">{m.problemCount(problems)}</Badge>}
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
      <p className="text-xs leading-snug text-text-secondary" data-testid="rules-device-hint">{m.deviceHint}</p>
      {targets.length > 0 && groups.own.length > 0 && section(m.forSelection(selectionName), groups.own, 'own')}
      {groups.star.length > 0 && section(m.everything, groups.star, 'star')}
      {groups.others.length > 0 && (
        <section aria-label={m.others} className="space-y-3" data-group="others">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{m.others}</h3>
          {groups.others.map((g) => section((g.target && (nameOf(g.target) ?? m.missing(g.target))) || m.noTarget, g.indices, `t-${g.target || 'none'}`, 'h4'))}
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
            ref={label} id={id('label')} type="text" className={CONTROL} value={str(rule.label)} maxLength={80} placeholder={m.labelPlaceholder}
            aria-describedby={`${id('label')}-tokens`} onChange={(e) => set({ label: e.target.value }, `rule:${index}:label`)}
          />
          <div id={`${id('label')}-tokens`} role="group" aria-label={m.tokens} className="mt-1.5 flex flex-wrap gap-1">
            {[...tokensOf(m.conditionToken), ...paramTokens].map((t) => (
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
