import { describe, it, expect } from 'vitest';
import {
  emptyKeyFilter,
  emptyPredicate,
  filterParamKeys,
  isParamValue,
  normalizeBoardFilter,
  normalizeKeyFilter,
  predicateShape,
  takesIgnoreCase,
  withValueType,
} from './key-filters';
import { mergeAliasMessages } from './messages';
import type { KeyFilter } from './types';

describe('predicateShape and ignore case', () => {
  it('says what each operation reads', () => {
    expect(predicateShape('eq')).toBe('value');
    expect(predicateShape('startsWith')).toBe('value');
    expect(predicateShape('between')).toBe('range');
    expect(predicateShape('in')).toBe('list');
    expect(predicateShape('notIn')).toBe('list');
    expect(predicateShape('set')).toBe('none');
    expect(predicateShape('true')).toBe('none');
  });

  it('offers ignore case only for text comparisons', () => {
    expect(takesIgnoreCase('string', 'contains')).toBe(true);
    expect(takesIgnoreCase('string', 'in')).toBe(true);
    expect(takesIgnoreCase('string', 'set')).toBe(false);
    expect(takesIgnoreCase('number', 'eq')).toBe(false);
  });

  it('knows a parameter value', () => {
    expect(isParamValue({ $param: 'limit' })).toBe(true);
    expect(isParamValue('limit')).toBe(false);
    expect(isParamValue(null)).toBe(false);
  });
});

describe('defaults', () => {
  it("follows TB's new-row defaults", () => {
    expect(emptyPredicate('string')).toEqual({ op: 'startsWith' });
    expect(emptyPredicate('number')).toEqual({ op: 'eq' });
    expect(emptyPredicate('boolean')).toEqual({ op: 'true' });
    expect(emptyKeyFilter()).toEqual({ key: { type: 'attribute', name: '', scope: 'any' }, valueType: 'string', operation: 'and', predicates: [{ op: 'startsWith' }] });
  });
});

describe('withValueType', () => {
  const base: KeyFilter = {
    key: { type: 'telemetry', name: 'level' },
    valueType: 'number',
    operation: 'or',
    predicates: [
      { op: 'gt', value: 3 },
      { op: 'between', value: 1, to: { $param: 'limit' } },
      { op: 'in', values: ['1', '2'] },
    ],
  };

  it('keeps allowed operations and parameters, drops typed literals', () => {
    expect(withValueType(base, 'datetime').predicates).toEqual([
      { op: 'gt' },
      { op: 'between', to: { $param: 'limit' } },
      { op: 'eq' }, // datetime has no "in"
    ]);
  });

  it('keeps the values chips between text and numbers', () => {
    expect(withValueType(base, 'string').predicates[2]).toEqual({ op: 'in', values: ['1', '2'] });
    expect(withValueType(base, 'string').predicates[0]).toEqual({ op: 'startsWith' });
  });

  it('changes nothing for the same type', () => {
    expect(withValueType(base, 'number')).toBe(base);
  });
});

describe('normalize', () => {
  it('keeps only what each operation reads, trims, and sets the scope only for an attribute', () => {
    const kf: KeyFilter = {
      key: { type: 'telemetry', name: ' level ', scope: 'server' },
      valueType: 'string',
      operation: 'and',
      predicates: [
        { op: 'set', value: 'x', ignoreCase: true },
        { op: 'in', values: [' A ', 'A', '', 'B'], value: 'stale', ignoreCase: true },
        { op: 'eq', value: 'x', values: ['y'], ignoreCase: false },
      ],
    };
    expect(normalizeKeyFilter(kf)).toEqual({
      key: { type: 'telemetry', name: 'level' },
      valueType: 'string',
      operation: 'and',
      predicates: [{ op: 'set' }, { op: 'in', values: ['A', 'B'], ignoreCase: true }, { op: 'eq', value: 'x' }],
    });
    expect(normalizeKeyFilter({ ...kf, key: { type: 'attribute', name: 'a' } }).key).toEqual({ type: 'attribute', name: 'a', scope: 'any' });
  });

  it('trims the filter name and lists the params a filter reads', () => {
    const filter = {
      key: 'hot',
      name: ' Hot ',
      keyFilters: [
        { key: { type: 'telemetry' as const, name: 't' }, valueType: 'number' as const, operation: 'and' as const,
          predicates: [{ op: 'between' as const, value: { $param: 'low' }, to: { $param: 'high' } }, { op: 'gt' as const, value: { $param: 'low' } }] },
      ],
    };
    expect(normalizeBoardFilter(filter).name).toBe('Hot');
    expect(filterParamKeys(filter)).toEqual(['low', 'high']);
  });

  it("keeps the filter's operation only when it is 'or' between two or more key filters", () => {
    const kf: KeyFilter = { key: { type: 'telemetry', name: 't' }, valueType: 'number', operation: 'and', predicates: [{ op: 'gt', value: 1 }] };
    expect(normalizeBoardFilter({ key: 'f', name: 'F', operation: 'or', keyFilters: [kf, kf] }).operation).toBe('or');
    expect('operation' in normalizeBoardFilter({ key: 'f', name: 'F', operation: 'or', keyFilters: [kf] })).toBe(false);
    expect('operation' in normalizeBoardFilter({ key: 'f', name: 'F', operation: 'and', keyFilters: [kf, kf] })).toBe(false);
    expect('operation' in normalizeBoardFilter({ key: 'f', name: 'F', keyFilters: [kf, kf] })).toBe(false);
  });
});

describe('mergeAliasMessages with the filter maps', () => {
  it('merges the new nested maps key by key and keeps the old ones', () => {
    const m = mergeAliasMessages({ keyFilterOps: { gt: 'More than' }, valueTypes: { string: 'String' }, filterTypes: { entityList: 'List' } });
    expect(m.keyFilterOps.gt).toBe('More than');
    expect(m.keyFilterOps.lt).toBe('Less than');
    expect(m.valueTypes).toEqual({ string: 'String', number: 'Number', boolean: 'Boolean', datetime: 'Date and time' });
    expect(m.filterTypes.entityList).toBe('List');
    expect(m.filterTypes.singleEntity).toBe('Single entity');
    expect(m.textOps.gt).toBe('>');
  });
});
