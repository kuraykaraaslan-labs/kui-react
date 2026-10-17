import { isVisible, optionLabel, paramLabel } from './params';
import type { ParamPrimitive, ParamSpec, ParamType } from './types';

/**
 * `blocks.d` declaration fields (the editor's `ParamSpec`) to the `FieldSchema` vocabulary of `SchemaForm` (OD-16,
 * kui-react docs/phases/09 §9.10), and back. Pure, no imports outside the catalog, so a host can vendor the catalog
 * without `SchemaForm`.
 *
 * | `blocks.d` type                 | field `type`                    | notes                                                        |
 * |---------------------------------|---------------------------------|--------------------------------------------------------------|
 * | `string`                        | `text`                          | `pattern`, `max_len` → `pattern`, `maxLength`                 |
 * | `text`                          | `textarea`                      |                                                              |
 * | `number`                        | `number`                        | `min`, `max`, `step`; `int` → `step: 1`                       |
 * | `bool` / `enum`                 | `boolean` / `select`            | options as `{ label, value }` from `option_labels`            |
 * | `list`                          | `multi-select` or `repeater`    | multi-select for enum items or a `source`; else free values   |
 * | `json`                          | `json`                          |                                                              |
 * | `secret`                        | `text` + `secret: true`         | masked, write-only; never a `value`                          |
 * | `duration`                      | `number` + `unit` (`ms`)        |                                                              |
 * | `time`                          | `text` + `HH:MM` pattern        | `override: 'time'`                                           |
 * | `weekdays`                      | `multi-select` of 1…7           |                                                              |
 * | `cron`                          | `text`                          | `override: 'cron'` (a next-run preview)                      |
 * | `ip`, `mac`, `hex`, `topic`     | `text` + a pattern              |                                                              |
 * | `template`, `expr`, `code`      | `textarea`                      | `override` (a live parse, the code editor)                   |
 * | `path`, `value`                 | `text`, `json`                  | `override` (the editor renders them)                         |
 * | `rules`                         | `repeater`, `fields` = one row  | `override: 'rules'`                                          |
 * | `source`, `ref`                 | `remote-select`                 | `override`; the host sets `endpoint`                         |
 *
 * `when` → `showIf`: a `{ param, value }` condition becomes `showIf: { [param]: [...] }` with the loose matches of
 * `isVisible` spelled out (`1` and `"1"`; `undefined` when the other param's default matches, as `isVisible` falls
 * back to it). `{ param, not }` has no `showIf` form: the field gets none and keeps `when` (FieldSchema has no
 * negation yet), so a SchemaForm host checks `isBlocksFieldVisible`.
 */

/** the FieldSchema types this mapping produces (a subset of `FieldType`) */
export type BlocksFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'multi-select' | 'repeater' | 'json' | 'remote-select';

/** the `blocks.d` types a host renders itself (a `fieldOverrides` entry); the generated field is the fallback */
export type BlocksFieldOverride = Extract<ParamType, 'time' | 'cron' | 'template' | 'expr' | 'code' | 'path' | 'value' | 'rules' | 'source' | 'ref'>;

/**
 * A `FieldSchema` (assignable to it) plus the words FieldSchema does not have yet (`secret`, `unit`, `pattern`,
 * `override`) and `param`: the declaration keys FieldSchema cannot carry, which `toParamSpec` reads back.
 */
export interface BlocksField {
  label: string;
  type: BlocksFieldType;
  value?: unknown;
  options?: { label: string; value: string }[];
  description?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  showIf?: Record<string, unknown[]>;
  fields?: Record<string, BlocksField>;
  maxLength?: number;
  multiple?: boolean;
  /** FieldSchema addition (9.10): masked and write-only */
  secret?: boolean;
  /** FieldSchema addition (9.10): the unit of a number (`ms` for a duration) */
  unit?: string;
  /** FieldSchema addition: the value must match this regular expression */
  pattern?: string;
  /** the host renders this field itself (its `fieldOverrides` key) */
  override?: BlocksFieldOverride;
  /** the declaration minus what the field itself carries; `toParamSpec` reads it back */
  param: Omit<ParamSpec, MappedKey | 'items'> & { items?: ParamSpec | Record<string, ParamSpec> };
}

/** the declaration keys a field carries exactly (and `toParamSpec` reads from the field) */
type MappedKey = 'hint' | 'default' | 'required' | 'min' | 'max' | 'max_len' | 'multiple';

const PATTERNS: Partial<Record<ParamType, string>> = {
  time: '^([01]\\d|2[0-3]):[0-5]\\d$',
  ip: '^((25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1?\\d?\\d)$',
  mac: '^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$',
  hex: '^(0x)?[0-9A-Fa-f]*$',
  topic: '^[^\\s]+$',
};

const OVERRIDES = new Set<ParamType>(['time', 'cron', 'template', 'expr', 'code', 'path', 'value', 'rules', 'source', 'ref']);

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** the FieldSchema type of a declaration */
export function blocksFieldType(spec: Pick<ParamSpec, 'type' | 'items' | 'source'>): BlocksFieldType {
  switch (spec.type) {
    case 'text': case 'template': case 'expr': case 'code': return 'textarea';
    case 'number': case 'duration': return 'number';
    case 'bool': return 'boolean';
    case 'enum': return 'select';
    case 'weekdays': return 'multi-select';
    case 'json': case 'value': return 'json';
    case 'rules': return 'repeater';
    case 'source': case 'ref': return 'remote-select';
    case 'list': {
      const item = spec.items as ParamSpec | undefined;
      return spec.source || (item && typeof item.type === 'string' && (item.type === 'enum' || item.type === 'source')) ? 'multi-select' : 'repeater';
    }
    default: return 'text';
  }
}

/** the values `shouldShow` must accept where `isVisible`'s loose `==` would */
function looseForms(v: ParamPrimitive): unknown[] {
  // null and undefined are decided by the default (`isVisible` reads `value ?? default`), see whenToShowIf
  if (v === null) return [];
  const asNumber = (n: number): unknown[] => [n, String(n), ...(n === 1 ? [true] : n === 0 ? [false, ''] : [])];
  if (typeof v === 'number') return asNumber(v);
  if (typeof v === 'boolean') return v ? [true, 1, '1'] : [false, 0, '0', ''];
  if (v === '') return ['', 0, false];
  return v.trim() !== '' && Number.isFinite(Number(v)) ? [v, ...asNumber(Number(v))] : [v];
}

/**
 * The `showIf` of a declaration's `when`, or undefined (no `when`, or a `not` condition). `params` is the block's whole
 * schema: when the other param's default satisfies the condition, an unset value (`undefined`) shows the field too.
 */
export function whenToShowIf(spec: Pick<ParamSpec, 'when'>, params?: Record<string, ParamSpec>): Record<string, unknown[]> | undefined {
  const when = spec.when;
  if (!when || when.param == null || when.value === undefined || Array.isArray(when.not)) return undefined;
  const wanted = Array.isArray(when.value) ? when.value : [when.value];
  const forms = [...new Set(wanted.flatMap(looseForms))];
  if (isVisible(spec, {}, params)) forms.push(undefined, null);
  return { [when.param]: forms };
}

/** Is a generated field shown for these values: its `showIf`, else the `when` it kept (a `not` condition). */
export function isBlocksFieldVisible(field: Pick<BlocksField, 'showIf' | 'param'>, values: Record<string, unknown>, params?: Record<string, ParamSpec>): boolean {
  if (field.showIf) return Object.entries(field.showIf).every(([k, v]) => v.includes(values[k]));
  return isVisible(field.param, values, params);
}

/**
 * One declaration field to a FieldSchema field. `key` names the param (the label falls back to it); `params` is the
 * block's whole schema, for `when` defaults. Does not change its input.
 */
export function fromBlocksField(key: string, spec: ParamSpec, params?: Record<string, ParamSpec>): BlocksField {
  const { hint, default: def, required, min, max, max_len, multiple, items, ...rest } = spec;
  const type = blocksFieldType(spec);
  const field: BlocksField = { label: paramLabel(key, spec), type, param: { ...rest } };
  if (hint !== undefined) field.description = hint;
  if (def !== undefined && spec.type !== 'secret') field.value = def;
  if (required !== undefined) field.required = required;
  if (min !== undefined) field.min = min;
  if (max !== undefined) field.max = max;
  if (max_len !== undefined) field.maxLength = max_len;
  if (multiple !== undefined) field.multiple = multiple;

  const step = spec.step ?? (spec.int ? 1 : undefined);
  if (step !== undefined) field.step = step;
  if (spec.type === 'secret') field.secret = true;
  if (spec.type === 'duration') field.unit = spec.unit ?? 'ms';
  else if (spec.unit !== undefined) field.unit = spec.unit;
  const pattern = spec.pattern ?? PATTERNS[spec.type];
  if (pattern !== undefined) field.pattern = pattern;
  if (OVERRIDES.has(spec.type)) field.override = spec.type as BlocksFieldOverride;

  if (spec.options) field.options = spec.options.map((o) => ({ label: optionLabel(spec, o), value: String(o) }));
  else if (spec.type === 'weekdays') field.options = WEEKDAYS.map((label, i) => ({ label, value: String(i + 1) }));
  else if (spec.type === 'list' && items && typeof (items as ParamSpec).type === 'string' && (items as ParamSpec).options) {
    const item = items as ParamSpec;
    field.options = (item.options ?? []).map((o) => ({ label: optionLabel(item, o), value: String(o) }));
  }

  if (items !== undefined) {
    if (spec.type === 'rules' && typeof (items as ParamSpec).type !== 'string') {
      const row = items as Record<string, ParamSpec>;
      field.fields = Object.fromEntries(Object.entries(row).map(([k, s]) => [k, fromBlocksField(k, s, row)]));
    } else {
      field.param.items = items;
    }
  }

  const showIf = whenToShowIf(spec, params);
  if (showIf) field.showIf = showIf;
  return field;
}

/** Every param of a block to fields, keyed like the params. */
export function fromBlocksFields(params: Record<string, ParamSpec> = {}): Record<string, BlocksField> {
  return Object.fromEntries(Object.entries(params).map(([k, s]) => [k, fromBlocksField(k, s, params)]));
}

/**
 * A generated field back to its declaration: `fromBlocksField` then `toParamSpec` gives the declaration it started
 * from. The keys a field carries exactly (`description`, `value`, `required`, `min`, `max`, `maxLength`, `multiple`,
 * a rules row's `fields`) are read from the field, so a host that edits them gets them back.
 */
export function toParamSpec(field: BlocksField): ParamSpec {
  const out: ParamSpec = { ...(field.param as ParamSpec) };
  if (field.description !== undefined) out.hint = field.description;
  if (field.value !== undefined && out.type !== 'secret') out.default = field.value;
  if (field.required !== undefined) out.required = field.required;
  if (field.min !== undefined) out.min = field.min;
  if (field.max !== undefined) out.max = field.max;
  if (field.maxLength !== undefined) out.max_len = field.maxLength;
  if (field.multiple !== undefined) out.multiple = field.multiple;
  if (out.type === 'rules' && field.fields) out.items = Object.fromEntries(Object.entries(field.fields).map(([k, f]) => [k, toParamSpec(f)]));
  return out;
}
