import { describe, it, expect } from 'vitest';
import type { SceneSettings } from '../views/scada-scene-logic';
import { MAX_SCENE_RULES, validateRules } from '../views/scene-rules-logic';
import { deleteElements, renameElement, targetNames, type Rec } from '../views/scene-edit-logic';
import { addRule, describeRule, duplicateRule, matchingRules, moveRule, newRule, removeRule, ruleContext, ruleMatchFor, rulesFor, rulesOf, ruleTargets, updateRule } from '../views/scene-rules-edit';
import { DEFAULT_RULE_WORDS } from '../views/scene-editor-messages-panels';
import { deepFreeze, smallScene } from './scene-edit-fixture';

const rules = (s: SceneSettings) => (s as { rules?: Rec[] }).rules ?? [];
const targets = (s: SceneSettings) => rules(s).map((r) => r.target);

describe('newRule', () => {
  it('starts as the settings form\'s "add" does: the template\'s defaults, texts empty, choices absent', () => {
    const r = newRule();
    expect(r).toEqual({ enabled: true, target: '', source: 'column', key: '', of: '', value: '', to: '', join: 'all', source2: 'column', key2: '', of2: '', value2: '', to2: '', label: '', stop: false });
    expect('op' in r).toBe(false);
    expect('state' in r).toBe(false);
  });
  it('lays a seed over the defaults', () => {
    expect(newRule({ target: 'pump1', op: 'gt' })).toMatchObject({ target: 'pump1', op: 'gt', enabled: true });
  });
});

describe('addRule', () => {
  it('adds last by default with the new-row fields and says where', () => {
    const r = addRule(smallScene(), { target: 'pump1', key: 'value', op: 'gt', value: '24', state: 'warning' });
    expect(r.refused).toBeUndefined();
    expect(r.index).toBe(4);
    expect(rules(r.settings)).toHaveLength(5);
    expect(rules(r.settings)[4]).toMatchObject({ enabled: true, target: 'pump1', key: 'value', op: 'gt', value: '24', state: 'warning', stop: false });
    expect(validateRules(rules(r.settings), { elementIds: ['tank1', 'pump1', 'valve1'], linkIds: ['line1'] })).toEqual([]);
  });
  it('adds into a scene without rules, and at a position', () => {
    const a = addRule({ width: 400 }, { target: '*' });
    expect(a.settings).toMatchObject({ width: 400, rules: [{ target: '*' }] });
    const b = addRule(smallScene(), { target: 'x' }, 1);
    expect(b.index).toBe(1);
    expect(targets(b.settings)).toEqual(['pump1', 'x', '*', 'valve1', 'line1']);
    expect(addRule(smallScene(), { target: 'x' }, 99).index).toBe(4);
    expect(addRule(smallScene(), { target: 'x' }, -5).index).toBe(0);
  });
  it('does not touch its input, and is refused past the cap and for a bad field', () => {
    const s = smallScene();
    addRule(s, { target: 'a' });
    expect(rules(s)).toHaveLength(4);
    const full = { rules: Array.from({ length: MAX_SCENE_RULES }, () => ({ target: '*' })) } as SceneSettings;
    expect(addRule(full, {}).refused).toMatch(/at most/);
    expect(addRule(full, {}).settings).toBe(full);
    expect(addRule(smallScene(), { op2: 'nonsense' }).refused).toBeTruthy();
    expect(addRule(smallScene(), { bogus: 1 }).refused).toMatch(/not a rule field/);
    expect(addRule(smallScene(), { color: 'javascript:alert(1)' }).refused).toMatch(/not a colour/);
  });
});

describe('updateRule', () => {
  it('writes the fields it is given and leaves the rest', () => {
    const s = smallScene();
    const r = updateRule(s, 0, { op: 'gt', value: '24', state: 'warning', blink: true, dim: false });
    expect(rules(r.settings)[0]).toMatchObject({ target: 'pump1', key: 'running', op: 'gt', value: '24', state: 'warning', blink: 'true', dim: 'false' });
    expect(rules(r.settings)[1]).toBe(rules(s)[1]);
  });
  it('stores the yes/no effects as the strings the engine reads, and removes a choice when it is cleared', () => {
    const a = updateRule(smallScene(), 0, { hidden: true, animate: 'false' });
    expect(rules(a.settings)[0]).toMatchObject({ hidden: 'true', animate: 'false' });
    const b = updateRule(a.settings, 0, { hidden: '', animate: undefined, state: '' });
    expect('hidden' in rules(b.settings)[0]).toBe(false);
    expect('animate' in rules(b.settings)[0]).toBe(false);
  });
  it('keeps an empty text as an empty text, like the form', () => {
    const r = updateRule(smallScene(), 0, { key: '', value: undefined, of: '' });
    expect(rules(r.settings)[0]).toMatchObject({ target: 'pump1', key: '', of: '' });
  });
  it('is a no-op when nothing changes, and refuses a bad index', () => {
    const s = smallScene();
    expect(updateRule(s, 0, { target: 'pump1' }).settings).toBe(s);
    expect(updateRule(s, 9, { target: 'a' }).refused).toBe('No such rule');
    expect(updateRule(s, -1, { target: 'a' }).refused).toBe('No such rule');
  });
  it('refuses a value the field cannot hold', () => {
    const s = smallScene();
    for (const patch of [
      { op: 'sideways' }, { state: 'broken' }, { source: 'file' }, { join: 'xor' }, { enabled: 'maybe' }, { stop: 3 }, { color: 'not-a-colour' },
      { label: 'x'.repeat(81) }, { target: 'x'.repeat(65) }, { medium: 'plasma' }, { __proto__: 1, constructor: 2 }, { bogus: 'x' },
    ] as Rec[]) {
      const r = updateRule(s, 0, patch);
      expect(r.refused, JSON.stringify(patch)).toBeTruthy();
      expect(r.settings).toBe(s);
    }
  });
  it('accepts a theme colour and a custom one', () => {
    const r = updateRule(smallScene(), 0, { color: 'var(--warning)', fillColor: '#ff0000' });
    expect(rules(r.settings)[0]).toMatchObject({ color: 'var(--warning)', fillColor: '#ff0000' });
  });
  it('does not touch its input', () => {
    const s = deepFreeze(smallScene());
    expect(() => updateRule(s, 0, { op: 'gt' })).not.toThrow();
  });
});

describe('removeRule, moveRule, duplicateRule', () => {
  it('removes one rule, and the key when none is left', () => {
    expect(targets(removeRule(smallScene(), 1).settings)).toEqual(['pump1', 'valve1', 'line1']);
    const one = { rules: [{ target: 'a' }] } as SceneSettings;
    expect('rules' in removeRule(one, 0).settings).toBe(false);
    expect(removeRule(one, 3).refused).toBe('No such rule');
  });
  it('moves a rule up and down in the whole order, and stays put at the ends', () => {
    const s = smallScene();
    expect(targets(moveRule(s, 2, 'up').settings)).toEqual(['pump1', 'valve1', '*', 'line1']);
    expect(moveRule(s, 2, 'up').index).toBe(1);
    expect(targets(moveRule(s, 1, 'down').settings)).toEqual(['pump1', 'valve1', '*', 'line1']);
    expect(moveRule(s, 0, 'up').settings).toBe(s);
    expect(moveRule(s, 3, 'down').settings).toBe(s);
    expect(moveRule(s, 9, 'down').refused).toBe('No such rule');
  });
  it('moves past the neighbour of the list it is shown in, leaving the others where they are', () => {
    const s = { rules: [{ target: 'a' }, { target: 'b' }, { target: 'a' }, { target: 'c' }, { target: 'a' }] } as SceneSettings;
    const a = [0, 2, 4];
    const up = moveRule(s, 4, 'up', a);
    expect(targets(up.settings)).toEqual(['a', 'b', 'a', 'a', 'c']);
    expect(up.index).toBe(2);
    const down = moveRule(s, 0, 'down', a);
    expect(targets(down.settings)).toEqual(['b', 'a', 'a', 'c', 'a']);
    expect(down.index).toBe(2);
    expect(moveRule(s, 0, 'up', a).settings).toBe(s);
    expect(moveRule(s, 1, 'up', a).refused).toBe('No such rule');
  });
  it('keeps every rule exactly once through any run of moves', () => {
    let s = smallScene();
    const before = rules(s).map((r) => JSON.stringify(r)).sort();
    for (const [i, d] of [[0, 'down'], [1, 'down'], [3, 'up'], [2, 'up'], [0, 'down']] as const) s = moveRule(s, i, d).settings;
    expect(rules(s).map((r) => JSON.stringify(r)).sort()).toEqual(before);
  });
  it('duplicates a rule right after it, and refuses past the cap', () => {
    const r = duplicateRule(smallScene(), 1);
    expect(r.index).toBe(2);
    expect(targets(r.settings)).toEqual(['pump1', '*', '*', 'valve1', 'line1']);
    expect(rules(r.settings)[2]).toEqual(rules(r.settings)[1]);
    expect(rules(r.settings)[2]).not.toBe(rules(r.settings)[1]);
    const full = { rules: Array.from({ length: MAX_SCENE_RULES }, () => ({ target: '*' })) } as SceneSettings;
    expect(duplicateRule(full, 0).refused).toMatch(/at most/);
    expect(duplicateRule(smallScene(), 8).refused).toBe('No such rule');
  });
});

describe('rulesFor and ruleTargets', () => {
  it('puts the rules of the selection first, then *, then the others by target', () => {
    const s = { rules: [{ target: 'b' }, { target: '*' }, { target: 'a' }, { target: 'c' }, { target: 'b' }, { target: 'a' }, { target: '' }] } as SceneSettings;
    expect(rulesFor(s, ['a'])).toEqual({ own: [2, 5], star: [1], others: [{ target: 'b', indices: [0, 4] }, { target: 'c', indices: [3] }, { target: '', indices: [6] }] });
    expect(rulesFor(s, [])).toMatchObject({ own: [], star: [1] });
    expect(rulesFor(s, ['a', 'c']).own).toEqual([2, 3, 5]);
    expect(rulesFor({}, ['a'])).toEqual({ own: [], star: [], others: [] });
  });
  it('ignores a stray entry that is not an object', () => {
    expect(rulesFor({ rules: [null, 'x', { target: 'a' }] } as unknown as SceneSettings, ['a']).own).toEqual([2]);
    expect(rulesOf({ rules: 'nope' } as unknown as SceneSettings)).toEqual([]);
  });
  it('names a selection by the ids of its symbols and of the connections that carry one', () => {
    const s = smallScene();
    expect(ruleTargets(s, { elements: ['pump1'], links: [0, 1] })).toEqual(['pump1', 'line1']);
    expect(ruleTargets(s, {})).toEqual([]);
    expect(ruleTargets(s, { links: [7] })).toEqual([]);
  });
});

describe('describeRule', () => {
  it('writes a rule as a sentence', () => {
    const r = { target: 'pump1', key: 'temp', op: 'gt', value: '24', state: 'warning', label: 'High' };
    expect(describeRule(r)).toBe("When temp of this symbol is above 24, set the state to warning and show 'High'");
    expect(describeRule(r, DEFAULT_RULE_WORDS, { columnLabel: (k) => (k === 'temp' ? 'Temperature' : undefined) })).toBe("When Temperature of this symbol is above 24, set the state to warning and show 'High'");
  });
  it('reads another symbol\'s row, a parameter, two conditions, every operator and every effect', () => {
    expect(describeRule({ key: 'value', of: 'tank1', op: 'lt', value: 10, state: 'critical', color: 'var(--error)', blink: 'true', stop: true })).toBe(
      'When value of tank1 is below 10, set the state to critical, colour it var(--error) and blink, then stop');
    expect(describeRule({ source: 'param', key: 'mode', op: 'eq', value: 'night', hidden: 'true' })).toBe('When parameter mode is night, hide it');
    expect(describeRule({ key: 'a', op: 'between', value: '1', to: '5', dim: 'true', animate: 'false', medium: 'hot' })).toBe(
      'When a of this symbol is between 1 and 5, dim it, set the medium to hot and stop its motion');
    expect(describeRule({ key: 'a', op: 'between', value: '1', to: '5', join: 'any', key2: 'b', op2: 'in', value2: 'x, y,z', state: 'off' })).toBe(
      'When a of this symbol is between 1 and 5 or b of this symbol is one of x, y, z, set the state to off');
    expect(describeRule({ key: 'run', op: 'true', key2: 'm', op2: 'unset', fillColor: '#f00' })).toBe('When run of this symbol is on and m of this symbol is not set, fill it #f00');
    for (const op of ['eq', 'ne', 'gte', 'lte', 'set', 'false']) expect(describeRule({ key: 'k', op, value: '1', state: 'idle' })).toContain('k of this symbol');
  });
  it('says always when there is no condition, and what a rule that changes nothing does', () => {
    expect(describeRule({ target: '*', state: 'idle' })).toBe('Always, set the state to idle');
    expect(describeRule({ target: '*' })).toBe('Always, change nothing');
    expect(describeRule({ target: 'a', op2: 'gt', key2: 'x', value2: '1', state: 'idle' })).toBe('Always, set the state to idle');
  });
  it('can lead with the target, mark a disabled rule, and use the host\'s words', () => {
    expect(describeRule({ target: 'pump1', state: 'idle', enabled: false }, DEFAULT_RULE_WORDS, { withTarget: true })).toBe('For pump1: Always, set the state to idle (off)');
    expect(describeRule({ target: '*', state: 'idle' }, DEFAULT_RULE_WORDS, { withTarget: true })).toBe('For every symbol and connection: Always, set the state to idle');
    expect(describeRule({ target: 'a', state: 'idle' }, { ...DEFAULT_RULE_WORDS, always: 'Her zaman' })).toBe('Her zaman, set the state to idle');
    expect(describeRule(null)).toBe('');
  });
});

describe('live matching', () => {
  const s = smallScene();
  const points = { shape: 'table' as const, rows: [{ id: 'pump1', running: true, status: 'warning' }, { id: 'tank1', value: 30 }, { id: 'valve1', running: false }, { id: 'line1', running: true }] };
  const ctx = ruleContext(s, points, {});
  const names = [...targetNames(s)];

  it('says for how many of its targets a rule holds', () => {
    expect(ruleMatchFor({ target: 'pump1', key: 'running', op: 'true' }, names, ctx)).toEqual({ total: 1, matching: ['pump1'], enabled: true });
    expect(ruleMatchFor({ target: '*', key: 'running', op: 'true' }, names, ctx)).toEqual({ total: 4, matching: ['pump1', 'line1'], enabled: true });
    expect(ruleMatchFor({ target: 'valve1', key: 'running', op: 'true' }, names, ctx).matching).toEqual([]);
    expect(ruleMatchFor({ target: 'valve1', of: 'tank1', key: 'value', op: 'gt', value: '20' }, names, ctx).matching).toEqual(['valve1']);
  });
  it('holds a rule with no condition for every target', () => {
    expect(ruleMatchFor({ target: 'pump1', state: 'idle' }, names, ctx).matching).toEqual(['pump1']);
  });
  it('holds nothing for a disabled rule, a rule that names nothing, an empty target and a stray entry', () => {
    expect(ruleMatchFor({ target: 'pump1', key: 'running', op: 'true', enabled: false }, names, ctx)).toEqual({ total: 1, matching: [], enabled: false });
    expect(ruleMatchFor({ target: 'ghost', op: 'set', key: 'running' }, names, ctx)).toEqual({ total: 0, matching: [], enabled: true });
    expect(ruleMatchFor({ op: 'set', key: 'running' }, names, ctx).total).toBe(0);
    expect(ruleMatchFor('x', names, ctx)).toEqual({ total: 0, matching: [], enabled: false });
  });
  it('reads board parameters', () => {
    const p = ruleContext(s, points, { mode: 'night' });
    expect(ruleMatchFor({ target: 'pump1', source: 'param', key: 'mode', op: 'eq', value: 'night' }, names, p).matching).toEqual(['pump1']);
    expect(ruleMatchFor({ target: 'pump1', source: 'param', key: 'mode', op: 'eq', value: 'day' }, names, p).matching).toEqual([]);
    expect(ruleMatchFor({ target: 'pump1', source: 'param', key: 'nope', op: 'set' }, names, p).matching).toEqual([]);
  });
  it('lists the rules that hold with their targets, in rule order', () => {
    const withOps = {
      ...s,
      rules: [
        { target: 'pump1', key: 'running', op: 'true' }, { target: '*', key: 'status', op: 'eq', value: 'warning' },
        { target: 'valve1', key: 'running', op: 'true' }, { target: 'line1', key: 'running', op: 'true', enabled: false },
        { target: 'tank1', key: 'value', op: 'gt', value: '10' },
      ],
    } as SceneSettings;
    expect(matchingRules(withOps, ctx)).toEqual([{ index: 0, targets: ['pump1'] }, { index: 1, targets: ['pump1'] }, { index: 4, targets: ['tank1'] }]);
    expect(matchingRules({}, ctx)).toEqual([]);
    expect(matchingRules(withOps, ruleContext(withOps, undefined, {}))).toEqual([]);
  });
});

describe('with the edit model', () => {
  it('follows a renamed symbol and a deleted one the way the edit model prunes rules', () => {
    const added = addRule(smallScene(), { target: 'pump1', key: 'running', op: 'true', state: 'running' }).settings;
    expect(rules(renameElement(added, 'pump1', 'pumpA').settings).filter((r) => r.target === 'pumpA')).toHaveLength(2);
    expect(rules(deleteElements(added, ['pump1']).settings).some((r) => r.target === 'pump1')).toBe(false);
  });
});
