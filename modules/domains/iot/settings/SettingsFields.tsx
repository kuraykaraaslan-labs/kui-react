'use client';
import { cn } from '@/libs/utils/cn';
import type { SettingsSchemaNode } from '../types/settings';
import type { SettingsMessages } from './messages';

/**
 * The controls the generic settings form needs beside the schema form's own fields: a choice that is a fixed word or a value of its own
 * ("Automatic" or a channel number), a list of numbers or words (checkboxes when the manifest lists the choices), and a value only the
 * device can change, shown read-only.
 */

const controlCls = 'block w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-60';

interface FieldShell {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
  children: React.ReactNode;
  labelFor?: boolean;
}

export function FieldFrame({ id, label, required, error, description, children, labelFor = true }: FieldShell) {
  return (
    <div data-field={id}>
      <div className="mb-1.5">
        {labelFor
          ? <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium text-text-secondary">{label}{required && <span className="text-error" aria-hidden="true">*</span>}</label>
          : <span id={`${id}-label`} className="flex items-center gap-1 text-xs font-medium text-text-secondary">{label}{required && <span className="text-error" aria-hidden="true">*</span>}</span>}
      </div>
      {children}
      {description && <p id={`${id}-desc`} className="mt-1.5 text-[11px] leading-snug text-text-secondary">{description}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

const describedBy = (id: string, error?: string, description?: string) => [error ? `${id}-error` : '', description ? `${id}-desc` : ''].filter(Boolean).join(' ') || undefined;

/** A `oneOf` of scalars: its constants as choices, and "Other value" for the branch that takes a number or a text. */
export function ChoiceField({ id, label, node, value, onChange, disabled, required, error, description, valueText, m }: {
  id: string;
  label: string;
  node: SettingsSchemaNode;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  description?: string;
  valueText: (v: unknown) => string;
  m: SettingsMessages;
}) {
  const consts = (node.oneOf ?? []).filter((b) => b.const !== undefined).map((b) => b.const);
  const free = (node.oneOf ?? []).find((b) => b.const === undefined && !b.enum);
  const isConst = consts.some((c) => c === value);
  const mode = value === undefined ? '' : isConst ? `c:${String(value)}` : 'free';
  const numeric = free?.type === 'integer' || free?.type === 'number';
  return (
    <FieldFrame id={id} label={label} required={required} error={error} description={description}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={id}
          value={mode}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, description)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') onChange(undefined);
            else if (v === 'free') onChange(numeric ? (free?.minimum ?? 1) : '');
            else onChange(consts.find((c) => `c:${String(c)}` === v));
          }}
          className={cn(controlCls, 'w-auto min-w-40')}
        >
          {!required && <option value="">-</option>}
          {consts.map((c) => <option key={String(c)} value={`c:${String(c)}`}>{valueText(c)}</option>)}
          {free && <option value="free">{m.choice.custom}</option>}
        </select>
        {mode === 'free' && free && (
          <input
            type={numeric ? 'number' : 'text'}
            aria-label={label}
            value={value === undefined ? '' : String(value)}
            min={free.minimum}
            max={free.maximum}
            step={free.type === 'integer' ? 1 : undefined}
            maxLength={free.maxLength}
            disabled={disabled}
            onChange={(e) => onChange(numeric ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
            className={cn(controlCls, 'w-32')}
          />
        )}
      </div>
    </FieldFrame>
  );
}

/** A list of scalars: checkboxes for the manifest's choices, else one text of comma separated entries (numbers stay numbers). */
export function ScalarListField({ id, label, node, value, onChange, disabled, error, description, valueText, checkboxes }: {
  id: string;
  label: string;
  node: SettingsSchemaNode;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
  error?: string;
  description?: string;
  valueText: (v: unknown) => string;
  checkboxes?: boolean;
}) {
  const items = node.items ?? {};
  const list = Array.isArray(value) ? value : [];
  const numeric = items.type === 'integer' || items.type === 'number';
  if (Array.isArray(items.enum) && (checkboxes || items.enum.length <= 24)) {
    return (
      <FieldFrame id={id} label={label} error={error} description={description} labelFor={false}>
        <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-x-4 gap-y-2">
          {items.enum.map((opt) => {
            const on = list.some((v) => v === opt);
            return (
              <label key={String(opt)} className="inline-flex min-h-11 items-center gap-2 text-sm text-text-primary sm:min-h-0">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={(e) => onChange(e.target.checked ? [...list, opt] : list.filter((v) => v !== opt))}
                  className="h-4 w-4 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus"
                />
                {valueText(opt)}
              </label>
            );
          })}
        </div>
      </FieldFrame>
    );
  }
  const text = list.map(String).join(', ');
  return (
    <FieldFrame id={id} label={label} error={error} description={description}>
      <input
        id={id}
        type="text"
        defaultValue={text}
        key={text}
        disabled={disabled}
        inputMode={numeric ? 'numeric' : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, description)}
        onBlur={(e) => {
          const parts = e.target.value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
          const next = numeric ? parts.map((s) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s)) : parts;
          onChange(next.length ? next : undefined);
        }}
        className={controlCls}
      />
    </FieldFrame>
  );
}

/** A value only the device can change (`remote: false`): shown as it stands, with why it cannot be changed here. */
export function FixedField({ id, label, value, valueText, m }: { id: string; label: string; value: unknown; valueText: (v: unknown) => string; m: SettingsMessages }) {
  return (
    <div data-field={id} data-fixed="">
      <p className="mb-1.5 text-xs font-medium text-text-secondary">{label}</p>
      <p className="text-sm text-text-primary">{value === undefined || value === null ? m.common.none : Array.isArray(value) ? value.map(valueText).join(', ') : valueText(value)}</p>
      <p className="mt-1 text-[11px] text-text-secondary">{m.editor.fixed}: {m.editor.fixedHint}</p>
    </div>
  );
}
