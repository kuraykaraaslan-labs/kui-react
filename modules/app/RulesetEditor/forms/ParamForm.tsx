'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { Toggle } from '@/modules/ui/Toggle';
import { Checkbox } from '@/modules/ui/Checkbox';
import { CodeEditor } from '@/modules/ui/CodeEditor';
import { isVisible, optionLabel, paramLabel, validateParams, type ParamValues } from '../catalog/params';
import type { ParamChoices, ParamSpec } from '../catalog/types';
import { useMessages } from '../RulesetEditor/messages';
import { SCRIPT_SIGNATURE, scriptHover, scriptSuggestions } from '../RulesetEditor/script/api';
import { lintScript, tidyScript } from '../RulesetEditor/script/lint';
import {
  choicesOf, DEFAULT_MAX_ROWS, DURATION_UNITS, isMissingChoice, isValueParam, itemSpec, joinList, MONO_TYPES, newRuleRow,
  numberFromText, parseJsonDraft, rowSchema, setField, splitDuration, splitList, toggleIn, toMs, valueOfKind, VALUE_KINDS,
  type DurationUnit, type ValueKind,
} from './field-utils';

type Change = (value: unknown) => void;

/** one value a text field suggests: the value, and an optional text the browser shows beside it */
export type ParamSuggestion = string | { value: string; label?: string };

/**
 * Where a field sits, for `ParamForm`'s `suggest`: `key` is the param (or, in a row of a `rules` field, the row's
 * field) and `spec` its declaration; `values` are the params of the form. In a row, `row` names the `rules` param, the
 * row's index and the row's own values (what another field of the same row holds).
 */
export type ParamSuggestField = {
  key: string;
  spec: ParamSpec;
  values: ParamValues;
  row?: { param: string; index: number; values: Record<string, unknown> };
};

/**
 * The host's suggestions for a text field, per field and per row: a list (empty: none) replaces the spec's own
 * `suggest`; `undefined` keeps it.
 */
export type ParamSuggest = (field: ParamSuggestField) => readonly ParamSuggestion[] | undefined;

type RowRef = NonNullable<ParamSuggestField['row']>;

type FieldProps = {
  id: string;
  name: string;
  spec: ParamSpec;
  value: unknown;
  onChange: Change;
  readOnly: boolean;
  choices?: ParamChoices;
  error?: string;
  /** the suggestions of a text field (the host's `suggest`, else the spec's) */
  suggestOf?: (key: string, spec: ParamSpec, row?: RowRef) => readonly ParamSuggestion[] | undefined;
  /** set for a field in a row of a `rules` field */
  row?: RowRef;
};

const MISSING = '__missing__';
const OTHER = '__other__';

function fieldLabel(name: string, spec: ParamSpec): string {
  const base = paramLabel(name, spec);
  return spec.unit ? `${base} (${spec.unit})` : base;
}

/** the group box used by fields made of several controls */
function Fieldset({ legend, hint, error, children, id }: { legend: string; hint?: string; error?: string; children: React.ReactNode; id: string }) {
  return (
    <fieldset aria-describedby={hint || error ? `${id}-note` : undefined} className="space-y-1.5">
      <legend className="text-sm font-medium text-text-primary">{legend}</legend>
      {children}
      {(hint || error) && <p id={`${id}-note`} className={cn('text-xs', error ? 'text-error' : 'text-text-secondary')}>{error ?? hint}</p>}
    </fieldset>
  );
}

function TextField({ id, name, spec, value, onChange, readOnly, error, suggestOf, row, type = 'text' }: FieldProps & { type?: string }) {
  const suggestions = (suggestOf ? suggestOf(name, spec, row) : spec.suggest) ?? [];
  const input = (
    <Input
      id={id} label={fieldLabel(name, spec)} type={type} value={value == null ? '' : String(value)} readOnly={readOnly}
      required={spec.required} hint={spec.hint} error={error} maxLength={spec.max_len}
      list={suggestions.length ? `${id}-suggest` : undefined}
      className={cn(MONO_TYPES.has(spec.type) && 'font-mono')}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
    />
  );
  if (!suggestions.length) return input;
  // one box, so the list adds no gap to the form's spacing
  return (
    <div>
      {input}
      <datalist id={`${id}-suggest`}>
        {suggestions.map((sug) => {
          const { value: v, label } = typeof sug === 'string' ? { value: sug, label: undefined } : sug;
          return <option key={v} value={v} label={label}>{label}</option>;
        })}
      </datalist>
    </div>
  );
}

function NumberField({ id, name, spec, value, onChange, readOnly, error }: FieldProps) {
  return (
    <Input
      id={id} label={fieldLabel(name, spec)} type="number" value={value == null ? '' : String(value)} readOnly={readOnly}
      required={spec.required} hint={spec.hint} error={error} min={spec.min} max={spec.max} step={spec.step ?? (spec.int ? 1 : 'any')}
      onChange={(e) => {
        const n = numberFromText(e.target.value);
        if (n !== null) onChange(n);
      }}
    />
  );
}

function JsonField({ id, name, spec, value, onChange, readOnly, error }: FieldProps) {
  const m = useMessages();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (value === undefined ? '' : JSON.stringify(value, null, 2));
  const parsed = draft === null ? null : parseJsonDraft(draft);
  return (
    <Textarea
      id={id} label={fieldLabel(name, spec)} value={text} readOnly={readOnly} rows={4} required={spec.required}
      hint={spec.hint} error={parsed && !parsed.ok ? m.formInvalidJson(parsed.error) : error} className="font-mono"
      onChange={(e) => {
        setDraft(e.target.value);
        const next = parseJsonDraft(e.target.value);
        if (next.ok) onChange(next.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function DurationField({ id, name, spec, value, onChange, readOnly, error }: FieldProps) {
  const m = useMessages();
  const ms = typeof value === 'number' ? value : undefined;
  const [unit, setUnit] = useState<DurationUnit>(() => splitDuration(ms ?? 0).unit);
  const size = DURATION_UNITS.find((u) => u.unit === unit)?.ms ?? 1;
  const amount = ms === undefined ? '' : String(Math.round((ms / size) * 1000) / 1000);
  return (
    <div className="grid grid-cols-[1fr_6rem] items-start gap-2">
      <Input
        id={id} label={fieldLabel(name, spec)} type="number" value={amount} readOnly={readOnly} required={spec.required}
        hint={spec.hint} error={error} min={spec.min != null ? spec.min / size : 0} step="any"
        onChange={(e) => {
          const n = numberFromText(e.target.value);
          if (n === undefined) onChange(undefined);
          else if (n !== null) onChange(toMs(n, unit));
        }}
      />
      <Select
        id={`${id}-unit`} label={m.formUnit} value={unit} disabled={readOnly}
        options={DURATION_UNITS.map((u) => ({ value: u.unit, label: u.unit }))}
        onChange={(e) => {
          const next = e.target.value as DurationUnit;
          setUnit(next);
          if (ms !== undefined) onChange(ms);
        }}
      />
    </div>
  );
}

function WeekdaysField({ id, name, spec, value, onChange, readOnly }: FieldProps) {
  const m = useMessages();
  const days = Array.isArray(value) ? (value as number[]) : [];
  return (
    <Fieldset id={id} legend={fieldLabel(name, spec)} hint={spec.hint}>
      <div className="flex flex-wrap gap-1" role="group" aria-label={fieldLabel(name, spec)}>
        {m.formWeekdays.map((label, i) => {
          const day = i + 1;
          const on = days.includes(day);
          return (
            <button
              key={label} type="button" aria-pressed={on} disabled={readOnly}
              onClick={() => onChange(toggleIn(days, day).sort((a, b) => a - b))}
              className={cn('rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50',
                on ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-base text-text-primary hover:bg-surface-overlay')}>
              {label}
            </button>
          );
        })}
      </div>
    </Fieldset>
  );
}

function EnumField({ id, name, spec, value, onChange, readOnly, error }: FieldProps) {
  const m = useMessages();
  const options = spec.options ?? [];
  const index = options.findIndex((o) => String(o) === String(value));
  return (
    <Select
      id={id} label={fieldLabel(name, spec)} value={index >= 0 ? String(index) : ''} disabled={readOnly} required={spec.required}
      hint={spec.hint} error={error} placeholder={index >= 0 ? undefined : m.formChoose}
      options={options.map((o, i) => ({ value: String(i), label: optionLabel(spec, o) }))}
      onChange={(e) => onChange(e.target.value === '' ? undefined : options[Number(e.target.value)])}
    />
  );
}

function SecretField({ id, name, spec, value, onChange, readOnly, error }: FieldProps) {
  const m = useMessages();
  const kept = typeof value === 'object' && value !== null && (value as { $secret?: unknown }).$secret === true;
  return (
    <Input
      id={id} label={fieldLabel(name, spec)} type="password" value={typeof value === 'string' ? value : ''} readOnly={readOnly}
      placeholder={kept ? m.formUnchanged : undefined} autoComplete="new-password" hint={spec.hint ?? (kept ? m.formSecretStored : undefined)} error={error}
      onChange={(e) => onChange(e.target.value === '' ? (kept ? value : undefined) : e.target.value)}
    />
  );
}

function CheckGroup({ id, legend, hint, error, choices, selected, onToggle, readOnly }: {
  id: string; legend: string; hint?: string; error?: string; readOnly: boolean;
  choices: { value: string | number | boolean | null; label: string }[]; selected: unknown[]; onToggle: (v: string | number | boolean | null) => void;
}) {
  return (
    <Fieldset id={id} legend={legend} hint={hint} error={error}>
      <div className="space-y-1">
        {choices.map((c, i) => (
          <Checkbox
            key={String(c.value)} id={`${id}-${i}`} label={c.label} disabled={readOnly}
            checked={selected.some((s) => s == c.value)} onChange={() => onToggle(c.value)}
          />
        ))}
      </div>
    </Fieldset>
  );
}

function SourceField(props: FieldProps) {
  const m = useMessages();
  const { id, name, spec, value, onChange, readOnly, choices, error } = props;
  const list = choicesOf(spec, choices);
  const [other, setOther] = useState(false);
  // no list from the host: the field stays editable as plain text
  if (!list.length && !spec.multiple) return <TextField {...props} />;
  if (spec.multiple) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <CheckGroup
        id={id} legend={fieldLabel(name, spec)} hint={spec.hint} error={error} readOnly={readOnly} choices={list} selected={selected}
        onToggle={(v) => onChange(toggleIn(selected, v))}
      />
    );
  }
  const missing = isMissingChoice(value, list);
  const options = [
    ...(spec.required ? [] : [{ value: '', label: spec.empty_label ?? '—' }]),
    ...list.map((c, i) => ({ value: String(i), label: c.label })),
    ...(missing && !other ? [{ value: MISSING, label: m.formNotAvailable(String(value)) }] : []),
    ...(spec.free ? [{ value: OTHER, label: m.formOther }] : []),
  ];
  const index = list.findIndex((c) => c.value == value);
  const selectValue = other ? OTHER : missing ? MISSING : index >= 0 ? String(index) : '';
  return (
    <div className="space-y-2">
      <Select
        id={id} label={fieldLabel(name, spec)} value={selectValue} disabled={readOnly} required={spec.required} hint={spec.hint} error={error}
        options={options}
        onChange={(e) => {
          const v = e.target.value;
          setOther(v === OTHER);
          if (v === OTHER || v === MISSING) return;
          onChange(v === '' ? undefined : list[Number(v)].value);
        }}
      />
      {other && (
        <Input id={`${id}-other`} label={m.formOtherValue} value={value == null ? '' : String(value)} readOnly={readOnly}
          onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)} />
      )}
    </div>
  );
}

function ListField(props: FieldProps) {
  const m = useMessages();
  const { id, name, spec, value, onChange, readOnly, choices, error } = props;
  const item = itemSpec(spec);
  const list = choicesOf(spec, choices);
  // the text being typed: it keeps the commas that the parsed list would not show
  const [draft, setDraft] = useState<string | null>(null);
  if (list.length) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <CheckGroup id={id} legend={fieldLabel(name, spec)} hint={spec.hint} error={error} readOnly={readOnly} choices={list} selected={selected}
        onToggle={(v) => onChange(toggleIn(selected, v))} />
    );
  }
  return (
    <Input
      id={id} label={fieldLabel(name, spec)} value={draft ?? joinList(value)} readOnly={readOnly} required={spec.required}
      hint={spec.hint ?? (item?.type === 'number' ? m.formCommaNumbers : m.formComma)} error={error}
      onChange={(e) => {
        setDraft(e.target.value);
        const parts = splitList(e.target.value);
        onChange(item?.type === 'number' ? parts.map(Number).filter(Number.isFinite) : parts);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function ValueField({ id, name, spec, value, onChange, readOnly, error }: FieldProps) {
  const m = useMessages();
  const kindLabels: Record<ValueKind, string> = { num: m.formKindNum, str: m.formKindStr, bool: m.formKindBool, json: m.formKindJson, path: m.formKindPath, expr: m.formKindExpr, env: m.formKindEnv, now: m.formKindNow };
  const current = isValueParam(value) ? value : { kind: 'str' as ValueKind, v: typeof value === 'string' ? value : '' };
  const kind = (VALUE_KINDS as readonly string[]).includes(current.kind) ? (current.kind as ValueKind) : 'str';
  const set = (v: unknown) => onChange({ kind, v });
  return (
    <Fieldset id={id} legend={fieldLabel(name, spec)} hint={spec.hint} error={error}>
      <div className="grid grid-cols-[8rem_1fr] items-start gap-2">
        <Select
          id={`${id}-kind`} label={m.formValueType} value={kind} disabled={readOnly}
          options={VALUE_KINDS.map((k) => ({ value: k, label: kindLabels[k] }))}
          onChange={(e) => onChange(valueOfKind(e.target.value as ValueKind))}
        />
        {kind === 'now' ? <p className="pt-7 text-xs text-text-secondary">{m.formValueNow}</p>
          : kind === 'bool' ? <div className="pt-7"><Toggle id={`${id}-v`} label="" ariaLabel={m.formValue} size="sm" checked={current.v === true} disabled={readOnly} onChange={set} /></div>
          : kind === 'num' ? <Input id={`${id}-v`} label={m.formValue} type="number" step="any" value={current.v == null ? '' : String(current.v)} readOnly={readOnly}
              onChange={(e) => { const n = numberFromText(e.target.value); if (n !== null) set(n ?? ''); }} />
          : kind === 'json' ? <Textarea id={`${id}-v`} label={m.formValue} rows={3} className="font-mono" value={typeof current.v === 'string' ? current.v : JSON.stringify(current.v ?? '')} readOnly={readOnly}
              onChange={(e) => set(e.target.value)} />
          : <Input id={`${id}-v`} label={m.formValue} className={cn(kind !== 'str' && 'font-mono')} value={current.v == null ? '' : String(current.v)} readOnly={readOnly}
              onChange={(e) => set(e.target.value)} />}
      </div>
    </Fieldset>
  );
}

function RulesField({ id, name, spec, value, onChange, readOnly, choices, error, suggestOf }: FieldProps) {
  const m = useMessages();
  const schema = rowSchema(spec);
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const max = spec.max ?? DEFAULT_MAX_ROWS;
  return (
    <Fieldset id={id} legend={fieldLabel(name, spec)} hint={spec.hint} error={error}>
      <ol className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="space-y-2 rounded-lg border border-border bg-surface-base p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{m.formRule(i + 1)}</span>
              {!readOnly && (
                <button type="button" aria-label={m.formRemoveRule(i + 1)} onClick={() => onChange(rows.filter((_, k) => k !== i))}
                  className="rounded p-1 text-text-secondary transition-colors hover:bg-error-subtle hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                  <FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
            {Object.entries(schema).filter(([, s]) => isVisible(s, row, schema)).map(([key, s]) => (
              <Field key={key} id={`${id}-${i}-${key}`} name={key} spec={s} value={row[key]} readOnly={readOnly} choices={choices}
                suggestOf={suggestOf} row={{ param: name, index: i, values: row }}
                onChange={(v) => onChange(rows.map((r, k) => (k === i ? setField(r, key, v) : r)))} />
            ))}
          </li>
        ))}
      </ol>
      {!readOnly && rows.length < max && (
        <button type="button" onClick={() => onChange([...rows, newRuleRow(schema)])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          <FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" /> {m.formAddRule}
        </button>
      )}
    </Fieldset>
  );
}

const SCRIPT_COMPLETIONS = scriptSuggestions();

function CodeField({ id, name, spec, value, onChange, readOnly, error }: FieldProps) {
  const m = useMessages();
  const code = typeof value === 'string' ? value : '';
  const script = spec.api === 'automation-script';
  const markers = useMemo(() => (script ? lintScript(code).map((p) => ({ ...p, source: m.scriptCheckSource })) : undefined), [script, code, m.scriptCheckSource]);
  return (
    <div>
      {spec.api === 'automation-script' && (
        <p data-testid="script-signature" aria-label={m.scriptSignatureLabel} title={m.scriptSignatureLabel}
          className="mb-1.5 overflow-x-auto whitespace-nowrap rounded-md bg-surface-sunken px-2 py-1 font-mono text-[11px] text-text-secondary">{SCRIPT_SIGNATURE}</p>
      )}
      <CodeEditor id={id} label={fieldLabel(name, spec)} value={code} readonly={readOnly} hint={spec.hint} error={error}
        language={spec.lang && spec.lang !== 'text' ? spec.lang : 'plaintext'} minHeight={160} onChange={(v) => onChange(v)}
        showToolbar messages={m.codeEditor}
        {...(script && {
          markers,
          format: (v: string) => tidyScript(v),
          getSuggestions: () => SCRIPT_COMPLETIONS,
          getHover: ({ word }: { word: string }) => { const doc = scriptHover(word); return doc ? { contents: doc } : null; },
        })} />
    </div>
  );
}

function Field(props: FieldProps) {
  const { spec, id, name, value, onChange, readOnly, error } = props;
  switch (spec.type) {
    case 'number': return <NumberField {...props} />;
    case 'bool': return <Toggle id={id} label={fieldLabel(name, spec)} description={spec.hint} checked={value === true} disabled={readOnly} onChange={onChange} />;
    case 'enum': return <EnumField {...props} />;
    case 'duration': return <DurationField {...props} />;
    case 'time': return <TextField {...props} type="time" />;
    case 'weekdays': return <WeekdaysField {...props} />;
    case 'text': case 'template': case 'expr':
      return <Textarea id={id} label={fieldLabel(name, spec)} value={value == null ? '' : String(value)} readOnly={readOnly} rows={3} required={spec.required}
        hint={spec.hint} error={error} className={cn(MONO_TYPES.has(spec.type) && 'font-mono')} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)} />;
    case 'json': return <JsonField {...props} />;
    case 'secret': return <SecretField {...props} />;
    case 'code':
      return <CodeField {...props} />;
    case 'source': case 'ref': return <SourceField {...props} />;
    case 'list': return <ListField {...props} />;
    case 'value': return <ValueField {...props} />;
    case 'rules': return <RulesField {...props} />;
    default: return <TextField {...props} />;
  }
}

/**
 * The form of a block's params, built from its schema: one field per param, in schema order, shown only
 * when its `when` condition holds. The values are the params of a node (a param the block stores in
 * `script` is passed in `values` like any other). `onChange(key, undefined)` means the field was emptied.
 * A text field that suggests (the spec's `suggest`, or the host's `suggest` for it) gets its own `<datalist>`, in a
 * row of a `rules` field too.
 */
export function ParamForm({ schema, values, onChange, readOnly = false, choices, idPrefix = 'param', showRequired = false, suggest }: {
  schema: Record<string, ParamSpec>;
  values: ParamValues;
  onChange: (key: string, value: unknown) => void;
  readOnly?: boolean;
  choices?: ParamChoices;
  idPrefix?: string;
  /** show "is required" under empty required fields (after a first attempt to apply) */
  showRequired?: boolean;
  /**
   * Suggestions per text field, a row of a `rules` field included (members for the row whose kind is `user` …): a list
   * replaces the field's own `suggest` (an empty one turns it off), `undefined` keeps it.
   */
  suggest?: ParamSuggest;
}) {
  const m = useMessages();
  const suggestOf = (key: string, spec: ParamSpec, row?: RowRef) => suggest?.({ key, spec, values, row }) ?? spec.suggest;
  const issues = validateParams({ params: schema }, values, m.paramIssueText);
  const errorOf = (key: string) => issues.find((i) => i.param === key && (showRequired || i.code !== 'required'))?.message;
  const keys = Object.keys(schema).filter((key) => isVisible(schema[key], values, schema));
  if (!keys.length) return null;
  return (
    <div className="space-y-4">
      {keys.map((key) => (
        <Field
          key={key} id={`${idPrefix}-${key}`} name={key} spec={schema[key]} value={values[key]} readOnly={readOnly} choices={choices}
          error={errorOf(key)} suggestOf={suggestOf} onChange={(v) => onChange(key, v)}
        />
      ))}
    </div>
  );
}
