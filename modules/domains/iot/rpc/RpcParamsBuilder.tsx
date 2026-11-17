'use client';
import { useId } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import type { FieldOption, FieldSchema } from '@/modules/app/SchemaForm/types';
import { useIotText } from '../api/IotAdapterProvider';
import type { RpcCommandInput } from '../types/rpc';

/**
 * RpcParamsBuilder — a command's parameters as rows (name, label, type, required; the range of a number, the choices of a select)
 * instead of a JSON box (NB phase 39 UX-19). It writes the same `paramsSchema` (`FieldSchema` by name) the JSON did; a schema the
 * rows cannot draw (another field type, choices with commas or `=`) stays in JSON. A text parameter's longest length (`max`, which the
 * host checks on every send) is drawn too. Fields a row does not draw for its type (description, step, placeholder, group, a text's
 * `min`) are kept as they were. The checks run before anything is sent and are shown on the field they are about.
 *
 * NB rpc-wire-method: each row has its **Value** (the field's `value`), what the command sends for it from the device page, where a
 * catalog command is sent with one button; a required parameter without a value is the only thing the device page asks for.
 */
export const RPC_PARAM_TYPES = ['text', 'number', 'boolean', 'select', 'json'] as const;
export type RpcParamType = (typeof RPC_PARAM_TYPES)[number];

/** One parameter as the builder edits it; `rest` is what the row does not draw, written back unchanged. */
export type RpcParamRow = {
  name: string;
  label: string;
  type: RpcParamType;
  required: boolean;
  min: string;
  /** A number's largest value, a text's longest length. */
  max: string;
  /** Choices, comma separated: `value` or `value=Label`. */
  options: string;
  /** The value the command sends (`FieldSchema.value`) as typed: a number's digits, `true` / `false`, a choice's value, JSON; empty = none. */
  value: string;
  rest: Partial<FieldSchema>;
};

export type RpcParamIssue = 'name_invalid' | 'name_duplicate' | 'label_required' | 'options_required' | 'range_invalid' | 'length_invalid' | 'value_invalid';

/** A parameter name the host takes (NB `iot_rpc` PARAM_KEY). */
export const RPC_PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** The schema fields a row draws for a type (the rest of the field is kept in `rest` as it was). */
const DRAWN: Record<RpcParamType, readonly string[]> = {
  text: ['label', 'type', 'required', 'max', 'value'],
  number: ['label', 'type', 'required', 'min', 'max', 'value'],
  boolean: ['label', 'type', 'required', 'value'],
  select: ['label', 'type', 'required', 'options', 'value'],
  json: ['label', 'type', 'required', 'value'],
};

export const blankParamRow = (): RpcParamRow => ({ name: '', label: '', type: 'text', required: false, min: '', max: '', options: '', value: '', rest: {} });

/** A stored value as the row's text (`valueOf` reads it back). */
function valueText(type: RpcParamType, v: unknown): string {
  if (v === undefined || v === null) return '';
  if (type === 'json') return JSON.stringify(v);
  if (type === 'boolean') return v === true ? 'true' : v === false ? 'false' : '';
  return typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v);
}

/** The value a row's text stands for: `undefined` when empty, `null` when it does not read for the row's type. */
function valueOf(r: Pick<RpcParamRow, 'type' | 'value'>): unknown {
  const raw = r.value;
  if (raw.trim() === '') return undefined;
  switch (r.type) {
    case 'number': return Number.isFinite(Number(raw)) ? Number(raw) : null;
    case 'boolean': return raw === 'true' ? true : raw === 'false' ? false : null;
    case 'json': try { return JSON.parse(raw) as unknown; } catch { return null; }
    default: return raw;
  }
}

function optionText(o: FieldOption): string | null {
  const value = typeof o === 'string' ? o : o.value;
  const label = typeof o === 'string' ? o : o.label;
  if (/[,=]/.test(value) || /,/.test(label)) return null;
  return label === value ? value : `${value}=${label}`;
}

/** The rows of a schema, or null when the rows cannot draw it (edit it as JSON). */
export function paramRowsOf(schema: RpcCommandInput['paramsSchema'] | null | undefined): RpcParamRow[] | null {
  const rows: RpcParamRow[] = [];
  for (const [name, f] of Object.entries(schema ?? {})) {
    if (!f || typeof f !== 'object' || !(RPC_PARAM_TYPES as readonly string[]).includes(f.type)) return null;
    const type = f.type as RpcParamType;
    const drawn = DRAWN[type];
    const options = type === 'select' ? (f.options ?? []).map(optionText) : [];
    if (options.some((o) => o === null)) return null;
    const rest = Object.fromEntries(Object.entries(f).filter(([k]) => !drawn.includes(k))) as Partial<FieldSchema>;
    rows.push({
      name, label: f.label ?? '', type, required: !!f.required,
      min: drawn.includes('min') && typeof f.min === 'number' ? String(f.min) : '',
      max: drawn.includes('max') && typeof f.max === 'number' ? String(f.max) : '',
      options: (options as string[]).join(', '), value: valueText(type, f.value), rest,
    });
  }
  return rows;
}

function parseOptions(raw: string): FieldOption[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const at = s.indexOf('=');
    if (at < 0) return s;
    const value = s.slice(0, at).trim();
    const label = s.slice(at + 1).trim();
    return label && label !== value ? { value, label } : value;
  });
}
const numberOf = (raw: string): number | undefined => (raw.trim() === '' || !Number.isFinite(Number(raw)) ? undefined : Number(raw));

/** The schema the rows describe (what the catalog stores). */
export function paramsSchemaOf(rows: readonly RpcParamRow[]): RpcCommandInput['paramsSchema'] {
  const out: RpcCommandInput['paramsSchema'] = {};
  for (const r of rows) {
    // what the row draws for its type comes from the row (a field kept from another type gives way to it)
    const kept = Object.fromEntries(Object.entries(r.rest).filter(([k]) => !DRAWN[r.type].includes(k)));
    const f: FieldSchema = { ...(kept as Partial<FieldSchema>), label: r.label.trim(), type: r.type };
    if (r.required) f.required = true;
    if (r.type === 'number') {
      const min = numberOf(r.min);
      if (min !== undefined) f.min = min;
    }
    if (r.type === 'number' || r.type === 'text') {
      const max = numberOf(r.max);
      if (max !== undefined) f.max = max;
    }
    if (r.type === 'select') f.options = parseOptions(r.options);
    const value = valueOf(r);
    if (value !== undefined && value !== null) f.value = value as FieldSchema['value'];
    out[r.name.trim()] = f;
  }
  return out;
}

/** What is wrong with each row, by field (`name`, `label`, `options`, `range`); an empty object = every row is fine. */
export function paramRowIssues(rows: readonly RpcParamRow[]): Record<number, Partial<Record<'name' | 'label' | 'options' | 'range' | 'value', RpcParamIssue>>> {
  const out: Record<number, Partial<Record<'name' | 'label' | 'options' | 'range' | 'value', RpcParamIssue>>> = {};
  const names = rows.map((r) => r.name.trim());
  rows.forEach((r, i) => {
    const issues: Partial<Record<'name' | 'label' | 'options' | 'range' | 'value', RpcParamIssue>> = {};
    if (!RPC_PARAM_NAME_RE.test(names[i])) issues.name = 'name_invalid';
    else if (names.indexOf(names[i]) !== i) issues.name = 'name_duplicate';
    if (!r.label.trim()) issues.label = 'label_required';
    if (r.type === 'select' && parseOptions(r.options).length === 0) issues.options = 'options_required';
    if (r.type === 'number') {
      const min = numberOf(r.min);
      const max = numberOf(r.max);
      if ((r.min.trim() && min === undefined) || (r.max.trim() && max === undefined) || (min !== undefined && max !== undefined && min > max)) issues.range = 'range_invalid';
    }
    if (r.type === 'text' && r.max.trim()) {
      const max = numberOf(r.max);
      if (max === undefined || !Number.isInteger(max) || max < 1) issues.range = 'length_invalid';
    }
    // the value reads for the type and fits what the host checks on a send (the range, the length, the choices)
    const value = valueOf(r);
    if (value === null) issues.value = 'value_invalid';
    else if (value !== undefined) {
      const min = numberOf(r.min);
      const max = numberOf(r.max);
      if (r.type === 'number' && ((min !== undefined && (value as number) < min) || (max !== undefined && (value as number) > max))) issues.value = 'value_invalid';
      if (r.type === 'text' && max !== undefined && (value as string).length > max) issues.value = 'value_invalid';
      if (r.type === 'select' && !parseOptions(r.options).some((o) => (typeof o === 'string' ? o : o.value) === value)) issues.value = 'value_invalid';
    }
    if (Object.keys(issues).length) out[i] = issues;
  });
  return out;
}

export type RpcParamsBuilderProps = {
  rows: RpcParamRow[];
  onChange: (rows: RpcParamRow[]) => void;
  /** Show the row checks (after the first save press). */
  showIssues?: boolean;
  disabled?: boolean;
};

export function RpcParamsBuilder({ rows, onChange, showIssues = false, disabled }: RpcParamsBuilderProps) {
  const { m } = useIotText();
  const id = useId();
  const issues = showIssues ? paramRowIssues(rows) : {};
  const set = (i: number, patch: Partial<RpcParamRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const word = (issue: RpcParamIssue | undefined) => (issue ? m.rpcCatalog[`param_${issue}`] : undefined);
  const typeOptions = RPC_PARAM_TYPES.map((t) => ({ value: t, label: m.rpcCatalog[`paramType_${t}`] }));

  return (
    <div className="@container space-y-2">
      {rows.length === 0 && <p className="text-xs text-text-secondary">{m.rpcCatalog.paramsNone}</p>}
      {rows.map((r, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-1 items-start gap-2 @md:grid-cols-2">
            <Input id={`${id}-name-${i}`} label={m.rpcCatalog.paramName} hint={m.rpcCatalog.paramNameHint} className="font-mono" maxLength={64}
              value={r.name} error={word(issues[i]?.name)} disabled={disabled} onChange={(e) => set(i, { name: e.target.value })} />
            <Input id={`${id}-label-${i}`} label={m.rpcCatalog.paramLabel} maxLength={120}
              value={r.label} error={word(issues[i]?.label)} disabled={disabled} onChange={(e) => set(i, { label: e.target.value })} />
            <Select id={`${id}-type-${i}`} label={m.rpcCatalog.paramType} value={r.type} options={typeOptions} disabled={disabled}
              onChange={(e) => set(i, { type: e.target.value as RpcParamType })} />
            <div className="flex items-end justify-between gap-2 @md:pt-6">
              <Checkbox id={`${id}-required-${i}`} label={m.rpcCatalog.paramRequired} checked={r.required} disabled={disabled}
                onChange={(e) => set(i, { required: e.target.checked })} />
              <Button variant="ghost" size="sm" disabled={disabled} aria-label={`${m.rpcCatalog.paramRemove} ${r.name || i + 1}`}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />
              </Button>
            </div>
            {r.type === 'number' && (
              <>
                <Input id={`${id}-min-${i}`} type="number" step="any" label={m.rpcCatalog.paramMin} value={r.min} disabled={disabled}
                  error={word(issues[i]?.range)} onChange={(e) => set(i, { min: e.target.value })} />
                <Input id={`${id}-max-${i}`} type="number" step="any" label={m.rpcCatalog.paramMax} value={r.max} disabled={disabled}
                  onChange={(e) => set(i, { max: e.target.value })} />
              </>
            )}
            {r.type === 'text' && (
              <Input id={`${id}-maxlength-${i}`} type="number" min={1} step={1} label={m.rpcCatalog.paramMaxLength} value={r.max} disabled={disabled}
                error={word(issues[i]?.range)} onChange={(e) => set(i, { max: e.target.value })} />
            )}
            {r.type === 'select' && (
              <Input id={`${id}-options-${i}`} label={m.rpcCatalog.paramOptions} hint={m.rpcCatalog.paramOptionsHint} className="@md:col-span-2"
                value={r.options} error={word(issues[i]?.options)} disabled={disabled} onChange={(e) => set(i, { options: e.target.value })} />
            )}
            <ParamValueField id={`${id}-value-${i}`} row={r} error={word(issues[i]?.value)} disabled={disabled} onChange={(value) => set(i, { value })} />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...rows, blankParamRow()])}
        iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
        {m.rpcCatalog.paramAdd}
      </Button>
    </div>
  );
}

/** A row's Value, drawn for its type: a yes / no and a choice are picked, the others typed. */
function ParamValueField({ id, row, error, disabled, onChange }: { id: string; row: RpcParamRow; error?: string; disabled?: boolean; onChange: (value: string) => void }) {
  const { m } = useIotText();
  const common = { id, label: m.rpcCatalog.paramValue, hint: m.rpcCatalog.paramValueHint, error, disabled, className: '@md:col-span-2' };
  if (row.type === 'boolean' || row.type === 'select') {
    const options = row.type === 'boolean'
      ? [{ value: 'true', label: m.rpcCatalog.paramValueOn }, { value: 'false', label: m.rpcCatalog.paramValueOff }]
      : parseOptions(row.options).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    return <Select {...common} value={row.value} options={[{ value: '', label: m.rpcCatalog.paramValueNone }, ...options]} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <Input {...common} type={row.type === 'number' ? 'number' : 'text'} step={row.type === 'number' ? 'any' : undefined}
      className={row.type === 'json' ? '@md:col-span-2 font-mono' : '@md:col-span-2'} value={row.value} onChange={(e) => onChange(e.target.value)} />
  );
}
