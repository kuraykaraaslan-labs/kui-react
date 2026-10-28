import { describe, it, expect } from 'vitest';
import {
  KEY_GRAMMAR, MAIN_ROLE, MAX_BINDING_DEVICES, MAX_BINDING_MAP, MAX_FIELDS_PER_KEY, NEW_SLOT_VALUE, autoMatch, bindingDraft, devicesFromRoles, documentChanged, normalizeSlotInput, slotChoices, slotIssue, draftSignature, elementsForRole,
  elementRefOf, fieldsOfMap, hasFields, isRoleName, isSceneKey, isSymbolField, isTelemetryKey, manualOfMap, proposeRoles, roleFromCode, sameDraft, splitKey, staleEntries, unresolved, validateDraft,
  type BindingDraft, type DeviceElement, type MapEntry, type SceneKey,
} from '../views/scene-binding-logic';

const key = (k: string, extra: Partial<SceneKey> = {}): SceneKey => ({ key: k, kind: 'symbol', ...extra });
const el = (element: string, extra: Partial<DeviceElement> = {}): DeviceElement => ({ element, ...extra });
const U1 = '11111111-1111-4111-8111-111111111111';
const DOC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
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
  it('runs on the elements with no device as the main device\'s, and gives them its id', () => {
    const r = autoMatch([key('a')], [el('a')], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['a:a:key']);
    expect(r[0].deviceId).toBe('d1');
  });
  it('reports no key match for a role with no device: an element with no device is not the main role\'s then', () => {
    expect(how(autoMatch([key('a')], [el('a')]))).toEqual(['a:-:none']);
    const r = autoMatch([key('a'), key('fryer.b')], [el('a'), el('b', { deviceId: 'd2' }), el('c', { deviceId: '' })], { devices: { fryer: 'd2' } });
    expect(how(r)).toEqual(['a:-:none', 'fryer.b:b:key']);
    // An empty deviceId is no device either.
    expect(how(autoMatch([key('c')], [el('c', { deviceId: '' })], { devices: { fryer: 'd2' } }))).toEqual(['c:-:none']);
    expect(how(autoMatch([key('c')], [el('c', { deviceId: '' })], { devices: { '': 'd1' } }))).toEqual(['c:c:key']);
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
    expect(how(autoMatch([key('k', { label: '  ' })], [el('x', { label: '  ' })], { devices: { '': 'd1' } }))).toEqual(['k:-:none']);
  });
  it('an ambiguous label never matches silently, even when a step before the label took one of the carriers', () => {
    // Two elements carry the label; one of them was handed out by the key step. The other must not be matched by label.
    const r = autoMatch([key('t1'), key('k2', { label: 'Temp' })], [el('t1', { label: 'Temp' }), el('t2', { label: 'Temp' })], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['t1:t1:key', 'k2:-:none']);
    // Two keys carry the label; one of them is settled by a hand pick, the other must not take the element by label.
    const r2 = autoMatch(
      [key('k1', { label: 'Temp' }), key('k2', { label: 'temp' })], [el('t1', { label: 'Temp' })],
      { devices: { '': 'd1' }, skip: new Set(['k1']) },
    );
    expect(how(r2)).toEqual(['k1:-:none', 'k2:-:none']);
    // Two keys carry the label, one is matched by key: the label of the other is still shared.
    const r3 = autoMatch([key('t1', { label: 'Temp' }), key('k2', { label: 'Temp' })], [el('t1'), el('t2', { label: 'Temp' })], { devices: { '': 'd1' } });
    expect(how(r3)).toEqual(['t1:t1:key', 'k2:-:none']);
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
    const r = autoMatch([key('p1', { catalogue: 'pump' }), key('p2', { catalogue: 'pump' })], [el('m', { catalogue: 'pump' })], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['p1:m:type', 'p2:-:none']);
  });
  it('never takes an element a stronger step used', () => {
    const r = autoMatch([key('m', { catalogue: 'pump' }), key('p2', { catalogue: 'pump' })], [el('m', { catalogue: 'pump' })], { devices: { '': 'd1' } });
    expect(how(r)).toEqual(['m:m:key', 'p2:-:none']);
  });
});

describe('autoMatch: steps, skip and claimed', () => {
  const keys = [key('a'), key('b', { label: 'Bee' })];
  const els = [el('a'), el('x', { label: 'bee' })];
  it('runs only the steps asked for', () => {
    expect(how(autoMatch(keys, els, { steps: ['key'], devices: { '': 'd1' } }))).toEqual(['a:a:key', 'b:-:none']);
    expect(how(autoMatch(keys, els, { devices: { '': 'd1' } }))).toEqual(['a:a:key', 'b:x:label']);
  });
  it('does not match a skipped key and does not hand out a claimed element', () => {
    expect(how(autoMatch(keys, els, { devices: { '': 'd1' }, skip: new Set(['b']) }))).toEqual(['a:a:key', 'b:-:none']);
    expect(how(autoMatch(keys, els, { devices: { '': 'd1' }, claimed: [{ deviceId: 'd1', element: 'x' }] }))).toEqual(['a:a:key', 'b:-:none']);
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
    const u = autoMatch([key('oven.heater')], [el('oven.heater')], { devices: { '': 'main' } });
    expect(how(u)).toEqual(['oven.heater:oven.heater:key']);
  });
  it('elementsForRole: a role gets its device elements, the main role also the ones with no device', () => {
    expect(elementsForRole('fryer', elements, devices).map((e) => e.element)).toEqual(['heater', 'basket']);
    expect(elementsForRole('', [el('x')], { '': 'd1' }).map((e) => e.element)).toEqual(['x']);
    expect(elementsForRole('', [el('x')], {}).length).toBe(0);
    expect(elementsForRole('fryer', [el('x')], { '': 'd1' }).length).toBe(0);
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
  it('treats an empty device id as no device: a role device fills in, with none the match is skipped', () => {
    expect(bindingDraft({ ...base, devices: { '': 'd1' }, matches: [{ key: 'fan', element: 'blower', deviceId: '' }] }).map).toEqual({ fan: { deviceId: 'd1', element: 'blower' } });
    expect(bindingDraft({ ...base, devices: { fryer: 'd2' }, matches: [{ key: 'fan', element: 'blower', deviceId: '' }, { key: 'x', element: 'x', deviceId: null }] }).map).toEqual({});
    expect(bindingDraft({ ...base, devices: { '': 'd1' }, matches: [{ key: 'heater', element: 'heater', deviceId: '' }] }).map).toEqual({});
  });
  it('carries view and rules through as they are, and only when there are some', () => {
    const view = { level: 'floor1', focus: 'pump' };
    const rules = [{ id: 'r1', when: { a: 1 } }];
    const d = bindingDraft({ ...base, devices: { '': 'd1' }, matches: [], view, rules });
    expect(d.view).toBe(view);
    expect(d.rules).toBe(rules);
    const bare = bindingDraft({ ...base, devices: { '': 'd1' }, matches: [] });
    expect('view' in bare).toBe(false);
    expect('rules' in bare).toBe(false);
    expect(bindingDraft({ ...base, devices: { '': 'd1' }, matches: [], view: null, rules: null })).toMatchObject({ view: null, rules: null });
    // They are part of "has anything changed", with null and absent the same.
    expect(sameDraft(d, bare)).toBe(false);
    expect(sameDraft(bare, { ...bare, view: null, rules: null })).toBe(true);
  });
  it('carries stale entries after the live ones; a live match or role wins over a carried one', () => {
    const d = bindingDraft({
      ...base, devices: { '': 'd1' }, matches: [{ key: 'fan', element: 'blower', deviceId: 'd1' }],
      carryMap: { old: { deviceId: 'd9', element: 'gone' }, fan: { deviceId: 'd9', element: 'stale' } },
      carryDevices: { oven: 'd7', '': 'd8' },
    });
    expect(d.map).toEqual({ fan: { deviceId: 'd1', element: 'blower' }, old: { deviceId: 'd9', element: 'gone' } });
    expect(d.devices).toEqual({ oven: 'd7', '': 'd1' });
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
  const ok: BindingDraft = { documentId: DOC, slot: 's', kind: 'design', devices: { '': U1 }, map: { fan: { deviceId: U1, element: 'blower' } }, hidden: [] };
  const codes = (d: BindingDraft) => validateDraft(d).map((i) => i.code);
  it('a good draft has no issue', () => expect(validateDraft(ok)).toEqual([]));
  it('names every missing part', () => {
    expect(codes({ ...ok, documentId: '', slot: ' ', kind: '', devices: {} })).toEqual(['document-missing', 'slot-missing', 'kind-missing', 'no-devices']);
  });
  it('checks the grammar of keys, elements, roles and hidden', () => {
    expect(codes({ ...ok, map: { 'bad key': { deviceId: U1, element: 'x' } } })).toContain('key-invalid');
    expect(codes({ ...ok, map: { fan: { deviceId: U1, element: '1x' } } })).toContain('element-invalid');
    expect(codes({ ...ok, map: { fan: { deviceId: '', element: 'x' } } })).toContain('device-missing');
    expect(codes({ ...ok, devices: { 'a.b': U1 } })).toContain('role-invalid');
    expect(codes({ ...ok, devices: { '': '' } })).toContain('device-missing');
    expect(codes({ ...ok, hidden: ['no good'] })).toContain('hidden-invalid');
  });
  it('checks the server grammars: slot, kind and every id (the document, each device)', () => {
    expect(codes({ ...ok, slot: 'Main' })).toEqual(['slot-invalid']);
    expect(codes({ ...ok, slot: '1a' })).toEqual(['slot-invalid']);
    expect(codes({ ...ok, slot: 'a'.repeat(33) })).toEqual(['slot-invalid']);
    expect(codes({ ...ok, slot: 'a'.repeat(32) })).toEqual([]);
    expect(codes({ ...ok, slot: 'side-1_x' })).toEqual([]);
    expect(codes({ ...ok, kind: 'Design' })).toEqual(['kind-invalid']);
    expect(codes({ ...ok, kind: 'a-b' })).toEqual(['kind-invalid']);
    expect(codes({ ...ok, kind: 'my_kind2' })).toEqual([]);
    expect(codes({ ...ok, documentId: 'doc-1' })).toEqual(['document-invalid']);
    expect(codes({ ...ok, devices: { '': 'd1' } })).toEqual(['device-invalid']);
    expect(codes({ ...ok, map: { fan: { deviceId: 'dev-2', element: 'x' } } })).toEqual(['device-invalid']);
    // The issue says what is wrong with what.
    expect(validateDraft({ ...ok, slot: 'Main' })).toEqual([{ code: 'slot-invalid', subject: 'Main' }]);
    // An uppercase uuid is a uuid (the server lower-cases it).
    expect(codes({ ...ok, documentId: DOC.toUpperCase() })).toEqual([]);
  });
  it('caps the devices at 100 and the map at 500', () => {
    const devs = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`r${i}`, `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`]));
    expect(codes({ ...ok, devices: devs(MAX_BINDING_DEVICES + 1) })).toContain('too-many-devices');
    expect(codes({ ...ok, devices: devs(MAX_BINDING_DEVICES) })).not.toContain('too-many-devices');
    const mk = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, { deviceId: U1, element: `e${i}` }]));
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

describe('unresolved: devices with no id', () => {
  it('an empty deviceId on a match or an element is no device', () => {
    const u = unresolved({
      sceneKeys: [key('a')], elements: [el('a', { deviceId: '' })], devices: { '': 'd1' },
      matches: [{ key: 'a', element: 'a', deviceId: '' }],
    });
    expect(u).toEqual({ keys: [], elements: [], roles: [], devices: [] });
  });
});

describe('staleEntries', () => {
  const keys = [key('heater'), key('fan')];
  it('names the saved exceptions, roles and hidden keys the scene and the device list have nothing for', () => {
    const s = staleEntries({
      sceneKeys: keys, deviceIds: ['d1'],
      map: { fan: { deviceId: 'd1', element: 'x' }, oldKey: { deviceId: 'd1', element: 'y' } },
      devices: { '': 'd1', oven: 'd-gone' },
      hidden: ['fan', 'oldHidden', 'oldHidden'],
    });
    expect(s).toEqual({ exceptions: ['oldKey'], roles: ['oven'], hidden: ['oldHidden'] });
  });
  it('nothing is stale when everything has its row', () => {
    expect(staleEntries({ sceneKeys: keys, deviceIds: ['d1'], map: { fan: { deviceId: 'd1', element: 'x' } }, devices: { '': 'd1' }, hidden: [] }))
      .toEqual({ exceptions: [], roles: [], hidden: [] });
  });
});

describe('slots (phase 42.2.3c)', () => {
  it('normalizes what is typed to the slot grammar', () => {
    expect(normalizeSlotInput('Second View')).toBe('second-view');
    expect(normalizeSlotInput('  a.b ')).toBe('a-b-');
    expect(normalizeSlotInput('Side View')).toBe('side-view');
    expect(normalizeSlotInput('Café_1')).toBe('caf_1');
    expect(normalizeSlotInput('x'.repeat(40))).toHaveLength(32);
    expect(normalizeSlotInput('')).toBe('');
  });
  it('judges a slot by the server grammar', () => {
    expect(slotIssue('')).toBe('missing');
    expect(slotIssue('  ')).toBe('missing');
    expect(slotIssue('1a')).toBe('invalid');
    expect(slotIssue('A')).toBe('invalid');
    expect(slotIssue('-a')).toBe('invalid');
    expect(slotIssue('main')).toBeNull();
    expect(slotIssue('side_2-b')).toBeNull();
    expect(slotIssue('a'.repeat(33))).toBe('invalid');
    expect(slotIssue('a'.repeat(32))).toBeNull();
  });
  it('lists main always, first, then the subject\'s slots sorted, without duplicates or names the grammar refuses', () => {
    expect(slotChoices([])).toEqual(['main']);
    expect(slotChoices(['side', 'detail', 'main', 'side', 'Bad', '9x'])).toEqual(['main', 'detail', 'side']);
  });
  it('the new-slot select value can never be a slot', () => {
    expect(slotIssue(NEW_SLOT_VALUE)).toBe('invalid');
  });
});

describe('documentChanged', () => {
  it('needs both fingerprints, and a difference', () => {
    expect(documentChanged('a', 'b')).toBe(true);
    expect(documentChanged('a', 'a')).toBe(false);
    expect(documentChanged(null, 'b')).toBe(false);
    expect(documentChanged('a', null)).toBe(false);
    expect(documentChanged(undefined, undefined)).toBe(false);
    expect(documentChanged('', 'b')).toBe(false);
  });
});

describe('the field map (next-boilerplate phase 45, D45-3)', () => {
  const U2 = '22222222-2222-4222-8222-222222222222';
  const fields = { running: { key: 'pump_on' }, value: { key: 'temperature', deviceId: U2, label: 'Water' } };

  it('grammar: a field is a lower-case word of the symbol vocabulary or an item parameter, never a row column; a key is a telemetry key', () => {
    for (const ok of ['running', 'value2', 'status', 'position', 'speed', 'direction', 'mode', 'quality', 'doorOpen', 'fill_level', 'a'.repeat(32)]) expect(isSymbolField(ok)).toBe(true);
    for (const bad of ['', 'Running', '1a', 'a-b', 'a.b', 'a'.repeat(33), 'id', 'element', 'deviceId', 'ts', 'updatedAt', '__proto__', 'constructor']) expect(isSymbolField(bad)).toBe(false);
    for (const ok of ['temperature', 'battery.level', 'pdu1.running', 'a-b_c', 'A'.repeat(64)]) expect(isTelemetryKey(ok)).toBe(true);
    for (const bad of ['', 'a b', 'a/b', 'é', 'A'.repeat(65), '__proto__']) expect(isTelemetryKey(bad)).toBe(false);
  });

  it('reads a saved map apart: the element picks become hand picks, the field maps are carried', () => {
    const map: Record<string, MapEntry> = {
      fan: { deviceId: U1, element: 'blower' },
      heater: { fields },
      both: { deviceId: U1, element: 'x', fields: { value: { key: 'k' } } },
      empty: { fields: {} },
    };
    expect(manualOfMap(map)).toEqual({ fan: { deviceId: U1, element: 'blower' }, both: { deviceId: U1, element: 'x' } });
    expect(fieldsOfMap(map)).toEqual({ heater: fields, both: { value: { key: 'k' } } });
    expect(elementRefOf({ fields })).toBeNull();
    expect(elementRefOf({ element: 'e' })).toEqual({ deviceId: '', element: 'e' });
    expect(hasFields({ fields: {} })).toBe(false);
    expect(manualOfMap(undefined)).toEqual({});
  });

  describe('bindingDraft', () => {
    const base = { documentId: DOC, slot: 'main', kind: 'design', devices: { '': U1 } };
    it('writes a key\'s field map on top of its match, and alone for an identity match or no match: a fields entry is never dropped', () => {
      const d = bindingDraft({
        ...base,
        matches: [{ key: 'heater', element: 'heater', deviceId: U1 }, { key: 'fan', element: 'blower', deviceId: U1 }, { key: 'ghost', element: null }],
        fields: { heater: fields, fan: { value: { key: 'k' } }, ghost: { running: { key: 'on' } }, none: {} },
      });
      expect(d.map).toEqual({
        fan: { deviceId: U1, element: 'blower', fields: { value: { key: 'k' } } },
        heater: { fields },
        ghost: { fields: { running: { key: 'on' } } },
      });
    });
    it('round-trips an entry with fields through the drawer\'s reading (manual picks + fields) unchanged, and a carried stale entry keeps its fields', () => {
      const saved: Record<string, MapEntry> = { fan: { deviceId: U1, element: 'blower', fields: { value: { key: 'k' } } }, heater: { fields }, old: { fields: { value: { key: 'gone' } } } };
      const manual = manualOfMap(saved);
      const live = ['fan', 'heater'];
      const liveFields = Object.fromEntries(Object.entries(fieldsOfMap(saved)).filter(([k]) => live.includes(k)));
      const d = bindingDraft({
        ...base, matches: Object.entries(manual).map(([key, r]) => ({ key, element: r.element, deviceId: r.deviceId })), fields: liveFields, carryMap: { old: saved.old },
      });
      expect(d.map).toEqual(saved);
      expect(sameDraft(d, { ...base, map: saved, hidden: [] })).toBe(true);
    });
    it('the signature sees a changed field map', () => {
      const a = bindingDraft({ ...base, matches: [], fields: { heater: fields } });
      const b = bindingDraft({ ...base, matches: [], fields: { heater: { ...fields, value: { ...fields.value, key: 'other' } } } });
      expect(sameDraft(a, b)).toBe(false);
      expect(sameDraft(a, bindingDraft({ ...base, matches: [], fields: { heater: { value: fields.value, running: fields.running } } }))).toBe(true);
    });
  });

  it('autoMatch knows nothing of fields: a key with a field map still matches its element by key, and a field map is not an element', () => {
    const r = autoMatch([key('heater'), key('flat')], [el('heater', { deviceId: U1 })], { devices: { '': U1 } });
    expect(how(r)).toEqual(['heater:heater:key', 'flat:-:none']);
  });

  describe('validateDraft', () => {
    const ok: BindingDraft = { documentId: DOC, slot: 's', kind: 'design', devices: { '': U1 }, map: { heater: { fields } }, hidden: [] };
    const codes = (map: Record<string, MapEntry>) => validateDraft({ ...ok, map }).map((i) => `${i.code}${i.subject ? `:${i.subject}` : ''}`);
    it('a fields-only entry, with or without a device of its own, is fine; both parts together are fine', () => {
      expect(validateDraft(ok)).toEqual([]);
      expect(codes({ heater: { deviceId: U2, fields } })).toEqual([]);
      expect(codes({ heater: { deviceId: U1, element: 'x', fields } })).toEqual([]);
    });
    it('an entry with neither part, an element without its device, too many fields, and every field grammar are named', () => {
      expect(codes({ heater: {} })).toEqual(['entry-empty:heater']);
      expect(codes({ heater: { fields: {} } })).toEqual(['entry-empty:heater']);
      expect(codes({ heater: { element: 'x' } })).toEqual(['device-missing:heater']);
      expect(codes({ heater: { deviceId: 'bad', fields } })).toEqual(['device-invalid:heater']);
      const many = Object.fromEntries(Array.from({ length: MAX_FIELDS_PER_KEY + 1 }, (_, i) => [`f${i}`, { key: 'k' }]));
      expect(codes({ heater: { fields: many } })).toEqual(['too-many-fields:heater']);
      expect(codes({ heater: { fields: { Running: { key: 'k' } } } })).toEqual(['field-invalid:heater.Running']);
      expect(codes({ heater: { fields: { id: { key: 'k' } } } })).toEqual(['field-invalid:heater.id']);
      expect(codes({ heater: { fields: { value: { key: 'a b' } } } })).toEqual(['field-key-invalid:heater.value']);
      expect(codes({ heater: { fields: { value: { key: 'k', label: 'x'.repeat(61) } } } })).toEqual(['field-label-invalid:heater.value']);
      expect(codes({ heater: { fields: { value: { key: 'k', deviceId: 'nope' } } } })).toEqual(['device-invalid:heater.value']);
    });
  });

  it('unresolved: a key read by fields is not open, and the devices its fields name (or its role device) are used', () => {
    const u = unresolved({
      sceneKeys: [key('heater'), key('flat'), key('oven.door')], elements: [el('heater', { deviceId: U1 })], devices: { '': U1, oven: U2, spare: DOC },
      matches: [{ key: 'heater', element: 'heater', deviceId: U1 }],
      fields: { flat: { value: { key: 'temperature' } }, 'oven.door': { running: { key: 'open' } } },
    });
    expect(u.keys).toEqual([]);
    expect(u.devices).toEqual([DOC]);
    const v = unresolved({ sceneKeys: [key('flat')], elements: [], devices: { '': U1 }, matches: [], fields: { flat: {} } });
    expect(v.keys).toEqual(['flat']);
  });

  it('staleEntries lists a fields-only entry whose key left the document like any other exception', () => {
    expect(staleEntries({ sceneKeys: [key('heater')], deviceIds: [U1], map: { gone: { fields } }, devices: { '': U1 }, hidden: [] }).exceptions).toEqual(['gone']);
  });
});
