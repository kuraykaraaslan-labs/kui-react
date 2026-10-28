import { describe, it, expect } from 'vitest';
import {
  ageText, draftFromSymbol, entryFromDraft, entryFromSymbol, formatSample, formatValue, hasOwnEntry, isBooleanish, isBound, isDirty, nextUnbound,
  previewLine, sameEntry, scriptErrorKind, scriptTemplates, suggestKeyForField, suggestKeysForFields,
  MAX_SCRIPT_LENGTH,
  type BindingDraft, type DeviceKey, type SymbolSpec,
} from '../views/symbol-binding-logic';

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
  it('matches the field name or label against the key name or the key label', () => {
    expect(suggestKeyForField({ name: 'value', label: 'Temperature' }, [key('t1', 21, { label: 'Temperature' }), key('h1', 40, { label: 'Humidity' })])).toBe('t1');
    expect(suggestKeyForField({ name: 'value', label: 'Temperature' }, [key('temp_c', 21), key('hum', 40)])).toBeNull(); // "temp" is not "temperature"
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
  it('takes the only key there is, for any field', () => {
    expect(suggestKeyForField({ name: 'position' }, [key('opening', 'x')])).toBe('opening');
    expect(suggestKeyForField({ name: 'anything' }, [key('only', 'x')])).toBe('only');
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
  fields: { running: { deviceId: '', deviceName: '', key: '', label: '', script: '' }, value: { deviceId: '', deviceName: '', key: '', label: '', script: '' } },
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
    d.fields.value = { deviceId: D2, deviceName: 'Roof', key: 'temp', label: '', script: '' };
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
    expect(entryFromDraft(d).fields.value.key.length).toBe(64);
  });
  it('writes only what the map v2 grammars accept: telemetry keys, symbol fields, UUID devices, at most 16 fields', () => {
    const d = draft();
    d.fields.running = { ...d.fields.running, key: 'has space' };
    d.fields.value = { ...d.fields.value, key: 'ok', deviceId: 'not-a-uuid' };
    expect(entryFromDraft(d).fields).toEqual({});
    const many: BindingDraft['fields'] = {};
    for (let i = 0; i < 20; i += 1) many[`f${i}`] = { deviceId: '', deviceName: '', key: `k${i}`, label: '', script: '' };
    expect(Object.keys(entryFromDraft({ ...draft(), fields: many }).fields)).toHaveLength(16);
    many.Bad = { deviceId: '', deviceName: '', key: 'k', label: '', script: '' };
    many['id'] = { deviceId: '', deviceName: '', key: 'k', label: '', script: '' };
    expect(Object.keys(entryFromDraft({ ...draft(), fields: { Bad: many.Bad, id: many.id } }).fields)).toEqual([]);
  });
  it('refuses prototype names as a field name and as a key', () => {
    const d = draft();
    const fields = Object.create(null) as Record<string, BindingDraft['fields'][string]>;
    fields.__proto__ = { deviceId: '', deviceName: '', key: 'k', label: '', script: '' };
    Reflect.set(fields, 'constructor', { deviceId: '', deviceName: '', key: 'k', label: '', script: '' });
    fields.running = { deviceId: '', deviceName: '', key: 'prototype', label: '', script: '' };
    fields.value = { deviceId: '', deviceName: '', key: 'ok', label: '', script: '' };
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
    d.fields.status = { deviceId: D2, deviceName: 'Tea', key: 'water_kettle.mode', label: '', script: '' };
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
