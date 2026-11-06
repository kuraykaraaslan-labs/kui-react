/*
 * The send panel's checks of a command's parameters, the same as the host's API makes them (NB `iot_rpc` checkParams, 41-ui-fixes/23
 * 1.19, C10), in the viewer's words: a required value, a flag, a number in its `min`..`max`, a text within its `max` length (the host reads
 * `max`, as here; the form's own `maxLength` only limits typing), a choice among the offered ones, any JSON; a field type the host does
 * not send is refused. A field with `variants` (NB K2: a `scada.set_value`'s value by the control it sets) is checked by the case for its
 * sibling's value, a case of `null` takes no value; a sibling value with no case keeps the field as declared. Pure.
 */
import type { FieldSchema } from '@/modules/app/SchemaForm/types';
import { fill } from '../format';
import type { IotMessages } from '../messages';

/** A field whose schema follows a sibling's value (the host's K2 `variants`). */
type VariantField = FieldSchema & { variants?: { by: string; cases: Record<string, FieldSchema | null> } };

/** The field a param is checked by: its case for the value `by` holds, `null` for a case that takes none, else the field itself. */
export function rpcVariantOf(f: FieldSchema, values: Record<string, unknown>): FieldSchema | null {
  const v = (f as VariantField).variants;
  if (!v) return f;
  const chosen = values[v.by];
  if (typeof chosen !== 'string' || !Object.hasOwn(v.cases, chosen)) return f;
  return v.cases[chosen] ?? null;
}

const optionValues = (f: FieldSchema): string[] => (f.options ?? []).map((o) => (typeof o === 'string' ? o : o.value));
const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * The value a field sends: what was typed, else the field's default the form shows (`value`), else `false` for an unticked flag (it reads
 * "off"). An empty optional value is not sent.
 */
function shown(f: FieldSchema, v: unknown): unknown {
  if (v !== undefined) return v;
  if (f.value !== undefined) return f.value;
  return f.type === 'boolean' ? false : undefined;
}

/** The params a send carries: every field's shown value, the empty optional ones left out. */
export function rpcParamsToSend(schema: Record<string, FieldSchema>, values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(schema)) {
    const v = shown(f, values[k]);
    if (!isEmpty(v)) out[k] = v;
  }
  return out;
}

/** The first problem of each field (`{ key: text }`; empty: none), as the host would refuse it. */
export function rpcParamProblems(schema: Record<string, FieldSchema>, values: Record<string, unknown>, m: Pick<IotMessages, 'rpc'>): Record<string, string> {
  const out: Record<string, string> = {};
  const sent = rpcParamsToSend(schema, values);
  for (const [k, declared] of Object.entries(schema)) {
    const f = rpcVariantOf(declared, sent);
    if (f === null) continue;
    const v = shown(f, values[k]);
    if (isEmpty(v)) {
      if (f.required) out[k] = fill(m.rpc.required, { label: f.label });
      continue;
    }
    const problem = fieldProblem(f, v, m);
    if (problem) out[k] = problem;
  }
  return out;
}

function fieldProblem(f: FieldSchema, v: unknown, m: Pick<IotMessages, 'rpc'>): string | null {
  switch (f.type) {
    case 'boolean':
      return typeof v === 'boolean' ? null : m.rpc.paramBoolean;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return m.rpc.paramNumber;
      if (f.min !== undefined && v < f.min) return fill(m.rpc.paramMin, { min: f.min });
      if (f.max !== undefined && v > f.max) return fill(m.rpc.paramMax, { max: f.max });
      return null;
    case 'select': {
      if (typeof v !== 'string') return m.rpc.paramText;
      const opts = optionValues(f);
      return opts.length && !opts.includes(v) ? m.rpc.paramOption : null;
    }
    case 'multi-select': {
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) return m.rpc.paramList;
      const opts = optionValues(f);
      return opts.length && v.some((x) => !opts.includes(x as string)) ? m.rpc.paramList : null;
    }
    case 'text':
    case 'textarea':
      if (typeof v !== 'string') return m.rpc.paramText;
      return f.max !== undefined && v.length > f.max ? fill(m.rpc.paramTooLong, { max: f.max }) : null;
    case 'json':
      return null;
    default:
      return m.rpc.paramUnsupported;
  }
}
