'use client';
// The condition rows of the key filter editor (TB's filter-predicate and filter-predicate-value): the operation (only
// the ones the value type allows), the value input of the value type, `to` for between, the `values` chips for in /
// not in and ignore case for text. Each value is a fixed value or a dashboard parameter (`{ $param }`, TB's "user
// value"): the button beside the value switches between the two.

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSliders, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { TagInput } from '@/modules/ui/TagInput';
import { KEY_FILTER_OPS, isParamValue, predicateShape, takesIgnoreCase } from './key-filters';
import { FILTER_STRING_MAX, type KeyFilterErrors } from './validate-filters';
import type { EntityAliasesMessages, PredicateErrorPart } from './messages';
import type { BoardParamInfo, FilterValue, KeyFilterOp, KeyFilterPredicate, KeyFilterValueType } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO text → the `datetime-local` input's local `YYYY-MM-DDTHH:mm` ('' when it is not a date). */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The `datetime-local` input's local text → ISO text in UTC (undefined when empty or not a date). */
export function localInputToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function FilterValueField({
  id,
  label,
  valueType,
  value,
  onChange,
  params,
  error,
  m,
}: {
  id: string;
  label: string;
  valueType: KeyFilterValueType;
  value: FilterValue | undefined;
  onChange: (value: FilterValue | undefined) => void;
  params: readonly BoardParamInfo[];
  error?: string;
  m: EntityAliasesMessages;
}) {
  const fromParam = isParamValue(value);
  const noParams = params.length === 0;

  let field: React.ReactNode;
  if (isParamValue(value)) {
    const options = params.map((p) => ({ value: p.key, label: p.label }));
    if (value.$param && !params.some((p) => p.key === value.$param)) options.push({ value: value.$param, label: value.$param });
    field = (
      <Select id={id} label={label} options={options} placeholder={m.paramPlaceholder} value={value.$param}
        onChange={(e) => onChange({ $param: e.target.value })} hint={m.paramValue} error={error} required />
    );
  } else if (valueType === 'number') {
    field = (
      <Input id={id} label={label} type="number" value={typeof value === 'number' ? String(value) : ''}
        onChange={(e) => {
          const n = e.target.value === '' ? Number.NaN : Number(e.target.value);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        error={error} required />
    );
  } else if (valueType === 'datetime') {
    field = (
      <Input id={id} label={label} type="datetime-local" value={typeof value === 'string' ? isoToLocalInput(value) : ''}
        onChange={(e) => onChange(localInputToIso(e.target.value))} error={error} required />
    );
  } else if (valueType === 'boolean') {
    field = (
      <Select id={id} label={label}
        options={[{ value: 'true', label: m.booleanTrue }, { value: 'false', label: m.booleanFalse }]}
        placeholder={m.booleanPlaceholder} value={typeof value === 'boolean' ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')} error={error} required />
    );
  } else {
    field = (
      <Input id={id} label={label} value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)} maxLength={FILTER_STRING_MAX}
        error={error} required />
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">{field}</div>
      <Button
        variant={fromParam ? 'secondary' : 'ghost'}
        size="sm"
        iconOnly
        aria-pressed={fromParam}
        aria-label={`${m.useParam}: ${label}`}
        title={!fromParam && noParams ? m.noParams : fromParam ? m.useLiteral : m.useParam}
        disabled={!fromParam && noParams}
        onClick={() => onChange(fromParam ? undefined : { $param: params[0]?.key ?? '' })}
        className="mt-6 shrink-0"
      >
        <FontAwesomeIcon icon={faSliders} className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function PredicateRow({
  idBase,
  index,
  predicate,
  valueType,
  joinText,
  onChange,
  onRemove,
  params,
  errors,
  m,
}: {
  idBase: string;
  index: number;
  predicate: KeyFilterPredicate;
  valueType: KeyFilterValueType;
  /** The joining word shown above every row but the first ("and", "or"). */
  joinText: string;
  onChange: (predicate: KeyFilterPredicate) => void;
  onRemove: () => void;
  params: readonly BoardParamInfo[];
  errors?: KeyFilterErrors;
  m: EntityAliasesMessages;
}) {
  const id = `${idBase}-p${index}`;
  const err = (part: PredicateErrorPart) => {
    const field = `predicates.${index}.${part}` as const;
    const code = errors?.[field];
    return code ? m.filterError(field, code) : undefined;
  };
  const allowed = KEY_FILTER_OPS[valueType] ?? [];
  // An operation the value type does not allow stays visible, so its error has something to point at.
  const ops: readonly KeyFilterOp[] = allowed.includes(predicate.op) ? allowed : [...allowed, predicate.op];
  const shape = predicateShape(predicate.op);
  const set = (patch: Partial<KeyFilterPredicate>) => onChange({ ...predicate, ...patch });

  return (
    <li className="space-y-2">
      {index > 0 && <p className="pl-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">{joinText}</p>}
      <div className={cn('grid grid-cols-1 items-start gap-3 rounded-md border bg-surface-base p-3 sm:grid-cols-[11rem_1fr_auto]',
        err('op') ? 'border-error' : 'border-border')}>
        <Select
          id={`${id}-op`}
          label={m.predicateOp}
          options={ops.map((op) => ({ value: op, label: m.keyFilterOps[op] ?? op }))}
          value={predicate.op}
          onChange={(e) => set({ op: e.target.value as KeyFilterOp })}
          error={err('op')}
          required
        />
        <div className="min-w-0 space-y-3">
          {shape === 'value' && (
            <FilterValueField id={`${id}-value`} label={m.predicateValue} valueType={valueType} value={predicate.value}
              onChange={(value) => set({ value })} params={params} error={err('value')} m={m} />
          )}
          {shape === 'range' && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FilterValueField id={`${id}-value`} label={m.predicateValue} valueType={valueType} value={predicate.value}
                onChange={(value) => set({ value })} params={params} error={err('value')} m={m} />
              <FilterValueField id={`${id}-to`} label={m.predicateTo} valueType={valueType} value={predicate.to}
                onChange={(to) => set({ to })} params={params} error={err('to')} m={m} />
            </div>
          )}
          {shape === 'list' && (
            <TagInput id={`${id}-values`} label={m.predicateValues} value={predicate.values ?? []}
              onChange={(values) => set({ values })} placeholder={m.predicateValuesPlaceholder} error={err('values')} />
          )}
          {takesIgnoreCase(valueType, predicate.op) && (
            <Checkbox id={`${id}-ignore-case`} label={m.ignoreCase} checked={!!predicate.ignoreCase}
              onChange={(e) => set({ ignoreCase: e.target.checked })} />
          )}
        </div>
        <Button variant="ghost" size="sm" iconOnly aria-label={m.removePredicate(index + 1)} onClick={onRemove} className="sm:mt-6">
          <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
