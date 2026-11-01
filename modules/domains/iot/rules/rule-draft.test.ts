import { describe, expect, it } from 'vitest';
import { IOT_MESSAGES } from '../messages';
import type { RuleDefinition, RuleScope } from '../types/rules';
import {
  actsOnDevices, codeOf, collectIds, commandOptions, deviceOptions, draftProblems, emptyAction, emptyCondition, emptyDefinition, emptyTrigger, freshId, problemsAt, refOf, refOrHomeOf, valueOptions,
} from './rule-draft';

const m = IOT_MESSAGES.rules;
const scope: RuleScope = {
  place: { type: 'asset', id: 'a', name: 'Station 3', hasLocation: true },
  devices: [
    { deviceId: 'd1', name: 'Room 1', profileId: 'p1', values: [{ key: 'temperature', label: 'Temperature', sample: 29 }, { key: 'door_open', label: 'Door open', sample: false }] },
    { deviceId: 'd2', name: 'Room 2', profileId: 'p1', values: [{ key: 'temperature', label: 'Temperature', sample: 21 }, { key: 'humidity', label: 'Humidity', sample: 50 }] },
    { deviceId: 'd3', name: 'Fan 1', profileId: 'p2', values: [] },
  ],
  deviceTypes: [
    { profileId: 'p1', name: 'Climate sensor', deviceCount: 2, commands: [] },
    { profileId: 'p2', name: 'Fan', deviceCount: 1, commands: [{ method: 'fan.set', label: 'Fan on', tier: 'basic', highImpact: false, cardCanSend: true, paramsSchema: {} }] },
  ],
  roles: ['OWNER', 'ADMIN', 'USER'],
};

describe('device references', () => {
  it('a reference is a select code and back; nothing picked is empty', () => {
    expect(codeOf({ device: 'd1' })).toBe('d:d1');
    expect(codeOf({ deviceType: 'p1' })).toBe('t:p1');
    expect(codeOf({ home: true })).toBe('home');
    expect(codeOf({ device: '' })).toBe('');
    expect(codeOf(undefined)).toBe('');
    expect(refOf('t:p1')).toEqual({ deviceType: 'p1' });
    expect(refOf('d:d1')).toEqual({ device: 'd1' });
    expect(refOf('')).toEqual({ device: '' });
    expect(refOrHomeOf('home')).toEqual({ home: true });
  });

  it('offers the devices by name, and "Every <kind>" only for a kind with more than one device', () => {
    expect(deviceOptions(scope, m)).toEqual([
      { value: 'd:d1', label: 'Room 1' }, { value: 'd:d2', label: 'Room 2' }, { value: 'd:d3', label: 'Fan 1' }, { value: 't:p1', label: 'Every Climate sensor' },
    ]);
  });

  it('the values of a kind are the union of its devices’ values, each once, by name', () => {
    expect(valueOptions(scope, { deviceType: 'p1' }).map((v) => v.label)).toEqual(['Door open', 'Humidity', 'Temperature']);
    expect(valueOptions(scope, { device: 'd3' })).toEqual([]);
    expect(valueOptions(scope, { home: true })).toEqual([]);
  });

  it('the commands are those of the picked device’s kind', () => {
    expect(commandOptions(scope, { device: 'd3' }).map((c) => c.method)).toEqual(['fan.set']);
    expect(commandOptions(scope, { device: 'd1' })).toEqual([]);
    expect(commandOptions(scope, { device: '' })).toEqual([]);
  });
});

describe('ids', () => {
  const def: RuleDefinition = {
    v: 1, options: { overlap: 'ignore' }, when: [{ id: 't1', kind: 'manual' }],
    then: [{ id: 'a1', kind: 'choose', branches: [{ if: { kind: 'sun', is: 'day' }, then: [{ id: 'a2', kind: 'wait', sec: 1 }] }], else: [{ id: 'a3', kind: 'wait', sec: 1 }] }],
  };
  it('collects every id including the nested ones, and a fresh id skips them', () => {
    expect([...collectIds(def)].sort()).toEqual(['a1', 'a2', 'a3', 't1']);
    expect(freshId('a', collectIds(def))).toBe('a4');
    expect(freshId('t', collectIds(def))).toBe('t2');
  });
});

describe('actsOnDevices', () => {
  it('a command, a setting or a notice, nested ones included, needs the author’s confirmation; waits do not', () => {
    expect(actsOnDevices(emptyDefinition())).toBe(true);
    const quiet: RuleDefinition = { v: 1, options: { overlap: 'ignore' }, when: [{ id: 't1', kind: 'manual' }], then: [emptyAction('wait', 'a2')] };
    expect(actsOnDevices(quiet)).toBe(false);
    expect(actsOnDevices({ ...quiet, then: [emptyAction('notify', 'a1')] })).toBe(true);
    const nested: RuleDefinition = { ...quiet, then: [{ id: 'c', kind: 'choose', branches: [{ if: { kind: 'sun', is: 'day' }, then: [emptyAction('setting', 'a9')] }] }] };
    expect(actsOnDevices(nested)).toBe(true);
  });
});

describe('draftProblems', () => {
  it('a fresh draft has the unfinished rows listed with their paths', () => {
    const p = draftProblems('', emptyDefinition(), m);
    expect(p.map((x) => x.path.join('.'))).toEqual(['name', 'when.0.target', 'when.0.value', 'then.0.target']);
  });

  it('a finished rule has none', () => {
    const def: RuleDefinition = {
      v: 1, options: { overlap: 'ignore' },
      when: [{ id: 't1', kind: 'value', target: { device: 'd1' }, key: 'temperature', change: 'above', value: 28 }],
      onlyIf: { all: [{ kind: 'time', after: '08:00', before: '20:00' }, { kind: 'value', target: { device: 'd2' }, key: 'humidity', op: '<', value: 60 }] },
      then: [{ id: 'a1', kind: 'command', target: { device: 'd3' }, command: 'fan.set' }, { id: 'a2', kind: 'notify', recipients: [{ kind: 'role', role: 'ADMIN' }], text: 'Fan on' }],
    };
    expect(draftProblems('Fan rule', def, m)).toEqual([]);
  });

  it('a range needs both ends; a condition and nested actions are checked too', () => {
    const def: RuleDefinition = {
      v: 1, options: { overlap: 'ignore' },
      when: [{ id: 't1', kind: 'value', target: { device: 'd1' }, key: 'temperature', change: 'between', value: 20 }],
      then: [{ id: 'a1', kind: 'choose', branches: [{ if: { kind: 'value', target: { device: '' }, key: '', op: '>', value: '' }, then: [emptyAction('command', 'a2')] }] }],
    };
    const paths = draftProblems('x', def, m).map((x) => x.path.join('.'));
    expect(paths).toContain('when.0.value2');
    expect(paths).toContain('then.0.branches.0.if.target');
    expect(paths).toContain('then.0.branches.0.then.0.target');
  });

  it('problemsAt picks the problems under a row’s path', () => {
    const p = draftProblems('', emptyDefinition(), m);
    expect(problemsAt(p, ['when', 0]).map((x) => x.code)).toEqual(['device', 'value']);
    expect(problemsAt(p, ['name'])).toHaveLength(1);
    expect(problemsAt(p, ['then', 1])).toEqual([]);
  });
});

describe('calendar rows', () => {
  it('a new date trigger is the 1st of every month at 09:00; a new date condition names summer; a holiday condition says "not a holiday"', () => {
    expect(emptyTrigger('date', 't1')).toEqual({ id: 't1', kind: 'date', at: '09:00', daysOfMonth: [1] });
    expect(emptyCondition('date')).toEqual({ kind: 'date', months: [6, 7, 8, 9] });
    expect(emptyCondition('holiday')).toEqual({ kind: 'holiday', is: false });
  });

  it('a date condition that names nothing, or half a window, and a date trigger that mixes days of the month with weekdays are unfinished', () => {
    const def = emptyDefinition();
    def.when = [{ id: 't1', kind: 'date', at: '09:00', daysOfMonth: [1], days: [1] }];
    def.onlyIf = { all: [{ kind: 'date' }, { kind: 'date', from: '06-01' }, { kind: 'date', months: [6] }, { kind: 'holiday', is: true }] };
    const codes = draftProblems('x', def, m).map((p) => p.code);
    expect(codes).toContain('date_days_conflict');
    expect(codes.filter((c) => c === 'date_empty')).toHaveLength(1);
    expect(codes.filter((c) => c === 'date_window_half')).toHaveLength(1);
  });
});
