// The pure edits of a scene's rules for the diagram editor (no React): add, update, remove, move and duplicate one rule,
// find the rules that concern a selection, write a rule as a sentence and tell which ones hold for the live data. Every
// edit returns an `EditResult` over the scene settings (so it runs through `ctx.apply`) and never changes its input.
//
// The rows keep the flat layout the template and `scene-rules-logic.ts` define (`target`, `of`, `of2`, `key`, `key2`,
// ...); the fields, their types, options and lengths are read from the template, so a field added there is accepted
// here. The yes/no effects (`dim`, `blink`, `hidden`, `animate`) are the strings 'true', 'false' or absent.

import { SCADA_SCENE } from '../templates/scada-scene';
import { cssColor } from '../settings/style';
import { rowsById, type SceneSettings } from './scada-scene-logic';
import { isSafeKey, isRec, refuse, noop, targetNames, type EditResult, type Rec, type Selection } from './scene-edit-core';
import { DEFAULT_RULE_WORDS, type RuleWords } from './scene-editor-messages-panels';
import { MAX_SCENE_RULES, ruleMatches, type RuleContext, type SceneRule } from './scene-rules-logic';

const FIELDS = (SCADA_SCENE.fields.rules.fields ?? {}) as NonNullable<(typeof SCADA_SCENE.fields.rules)['fields']>;

/** The rules as stored: the list, or none. A stray non-object entry stays in place and is ignored by every reader. */
export const rulesOf = (s: SceneSettings): unknown[] => (Array.isArray(s.rules) ? (s.rules as unknown[]) : []);

const optionValues = (key: string): string[] => (FIELDS[key]?.options ?? []).map((o) => (typeof o === 'string' ? o : o.value));
const isYesNo = (key: string) => {
  const v = optionValues(key);
  return v.length === 3 && v.includes('true') && v.includes('false') && v.includes('');
};

/** A new rule row, as the settings form's "add" makes one: the template's defaults, then `seed`. */
export function newRule(seed: Rec = {}): Rec {
  const row: Rec = {};
  for (const [k, f] of Object.entries(FIELDS)) {
    if (f.value !== undefined || f.type === 'boolean' || f.type === 'text') row[k] = f.value ?? (f.type === 'boolean' ? false : '');
  }
  return { ...row, ...seed };
}

/** What a value of a rule field is stored as, or a reason it cannot be. `undefined` / '' on a choice or colour removes the field. */
function normalise(key: string, v: unknown): { value: unknown } | string {
  const f = FIELDS[key];
  if (!isSafeKey(key) || !f) return `"${key}" is not a rule field`;
  const empty = v === undefined || v === null || v === '';
  if (f.type === 'boolean') {
    if (v === true || v === 'true') return { value: true };
    if (v === false || v === 'false') return { value: false };
    return `${f.label} is on or off`;
  }
  if (f.type === 'text') {
    if (empty) return { value: '' };
    if (typeof v !== 'string' && typeof v !== 'number') return `${f.label} must be text`;
    const text = String(v);
    if (f.maxLength !== undefined && text.length > f.maxLength) return `${f.label} is at most ${f.maxLength} characters`;
    return { value: text };
  }
  if (f.type === 'color') {
    if (empty) return { value: undefined };
    if (typeof v !== 'string' || !cssColor(v)) return `${f.label} is not a colour`;
    return { value: v.trim() };
  }
  if (f.type === 'select') {
    if (empty) return { value: undefined };
    const text = isYesNo(key) && typeof v === 'boolean' ? String(v) : v;
    // `medium` accepts the template's list; the others are closed lists.
    if (typeof text !== 'string' || !optionValues(key).includes(text)) return `${f.label}: choose one of the listed values`;
    return { value: text };
  }
  return `"${key}" is not a rule field`;
}

const checked = (patch: Rec): Rec | string => {
  const out: Rec = {};
  for (const [k, v] of Object.entries(patch)) {
    const r = normalise(k, v);
    if (typeof r === 'string') return r;
    out[k] = r.value;
  }
  return out;
};

const withRules = (s: SceneSettings, list: unknown[]): SceneSettings => {
  if (list.length) return { ...s, rules: list };
  const { rules: _drop, ...rest } = s;
  return rest;
};

/** Adds a rule (`rule` over the new-row defaults) at `at` (default last). Refused past the rule cap or for a bad field. */
export function addRule(s: SceneSettings, rule: Rec = {}, at?: number): EditResult {
  const list = rulesOf(s);
  if (list.length >= MAX_SCENE_RULES) return refuse(s, `A diagram holds at most ${MAX_SCENE_RULES} rules`);
  const seed = checked(rule);
  if (typeof seed === 'string') return refuse(s, seed);
  const row = newRule(Object.fromEntries(Object.entries(seed).filter(([, v]) => v !== undefined)));
  const index = at === undefined ? list.length : Math.min(list.length, Math.max(0, Math.trunc(at)));
  const next = list.slice();
  next.splice(index, 0, row);
  return { settings: withRules(s, next), index };
}

/** Writes some fields of one rule. Absent (`undefined` or '') removes a choice or a colour; a text field keeps ''. */
export function updateRule(s: SceneSettings, index: number, patch: Rec): EditResult {
  const list = rulesOf(s);
  const rule = list[index];
  if (!isRec(rule)) return refuse(s, 'No such rule');
  const fixed = checked(patch);
  if (typeof fixed === 'string') return refuse(s, fixed);
  let next: Rec | null = null;
  for (const [k, v] of Object.entries(fixed)) {
    const cur = next ?? rule;
    if (v === undefined) {
      if (!Object.hasOwn(cur, k)) continue;
      next ??= { ...rule };
      delete next[k];
    } else if (!Object.hasOwn(cur, k) || cur[k] !== v) {
      next ??= { ...rule };
      next[k] = v;
    }
  }
  if (!next) return noop(s);
  const out = list.slice();
  out[index] = next;
  return { settings: { ...s, rules: out }, index };
}

/** Removes one rule. */
export function removeRule(s: SceneSettings, index: number): EditResult {
  const list = rulesOf(s);
  if (!isRec(list[index])) return refuse(s, 'No such rule');
  return { settings: withRules(s, list.filter((_, i) => i !== index)) };
}

/**
 * Moves a rule one place earlier or later. With `group` (the indices of the rules a card list shows, in order) the rule
 * moves past its neighbour in that list, so the rules that list does not show keep their order. At either end nothing
 * changes. `index` of the result is where the rule is now.
 */
export function moveRule(s: SceneSettings, index: number, dir: 'up' | 'down', group?: readonly number[]): EditResult {
  const list = rulesOf(s);
  if (!isRec(list[index])) return refuse(s, 'No such rule');
  const order = group ?? list.map((_, i) => i);
  const at = order.indexOf(index);
  if (at < 0) return refuse(s, 'No such rule');
  const neighbour = order[at + (dir === 'up' ? -1 : 1)];
  if (neighbour === undefined) return { ...noop(s), index };
  const next = list.slice();
  const [moved] = next.splice(index, 1);
  // Going up, the neighbour keeps its place and the rule takes it; going down, the neighbour sits one place earlier after
  // the removal and the rule goes in behind it. Both come to `neighbour`.
  next.splice(neighbour, 0, moved);
  return { settings: { ...s, rules: next }, index: neighbour };
}

/** A copy of a rule right after it (the copy is the new `index`). Refused past the rule cap. */
export function duplicateRule(s: SceneSettings, index: number): EditResult {
  const list = rulesOf(s);
  const rule = list[index];
  if (!isRec(rule)) return refuse(s, 'No such rule');
  if (list.length >= MAX_SCENE_RULES) return refuse(s, `A diagram holds at most ${MAX_SCENE_RULES} rules`);
  const next = list.slice();
  next.splice(index + 1, 0, { ...rule });
  return { settings: { ...s, rules: next }, index: index + 1 };
}

/** The names a selection answers to in a rule's `target`: the ids of its symbols and the ids its connections carry. */
export function ruleTargets(s: SceneSettings, sel: Selection): string[] {
  const out: string[] = [...(sel.elements ?? [])];
  const links = Array.isArray(s.links) ? (s.links as unknown[]) : [];
  for (const i of sel.links ?? []) {
    const l = links[i];
    if (isRec(l) && typeof l.id === 'string' && l.id) out.push(l.id);
  }
  return [...new Set(out)];
}

export interface RuleGroups {
  /** The rules whose target is one of `targets`, in rule order. */
  own: number[];
  /** The rules for `*`. */
  star: number[];
  /** All the others, grouped by target in order of first appearance. */
  others: Array<{ target: string; indices: number[] }>;
}

/** The rules a card list shows: those that target the selection, then `*`, then the rest by target. */
export function rulesFor(s: SceneSettings, targets: readonly string[]): RuleGroups {
  const mine = new Set(targets);
  const out: RuleGroups = { own: [], star: [], others: [] };
  const byTarget = new Map<string, number[]>();
  rulesOf(s).forEach((r, i) => {
    if (!isRec(r)) return;
    const target = typeof r.target === 'string' ? r.target.trim() : '';
    if (target === '*') out.star.push(i);
    else if (mine.has(target)) out.own.push(i);
    else {
      const list = byTarget.get(target) ?? [];
      list.push(i);
      byTarget.set(target, list);
    }
  });
  out.others = [...byTarget.entries()].map(([target, indices]) => ({ target, indices }));
  return out;
}

// ─── The sentence ────────────────────────────────────────────────────────────

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? `{${k}}`);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

export interface DescribeOptions {
  /** Start with "For pump1:" (a card under no target heading). */
  withTarget?: boolean;
  /** A column or parameter's name as the author sees it (default: the key). */
  columnLabel?: (key: string) => string | undefined;
  paramLabel?: (key: string) => string | undefined;
}

function condition(r: SceneRule, n: '' | '2', words: RuleWords, o: DescribeOptions): string {
  const op = str(n ? r.op2 : r.op);
  if (!op) return '';
  const param = (n ? r.source2 : r.source) === 'param';
  const key = str(n ? r.key2 : r.key) || '...';
  const of = str(n ? r.of2 : r.of);
  const name = param ? fill(words.param, { name: o.paramLabel?.(key) ?? key }) : o.columnLabel?.(key) ?? key;
  const where = param ? '' : ` ${of ? fill(words.of, { id: of }) : words.ofThis}`;
  const phrase = (words.ops as Record<string, string>)[op];
  const says = phrase === undefined ? op : fill(phrase, { value: str(n ? r.value2 : r.value), to: str(n ? r.to2 : r.to), list: str(n ? r.value2 : r.value).split(',').map((x) => x.trim()).filter(Boolean).join(', ') });
  return `${name}${where} ${says}`;
}

/** A theme colour token in the word a person would use (a custom colour is shown as it is). */
const COLOUR_WORDS: Record<string, string> = {
  'var(--primary)': 'blue', 'var(--secondary)': 'purple', 'var(--success)': 'green', 'var(--info)': 'cyan', 'var(--warning)': 'amber',
  'var(--error)': 'red', 'var(--text-primary)': 'dark', 'var(--text-secondary)': 'grey', 'var(--border-strong)': 'light grey',
};
const colourWord = (v: string): string => COLOUR_WORDS[v.trim()] ?? v;

function effects(r: SceneRule, words: RuleWords): string[] {
  const out: string[] = [];
  const state = str(r.state);
  if (state) out.push(fill(words.state, { state: (words.states as Record<string, string>)[state] ?? state }));
  if (str(r.color)) out.push(fill(words.color, { color: colourWord(str(r.color)) }));
  if (str(r.fillColor)) out.push(fill(words.fillColor, { color: colourWord(str(r.fillColor)) }));
  const yes = (v: unknown) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);
  const dim = yes(r.dim); if (dim !== undefined) out.push(dim ? words.dimOn : words.dimOff);
  const blink = yes(r.blink); if (blink !== undefined) out.push(blink ? words.blinkOn : words.blinkOff);
  const hidden = yes(r.hidden); if (hidden !== undefined) out.push(hidden ? words.hide : words.show);
  if (str(r.label)) out.push(fill(words.label, { label: str(r.label) }));
  if (str(r.medium)) out.push(fill(words.medium, { medium: str(r.medium) }));
  const animate = yes(r.animate); if (animate !== undefined) out.push(animate ? words.animateOn : words.animateOff);
  return out;
}

const list = (parts: string[], and: string) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}` : parts[0] ?? '');

/** A rule as a sentence: "When Temperature of this symbol is above 24, set the state to warning and show 'High'". */
export function describeRule(rule: unknown, words: RuleWords = DEFAULT_RULE_WORDS, o: DescribeOptions = {}): string {
  if (!isRec(rule)) return '';
  const r = rule as SceneRule;
  const first = condition(r, '', words, o);
  const second = first ? condition(r, '2', words, o) : '';
  const when = !first ? words.always : `${words.when} ${first}${second ? ` ${r.join === 'any' ? words.or : words.and} ${second}` : ''}`;
  const fx = list(effects(r, words), words.and) || words.nothing;
  const stop = r.stop === true ? `, ${words.stop}` : '';
  const target = str(r.target);
  const lead = o.withTarget ? `${target === '*' ? words.forEvery : fill(words.forTarget, { target: target || '...' })}: ` : '';
  const sentence = `${lead}${when}, ${fx}${stop}`;
  return r.enabled === false ? `${sentence} ${words.off}` : sentence;
}

// ─── Live matching ───────────────────────────────────────────────────────────

export interface RuleMatch {
  /** How many targets the rule has (1 for a symbol or connection, all of them for `*`, 0 when it names nothing). */
  total: number;
  /** The targets the rule holds for right now (none for a disabled rule). */
  matching: string[];
  enabled: boolean;
}

/** Which of a rule's targets it holds for under these rows and parameters. `names` are every symbol and connection id. */
export function ruleMatchFor(rule: unknown, names: readonly string[], ctx: RuleContext): RuleMatch {
  if (!isRec(rule)) return { total: 0, matching: [], enabled: false };
  const r = rule as SceneRule;
  const target = str(r.target);
  const ids = target === '*' ? [...names] : target && names.includes(target) ? [target] : [];
  const enabled = r.enabled !== false;
  return { total: ids.length, enabled, matching: enabled ? ids.filter((id) => ruleMatches(r, id, ctx)) : [] };
}

/** The rules that hold for at least one target, with the targets, in rule order (what-if and the live marks). */
export function matchingRules(s: SceneSettings, ctx: RuleContext): Array<{ index: number; targets: string[] }> {
  const names = [...targetNames(s)];
  const out: Array<{ index: number; targets: string[] }> = [];
  rulesOf(s).forEach((r, index) => {
    const m = ruleMatchFor(r, names, ctx);
    if (m.matching.length) out.push({ index, targets: m.matching });
  });
  return out;
}

/** The rule context of a scene over its bound table: rows by id, the effective parameters. */
export function ruleContext(s: SceneSettings, points: Parameters<typeof rowsById>[0], params: Record<string, unknown> = {}): RuleContext {
  return { rows: rowsById(points, s.idColumn || 'id'), params };
}
