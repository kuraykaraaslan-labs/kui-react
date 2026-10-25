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
import { ButtonGroup } from '../../ButtonGroup';
import { RangeSlider } from '../../RangeSlider';
import { DatePicker, DateRangePicker } from '../../DatePicker';
import { builtInDatePresets, defaultFilterValues, toDay } from '../core/filterPanel';
import type {
  DataTableFilterField,
  DataTableFilterValue,
  DataTableFilterValues,
  DataTableMessages,
  DataTableNumberRange,
} from '../types';

// The `filterFields` panel: a toolbar toggle and a grid of controls. Edits stay
// in a draft until Apply (or apply at once with `live`).

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

function NumberRangeControl({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  msgs,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  value: DataTableNumberRange | undefined;
  msgs: DataTableMessages;
  onChange: (value: DataTableNumberRange) => void;
}) {
  const current = value ?? { min: null, max: null };
  const read = (raw: string) => (raw === '' ? null : Number(raw));
  const minLabel = msgs.rangeMin ?? 'Min';
  const maxLabel = msgs.rangeMax ?? 'Max';
  return (
    <fieldset className="min-w-0" data-part="number-range">
      <legend className="mb-1.5 block text-sm font-medium text-text-primary">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Input id={`${id}-min`} type="number" label={minLabel} min={min} max={max} step={step}
          value={current.min ?? ''} onChange={(e) => onChange({ ...current, min: read(e.target.value) })} />
        <Input id={`${id}-max`} type="number" label={maxLabel} min={min} max={max} step={step}
          value={current.max ?? ''} onChange={(e) => onChange({ ...current, max: read(e.target.value) })} />
      </div>
      {hint && <p className="mt-1.5 text-xs text-text-secondary">{hint}</p>}
    </fieldset>
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
          placeholder={field.required ? undefined : (field.placeholder ?? any)}
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
          options={field.required ? field.options : [{ value: '', label: field.anyLabel ?? any }, ...field.options]}
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
      const presets = field.presets === true ? builtInDatePresets(msgs) : field.presets || [];
      return (
        <div className="min-w-0 space-y-2">
          <DateRangePicker id={id} label={field.label} hint={field.hint} locale={field.locale}
            value={{ start: fromDay(range?.from), end: fromDay(range?.to) }}
            onChange={(r) => onChange({ from: toDay(r.start), to: toDay(r.end) })} />
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1" data-part="date-presets">
              {presets.map((p) => {
                const on = range?.from === p.from && range?.to === p.to;
                return (
                  <Button key={p.label} size="xs" variant={on ? 'primary' : 'ghost'} aria-pressed={on}
                    onClick={() => onChange({ from: p.from, to: p.to })}>
                    {p.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    case 'range':
      return (
        <RangeSlider range label={field.label} hint={field.hint}
          min={field.min} max={field.max} step={field.step}
          value={(value as [number, number] | undefined) ?? [field.min, field.max]} onChange={onChange} />
      );
    case 'numberrange':
      return (
        <NumberRangeControl id={id} label={field.label} hint={field.hint}
          min={field.min} max={field.max} step={field.step}
          value={value as DataTableNumberRange | undefined} msgs={msgs} onChange={onChange} />
      );
    case 'custom':
      return <>{field.render({ id, value, onChange })}</>;
  }
}

/**
 * A `placement: 'toolbar'` field, applied at once: a radio field as a segmented button group, a select field as a
 * dropdown whose label is read by screen readers only.
 */
export function ToolbarFilterControl<T>({
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
  if (field.type === 'radio') {
    const items = field.required ? field.options : [{ value: '', label: field.anyLabel ?? any }, ...field.options];
    return (
      <div role="group" aria-label={field.label} className="shrink-0" data-part="toolbar-filter">
        <ButtonGroup size="sm" items={items} value={(value as string | undefined) ?? ''} onChange={onChange} />
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <Select id={id} label={field.label} hideLabel options={field.options} className="shrink-0 min-w-40"
        placeholder={field.required ? undefined : (field.placeholder ?? any)}
        value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)}
        data-part="toolbar-filter" />
    );
  }
  return null;
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
        {/* Reset goes back to each field's defaultValue, not to nothing. */}
        <Button variant="ghost" size="sm" onClick={() => onApply(defaultFilterValues(fields))}>
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
