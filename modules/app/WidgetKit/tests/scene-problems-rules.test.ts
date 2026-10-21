import { describe, it, expect } from 'vitest';
import type { SceneSettings } from '../views/scada-scene-logic';
import { problems } from '../views/scene-edit-problems';
import { ruleProblems } from '../views/scene-problems-rules';
import { smallScene } from './scene-edit-fixture';

const scene = (rules: unknown[]): SceneSettings => ({ ...smallScene(), rules } as SceneSettings);
const run = (rules: unknown[], host = {}, data = {}) => ruleProblems(host)(scene(rules), data);
const codes = (ps: Array<{ code: string; id: string }>) => ps.map((p) => `${p.code}@${p.id}`);

describe('rule problems', () => {
  it('finds nothing wrong with sound rules', () => {
    expect(run([
      { target: 'pump1', key: 'running', op: 'true', state: 'running' },
      { target: '*', key: 'status', op: 'eq', value: 'critical', state: 'critical', blink: 'true' },
      { target: 'valve1', of: 'tank1', key: 'value', op: 'lt', value: '10', hidden: 'true' },
    ])).toEqual([]);
    expect(run([])).toEqual([]);
  });

  it('flags a target that names nothing, and a rule with no target, as errors', () => {
    const p = run([{ target: 'ghost', state: 'idle' }, { target: '', state: 'idle' }, { target: '  *  ', state: 'idle' }]);
    expect(codes(p)).toEqual(['rule-target-missing@rule:0', 'rule-target-missing@rule:1']);
    expect(p.every((x) => x.severity === 'error')).toBe(true);
    expect(p[0].message).toBe('Rule 1 targets ghost, which is not in the diagram');
  });
  it('accepts a connection id as a target', () => {
    expect(run([{ target: 'line1', state: 'idle' }])).toEqual([]);
  });
  it('flags a row (of, of2) that names nothing, even in a disabled rule', () => {
    const p = run([{ target: 'pump1', of: 'ghost', key: 'v', op: 'set' }, { target: 'pump1', op2: 'set', key2: 'v', of2: 'nowhere', enabled: false }]);
    expect(codes(p)).toEqual(['rule-of-missing@rule:0', 'rule-of-missing@rule:1']);
  });
  it('flags a parameter the board does not have, only when the host says which it has', () => {
    const rules = [{ target: 'pump1', source: 'param', key: 'mode', op: 'eq', value: 'a', state: 'idle' }];
    expect(codes(run(rules, { params: [{ key: 'site' }] }))).toEqual(['rule-param-unknown@rule:0']);
    expect(run(rules, { params: [{ key: 'mode' }] })).toEqual([]);
    expect(run(rules, {})).toEqual([]);
    expect(codes(run([{ target: 'pump1', op: 'set', key: 'v', op2: 'eq', source2: 'param', key2: 'nope', value2: '1' }], { params: [] }))).toEqual(['rule-param-unknown@rule:0']);
  });
  it('flags a column the table does not have: from the host, from the declared columns, from the rows', () => {
    const rules = [{ target: 'pump1', key: 'temp', op: 'gt', value: '1', state: 'warning' }];
    expect(codes(run(rules, { columns: [{ key: 'value' }] }))).toEqual(['rule-column-missing@rule:0']);
    expect(run(rules, { columns: [{ key: 'temp' }] })).toEqual([]);
    const declared = { points: { shape: 'table' as const, columns: [{ key: 'id', label: 'Id', type: 'text' as const }, { key: 'value', label: 'V', type: 'number' as const }] } };
    expect(codes(run(rules, {}, declared))).toEqual(['rule-column-missing@rule:0']);
    expect(codes(run(rules, {}, { points: { shape: 'table' as const, rows: [{ id: 'pump1', value: 1 }] } }))).toEqual(['rule-column-missing@rule:0']);
    expect(run(rules, {}, { points: { shape: 'table' as const, rows: [{ id: 'pump1', temp: 1 }] } })).toEqual([]);
  });
  it('does not call a missing column a problem with nothing bound, for "not set", or for a disabled rule', () => {
    expect(run([{ target: 'pump1', key: 'temp', op: 'gt', value: '1' }], {}, {})).toEqual([]);
    expect(run([{ target: 'pump1', key: 'temp', op: 'unset' }], { columns: [{ key: 'value' }] })).toEqual([]);
    expect(run([{ target: 'pump1', key: 'temp', op: 'gt', value: '1', enabled: false }], { columns: [{ key: 'value' }] })).toEqual([]);
    expect(run([{ target: 'pump1', key: 'temp' }], { columns: [{ key: 'value' }] })).toEqual([]);
  });
  it('flags a rule that repeats another, and one that overrides another\'s effect', () => {
    const dup = run([
      { target: 'pump1', key: 'running', op: 'true', state: 'running' },
      { target: 'pump1', key: 'running', op: 'true', state: 'running' },
    ]);
    expect(codes(dup)).toEqual(['rule-duplicate@rule:1']);
    expect(dup[0].message).toBe('Rule 2 repeats the target, condition and effects of rule 1');
    const clash = run([
      { target: 'pump1', key: 'running', op: 'true', state: 'running', color: 'var(--success)' },
      { target: 'pump1', key: 'running', op: 'true', state: 'warning', color: 'var(--success)', blink: 'true' },
    ]);
    expect(codes(clash)).toEqual(['rule-contradiction@rule:1']);
    expect(clash[0].message).toContain('state');
  });
  it('does not call rules with different conditions or targets a clash', () => {
    expect(run([
      { target: 'pump1', key: 'running', op: 'true', state: 'running' },
      { target: 'pump1', key: 'running', op: 'false', state: 'idle' },
      { target: 'valve1', key: 'running', op: 'true', state: 'warning' },
      { target: 'pump1', key: 'running', op: 'true', op2: 'set', key2: 'status', state: 'warning' },
    ])).toEqual([]);
  });
  it('flags rules after an unconditional stop for the same target, or for *', () => {
    const same = run([
      { target: 'pump1', state: 'idle', stop: true },
      { target: 'pump1', key: 'running', op: 'true', state: 'running' },
      { target: 'valve1', key: 'running', op: 'true', state: 'running' },
      { target: '*', key: 'status', op: 'set', state: 'warning' },
    ]);
    expect(codes(same)).toEqual(['rule-unreachable@rule:1']);
    const star = run([{ target: '*', state: 'idle', stop: true }, { target: 'valve1', key: 'a', op: 'set', state: 'running' }, { target: 'pump1', state: 'off' }]);
    expect(codes(star)).toEqual(['rule-unreachable@rule:1', 'rule-unreachable@rule:2']);
    expect(run([{ target: 'pump1', key: 'a', op: 'set', stop: true }, { target: 'pump1', state: 'idle' }])).toEqual([]);
    expect(run([{ target: 'pump1', state: 'idle', stop: true, enabled: false }, { target: 'pump1', state: 'off' }])).toEqual([]);
  });
  it('ignores a stray entry in the list', () => {
    expect(ruleProblems()(({ ...smallScene(), rules: [null, 'x', 3, { target: 'ghost' }] } as unknown) as SceneSettings, {}).map((p) => p.id)).toEqual(['rule:3']);
  });
  it('plugs into the scene problems list', () => {
    const s = scene([{ target: 'ghost', state: 'idle' }]);
    const all = problems(s, {}, { extra: ruleProblems() });
    expect(all.map((p) => p.code)).toContain('rule-target-missing');
    expect(all[0].severity).toBe('error');
  });
});
