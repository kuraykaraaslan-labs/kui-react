import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SymbolBindingPanel, type SymbolBindingPanelProps, type SymbolBindingSymbol } from '../views/SymbolBindingPanel';
import type { DeviceKey, DeviceOption } from '../views/symbol-binding-logic';

const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const NOW = 1_800_000_000_000;
// The internal id of the symbol: it must never be drawn.
const ID = 'combi_boiler_7f3a';

const DEVICES: DeviceOption[] = [
  { id: D1, name: 'Boiler room', code: 'BR-1', hint: 'Site A' },
  { id: D2, name: 'Roof unit' },
];
const KEYS_1: DeviceKey[] = [
  { key: 'state', label: 'Burner', value: 1, ts: NOW - 4000 },
  { key: 'temperature', unit: '°C', value: 21.5, ts: NOW - 4000 },
  { key: 'rssi', value: 'weak', ts: NOW - 90_000 },
];
// A device with one state and one measure: both fields are suggested.
const KEYS_CLEAR: DeviceKey[] = [
  { key: 'pump_on', value: true, ts: NOW - 2000 },
  { key: 'flow', unit: 'l/min', value: 12.4, ts: NOW - 2000 },
];

function symbol(over: Partial<SymbolBindingSymbol> = {}): SymbolBindingSymbol {
  return {
    id: ID,
    label: 'Boiler',
    kindLabel: 'Combi boiler',
    icon: <svg data-testid="icon" />,
    fields: [
      { name: 'running', label: 'Running' },
      { name: 'value', label: 'Temperature' },
    ],
    ...over,
  };
}

const BOUND: SymbolBindingSymbol = symbol({
  fields: [
    { name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'state' } },
    { name: 'value', label: 'Temperature', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'temperature' } },
  ],
});

function props(over: Partial<SymbolBindingPanelProps> = {}): SymbolBindingPanelProps {
  return {
    symbol: symbol(),
    searchDevices: vi.fn(async (q: string) => DEVICES.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()))),
    loadKeys: vi.fn(async (id: string) => (id === D1 ? KEYS_1 : KEYS_CLEAR)),
    onSave: vi.fn(),
    onClose: vi.fn(),
    refreshMs: 0,
    now: NOW,
    ...over,
  };
}

const field = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;
const deviceBox = () => screen.getByRole('searchbox', { name: 'Device' }) as HTMLInputElement;

async function pickDevice(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(deviceBox());
  await user.click(within(await screen.findByRole('option', { name: new RegExp(name) })).getByRole('button'));
}

describe('SymbolBindingPanel: the header and what is never drawn', () => {
  it('shows the symbol, its kind in words and its icon, and the internal id nowhere', async () => {
    const { container } = render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(screen.getByRole('heading', { name: 'Boiler' })).toBeInTheDocument();
    expect(screen.getByText('Combi boiler')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.queryByText(ID)).toBeNull();
    expect(container.textContent).not.toContain(ID);
    expect(container.querySelector('[title]')).toBeNull();
    // The id lives only in a data attribute, for tests.
    expect(container.querySelector(`[data-symbol-id="${ID}"]`)).not.toBeNull();
  });
  it('never uses the words of the binding internals', async () => {
    const { container } = render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await screen.findByRole('list', { name: 'Values' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Convert' }));
    expect(container.textContent ?? '').not.toMatch(/scene key|slot|\brole\b|matched|unmatched/i);
  });
  it('fits one column: no tabs, no table', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('takes the texts from the messages prop', () => {
    render(<SymbolBindingPanel {...props({ messages: { devicePlaceholder: 'Cihazı seçin', next: 'Sonraki' }, onNext: vi.fn() })} />);
    expect(deviceBox()).toHaveAttribute('placeholder', 'Cihazı seçin');
    expect(screen.getByRole('button', { name: 'Sonraki' })).toBeInTheDocument();
  });
});

describe('SymbolBindingPanel: the device', () => {
  it('moves focus to the device search on open, and offers the empty state', () => {
    render(<SymbolBindingPanel {...props()} />);
    expect(deviceBox()).toHaveFocus();
    expect(deviceBox()).toHaveAttribute('placeholder', 'Pick the device that measures this');
    expect(screen.getByText('Pick a device to see the values it sends.')).toBeInTheDocument();
  });
  it('shows the device that feeds the symbol now, pre-selected, and focuses the first value picker instead', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    expect(deviceBox()).toHaveValue('Boiler room');
    await screen.findByRole('list', { name: 'Values' });
    expect(field('Running')).toHaveFocus();
  });
  it('searches the host, debounced, and shows the code and hint under the name', async () => {
    const searchDevices = vi.fn(async () => DEVICES);
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ searchDevices })} />);
    await user.click(deviceBox());
    expect(await screen.findByRole('option', { name: /Boiler room/ })).toHaveTextContent('BR-1 · Site A');
    expect(searchDevices).toHaveBeenCalledWith('');
  });
  it('lists the keys of the picked device with their live value and age', async () => {
    const loadKeys = vi.fn(async () => KEYS_1);
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ loadKeys })} />);
    await pickDevice(user, 'Boiler room');
    const list = await screen.findByRole('list', { name: 'Values' });
    expect(loadKeys).toHaveBeenCalledWith(D1);
    expect(within(list).getByText('Burner')).toBeInTheDocument();
    expect(within(list).getByText('1 · 4 s ago')).toBeInTheDocument();
    expect(within(list).getByText('21.5 °C · 4 s ago')).toBeInTheDocument();
    expect(within(list).getByText('weak · 1 min ago')).toBeInTheDocument();
  });
  it('says so when the device has sent nothing, and when the values cannot be loaded (with a retry)', async () => {
    const user = userEvent.setup();
    const loadKeys = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([]);
    render(<SymbolBindingPanel {...props({ loadKeys })} />);
    await pickDevice(user, 'Boiler room');
    expect(await screen.findByText('The values could not be loaded.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('This device has not sent any values yet.')).toBeInTheDocument();
  });
  it('asks the host for the values again every refreshMs', async () => {
    const loadKeys = vi.fn(async () => KEYS_1);
    render(<SymbolBindingPanel {...props({ symbol: BOUND, loadKeys, refreshMs: 30 })} />);
    await waitFor(() => expect(loadKeys.mock.calls.length).toBeGreaterThanOrEqual(3));
  });
  it('clears the fields that read the old device when another is picked, then proposes again', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(field('Running').value).toBe('state');
    await pickDevice(user, 'Roof unit');
    await waitFor(() => expect(field('Running').value).toBe('pump_on'));
    expect(field('Temperature').value).toBe('flow');
  });
});

describe('SymbolBindingPanel: values and suggestions', () => {
  it('fills a field when its key is clear, marks it as suggested, and leaves the unclear one empty', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props()} />);
    await pickDevice(user, 'Roof unit');
    await waitFor(() => expect(field('Running').value).toBe('pump_on'));
    expect(field('Temperature').value).toBe('flow');
    expect(screen.getAllByText('Suggested')).toHaveLength(2);
    expect(screen.getAllByText('12.4 l/min · 2 s ago')).toHaveLength(2); // in the list and under the picker
  });
  it('leaves an ambiguous field empty on "Not used"', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props()} />);
    await pickDevice(user, 'Boiler room'); // state (1) fits Running; temperature (21.5) is the one measure; rssi is text
    await waitFor(() => expect(field('Running').value).toBe('state'));
    expect(field('Temperature').value).toBe('temperature');
    const ambiguous = props({ loadKeys: vi.fn(async () => [{ key: 'a', value: 1.5, ts: NOW }, { key: 'b', value: 2.5, ts: NOW }]) });
    render(<SymbolBindingPanel {...ambiguous} symbol={symbol({ id: 'other', fields: [{ name: 'value', label: 'Temperature' }] })} />);
    await user.click(screen.getAllByRole('searchbox', { name: 'Device' })[1]);
    await user.click(within((await screen.findAllByRole('option', { name: /Roof unit/ }))[0]).getByRole('button'));
    await waitFor(() => expect(screen.getAllByRole('list', { name: 'Values' })).toHaveLength(2));
    expect(screen.getAllByLabelText('Temperature')[1]).toHaveValue('');
  });
  it('picks a key by hand, and the pick shows its live value and drops the "Suggested" mark', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props()} />);
    await pickDevice(user, 'Roof unit');
    await waitFor(() => expect(field('Temperature').value).toBe('flow'));
    await user.selectOptions(field('Temperature'), 'pump_on');
    expect(field('Temperature').value).toBe('pump_on');
    expect(screen.getAllByText('Suggested')).toHaveLength(1);
  });
  it('lets a field be cleared ("Not used") and saves without it', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.selectOptions(field('Temperature'), '');
    expect(field('Temperature').value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ fields: { running: { deviceId: D1, key: 'state' } } });
  });
  it('says "feeds" next to the key a field reads', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    const list = await screen.findByRole('list', { name: 'Values' });
    expect(within(list).getByText('feeds Running')).toBeInTheDocument();
    expect(within(list).getByText('feeds Temperature')).toBeInTheDocument();
  });
  it('shows "No value yet" for a key the device does not list, and keeps it selectable', async () => {
    const sym = symbol({ fields: [{ name: 'value', label: 'Temperature', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'gone' } }] });
    render(<SymbolBindingPanel {...props({ symbol: sym })} />);
    expect(await screen.findByText('No value yet')).toBeInTheDocument();
    expect(field('Temperature').value).toBe('gone');
  });
  it('shows a field that reads another device with that device named, and keeps it on save', async () => {
    const onSave = vi.fn();
    const sym = symbol({
      fields: [
        { name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'state' } },
        { name: 'value', label: 'Temperature', currentSource: { deviceId: D2, deviceName: 'Roof unit', key: 'flow' }, currentScript: 'value * 2' },
      ],
    });
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: sym, onSave })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(screen.getByText('from Roof unit')).toBeInTheDocument();
    await user.selectOptions(field('Running'), '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ fields: { value: { deviceId: D2, key: 'flow', script: 'value * 2' } } });
  });
});

describe('SymbolBindingPanel: Convert', () => {
  const stub = (script: string, sample: unknown) => {
    if (script === '!value') return { ok: true as const, result: !sample };
    if (script === 'value === 1') return { ok: true as const, result: sample === 1 };
    if (script === 'value /') return { ok: false as const, error: 'SyntaxError: Unexpected end of input' };
    if (script === 'nope') return { ok: false as const, error: 'ReferenceError: nope is not defined' };
    return { ok: true as const, result: sample };
  };

  it('is collapsed by default', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript: stub })} />);
    await screen.findByRole('list', { name: 'Values' });
    const head = screen.getByRole('button', { name: 'Convert' });
    expect(head).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Convert Running')).toBeNull();
  });
  it('opens by itself when a field already has a one-liner, and previews "1 → true" through the host sandbox', async () => {
    const sym = symbol({
      fields: [{ name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'state' }, currentScript: 'value === 1' }],
    });
    const previewScript = vi.fn(stub);
    render(<SymbolBindingPanel {...props({ symbol: sym, previewScript })} />);
    expect(screen.getByRole('button', { name: 'Convert' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Convert Running')).toHaveValue('value === 1');
    await waitFor(() => expect(screen.getByText('1 → true')).toBeInTheDocument());
    expect(previewScript).toHaveBeenCalledWith('value === 1', 1);
  });
  it('announces the preview politely', async () => {
    const sym = symbol({ fields: [{ name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'state' }, currentScript: '!value' }] });
    render(<SymbolBindingPanel {...props({ symbol: sym, previewScript: stub })} />);
    const line = await screen.findByText('1 → false');
    expect(line).toHaveAttribute('aria-live', 'polite');
    expect(line).toHaveAttribute('role', 'status');
  });
  it('fills the one-liner from a quick-fill chip, which the person can edit, and previews it', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript: stub })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    const group = screen.getByRole('group', { name: 'Running' });
    for (const chip of ['Invert', 'Scale 0–100', 'Round', 'Threshold', 'Words']) expect(within(group).getByRole('button', { name: chip })).toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'Invert' }));
    expect(screen.getByLabelText('Convert Running')).toHaveValue('!value');
    await waitFor(() => expect(within(group).getByText('1 → false')).toBeInTheDocument());
    await user.click(within(group).getByRole('button', { name: 'Scale 0–100' }));
    expect(screen.getByLabelText('Convert Running')).toHaveValue('value / 4095 * 100');
  });
  it('shows an error in words, never the sandbox\'s own text, and does not throw', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript: stub })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    const input = screen.getByLabelText('Convert Running');
    await user.type(input, 'value /');
    expect(await screen.findByText('This is not a complete expression. Check the brackets and signs.')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'nope');
    expect(await screen.findByText('Only value can be used here.')).toBeInTheDocument();
    expect(screen.queryByText(/SyntaxError|ReferenceError/)).toBeNull();
  });
  it('shows the failure of a sandbox that throws', async () => {
    const user = userEvent.setup();
    const previewScript = () => { throw new Error('worker gone'); };
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    await user.type(screen.getByLabelText('Convert Running'), 'x');
    expect(await screen.findByText('This does not work: worker gone')).toBeInTheDocument();
  });
  it('waits when the key has no value to try it on', async () => {
    const user = userEvent.setup();
    const sym = symbol({ fields: [{ name: 'value', label: 'Temperature', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'gone' } }] });
    render(<SymbolBindingPanel {...props({ symbol: sym, previewScript: stub })} />);
    await screen.findByText('No value yet');
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    await user.type(screen.getByLabelText('Convert Temperature'), '!value');
    expect(await screen.findByText('Waiting for a value to try it on.')).toBeInTheDocument();
  });
  it('asks for a value first when no field has a key, and only offers fields that have one', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'value', label: 'Temperature' }] }), loadKeys: vi.fn(async () => [{ key: 'a', value: 1.5, ts: NOW }, { key: 'b', value: 2.5, ts: NOW }]) })} />);
    await pickDevice(user, 'Roof unit');
    await screen.findByRole('list', { name: 'Values' });
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    expect(screen.getByText('Pick a value above first.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Convert Temperature')).toBeNull();
  });
  it('types in a single-line monospace input capped at 200 characters', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    const input = screen.getByLabelText('Convert Running');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('maxlength', '200');
    expect(input.closest('div[class*="font-mono"]')).not.toBeNull();
  });
});

describe('SymbolBindingPanel: Save, Next, Clear, Close', () => {
  it('keeps Save off until something changed', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.selectOptions(field('Running'), 'rssi');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
  it('saves the exact entry: the field map with the device, the label and the one-liner', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ onSave })} />);
    await pickDevice(user, 'Boiler room');
    await waitFor(() => expect(field('Running').value).toBe('state'));
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    await user.type(screen.getByLabelText('Convert Running'), '!value');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({
      fields: {
        running: { deviceId: D1, key: 'state', label: 'Burner', script: '!value' },
        value: { deviceId: D1, key: 'temperature' },
      },
    });
  });
  it('is clean again once the host answers and shows the saved symbol', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.selectOptions(field('Running'), 'rssi');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    // The host redraws with the new source: still clean.
    const saved = symbol({
      fields: [
        { name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'rssi' } },
        BOUND.fields[1],
      ],
    });
    rerender(<SymbolBindingPanel {...props({ symbol: saved, onSave })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
  it('stays on its changes when the save fails (rejects or resolves false)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValueOnce(new Error('409')).mockResolvedValueOnce(false);
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave, error: 'Someone else changed this symbol.' })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(screen.getByText('Someone else changed this symbol.')).toBeInTheDocument();
    await user.selectOptions(field('Running'), 'rssi');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
  it('waits while the host is saving', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND, saving: true, onNext: vi.fn() })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next symbol' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true');
  });
  it('closes straight away when nothing changed', async () => {
    const onClose = vi.fn();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onClose })} />);
    await screen.findByRole('list', { name: 'Values' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('asks through the kit\'s ConfirmDialog before it closes on unsaved changes', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onClose })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.selectOptions(field('Running'), 'rssi');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Discard your changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('Next symbol saves first when there are changes, then moves', async () => {
    const order: string[] = [];
    const onSave = vi.fn(async () => { order.push('save'); });
    const onNext = vi.fn(() => { order.push('next'); });
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave, onNext })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.selectOptions(field('Running'), 'rssi');
    await user.click(screen.getByRole('button', { name: 'Next symbol' }));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['save', 'next']);
  });
  it('Next symbol on a clean panel just moves, and stays when the save fails', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave, onNext })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.click(screen.getByRole('button', { name: 'Next symbol' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledTimes(1);
    await user.selectOptions(field('Running'), 'rssi');
    await user.click(screen.getByRole('button', { name: 'Next symbol' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
  it('has no Next symbol button without onNext', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(screen.queryByRole('button', { name: 'Next symbol' })).toBeNull();
  });
  it('starts the next symbol on the device the last one was saved on', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SymbolBindingPanel {...props({ onSave })} />);
    await pickDevice(user, 'Roof unit');
    await waitFor(() => expect(field('Running').value).toBe('pump_on'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    rerender(<SymbolBindingPanel {...props({ onSave, symbol: symbol({ id: 'second_one', label: 'Fan' }) })} />);
    expect(screen.getByRole('heading', { name: 'Fan' })).toBeInTheDocument();
    expect(deviceBox()).toHaveValue('Roof unit');
    await waitFor(() => expect(field('Running').value).toBe('pump_on'));
  });
  it('Clear, behind the "…" menu, asks through ConfirmDialog and saves an empty entry', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(screen.queryByRole('menuitem')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clear what this symbol reads' }));
    const dialog = screen.getByRole('dialog', { name: 'Clear this symbol' });
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ fields: {} }));
    await waitFor(() => expect(field('Running').value).toBe(''));
  });
  it('Clear calls onClear when the host has one', async () => {
    const onClear = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onClear, onSave })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clear what this symbol reads' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Clear this symbol' })).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1));
    expect(onSave).not.toHaveBeenCalled();
  });
  it('puts the host\'s bulk shortcuts in the same menu, above Clear', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, menuActions: [{ id: 'bulk', label: 'Bind every symbol to this device', onClick }] })} />);
    await screen.findByRole('list', { name: 'Values' });
    await user.click(screen.getByRole('button', { name: 'More' }));
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual(['Bind every symbol to this device', 'Clear what this symbol reads']);
    await user.click(screen.getByRole('menuitem', { name: 'Bind every symbol to this device' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('SymbolBindingPanel: read only', () => {
  it('turns every control off, hides Save and the menu, and does not steal focus', async () => {
    const user = userEvent.setup();
    const sym = symbol({
      fields: [{ name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'state' }, currentScript: '!value' }],
    });
    render(<SymbolBindingPanel {...props({ symbol: sym, readOnly: true, onNext: vi.fn() })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(screen.getByText('You can look at this symbol but not change it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    expect(deviceBox()).toBeDisabled();
    expect(field('Running')).toBeDisabled();
    expect(deviceBox()).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Next symbol' })).toBeEnabled();
    expect(screen.getByLabelText(/Convert Running/)).toHaveAttribute('readonly');
    for (const chip of ['Invert', 'Round']) expect(screen.getByRole('button', { name: chip })).toBeDisabled();
    // Close needs no question: nothing can have changed.
    const onClose = vi.fn();
    render(<SymbolBindingPanel {...props({ symbol: sym, readOnly: true, onClose })} />);
    await user.click(screen.getAllByRole('button', { name: 'Close' })[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('proposes nothing in read-only mode', async () => {
    const sym = symbol({ fields: [{ name: 'running', label: 'Running', currentSource: undefined }], });
    render(<SymbolBindingPanel {...props({ symbol: { ...sym, fields: [{ name: 'running', label: 'Running', currentSource: { deviceId: D2, deviceName: 'Roof unit', key: '' } }] }, readOnly: true })} />);
    await screen.findByRole('list', { name: 'Values' });
    expect(field('Running').value).toBe('');
  });
});
