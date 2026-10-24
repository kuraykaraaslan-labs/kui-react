// Key filters (next-boilerplate dashboard phase 36.7, ThingsBoard's dashboard "Filters"): the operation table per value
// type, the shape of each operation (what a predicate reads), new-row defaults, the value-type change and the save
// clean-up. Pure: no React.

import type {
  AttributeScope,
  BoardFilter,
  FilterValue,
  KeyFilter,
  KeyFilterKeyType,
  KeyFilterOp,
  KeyFilterPredicate,
  KeyFilterValueType,
} from './types';

export const KEY_FILTER_KEY_TYPES: readonly KeyFilterKeyType[] = ['field', 'attribute', 'telemetry'];
export const ATTRIBUTE_SCOPES: readonly AttributeScope[] = ['any', 'client', 'shared', 'server'];
export const KEY_FILTER_VALUE_TYPES: readonly KeyFilterValueType[] = ['string', 'number', 'boolean', 'datetime'];
export const KEY_FILTER_OPERATIONS: readonly KeyFilter['operation'][] = ['and', 'or'];

/** The operations each value type allows, in the order the editor offers them (the phase 36.7 list). */
export const KEY_FILTER_OPS: Readonly<Record<KeyFilterValueType, readonly KeyFilterOp[]>> = {
  string: ['eq', 'ne', 'startsWith', 'endsWith', 'contains', 'notContains', 'in', 'notIn', 'set', 'unset'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'notIn', 'set', 'unset'],
  boolean: ['eq', 'ne', 'true', 'false', 'set', 'unset'],
  datetime: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'set', 'unset'],
};

/** Every operation of the contract. */
export const ALL_KEY_FILTER_OPS: readonly KeyFilterOp[] = [
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'notIn', 'set', 'unset', 'true', 'false',
  'startsWith', 'endsWith', 'contains', 'notContains',
];

/**
 * What an operation reads: `value` one value, `range` `value` … `to` (inclusive), `list` the `values` chips, `none`
 * nothing (`set`, `unset`, `true`, `false`).
 */
export type PredicateShape = 'value' | 'range' | 'list' | 'none';

export function predicateShape(op: KeyFilterOp): PredicateShape {
  switch (op) {
    case 'between':
      return 'range';
    case 'in':
    case 'notIn':
      return 'list';
    case 'set':
    case 'unset':
    case 'true':
    case 'false':
      return 'none';
    default:
      return 'value';
  }
}

export function isOpValidFor(valueType: KeyFilterValueType, op: KeyFilterOp): boolean {
  return KEY_FILTER_OPS[valueType]?.includes(op) ?? false;
}

/** Ignore case applies to the string operations that compare text (not `set` / `unset`). */
export function takesIgnoreCase(valueType: KeyFilterValueType, op: KeyFilterOp): boolean {
  if (valueType !== 'string') return false;
  const shape = predicateShape(op);
  return shape === 'value' || shape === 'list';
}

/** A value that reads a board parameter (TB's "user value" of an editable filter). */
export function isParamValue(value: unknown): value is { $param: string } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, '$param');
}

/** A new predicate row for a value type (TB's defaults: text starts with, a boolean is true, the rest equal). */
export function emptyPredicate(valueType: KeyFilterValueType): KeyFilterPredicate {
  if (valueType === 'string') return { op: 'startsWith' };
  if (valueType === 'boolean') return { op: 'true' };
  return { op: 'eq' };
}

/** A new key filter (TB's default: an attribute of any scope, read as text), with one condition row. */
export function emptyKeyFilter(): KeyFilter {
  return { key: { type: 'attribute', name: '', scope: 'any' }, valueType: 'string', operation: 'and', predicates: [emptyPredicate('string')] };
}

/**
 * The key filter with another value type. TB clears the predicates after a confirmation; the editor keeps the rows
 * instead: an operation the new type allows stays, any other becomes the new type's default; a dashboard parameter
 * value stays (a parameter has no type), a literal is dropped (it was typed for the old type), the `values` chips stay
 * only between text and numbers.
 */
export function withValueType(keyFilter: KeyFilter, valueType: KeyFilterValueType): KeyFilter {
  if (keyFilter.valueType === valueType) return keyFilter;
  const keepParam = (v: FilterValue | undefined) => (isParamValue(v) ? v : undefined);
  const listsKept = (keyFilter.valueType === 'string' || keyFilter.valueType === 'number') && (valueType === 'string' || valueType === 'number');
  const predicates = keyFilter.predicates.map((p): KeyFilterPredicate => {
    const op = isOpValidFor(valueType, p.op) ? p.op : emptyPredicate(valueType).op;
    const next: KeyFilterPredicate = { op };
    const value = keepParam(p.value);
    const to = keepParam(p.to);
    if (value) next.value = value;
    if (to) next.to = to;
    if (listsKept && p.values) next.values = p.values;
    if (valueType === 'string' && p.ignoreCase) next.ignoreCase = true;
    return next;
  });
  return { ...keyFilter, valueType, predicates };
}

/** One predicate as the server stores it: only the fields its operation reads; ignore case only when on and it applies. */
export function normalizePredicate(predicate: KeyFilterPredicate, valueType: KeyFilterValueType): KeyFilterPredicate {
  const out: KeyFilterPredicate = { op: predicate.op };
  switch (predicateShape(predicate.op)) {
    case 'value':
      if (predicate.value !== undefined) out.value = predicate.value;
      break;
    case 'range':
      if (predicate.value !== undefined) out.value = predicate.value;
      if (predicate.to !== undefined) out.to = predicate.to;
      break;
    case 'list':
      out.values = [...new Set((predicate.values ?? []).map((v) => v.trim()).filter(Boolean))];
      break;
    case 'none':
      break;
  }
  if (predicate.ignoreCase && takesIgnoreCase(valueType, predicate.op)) out.ignoreCase = true;
  return out;
}

/** One key filter as the server stores it: the key name trimmed, a scope only (and always) for an attribute. */
export function normalizeKeyFilter(keyFilter: KeyFilter): KeyFilter {
  const { type, name, scope } = keyFilter.key;
  return {
    key: { type, name: name.trim(), ...(type === 'attribute' ? { scope: scope ?? 'any' } : {}) },
    valueType: keyFilter.valueType,
    operation: keyFilter.operation,
    predicates: keyFilter.predicates.map((p) => normalizePredicate(p, keyFilter.valueType)),
  };
}

/**
 * A filter as the filters dialog saves it: the name trimmed, every key filter normalised, `operation` only when it is
 * 'or' between two or more key filters (absent = 'and').
 */
export function normalizeBoardFilter(filter: BoardFilter): BoardFilter {
  const keyFilters = filter.keyFilters.map(normalizeKeyFilter);
  return {
    key: filter.key,
    name: filter.name.trim(),
    ...(filter.operation === 'or' && keyFilters.length > 1 ? { operation: 'or' as const } : {}),
    keyFilters,
  };
}

/** The board params a filter reads (`{ $param }` values), in order, without repeats. */
export function filterParamKeys(filter: BoardFilter): string[] {
  const keys: string[] = [];
  for (const kf of filter.keyFilters ?? []) {
    for (const p of kf.predicates ?? []) {
      for (const v of [p.value, p.to]) if (isParamValue(v) && !keys.includes(v.$param)) keys.push(v.$param);
    }
  }
  return keys;
}
