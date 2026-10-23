import { describe, it, expect } from 'vitest';
import { CONTROL_FORM, CONTROL_FORM_KIND } from '../templates/control-form';
import { effective, migrate, templateDefaults, validate } from '../settings/engine';
import { controlHostOf } from '../views/control-common';
import { DEFAULT_WIDGET_KIT_MESSAGES as M } from '../messages';
import { controlFormModel, formDirty, formFields, formInitial, formPayload, type FormField } from '../views/control-form-logic';

// What a save sends (dashboard phase 35.4, plan defect B6): an empty or switched-off field is left out, never null.

const fields: FormField[] = formFields({
  fields: [
    { key: 'name', type: 'text' },
    { key: 'lowFlag', type: 'boolean' },
    { key: 'low', type: 'number', gate: 'lowFlag' },
    { key: 'high', type: 'number' },
    { key: 'mode', type: 'enum', options: 'auto, manual' },
    { key: 'serial', type: 'text', readOnly: true },
  ],
}, undefined);

describe('formPayload', () => {
  it('sends a trimmed text, a number, a choice and every on / off field', () => {
    const out = formPayload(fields, { name: ' Pump A ', lowFlag: true, low: 2.5, high: 9, mode: 'auto', serial: 'SN' });
    expect({ ...out }).toEqual({ name: 'Pump A', lowFlag: true, low: 2.5, high: 9, mode: 'auto' });
    // a switched-off flag is a value (false), its gated number is not
    expect({ ...formPayload(fields, { name: 'x', lowFlag: false, low: 2.5, high: 1, mode: '' }) }).toEqual({ name: 'x', lowFlag: false, high: 1 });
  });
  it('leaves an empty text, an empty number, an empty choice and a switched-off gated field out, never as null', () => {
    const out = formPayload(fields, { name: '   ', lowFlag: false, low: null, high: null, mode: '', serial: 'SN' });
    expect({ ...out }).toEqual({ lowFlag: false });
    expect(Object.values(out)).not.toContain(null);
    expect('high' in out).toBe(false);
    expect('low' in out).toBe(false);
    // a number the viewer typed that is not a number is not sent either (the form refuses to save it anyway)
    expect('high' in formPayload(fields, { lowFlag: false, high: Number.NaN })).toBe(false);
  });
  it('with `only`, sends just those keys (the changed fields), still without empties', () => {
    const values = { name: 'Pump A', lowFlag: true, low: 2.5, high: 9, mode: 'auto' };
    expect({ ...formPayload(fields, values, ['high']) }).toEqual({ high: 9 });
    expect({ ...formPayload(fields, values, ['high', 'low', 'lowFlag']) }).toEqual({ high: 9, low: 2.5, lowFlag: true });
    expect({ ...formPayload(fields, { ...values, high: null }, ['high']) }).toEqual({});
    expect({ ...formPayload(fields, values, []) }).toEqual({});
  });
  it('the dirty keys feed `only`: a cleared field is simply absent, a changed flag is sent', () => {
    const initial = formInitial(fields, { name: 'Pump A', lowFlag: true, low: 2.5, high: 9, mode: 'auto', serial: 'SN' });
    const values = { ...initial, high: null, lowFlag: false };
    const dirty = formDirty(fields, initial, values);
    expect(dirty.sort()).toEqual(['high', 'lowFlag']);
    expect({ ...formPayload(fields, values, dirty) }).toEqual({ lowFlag: false });
  });
  it('is a null-prototype object with no inherited keys', () => {
    const out = formPayload(fields, { name: 'a', lowFlag: false });
    expect(Object.getPrototypeOf(out)).toBeNull();
    expect('constructor' in out).toBe(false);
  });
});

describe('the control.form template at v2', () => {
  it('is v2 with one note-only step from v1, valid defaults and the new option off', () => {
    expect(CONTROL_FORM.version).toBe(2);
    expect(CONTROL_FORM.migrations).toHaveLength(1);
    expect(CONTROL_FORM.migrations[0]).toMatchObject({ from: 1, to: 2 });
    expect(CONTROL_FORM.fields.saveChangedOnly).toMatchObject({ type: 'boolean', value: false, since: 2, group: 'buttons' });
    expect(validate(CONTROL_FORM, templateDefaults(CONTROL_FORM)).issues).toEqual([]);
    for (const [key, f] of Object.entries(CONTROL_FORM.fields)) expect(f.since, key).toBe(key === 'saveChangedOnly' ? 2 : 1);
    expect(CONTROL_FORM_KIND.template).toBe(CONTROL_FORM);
  });
  it('settings saved by v1 migrate unchanged (nothing was renamed, the new option stays off)', () => {
    const stored = { label: 'Pump', fields: [{ key: 'a', type: 'text' }], showReset: false };
    const r = migrate(CONTROL_FORM, stored, 1);
    expect(r.values).toEqual(stored);
    expect(r.applied.map((a) => [a.from, a.to])).toEqual([[1, 2]]);
    expect(effective(CONTROL_FORM, stored).saveChangedOnly).toBe(false);
  });
  it('the model carries saveChangedOnly for the view', () => {
    const host = controlHostOf({ onControl: async () => undefined }, M.controls);
    expect(controlFormModel({}, {}, 'en', host).saveChangedOnly).toBe(false);
    expect(controlFormModel({ saveChangedOnly: true }, {}, 'en', host).saveChangedOnly).toBe(true);
  });
});
