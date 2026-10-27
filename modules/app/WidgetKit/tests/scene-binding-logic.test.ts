import { describe, it, expect } from 'vitest';
import {
  KEY_GRAMMAR, MAIN_ROLE, MAX_BINDING_DEVICES, MAX_BINDING_MAP, autoMatch, bindingDraft, devicesFromRoles, draftSignature, elementsForRole,
  isRoleName, isSceneKey, proposeRoles, roleFromCode, sameDraft, splitKey, unresolved, validateDraft,
  type BindingDraft, type DeviceElement, type SceneKey,
} from '../views/scene-binding-logic';

const key = (k: string, extra: Partial<SceneKey> = {}): SceneKey => ({ key: k, kind: 'symbol', ...extra });
const el = (element: string, extra: Partial<DeviceElement> = {}): DeviceElement => ({ element, ...extra });
const how = (r: ReturnType<typeof autoMatch>) => r.map((x) => `${x.key}:${x.element ?? '-'}:${x.how}`);

describe('key and role grammar', () => {
  it('accepts the key grammar and nothing outside it', () => {
    for (const ok of ['heater', '_x', 'a.b-c_1', 'A'.repeat(48)]) expect(isSceneKey(ok)).toBe(true);
    for (const bad of ['', '1a', 'a b', 'a/b', 'é', 'A'.repeat(49), '-a', '.a']) expect(isSceneKey(bad)).toBe(false);
    expect(KEY_GRAMMAR.test('fryer.heater')).toBe(true);
  });
  it('refuses the names a plain object answers for', () => {
    for (const bad of ['__proto__', 'constructor', 'prototype']) {
      expect(isSceneKey(bad)).toBe(false);
      expect(isRoleName(bad)).toBe(false);
    }
  });
  it('a role has no separator in it', () => {
    expect(isRoleName('fryer')).toBe(true);
    expect(isRoleName('fry.er')).toBe(false);
    expect(isRoleName('')).toBe(false);
  });
});

describe('splitKey', () => {
  it('takes the role prefix only when the role is known and something follows', () => {
    expect(splitKey('fryer.heater', ['fryer'])).toEqual({ role: 'fryer', local: 'heater' });
    expect(splitKey('fryer.heater', [])).toEqual({ role: MAIN_ROLE, local: 'fryer.heater' });
    expect(splitKey('fryer.', ['fryer'])).toEqual({ role: MAIN_ROLE, local: 'fryer.' });
    expect(splitKey('fryerx.heater', ['fryer'])).toEqual({ role: MAIN_ROLE, local: 'fryerx.heater' });
  });
  it('takes the longest known role and ignores the main one', () => {
    expect(splitKey('a.b.c', ['a', 'a.b', ''])).toEqual({ role: 'a.b', local: 'c' });
    expect(splitKey('x', [MAIN_ROLE])).toEqual({ role: MAIN_ROLE, local: 'x' });
  });
});

describe('autoMatch: by key', () => {
  it('matches a key that is the element id', () => {
    const r = autoMatch([key('heater'), key('pump')], [el('pump'), el('heater')], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['heater:heater:key', 'pump:pump:key']);
    expect(r[0].deviceId).toBe('d1');
  });
  it('is exact: case matters, and a key with no element is none', () => {
    const r = autoMatch([key('Heater'), key('ghost')], [el('heater')], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['Heater:-:none', 'ghost:-:none']);
    expect(r[0].deviceId).toBeNull();
  });
  it('hands an element out once', () => {
    const r = autoMatch([key('a'), key('a')], [el('a')], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['a:a:key', 'a:-:none']);
  });
  it('runs on the elements of the main device when no device is named', () => {
    const r = autoMatch([key('a')], [el('a')]);
    expect(how(r)).toEqual(['a:a:key']);
    expect(r[0].deviceId).toBeNull();
  });
  it('ignores the elements of a device that is not bound to the role', () => {
    const r = autoMatch([key('a')], [el('a', { deviceId: 'other' })], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['a:-:none']);
  });
});

describe('autoMatch: by label', () => {
  it('matches a unique label, ignoring case, against the element label or name', () => {
    const r = autoMatch(
      [key('k1', { label: 'Fryer Heater' }), key('k2', { label: 'PUMP' })],
      [el('t1', { label: 'fryer heater' }), el('pump')],
      { devices: { '': 'd1' } },
    );
    expect(how(r)).toEqual(['k1:t1:label', 'k2:pump:label']);
  });
  it('leaves a label two elements share alone', () => {
    const r = autoMatch([key('k1', { label: 'Temp' })], [el('t1', { label: 'Temp' }), el('t2', { label: 'temp' })], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['k1:-:none']);
  });
  it('leaves a label two keys share alone', () => {
    const r = autoMatch([key('k1', { label: 'Temp' }), key('k2', { label: 'temp' })], [el('t1', { label: 'Temp' })], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['k1:-:none', 'k2:-:none']);
  });
  it('does not take an element a key match already has', () => {
    const r = autoMatch([key('t1'), key('k2', { label: 'T1 reading' })], [el('t1', { label: 'T1 reading' })], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['t1:t1:key', 'k2:-:none']);
  });
  it('ignores a blank label', () => {
    expect(how(autoMatch([key('k', { label: '  ' })], [el('x', { label: '  ' })]))).toEqual(['k:-:none']);
  });
});

describe('autoMatch: by catalogue type', () => {
  it('pairs the free keys and elements of one type in list order, flagged as a proposal', () => {
    const r = autoMatch(
      [key('p1', { catalogue: 'pump' }), key('p2', { catalogue: 'Pump' }), key('h1', { catalogue: 'heater' })],
      [el('motorB', { catalogue: 'pump' }), el('heat', { catalogue: 'heater' }), el('motorA', { catalogue: 'pump' })],
      { devices: { '': 'd1' } },
    );
    expect(how(r)).toEqual(['p1:motorB:type', 'p2:motorA:type', 'h1:heat:type']);
  });
  it('leaves the keys beyond the elements unmatched', () => {
    const r = autoMatch([key('p1', { catalogue: 'pump' }), key('p2', { catalogue: 'pump' })], [el('m', { catalogue: 'pump' })]);
    expect(how(r)).toEqual(['p1:m:type', 'p2:-:none']);
  });
  it('never takes an element a stronger step used', () => {
    const r = autoMatch([key('m', { catalogue: 'pump' }), key('p2', { catalogue: 'pump' })], [el('m', { catalogue: 'pump' })]);
    expect(how(r)).toEqual(['m:m:key', 'p2:-:none']);
  });
});

describe('autoMatch: steps, skip and claimed', () => {
  const keys = [key('a'), key('b', { label: 'Bee' })];
  const els = [el('a'), el('x', { label: 'bee' })];
  it('runs only the steps asked for', () => {
    expect(how(autoMatch(keys, els, { steps: ['key'] }))).toEqual(['a:a:key', 'b:-:none']);
    expect(how(autoMatch(keys, els))).toEqual(['a:a:key', 'b:x:label']);
  });
  it('does not match a skipped key and does not hand out a claimed element', () => {
    expect(how(autoMatch(keys, els, { skip: new Set(['b']) }))).toEqual(['a:a:key', 'b:-:none']);
    expect(how(autoMatch(keys, els, { claimed: [{ deviceId: '', element: 'x' }] }))).toEqual(['a:a:key', 'b:-:none']);
  });
});

describe('autoMatch: roles', () => {
  const devices = { '': 'main', fryer: 'd-fryer', grill: 'd-grill' };
  const elements = [
    el('heater', { deviceId: 'd-fryer' }), el('heater', { deviceId: 'd-grill' }), el('door', { deviceId: 'main' }), el('basket', { deviceId: 'd-fryer', label: 'Basket lift' }),
  ];
  it('the role prefix picks the device, the rest the element', () => {
    const r = autoMatch([key('fryer.heater'), key('grill.heater'), key('door')], elements, { devices });
    expect(r.map((x) => [x.role, x.deviceId, x.element])).toEqual([['fryer', 'd-fryer', 'heater'], ['grill', 'd-grill', 'heater'], ['', 'main', 'door']]);
    expect(r.every((x) => x.how === 'key')).toBe(true);
  });
  it('matches by label and type inside the role', () => {
    const r = autoMatch(
      [key('fryer.lift', { label: 'basket lift' }), key('grill.fan', { catalogue: 'fan' })],
      [...elements, el('blower', { deviceId: 'd-grill', catalogue: 'fan' }), el('blower2', { deviceId: 'd-fryer', catalogue: 'fan' })],
      { devices },
    );
    expect(how(r)).toEqual(['fryer.lift:basket:label', 'grill.fan:blower:type']);
  });
  it('a role with no device matches nothing, and an unknown prefix is part of the key', () => {
    const r = autoMatch([key('oven.heater'), key('fryer.heater')], elements, { devices: { fryer: 'd-fryer' }, roles: ['oven'] });
    expect(how(r)).toEqual(['oven.heater:-:none', 'fryer.heater:heater:key']);
    expect(r[0].role).toBe('oven');
    const u = autoMatch([key('oven.heater')], [el('oven.heater')], { devices: {} });
    expect(how(u)).toEqual(['oven.heater:oven.heater:key']);
  });
  it('elementsForRole: a role gets its device elements, the main role also the ones with no device', () => {
    expect(elementsForRole('fryer', elements, devices).map((e) => e.element)).toEqual(['heater', 'basket']);
    expect(elementsForRole('', [el('x')], {}).map((e) => e.element)).toEqual(['x']);
    expect(elementsForRole('fryer', [el('x')], {}).length).toBe(0);
  });
});

describe('proposed roles', () => {
  it('turns a code into a role', () => {
    expect(roleFromCode('fryer 01')).toBe('fryer_01');
    expect(roleFromCode('12')).toBe('_12');
    expect(roleFromCode('  ')).toBe('device');
    expect(roleFromCode('__proto__')).not.toBe('__proto__');
    expect(isRoleName(roleFromCode('a.b/c d'))).toBe(true);
    expect(roleFromCode('x'.repeat(80)).length).toBe(48);
  });
  it('one device is the main one', () => {
    expect(proposeRoles([{ id: 'd1', code: 'FRY-1' }])).toEqual({ d1: '' });
  });
  it('several devices take a declared role found in the code, else a role from the code, each once', () => {
    const r = proposeRoles(
      [{ id: 'a', code: 'KITCHEN-FRYER-1' }, { id: 'b', code: 'grill-2' }, { id: 'c', code: 'grill-2' }, { id: 'd', code: 'Oven' }],
      ['fryer'],
    );
    expect(r).toEqual({ a: 'fryer', b: 'grill-2', c: 'grill-2_2', d: 'Oven' });
  });
});

describe('bindingDraft', () => {
  const base = { documentId: 'doc1', slot: 'main', kind: 'design' };
  it('stores exceptions only: an identity match is never written', () => {
    const d = bindingDraft({
      ...base, devices: { '': 'd1', fryer: 'd2' },
      matches: [
        { key: 'heater', element: 'heater', deviceId: 'd1' },
        { key: 'fryer.basket', element: 'basket', deviceId: 'd2' },
        { key: 'fan', element: 'blower', deviceId: 'd1' },
        { key: 'fryer.lamp', element: 'lamp2', deviceId: 'd2' },
        { key: 'ghost', element: null },
      ],
    });
    expect(d).toEqual({
      ...base, devices: { '': 'd1', fryer: 'd2' }, hidden: [],
      map: { fan: { deviceId: 'd1', element: 'blower' }, 'fryer.lamp': { deviceId: 'd2', element: 'lamp2' } },
    });
  });
  it('stores a pick from another device than the role names, even under the same element name', () => {
    const d = bindingDraft({ ...base, devices: { '': 'd1' }, matches: [{ key: 'heater', element: 'heater', deviceId: 'd9' }] });
    expect(d.map).toEqual({ heater: { deviceId: 'd9', element: 'heater' } });
  });
  it('falls back to the role device when the match names none, and skips a match with no device at all', () => {
    expect(bindingDraft({ ...base, devices: { '': 'd1' }, matches: [{ key: 'fan', element: 'blower' }] }).map).toEqual({ fan: { deviceId: 'd1', element: 'blower' } });
    expect(bindingDraft({ ...base, devices: {}, matches: [{ key: 'fan', element: 'blower' }] }).map).toEqual({});
  });
  it('keeps hidden once, and copes with a prototype name as data', () => {
    const d = bindingDraft({ ...base, devices: { '': 'd1' }, matches: [{ key: '__proto__', element: 'x', deviceId: 'd1' }], hidden: ['a', 'a', 'b'] });
    expect(d.hidden).toEqual(['a', 'b']);
    expect(Object.keys(d.map)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(validateDraft(d).map((i) => i.code)).toContain('key-invalid');
  });
  it('signature ignores the order of keys', () => {
    const a = bindingDraft({ ...base, devices: { '': 'd1' }, matches: [{ key: 'a', element: 'x', deviceId: 'd1' }, { key: 'b', element: 'y', deviceId: 'd1' }] });
    const b = bindingDraft({ ...base, devices: { '': 'd1' }, matches: [{ key: 'b', element: 'y', deviceId: 'd1' }, { key: 'a', element: 'x', deviceId: 'd1' }] });
    expect(draftSignature(a)).toBe(draftSignature(b));
    expect(sameDraft(a, { ...b, slot: 'other' })).toBe(false);
  });
});

describe('devicesFromRoles', () => {
  it('builds the role table and names what is wrong with the roles', () => {
    expect(devicesFromRoles([{ deviceId: 'a', role: '' }, { deviceId: 'b', role: ' fryer ' }]).devices).toEqual({ '': 'a', fryer: 'b' });
    const r = devicesFromRoles([{ deviceId: 'a', role: 'x' }, { deviceId: 'b', role: 'x' }, { deviceId: 'c', role: 'a.b' }, { deviceId: 'd', role: '' }, { deviceId: 'e', role: '' }]);
    expect(r.issues).toEqual([{ code: 'role-duplicate', subject: 'x' }, { code: 'role-invalid', subject: 'a.b' }, { code: 'role-duplicate', subject: '' }]);
    expect(r.devices).toEqual({ x: 'a', '': 'd' });
  });
});

describe('validateDraft', () => {
  const ok: BindingDraft = { documentId: 'doc', slot: 's', kind: 'design', devices: { '': 'd1' }, map: { fan: { deviceId: 'd1', element: 'blower' } }, hidden: [] };
  const codes = (d: BindingDraft) => validateDraft(d).map((i) => i.code);
  it('a good draft has no issue', () => expect(validateDraft(ok)).toEqual([]));
  it('names every missing part', () => {
    expect(codes({ ...ok, documentId: '', slot: ' ', kind: '', devices: {} })).toEqual(['document-missing', 'slot-missing', 'kind-missing', 'no-devices']);
  });
  it('checks the grammar of keys, elements, roles and hidden', () => {
    expect(codes({ ...ok, map: { 'bad key': { deviceId: 'd1', element: 'x' } } })).toContain('key-invalid');
    expect(codes({ ...ok, map: { fan: { deviceId: 'd1', element: '1x' } } })).toContain('element-invalid');
    expect(codes({ ...ok, map: { fan: { deviceId: '', element: 'x' } } })).toContain('device-missing');
    expect(codes({ ...ok, devices: { 'a.b': 'd1' } })).toContain('role-invalid');
    expect(codes({ ...ok, devices: { '': '' } })).toContain('device-missing');
    expect(codes({ ...ok, hidden: ['no good'] })).toContain('hidden-invalid');
  });
  it('caps the devices at 100 and the map at 500', () => {
    const devices = Object.fromEntries(Array.from({ length: MAX_BINDING_DEVICES + 1 }, (_, i) => [`r${i}`, `d${i}`]));
    expect(codes({ ...ok, devices })).toContain('too-many-devices');
    expect(codes({ ...ok, devices: Object.fromEntries(Array.from({ length: MAX_BINDING_DEVICES }, (_, i) => [`r${i}`, `d${i}`])) })).not.toContain('too-many-devices');
    const mk = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, { deviceId: 'd1', element: `e${i}` }]));
    expect(codes({ ...ok, map: mk(MAX_BINDING_MAP + 1) })).toContain('too-many-map');
    expect(codes({ ...ok, map: mk(MAX_BINDING_MAP) })).not.toContain('too-many-map');
  });
});

describe('unresolved', () => {
  const sceneKeys = [key('heater'), key('fan'), key('fryer.lamp'), key('hidden1')];
  const elements = [el('heater', { deviceId: 'd1' }), el('spare', { deviceId: 'd1' }), el('lamp', { deviceId: 'd2' }), el('far', { deviceId: 'd9' })];
  it('lists the keys with no element, the elements no key reads, the roles without a device and the devices without a key', () => {
    const u = unresolved({
      sceneKeys, elements, devices: { '': 'd1', fryer: 'd2', grill: 'd3' }, roles: ['fryer', 'grill', 'oven'], hidden: ['hidden1'],
      matches: [{ key: 'heater', element: 'heater', deviceId: 'd1' }, { key: 'fan', element: null }],
    });
    expect(u.keys).toEqual(['fan', 'fryer.lamp']);
    expect(u.elements).toEqual([{ deviceId: 'd1', element: 'spare' }, { deviceId: 'd2', element: 'lamp' }]);
    expect(u.roles).toEqual(['oven']);
    expect(u.devices.sort()).toEqual(['d2', 'd3']);
  });
  it('everything matched leaves keys, roles and devices empty; an element of an unbound device is not listed', () => {
    const u = unresolved({
      sceneKeys: [key('heater')], elements: [el('heater', { deviceId: 'd1' }), el('far', { deviceId: 'd9' })], devices: { '': 'd1' },
      matches: [{ key: 'heater', element: 'heater', deviceId: 'd1' }],
    });
    expect(u).toEqual({ keys: [], elements: [], roles: [], devices: [] });
  });
  it('counts a key with no entry as unmatched and reads elements without a deviceId as the main device', () => {
    const u = unresolved({ sceneKeys: [key('a'), key('b')], elements: [el('a'), el('b')], devices: { '': 'd1' }, matches: [{ key: 'a', element: 'a' }] });
    expect(u.keys).toEqual(['b']);
    expect(u.elements).toEqual([{ deviceId: 'd1', element: 'b' }]);
    expect(u.devices).toEqual([]);
  });
});
