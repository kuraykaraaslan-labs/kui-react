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
 * rows cannot draw (another field type, choices with commas or `=`) stays in JSON. Fields a row does not draw (description, step,
 * placeholder, default, group) are kept as they were. The checks run before anything is sent and are shown on the field they are about.
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
  max: string;
  /** Choices, comma separated: `value` or `value=Label`. */
  options: string;
  rest: Partial<FieldSchema>;
};

export type RpcParamIssue = 'name_invalid' | 'name_duplicate' | 'label_required' | 'options_required' | 'range_invalid';

/** A parameter name the host takes (NB `iot_rpc` PARAM_KEY). */
export const RPC_PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

const DRAWN = new Set(['label', 'type', 'required', 'min', 'max', 'options']);

export const blankParamRow = (): RpcParamRow => ({ name: '', label: '', type: 'text', required: false, min: '', max: '', options: '', rest: {} });

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
    const options = (f.options ?? []).map(optionText);
    if (options.some((o) => o === null)) return null;
    const rest = Object.fromEntries(Object.entries(f).filter(([k]) => !DRAWN.has(k))) as Partial<FieldSchema>;
    rows.push({
      name, label: f.label ?? '', type: f.type as RpcParamType, required: !!f.required,
      min: typeof f.min === 'number' ? String(f.min) : '', max: typeof f.max === 'number' ? String(f.max) : '',
      options: (options as string[]).join(', '), rest,
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
    const f: FieldSchema = { ...(r.rest as FieldSchema), label: r.label.trim(), type: r.type };
    if (r.required) f.required = true;
    if (r.type === 'number') {
      const min = numberOf(r.min);
      const max = numberOf(r.max);
      if (min !== undefined) f.min = min;
      if (max !== undefined) f.max = max;
    }
    if (r.type === 'select') f.options = parseOptions(r.options);
    out[r.name.trim()] = f;
  }
  return out;
}

/** What is wrong with each row, by field (`name`, `label`, `options`, `range`); an empty object = every row is fine. */
export function paramRowIssues(rows: readonly RpcParamRow[]): Record<number, Partial<Record<'name' | 'label' | 'options' | 'range', RpcParamIssue>>> {
  const out: Record<number, Partial<Record<'name' | 'label' | 'options' | 'range', RpcParamIssue>>> = {};
  const names = rows.map((r) => r.name.trim());
  rows.forEach((r, i) => {
    const issues: Partial<Record<'name' | 'label' | 'options' | 'range', RpcParamIssue>> = {};
    if (!RPC_PARAM_NAME_RE.test(names[i])) issues.name = 'name_invalid';
    else if (names.indexOf(names[i]) !== i) issues.name = 'name_duplicate';
    if (!r.label.trim()) issues.label = 'label_required';
    if (r.type === 'select' && parseOptions(r.options).length === 0) issues.options = 'options_required';
    if (r.type === 'number') {
      const min = numberOf(r.min);
      const max = numberOf(r.max);
      if ((r.min.trim() && min === undefined) || (r.max.trim() && max === undefined) || (min !== undefined && max !== undefined && min > max)) issues.range = 'range_invalid';
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
            {r.type === 'select' && (
              <Input id={`${id}-options-${i}`} label={m.rpcCatalog.paramOptions} hint={m.rpcCatalog.paramOptionsHint} className="@md:col-span-2"
                value={r.options} error={word(issues[i]?.options)} disabled={disabled} onChange={(e) => set(i, { options: e.target.value })} />
            )}
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
