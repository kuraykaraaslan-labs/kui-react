import { describe, it, expect } from 'vitest';
import {
  FILTER_STRING_MAX,
  MAX_BOARD_FILTERS,
  MAX_FILTER_VALUES,
  MAX_KEY_FILTERS,
  MAX_PREDICATES,
  checkFilterValue,
  keyFilterErrorsAt,
  validateBoardFilter,
  validateBoardFilters,
  validateKeyFilter,
} from './validate-filters';
import { KEY_FILTER_OPS } from './key-filters';
import { DEFAULT_ALIAS_MESSAGES } from './messages';
import type { BoardFilter, BoardParamInfo, KeyFilter, KeyFilterOp, KeyFilterPredicate } from './types';

const params: BoardParamInfo[] = [{ key: 'limit', label: 'limit' }];
const opts = { existingKeys: [] as string[], params };

function kf(over: Partial<KeyFilter> = {}): KeyFilter {
  return { key: { type: 'telemetry', name: 'temperature' }, valueType: 'number', operation: 'and', predicates: [{ op: 'gt', value: 30 }], ...over };
}

function filter(over: Partial<BoardFilter> = {}): BoardFilter {
  return { key: 'hot', name: 'Hot', keyFilters: [kf()], ...over };
}

const withPredicate = (valueType: KeyFilter['valueType'], p: KeyFilterPredicate) => validateKeyFilter(kf({ valueType, predicates: [p] }), { params });

describe('validateBoardFilter: key, name and caps', () => {
  it('accepts a valid filter', () => {
    expect(validateBoardFilter(filter(), opts)).toEqual({});
  });

  it('checks the key like an alias key', () => {
    expect(validateBoardFilter(filter({ key: '' }), opts).key).toBe('required');
    expect(validateBoardFilter(filter({ key: 'Hot' }), opts).key).toBe('pattern');
    expect(validateBoardFilter(filter({ key: 'a'.repeat(41) }), opts).key).toBe('pattern');
    expect(validateBoardFilter(filter({ key: '__proto__' }), opts).key).toBe('reserved');
    expect(validateBoardFilter(filter(), { ...opts, existingKeys: ['hot'] }).key).toBe('duplicate');
  });

  it('requires a name, at most 80 characters, unique ignoring case', () => {
    expect(validateBoardFilter(filter({ name: '  ' }), opts).name).toBe('required');
    expect(validateBoardFilter(filter({ name: 'x'.repeat(81) }), opts).name).toBe('tooLong');
    expect(validateBoardFilter(filter({ name: 'x'.repeat(80) }), opts).name).toBeUndefined();
    expect(validateBoardFilter(filter({ name: ' hot ' }), { ...opts, existingNames: ['HOT'] }).name).toBe('duplicate');
  });

  it(`refuses a ${MAX_BOARD_FILTERS + 1}th filter`, () => {
    const keys = Array.from({ length: MAX_BOARD_FILTERS }, (_, i) => `f${i}`);
    expect(validateBoardFilter(filter(), { ...opts, existingKeys: keys }).filters).toBe('tooMany');
    expect(validateBoardFilter(filter(), { ...opts, existingKeys: keys.slice(1) }).filters).toBeUndefined();
  });

  it(`takes 1 to ${MAX_KEY_FILTERS} key filters`, () => {
    expect(validateBoardFilter(filter({ keyFilters: [] }), opts).keyFilters).toBe('tooFew');
    expect(validateBoardFilter(filter({ keyFilters: Array.from({ length: MAX_KEY_FILTERS }, () => kf()) }), opts).keyFilters).toBeUndefined();
    expect(validateBoardFilter(filter({ keyFilters: Array.from({ length: MAX_KEY_FILTERS + 1 }, () => kf()) }), opts).keyFilters).toBe('tooMany');
  });

  it("prefixes a key filter's errors with its index", () => {
    const errors = validateBoardFilter(filter({ keyFilters: [kf(), kf({ key: { type: 'telemetry', name: '' } })] }), opts);
    expect(errors['keyFilters.1.key.name']).toBe('required');
    expect(keyFilterErrorsAt(errors, 1)).toEqual({ 'key.name': 'required' });
    expect(keyFilterErrorsAt(errors, 0)).toEqual({});
  });
});

describe('validateKeyFilter: key, value type and predicates', () => {
  it('requires a key name of at most 200 characters, and known key types, scopes and value types', () => {
    expect(validateKeyFilter(kf({ key: { type: 'telemetry', name: ' ' } }), { params })['key.name']).toBe('required');
    expect(validateKeyFilter(kf({ key: { type: 'telemetry', name: 'k'.repeat(FILTER_STRING_MAX + 1) } }), { params })['key.name']).toBe('tooLong');
    expect(validateKeyFilter(kf({ key: { type: 'nope' as never, name: 'x' } }), { params })['key.type']).toBe('unknownType');
    expect(validateKeyFilter(kf({ key: { type: 'attribute', name: 'x', scope: 'tenant' as never } }), { params })['key.scope']).toBe('unknownType');
    expect(validateKeyFilter(kf({ key: { type: 'attribute', name: 'x', scope: 'server' } }), { params })['key.scope']).toBeUndefined();
    expect(validateKeyFilter(kf({ valueType: 'json' as never }), { params }).valueType).toBe('unknownType');
    expect(validateKeyFilter(kf({ operation: 'xor' as never }), { params }).operation).toBe('unknownType');
  });

  it(`takes 1 to ${MAX_PREDICATES} predicates`, () => {
    expect(validateKeyFilter(kf({ predicates: [] }), { params }).predicates).toBe('tooFew');
    const many = (n: number) => Array.from({ length: n }, (): KeyFilterPredicate => ({ op: 'gt', value: 1 }));
    expect(validateKeyFilter(kf({ predicates: many(MAX_PREDICATES) }), { params }).predicates).toBeUndefined();
    expect(validateKeyFilter(kf({ predicates: many(MAX_PREDICATES + 1) }), { params }).predicates).toBe('tooMany');
  });

  it('allows exactly the operations of the spec list per value type', () => {
    const all: KeyFilterOp[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'notIn', 'set', 'unset', 'true', 'false', 'startsWith', 'endsWith', 'contains', 'notContains'];
    const expected: Record<KeyFilter['valueType'], KeyFilterOp[]> = {
      string: ['eq', 'ne', 'startsWith', 'endsWith', 'contains', 'notContains', 'in', 'notIn', 'set', 'unset'],
      number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'notIn', 'set', 'unset'],
      boolean: ['eq', 'ne', 'true', 'false', 'set', 'unset'],
      datetime: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'set', 'unset'],
    };
    for (const valueType of Object.keys(expected) as KeyFilter['valueType'][]) {
      expect([...KEY_FILTER_OPS[valueType]].sort()).toEqual([...expected[valueType]].sort());
      for (const op of all) {
        const code = withPredicate(valueType, { op })['predicates.0.op'];
        if (expected[valueType].includes(op)) expect(code, `${valueType} ${op}`).toBeUndefined();
        else expect(code, `${valueType} ${op}`).toBe('invalidOp');
      }
    }
  });

  it('refuses an unknown or missing operation', () => {
    expect(withPredicate('number', { op: 'like' as never })['predicates.0.op']).toBe('unknownType');
    expect(withPredicate('number', { op: '' as never })['predicates.0.op']).toBe('required');
  });

  it('requires the value an operation reads', () => {
    expect(withPredicate('number', { op: 'gt' })['predicates.0.value']).toBe('required');
    expect(withPredicate('number', { op: 'between', value: 1 })['predicates.0.to']).toBe('required');
    expect(withPredicate('number', { op: 'between', to: 5 })['predicates.0.value']).toBe('required');
    expect(withPredicate('number', { op: 'between', value: 1, to: 5 })).toEqual({});
    expect(withPredicate('string', { op: 'in' })['predicates.0.values']).toBe('tooFew');
    expect(withPredicate('string', { op: 'notIn', values: [] })['predicates.0.values']).toBe('tooFew');
    expect(withPredicate('string', { op: 'in', values: ['A'] })).toEqual({});
  });

  it('needs no value for set, unset, true and false', () => {
    expect(withPredicate('string', { op: 'set' })).toEqual({});
    expect(withPredicate('number', { op: 'unset' })).toEqual({});
    expect(withPredicate('boolean', { op: 'true' })).toEqual({});
    expect(withPredicate('boolean', { op: 'false' })).toEqual({});
  });

  it('checks a literal against the value type', () => {
    expect(withPredicate('number', { op: 'eq', value: '30' })['predicates.0.value']).toBe('invalidValue');
    expect(withPredicate('number', { op: 'eq', value: Number.NaN })['predicates.0.value']).toBe('invalidValue');
    expect(withPredicate('number', { op: 'eq', value: 0 })).toEqual({});
    expect(withPredicate('boolean', { op: 'eq', value: 'true' })['predicates.0.value']).toBe('invalidValue');
    expect(withPredicate('boolean', { op: 'ne', value: false })).toEqual({});
    expect(withPredicate('string', { op: 'eq', value: 3 })['predicates.0.value']).toBe('invalidValue');
    expect(withPredicate('string', { op: 'eq', value: '  ' })['predicates.0.value']).toBe('required');
    expect(withPredicate('string', { op: 'contains', value: 'x'.repeat(FILTER_STRING_MAX + 1) })['predicates.0.value']).toBe('tooLong');
    expect(withPredicate('string', { op: 'contains', value: 'x'.repeat(FILTER_STRING_MAX) })).toEqual({});
    expect(withPredicate('datetime', { op: 'gt', value: 'yesterday' })['predicates.0.value']).toBe('invalidValue');
    expect(withPredicate('datetime', { op: 'gt', value: '2026-10-24T10:30:00.000Z' })).toEqual({});
  });

  it(`checks the values chips: at most ${MAX_FILTER_VALUES}, 200 characters each, numbers for a number key`, () => {
    const values = (n: number) => Array.from({ length: n }, (_, i) => String(i));
    expect(withPredicate('number', { op: 'in', values: values(MAX_FILTER_VALUES) })).toEqual({});
    expect(withPredicate('number', { op: 'in', values: values(MAX_FILTER_VALUES + 1) })['predicates.0.values']).toBe('tooMany');
    expect(withPredicate('string', { op: 'in', values: ['x'.repeat(FILTER_STRING_MAX + 1)] })['predicates.0.values']).toBe('tooLong');
    expect(withPredicate('number', { op: 'in', values: ['1', 'two'] })['predicates.0.values']).toBe('invalidValue');
    expect(withPredicate('string', { op: 'in', values: ['A', ' '] })['predicates.0.values']).toBe('invalidValue');
  });

  it('takes a dashboard parameter as a value only when the board has it', () => {
    expect(withPredicate('number', { op: 'gt', value: { $param: 'limit' } })).toEqual({});
    expect(withPredicate('number', { op: 'between', value: 0, to: { $param: 'limit' } })).toEqual({});
    expect(withPredicate('number', { op: 'gt', value: { $param: 'missing' } })['predicates.0.value']).toBe('unknownParam');
    expect(withPredicate('number', { op: 'between', value: 0, to: { $param: 'missing' } })['predicates.0.to']).toBe('unknownParam');
    expect(withPredicate('string', { op: 'eq', value: { $param: ' ' } })['predicates.0.value']).toBe('required');
    // A parameter has no type: it is accepted for every value type.
    expect(withPredicate('boolean', { op: 'eq', value: { $param: 'limit' } })).toEqual({});
  });
});

describe('checkFilterValue', () => {
  it('answers per value type', () => {
    expect(checkFilterValue(undefined, 'string', params)).toBe('required');
    expect(checkFilterValue('ACTIVE', 'string', params)).toBeUndefined();
    expect(checkFilterValue(Infinity, 'number', params)).toBe('invalidValue');
    expect(checkFilterValue(true, 'boolean', params)).toBeUndefined();
    expect(checkFilterValue({ $param: 'limit' }, 'datetime', params)).toBeUndefined();
  });
});

describe('validateBoardFilters (the list)', () => {
  it('checks keys and names against every other filter', () => {
    const result = validateBoardFilters([filter(), filter({ name: 'HOT' })], { params });
    expect(result.valid).toBe(false);
    expect(result.byIndex[0].key).toBe('duplicate');
    expect(result.byIndex[1].name).toBe('duplicate');
  });

  it(`refuses more than ${MAX_BOARD_FILTERS} filters`, () => {
    const list = Array.from({ length: MAX_BOARD_FILTERS + 1 }, (_, i) => filter({ key: `f${i}`, name: `F${i}` }));
    const result = validateBoardFilters(list, { params });
    expect(result.filters).toBe('tooMany');
    expect(result.valid).toBe(false);
    expect(result.byIndex.every((e) => e.filters === undefined)).toBe(true);
    expect(validateBoardFilters(list.slice(1), { params }).valid).toBe(true);
  });
});

describe('filterError (default English texts)', () => {
  it('reads the last part of a field', () => {
    expect(DEFAULT_ALIAS_MESSAGES.filterError('keyFilters.0.predicates.1.value', 'unknownParam')).toBe('This board has no such parameter.');
    expect(DEFAULT_ALIAS_MESSAGES.filterError('predicates.0.op', 'invalidOp')).toBe('This operation does not apply to this value type.');
    expect(DEFAULT_ALIAS_MESSAGES.filterError('keyFilters.2.key.name', 'required')).toBe('Key name is required.');
    expect(DEFAULT_ALIAS_MESSAGES.filterError('name', 'required')).toBe('Filter name is required.');
    expect(DEFAULT_ALIAS_MESSAGES.filterError('filters', 'tooMany')).toBe('A board holds at most 16 filters.');
  });
});
