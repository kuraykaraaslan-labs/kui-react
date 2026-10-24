// A filter as one readable line (ThingsBoard's filter-text): "temperature (latest) > 30 and status (attribute) = 'ACTIVE'",
// "name starts with 'Pump' (ignore case)", "temperature (latest) > the dashboard's limit". Pure: no React. The wording
// lives in the messages (`textKey`, `textOps`, `textPredicate`, `textJoin` …), so a host translates it there.

import { isParamValue, predicateShape } from './key-filters';
import { mergeAliasMessages, type EntityAliasesMessages, type EntityAliasesMessagesInput } from './messages';
import type { BoardFilter, BoardParamInfo, FilterValue, KeyFilter, KeyFilterPredicate, KeyFilterValueType } from './types';

export interface BoardFilterTextOptions {
  /** Gives `{ $param }` values their labels ("the dashboard's limit"); the key is shown otherwise. */
  params: readonly BoardParamInfo[];
  messages?: EntityAliasesMessagesInput;
  /** Formats a date-time value (ISO text). The default is locale-free: `2026-10-24 10:30 UTC`. */
  formatDateTime?: (iso: string) => string;
}

const ISO = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** `2026-10-24T10:30:00.000Z` → `2026-10-24 10:30 UTC`; a text that is not ISO is shown as it is. */
export function defaultFormatDateTime(iso: string): string {
  const match = ISO.exec(iso);
  if (!match) return iso;
  const [, date, time, zone] = match;
  return `${date} ${time}${zone === 'Z' ? ' UTC' : zone ? ` ${zone}` : ''}`;
}

function valueText(
  value: FilterValue | undefined,
  valueType: KeyFilterValueType,
  m: EntityAliasesMessages,
  options: BoardFilterTextOptions,
): string {
  if (value === undefined || value === null || value === '') return m.textMissing;
  if (isParamValue(value)) return m.textParamValue(options.params.find((p) => p.key === value.$param)?.label ?? value.$param);
  if (typeof value === 'boolean') return value ? m.textTrue : m.textFalse;
  if (valueType === 'datetime' && typeof value === 'string') return (options.formatDateTime ?? defaultFormatDateTime)(value);
  if (valueType === 'string' || typeof value === 'string') return `'${value}'`;
  return String(value);
}

function predicateText(
  keyFilter: KeyFilter,
  p: KeyFilterPredicate,
  m: EntityAliasesMessages,
  options: BoardFilterTextOptions,
): string {
  const name = keyFilter.key?.name?.trim() || m.textMissing;
  const key = m.textKey(name, keyFilter.key?.type, keyFilter.key?.scope);
  const shape = predicateShape(p.op);
  const parts = { key, op: p.op, opText: m.textOps[p.op] ?? p.op, ignoreCase: !!p.ignoreCase && keyFilter.valueType === 'string' };
  if (shape === 'none') return m.textPredicate(parts);
  if (shape === 'list') {
    const values = (p.values ?? []).map((v) => (keyFilter.valueType === 'string' ? `'${v}'` : v));
    return m.textPredicate({ ...parts, values: values.length ? values : [m.textMissing] });
  }
  const value = valueText(p.value, keyFilter.valueType, m, options);
  if (shape === 'range') return m.textPredicate({ ...parts, value, to: valueText(p.to, keyFilter.valueType, m, options) });
  return m.textPredicate({ ...parts, value });
}

/**
 * One key filter as text: its conditions joined by its operation. `inGroup` wraps an "or" of several conditions in
 * parentheses, as when it is one of several key filters (they are joined by "and").
 */
export function keyFilterText(keyFilter: KeyFilter, options: BoardFilterTextOptions & { inGroup?: boolean }): string {
  const m = mergeAliasMessages(options.messages);
  const predicates = keyFilter.predicates ?? [];
  if (predicates.length === 0) {
    const name = keyFilter.key?.name?.trim() || m.textMissing;
    return m.textKey(name, keyFilter.key?.type, keyFilter.key?.scope);
  }
  const joined = predicates.map((p) => predicateText(keyFilter, p, m, options)).join(` ${m.textJoin[keyFilter.operation] ?? keyFilter.operation} `);
  return options.inGroup && keyFilter.operation === 'or' && predicates.length > 1 ? `(${joined})` : joined;
}

/** The whole filter as one line: the key filters joined by "and"; "No filter specified" without any. */
export function boardFilterText(filter: Pick<BoardFilter, 'keyFilters'> | null | undefined, options: BoardFilterTextOptions): string {
  const m = mergeAliasMessages(options.messages);
  const keyFilters = filter?.keyFilters ?? [];
  if (keyFilters.length === 0) return m.noKeyFilterText;
  const inGroup = keyFilters.length > 1;
  return keyFilters.map((kf) => keyFilterText(kf, { ...options, messages: m, inGroup })).join(` ${m.textJoin.and} `);
}
