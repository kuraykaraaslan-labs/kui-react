// The data-driven rules of the process scene, and of every other kind with rules (pure, no React): a rule names a
// target (a symbol id, a connection id, a marker or thing id, or `*`), up to two conditions on the bound table or on
// a board parameter, and the effects to apply while they hold. Rules run top to bottom; every enabled rule that
// matches applies, a later rule overrides the same effect, and `stop` ends the evaluation for that target. The
// targets and the effects are data: a kind hands the engine its target ids and an `EffectSpec` naming the effect
// fields it reads (the process scene's is `SCENE_RULE_EFFECTS`, the default; the 3D viewer's lives with its logic).
// `sceneModel` and `applyViewerRules` apply the result; kui-ejs and KUInative vendor this file, and next-boilerplate
// keeps a server-safe copy of it.
//
// A rule is one flat row (the settings form has no nested lists):
//   target, enabled, stop
//   source ('column' | 'param'), key, of, op, value, to        (first condition)
//   join ('all' | 'any'), source2, key2, of2, op2, value2, to2 (second condition, used when op2 is set)
//   the effect fields of the kind's spec (empty = no change), e.g. the scene's
//   state, color, fillColor, dim, blink, hidden, label, medium, animate

import { asBoolean, asNumber } from '@/modules/ui/ControlTile/control-logic';
import { cssColor } from '../settings/style';

type Row = Record<string, unknown>;

export const MAX_SCENE_RULES = 200;
/** The longest label an effect can produce, in characters. */
export const MAX_RULE_LABEL = 80;

import { parseMode, parseQuality, SYMBOL_MODES, SYMBOL_QUALITIES, type SymbolMode, type SymbolQuality } from './scada-states';

export const RULE_STATES = ['idle', 'running', 'warning', 'critical', 'off'] as const;
export type RuleState = (typeof RULE_STATES)[number];
export const RULE_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'set', 'unset', 'true', 'false'] as const;
export type RuleOp = (typeof RULE_OPS)[number];
export type RuleSource = 'column' | 'param';

/**
 * How an effect field of a rule row is read: a yes / no flag, a colour (`cssColor`), a trimmed text, a number kept
 * within bounds, one of a list (an optional `parse` accepts the words the kind knows), or a label: a text with tokens,
 * filled in per target once the rules ran (`expandLabel`), capped at `MAX_RULE_LABEL`. Anything malformed is simply
 * not an effect.
 */
export type EffectKind =
  | { kind: 'flag' }
  | { kind: 'color' }
  | { kind: 'text' }
  | { kind: 'label' }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'enum'; options: readonly string[]; parse?: (v: unknown) => string | null; message?: string };

/** The effects one kind of rules offers, by rule-row field: the engine reads and validates exactly these. */
export type EffectSpec = Record<string, EffectKind>;

/** The process scene's effects (what `SceneEffects` types and `sceneModel` applies). The default spec. */
export const SCENE_RULE_EFFECTS: EffectSpec = {
  state: { kind: 'enum', options: RULE_STATES, message: 'Choose a state' },
  color: { kind: 'color' },
  fillColor: { kind: 'color' },
  dim: { kind: 'flag' },
  blink: { kind: 'flag' },
  hidden: { kind: 'flag' },
  animate: { kind: 'flag' },
  reverse: { kind: 'flag' },
  ack: { kind: 'flag' },
  pending: { kind: 'flag' },
  failed: { kind: 'flag' },
  mode: { kind: 'enum', options: SYMBOL_MODES, parse: parseMode, message: 'Choose a mode' },
  quality: { kind: 'enum', options: SYMBOL_QUALITIES, parse: parseQuality, message: 'Choose a data quality' },
  speed: { kind: 'number', min: 0, max: 400 },
  position: { kind: 'number', min: 0, max: 100 },
  label: { kind: 'label' },
  medium: { kind: 'text' },
};

export interface SceneRule {
  enabled?: boolean;
  /** A symbol id, a connection id or `*` (every symbol and connection). */
  target?: string;
  stop?: boolean;
  source?: RuleSource | string;
  /** The column of the table, or the name of the board parameter. */
  key?: string;
  /** The id of the row the column is read from (empty = the target's own row). */
  of?: string;
  op?: RuleOp | string;
  value?: string | number;
  /** The upper end of `between`. */
  to?: string | number;
  join?: 'all' | 'any' | string;
  source2?: RuleSource | string;
  key2?: string;
  of2?: string;
  op2?: RuleOp | string;
  value2?: string | number;
  to2?: string | number;
  state?: RuleState | string;
  color?: string;
  fillColor?: string;
  dim?: boolean | string;
  blink?: boolean | string;
  hidden?: boolean | string;
  label?: string;
  medium?: string;
  animate?: boolean | string;
  /** States layer (`scada-states.ts`): mode, data quality, speed in percent, direction, alarm acknowledgement, opening, command in flight. */
  mode?: string;
  quality?: string;
  speed?: number | string;
  reverse?: boolean | string;
  ack?: boolean | string;
  position?: number | string;
  pending?: boolean | string;
  failed?: boolean | string;
  /** The effect fields of another kind's spec (the 3D viewer's `pulse`, `size`, `dz`). */
  [effect: string]: unknown;
}

/** What the rules that matched decided for one target. A missing key means "no rule said anything". */
export interface SceneEffects {
  state?: RuleState;
  /** The accent: replaces the state colour. */
  color?: string;
  fillColor?: string;
  dim?: boolean;
  blink?: boolean;
  hidden?: boolean;
  /** The text with its tokens already filled in. */
  label?: string;
  medium?: string;
  /** `false` stops the motion of the target. */
  animate?: boolean;
  mode?: SymbolMode;
  quality?: SymbolQuality;
  /** Percent of nominal speed (0 = stalled). */
  speed?: number;
  reverse?: boolean;
  ack?: boolean;
  position?: number;
  pending?: boolean;
  failed?: boolean;
}

export interface RuleContext {
  /** The rows of the bound table by id. */
  rows: Map<string, Row>;
  /** The effective board parameters. */
  params?: Record<string, unknown>;
  /** What `*` stands for (the ids of the symbols and connections, or of the markers and things). Default: the ids of `rows`. */
  targets?: Iterable<string>;
  /** A number as text for `{value}` and `{value2}` (the host's words, unit included); default: the number itself. */
  format?: (targetId: string, n: number) => string;
  /** The effect fields this kind of rules reads. Default: the process scene's (`SCENE_RULE_EFFECTS`). */
  effects?: EffectSpec;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const isOp = (v: unknown): v is RuleOp => typeof v === 'string' && (RULE_OPS as readonly string[]).includes(v);
const scalar = (v: unknown): string | number | boolean | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  return typeof v === 'string' || typeof v === 'boolean' ? v : undefined;
};

// ── Conditions ────────────────────────────────────────────────────────────────

/** Two values equal: numbers numerically, a boolean through the controls' coercion, anything else as text, case-insensitive. */
function equal(actual: string | number | boolean, expected: unknown): boolean {
  const a = asNumber(actual); const b = asNumber(expected);
  if (a !== null && b !== null) return a === b;
  if (typeof actual === 'boolean') {
    const e = asBoolean(expected);
    return e !== null && e === actual;
  }
  return String(actual).trim().toLowerCase() === String(expected ?? '').trim().toLowerCase();
}

/** One operator on one reading. A missing reading (`undefined`) matches only `unset`. */
export function compare(op: string, actual: unknown, value: unknown, to?: unknown): boolean {
  const have = scalar(actual);
  if (op === 'unset') return have === undefined;
  if (have === undefined) return false;
  switch (op) {
    case 'set': return true;
    case 'true': return asBoolean(have) === true;
    case 'false': return asBoolean(have) === false;
    case 'eq': return equal(have, value);
    case 'ne': return !equal(have, value);
    case 'in': return String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean).some((item) => equal(have, item));
    case 'gt': case 'gte': case 'lt': case 'lte': {
      const a = asNumber(have); const b = asNumber(value);
      if (a === null || b === null) return false;
      return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
    }
    case 'between': {
      const a = asNumber(have); const lo = asNumber(value); const hi = asNumber(to);
      if (a === null || lo === null || hi === null) return false;
      return a >= Math.min(lo, hi) && a <= Math.max(lo, hi);
    }
    default: return false;
  }
}

/** The reading a condition looks at: a column of a row, or a board parameter. `undefined` when it is not there. */
function reading(source: unknown, key: string, of: string, target: string, ctx: RuleContext): unknown {
  if (!key) return undefined;
  if (source === 'param') return ctx.params && Object.hasOwn(ctx.params, key) ? ctx.params[key] : undefined;
  const row = ctx.rows.get(of || target);
  return row && Object.hasOwn(row, key) ? row[key] : undefined;
}

/** Whether a rule's conditions hold for a target. No operator on the first condition = always. */
export function ruleMatches(rule: SceneRule, target: string, ctx: RuleContext): boolean {
  const op = text(rule.op);
  if (!op) return true;
  const first = compare(op, reading(rule.source, text(rule.key), text(rule.of), target, ctx), rule.value, rule.to);
  const op2 = text(rule.op2);
  if (!op2) return first;
  const second = compare(op2, reading(rule.source2, text(rule.key2), text(rule.of2), target, ctx), rule.value2, rule.to2);
  return rule.join === 'any' ? first || second : first && second;
}

// ── Labels ────────────────────────────────────────────────────────────────────

const DASH = '—';

/** Fills `{value}`, `{value2}`, `{label}`, `{id}` and `{param:name}`; control characters go, the length is capped. */
export function expandLabel(template: string, target: string, ctx: RuleContext): string {
  const row = ctx.rows.get(target);
  const fmt = (n: number) => (ctx.format ? ctx.format(target, n) : String(Math.round(n * 100) / 100));
  const num = (key: string) => {
    const v = row && Object.hasOwn(row, key) ? row[key] : undefined;
    const n = asNumber(v);
    if (n !== null) return fmt(n);
    return typeof v === 'string' && v ? v : DASH;
  };
  const out = template.replace(/\{(value2?|label|id|param:[^{}]{1,64})\}/g, (_m, token: string) => {
    if (token === 'value' || token === 'value2') return num(token);
    if (token === 'id') return target;
    if (token === 'label') return row && typeof row.label === 'string' ? row.label : '';
    const name = token.slice(6).trim();
    const v = ctx.params && Object.hasOwn(ctx.params, name) ? scalar(ctx.params[name]) : undefined;
    return v === undefined ? DASH : String(v);
  });
  // eslint-disable-next-line no-control-regex
  return out.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_RULE_LABEL);
}

// ── Evaluation ────────────────────────────────────────────────────────────────

const flag = (v: unknown): boolean | undefined => asBoolean(v) ?? undefined;

/** One of an enum effect's options: through the kind's own words (`parse`) when it has them, else the option itself. */
const enumOf = (e: Extract<EffectKind, { kind: 'enum' }>, v: unknown): string | null =>
  (e.parse ? e.parse(v) : typeof v === 'string' && e.options.includes(v) ? v : null);

/** The effects one rule asks for under a spec (the label as its raw template). Anything malformed is simply not an effect. */
function effectsOf(rule: SceneRule, spec: EffectSpec): { fx: Record<string, unknown>; labelTemplate?: string } {
  const fx: Record<string, unknown> = {};
  let labelTemplate: string | undefined;
  for (const [key, e] of Object.entries(spec)) {
    const v = rule[key];
    if (e.kind === 'flag') {
      const b = flag(v);
      if (b !== undefined) fx[key] = b;
    } else if (e.kind === 'color') {
      const c = cssColor(v);
      if (c) fx[key] = c;
    } else if (e.kind === 'text') {
      if (typeof v === 'string' && v.trim()) fx[key] = v.trim();
    } else if (e.kind === 'label') {
      if (typeof v === 'string' && v.trim()) labelTemplate = v;
    } else if (e.kind === 'number') {
      const n = asNumber(v);
      if (n !== null && v !== '') fx[key] = Math.min(e.max ?? Infinity, Math.max(e.min ?? -Infinity, n));
    } else {
      const o = enumOf(e, v);
      if (o) fx[key] = o;
    }
  }
  return { fx, labelTemplate };
}

/**
 * The effects per target id, under the context's spec (the scene's by default; `T` is what that spec decides, e.g.
 * `SceneEffects`). A target that no rule touched is not in the map. A disabled rule never applies; a rule whose
 * target is not one of the targets does nothing (`validateRules` reports it). The filled-in label lands under the
 * spec's label field (`label`).
 */
export function evaluateRules<T extends object = SceneEffects>(rules: unknown, ctx: RuleContext): Map<string, T> {
  const out = new Map<string, T>();
  const list = (Array.isArray(rules) ? (rules as SceneRule[]) : []).filter((r) => r && typeof r === 'object').slice(0, MAX_SCENE_RULES);
  if (!list.length) return out;
  const spec = ctx.effects ?? SCENE_RULE_EFFECTS;
  const labelKey = Object.keys(spec).find((k) => spec[k].kind === 'label') ?? 'label';
  const all = [...new Set(ctx.targets ?? ctx.rows.keys())];
  const known = new Set(all);
  const parsed = list.map((r) => ({ r, ...effectsOf(r, spec) }));
  const templates = new Map<string, string>();
  const stopped = new Set<string>();
  for (const { r, fx, labelTemplate } of parsed) {
    if (r.enabled === false) continue;
    const target = text(r.target);
    if (!target) continue;
    const ids = target === '*' ? all : known.has(target) ? [target] : [];
    for (const id of ids) {
      if (stopped.has(id) || !ruleMatches(r, id, ctx)) continue;
      if (Object.keys(fx).length) out.set(id, { ...out.get(id), ...fx } as T);
      if (labelTemplate !== undefined) templates.set(id, labelTemplate);
      if (r.stop === true) stopped.add(id);
    }
  }
  for (const [id, tpl] of templates) {
    const label = expandLabel(tpl, id, ctx);
    if (label) out.set(id, { ...out.get(id), [labelKey]: label } as T);
  }
  return out;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface RuleIssue { path: string; message: string }

const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte']);
const NEEDS_VALUE = new Set(['eq', 'ne', 'in', 'gt', 'gte', 'lt', 'lte', 'between']);

/**
 * Problems with a rules list against the ids of the scene and the effects of the kind (the same checks the settings
 * form shows). With `fromData` the targets are row ids the data brings (the 3D viewer's markers and things): any
 * non-empty target or `of` is then accepted, as the settings cannot know the rows.
 */
export function validateRules(
  rules: unknown,
  ids: { elementIds: Iterable<string>; linkIds?: Iterable<string>; fromData?: boolean },
  effects: EffectSpec = SCENE_RULE_EFFECTS,
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const list = Array.isArray(rules) ? (rules as SceneRule[]) : [];
  if (list.length > MAX_SCENE_RULES) issues.push({ path: 'rules', message: `At most ${MAX_SCENE_RULES} rules` });
  const elements = new Set(ids.elementIds);
  const known = new Set([...elements, ...(ids.linkIds ?? [])]);
  const fromData = ids.fromData === true;
  const idOk = (v: unknown) => fromData || text(v) === '' || known.has(text(v));
  list.forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const at = (f: string) => `rules.${i}.${f}`;
    const target = text(r.target);
    if (!target) issues.push({ path: at('target'), message: fromData ? 'Name a row id or *' : 'Choose a symbol, a connection or *' });
    else if (!fromData && target !== '*' && !known.has(target)) issues.push({ path: at('target'), message: 'No symbol or connection has this id' });
    const condition = (n: '' | '2') => {
      const op = text(n ? r.op2 : r.op); const source = n ? r.source2 : r.source;
      const key = text(n ? r.key2 : r.key); const of = n ? r.of2 : r.of;
      const value = n ? r.value2 : r.value; const to = n ? r.to2 : r.to;
      const f = (name: string) => at(`${name}${n}`);
      if (source !== undefined && source !== '' && source !== 'column' && source !== 'param') issues.push({ path: f('source'), message: 'The source is a column or a parameter' });
      if (!idOk(of)) issues.push({ path: f('of'), message: 'No symbol or connection has this id' });
      if (!op) return;
      if (!isOp(op)) { issues.push({ path: f('op'), message: 'Choose one of the operators' }); return; }
      if (!key) issues.push({ path: f('key'), message: source === 'param' ? 'Name the board parameter' : 'Name the column' });
      if (NEEDS_VALUE.has(op) && text(value) === '') issues.push({ path: f('value'), message: 'This operator needs a value' });
      else if (NUMERIC_OPS.has(op) && asNumber(value) === null) issues.push({ path: f('value'), message: 'This operator compares numbers: the value must be a number' });
      if (op === 'between') {
        if (asNumber(value) === null) issues.push({ path: f('value'), message: 'The lower end must be a number' });
        if (asNumber(to) === null) issues.push({ path: f('to'), message: 'The upper end must be a number' });
      }
      if (op === 'in' && !String(value ?? '').split(',').some((s) => s.trim())) issues.push({ path: f('value'), message: 'List at least one value, separated by commas' });
    };
    condition('');
    if (text(r.op2) && !text(r.op)) issues.push({ path: at('op'), message: 'Set the first condition before the second' });
    if (text(r.op2)) {
      condition('2');
      if (r.join !== undefined && r.join !== '' && r.join !== 'all' && r.join !== 'any') issues.push({ path: at('join'), message: 'Join with all or any' });
    }
    // The effects, as the spec reads them: a choice must be one of its options, a number a number, a label short enough.
    for (const [key, e] of Object.entries(effects)) {
      const v = r[key];
      if (v === undefined || v === '') continue;
      if (e.kind === 'enum' && !enumOf(e, v)) issues.push({ path: at(key), message: e.message ?? 'Choose one of the options' });
      else if (e.kind === 'number' && asNumber(v) === null) issues.push({ path: at(key), message: 'Use a number' });
      else if (e.kind === 'label' && typeof v === 'string' && v.length > MAX_RULE_LABEL) issues.push({ path: at(key), message: `At most ${MAX_RULE_LABEL} characters` });
    }
  });
  return issues;
}
