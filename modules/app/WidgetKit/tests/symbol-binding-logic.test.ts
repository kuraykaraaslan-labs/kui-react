import { describe, it, expect } from 'vitest';
import {
  ageText, defaultInputName, draftFromSymbol, entryFromDraft, entryFromSymbol, expressionNames, fieldKindOf, formatSample, formatValue, hasOwnEntry, isBooleanish, isBound, isDirty,
  keyKindOf, keyNamesSymbol, mismatchOf, nextUnbound, pickableKeys, previewLine, rankKeysForField, sameEntry, scriptErrorKind, scriptTemplates, suggestKeyForField, suggestKeysForFields,
  templateFor, unitQuantity, applyTemplate, wordsOf, isSetpointWords, scaleScript, rawRangeOf, declaredRange,
  CONFIDENT_SCORE, KIND_ALONE_SCORE, MAX_SCRIPT_LENGTH, MIN_PROPOSAL_SCORE, staleKeys, codesOf, matchAllRows, chipLabelOf,
  type BindingDraft, type DeviceKey, type FieldDraft, type MatchSymbol, type SymbolSpec,
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
  it('falls back to the type as a proposal, never a certainty: a word decides (pump_state, health), the one measure is offered for value but not taken', () => {
    expect(suggestKeyForField({ name: 'running' }, [key('pump_state', 1), key('flow_rate', 12.4)])).toBe('pump_state');
    expect(suggestKeyForField({ name: 'status' }, [key('flow_rate', 12.4), key('health', 'degraded')])).toBe('health');
    // no word of "value" is in flow_rate: the only number is "Suggested: flow_rate [Use]", one tap, never written by itself
    expect(suggestKeyForField({ name: 'value' }, [key('pump_state', 1), key('flow_rate', 12.4)])).toBeNull();
    const [top] = rankKeysForField({ name: 'value' }, [key('pump_state', 1), key('flow_rate', 12.4)]);
    expect(top).toMatchObject({ key: 'flow_rate', confident: false, reasons: ['type'], score: KIND_ALONE_SCORE });
    expect(top.score).toBeGreaterThanOrEqual(MIN_PROPOSAL_SCORE);
    expect(top.score).toBeLessThan(CONFIDENT_SCORE);
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
    // "level" is a word of "value": certain for the first reading, and taken, so the second reading gets nothing
    const keys = [key('level', 12.4), key('pump.running', true)];
    const out = suggestKeysForFields([{ name: 'running' }, { name: 'value' }, { name: 'value2' }], keys, 'pump');
    expect(out).toEqual({ running: 'pump.running', value: 'level' });
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
    expect(formatValue(true)).toBe('On');
    expect(formatValue(false)).toBe('Off');
    expect(formatValue(true, undefined, { on: 'Açık', off: 'Kapalı' })).toBe('Açık');
    expect(formatValue('on')).toBe('on');
    expect(formatValue(null)).toBe('–');
    expect(formatValue(Number.NaN)).toBe('–');
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
    expect(formatValue('x'.repeat(60)).length).toBe(40);
  });
  it('quotes text in a preview so "on" and on are told apart', () => {
    expect(formatSample('on')).toBe('"on"');
    expect(formatSample(1)).toBe('1');
    expect(formatSample(false)).toBe('Off');
    expect(formatSample(undefined)).toBe('nothing');
  });
});

describe('scriptTemplates and previews', () => {
  it('offers the five quick fills, each a one-liner on value', () => {
    const t = scriptTemplates();
    expect(t.map((x) => x.id)).toEqual(['invert', 'scale', 'round', 'threshold', 'words']);
    expect(t.find((x) => x.id === 'invert')?.script).toBe('!value');
    expect(t.find((x) => x.id === 'scale')?.script).toBe('value / 100 * 100');
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
    expect(previewLine('!value', 1, { ok: true, result: false })).toEqual({ kind: 'ok', from: '1', to: 'Off' });
    expect(previewLine('value === "on"', 'on', { ok: true, result: true })).toEqual({ kind: 'ok', from: '"on"', to: 'On' });
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

/** `want`: the key picked by itself (null: none); `offered`: the key the ranking puts first as "Suggested: … [Use]" when nothing is certain. */
type Case = { what: string; field: { name: string; label?: string; kind?: 'state' | 'number' | 'text'; unit?: string }; keys: DeviceKey[]; element?: string; hints?: string[]; want: string | null; offered?: string; mismatch?: string };
const k = key;

describe('rankKeysForField: realistic devices (kitchen, HVAC, BMS, water, power)', () => {
  const cases: Case[] = [
    // the acceptance journey's device: arbitrary names, no convention at all
    { what: 'a thermometer reading finds temp_1 (the symbol\'s own words say what it measures)', field: { name: 'value', label: 'Reading' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4), k('door', 'closed')], hints: ['Thermometer'], want: 'temp_1' },
    { what: 'a reading with no words at all and two numbers is nobody\'s', field: { name: 'value', label: 'Reading' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4)], want: null },
    { what: 'running finds pump_on', field: { name: 'running', label: 'Running' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4), k('door', 'closed')], want: 'pump_on' },
    { what: 'a flow reading finds flow_lpm', field: { name: 'value', label: 'Flow' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4)], want: 'flow_lpm' },
    { what: 'a flow meter\'s reading finds flow_lpm by the symbol\'s kind', field: { name: 'value', label: 'Reading' }, keys: [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4)], hints: ['Flow meter'], want: 'flow_lpm' },
    { what: 'a door symbol (open/closed) finds door by its own word', field: { name: 'running', label: 'Open' }, keys: [k('temp_1', 21.5), k('door', 'closed'), k('flow_lpm', 12.4)], hints: ['Door'], want: 'door' },
    // the device's one state fits any Running by its kind: offered with one tap, never written by itself (a tee is not a door)
    { what: 'a tee\'s Running is offered the one state, not given it', field: { name: 'running', label: 'Running' }, keys: [k('door', false), k('temp_1', 21.5), k('flow_lpm', 12.4), k('level_pct', 63)], element: 'tee1', hints: ['Supply tee', 'Pipe (tee)'], want: null, offered: 'door' },
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
    // "occupancy" shares no whole word with "Occupied": the one state is offered, one tap away, not taken
    { what: 'an occupancy state is offered as the one state, not taken', field: { name: 'running', label: 'Occupied' }, keys: [k('rh', 41), k('t', 21.2), k('occupancy', 1)], want: null, offered: 'occupancy' },
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
    // next-boilerplate e2e round 3, M-R3-03: a heat pump is not a mud pump, though both are pumps: offered (below), never certain
    { what: 'another piece of equipment that shares the kind word only (heat pump for a mud pump) is foreign: not taken', field: { name: 'running', label: 'Running' }, keys: [k('heat_pump.running', true), k('drain.running', false), k('temp_1', 21.5)], element: 'pump_mud', hints: ['Mud pump', 'Pump'], want: null },
    { what: 'the same words in another order are the same equipment (circulation pump, pump_circulation)', field: { name: 'running', label: 'Running' }, keys: [k('pump_circulation.running', true), k('drain.running', false), k('temp_1', 21.5)], element: 'p1', hints: ['Circulation pump', 'Pump'], want: 'pump_circulation.running' },
    { what: 'a synonym is no distinguishing word (supply temperature, supply_temp)', field: { name: 'value', label: 'Reading' }, keys: [k('supply_temp.value', 41, { unit: '°C' }), k('return_temp.value', 35, { unit: '°C' })], element: 't1', hints: ['Supply temperature', 'Thermometer'], want: 'supply_temp.value' },
  ];
  for (const c of cases) {
    it(c.what, () => {
      const ranked = rankKeysForField(c.field, c.keys, c.element, [], c.hints ?? []);
      expect(suggestKeyForField(c.field, c.keys, c.element, c.hints ?? [])).toBe(c.want);
      if (c.mismatch) expect(ranked[0]?.mismatch).toBe(c.mismatch);
      if (c.offered) {
        expect(ranked[0]).toMatchObject({ key: c.offered, confident: false });
        expect(ranked[0].score).toBeGreaterThanOrEqual(MIN_PROPOSAL_SCORE);
        expect(ranked[0].score).toBeLessThan(CONFIDENT_SCORE);
      }
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

  it('a heat pump\'s key for a mud pump (M-R3-03): first in the list, marked foreign, never confident, even with a label that says pump', () => {
    const ranked = rankKeysForField({ name: 'running', label: 'Running' }, [k('heat_pump.running', true, { label: 'Heat pump · running' }), k('drain.running', false), k('temp_1', 21.5)], 'pump_mud', [], ['Mud pump', 'Pump']);
    expect(ranked[0]).toMatchObject({ key: 'heat_pump.running', foreign: true, confident: false });
    expect(ranked[0].score).toBeGreaterThanOrEqual(MIN_PROPOSAL_SCORE);
    // an unlabelled pump symbol (named by its kind alone) may well be the heat pump: not foreign
    const plain = rankKeysForField({ name: 'running', label: 'Running' }, [k('heat_pump.running', true), k('temp_1', 21.5)], 'p1', [], ['Pump', 'Pump']);
    expect(plain[0]).toMatchObject({ key: 'heat_pump.running', confident: true });
    expect(plain[0].foreign).toBeUndefined();
  });

  it('a key whose last value is hours behind the device\'s newest is stale: ranked after the live ones and never picked by itself (M-R3-06)', () => {
    const now = Date.now();
    const old = rankKeysForField({ name: 'value', label: 'Reading' }, [
      { key: 'flow_lpm', value: 12.4, ts: now - 12 * 3600_000 },
      { key: 'meter_flow.value', label: 'Flow meter · value', value: 186.6, ts: now - 5000 },
      { key: 'pump_on', value: true, ts: now - 5000 },
    ], 'meter_flow', [], ['Flow meter', 'Flow meter']);
    expect(old[0]).toMatchObject({ key: 'meter_flow.value', confident: true });
    const stale = old.find((r) => r.key === 'flow_lpm')!;
    expect(stale.reasons).toContain('stale');
    expect(stale.confident).toBe(false);
    // the stale key alone, with a live rival that says nothing: still offered, never taken
    const alone = rankKeysForField({ name: 'value', label: 'Flow' }, [{ key: 'flow_lpm', value: 12.4, ts: now - 12 * 3600_000 }, { key: 'door', value: true, ts: now }]);
    expect(alone[0]).toMatchObject({ key: 'flow_lpm', confident: false });
    // a declared key with no value yet has no time to be old, and a device whose keys are all old has nothing newer to be behind
    expect(staleKeys([{ key: 'a', ts: '' }, { key: 'b', ts: now }])).toEqual(new Set());
    expect(staleKeys([{ key: 'a', ts: now - 48 * 3600_000 }, { key: 'b', ts: now - 47 * 3600_000 }])).toEqual(new Set());
    expect(staleKeys([{ key: 'a', ts: now - 48 * 3600_000 }, { key: 'b', ts: now }])).toEqual(new Set(['a']));
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

describe('chipLabelOf (phase 53.3.1, re-run 4 #12)', () => {
  it('the profile\'s label of the value, when it says more than the expression\'s name and the key', () => {
    expect(chipLabelOf('prim_return_t', 'prim_return_t', 'Primary return temperature')).toBe('Primary return temperature');
    expect(chipLabelOf('value', 'checked', '  Kontrol edilen şişe ')).toBe('Kontrol edilen şişe');
  });
  it('nothing for no label, or one that only repeats the name or the key in other words', () => {
    expect(chipLabelOf('flow_rate', 'flow_rate', undefined)).toBe('');
    expect(chipLabelOf('flow_rate', 'flow_rate', '  ')).toBe('');
    expect(chipLabelOf('flow_rate', 'flow_rate', 'Flow rate')).toBe('');
    expect(chipLabelOf('return_in', 'return', 'Return')).toBe('');
    expect(chipLabelOf('door_open', 'oven.door_open', 'Oven door open')).toBe('');
  });
});

describe('defaultInputName', () => {
  it('makes a readable name from a label or key, never a reserved word, never one taken', () => {
    // a text too long for 16 characters loses its LEADING words, never its tail mid-word (E2E-2.12)
    expect(defaultInputName('Supply temperature')).toBe('temperature');
    expect(defaultInputName('supply_temp')).toBe('supply_temp');
    expect(defaultInputName('return_temp')).toBe('return_temp');
    expect(defaultInputName('Return')).toBe('return_in');
    expect(defaultInputName('value')).toBe('value_in');
    expect(defaultInputName('oven.door_open')).toBe('door_open');
    expect(defaultInputName('42 things')).toBe('v_42_things');
    expect(defaultInputName('???')).toBe('input');
    expect(defaultInputName('temp', ['temp'])).toBe('temp_2');
    expect(defaultInputName('temp', ['temp', 'temp_2'])).toBe('temp_3');
    expect(defaultInputName('supply_temperature_x')).toBe('temperature_x');
    expect(defaultInputName('supply_temperature_x', ['temperature_x'])).toBe('temperature_x_2');
    expect(expressionNames([{ name: 'a' }, { name: 'b' }])).toEqual(['value', 'row', 'now', 'a', 'b']);
  });
});

describe('applyTemplate: a chip wraps or extends what was typed, never overwrites it (next-boilerplate e2e Slice 21, AD-15)', () => {
  const tpl = (id: string) => scriptTemplates().find((t) => t.id === id)!;
  it('over an empty box writes the template, over the first input when there is no picked value', () => {
    expect(applyTemplate(tpl('round'), '', [], true)).toBe('Math.round(value * 10) / 10');
    expect(applyTemplate(tpl('invert'), '  ', [{ name: 'supply' }], false)).toBe('!supply');
  });
  it('Round over a typed expression keeps it inside', () => {
    expect(applyTemplate(tpl('round'), 'value / 250 * 100', [], true)).toBe('Math.round((value / 250 * 100) * 10) / 10');
  });
  it('every chip applies itself to the typed text; one plain name needs no brackets', () => {
    expect(applyTemplate(tpl('invert'), 'a > b', [], true)).toBe('!(a > b)');
    expect(applyTemplate(tpl('scale'), 'raw', [], true)).toBe('raw / 100 * 100');
    expect(applyTemplate(tpl('threshold'), 'value / 2', [], true)).toBe('(value / 2) > 80');
    expect(applyTemplate(tpl('words'), 'value', [], true)).toBe('value === "on"');
  });
  it('a result over the length cap changes nothing (null)', () => {
    expect(applyTemplate(tpl('round'), 'v'.repeat(190), [], true)).toBeNull();
  });
});

describe('rankKeysForField: the symbol\'s equipment by its name (next-boilerplate e2e Slice 21, AD-02)', () => {
  // the pool plant device: its elements named by the profile ("<equipment> · <field>"), a heat pump beside the circulation pump
  const keys: DeviceKey[] = [
    { key: 'pump_circulation.running', label: 'Circulation pump · running', value: true, ts: 1 },
    { key: 'pump_circulation.value', label: 'Circulation pump · value', value: 41, ts: 1 },
    { key: 'heat_pump.running', label: 'Heat pump · running', value: false, ts: 1 },
    { key: 'meter_flow.value', label: 'Flow meter · value', value: 12.4, unit: 'l/min', ts: 1 },
  ];
  it('a symbol labelled exactly as a piece of equipment reads that equipment\'s key of the field, certain', () => {
    const [top] = rankKeysForField({ name: 'running', label: 'Running' }, keys, 'pump', [], ['Circulation pump', 'Pump']);
    expect(top).toMatchObject({ key: 'pump_circulation.running', confident: true });
    expect(top.reasons).toContain('label');
    expect(suggestKeyForField({ name: 'value', label: 'Flow' }, keys, 'meter', ['Flow meter', 'Flow meter'])).toBe('meter_flow.value');
  });
  it('the name decides by the id\'s words when the keys carry no label', () => {
    const bare = keys.map(({ label: _l, ...k }) => k);
    expect(suggestKeyForField({ name: 'running', label: 'Running' }, bare, 'pump', ['Circulation pump', 'Pump'])).toBe('pump_circulation.running');
  });
  it('keyNamesSymbol: the equipment name or the prefix\'s words, never a shared word alone', () => {
    expect(keyNamesSymbol(keys[0], 'circulation pump')).toBe(true);
    expect(keyNamesSymbol(keys[2], 'Circulation pump')).toBe(false);
    expect(keyNamesSymbol({ key: 'temperature', label: 'Temperature' }, 'Temperature')).toBe(false);
    expect(keyNamesSymbol(keys[0], '')).toBe(false);
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
    // "pump" is the circulation pump's KIND word: a reason, but one every pump has (e2e round 5, E3); "circulation" is its own
    const [top] = rankKeysForField({ name: 'running', label: 'Running' }, [k('pump_on', true), k('t', 20)], undefined, [], ['Circulation pump', 'Pump']);
    expect(top).toMatchObject({ key: 'pump_on', confident: true });
    expect(top.reasons).toContain('kind');
    expect(top.reasons).not.toContain('symbol');
    const [own] = rankKeysForField({ name: 'running', label: 'Running' }, [k('circulation_on', true), k('t', 20)], undefined, [], ['Circulation pump', 'Pump']);
    expect(own.reasons).toContain('symbol');
    const plain = rankKeysForField({ name: 'running', label: 'Running' }, [k('pump_on', true), k('t', 20)], undefined, [], ['Strainer', 'Strainer']);
    expect(plain[0].reasons).not.toContain('symbol');
    const [opening] = rankKeysForField({ name: 'position', label: 'Opening' }, [k('supply_temp', 60.2), k('x', 'a')], undefined, [], ['Supply valve', 'Actuated valve']);
    expect(opening).toMatchObject({ key: 'supply_temp', confident: false, mismatch: 'quantity' });
    expect(suggestKeyForField({ name: 'position', label: 'Opening' }, [k('supply_temp', 60.2)], undefined, ['Supply valve'])).toBeNull();
  });
});

describe('a key\'s own words say what it measures (slice 16)', () => {
  it('a temperature by its name is never the one number a speed reads; a reading with no quantity of its own is offered the one number, not given it', () => {
    expect(suggestKeyForField({ name: 'speed', label: 'Speed' }, [k('temp_1', 21.5), k('pump_on', true)])).toBeNull();
    expect(suggestKeyForField({ name: 'value', label: 'Reading' }, [k('temp_1', 21.5), k('pump_on', true)])).toBeNull();
    expect(rankKeysForField({ name: 'value', label: 'Reading' }, [k('temp_1', 21.5), k('pump_on', true)])[0]).toMatchObject({ key: 'temp_1', confident: false });
    // the symbol's own word makes it certain: a thermometer's reading is the temperature
    expect(suggestKeyForField({ name: 'value', label: 'Reading' }, [k('temp_1', 21.5), k('pump_on', true)], undefined, ['Thermometer'])).toBe('temp_1');
    expect(suggestKeyForField({ name: 'value', label: 'Humidity' }, [k('t', 21.5), k('rh', 40)])).toBe('rh');
    expect(suggestKeyForField({ name: 'value', label: 'Humidity' }, [k('t', 21.5), k('x', 40)])).toBeNull();
  });
});

describe('rankKeysForField: another piece of equipment of the same device (e2e round 2, E2E-2.11)', () => {
  const pool: DeviceKey[] = [
    key('pool.value', 84.2, { label: 'Pool · level' }), key('drain_valve.running', true, { label: 'Drain valve · running' }),
    key('circulation_pump.status', 'ok', { label: 'Circulation pump · status' }), key('circulation_pump.running', true),
    key('meter_flow.running', false, { label: 'Flow meter · running' }), key('temp', 33.9),
  ];
  it('a basin\'s Running is not the drain valve\'s by itself: the key under another prefix is offered, never confident', () => {
    const ranked = rankKeysForField({ name: 'running', label: 'Running' }, pool, 'tank1', [], ['Open basin', 'Open basin']);
    const top = ranked[0];
    expect(top.key.endsWith('.running')).toBe(true);
    expect(top.foreign).toBe(true);
    expect(top.confident).toBe(false);
    expect(suggestKeyForField({ name: 'running', label: 'Running' }, pool, 'tank1', ['Open basin', 'Open basin'])).toBeNull();
  });
  it('a flow meter\'s Status is not the circulation pump\'s; its own Running (the meter_flow prefix shares its words) is confident', () => {
    const status = rankKeysForField({ name: 'status', label: 'Status' }, pool, 'meter1', [], ['Flow meter', 'Flow meter']);
    expect(status.find((r) => r.key === 'circulation_pump.status')).toMatchObject({ foreign: true, confident: false });
    const running = rankKeysForField({ name: 'running', label: 'Running' }, pool, 'meter1', [], ['Flow meter', 'Flow meter']);
    expect(running[0]).toMatchObject({ key: 'meter_flow.running', confident: true });
    expect(running[0].foreign).toBeUndefined();
  });
  it('the element rule overrides it, and a flat key (no prefix) is never foreign', () => {
    const own = rankKeysForField({ name: 'running' }, [key('drain_valve.running', true)], 'drain_valve', [], ['Open basin']);
    expect(own[0]).toMatchObject({ key: 'drain_valve.running', confident: true });
    expect(own[0].foreign).toBeUndefined();
    const flat = rankKeysForField({ name: 'value', label: 'Temperature' }, [key('temp', 33.9), key('hum', 40)], 'tank1', [], ['Open basin']);
    expect(flat[0]).toMatchObject({ key: 'temp', confident: true });
  });
  it('the symbol\'s own words are read as written: "open" does not reach "valve" through a synonym', () => {
    const ranked = rankKeysForField({ name: 'running' }, [key('drain_valve.running', true), key('temp', 1.5)], 'tank1', [], ['Open basin']);
    expect(ranked[0]).toMatchObject({ key: 'drain_valve.running', foreign: true });
  });
});

describe('defaultInputName: the key, not a cut of the label (e2e round 2, E2E-2.12)', () => {
  it('keeps a key as it is, turns a dot into _, and drops leading words of a long dotted key', () => {
    expect(defaultInputName('temp_24h')).toBe('temp_24h');
    expect(defaultInputName('pool.value')).toBe('pool_value');
    expect(defaultInputName('circulation_pump.status')).toBe('status');
    expect(defaultInputName('tank.value', ['pool_value'])).toBe('tank_value');
    expect(defaultInputName('oven.door_open', ['door_open'])).toBe('oven_door_open');
    expect(defaultInputName('Pool temperature (24 h ago)')).toBe('v_24_h_ago');
  });
  it('two keys give two names without a cut mid-word', () => {
    const a = defaultInputName('temp_24h');
    const b = defaultInputName('temp', [a]);
    expect([a, b]).toEqual(['temp_24h', 'temp']);
  });
});

// ─── e2e round 5 (next-boilerplate, 2026-11-01), E3: wrong pairs marked certain ─────────────────────────────────────────────────

describe('rankKeysForField: the run\'s wrong "certain" pairs (e2e round 5, E3)', () => {
  // the utility RTU of S01 (the "utility" vendor contract): every element of the network board, the pump speed gauge and the booster load among them
  const rtu: DeviceKey[] = [
    key('booster_set.running', true, { label: 'Booster set · running', type: 'boolean' }), key('booster_set.value', 58.7, { label: 'Booster set · value', type: 'number' }),
    key('gauge_pump_speed.value', 1450, { label: 'Pump speed · value', unit: 'rpm', type: 'number' }), key('pump_kiosk.running', true, { label: 'Pump kiosk · running', type: 'boolean' }),
    key('booster', 66, { label: 'Booster load', unit: '%', type: 'number' }), key('kiosk', true, { label: 'Pump kiosk', type: 'boolean' }),
  ];
  it('S01: a booster set\'s Speed is never the pump speed gauge\'s, and its Direction is never the booster load: offered at most, never certain', () => {
    const hints = ['Booster set', 'Booster pump set'];
    const speed = rankKeysForField({ name: 'speed', label: 'Speed' }, rtu, 'booster1', [], hints);
    expect(speed.find((r) => r.key === 'gauge_pump_speed.value')).toMatchObject({ foreign: true, confident: false });
    expect(speed.some((r) => r.confident)).toBe(false);
    const direction = rankKeysForField({ name: 'direction', label: 'Direction' }, rtu, 'booster1', [], hints);
    expect(direction.some((r) => r.confident)).toBe(false);
    expect(direction.find((r) => r.key === 'booster')?.mismatch).toBe('number-for-text');
    // its own element, found by its name, stays certain
    expect(rankKeysForField({ name: 'running', label: 'Running' }, rtu, 'booster1', [], hints)[0]).toMatchObject({ key: 'booster_set.running', confident: true });
  });

  // the fertigation controller of S03 (the "agri" contract without its soil sensors): the greenhouses' values, never a soil probe's
  const controller: DeviceKey[] = [
    key('greenhouse_1.value', 61, { label: 'Greenhouse 1 · value' }), key('greenhouse_2.value', 58, { label: 'Greenhouse 2 · value' }),
    key('greenhouse_1.running', true, { label: 'Greenhouse 1 · running' }), key('temp', 24.1, { label: 'Greenhouse 1 temperature', unit: '°C' }),
    key('level', 62, { label: 'Tank level', unit: '%' }),
  ];
  it('S03: a soil probe named in Turkish is never paired with the controller\'s greenhouse as certain: the greenhouse is another piece of equipment', () => {
    const ranked = rankKeysForField({ name: 'value', label: 'Ölçüm' }, controller, 'probe_1a', [], ['Sera 1 A', 'Soil moisture probe']);
    expect(ranked.find((r) => r.key === 'greenhouse_1.value')).toMatchObject({ foreign: true, confident: false });
    expect(ranked.some((r) => r.confident)).toBe(false);
    // the greenhouse itself, named in Turkish, is greenhouse_1 by its kind and its number: not foreign
    const house = rankKeysForField({ name: 'value', label: 'Ölçüm' }, controller, 'sera1', [], ['Sera 1', 'Greenhouse']);
    expect(house[0]).toMatchObject({ key: 'greenhouse_1.value', confident: true });
    expect(house[0].foreign).toBeUndefined();
    // and greenhouse 2's is another twin: foreign
    expect(rankKeysForField({ name: 'value', label: 'Ölçüm' }, controller, 'sera2', [], ['Sera 2', 'Greenhouse']).find((r) => r.key === 'greenhouse_1.value')).toMatchObject({ foreign: true, confident: false });
  });
  it('a flat key is foreign when its label names another twin of the symbol\'s thing ("Greenhouse 1 temperature" for "Sera 2"), and its own when it names the symbol', () => {
    const other = rankKeysForField({ name: 'value', label: 'Temperature' }, [key('temp', 24.1, { label: 'Greenhouse 1 temperature', unit: '°C' }), key('rh', 70, { unit: '%' })], undefined, [], ['Sera 2', 'Greenhouse']);
    expect(other[0]).toMatchObject({ key: 'temp', foreign: true, confident: false });
    const own = rankKeysForField({ name: 'value', label: 'Temperature' }, [key('temp', 24.1, { label: 'Greenhouse 1 temperature', unit: '°C' }), key('rh', 70, { unit: '%' })], undefined, [], ['Sera 1', 'Greenhouse']);
    expect(own[0]).toMatchObject({ key: 'temp', confident: true });
    // a flat key that names nothing of the symbol is the device's own (a one-purpose device): not foreign
    expect(rankKeysForField({ name: 'value', label: 'Temperature' }, [key('temp_c', 3.4, { label: 'Room temperature', unit: '°C' })], undefined, [], ['Chiller 1', 'Cold room'])[0]).toMatchObject({ key: 'temp_c', confident: true });
  });
  it('the kind\'s words are a reason, never the symbol\'s own (four cold rooms share "room")', () => {
    const [top] = rankKeysForField({ name: 'value', label: 'Reading' }, [key('temperature', 3.7, { label: 'Room temperature', unit: '°C' }), key('defrost', false, { label: 'Defrost running', type: 'boolean' })], undefined, [], ['Chiller 1', 'Cold room']);
    expect(top).toMatchObject({ key: 'temperature', confident: true });
    expect(top.reasons).toContain('kind');
    expect(top.reasons).not.toContain('symbol');
  });
  it('a set-point is never a reading: vetoed for a Reading, still a second value\'s', () => {
    const keys = [key('temp', 24.1, { label: 'Greenhouse 1 temperature', unit: '°C' }), key('target', 22, { label: 'Greenhouse target', unit: '°C' })];
    const reading = rankKeysForField({ name: 'value', label: 'Reading' }, keys, undefined, [], ['Sera 1', 'Greenhouse']);
    expect(reading[0]).toMatchObject({ key: 'temp', confident: true });
    expect(reading.find((r) => r.key === 'target')).toBeUndefined();
    // a set-point alone is not even proposed for a reading
    expect(rankKeysForField({ name: 'value', label: 'Reading' }, [key('sp_temp', 22, { label: 'Temperature set point', unit: '°C' })], undefined, [], ['Room', 'Thermometer'])).toEqual([]);
    expect(rankKeysForField({ name: 'value2', label: 'Set point' }, keys, undefined, [], ['Sera 1', 'Greenhouse'])[0]).toMatchObject({ key: 'target' });
    expect(isSetpointWords(wordsOf('Spillway gate set-point'))).toBe(true);
    expect(isSetpointWords(wordsOf('Booster set'))).toBe(false);
  });
  it('a percent says no more than a word: a door\'s Opening is never certain of a relative humidity (S17)', () => {
    const ranked = rankKeysForField({ name: 'position', label: 'Opening' }, [key('temp_c', 20.4, { label: 'Room temperature', unit: '°C' }), key('rh_pct', 41, { label: 'Relative humidity', unit: '%' })], undefined, [], ['Airlock door', 'Door']);
    expect(ranked.find((r) => r.key === 'rh_pct')?.confident).toBe(false);
    expect(suggestKeyForField({ name: 'position', label: 'Opening' }, [key('rh_pct', 41, { label: 'Relative humidity', unit: '%' })], undefined, ['Airlock door', 'Door'])).toBeNull();
  });
  it('on a device that names its equipment, a state named after another piece of equipment is not even offered (a tee is not a door)', () => {
    const plant = [key('door', false), key('temp_1', 21.5), key('tee_main.status', 'ok'), key('pump_1.value', 3)];
    const ranked = rankKeysForField({ name: 'running', label: 'Running' }, plant, 'tee1', [], ['Supply tee', 'Pipe (tee)']);
    expect(ranked.filter((r) => r.key === 'door' && r.score >= MIN_PROPOSAL_SCORE)).toEqual([]);
  });
  it('"on" counts only as a last word: "Panel on battery" is no Running', () => {
    const ranked = rankKeysForField({ name: 'running', label: 'Running' }, [key('panel_on_battery', true, { label: 'Panel on battery', type: 'boolean' }), key('o2_bar', 4.3, { label: 'Oxygen pressure', unit: 'bar' })], undefined, [], ['Floor 1', 'Pressure gauge']);
    expect(ranked[0]?.reasons ?? []).not.toContain('synonym');
    expect(ranked.some((r) => r.confident)).toBe(false);
    expect(rankKeysForField({ name: 'running', label: 'Running' }, [key('pump_on', true), key('t', 20)])[0]).toMatchObject({ key: 'pump_on', confident: true });
  });
});

describe('Turkish words (e2e round 5, E3: an ASCII split cut "Açıklık" into a, kl, k)', () => {
  it('a word is a run of Unicode letters and digits, folded', () => {
    expect(wordsOf('Açıklık')).toEqual(['aciklik']);
    expect(wordsOf('Bulanıklık')).toEqual(['bulaniklik']);
    expect(wordsOf('Kazan Sıcaklığı')).toEqual(['kazan', 'sicakligi']);
    expect(wordsOf('İSTASYON çıkışı')).toEqual(['istasyon', 'cikisi']);
    expect(wordsOf('supplyTemp_2')).toEqual(['supply', 'temp', '2']);
  });
  it('"Açıklık" and "Bulanıklık" share no word, and a Turkish label meets its quantity', () => {
    const ranked = rankKeysForField({ name: 'position', label: 'Açıklık' }, [key('turbidity', 3.2, { label: 'Bulanıklık' }), key('valve_open', 40, { label: 'Vana açıklığı', unit: '%' })]);
    expect(ranked[0]).toMatchObject({ key: 'valve_open', confident: true });
    expect(ranked.find((r) => r.key === 'turbidity')?.reasons ?? []).not.toContain('synonym');
    expect(suggestKeyForField({ name: 'value', label: 'Ölçüm' }, [key('kazan_sicakligi', 61, { label: 'Kazan sıcaklığı' }), key('pompa', true)], undefined, ['Kazan', 'Thermometer'])).toBe('kazan_sicakligi');
  });
});

describe('keyKindOf: the declared type first (e2e round 5, V1-B19)', () => {
  it('a declared text is a text whatever word it holds; an on/off word is a state only for a boolean key', () => {
    expect(keyKindOf({ value: 'RUNNING', type: 'string' })).toBe('text');
    expect(keyKindOf({ value: 'on', type: 'string' })).toBe('text');
    expect(keyKindOf({ value: 'on', type: 'boolean' })).toBe('state');
    // a declared 0 / 1 is a state only when its name says so (next-boilerplate run 3 note 61)
    expect(keyKindOf({ value: 1, type: 'number' })).toBe('number');
    expect(keyKindOf({ key: 'pump_running', value: 1, type: 'number' })).toBe('state');
    expect(keyKindOf({ value: 1, unit: '%', type: 'number' })).toBe('number');
    expect(keyKindOf({ value: null, type: 'number' })).toBe('number');
    expect(mismatchOf({ name: 'value' }, { value: 'JAMMED', type: 'string' })).toBe('text-for-number');
    expect(mismatchOf({ name: 'status' }, { value: 'RUNNING', type: 'string' })).toBeNull();
  });
});

describe('the 0–100 helper asks for the raw range (e2e round 5, E15: a fixed 4095)', () => {
  it('writes the expression over the range the person gives, from the declared scale when the profile has one', () => {
    expect(scaleScript({ from: 1500, to: 3300 })).toBe('(value - 1500) / (3300 - 1500) * 100');
    expect(scaleScript({ from: 0, to: 4095 })).toBe('value / 4095 * 100');
    expect(scaleScript({ from: -20, to: 60 })).toBe('(value + 20) / (60 + 20) * 100');
    expect(rawRangeOf('1500', '3 300')).toEqual({ from: 1500, to: 3300 });
    expect(rawRangeOf('0,5', '4.5')).toEqual({ from: 0.5, to: 4.5 });
    expect(rawRangeOf('5', '5')).toBeNull();
    expect(rawRangeOf('', '10')).toBeNull();
    expect(rawRangeOf('dry', '10')).toBeNull();
    expect(declaredRange({ min: 1500, max: 3300 })).toEqual({ from: 1500, to: 3300 });
    expect(declaredRange({ min: 0 })).toBeNull();
    expect(declaredRange(undefined)).toBeNull();
    // the probe of S03: 2387 is about 49 %, not 58 %
    const pct = (2387 - 1500) / (3300 - 1500) * 100;
    expect(Math.round(pct)).toBe(49);
    // applied over what was typed, as every chip is
    expect(applyTemplate({ id: 'scale', script: scaleScript({ from: 1500, to: 3300 }) }, '!value', [], true)).toBe('((!value) - 1500) / (3300 - 1500) * 100');
  });
});

/** next-boilerplate e2e run 3: a 0 that counts is no on/off (note 61), a shared code decides a match (notes 60 and 131), on/off in the host's words (note 11). */
describe('run 3: a 0 or 1 is a state only when its name says so (note 61)', () => {
  const rk = (k: string, value: unknown, o: Partial<DeviceKey> = {}): DeviceKey => ({ key: k, value, ts: 1, ...o });
  it('a declared number that counts stays a number at 0; one named a state is a state', () => {
    expect(keyKindOf(rk('bags_per_hour', 0, { type: 'number', label: 'Bags per hour' }))).toBe('number');
    expect(keyKindOf(rk('pump_running', 1, { type: 'number' }))).toBe('state');
    expect(mismatchOf({ name: 'value', kind: 'number' }, rk('bags_per_hour', 0, { type: 'number', label: 'Bags per hour' }))).toBeNull();
  });
  it('an undeclared 0 / 1 stays a state unless its name counts or measures', () => {
    expect(keyKindOf(rk('door', 0))).toBe('state');
    expect(keyKindOf(rk('alarm_count', 1))).toBe('number');
    expect(keyKindOf(rk('flow_rate', 0))).toBe('number');
    expect(keyKindOf(rk('flow', 0, { unit: 'L/s' }))).toBe('number');
  });
  it('an on/off named by power stays a state, declared or not', () => {
    expect(keyKindOf(rk('power_on', 1))).toBe('state');
    expect(keyKindOf(rk('power_on', 1, { type: 'number' }))).toBe('state');
  });
});

describe('run 3: a code written in the symbol\'s name decides (notes 60 and 131)', () => {
  const rk = (k: string, value: unknown, o: Partial<DeviceKey> = {}): DeviceKey => ({ key: k, value, ts: 1, ...o });
  it('codesOf reads FT-101, B-101, CL1, K1, never a name with a space before its number', () => {
    expect([...codesOf('FT-101 flow')]).toEqual(['ft101']);
    expect([...codesOf('B-101 / CL1 / K1')]).toEqual(['b101', 'cl1', 'k1']);
    expect(codesOf('Pump 1').size).toBe(0);
  });
  it('a key or label that writes the symbol\'s tag code ranks first, for this symbol', () => {
    const keys = [rk('ft_100.value', 3.1, { label: 'FT-100 · value', unit: 'm3/h' }), rk('ft_101.value', 4.2, { label: 'FT-101 · value', unit: 'm3/h' })];
    const ranked = rankKeysForField({ name: 'value', label: 'Flow' }, keys, undefined, [], ['FT-101', 'Flow transmitter']);
    expect(ranked[0]!.key).toBe('ft_101.value');
    expect(ranked[0]!.reasons).toContain('symbol');
  });
  it('on a site, the device that writes the symbol\'s code wins over one whose keys fit the kind better', () => {
    const symbol: MatchSymbol = {
      id: 's1', label: 'CL1 collector', kindLabel: 'Belt conveyor', deviceId: '', deviceName: '',
      fields: [{ name: 'running', label: 'Running', kind: 'state' }],
      candidates: [{ deviceId: 'sorter', deviceName: 'Sorter controller' }, { deviceId: 'cl1', deviceName: 'CL1 controller' }],
    };
    const keys = new Map<string, DeviceKey[]>([
      ['sorter', [rk('belt_conveyor.running', true, { type: 'boolean', label: 'Belt conveyor · running' })]],
      ['cl1', [rk('line.running', true, { type: 'boolean', label: 'Line running' })]],
    ]);
    const rows = matchAllRows([symbol], keys);
    expect(rows.map((r) => r.deviceId)).toEqual(['cl1']);
  });
  it('the one device that writes the symbol\'s code is its own: a clear key there is certain, as on a device the name points at', () => {
    const symbol: MatchSymbol = {
      id: 's1', label: 'CL1 collector', kindLabel: 'Belt conveyor', deviceId: '', deviceName: '',
      fields: [{ name: 'running', label: 'Running', kind: 'state' }],
      candidates: [{ deviceId: 'sorter', deviceName: 'Sorter controller' }, { deviceId: 'cl1', deviceName: 'CL1 controller' }],
    };
    const keys = new Map<string, DeviceKey[]>([
      ['sorter', [rk('running', true, { type: 'boolean' })]],
      ['cl1', [rk('running', true, { type: 'boolean' })]],
    ]);
    expect(matchAllRows([symbol], keys).map((r) => [r.deviceId, r.confident])).toEqual([['cl1', true]]);
  });
});

describe('run 3: formatValue takes the host\'s words for on/off (note 11)', () => {
  it('Açık / Kapalı instead of On / Off; the English without words', () => {
    expect(formatValue(true, undefined, { on: 'Açık', off: 'Kapalı' })).toBe('Açık');
    expect(formatValue(false, undefined, { on: 'Açık', off: 'Kapalı' })).toBe('Kapalı');
    expect(formatValue(false)).toBe('Off');
  });
});
