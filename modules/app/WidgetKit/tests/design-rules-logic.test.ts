import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DESIGN_RULE_WORDS, DESIGN_RULE_EFFECTS, addDesignRule, describeDesignRule, designResult, designRuleEffects, designRuleIssues, designRules,
  duplicateDesignRule, isDesignRule, moveDesignRule, newDesignRule, removeDesignRule, staleReferences, statusOfColor, updateDesignRule, viewerColor,
  MAX_DESIGN_RULE_TARGETS,
} from '../views/design-rules-logic';
import { evaluateRules, SCENE_RULE_EFFECTS } from '../views/scene-rules-logic';
import { MAX_SCENE_RULES } from '../views/scene-rules-logic';

const rows = [
  { id: 'tm', value: 91, status: 'ok' },
  { id: 'pump', value: 12, running: true },
  { id: 'fan', value: 40 },
];
const keys = ['tm', 'pump', 'fan', 'door'];

describe('design rules: evaluation', () => {
  it('turns a rule into overrides on the scene key: colour, outline, label with a token, pulse', () => {
    const rules = [{ target: 'tm', key: 'value', op: 'gt', value: '80', color: 'var(--error)', pulse: true, highlight: true, label: 'Hot {value}' }];
    const r = designRules(rules, { rows, keys });
    expect(r.overrides).toEqual({ tm: { color: '#f87171', pulse: true, highlight: true, label: 'Hot 91' } });
    expect(r.hidden).toEqual([]);
  });
  it('a condition reads the row of another key with `of`, or a board parameter', () => {
    const r1 = designRules([{ target: 'fan', of: 'tm', key: 'value', op: 'gt', value: 80, pulse: true }], { rows, keys });
    expect(Object.keys(r1.overrides)).toEqual(['fan']);
    const r2 = designRules([{ target: 'door', source: 'param', key: 'mode', op: 'eq', value: 'night', hidden: true }], { rows, keys, params: { mode: 'night' } });
    expect(r2.hidden).toEqual(['door']);
    expect(designRules([{ target: 'door', source: 'param', key: 'mode', op: 'eq', value: 'night', hidden: true }], { rows, keys, params: { mode: 'day' } }).hidden).toEqual([]);
  });
  it('two conditions join with all or any', () => {
    const base = { target: 'tm', key: 'value', op: 'gt', value: 80, source2: 'column', key2: 'status', op2: 'eq', value2: 'alarm', pulse: true };
    expect(designRules([{ ...base }], { rows, keys }).overrides).toEqual({});
    expect(designRules([{ ...base, join: 'any' }], { rows, keys }).overrides).toEqual({ tm: { pulse: true } });
  });
  it('a * rule reaches every key, a later rule overrides an effect and stop ends the evaluation', () => {
    const rules = [{ target: '*', color: '#112233' }, { target: 'tm', color: '#aabbcc', stop: true }, { target: 'tm', pulse: true }];
    const r = designRules(rules, { rows, keys });
    expect(r.overrides.pump).toEqual({ color: '#112233' });
    expect(r.overrides.tm).toEqual({ color: '#aabbcc' });
  });
  it('a stale key does nothing: a rule on a key the document does not have, and null or empty rules', () => {
    expect(designRules([{ target: 'gone', color: '#ff0000' }], { rows, keys })).toEqual({ overrides: {}, hidden: [], statuses: {} });
    expect(designRules(null, { rows, keys }).overrides).toEqual({});
    expect(designRules([], { rows, keys }).overrides).toEqual({});
    expect(designRules([{ target: 'tm', pulse: true }], { rows, keys: [] }).overrides).toEqual({});
  });
  it('a disabled rule and a malformed one do nothing', () => {
    const r = designRules([{ target: 'tm', enabled: false, pulse: true }, 'text', null, { id: 'x', when: { a: 1 } }, { target: 'tm', op: 'zz', pulse: true }], { rows, keys });
    expect(r.overrides).toEqual({});
  });
  it('a row with no reading matches only unset; an effect that is not valid is not an effect', () => {
    expect(designRules([{ target: 'door', key: 'value', op: 'gt', value: 1, pulse: true }], { rows, keys }).overrides).toEqual({});
    expect(designRules([{ target: 'door', key: 'value', op: 'unset', pulse: true, color: 'url(x)' }], { rows, keys }).overrides).toEqual({ door: { pulse: true } });
  });
  it('prototype names are never targets or keys, and an own __proto__ key never reaches the maps', () => {
    const r = designRules([{ target: '__proto__', pulse: true }, { target: 'constructor', pulse: true }, { target: '*', color: '#010203' }], { rows: [{ id: '__proto__', value: 1 }], keys: ['__proto__', 'constructor', 'a'] });
    expect(Object.keys(r.overrides)).toEqual(['a']);
    expect(({} as Record<string, unknown>).pulse).toBeUndefined();
  });
  it('caps the targets', () => {
    const many = Array.from({ length: MAX_DESIGN_RULE_TARGETS + 50 }, (_, i) => `k${i}`);
    expect(Object.keys(designRules([{ target: '*', pulse: true }], { rows: [], keys: many }).overrides)).toHaveLength(MAX_DESIGN_RULE_TARGETS);
  });
  it('runs the shared engine: the same rows under the diagram spec give the same matches (2D is unchanged)', () => {
    const rule = { target: 'tm', key: 'value', op: 'gt', value: 80, color: '#ff0000', blink: true };
    const map = new Map(rows.map((r) => [r.id, r]));
    const diagram = evaluateRules([rule], { rows: map, effects: SCENE_RULE_EFFECTS });
    const design = designRuleEffects([rule], { rows, keys });
    expect([...diagram.keys()]).toEqual([...design.keys()]);
    expect(diagram.get('tm')).toMatchObject({ color: '#ff0000', blink: true });
    expect(design.get('tm')).toEqual({ color: '#ff0000' });
    expect(Object.keys(DESIGN_RULE_EFFECTS).sort()).toEqual(['color', 'hidden', 'highlight', 'label', 'pulse']);
  });
});

describe('design rules: the viewer\'s colours and the status fallback', () => {
  it('turns a kit token into a literal and keeps hex, rgb and hsl; transparent and unknown tokens give none', () => {
    expect(viewerColor('var(--error)')).toBe('#f87171');
    expect(viewerColor('#d1242f')).toBe('#d1242f');
    expect(viewerColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    expect(viewerColor('hsl(10 50% 50%)')).toBe('hsl(10 50% 50%)');
    expect(viewerColor('transparent')).toBeUndefined();
    expect(viewerColor('var(--text-disabled)')).toBeUndefined();
    expect(viewerColor('red')).toBeUndefined();
    expect(viewerColor(5)).toBeUndefined();
  });
  it('reads a colour as a status word for an older viewer: red alarm, amber warn, green ok, anything else none', () => {
    expect(statusOfColor('var(--error)')).toBe('alarm');
    expect(statusOfColor('#ff0000')).toBe('alarm');
    expect(statusOfColor('var(--warning)')).toBe('warn');
    expect(statusOfColor('#f59e0b')).toBe('warn');
    expect(statusOfColor('var(--success)')).toBe('ok');
    expect(statusOfColor('hsl(140 60% 40%)')).toBe('ok');
    expect(statusOfColor('#3b82f6')).toBeUndefined();
    expect(statusOfColor('#808080')).toBeUndefined();
    expect(statusOfColor('transparent')).toBeUndefined();
  });
  it('designResult carries the statuses: a colour by its word, a pulse alone as an alarm, nothing for a blue label', () => {
    const fx = new Map([['a', { color: 'var(--error)' }], ['b', { pulse: true }], ['c', { color: '#3b82f6', label: 'x' }], ['d', { hidden: true }]]);
    const r = designResult(fx);
    expect(r.statuses).toEqual({ a: 'alarm', b: 'alarm' });
    expect(r.hidden).toEqual(['d']);
    expect(r.overrides).toEqual({ a: { color: '#f87171' }, b: { pulse: true }, c: { color: '#3b82f6', label: 'x' } });
  });
});

describe('design rules: shape and issues', () => {
  it('a design rule is a flat record of known fields with scalar values', () => {
    expect(isDesignRule({ target: 'tm', op: 'gt', value: 3, pulse: true })).toBe(true);
    expect(isDesignRule({ target: 'tm', when: 1 })).toBe(false);
    expect(isDesignRule({ target: 'tm', color: { a: 1 } })).toBe(false);
    expect(isDesignRule({ target: 'x'.repeat(300) })).toBe(false);
    expect(isDesignRule('rule')).toBe(false);
    expect(isDesignRule([])).toBe(false);
  });
  it('finds what is wrong: a missing target, an operator without a value, a bad colour or flag, an unknown or nested field', () => {
    const paths = (r: unknown) => designRuleIssues(r).map((i) => i.path);
    expect(designRuleIssues([{ target: 'tm', key: 'value', op: 'gt', value: '80', color: '#ff0000', pulse: true }])).toEqual([]);
    expect(paths([{ pulse: true }])).toEqual(['rules.0.target']);
    expect(paths([{ target: 'tm', op: 'gt', key: 'value', value: 'abc' }])).toContain('rules.0.value');
    expect(paths([{ target: 'tm', op: 'between', key: 'value', value: 1 }])).toContain('rules.0.to');
    expect(paths([{ target: 'tm', color: 'nope' }])).toContain('rules.0.color');
    expect(paths([{ target: 'tm', color: 'transparent' }])).toContain('rules.0.color');
    expect(paths([{ target: 'tm', pulse: 'maybe' }])).toContain('rules.0.pulse');
    expect(paths([{ target: 'tm', extra: 1 }])).toContain('rules.0.extra');
    expect(paths([{ target: 'tm', when: { a: 1 } }])).toContain('rules.0.when');
    expect(paths(['text'])).toEqual(['rules.0']);
    expect(paths([{ target: '__proto__' }])).toEqual(['rules.0.target']);
    expect(paths(Array.from({ length: MAX_SCENE_RULES + 1 }, () => ({ target: 'a' })))).toContain('rules');
    expect(paths([{ target: 'a', label: 'x'.repeat(81) }])).toContain('rules.0.label');
  });
  it('does not judge targets (only the document knows them): stale references are reported, not dropped', () => {
    const rules = [{ target: 'gone', of: 'tm', color: '#ff0000' }, { target: '*', of2: 'ghost', op: 'set', key: 'v', op2: 'set', key2: 'v' }, { target: 'tm' }];
    expect(designRuleIssues(rules)).toEqual([]);
    expect(staleReferences(rules, keys)).toEqual([{ index: 0, field: 'target', name: 'gone' }, { index: 1, field: 'of2', name: 'ghost' }]);
    expect(staleReferences(null, keys)).toEqual([]);
  });
});

describe('design rules: edits', () => {
  it('adds, updates, moves, duplicates and removes without touching the input', () => {
    const start: unknown[] = [];
    const a = addDesignRule(start, { target: 'tm' });
    expect(start).toEqual([]);
    expect(a.rules).toEqual([{ enabled: true, target: 'tm' }]);
    const u = updateDesignRule(a.rules, 0, { op: 'gt', key: 'value', value: 80, pulse: 'true', color: 'var(--error)' });
    expect(u.rules[0]).toEqual({ enabled: true, target: 'tm', op: 'gt', key: 'value', value: '80', pulse: true, color: 'var(--error)' });
    const cleared = updateDesignRule(u.rules, 0, { color: '', pulse: '' });
    expect(cleared.rules[0]).toEqual({ enabled: true, target: 'tm', op: 'gt', key: 'value', value: '80' });
    const two = addDesignRule(cleared.rules, { target: 'pump' });
    expect(moveDesignRule(two.rules, 1, 'up').rules.map((r) => (r as { target: string }).target)).toEqual(['pump', 'tm']);
    expect(moveDesignRule(two.rules, 0, 'up').rules).toEqual(two.rules);
    expect(duplicateDesignRule(two.rules, 0).index).toBe(1);
    expect(duplicateDesignRule(two.rules, 0).rules).toHaveLength(3);
    expect(removeDesignRule(two.rules, 0).rules).toHaveLength(1);
    expect(removeDesignRule(two.rules, 9).refused).toBeTruthy();
  });
  it('refuses a field that is not a rule field, a flag that is not yes or no, a text past its length, and a rule past the cap', () => {
    const a = addDesignRule([], { target: 'tm' }).rules;
    expect(updateDesignRule(a, 0, { nope: 1 }).refused).toBeTruthy();
    expect(updateDesignRule(a, 0, { pulse: 'maybe' }).refused).toBeTruthy();
    expect(updateDesignRule(a, 0, { label: 'x'.repeat(81) }).refused).toBeTruthy();
    expect(updateDesignRule(a, 0, { value: 'x'.repeat(201) }).refused).toBeTruthy();
    expect(updateDesignRule(a, 5, { pulse: true }).refused).toBeTruthy();
    const full = Array.from({ length: MAX_SCENE_RULES }, () => ({ target: 'a' }));
    expect(addDesignRule(full, {}).refused).toBeTruthy();
    expect(duplicateDesignRule(full, 0).refused).toBeTruthy();
    expect(newDesignRule({ target: 'tm' })).toEqual({ enabled: true, target: 'tm' });
  });
  it('an unchanged update hands the same content back', () => {
    const a = addDesignRule([], { target: 'tm', pulse: true }).rules;
    expect(updateDesignRule(a, 0, { pulse: true }).rules).toEqual(a);
  });
});

describe('design rules: the sentence', () => {
  it('reads a rule in words', () => {
    const rule = { target: 'tm', key: 'value', op: 'gt', value: '80', color: 'var(--error)', pulse: true, label: 'Hot', stop: true };
    expect(describeDesignRule(rule, DEFAULT_DESIGN_RULE_WORDS, { withTarget: true })).toBe("For tm: When value of this item is above 80, colour it red, show 'Hot' and pulse, then stop");
    expect(describeDesignRule({ target: '*', hidden: true, enabled: false })).toBe('Always, hide it (off)');
    expect(describeDesignRule({ target: 'a', source: 'param', key: 'mode', op: 'in', value: 'a, b', op2: 'set', key2: 'v', join: 'any' }, DEFAULT_DESIGN_RULE_WORDS, { paramLabel: () => 'Mode' }))
      .toBe('When parameter Mode is one of a, b or v of this item is set, change nothing');
    expect(describeDesignRule('x')).toBe('');
  });
});
