import type { ParamChoices, ParamPrimitive, ParamSpec } from '../catalog/types';

/** Pure helpers behind the param form: value conversions that need no React. */

export type DurationUnit = 'ms' | 's' | 'min' | 'h';

export const DURATION_UNITS: { unit: DurationUnit; ms: number }[] = [
  { unit: 'ms', ms: 1 },
  { unit: 's', ms: 1000 },
  { unit: 'min', ms: 60_000 },
  { unit: 'h', ms: 3_600_000 },
];

/** A duration in milliseconds as an amount and the largest unit that divides it evenly. */
export function splitDuration(ms: number): { amount: number; unit: DurationUnit } {
  if (!Number.isFinite(ms) || ms === 0) return { amount: Number.isFinite(ms) ? ms : 0, unit: 'ms' };
  for (const { unit, ms: size } of [...DURATION_UNITS].reverse()) {
    if (ms % size === 0) return { amount: ms / size, unit };
  }
  return { amount: ms, unit: 'ms' };
}

export function toMs(amount: number, unit: DurationUnit): number {
  return Math.round(amount * (DURATION_UNITS.find((u) => u.unit === unit)?.ms ?? 1));
}

/** Comma separated text to a list of trimmed, non-empty entries. */
export function splitList(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter(Boolean);
}

export function joinList(list: unknown): string {
  return Array.isArray(list) ? list.map(String).join(', ') : '';
}

export type JsonDraft = { ok: true; value: unknown } | { ok: false; error: string };

/** Text typed into a JSON field: the parsed value, or why it does not parse. Empty text is no value. */
export function parseJsonDraft(text: string): JsonDraft {
  if (!text.trim()) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

/** Number field text to a value: undefined for empty text, null when it is not a number. */
export function numberFromText(text: string): number | undefined | null {
  if (!text.trim()) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export const VALUE_KINDS = ['num', 'str', 'bool', 'json', 'path', 'expr', 'env', 'now'] as const;
export type ValueKind = (typeof VALUE_KINDS)[number];

export const VALUE_KIND_LABELS: Record<ValueKind, string> = {
  num: 'Number', str: 'Text', bool: 'Yes / no', json: 'JSON', path: 'Variable', expr: 'Expression', env: 'Environment variable', now: 'Current time',
};

export type ValueParam = { kind: ValueKind; v?: unknown };

export function isValueParam(value: unknown): value is ValueParam {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { kind?: unknown }).kind === 'string';
}

/** The `{ kind, v }` a value field starts with when the kind changes. */
export function valueOfKind(kind: ValueKind): ValueParam {
  switch (kind) {
    case 'num': return { kind, v: 0 };
    case 'bool': return { kind, v: true };
    case 'now': return { kind };
    case 'path': return { kind, v: 'msg.payload' };
    default: return { kind, v: '' };
  }
}

/** A copy of values with one key set; undefined removes the key. */
export function setField(values: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const next = { ...values };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/** A new row of a rules field: for every field the first option, or the default. */
export function newRuleRow(items: Record<string, ParamSpec>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(items)) {
    if (spec.type === 'enum' && spec.options?.length) row[key] = spec.options[0];
    else if (spec.default !== undefined) row[key] = JSON.parse(JSON.stringify(spec.default));
  }
  return row;
}

export const DEFAULT_MAX_ROWS = 16;

/** The sub-schema of a rules field (an object of fields), or empty when `items` is a single spec. */
export function rowSchema(spec: Pick<ParamSpec, 'items'>): Record<string, ParamSpec> {
  const items = spec.items;
  if (!items || typeof (items as ParamSpec).type === 'string') return {};
  return items as Record<string, ParamSpec>;
}

/** The spec of one item of a list field, if `items` is a single spec. */
export function itemSpec(spec: Pick<ParamSpec, 'items'>): ParamSpec | null {
  const items = spec.items;
  return items && typeof (items as ParamSpec).type === 'string' ? (items as ParamSpec) : null;
}

/** Add the value to a list, or take it out when it is in. */
export function toggleIn<T extends ParamPrimitive>(list: unknown, value: T): T[] {
  const current = Array.isArray(list) ? (list as T[]) : [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export type Choice = { value: ParamPrimitive; label: string };

/** The choices a source or list field offers: the host-provided list, or the options of an enum item. */
export function choicesOf(spec: ParamSpec, choices: ParamChoices | undefined): Choice[] {
  if (spec.source) return choices?.[spec.source] ?? [];
  const item = itemSpec(spec);
  if (item?.source) return choices?.[item.source] ?? [];
  const options = item?.options ?? spec.options ?? [];
  return options.map((value) => ({ value, label: String(item?.option_labels?.[String(value)] ?? spec.option_labels?.[String(value)] ?? value) }));
}

/** A saved value that the current choices no longer offer (shown as "not available now"). */
export function isMissingChoice(value: unknown, choices: Choice[]): boolean {
  if (value === undefined || value === null || value === '') return false;
  return !choices.some((c) => c.value == value);
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Fields that read better in a monospace face. */
export const MONO_TYPES = new Set(['cron', 'topic', 'hex', 'ip', 'mac', 'path', 'expr', 'template']);

function scriptKey(schema: Record<string, ParamSpec> | undefined): string | undefined {
  return Object.entries(schema ?? {}).find(([, spec]) => spec.store === 'script')?.[0];
}

/** The values a form starts with: the params of a node, plus its script under the key of the param that is stored in `script`. */
export function formValues(schema: Record<string, ParamSpec> | undefined, config: Record<string, unknown> | undefined, script: string | undefined): Record<string, unknown> {
  const values = { ...config };
  const key = scriptKey(schema);
  if (key) values[key] = script ?? (typeof schema?.[key].default === 'string' ? schema[key].default : '');
  return values;
}

/** The reverse: the values of a form back to the params of a node and its script. */
export function splitFormValues(schema: Record<string, ParamSpec> | undefined, values: Record<string, unknown>): { config: Record<string, unknown>; script: string | undefined } {
  const config = { ...values };
  const key = scriptKey(schema);
  if (!key) return { config, script: undefined };
  const value = config[key];
  delete config[key];
  return { config, script: typeof value === 'string' ? value : undefined };
}

/** The default of the param stored in `script`, to put back on "reset"; undefined when there is none. */
export function defaultScriptOf(schema: Record<string, ParamSpec> | undefined): string | undefined {
  const key = scriptKey(schema);
  const value = key ? schema?.[key].default : undefined;
  return typeof value === 'string' ? value : undefined;
}
