import { describe, it, expect } from 'vitest';
import {
  ageText, defaultInputName, draftFromSymbol, entryFromDraft, entryFromSymbol, expressionNames, fieldKindOf, formatSample, formatValue, hasOwnEntry, isBooleanish, isBound, isDirty,
  keyKindOf, mismatchOf, nextUnbound, pickableKeys, previewLine, rankKeysForField, sameEntry, scriptErrorKind, scriptTemplates, suggestKeyForField, suggestKeysForFields, templateFor, unitQuantity,
  CONFIDENT_SCORE, MAX_SCRIPT_LENGTH,
  type BindingDraft, type DeviceKey, type FieldDraft, type SymbolSpec,
} from '../views/symbol-binding-logic';

const blank = (): FieldDraft => ({ deviceId: '', deviceName: '', key: '', label: '', script: '', mode: 'value', inputs: [] });

const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const key = (k: string, value: unknown = 1, extra: Partial<DeviceKey> = {}): DeviceKey => ({ key: k, value, ts: 0, ...extra });

describe('suggestKeyForField', () => {
  it('takes <element>.<field> first when the element is known', () => {
    const keys = [key('pump_a.running'), key('pump_b.running'), key('pump_a.value', 3.2)];
    expect(suggestKeyForField({ name: 'running', label: 'Running' }, keys, 'pump_b')).toBe('pump_b.running');
    expect(suggestKeyForField({ name: 'value', label: 'Flow' }, keys, 'pump_a')).toBe('pump_a.value');
  });
  it('is ambiguous (null) when several keys end in the field and no element decides', () => {
    expect(suggestKeyForField({ name: 'running' }, [key('pump_a.running'), key('pump_b.running')])).toBeNull();
  });
  it('matches a key named like the field, with or without a prefix, ignoring case', () => {
    expect(suggestKeyForField({ name: 'running' }, [key('Running'), key('temperature', 20.5)])).toBe('Running');
    expect(suggestKeyForField({ name: 'value' }, [key('x1.value', 5), key('x1.other', 'a')])).toBe('x1.value');
  });
  it('matches the field name or label against the key name or the key label, and a synonym of either (temp is temperature, slice 16 U1)', () => {
    expect(suggestKeyForField({ name: 'value', label: 'Temperature' }, [key('t1', 21, { label: 'Temperature' }), key('h1', 40, { label: 'Humidity' })])).toBe('t1');
    expect(suggestKeyForField({ name: 'value', label: 'Temperature' }, [key('temp_c', 21), key('hum', 40)])).toBe('temp_c');
    expect(suggestKeyForField({ name: 'value', label: 'Temperature' }, [key('temperature_in', 21), key('hum', 40)])).toBe('temperature_in');
  });
  it('does not let a short name match everything inside other words', () => {
    // "on" is two letters: it matches a key named exactly like it, not every key that contains "on".
    expect(suggestKeyForField({ name: 'on', label: 'On' }, [key('connection_state', 'ok'), key('motor_speed', 1200)])).toBeNull();
  });
  it('falls back to the type: a state-like key for running, a measure for value, a word for status', () => {
    expect(suggestKeyForField({ name: 'running' }, [key('pump_state', 1), key('flow_rate', 12.4)])).toBe('pump_state');
    expect(suggestKeyForField({ name: 'value' }, [key('pump_state', 1), key('flow_rate', 12.4)])).toBe('flow_rate');
    expect(suggestKeyForField({ name: 'status' }, [key('flow_rate', 12.4), key('health', 'degraded')])).toBe('health');
  });
  it('is ambiguous when two keys fit the type', () => {
    expect(suggestKeyForField({ name: 'value' }, [key('a', 12.4), key('b', 99.1)])).toBeNull();
    expect(suggestKeyForField({ name: 'running' }, [key('a', true), key('b', false)])).toBeNull();
  });
  it('takes the only key there is, for any field, unless its kind speaks against it (then it is offered, not taken)', () => {
    expect(suggestKeyForField({ name: 'position' }, [key('opening', 45)])).toBe('opening');
    expect(suggestKeyForField({ name: 'anything' }, [key('only', 'x')])).toBe('only');
    expect(suggestKeyForField({ name: 'position' }, [key('opening', 'x')])).toBeNull();
    expect(rankKeysForField({ name: 'position' }, [key('opening', 'x')])[0]).toMatchObject({ key: 'opening', mismatch: 'text-for-number' });
  });
  it('gives null for no keys and for a field it knows nothing about among many keys', () => {
    expect(suggestKeyForField({ name: 'value' }, [])).toBeNull();
    expect(suggestKeyForField({ name: 'zzz' }, [key('a', 1), key('b', 2)])).toBeNull();
  });
  it('counts a unit as a sign of a measure even when the value is 0 or 1', () => {
    expect(suggestKeyForField({ name: 'value' }, [key('level', 1, { unit: 'm' }), key('pump_on', 1)])).toBe('level');
  });
});

describe('suggestKeysForFields', () => {
  it('does not give one key to two fields', () => {
    const keys = [key('flow', 12.4), key('pump.running', true)];
    const out = suggestKeysForFields([{ name: 'running' }, { name: 'value' }, { name: 'value2' }], keys, 'pump');
    expect(out).toEqual({ running: 'pump.running', value: 'flow' });
  });
  it('leaves out the keys already taken', () => {
    const keys = [key('flow', 12.4), key('level', 3.1)];
    expect(suggestKeysForFields([{ name: 'value' }], keys, undefined, ['flow'])).toEqual({ value: 'level' });
  });
});

describe('isBooleanish', () => {
  it('knows states', () => {
    for (const v of [true, false, 0, 1, 'on', 'OFF', 'Running']) expect(isBooleanish(v)).toBe(true);
    for (const v of [2, 21.5, 'degraded', null, {}]) expect(isBooleanish(v)).toBe(false);
  });
});

describe('ageText', () => {
  const now = 1_000_000_000_000;
  it('counts seconds, minutes, hours and days', () => {
    expect(ageText(now - 4000, now)).toBe('4 s ago');
    expect(ageText(now - 59_000, now)).toBe('59 s ago');
    expect(ageText(now - 3 * 60_000, now)).toBe('3 min ago');
    expect(ageText(now - 5 * 3_600_000, now)).toBe('5 h ago');
    expect(ageText(now - 3 * 86_400_000, now)).toBe('3 d ago');
  });
  it('says just now for under two seconds and for a clock that runs ahead', () => {
    expect(ageText(now - 1000, now)).toBe('just now');
    expect(ageText(now + 30_000, now)).toBe('just now');
  });
  it('reads an ISO date and gives nothing for a date that is not one', () => {
    expect(ageText(new Date(now - 10_000).toISOString(), now)).toBe('10 s ago');
    expect(ageText('not a date', now)).toBe('');
    expect(ageText(Number.NaN, now)).toBe('');
  });
  it('takes the words of the host', () => {
    const words = { now: 'gerade', seconds: (n: number) => `vor ${n} s`, minutes: (n: number) => `vor ${n} min`, hours: (n: number) => `vor ${n} h`, days: (n: number) => `vor ${n} d` };
    expect(ageText(now - 4000, now, words)).toBe('vor 4 s');
  });
});

describe('formatValue / formatSample', () => {
  it('formats numbers with their unit, states and words', () => {
    expect(formatValue(21.5, '°C')).toBe('21.5 °C');
    expect(formatValue(21.123456)).toBe('21.123');
    expect(formatValue(true)).toBe('true');
    expect(formatValue('on')).toBe('on');
    expect(formatValue(null)).toBe('–');
    expect(formatValue(Number.NaN)).toBe('–');
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
    expect(formatValue('x'.repeat(60)).length).toBe(40);
  });
  it('quotes text in a preview so "on" and on are told apart', () => {
    expect(formatSample('on')).toBe('"on"');
    expect(formatSample(1)).toBe('1');
    expect(formatSample(false)).toBe('false');
    expect(formatSample(undefined)).toBe('nothing');
  });
});

describe('scriptTemplates and previews', () => {
  it('offers the five quick fills, each a one-liner on value', () => {
    const t = scriptTemplates();
    expect(t.map((x) => x.id)).toEqual(['invert', 'scale', 'round', 'threshold', 'words']);
    expect(t.find((x) => x.id === 'invert')?.script).toBe('!value');
    expect(t.find((x) => x.id === 'scale')?.script).toBe('value / 4095 * 100');
    expect(t.find((x) => x.id === 'round')?.script).toBe('Math.round(value * 10) / 10');
    expect(t.find((x) => x.id === 'threshold')?.script).toBe('value > 80');
    expect(t.find((x) => x.id === 'words')?.script).toBe('value === "on"');
    for (const x of t) expect(x.script.length).toBeLessThanOrEqual(MAX_SCRIPT_LENGTH);
  });
  it('sorts the sandbox errors into plain kinds', () => {
    expect(scriptErrorKind('SyntaxError: Unexpected token )')).toBe('syntax');
    expect(scriptErrorKind('ReferenceError: foo is not defined')).toBe('name');
    expect(scriptErrorKind('Script timed out after 50 ms')).toBe('timeout');
    expect(scriptErrorKind('boom')).toBe('other');
  });
  it('builds the preview line', () => {
    expect(previewLine('', 1, null)).toEqual({ kind: 'none' });
    expect(previewLine('!value', undefined, null)).toEqual({ kind: 'wait' });
    expect(previewLine('!value', 1, { ok: true, result: false })).toEqual({ kind: 'ok', from: '1', to: 'false' });
    expect(previewLine('value === "on"', 'on', { ok: true, result: true })).toEqual({ kind: 'ok', from: '"on"', to: 'true' });
    expect(previewLine('(', 1, { ok: false, error: 'SyntaxError: Unexpected end of input' })).toEqual({
      kind: 'error', error: 'syntax', detail: 'SyntaxError: Unexpected end of input',
    });
  });
});

const SYMBOL: Pick<SymbolSpec, 'fields'> = {
  fields: [
    { name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler', key: 'b.running' }, currentScript: 'value === 1' },
    { name: 'value', label: 'Temperature' },
  ],
};

describe('draftFromSymbol / entryFromSymbol / isBound', () => {
  it('starts on the device of the first field that reads one, one draft per field', () => {
    const d = draftFromSymbol(SYMBOL);
    expect(d.deviceId).toBe(D1);
    expect(d.deviceName).toBe('Boiler');
    expect(d.fields.running).toMatchObject({ deviceId: D1, key: 'b.running', script: 'value === 1' });
    expect(d.fields.value).toMatchObject({ deviceId: '', key: '', script: '' });
  });
  it('uses the fallback device only when no field reads one', () => {
    expect(draftFromSymbol(SYMBOL, { id: 'x', name: 'X' }).deviceId).toBe(D1);
    expect(draftFromSymbol({ fields: [{ name: 'value', label: 'V' }] }, { id: 'x', name: 'X' })).toMatchObject({ deviceId: 'x', deviceName: 'X' });
    expect(draftFromSymbol({ fields: [] }).deviceId).toBe('');
  });
  it('skips a field whose name is a prototype name', () => {
    const d = draftFromSymbol({ fields: [{ name: '__proto__', label: 'x' }, { name: 'value', label: 'V' }] });
    expect(Object.keys(d.fields)).toEqual(['value']);
  });
  it('saves what the symbol has now as its entry, and knows it is bound', () => {
    expect(entryFromSymbol(SYMBOL)).toEqual({ fields: { running: { deviceId: D1, key: 'b.running', script: 'value === 1' } } });
    expect(isBound(SYMBOL)).toBe(true);
    expect(isBound({ fields: [{ name: 'value', label: 'V' }] })).toBe(false);
  });
});

const draft = (over: Partial<BindingDraft> = {}): BindingDraft => ({
  deviceId: D1,
  deviceName: 'Boiler',
  fields: { running: blank(), value: blank() },
  ...over,
});

describe('entryFromDraft', () => {
  it('drops fields with no key and writes the device of the draft on the rest', () => {
    const d = draft();
    d.fields.running = { ...d.fields.running, key: ' b.running ', script: ' !value ', label: ' Run ' };
    expect(entryFromDraft(d)).toEqual({ fields: { running: { deviceId: D1, key: 'b.running', label: 'Run', script: '!value' } } });
  });
  it('keeps a field on another device where it is', () => {
    const d = draft();
    d.fields.value = { ...blank(), deviceId: D2, deviceName: 'Roof', key: 'temp' };
    expect(entryFromDraft(d).fields.value).toEqual({ deviceId: D2, key: 'temp' });
  });
  it('leaves out an empty script and label, and the device when there is none', () => {
    const d = draft({ deviceId: '' });
    d.fields.value = { ...d.fields.value, key: 'temp', script: '   ' };
    expect(entryFromDraft(d)).toEqual({ fields: { value: { key: 'temp' } } });
  });
  it('cuts a script at 200 characters and a label at 60, but never cuts a key: a key the grammar refuses drops the field', () => {
    const d = draft();
    d.fields.running = { ...d.fields.running, key: 'k', script: 'x'.repeat(500), label: 'l'.repeat(100) };
    d.fields.value = { ...d.fields.value, key: 'k'.repeat(65) };
    const e = entryFromDraft(d);
    expect(e.fields.running.script?.length).toBe(MAX_SCRIPT_LENGTH);
    expect(e.fields.running.label?.length).toBe(60);
    expect(e.fields.value).toBeUndefined();
    d.fields.value = { ...d.fields.value, key: 'k'.repeat(64) };
    expect(entryFromDraft(d).fields.value.key?.length).toBe(64);
  });
  it('writes only what the map v2 grammars accept: telemetry keys, symbol fields, UUID devices, at most 16 fields', () => {
    const d = draft();
    d.fields.running = { ...d.fields.running, key: 'has space' };
    d.fields.value = { ...d.fields.value, key: 'ok', deviceId: 'not-a-uuid' };
    expect(entryFromDraft(d).fields).toEqual({});
    const many: BindingDraft['fields'] = {};
    for (let i = 0; i < 20; i += 1) many[`f${i}`] = { ...blank(), key: `k${i}` };
    expect(Object.keys(entryFromDraft({ ...draft(), fields: many }).fields)).toHaveLength(16);
    many.Bad = { ...blank(), key: 'k' };
    many['id'] = { ...blank(), key: 'k' };
    expect(Object.keys(entryFromDraft({ ...draft(), fields: { Bad: many.Bad, id: many.id } }).fields)).toEqual([]);
  });
  it('refuses prototype names as a field name and as a key', () => {
    const d = draft();
    const fields = Object.create(null) as Record<string, BindingDraft['fields'][string]>;
    fields.__proto__ = { ...blank(), key: 'k' };
    Reflect.set(fields, 'constructor', { ...blank(), key: 'k' });
    fields.running = { ...blank(), key: 'prototype' };
    fields.value = { ...blank(), key: 'ok' };
    const e = entryFromDraft({ ...d, fields });
    expect(Object.keys(e.fields)).toEqual(['value']);
    expect(({} as Record<string, unknown>).key).toBeUndefined();
  });
});

describe('isDirty / sameEntry', () => {
  it('is clean for the draft of the symbol itself, dirty after any change', () => {
    const base = entryFromSymbol(SYMBOL);
    const d = draftFromSymbol(SYMBOL);
    expect(isDirty(d, base)).toBe(false);
    expect(isDirty({ ...d, fields: { ...d.fields, running: { ...d.fields.running, script: '!value' } } }, base)).toBe(true);
    expect(isDirty({ ...d, fields: { ...d.fields, value: { ...d.fields.value, key: 'temp', deviceId: D1 } } }, base)).toBe(true);
  });
  it('does not count whitespace, a field with no key, or the device alone as a change', () => {
    const base = entryFromSymbol(SYMBOL);
    const d = draftFromSymbol(SYMBOL);
    expect(isDirty({ ...d, fields: { ...d.fields, running: { ...d.fields.running, script: ' value === 1 ' } } }, base)).toBe(false);
    expect(isDirty({ ...d, deviceId: 'other', deviceName: 'Other', fields: { ...d.fields, value: { ...d.fields.value, script: 'x' } } }, base)).toBe(false);
  });
  it('compares entries by content', () => {
    expect(sameEntry({ fields: { a: { key: 'k' } } }, { fields: { a: { key: 'k' } } })).toBe(true);
    expect(sameEntry({ fields: { a: { key: 'k' } } }, { fields: { b: { key: 'k' } } })).toBe(false);
    expect(sameEntry({ fields: { a: { key: 'k' } } }, { fields: {} })).toBe(false);
  });
});

describe('nextUnbound', () => {
  const list = [
    { id: 'a', bound: true },
    { id: 'b', bound: false },
    { id: 'c', bound: true },
    { id: 'd', bound: false },
  ];
  it('is the first unbound symbol after the current one', () => {
    expect(nextUnbound(list, 'a')).toBe('b');
    expect(nextUnbound(list, 'b')).toBe('d');
    expect(nextUnbound(list, 'c')).toBe('d');
  });
  it('wraps round to the start', () => {
    expect(nextUnbound(list, 'd')).toBe('b');
  });
  it('is null when every other symbol is bound, or there is none', () => {
    expect(nextUnbound([{ id: 'a', bound: false }, { id: 'b', bound: true }], 'a')).toBeNull();
    expect(nextUnbound([], 'a')).toBeNull();
    expect(nextUnbound([{ id: 'a', bound: true }], 'a')).toBeNull();
  });
  it('starts from the top when the current symbol is not in the list', () => {
    expect(nextUnbound(list, 'zzz')).toBe('b');
  });
});

describe('automatic fields (a source found by the drawing\'s own naming, no entry of its own)', () => {
  const auto = (k: string) => ({ deviceId: D2, deviceName: 'Tea', key: k, automatic: true as const });
  const KETTLE = {
    fields: [
      { name: 'running', label: 'Running', currentSource: auto('water_kettle.running') },
      { name: 'value', label: 'Reading', currentSource: auto('water_kettle.value') },
      { name: 'status', label: 'Status' },
    ],
  };
  it('pre-fills the draft with the automatic key and the device of the match, flagged', () => {
    const d = draftFromSymbol(KETTLE);
    expect(d.deviceId).toBe(D2);
    expect(d.fields.running).toMatchObject({ deviceId: D2, key: 'water_kettle.running', automatic: true });
    expect(d.fields.status.automatic).toBeUndefined();
  });
  it('an untouched automatic field is omitted from the entry, so a symbol with only automatic fields saves nothing', () => {
    expect(entryFromDraft(draftFromSymbol(KETTLE))).toEqual({ fields: {} });
    expect(entryFromSymbol(KETTLE)).toEqual({ fields: {} });
    expect(isDirty(draftFromSymbol(KETTLE), entryFromSymbol(KETTLE))).toBe(false);
  });
  it('a field the person picked, even the same key, is written (the flag is off)', () => {
    const d = draftFromSymbol(KETTLE);
    d.fields.running = { ...d.fields.running, automatic: false };
    expect(entryFromDraft(d)).toEqual({ fields: { running: { deviceId: D2, key: 'water_kettle.running' } } });
    expect(isDirty(d, entryFromSymbol(KETTLE))).toBe(true);
  });
  it('a one-liner typed on an automatic field makes it the person\'s: the key and the script are written', () => {
    const d = draftFromSymbol(KETTLE);
    d.fields.value = { ...d.fields.value, script: 'value / 10' };
    expect(entryFromDraft(d)).toEqual({ fields: { value: { deviceId: D2, key: 'water_kettle.value', script: 'value / 10' } } });
    expect(isDirty(d, entryFromSymbol(KETTLE))).toBe(true);
  });
  it('only the changed field is written next to untouched automatic ones', () => {
    const d = draftFromSymbol(KETTLE);
    d.fields.status = { ...blank(), deviceId: D2, deviceName: 'Tea', key: 'water_kettle.mode' };
    expect(entryFromDraft(d)).toEqual({ fields: { status: { deviceId: D2, key: 'water_kettle.mode' } } });
  });
  it('an automatic source counts as bound (it draws live data) but is not an entry of its own', () => {
    expect(isBound(KETTLE)).toBe(true);
    expect(hasOwnEntry(KETTLE)).toBe(false);
    expect(hasOwnEntry(SYMBOL)).toBe(true);
    expect(hasOwnEntry({ fields: [{ name: 'value', label: 'V' }] })).toBe(false);
  });
  it('an automatic source with an empty key is not pre-filled', () => {
    const d = draftFromSymbol({ fields: [{ name: 'value', label: 'V', currentSource: { deviceId: D2, deviceName: 'Tea', key: '', automatic: true } }] });
    expect(d.fields.value.automatic).toBeUndefined();
  });
});

// ─── Slice 16 (U1): the ranking, table-driven over realistic devices ─────────────────────────────────────────────────────────────

type Case = { what: string; field: { name: string; label?: string; kind?: 'state' | 'number' | 'text'; unit?: string }; keys: DeviceKey[]; element?: string; hints?: string[]; want: string | null; mismatch?: string };
const k = key;

describe('rankKeysForField: realistic devices (kitchen, HVAC, BMS, water, power)', () => {
  const cases: Case[] = [
    // the acceptance journey's device: arbitrary names, no convention at all
    { what: 'a thermometer reading finds temp_1 (the symbol\'s own words say what it measures)', field: { name: 'value', label: 'Reading' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4), k('door', 'closed')], hints: ['Thermometer'], want: 'temp_1' },
    { what: 'a reading with no words at all and two numbers is nobody\'s', field: { name: 'value', label: 'Reading' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4)], want: null },
    { what: 'running finds pump_on', field: { name: 'running', label: 'Running' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4), k('door', 'closed')], want: 'pump_on' },
    { what: 'a flow reading finds flow_lpm', field: { name: 'value', label: 'Flow' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4)], want: 'flow_lpm' },
    { what: 'a flow meter\'s reading finds flow_lpm by the symbol\'s kind', field: { name: 'value', label: 'Reading' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4)], hints: ['Flow meter'], want: 'flow_lpm' },
    { what: 'a door (open/closed) finds door', field: { name: 'running', label: 'Open' }, keys: [k('temp_1', 21.5), k('door', 'closed'), k('flow_lpm', 12.4)], want: 'door' },
    // the kitchen
    { what: 'the element convention wins outright', field: { name: 'value', label: 'Reading' }, keys: [k('tea_maker.value', 57), k('coffee.value', 3), k('power_strip.running', 1)], element: 'tea_maker', want: 'tea_maker.value' },
    { what: 'a fryer temperature with a unit', field: { name: 'value', label: 'Temperature', unit: '°C' }, keys: [k('oil_temp', 178, { unit: '°C' }), k('basket', 'down'), k('heater', 1)], want: 'oil_temp' },
    // HVAC
    { what: 'supply air temperature by label', field: { name: 'value', label: 'Supply temperature' }, keys: [k('sat', 14.5, { label: 'Supply air temperature' }), k('rat', 22, { label: 'Return air temperature' }), k('fan', 1)], want: 'sat' },
    { what: 'a fan speed in rpm', field: { name: 'speed', label: 'Speed' }, keys: [k('fan_rpm', 1200, { unit: 'rpm' }), k('fan_on', 1), k('sat', 14.5)], want: 'fan_rpm' },
    { what: 'a damper opening in percent', field: { name: 'position', label: 'Opening' }, keys: [k('dmp_pos', 45, { unit: '%' }), k('dmp_cmd', 1), k('sat', 14.5)], want: 'dmp_pos' },
    { what: 'a status word', field: { name: 'status', label: 'Status' }, keys: [k('ahu_state', 'cooling'), k('sat', 14.5), k('fan', 1)], want: 'ahu_state' },
    // building BMS
    { what: 'a room humidity', field: { name: 'value2', label: 'Humidity' }, keys: [k('rh', 41, { unit: '%' }), k('t', 21.2, { unit: '°C' }), k('occ', true)], want: 'rh' },
    { what: 'an occupancy state', field: { name: 'running', label: 'Occupied' }, keys: [k('rh', 41), k('t', 21.2), k('occupancy', 1)], want: 'occupancy' },
    { what: 'a meter energy, by the unit alone', field: { name: 'value', label: 'Energy', unit: 'kWh' }, keys: [k('e_total', 15230, { unit: 'kWh' }), k('p', 4.2, { unit: 'kW' }), k('u1', 230)], want: 'e_total' },
    { what: 'a pressure gauge\'s reading, by the symbol\'s kind and the unit', field: { name: 'value', label: 'Reading' }, keys: [k('p1', 3.2, { unit: 'bar' }), k('q', 12, { unit: 'l/min' })], hints: ['Pressure gauge'], want: 'p1' },
    // water
    { what: 'a tank level', field: { name: 'value', label: 'Level' }, keys: [k('lvl', 63, { unit: '%' }), k('pump1', 0), k('pump2', 1)], want: 'lvl' },
    { what: 'two pumps: ambiguous for running, none picked by itself', field: { name: 'running', label: 'Running' }, keys: [k('pump1', 0), k('pump2', 1), k('lvl', 63)], want: null },
    { what: 'a pressure with bar', field: { name: 'value', label: 'Pressure' }, keys: [k('p_out', 3.2, { unit: 'bar' }), k('q', 12, { unit: 'l/min' }), k('run', true)], want: 'p_out' },
    // power
    { what: 'a breaker state from a 0/1', field: { name: 'running', label: 'Closed' }, keys: [k('cb_state', 1), k('i_a', 12.3, { unit: 'A' }), k('u_a', 231, { unit: 'V' })], want: 'cb_state' },
    { what: 'a current reading', field: { name: 'value', label: 'Current', unit: 'A' }, keys: [k('i_a', 12.3, { unit: 'A' }), k('u_a', 231, { unit: 'V' }), k('cb_state', 1)], want: 'i_a' },
    { what: 'a voltage reading', field: { name: 'value', label: 'Voltage' }, keys: [k('i_a', 12.3, { unit: 'A' }), k('u_a', 231, { unit: 'V' }), k('cb_state', 1)], want: 'u_a' },
    // mismatches are never picked by themselves
    { what: 'text for a number is flagged, not picked', field: { name: 'value', label: 'Reading' }, keys: [k('reading', 'high'), k('rssi', -60)], want: null, mismatch: 'text-for-number' },
    { what: 'a number for a state is flagged, not picked', field: { name: 'running', label: 'Running' }, keys: [k('running', 37.5, { unit: '°C' }), k('x', 'a')], want: null, mismatch: 'number-for-state' },
    { what: 'the only key is taken whatever the field', field: { name: 'anything' }, keys: [k('only', 'x')], want: 'only' },
    { what: 'nothing for no keys', field: { name: 'value' }, keys: [], want: null },
    { what: 'a connection id the host marked internal is never offered', field: { name: 'running' }, keys: [k('c1.running', 1, { internal: true }), k('lvl', 63)], want: null },
  ];
  for (const c of cases) {
    it(c.what, () => {
      const ranked = rankKeysForField(c.field, c.keys, c.element, [], c.hints ?? []);
      expect(suggestKeyForField(c.field, c.keys, c.element, c.hints ?? [])).toBe(c.want);
      if (c.mismatch) expect(ranked[0]?.mismatch).toBe(c.mismatch);
      for (const r of ranked) expect(c.keys.find((x) => x.key === r.key)?.internal).not.toBe(true);
    });
  }

  it('orders best first with reasons, a confident best needs the score and a lead, a tie is nobody', () => {
    const tie = rankKeysForField({ name: 'value', label: 'Temperature', unit: '°C' }, [k('hum', 40, { unit: '%' }), k('temp_c', 21, { unit: '°C' }), k('t2', 19, { label: 'Temperature 2', unit: '°C' })]);
    expect(tie.map((r) => r.key)).toEqual(['temp_c', 't2']); // the same score: the host's order; hum (another quantity, no word) is no candidate
    expect(tie[0].reasons).toEqual(expect.arrayContaining(['synonym', 'type', 'unit']));
    expect(tie[0].confident).toBe(false);
    const named = rankKeysForField({ name: 'value', label: 'Temperature', unit: '°C' }, [k('temp_c', 21, { unit: '°C' }), k('t2', 19, { label: 'Temperature', unit: '°C' })]);
    expect(named[0]).toMatchObject({ key: 't2', confident: true });
    expect(named[0].reasons).toContain('name');
    const sure = rankKeysForField({ name: 'value', label: 'Temperature' }, [k('temp_c', 21), k('hum', 40)]);
    expect(sure[0]).toMatchObject({ key: 'temp_c', confident: true });
    expect(sure[0].score).toBeGreaterThanOrEqual(CONFIDENT_SCORE);
    expect(sure.map((r) => r.key)).toEqual(['temp_c']); // hum says humidity, another quantity than a temperature: no candidate at all
  });

  it('a unit of another quantity counts against a key; a field with no unit and no quantity word ignores units', () => {
    const wrong = rankKeysForField({ name: 'value', label: 'Temperature' }, [k('t', 3.2, { unit: 'bar' })]);
    expect(wrong[0].reasons).toContain('unit');
    expect(wrong[0].score).toBeLessThan(rankKeysForField({ name: 'value', label: 'Temperature' }, [k('t', 3.2)])[0].score);
    expect(unitQuantity('°C')).toBe('temperature');
    expect(unitQuantity('l/min')).toBe('flow');
    expect(unitQuantity('')).toBeNull();
    expect(unitQuantity('furlongs')).toBeNull();
  });

  it('knows kinds: a field by its name or its kind, a key by its live value and unit', () => {
    expect(fieldKindOf({ name: 'running' })).toBe('state');
    expect(fieldKindOf({ name: 'status' })).toBe('text');
    expect(fieldKindOf({ name: 'value2' })).toBe('number');
    expect(fieldKindOf({ name: 'doorOpen' })).toBeNull();
    expect(fieldKindOf({ name: 'doorOpen', kind: 'state' })).toBe('state');
    expect(keyKindOf({ value: true })).toBe('state');
    expect(keyKindOf({ value: 1 })).toBe('state');
    expect(keyKindOf({ value: 1, unit: 'm' })).toBe('number');
    expect(keyKindOf({ value: 21.5 })).toBe('number');
    expect(keyKindOf({ value: 'on' })).toBe('state');
    expect(keyKindOf({ value: 'heating' })).toBe('text');
    expect(keyKindOf({ value: null })).toBeNull();
    expect(mismatchOf({ name: 'status' }, { value: 5 })).toBe('number-for-text');
    expect(mismatchOf({ name: 'status' }, { value: 'ok' })).toBeNull();
    expect(mismatchOf({ name: 'status' }, { value: true })).toBeNull();
    // a tee's Status is never ticked onto a temperature because of a shared word
    expect(rankKeysForField({ name: 'status', label: 'Status' }, [k('supply_temp', 60.2), k('x', 'a')], undefined, [], ['Supply tee', 'Pipe (tee)'])[0]).toMatchObject({ key: 'supply_temp', confident: false, mismatch: 'number-for-text' });
    expect(mismatchOf({ name: 'value' }, { value: true })).toBe('state-for-number');
    expect(mismatchOf({ name: 'running' }, { value: 'high' })).toBe('text-for-state');
  });

  it('pickableKeys leaves out the internal ones', () => {
    expect(pickableKeys([k('a', 1), k('c1.running', 1, { internal: true })]).map((x) => x.key)).toEqual(['a']);
  });
});

// ─── Slice 16 (U2b): expressions over named inputs ───────────────────────────────────────────────────────────────────────────────

describe('defaultInputName', () => {
  it('makes a readable name from a label or key, never a reserved word, never one taken', () => {
    expect(defaultInputName('Supply temperature')).toBe('supply_temperatu');
    expect(defaultInputName('return_temp')).toBe('return_temp');
    expect(defaultInputName('Return')).toBe('return_in');
    expect(defaultInputName('value')).toBe('value_in');
    expect(defaultInputName('oven.door_open')).toBe('door_open');
    expect(defaultInputName('42 things')).toBe('v_42_things');
    expect(defaultInputName('???')).toBe('input');
    expect(defaultInputName('temp', ['temp'])).toBe('temp_2');
    expect(defaultInputName('temp', ['temp', 'temp_2'])).toBe('temp_3');
    expect(defaultInputName('supply_temperature_x', ['supply_temperatu'])).toBe('supply_tempera_2');
    expect(expressionNames([{ name: 'a' }, { name: 'b' }])).toEqual(['value', 'row', 'now', 'a', 'b']);
  });
});

describe('templateFor', () => {
  it('writes a template over value when the row has a value, else over the first input', () => {
    const t = scriptTemplates()[0];
    expect(templateFor(t, [], true)).toBe('!value');
    expect(templateFor(t, [{ name: 'supply' }], true)).toBe('!value');
    expect(templateFor(t, [{ name: 'supply' }], false)).toBe('!supply');
    expect(templateFor(t, [], false)).toBe('!value');
  });
});

describe('entryFromDraft with expressions', () => {
  const input = (name: string, key: string, deviceId = '') => ({ name, deviceId, deviceName: '', key, label: '' });

  it('writes the expression and its inputs beside a key, the inputs on the draft device without a device of their own', () => {
    const d = draft();
    d.fields.value = { ...blank(), key: 'supply_temp', mode: 'expression', script: ' value - ret ', inputs: [input('ret', 'return_temp'), input('other', 'x', D2)] };
    expect(entryFromDraft(d).fields.value).toEqual({ deviceId: D1, key: 'supply_temp', script: 'value - ret', inputs: { ret: { key: 'return_temp' }, other: { key: 'x', deviceId: D2 } } });
  });

  it('writes an expression over inputs alone (no key), and drops a field with an expression and nothing to read', () => {
    const d = draft();
    d.fields.value = { ...blank(), mode: 'expression', script: 'supply - ret', inputs: [input('supply', 'supply_temp'), input('ret', 'return_temp')] };
    d.fields.running = { ...blank(), mode: 'expression', script: 'value > 1', inputs: [] };
    expect(entryFromDraft(d)).toEqual({ fields: { value: { deviceId: D1, script: 'supply - ret', inputs: { supply: { key: 'supply_temp' }, ret: { key: 'return_temp' } } } } });
  });

  it('drops inputs without a script, a bad input name, a duplicate name, a bad key, a bad device, and keeps at most four', () => {
    const d = draft();
    d.fields.value = { ...blank(), key: 'k', mode: 'expression', script: '', inputs: [input('a', 'x')] };
    expect(entryFromDraft(d).fields.value).toEqual({ deviceId: D1, key: 'k' });
    d.fields.value = { ...blank(), key: 'k', mode: 'expression', script: 'value', inputs: [input('return', 'x'), input('Bad', 'x'), input('a', 'has space'), input('b', 'y', 'nope'), input('c', 'z'), input('c', 'w')] };
    expect(entryFromDraft(d).fields.value).toEqual({ deviceId: D1, key: 'k', script: 'value', inputs: { c: { key: 'z' } } });
    d.fields.value = { ...blank(), key: 'k', mode: 'expression', script: 'value', inputs: [input('a', 'a'), input('b', 'b'), input('c', 'c'), input('d', 'd'), input('e', 'e')] };
    expect(Object.keys(entryFromDraft(d).fields.value.inputs!)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('an automatic field with an expression is the person\'s; inputs count in sameEntry', () => {
    const auto = { deviceId: D2, deviceName: 'Tea', key: 'kettle.value', automatic: true as const };
    const d = draftFromSymbol({ fields: [{ name: 'value', label: 'Reading', currentSource: auto }] });
    expect(d.fields.value.mode).toBe('value');
    d.fields.value = { ...d.fields.value, mode: 'expression', script: 'value + ret', inputs: [input('ret', 'kettle.ret', D2)] };
    expect(entryFromDraft(d).fields.value).toEqual({ deviceId: D2, key: 'kettle.value', script: 'value + ret', inputs: { ret: { key: 'kettle.ret' } } });
    expect(sameEntry({ fields: { a: { key: 'k', script: 's', inputs: { x: { key: 'y' } } } } }, { fields: { a: { key: 'k', script: 's', inputs: { x: { key: 'y' } } } } })).toBe(true);
    expect(sameEntry({ fields: { a: { key: 'k', script: 's', inputs: { x: { key: 'y' } } } } }, { fields: { a: { key: 'k', script: 's', inputs: { x: { key: 'z' } } } } })).toBe(false);
    expect(sameEntry({ fields: { a: { key: 'k', script: 's' } } }, { fields: { a: { key: 'k' } } })).toBe(false);
  });

  it('the draft of a symbol with an expression starts in expression mode with its inputs, and knows it is bound', () => {
    const sym = { fields: [{ name: 'value', label: 'Delta', currentSource: { deviceId: D1, deviceName: 'B', key: '', inputs: [{ name: 'supply', deviceId: D1, deviceName: 'B', key: 's' }, { name: 'ret', deviceId: D1, deviceName: 'B', key: 'r' }] }, currentScript: 'supply - ret' }] };
    const d = draftFromSymbol(sym);
    expect(d.fields.value).toMatchObject({ mode: 'expression', key: '', script: 'supply - ret' });
    expect(d.fields.value.inputs.map((i) => i.name)).toEqual(['supply', 'ret']);
    expect(entryFromSymbol(sym)).toEqual({ fields: { value: { deviceId: D1, script: 'supply - ret', inputs: { supply: { key: 's' }, ret: { key: 'r' } } } } });
    expect(isBound(sym)).toBe(true);
    expect(hasOwnEntry(sym)).toBe(true);
    expect(isDirty(d, entryFromSymbol(sym))).toBe(false);
  });
});

describe('a shared word of the symbol\'s own is a reason of its own; a quantity contradiction is a mismatch (slice 16)', () => {
  it('names the symbol reason and bars confidence on a quantity mismatch', () => {
    const [top] = rankKeysForField({ name: 'running', label: 'Running' }, [k('pump_on', true), k('t', 20)], undefined, [], ['Circulation pump', 'Pump']);
    expect(top).toMatchObject({ key: 'pump_on', confident: true });
    expect(top.reasons).toContain('symbol');
    const plain = rankKeysForField({ name: 'running', label: 'Running' }, [k('pump_on', true), k('t', 20)], undefined, [], ['Strainer', 'Strainer']);
    expect(plain[0].reasons).not.toContain('symbol');
    const [opening] = rankKeysForField({ name: 'position', label: 'Opening' }, [k('supply_temp', 60.2), k('x', 'a')], undefined, [], ['Supply valve', 'Actuated valve']);
    expect(opening).toMatchObject({ key: 'supply_temp', confident: false, mismatch: 'quantity' });
    expect(suggestKeyForField({ name: 'position', label: 'Opening' }, [k('supply_temp', 60.2)], undefined, ['Supply valve'])).toBeNull();
  });
});

describe('a key\'s own words say what it measures (slice 16)', () => {
  it('a temperature by its name is never the one number a speed reads; a reading with no quantity of its own takes the one number', () => {
    expect(suggestKeyForField({ name: 'speed', label: 'Speed' }, [k('temp_1', 21.5), k('pump_on', true)])).toBeNull();
    expect(suggestKeyForField({ name: 'value', label: 'Reading' }, [k('temp_1', 21.5), k('pump_on', true)])).toBe('temp_1');
    expect(suggestKeyForField({ name: 'value', label: 'Humidity' }, [k('t', 21.5), k('rh', 40)])).toBe('rh');
    expect(suggestKeyForField({ name: 'value', label: 'Humidity' }, [k('t', 21.5), k('x', 40)])).toBeNull();
  });
});
