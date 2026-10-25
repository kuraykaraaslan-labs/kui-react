'use client';
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../Button';
import { Badge } from '../../Badge';
import { Input } from '../../Input';
import { Select } from '../../Select';
import { MultiSelect } from '../../MultiSelect';
import { CheckboxGroup } from '../../CheckboxGroup';
import { RadioGroup } from '../../RadioGroup';
import { Checkbox } from '../../Checkbox';
import { RangeSlider } from '../../RangeSlider';
import { DatePicker, DateRangePicker } from '../../DatePicker';
import type {
  DataTableFilterField,
  DataTableFilterValue,
  DataTableFilterValues,
  DataTableMessages,
} from '../types';

// The `filterFields` panel: a toolbar toggle and a grid of controls. Edits stay
// in a draft until Apply (or apply at once with `live`).

/** `YYYY-MM-DD` in local time, the wire format of date filters. */
function toDay(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDay(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function FilterToggle({
  controls,
  open,
  activeCount,
  label,
  onToggle,
}: {
  controls?: string;
  open: boolean;
  activeCount: number;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="md"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      iconLeft={<FontAwesomeIcon icon={faFilter} className="w-3.5 h-3.5" aria-hidden="true" />}
      className={cn('shrink-0', open && 'bg-surface-overlay')}
      data-part="filter-toggle"
    >
      {label}
      {activeCount > 0 && (
        <Badge variant="primary" size="sm" className="ml-1" aria-label={`${activeCount} active`}>
          {activeCount}
        </Badge>
      )}
    </Button>
  );
}

function FilterControl<T>({
  field,
  id,
  value,
  msgs,
  onChange,
}: {
  field: DataTableFilterField<T>;
  id: string;
  value: DataTableFilterValue | undefined;
  msgs: DataTableMessages;
  onChange: (value: DataTableFilterValue) => void;
}) {
  const any = msgs.any ?? 'Any';
  switch (field.type) {
    case 'text':
      return (
        <Input id={id} label={field.label} hint={field.hint} placeholder={field.placeholder}
          value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)} />
      );
    case 'number':
      return (
        <Input id={id} type="number" label={field.label} hint={field.hint} placeholder={field.placeholder}
          min={field.min} max={field.max} step={field.step}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      );
    case 'select':
      return (
        <Select id={id} label={field.label} hint={field.hint} options={field.options}
          placeholder={field.placeholder ?? any}
          value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)} />
      );
    case 'multiselect':
      return (
        <MultiSelect id={id} label={field.label} hint={field.hint} options={field.options}
          placeholder={field.placeholder ?? any}
          value={(value as string[] | undefined) ?? []} onChange={onChange} />
      );
    case 'checkboxes':
      return (
        <CheckboxGroup legend={field.label} options={field.options}
          selected={(value as string[] | undefined) ?? []} onChange={onChange} />
      );
    case 'radio':
      return (
        <RadioGroup name={id} legend={field.label}
          options={[{ value: '', label: field.anyLabel ?? any }, ...field.options]}
          value={(value as string | undefined) ?? ''} onChange={onChange} />
      );
    case 'checkbox':
      return (
        <Checkbox id={id} label={field.label} hint={field.hint}
          checked={value === true} onChange={(e) => onChange(e.target.checked)} />
      );
    case 'date':
      return (
        <DatePicker id={id} label={field.label} hint={field.hint} locale={field.locale}
          value={fromDay(value as string | null | undefined)} onChange={(d) => onChange(toDay(d))} />
      );
    case 'daterange': {
      const range = value as { from: string | null; to: string | null } | null | undefined;
      return (
        <DateRangePicker id={id} label={field.label} hint={field.hint} locale={field.locale}
          value={{ start: fromDay(range?.from), end: fromDay(range?.to) }}
          onChange={(r) => onChange({ from: toDay(r.start), to: toDay(r.end) })} />
      );
    }
    case 'range':
      return (
        <RangeSlider range label={field.label} hint={field.hint}
          min={field.min} max={field.max} step={field.step}
          value={(value as [number, number] | undefined) ?? [field.min, field.max]} onChange={onChange} />
      );
    case 'custom':
      return <>{field.render({ id, value, onChange })}</>;
  }
}

export function FilterPanel<T>({
  id,
  fields,
  applied,
  live,
  msgs,
  onApply,
}: {
  id: string;
  fields: readonly DataTableFilterField<T>[];
  applied: DataTableFilterValues;
  /** Apply every edit at once instead of on the Apply button. */
  live: boolean;
  msgs: DataTableMessages;
  onApply: (values: DataTableFilterValues) => void;
}) {
  const [draft, setDraft] = useState(applied);
  // Applied values changed from outside (controlled prop, reset): drop the draft.
  // Compared by value, so a parent passing a fresh object each render keeps it.
  const appliedKey = JSON.stringify(applied);
  const [seen, setSeen] = useState(appliedKey);
  if (seen !== appliedKey) {
    setSeen(appliedKey);
    setDraft(applied);
  }

  function set(fieldId: string, value: DataTableFilterValue) {
    const next = { ...draft, [fieldId]: value };
    setDraft(next);
    if (live) onApply(next);
  }

  return (
    <form
      id={id}
      aria-label={msgs.filters ?? 'Filters'}
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
      className="rounded-lg border border-border bg-surface-raised p-4"
      data-part="filter-panel"
    >
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
        {fields.map((field) => (
          <div key={field.id} className={cn('min-w-0', field.type === 'checkbox' && 'self-end pb-2')}>
            <FilterControl
              field={field}
              id={`${id}-${field.id}`}
              value={draft[field.id]}
              msgs={msgs}
              onChange={(v) => set(field.id, v)}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onApply({})}>
          {msgs.resetFilters ?? 'Reset'}
        </Button>
        {!live && (
          <Button type="submit" variant="primary" size="sm">
            {msgs.apply}
          </Button>
        )}
      </div>
    </form>
  );
}
