import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { effective } from '../settings/engine';
import type { WidgetViewProps } from '../kind';
import { CONTROL_FORM } from '../templates/control-form';
import { CONTROL_FORM_VIEW } from '../views/ControlFormView';
import { DEFAULT_WIDGET_KIT_MESSAGES as M } from '../messages';

// The drawn form (dashboard phase 35.4 review, F1): a change that is only a clear has nothing to send, so Save stays
// off and no command runs, instead of an empty (or clear-less) save that reports "done" while the device keeps its value.

const View = CONTROL_FORM_VIEW.View;
const RECORD = { shape: 'record' as const, record: { name: 'Pump A', high: 9, lowFlag: true, low: 2.5 } };
const FIELDS = [
  { key: 'name', type: 'text', label: 'Name' },
  { key: 'high', type: 'number', label: 'High' },
  { key: 'lowFlag', type: 'boolean', label: 'Low alarm' },
  { key: 'low', type: 'number', label: 'Low', gate: 'lowFlag' },
];

const props = (settings: Record<string, unknown>, onControl: WidgetViewProps['onControl']): WidgetViewProps =>
  ({ settings: effective(CONTROL_FORM, { fields: FIELDS, ...settings }), format: {}, data: { record: RECORD }, locale: 'en', onControl });

const save = () => screen.getByRole('button', { name: 'Save' });
const reset = () => screen.getByRole('button', { name: 'Reset' });

describe('ControlFormView and a cleared field', () => {
  it('with saveChangedOnly, a clear alone keeps Save off, says why, runs nothing on submit, and Reset still works', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    render(<View {...props({ saveChangedOnly: true }, onControl)} />);
    expect(save()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('High'), { target: { value: '' } });
    expect(save()).toBeDisabled();
    expect(reset()).not.toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(M.controls.clearedNotSaved);
    fireEvent.submit(screen.getByRole('form'));
    expect(onControl).not.toHaveBeenCalled();
    expect(screen.queryByText('Done')).toBeNull();
    // a value back in: the clear is gone, the save carries the changed field only
    fireEvent.change(screen.getByLabelText('High'), { target: { value: '12' } });
    expect(screen.queryByRole('note')).toBeNull();
    expect(save()).not.toBeDisabled();
    fireEvent.click(save());
    await waitFor(() => expect(onControl).toHaveBeenCalledTimes(1));
    expect(onControl.mock.calls[0][0]).toMatchObject({ kind: 'set', value: { high: 12 } });
    expect(Object.keys(onControl.mock.calls[0][0].value)).toEqual(['high']);
  });

  it('without the option, a clear beside a real change still keeps Save off: a full save would silently drop the clear', () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    render(<View {...props({}, onControl)} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pump B' } });
    expect(save()).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText('High'), { target: { value: '' } });
    expect(save()).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(M.controls.clearedNotSaved);
    fireEvent.submit(screen.getByRole('form'));
    expect(onControl).not.toHaveBeenCalled();
    // Reset puts the record back and the note goes
    fireEvent.click(reset());
    expect(screen.queryByRole('note')).toBeNull();
    expect(save()).toBeDisabled();
  });

  it('switching a gate off is not a clear: the flag is sent as false, the gated number is simply left out', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    render(<View {...props({ saveChangedOnly: true }, onControl)} />);
    fireEvent.change(screen.getByLabelText('Low'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('Low alarm'));
    expect(screen.queryByRole('note')).toBeNull();
    expect(save()).not.toBeDisabled();
    fireEvent.click(save());
    await waitFor(() => expect(onControl).toHaveBeenCalledTimes(1));
    expect({ ...onControl.mock.calls[0][0].value }).toEqual({ lowFlag: false });
  });
});
