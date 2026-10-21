import { describe, expect, it } from 'vitest';
import { shouldShow, type FieldSchema } from '../../SchemaForm/types';
import { BUILTIN_CATALOG } from './builtin';
import { fromBlocksField, fromBlocksFields, isBlocksFieldVisible, toParamSpec, whenToShowIf } from './fields';
import { isVisible } from './params';
import type { ParamSpec, ParamType } from './types';

/** one declaration of every blocks.d type, with the keys FieldSchema has no word for */
const EVERY: Record<ParamType, ParamSpec> = {
  string: { type: 'string', label: 'Name', hint: 'Shown on the card', required: true, pattern: '^[a-z]+$', max_len: 20, default: 'abc', suggest: ['abc'] },
  text: { type: 'text', default: 'hello' },
  number: { type: 'number', min: 1, max: 10, int: true, default: 3 },
  bool: { type: 'bool', default: false },
  enum: { type: 'enum', options: ['a', 1, true], option_labels: { a: 'Letter A' }, empty_label: 'None', default: 'a' },
  duration: { type: 'duration', default: 1000, min: 0 },
  time: { type: 'time', default: '08:00' },
  weekdays: { type: 'weekdays', default: [1, 2] },
  cron: { type: 'cron', default: '0 * * * *' },
  code: { type: 'code', lang: 'js', api: 'automation-script', store: 'script' },
  json: { type: 'json', default: { a: 1 } },
  secret: { type: 'secret', required: true },
  source: { type: 'source', source: 'teams', free: true },
  ref: { type: 'ref' },
  list: { type: 'list', items: { type: 'enum', options: ['x', 'y'] }, multiple: true },
  value: { type: 'value', scopes: ['msg', 'flow'] },
  rules: { type: 'rules', items: { op: { type: 'enum', options: ['eq', 'gt'] }, v: { type: 'value', when: { param: 'op', value: 'eq' } } } },
  path: { type: 'path', scopes: ['msg'] },
  template: { type: 'template' },
  expr: { type: 'expr' },
  hex: { type: 'hex' },
  topic: { type: 'topic', when: { param: 'mode', not: ['off'] } },
  mac: { type: 'mac' },
  ip: { type: 'ip' },
};

describe('fromBlocksField', () => {
  it('maps every blocks.d type onto a FieldSchema type (the 9.10 table)', () => {
    const t = (k: ParamType) => fromBlocksField(k, EVERY[k]).type;
    expect(Object.fromEntries((Object.keys(EVERY) as ParamType[]).map((k) => [k, t(k)]))).toEqual({
      string: 'text', text: 'textarea', number: 'number', bool: 'boolean', enum: 'select', duration: 'number', time: 'text',
      weekdays: 'multi-select', cron: 'text', code: 'textarea', json: 'json', secret: 'text', source: 'remote-select', ref: 'remote-select',
      list: 'multi-select', value: 'json', rules: 'repeater', path: 'text', template: 'textarea', expr: 'textarea', hex: 'text',
      topic: 'text', mac: 'text', ip: 'text',
    });
    expect(fromBlocksField('l', { type: 'list', items: { type: 'string' } }).type).toBe('repeater');
    expect(fromBlocksField('l', { type: 'list', source: 'teams' }).type).toBe('multi-select');
  });

  it('carries the words FieldSchema has: label, description, value, required, range, options', () => {
    expect(fromBlocksField('string', EVERY.string)).toMatchObject({ label: 'Name', description: 'Shown on the card', required: true, value: 'abc', maxLength: 20, pattern: '^[a-z]+$' });
    expect(fromBlocksField('max_wait_ms', { type: 'number', int: true, min: 1 })).toMatchObject({ label: 'Max wait', step: 1, min: 1 });
    expect(fromBlocksField('enum', EVERY.enum).options).toEqual([{ label: 'Letter A', value: 'a' }, { label: '1', value: '1' }, { label: 'true', value: 'true' }]);
    expect(fromBlocksField('weekdays', EVERY.weekdays).options?.map((o) => o.value)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(fromBlocksField('list', EVERY.list).options).toEqual([{ label: 'x', value: 'x' }, { label: 'y', value: 'y' }]);
  });

  it('masks a secret and never gives it a value; a duration is a number in ms', () => {
    const s = fromBlocksField('secret', { type: 'secret', default: 'leak' } as ParamSpec);
    expect(s).toMatchObject({ type: 'text', secret: true });
    expect(s.value).toBeUndefined();
    expect(fromBlocksField('duration', EVERY.duration)).toMatchObject({ type: 'number', unit: 'ms', value: 1000 });
  });

  it('routes the editor-only types to an override and gives the patterned ones a pattern', () => {
    for (const k of ['time', 'cron', 'template', 'expr', 'code', 'path', 'value', 'rules', 'source', 'ref'] as const) expect(fromBlocksField(k, EVERY[k]).override).toBe(k);
    for (const k of ['ip', 'mac', 'hex', 'topic', 'time'] as const) expect(fromBlocksField(k, EVERY[k]).pattern).toBeTruthy();
    expect(new RegExp(fromBlocksField('ip', EVERY.ip).pattern!).test('10.0.0.255')).toBe(true);
    expect(new RegExp(fromBlocksField('ip', EVERY.ip).pattern!).test('10.0.0.256')).toBe(false);
    expect(new RegExp(fromBlocksField('mac', EVERY.mac).pattern!).test('AA:bb:01:02:03:04')).toBe(true);
  });

  it('turns a rules row into repeater fields', () => {
    const f = fromBlocksField('rules', EVERY.rules);
    expect(Object.keys(f.fields ?? {})).toEqual(['op', 'v']);
    expect(f.fields?.v.showIf).toEqual({ op: ['eq'] });
  });

  it('is a FieldSchema (assignable, so SchemaForm takes it)', () => {
    const fields: Record<string, FieldSchema> = fromBlocksFields(EVERY);
    expect(Object.keys(fields)).toHaveLength(Object.keys(EVERY).length);
  });

  it('does not change its input', () => {
    const before = JSON.stringify(EVERY);
    fromBlocksFields(EVERY);
    expect(JSON.stringify(EVERY)).toBe(before);
  });
});

describe('round trip: toParamSpec(fromBlocksField(spec)) is spec', () => {
  it('for every blocks.d type', () => {
    for (const [k, spec] of Object.entries(EVERY)) expect(toParamSpec(fromBlocksField(k, spec)), k).toEqual(spec);
  });

  it('for every param of the built-in catalog', () => {
    for (const decl of Object.values(BUILTIN_CATALOG.blocks)) {
      for (const [k, spec] of Object.entries(decl.params ?? {})) expect(toParamSpec(fromBlocksField(k, spec, decl.params)), `${decl.type}.${k}`).toEqual(spec);
    }
  });

  it('reads the keys a field carries from the field, so a host edit comes back', () => {
    const f = fromBlocksField('n', { type: 'number', min: 1 });
    expect(toParamSpec({ ...f, min: 5, required: true, description: 'Count' })).toEqual({ type: 'number', min: 5, required: true, hint: 'Count' });
  });
});

describe('when → showIf', () => {
  const schema: Record<string, ParamSpec> = {
    mode: { type: 'enum', options: ['on', 'off', 1], default: 'on' },
    count: { type: 'number', default: 1 },
    flag: { type: 'bool' },
    a: { type: 'string', when: { param: 'mode', value: 'on' } },
    b: { type: 'string', when: { param: 'mode', value: ['off', 1] } },
    c: { type: 'string', when: { param: 'count', value: 1 } },
    d: { type: 'string', when: { param: 'flag', value: true } },
    e: { type: 'string', when: { param: 'flag', value: false } },
    f: { type: 'string', when: { param: 'mode', not: ['off'] } },
    g: { type: 'string', when: { param: 'mode', value: null } },
  };
  const samples: Record<string, unknown>[] = [
    {}, { mode: 'on' }, { mode: 'off' }, { mode: 1 }, { mode: '1' }, { mode: null }, { mode: '' },
    { count: 1 }, { count: '1' }, { count: 2 }, { count: true }, { count: null },
    { flag: true }, { flag: false }, { flag: 1 }, { flag: 0 }, { flag: '1' }, { flag: '0' }, { flag: '' }, { flag: 'true' },
  ];

  it('gives the same answer as isVisible for every sample (SchemaForm shouldShow, or the kept when for `not`)', () => {
    for (const [key, spec] of Object.entries(schema)) {
      const field = fromBlocksField(key, spec, schema);
      for (const values of samples) {
        const want = isVisible(spec, values, schema);
        expect(isBlocksFieldVisible(field, values, schema), `${key} ${JSON.stringify(values)}`).toBe(want);
        if (field.showIf) expect(shouldShow(field as FieldSchema, values), `${key} ${JSON.stringify(values)} (shouldShow)`).toBe(want);
      }
    }
  });

  it('has no showIf for a `not` condition or no condition; an unset value shows the field when the default matches', () => {
    expect(whenToShowIf(schema.f, schema)).toBeUndefined();
    expect(whenToShowIf({})).toBeUndefined();
    expect(whenToShowIf(schema.a, schema)?.mode).toContain(undefined);
    expect(whenToShowIf(schema.b, schema)?.mode).not.toContain(undefined);
  });
});
