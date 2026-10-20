'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { ControlConfirmPrompt, useControlConfirm } from '@/modules/ui/ControlTile/ControlConfirm';
import type { WidgetControlMessages } from '../messages';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { controlHostOf, requestControl } from './control-common';
import {
  controlFormModel, formDirty, formErrors, formPayload, gatedOff, type FormErrorCode, type FormField, type FormSettings as S, type FormValue, type FormValues,
} from './control-form-logic';
import { MetricLabel } from './ui';

export * from './control-form-logic';

const FIELD = 'h-9 w-full rounded-md border border-border bg-surface-base px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-60';

function errorText(f: FormField, code: FormErrorCode, m: WidgetControlMessages): string {
  if (code === 'required') return m.fieldRequired;
  if (code === 'nan') return m.fieldNumber;
  if (code === 'invalid') return m.fieldInvalid;
  if (f.min !== undefined && f.max !== undefined) return m.outOfRange.replace('{min}', String(f.min)).replace('{max}', String(f.max));
  return f.min !== undefined ? m.atLeast.replace('{min}', String(f.min)) : m.atMost.replace('{max}', String(f.max));
}

/**
 * `control.form`: several fields edited together, saved as one command. Save sends every editable field at once;
 * it is enabled only while something changed and every field passes its check. Reset puts the record's values back.
 * A save the command asks to confirm waits for the same confirm step every control uses.
 */
export function ControlFormView(props: WidgetViewProps) {
  const s = props.settings as S;
  const m = useKitMessages().controls;
  const set = requestControl(props.onControl, 'set', m);
  const g = controlFormModel(s, props.data, props.locale, controlHostOf(props, m));
  const initialKey = JSON.stringify(g.initial);
  const [values, setValues] = useState<FormValues>(g.initial);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [seen, setSeen] = useState(initialKey);
  const [phase, setPhase] = useState<'idle' | 'pending' | 'done' | 'failed'>('idle');
  const [reason, setReason] = useState('');
  const confirm = useControlConfirm<Record<string, FormValue>>(g.confirm.confirm);
  // The record changed under the form (a save landed, or the device moved): start from what it holds now.
  if (seen !== initialKey) { setSeen(initialKey); setValues(g.initial); setTyped({}); setTouched({}); }

  const errors = formErrors(g.fields, values);
  const dirty = formDirty(g.fields, g.initial, values);
  const blocked = !!g.disabledReason;
  const busy = phase === 'pending';
  const put = (key: string, v: FormValue) => { setValues((cur) => ({ ...cur, [key]: v })); setPhase('idle'); };
  const say = (key: 'pending' | 'confirmed' | 'failed') => g.messages?.[key] ?? m[key];

  const run = async (payload: Record<string, FormValue>, confirmation?: { confirmed: true; typed?: string }) => {
    setPhase('pending');
    try {
      await set(payload, confirmation);
      setPhase('done');
    } catch (e) {
      setReason(e instanceof Error ? e.message : '');
      setPhase('failed');
    }
  };
  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setTouched(Object.fromEntries(g.fields.map((f) => [f.key, true])));
    if (blocked || busy || dirty.length === 0 || Object.keys(errors).length > 0) return;
    const parked = confirm.request(formPayload(g.fields, values));
    if (parked) void run(parked.value);
  };
  const reset = () => { setValues(g.initial); setTyped({}); setTouched({}); setPhase('idle'); confirm.cancel(); };

  const renderField = (f: FormField) => {
    const id = `wk-form-${f.key}`;
    const v = values[f.key];
    const off = f.readOnly || blocked || busy || gatedOff(f, values);
    const code = touched[f.key] ? errors[f.key] : undefined;
    const shared = { id, disabled: off, 'aria-invalid': code ? true : undefined, 'aria-describedby': code ? `${id}-err` : undefined, onBlur: () => setTouched((t) => ({ ...t, [f.key]: true })) };
    let control;
    if (f.type === 'boolean') {
      control = <input type="checkbox" className="h-4 w-4 rounded border-border" checked={v === true} {...shared} onChange={(e) => put(f.key, e.target.checked)} />;
    } else if (f.type === 'enum') {
      control = (
        <select className={FIELD} value={String(v ?? '')} {...shared} onChange={(e) => put(f.key, e.target.value)}>
          <option value="">{f.placeholder ?? ''}</option>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else if (f.type === 'number') {
      const text = f.key in typed ? typed[f.key] : v === null || v === undefined ? '' : String(v);
      control = (
        <span className="flex items-center gap-1.5">
          <input type="number" inputMode="decimal" className={FIELD} value={text} min={f.min} max={f.max} step={f.step ?? 'any'} placeholder={f.placeholder} {...shared}
            onChange={(e) => { setTyped((t) => ({ ...t, [f.key]: e.target.value })); put(f.key, e.target.value.trim() === '' ? null : Number(e.target.value)); }} />
          {f.unit && <span className="shrink-0 text-xs text-text-secondary">{f.unit}</span>}
        </span>
      );
    } else {
      control = <input type="text" className={FIELD} value={String(v ?? '')} placeholder={f.placeholder} {...shared} onChange={(e) => put(f.key, e.target.value)} />;
    }
    return (
      <div key={f.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start gap-2" data-field={f.key}>
        <label htmlFor={id} className="pt-2 text-xs font-medium text-text-secondary">{f.label}{f.required && <span aria-hidden="true"> *</span>}</label>
        <div className="min-w-0">
          {control}
          {code && <p id={`${id}-err`} className="mt-1 text-xs text-error" role="alert">{errorText(f, code, m)}</p>}
        </div>
      </div>
    );
  };

  return (
    <form className="flex h-full min-h-0 flex-col gap-2" onSubmit={submit} aria-label={g.ariaLabel} noValidate>
      {g.label.text && <MetricLabel font={g.label.font} color={g.label.color}>{g.label.text}</MetricLabel>}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        {g.groups.map((grp) => (
          <fieldset key={grp.name ?? ''} className="m-0 min-w-0 space-y-2 border-0 p-0" disabled={blocked}>
            {grp.name && <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{grp.name}</legend>}
            {grp.fields.map(renderField)}
          </fieldset>
        ))}
      </div>
      {blocked && <p className="text-xs text-text-secondary" role="note">{g.disabledReason}</p>}
      {confirm.asking ? (
        <ControlConfirmPrompt
          mode={g.confirm.confirm === 'typed' ? 'typed' : 'confirm'}
          confirmText={g.confirm.confirmText}
          messages={g.messages}
          onConfirm={(t) => { const a = confirm.accept(t); if (a) void run(a.value, confirm.confirmation.current); }}
          onCancel={confirm.cancel}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={blocked || busy || dirty.length === 0 || Object.keys(errors).length > 0}>{g.saveLabel}</Button>
          {g.showReset && <Button type="button" size="sm" variant="secondary" disabled={busy || dirty.length === 0} onClick={reset}>{g.resetLabel}</Button>}
          <span className="ml-auto text-xs text-text-secondary" role="status" aria-live="polite">
            {phase === 'pending' ? say('pending') : phase === 'done' ? say('confirmed') : phase === 'failed' ? `${say('failed')}${reason ? ` (${reason})` : ''}` : ''}
          </span>
        </div>
      )}
    </form>
  );
}

export const CONTROL_FORM_VIEW: WidgetKindView = { View: ControlFormView, isEmpty: () => false };
