// The key filter caps (next-boilerplate dashboard phase 36.7), mirrored for the editor so it can say what is wrong
// before the server refuses it with a 422. Pure: no React. The server's schemas stay the authority.

import {
  ALL_KEY_FILTER_OPS,
  ATTRIBUTE_SCOPES,
  KEY_FILTER_KEY_TYPES,
  KEY_FILTER_OPERATIONS,
  KEY_FILTER_VALUE_TYPES,
  isOpValidFor,
  isParamValue,
  predicateShape,
} from './key-filters';
import type { BoardFilterErrorField, FilterErrorCode, KeyFilterErrorField } from './messages';
import { ALIAS_KEY_PATTERN, RESERVED_ALIAS_KEYS } from './validate';
import type { BoardFilter, BoardParamInfo, FilterValue, KeyFilter, KeyFilterValueType } from './types';

export const MAX_BOARD_FILTERS = 16;
export const MAX_KEY_FILTERS = 8;
export const MAX_PREDICATES = 4;
export const MAX_FILTER_VALUES = 50;
/** Every string of a filter: a key name, a text value, one of the `values`. */
export const FILTER_STRING_MAX = 200;
/** The filter's name, as an alias's name. */
export const BOARD_FILTER_NAME_MAX = 80;

/** Field → error code for one key filter. Empty when it is valid. */
export type KeyFilterErrors = Partial<Record<KeyFilterErrorField, FilterErrorCode>>;
/** Field → error code for one filter (`keyFilters.<n>.<field>` for its key filters). Empty when it is valid. */
export type BoardFilterErrors = Partial<Record<BoardFilterErrorField, FilterErrorCode>>;

export interface ValidateBoardFilterOptions {
  /** Keys of the board's OTHER filters (leave the one being validated out). */
  existingKeys: readonly string[];
  /** Names of the board's other filters; when given, the name must differ from each (case-insensitive). */
  existingNames?: readonly string[];
  /** The board's params: a `{ $param }` value must name one of them. */
  params: readonly BoardParamInfo[];
}

const blank = (s: unknown) => typeof s !== 'string' || s.trim() === '';

/** One value against the key filter's value type, or a `{ $param }` that names a board param. */
export function checkFilterValue(
  value: FilterValue | undefined,
  valueType: KeyFilterValueType,
  params: readonly BoardParamInfo[],
): FilterErrorCode | undefined {
  if (value === undefined || value === null) return 'required';
  if (isParamValue(value)) {
    if (blank(value.$param)) return 'required';
    return params.some((p) => p.key === value.$param) ? undefined : 'unknownParam';
  }
  switch (valueType) {
    case 'string':
      if (typeof value !== 'string') return 'invalidValue';
      if (value.trim() === '') return 'required';
      return value.length > FILTER_STRING_MAX ? 'tooLong' : undefined;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? undefined : 'invalidValue';
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'invalidValue';
    case 'datetime':
      if (typeof value !== 'string') return 'invalidValue';
      if (value.trim() === '') return 'required';
      if (value.length > FILTER_STRING_MAX) return 'tooLong';
      return Number.isNaN(Date.parse(value)) ? 'invalidValue' : undefined;
  }
  return 'invalidValue';
}

/** Every error of one key filter, keyed by field (`key.name`, `predicates.0.value` …). */
export function validateKeyFilter(keyFilter: KeyFilter | null | undefined, { params }: { params: readonly BoardParamInfo[] }): KeyFilterErrors {
  const errors: KeyFilterErrors = {};
  if (!keyFilter || typeof keyFilter !== 'object') return { 'key.type': 'required' };

  const key = keyFilter.key ?? ({} as KeyFilter['key']);
  if (!key.type) errors['key.type'] = 'required';
  else if (!KEY_FILTER_KEY_TYPES.includes(key.type)) errors['key.type'] = 'unknownType';
  if (blank(key.name)) errors['key.name'] = 'required';
  else if (key.name.trim().length > FILTER_STRING_MAX) errors['key.name'] = 'tooLong';
  if (key.scope !== undefined && !ATTRIBUTE_SCOPES.includes(key.scope)) errors['key.scope'] = 'unknownType';

  const valueType = keyFilter.valueType;
  const knownValueType = KEY_FILTER_VALUE_TYPES.includes(valueType);
  if (!valueType) errors.valueType = 'required';
  else if (!knownValueType) errors.valueType = 'unknownType';

  if (!keyFilter.operation) errors.operation = 'required';
  else if (!KEY_FILTER_OPERATIONS.includes(keyFilter.operation)) errors.operation = 'unknownType';

  const predicates = Array.isArray(keyFilter.predicates) ? keyFilter.predicates : [];
  if (predicates.length < 1) errors.predicates = 'tooFew';
  else if (predicates.length > MAX_PREDICATES) errors.predicates = 'tooMany';

  predicates.forEach((p, i) => {
    const at = (part: 'op' | 'value' | 'to' | 'values') => `predicates.${i}.${part}` as const;
    if (!p || !p.op) {
      errors[at('op')] = 'required';
      return;
    }
    if (!ALL_KEY_FILTER_OPS.includes(p.op)) {
      errors[at('op')] = 'unknownType';
      return;
    }
    if (!knownValueType) return; // the value type error already says it
    if (!isOpValidFor(valueType, p.op)) {
      errors[at('op')] = 'invalidOp';
      return;
    }
    const shape = predicateShape(p.op);
    if (shape === 'value' || shape === 'range') {
      const v = checkFilterValue(p.value, valueType, params);
      if (v) errors[at('value')] = v;
    }
    if (shape === 'range') {
      const to = checkFilterValue(p.to, valueType, params);
      if (to) errors[at('to')] = to;
    }
    if (shape === 'list') {
      const values = Array.isArray(p.values) ? p.values : [];
      if (values.length < 1) errors[at('values')] = 'tooFew';
      else if (values.length > MAX_FILTER_VALUES) errors[at('values')] = 'tooMany';
      else if (values.some((v) => typeof v !== 'string' || v.trim() === '')) errors[at('values')] = 'invalidValue';
      else if (values.some((v) => v.length > FILTER_STRING_MAX)) errors[at('values')] = 'tooLong';
      else if (valueType === 'number' && values.some((v) => !Number.isFinite(Number(v)))) errors[at('values')] = 'invalidValue';
    }
  });
  return errors;
}

/** The key filter errors of one key filter of a filter's errors (`keyFilters.<index>.` stripped). */
export function keyFilterErrorsAt(errors: BoardFilterErrors | undefined, index: number): KeyFilterErrors {
  const out: KeyFilterErrors = {};
  if (!errors) return out;
  const prefix = `keyFilters.${index}.`;
  for (const [field, code] of Object.entries(errors)) {
    if (field.startsWith(prefix) && code) out[field.slice(prefix.length) as KeyFilterErrorField] = code;
  }
  return out;
}

/** Every error of one filter, keyed by field (`key`, `name`, `filters`, `keyFilters`, `keyFilters.<n>.*`). */
export function validateBoardFilter(filter: BoardFilter, { existingKeys, existingNames, params }: ValidateBoardFilterOptions): BoardFilterErrors {
  const errors: BoardFilterErrors = {};

  const key = typeof filter.key === 'string' ? filter.key : '';
  if (!key) errors.key = 'required';
  else if (RESERVED_ALIAS_KEYS.includes(key)) errors.key = 'reserved';
  else if (!ALIAS_KEY_PATTERN.test(key)) errors.key = 'pattern';
  else if (existingKeys.includes(key)) errors.key = 'duplicate';

  if (existingKeys.length >= MAX_BOARD_FILTERS) errors.filters = 'tooMany';

  const name = typeof filter.name === 'string' ? filter.name.trim() : '';
  if (!name) errors.name = 'required';
  else if (name.length > BOARD_FILTER_NAME_MAX) errors.name = 'tooLong';
  else if (existingNames?.some((n) => n.trim().toLowerCase() === name.toLowerCase())) errors.name = 'duplicate';

  const keyFilters = Array.isArray(filter.keyFilters) ? filter.keyFilters : [];
  if (keyFilters.length < 1) errors.keyFilters = 'tooFew';
  else if (keyFilters.length > MAX_KEY_FILTERS) errors.keyFilters = 'tooMany';

  keyFilters.forEach((kf, i) => {
    for (const [field, code] of Object.entries(validateKeyFilter(kf, { params }))) {
      errors[`keyFilters.${i}.${field as KeyFilterErrorField}` as const] = code;
    }
  });
  return errors;
}

export interface BoardFilterListErrors {
  /** `tooMany` when the list is longer than `MAX_BOARD_FILTERS`. */
  filters?: FilterErrorCode;
  /** One entry per filter, in order (a filter's own errors, its key and name checked against every other filter). */
  byIndex: BoardFilterErrors[];
  valid: boolean;
}

/** The whole list, as the filters dialog saves it. */
export function validateBoardFilters(
  filters: readonly BoardFilter[],
  { params }: { params: readonly BoardParamInfo[] },
): BoardFilterListErrors {
  const byIndex = filters.map((filter, i) => {
    const others = filters.filter((_, j) => j !== i);
    const errors = validateBoardFilter(filter, {
      existingKeys: others.map((f) => f.key),
      existingNames: others.map((f) => f.name),
      params,
    });
    delete errors.filters;
    return errors;
  });
  const tooMany = filters.length > MAX_BOARD_FILTERS;
  return {
    ...(tooMany ? { filters: 'tooMany' as const } : {}),
    byIndex,
    valid: !tooMany && byIndex.every((e) => Object.keys(e).length === 0),
  };
}
