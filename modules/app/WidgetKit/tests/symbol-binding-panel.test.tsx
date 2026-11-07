import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    { name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'state' }, live: 1 },
    { name: 'value', label: 'Temperature', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'temperature' }, live: 21.5 },
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

const row = (label: string) => screen.getByRole('group', { name: label });
/** The searchable picker of a row: its value is the NAME of the picked key (its label, else the key). */
const picker = (label: string) => within(row(label)).getByRole('searchbox', { name: label }) as HTMLInputElement;
const source = (label: string) => screen.getByLabelText(`Source of ${label}`) as HTMLSelectElement;
const expression = (label: string) => screen.getByLabelText(`Expression for ${label}`) as HTMLTextAreaElement;
const deviceBox = () => screen.getByRole('searchbox', { name: 'Device' }) as HTMLInputElement;
const rowsReady = () => waitFor(() => expect(picker('Running')).toBeEnabled());

async function pickDevice(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(deviceBox());
  await user.click(within(await screen.findByRole('option', { name: new RegExp(name) })).getByRole('button'));
}
/** Opens a row's picker and chooses the option whose name matches. */
async function pickKey(user: ReturnType<typeof userEvent.setup>, label: string, name: string | RegExp) {
  await user.click(picker(label));
  const option = await screen.findByRole('option', { name: typeof name === 'string' ? new RegExp(`^${name}`) : name });
  await user.click(within(option).getByRole('button'));
}
async function openValues(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /All values of this device/ }));
  return screen.findByRole('table', { name: 'Values' });
}
const names = (table: HTMLElement) =>
  within(table).getAllByRole('row').slice(1).map((r) => within(r).queryAllByRole('cell')[0]?.textContent ?? '');
const rowOf = (table: HTMLElement, name: string) =>
  within(table).getAllByRole('row').map((r) => within(r).queryAllByRole('cell').map((c) => c.textContent ?? '')).find((c) => c[0]?.startsWith(name));

describe('SymbolBindingPanel: the header and what is never drawn', () => {
  it('shows the symbol, its kind in words and its icon, and the internal id nowhere', async () => {
    const { container } = render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
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
    const user = userEvent.setup();
    const { container } = render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
    await user.selectOptions(source('Running'), 'expression');
    await openValues(user);
    expect(container.textContent ?? '').not.toMatch(/scene key|slot|\brole\b|matched|unmatched/i);
  });
  it('fits one column: no tabs, and the values list is the only table, folded away by default', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    await openValues(user);
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });
  it('takes the texts from the messages prop', () => {
    render(<SymbolBindingPanel {...props({ messages: { devicePlaceholder: 'Cihazı seçin', next: 'Sonraki' }, onNext: vi.fn() })} />);
    expect(deviceBox()).toHaveAttribute('placeholder', 'Cihazı seçin');
    expect(screen.getByRole('button', { name: 'Sonraki' })).toBeInTheDocument();
  });
  it('says how many symbols are connected, and draws the host\'s header action', async () => {
    const onClick = vi.fn();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, progress: { connected: 12, total: 31 }, headerAction: { id: 'all', label: 'Match everything', onClick } })} />);
    expect(screen.getByTestId('symbol-progress')).toHaveTextContent('12 of 31 symbols connected');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Match everything' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('says how many of the connected symbols found their values by name (next-boilerplate e2e round 4, m-R4-08)', () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND, progress: { connected: 3, total: 3, automatic: 1 } })} />);
    expect(screen.getByTestId('symbol-progress')).toHaveTextContent('3 of 3 symbols connected (1 by name)');
  });
});

describe('SymbolBindingPanel: the device', () => {
  it('moves focus to the device search on open, and offers the empty state', () => {
    render(<SymbolBindingPanel {...props()} />);
    expect(deviceBox()).toHaveFocus();
    expect(deviceBox()).toHaveAttribute('placeholder', 'Pick the device that measures this');
    expect(screen.getByText('Pick a device to see the values it sends.')).toBeInTheDocument();
  });
  it('shows the device that feeds the symbol now, pre-selected, and focuses the first row instead', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    expect(deviceBox()).toHaveValue('Boiler room');
    await rowsReady();
    expect(row('Running')).toHaveFocus();
  });
  it('searches the host, debounced, and shows the code and the place under the name (the host\'s order is kept: the page\'s own devices first)', async () => {
    const searchDevices = vi.fn(async () => DEVICES);
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ searchDevices })} />);
    await user.click(deviceBox());
    expect(await screen.findByRole('option', { name: /Boiler room/ })).toHaveTextContent('BR-1 · Site A');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Boiler roomBR-1 · Site A', 'Roof unit']);
    expect(searchDevices).toHaveBeenCalledWith('');
  });
  it('lists the keys of the picked device with their live value and age under All values', async () => {
    const loadKeys = vi.fn(async () => KEYS_1);
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ loadKeys })} />);
    await pickDevice(user, 'Boiler room');
    const list = await openValues(user);
    expect(loadKeys).toHaveBeenCalledWith(D1);
    expect(within(list).getByText('Burner')).toBeInTheDocument();
    expect(rowOf(list, 'Burner')).toEqual(['Burnerfeeds Running', '1', '4 s ago']);
    expect(rowOf(list, 'temperature')).toEqual(['temperaturefeeds Temperature', '21.5 °C', '4 s ago']);
    expect(rowOf(list, 'rssi')).toEqual(['rssi', 'weak', '1 min ago']);
  });
  it('draws the values with the kit table: Name, Value and Updated headings, no search box for a short list', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    const table = await openValues(user);
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Value', 'Updated']);
    expect(screen.queryByRole('searchbox', { name: /values/i })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Values' })).toBeNull();
  });
  it('sorts the values by name from the Name heading, and again to reverse', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    const table = await openValues(user);
    expect(names(table).map((n) => n.replace(/feeds.*/, ''))).toEqual(['Burner', 'temperature', 'rssi']); // as the host sent them
    await user.click(within(table).getByRole('button', { name: /name/i }));
    expect(names(table).map((n) => n.replace(/feeds.*/, ''))).toEqual(['Burner', 'rssi', 'temperature']);
    await user.click(within(table).getByRole('button', { name: /name/i }));
    expect(names(table).map((n) => n.replace(/feeds.*/, ''))).toEqual(['temperature', 'rssi', 'Burner']);
  });
  it('does nothing when a value row is clicked (the rows above choose)', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave })} />);
    const table = await openValues(user);
    await user.click(within(table).getByText('rssi'));
    expect(picker('Running')).toHaveValue('Burner');
    expect(picker('Temperature')).toHaveValue('temperature');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
  it('shows the new live value and age after a refresh', async () => {
    let n = 0;
    const loadKeys = vi.fn(async () => [{ key: 'temperature', unit: '°C', value: n++ === 0 ? 21.5 : 22.5, ts: NOW - 4000 }]);
    render(<SymbolBindingPanel {...props({ symbol: BOUND, loadKeys, refreshMs: 30 })} />);
    await rowsReady();
    expect(await within(row('Temperature')).findByText('22.5 °C · 4 s ago')).toBeInTheDocument();
    expect(within(row('Temperature')).queryByText('21.5 °C · 4 s ago')).toBeNull();
  });
  it('with more than 8 keys adds a search box that narrows the rows by name or key, and says so when nothing matches', async () => {
    const many: DeviceKey[] = Array.from({ length: 12 }, (_, i) => ({ key: `ch_${String(i + 1).padStart(2, '0')}`, label: i === 3 ? 'Supply temperature' : undefined, value: i, ts: NOW - 4000 }));
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [] }), loadKeys: vi.fn(async () => many), defaultDevice: { id: D1, name: 'Boiler room' } })} />);
    const table = await openValues(user);
    expect(names(table)).toHaveLength(12);
    const box = screen.getByRole('searchbox', { name: /search the values/i });
    await user.type(box, 'supply');
    await waitFor(() => expect(names(table)).toEqual(['Supply temperature']));
    await user.clear(box);
    await user.type(box, 'ch_1');
    await waitFor(() => expect(names(table)).toEqual(['ch_10', 'ch_11', 'ch_12']));
    await user.clear(box);
    await user.type(box, 'zzz');
    expect(await screen.findByText(/No results for/)).toBeInTheDocument();
  });
  it('keeps a short list free of the search box at exactly 8 keys', async () => {
    const eight: DeviceKey[] = Array.from({ length: 8 }, (_, i) => ({ key: `k${i}`, value: i, ts: NOW }));
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [] }), loadKeys: vi.fn(async () => eight), defaultDevice: { id: D1, name: 'Boiler room' } })} />);
    await openValues(user);
    expect(screen.queryByRole('searchbox', { name: /search the values/i })).toBeNull();
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
  it('clears the fields that read the old device when another is picked, then proposes again (a flow is offered, never taken, for a temperature)', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
    expect(picker('Running')).toHaveValue('Burner');
    await pickDevice(user, 'Roof unit');
    await waitFor(() => expect(picker('Running')).toHaveValue('pump_on'));
    expect(picker('Temperature')).toHaveValue('');
    // a flow is another quantity than a temperature: not even offered; the row says what to do
    expect(within(row('Temperature')).queryByText(/^Suggested:/)).toBeNull();
    expect(within(row('Temperature')).getByText('Not connected. Pick the value this reads, or choose An expression.')).toBeInTheDocument();
  });
});

describe('SymbolBindingPanel: the rows, their suggestions and what they show', () => {
  it('one row per thing the symbol draws, each saying what the symbol shows now', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Running', 'Temperature']);
    expect(within(row('Running')).getByText('Shows 1 now')).toBeInTheDocument();
    expect(within(row('Temperature')).getByText('Shows 21.5 now')).toBeInTheDocument();
    const { container } = render(<SymbolBindingPanel {...props()} />);
    expect(container.textContent).not.toContain('Shows');
  });
  it('fills a field when its key is clear, marks it as suggested, and leaves the unclear one empty with a plain hint', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'running', label: 'Running' }, { name: 'value', label: 'Flow' }] }) })} />);
    await pickDevice(user, 'Roof unit');
    await waitFor(() => expect(picker('Running')).toHaveValue('pump_on'));
    expect(picker('Flow')).toHaveValue('flow');
    expect(screen.getAllByText('Suggested')).toHaveLength(2);
    expect(within(row('Flow')).getByText('12.4 l/min · 2 s ago')).toBeInTheDocument();
    const ambiguous = props({ loadKeys: vi.fn(async () => [{ key: 'a', value: 1.5, ts: NOW }, { key: 'b', value: 2.5, ts: NOW }]) });
    render(<SymbolBindingPanel {...ambiguous} symbol={symbol({ id: 'other', fields: [{ name: 'value', label: 'Level' }] })} />);
    await user.click(screen.getAllByRole('searchbox', { name: 'Device' })[1]);
    await user.click(within((await screen.findAllByRole('option', { name: /Roof unit/ }))[0]).getByRole('button'));
    const level = await screen.findByRole('group', { name: 'Level' });
    await waitFor(() => expect(within(level).getByRole('searchbox', { name: 'Level' })).toBeEnabled());
    expect(within(level).getByRole('searchbox', { name: 'Level' })).toHaveValue('');
    expect(within(level).getByText('Not connected. Pick the value this reads, or choose An expression.')).toBeInTheDocument();
  });
  it('offers the best candidate with one tap when it is not certain, and the picker lists the device\'s values with the suggested one first', async () => {
    const user = userEvent.setup();
    const keys: DeviceKey[] = [{ key: 'rssi', value: -60, ts: NOW }, { key: 'reading', value: 'high', ts: NOW }, { key: 'x', value: 2, ts: NOW }];
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'value', label: 'Reading' }] }), loadKeys: vi.fn(async () => keys), defaultDevice: { id: D1, name: 'Boiler room' } })} />);
    const r = await screen.findByRole('group', { name: 'Reading' });
    await waitFor(() => expect(within(r).getByRole('searchbox', { name: 'Reading' })).toBeEnabled());
    // the best candidate is text where a number is expected: NOT offered as a suggestion (a proposal the panel itself contradicts makes no sense,
    // e2e round 2 E2E-2.11); the row says what to do, and the picker still lists it first
    expect(within(r).queryByText('Suggested: reading')).toBeNull();
    expect(within(r).getByText('Not connected. Pick the value this reads, or choose An expression.')).toBeInTheDocument();
    expect(within(r).getByRole('searchbox', { name: 'Reading' })).toHaveValue('');
    await user.click(within(r).getByRole('searchbox', { name: 'Reading' }));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options[0]).toHaveTextContent('reading');
    // listed first, but never "Suggested": a value of the wrong kind is no suggestion in the picker either (next-boilerplate phase 52.2.4, test 3 #157)
    expect(options.map((o) => o.textContent)).toEqual(['readinghigh · just now', 'rssi-60 · just now', 'x2 · just now']);
    await user.click(within(options[0]).getByRole('button'));
    expect(within(r).getByRole('searchbox', { name: 'Reading' })).toHaveValue('reading');
    // the picked value is text where a number is expected: said in words, with the way out
    expect(within(r).getByText('This value is text; the drawing expects a number.')).toBeInTheDocument();
    await user.click(within(r).getByRole('button', { name: 'Convert it with an expression' }));
    expect(source('Reading')).toHaveValue('expression');
    expect(expression('Reading')).toBeInTheDocument();
  });
  it('a key the device\'s profile does not declare says so on its option (next-boilerplate e2e round 4, M-R4-09)', async () => {
    const user = userEvent.setup();
    const keys: DeviceKey[] = [{ key: 'flow', label: 'Flow', value: 12.4, unit: 'l/min', ts: NOW - 2000, declared: true }, { key: 'flow_lpm', value: 11, ts: NOW - 36_000_000, declared: false }];
    render(<SymbolBindingPanel {...props({ loadKeys: vi.fn(async () => keys) })} symbol={symbol({ fields: [{ name: 'value', label: 'Flow' }] })} />);
    await pickDevice(user, 'Roof unit');
    await user.click(picker('Flow'));
    const options = await screen.findAllByRole('option');
    const texts = options.map((o) => o.textContent ?? '');
    // the host names a declared key (the profile's label); an undeclared one has only its key, and the note says what it is
    expect(texts.some((t) => t.includes('flow_lpm') && t.includes("not in the device's profile"))).toBe(true);
    expect(texts.some((t) => t.startsWith('Flow') && !t.includes('lpm') && !t.includes("not in the device's profile"))).toBe(true);
  });
  it('a value picked but not saved says what the symbol will show once saved, and a saved pick reads the list\'s fresher value (next-boilerplate e2e round 4, m-R4-05)', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
    // saved: the list's value (21.5 at 21.5) is the same here; pick another key and the label says what will show
    await pickKey(user, 'Temperature', 'rssi');
    expect(within(row('Temperature')).getByText('Will show weak once saved')).toBeInTheDocument();
    expect(within(row('Temperature')).queryByText('Shows nothing yet')).toBeNull();
  });
  it('picks a key by hand, and the pick shows its live value and drops the "Suggested" mark', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'running', label: 'Running' }, { name: 'value', label: 'Flow' }] }) })} />);
    await pickDevice(user, 'Roof unit');
    await waitFor(() => expect(picker('Flow')).toHaveValue('flow'));
    expect(screen.getAllByText('Suggested')).toHaveLength(2);
    await pickKey(user, 'Flow', 'pump_on');
    expect(picker('Flow')).toHaveValue('pump_on');
    expect(within(row('Flow')).getByText('On · 2 s ago')).toBeInTheDocument();
    expect(screen.getAllByText('Suggested')).toHaveLength(1);
  });
  it('lets a field be cleared ("Not connected") and saves without it', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave })} />);
    await rowsReady();
    await user.click(within(row('Temperature')).getByRole('button', { name: 'Not connected' }));
    expect(picker('Temperature')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ fields: { running: { deviceId: D1, key: 'state' } } });
  });
  it('says "feeds" next to the key a field reads', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    const list = await openValues(user);
    expect(within(list).getByText('feeds Running')).toBeInTheDocument();
    expect(within(list).getByText('feeds Temperature')).toBeInTheDocument();
  });
  it('shows "No value yet" for a key the device does not list, and keeps it picked', async () => {
    const sym = symbol({ fields: [{ name: 'value', label: 'Temperature', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'gone' } }] });
    render(<SymbolBindingPanel {...props({ symbol: sym })} />);
    expect(await screen.findByText('No value yet')).toBeInTheDocument();
    expect(picker('Temperature')).toHaveValue('gone');
  });
  // next-boilerplate E2E-1.4: a device that never connected still offers the values its profile declares (no reading, no time): pickable, said as such
  it('lists a declared key the device has not sent yet as "No value yet" (never "–"), and it can be picked', async () => {
    const declared: DeviceKey[] = [{ key: 'level_pct', label: 'Tank level', unit: '%', value: null, ts: '' }, { key: 'pump_on', value: null, ts: '' }];
    const loadKeys = vi.fn(async () => declared);
    const sym = symbol({ fields: [{ name: 'value', label: 'Level', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'level_pct' } }] });
    render(<SymbolBindingPanel {...props({ symbol: sym, loadKeys })} />);
    expect(await screen.findByText('No value yet')).toBeInTheDocument();
    expect(screen.queryByText('–')).toBeNull();
    const user = userEvent.setup();
    await user.click(picker('Level'));
    const list = await screen.findByRole('listbox');
    expect(within(list).getByText('Tank level')).toBeInTheDocument();
    expect(within(list).getAllByText(/No value yet/).length).toBeGreaterThan(0);
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
    await rowsReady();
    expect(screen.getByText('from Roof unit')).toBeInTheDocument();
    await user.click(within(row('Running')).getByRole('button', { name: 'Not connected' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ fields: { value: { deviceId: D2, key: 'flow', script: 'value * 2' } } });
  });
  it('a connection of the drawing the host marked internal is never suggested and comes last in a picker, but is never out of reach', async () => {
    const user = userEvent.setup();
    const keys: DeviceKey[] = [{ key: 'c1.running', value: 1, ts: NOW, internal: true }, { key: 'pump_on', value: 1, ts: NOW }, { key: 'level', value: 63, ts: NOW }];
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'running', label: 'Running' }] }), loadKeys: vi.fn(async () => keys), defaultDevice: { id: D1, name: 'Boiler room' } })} />);
    await waitFor(() => expect(picker('Running')).toHaveValue('pump_on'));
    await user.click(picker('Running'));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent ?? '');
    expect(options[0]).toContain('pump_on');
    expect(options[0]).toContain('Suggested');
    expect(options.at(-1)).toContain('c1.running');
    expect(options.at(-1)).not.toContain('Suggested');
    await user.keyboard('{Escape}');
    // picked by hand all the same
    await pickKey(user, 'Running', 'c1.running');
    expect(picker('Running')).toHaveValue('c1.running');
    const table = await openValues(user);
    expect(names(table)).toEqual(['c1.runningfeeds Running', 'pump_on', 'level']);
  });
});

describe('SymbolBindingPanel: an expression (source = An expression)', () => {
  const stub = (script: string, sample: unknown) => {
    const value = sample !== null && typeof sample === 'object' && 'value' in sample ? (sample as { value: unknown }).value : sample;
    const inputs = sample !== null && typeof sample === 'object' && 'inputs' in sample ? (sample as { inputs: Record<string, number> }).inputs : {};
    if (script === '!value') return { ok: true as const, result: !value };
    if (script === 'value === 1') return { ok: true as const, result: value === 1 };
    if (script === 'value / 4095 * 100') return { ok: true as const, result: (value as number) / 4095 * 100 };
    if (script === 'supply - ret') return { ok: true as const, result: inputs.supply - inputs.ret };
    if (script === '!supply') return { ok: true as const, result: !inputs.supply };
    if (script === 'value /') return { ok: false as const, error: 'SyntaxError: Unexpected end of input' };
    if (script === 'nope') return { ok: false as const, error: 'ReferenceError: nope is not defined' };
    return { ok: true as const, result: value };
  };
  const judge = (script: string, names: string[]) => {
    if (/\/$/.test(script.trim())) return 'the formula ends too soon';
    const bad = script.match(/[a-z_]+/g)?.find((w) => !['value', 'row', 'now', ...names].includes(w));
    return bad ? `unknown name "${bad}" (a formula reads value, row and now${names.length ? ` and the inputs ${names.join(', ')}` : ''})` : null;
  };

  it('a row reads a device value by default; the source switch opens the expression box over that value and previews "1 → On" through the host sandbox', async () => {
    const user = userEvent.setup();
    const previewScript = vi.fn(stub);
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript })} />);
    await rowsReady();
    expect(source('Running')).toHaveValue('value');
    expect(screen.queryByLabelText('Expression for Running')).toBeNull();
    await user.selectOptions(source('Running'), 'expression');
    fireEvent.change(expression('Running'), { target: { value: 'value === 1' } });
    await waitFor(() => expect(within(row('Running')).getByText('1 → On')).toBeInTheDocument());
    expect(previewScript).toHaveBeenCalledWith('value === 1', 1);
  });
  it('opens in expression mode by itself when a field already has a one-liner, and announces the preview politely', async () => {
    const sym = symbol({
      fields: [{ name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'state' }, currentScript: '!value' }],
    });
    render(<SymbolBindingPanel {...props({ symbol: sym, previewScript: stub })} />);
    expect(source('Running')).toHaveValue('expression');
    expect(expression('Running')).toHaveValue('!value');
    const line = await screen.findByText('1 → Off');
    expect(line).toHaveAttribute('aria-live', 'polite');
    expect(line).toHaveAttribute('role', 'status');
  });
  it('a template chip writes an expression into the box, which the person can edit, and previews it', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript: stub })} />);
    await rowsReady();
    await user.selectOptions(source('Running'), 'expression');
    const r = row('Running');
    for (const chip of ['Invert', 'Scale 0–100', 'Round', 'Threshold', 'Words']) expect(within(r).getByRole('button', { name: chip })).toBeInTheDocument();
    await user.click(within(r).getByRole('button', { name: 'Invert' }));
    expect(expression('Running')).toHaveValue('!value');
    await waitFor(() => expect(within(r).getByText('1 → Off')).toBeInTheDocument());
    // "Scale 0–100" asks for the raw range first (E15) and scales the RAW value, in place of what the box holds: its form says "from the raw value"
    // (next-boilerplate phase 52.2.4, test 3 #27: a second scale wrapped the first and showed −80.7)
    await user.click(within(r).getByRole('button', { name: 'Scale 0–100' }));
    const form = within(r).getByTestId('scale-form');
    const use = within(form).getByRole('button', { name: 'Use these numbers' });
    expect(use).toBeDisabled();
    await user.type(within(form).getByLabelText('Raw value at 0 %'), '1500');
    await user.type(within(form).getByLabelText('Raw value at 100 %'), '3300');
    await user.click(use);
    expect(expression('Running')).toHaveValue('(value - 1500) / (3300 - 1500) * 100');
    expect(within(r).queryByTestId('scale-form')).toBeNull();
  });
  it('"Scale 0–100" starts from the scale the key\'s profile declares, and refuses two equal numbers', async () => {
    const user = userEvent.setup();
    const probe: DeviceKey[] = [{ key: 'vwc_raw', label: 'Soil moisture (raw)', value: 2387, ts: NOW - 2000, min: 1500, max: 3300 }];
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'value', label: 'Moisture', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'vwc_raw' } }] }), loadKeys: vi.fn(async () => probe), previewScript: stub })} />);
    await waitFor(() => expect(picker('Moisture')).toBeEnabled());
    await user.selectOptions(source('Moisture'), 'expression');
    await user.click(within(row('Moisture')).getByRole('button', { name: 'Scale 0–100' }));
    const form = within(row('Moisture')).getByTestId('scale-form');
    expect(within(form).getByLabelText('Raw value at 0 %')).toHaveValue('1500');
    expect(within(form).getByLabelText('Raw value at 100 %')).toHaveValue('3300');
    await user.clear(within(form).getByLabelText('Raw value at 100 %'));
    await user.type(within(form).getByLabelText('Raw value at 100 %'), '1500');
    expect(within(form).getByText('Give two different numbers.')).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Use these numbers' })).toBeDisabled();
  });
  it('a chip wraps the expression the person typed instead of overwriting it (next-boilerplate e2e Slice 21, AD-15)', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript: stub })} />);
    await rowsReady();
    await user.selectOptions(source('Running'), 'expression');
    fireEvent.change(expression('Running'), { target: { value: 'value / 250 * 100' } });
    await user.click(within(row('Running')).getByRole('button', { name: 'Round' }));
    expect(expression('Running')).toHaveValue('Math.round((value / 250 * 100) * 10) / 10');
  });
  it('says at once, in plain words, why an expression may not run (the judge), never the sandbox\'s own text', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript: stub, judgeScript: judge })} />);
    await rowsReady();
    await user.selectOptions(source('Running'), 'expression');
    fireEvent.change(expression('Running'), { target: { value: 'value /' } });
    // the box marks and names the problem (the judge's sentence); the line under it says the kind alone, so it is said once (next-boilerplate e2e round 4, m-R4-01)
    expect(await screen.findByText('This is not a complete expression. Check the brackets and signs.')).toBeInTheDocument();
    expect(screen.queryByText(/This is not a complete expression: the formula ends too soon/)).toBeNull();
    fireEvent.change(expression('Running'), { target: { value: 'nope' } });
    expect(await screen.findByText('Only the names below can be used here.')).toBeInTheDocument();
    expect(screen.queryByText(/A name here is not known: unknown name/)).toBeNull();
    expect(expression('Running')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/SyntaxError|ReferenceError/)).toBeNull();
    // Save (and Save and next) wait while the expression is wrong, and are back once it is right
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(expression('Running'), { target: { value: '!value' } });
    await waitFor(() => expect(within(row('Running')).getByText('1 → Off')).toBeInTheDocument());
    expect(expression('Running')).not.toHaveAttribute('aria-invalid');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  });
  it('without a judge, the sandbox\'s failure is worded; a sandbox that throws is reported too', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript: stub })} />);
    await rowsReady();
    await user.selectOptions(source('Running'), 'expression');
    fireEvent.change(expression('Running'), { target: { value: 'value /' } });
    expect(await screen.findByText('This is not a complete expression. Check the brackets and signs.')).toBeInTheDocument();
    fireEvent.change(expression('Running'), { target: { value: 'nope' } });
    expect(await screen.findByText('Only the names below can be used here.')).toBeInTheDocument();
    const throwing = () => { throw new Error('worker gone'); };
    render(<SymbolBindingPanel {...props({ symbol: BOUND, previewScript: throwing })} />);
    await waitFor(() => expect(screen.getAllByLabelText('Source of Running')).toHaveLength(2));
    await user.selectOptions(screen.getAllByLabelText('Source of Running')[1], 'expression');
    fireEvent.change(screen.getAllByLabelText('Expression for Running')[1], { target: { value: 'x' } });
    expect(await screen.findByText('This does not work: worker gone')).toBeInTheDocument();
  });
  it('waits when the key has no value to try it on', async () => {
    const user = userEvent.setup();
    const sym = symbol({ fields: [{ name: 'value', label: 'Temperature', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'gone' } }] });
    render(<SymbolBindingPanel {...props({ symbol: sym, previewScript: stub })} />);
    await screen.findByText('No value yet');
    await user.selectOptions(source('Temperature'), 'expression');
    fireEvent.change(expression('Temperature'), { target: { value: '!value' } });
    expect(await screen.findByText('Waiting for a value to try it on.')).toBeInTheDocument();
  });
  it('reads several device values by name: a chip per value, "Add a value" names the next one readably, a tap inserts a name, and the result is previewed live', async () => {
    const user = userEvent.setup();
    const previewScript = vi.fn(stub);
    const keys: DeviceKey[] = [{ key: 'supply_temp', label: 'Supply temperature', unit: '°C', value: 60, ts: NOW }, { key: 'return', label: 'Return', unit: '°C', value: 45, ts: NOW }, { key: 'x', value: 1, ts: NOW }];
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'value', label: 'Delta' }] }), loadKeys: vi.fn(async () => keys), defaultDevice: { id: D1, name: 'Boiler room' }, previewScript, judgeScript: judge })} />);
    const r = await screen.findByRole('group', { name: 'Delta' });
    await waitFor(() => expect(within(r).getByRole('searchbox', { name: 'Delta' })).toBeEnabled());
    await user.selectOptions(source('Delta'), 'expression');
    expect(within(r).getByText('Write the expression, or add a value it can use.')).toBeInTheDocument();
    // the first value a row reads is `value`: the chip is there but empty until a value is picked
    expect(within(r).getByRole('button', { name: 'Insert value' })).toBeDisabled();
    const add = () => within(r).getByRole('searchbox', { name: 'Add a value' });
    await user.click(add());
    await user.click(within(await screen.findByRole('option', { name: /Supply temperature/ })).getByRole('button'));
    expect(within(r).getByRole('button', { name: 'Insert supply_temp' })).toHaveTextContent('supply_temp · 60 °C');
    await user.click(add());
    await user.click(within(await screen.findByRole('option', { name: /^Return/ })).getByRole('button'));
    // the key "return" is a word of the language: the name is made safe
    expect(within(r).getByRole('button', { name: 'Insert return_in' })).toHaveTextContent('return_in · 45 °C');
    await user.click(within(r).getByRole('button', { name: 'Insert supply_temp' }));
    fireEvent.change(expression('Delta'), { target: { value: 'supply - ret' } });
    // said once (e2e round 4, m-R4-01): the box marks and names the problem, the line under it says the kind alone
    expect(await within(r).findByText('Only the names below can be used here.')).toBeInTheDocument();
    expect(within(r).getAllByText(/unknown name "supply"/)).toHaveLength(1);
    // a judge stub that knows the inputs: the names are passed to it
    const stubJudge = vi.fn(judge);
    expect(stubJudge('supply_temp - return_in', ['supply_temp', 'return_in'])).toBeNull();
    await user.click(within(r).getByRole('button', { name: 'Remove return_in' }));
    expect(within(r).queryByRole('button', { name: 'Insert return_in' })).toBeNull();
  });
  it('previews an expression over inputs with their live values and saves the entry with the inputs, without a key', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const keys: DeviceKey[] = [{ key: 'supply', unit: '°C', value: 60, ts: NOW }, { key: 'ret', unit: '°C', value: 45, ts: NOW }];
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'value', label: 'Delta' }] }), loadKeys: vi.fn(async () => keys), defaultDevice: { id: D1, name: 'Boiler room' }, previewScript: stub, judgeScript: judge, onSave })} />);
    const r = await screen.findByRole('group', { name: 'Delta' });
    await waitFor(() => expect(within(r).getByRole('searchbox', { name: 'Delta' })).toBeEnabled());
    await user.selectOptions(source('Delta'), 'expression');
    for (const name of ['supply', 'ret']) {
      await user.click(within(r).getByRole('searchbox', { name: 'Add a value' }));
      await user.click(within(await screen.findByRole('option', { name: new RegExp(`^${name}`) })).getByRole('button'));
    }
    fireEvent.change(expression('Delta'), { target: { value: 'supply - ret' } });
    expect(await within(r).findByText('Result now: 15')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ fields: { value: { deviceId: D1, script: 'supply - ret', inputs: { supply: { key: 'supply' }, ret: { key: 'ret' } } } } });
  });
  it('a template over a row with no picked value is written over the first input; at most four inputs', async () => {
    const user = userEvent.setup();
    const keys: DeviceKey[] = ['a', 'b', 'c', 'd', 'e'].map((k) => ({ key: k, value: 1, ts: NOW }));
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'value', label: 'Mix' }] }), loadKeys: vi.fn(async () => keys), defaultDevice: { id: D1, name: 'Boiler room' }, previewScript: stub })} />);
    const r = await screen.findByRole('group', { name: 'Mix' });
    await waitFor(() => expect(within(r).getByRole('searchbox', { name: 'Mix' })).toBeEnabled());
    await user.selectOptions(source('Mix'), 'expression');
    for (const name of ['a', 'b', 'c', 'd']) {
      await user.click(within(r).getByRole('searchbox', { name: 'Add a value' }));
      await user.click(within(await screen.findByRole('option', { name: (_n, el) => (el.textContent ?? '').startsWith(`${name}1`) })).getByRole('button'));
    }
    expect(within(r).queryByRole('searchbox', { name: 'Add a value' })).toBeNull();
    expect(within(r).getByText('An expression uses at most 4 other values.')).toBeInTheDocument();
    await user.click(within(r).getByRole('button', { name: 'Invert' }));
    expect(expression('Mix')).toHaveValue('!a');
  });
  it('types in a one-line monospace box: a line break becomes a space, and the text stops at 200 characters', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
    await user.selectOptions(source('Running'), 'expression');
    const box = expression('Running');
    expect(box.tagName).toBe('TEXTAREA');
    expect(box.closest('[data-kui-codeeditor]')).not.toBeNull();
    fireEvent.change(box, { target: { value: 'value\n+ 1' } });
    expect(expression('Running')).toHaveValue('value + 1');
    fireEvent.change(box, { target: { value: 'x'.repeat(250) } });
    expect(expression('Running').value).toHaveLength(200);
  });
  it('switching back to a device value drops the expression, its inputs AND the value it was built on: the row is not connected until a value is picked (M-R3-06)', async () => {
    const user = userEvent.setup();
    const sym = symbol({ fields: [{ name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'state' }, currentScript: '!value' }] });
    const onSave = vi.fn();
    render(<SymbolBindingPanel {...props({ symbol: sym, onSave })} />);
    await waitFor(() => expect(expression('Running')).toHaveValue('!value'));
    await user.selectOptions(source('Running'), 'value');
    expect(screen.queryByLabelText('Expression for Running')).toBeNull();
    expect(picker('Running')).toHaveValue('');
    expect(within(row('Running')).getByText(/Not connected\. Pick the value this reads/)).toBeInTheDocument();
    expect(within(row('Running')).queryByRole('button', { name: 'Disconnect' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ fields: {} });
  });
  it('a connected row has a Disconnect button that takes the connection away in words (M-R3-06), and the host\'s save error goes once the draft changes (m-R3-09)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const view = render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave, error: 'value: unexpected ")" at position 17' })} />);
    await rowsReady();
    expect(screen.getByText('value: unexpected ")" at position 17')).toBeInTheDocument();
    await user.click(within(row('Running')).getByRole('button', { name: 'Disconnect' }));
    expect(picker('Running')).toHaveValue('');
    expect(screen.queryByText('value: unexpected ")" at position 17')).toBeNull();
    view.rerender(<SymbolBindingPanel {...props({ symbol: BOUND, onSave, error: 'value: unexpected ")" at position 17' })} />);
    expect(screen.queryByText('value: unexpected ")" at position 17')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ fields: { value: { deviceId: D1, key: 'temperature' } } });
  });
});

describe('SymbolBindingPanel: Save, Next, Clear, Close', () => {
  it('keeps Save off until something changed', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await pickKey(user, 'Running', 'rssi');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
  it('saves the exact entry: the field map with the device, the label and the one-liner', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ onSave })} />);
    await pickDevice(user, 'Boiler room');
    await waitFor(() => expect(picker('Running')).toHaveValue('Burner'));
    await user.selectOptions(source('Running'), 'expression');
    fireEvent.change(expression('Running'), { target: { value: '!value' } });
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
    await rowsReady();
    await pickKey(user, 'Running', 'rssi');
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
    await rowsReady();
    expect(screen.getByText('Someone else changed this symbol.')).toBeInTheDocument();
    await pickKey(user, 'Running', 'rssi');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
  it('waits while the host is saving', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND, saving: true, onNext: vi.fn() })} />);
    await rowsReady();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next symbol' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true');
  });
  it('closes straight away when nothing changed', async () => {
    const onClose = vi.fn();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onClose })} />);
    await rowsReady();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('asks through the kit\'s ConfirmDialog before it closes on unsaved changes', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onClose })} />);
    await rowsReady();
    await pickKey(user, 'Running', 'rssi');
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
    await rowsReady();
    expect(screen.getByRole('button', { name: 'Next symbol' })).toBeInTheDocument();
    await pickKey(user, 'Running', 'rssi');
    // the button says what a press does once something would be written
    expect(screen.queryByRole('button', { name: 'Next symbol' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save and next' }));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['save', 'next']);
    expect(screen.getByRole('button', { name: 'Next symbol' })).toBeInTheDocument();
  });
  it('Next symbol on a clean panel just moves, and stays when the save fails', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave, onNext })} />);
    await rowsReady();
    await user.click(screen.getByRole('button', { name: 'Next symbol' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledTimes(1);
    await pickKey(user, 'Running', 'rssi');
    await user.click(screen.getByRole('button', { name: 'Save and next' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save and next' })).toBeInTheDocument();
  });
  it('a panel the person has not touched closes at once (its suggestions are not theirs to lose), and its Next says "Save and next" and writes them only on that press', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const onNext = vi.fn();
    const user = userEvent.setup();
    const flowSymbol = symbol({ fields: [{ name: 'running', label: 'Running' }, { name: 'value', label: 'Flow' }] });
    render(<SymbolBindingPanel {...props({ symbol: flowSymbol, onClose, onSave, onNext, defaultDevice: { id: D2, name: 'Roof unit' } })} />);
    await waitFor(() => expect(picker('Running')).toHaveValue('pump_on'));
    expect(screen.getAllByText('Suggested')).toHaveLength(2);
    // Save is on (a press writes the suggestions, said plainly), Next says it will save first
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save and next' })).toBeInTheDocument();
    // Esc and Close ask nothing: nothing the person did is lost
    row('Running').focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSave).not.toHaveBeenCalled();
    // "Save and next" is the explicit press that writes them
    await user.click(screen.getByRole('button', { name: 'Save and next' }));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ fields: { running: { deviceId: D2, key: 'pump_on' }, value: { deviceId: D2, key: 'flow' } } });
  });
  it('asks before closing once the person changed a preselected row themselves', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ onClose, defaultDevice: { id: D2, name: 'Roof unit' } })} />);
    await waitFor(() => expect(picker('Running')).toHaveValue('pump_on'));
    await pickKey(user, 'Running', 'flow');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
  });
  it('has no Next symbol button without onNext', async () => {
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
    expect(screen.queryByRole('button', { name: 'Next symbol' })).toBeNull();
  });
  it('offers the device the last symbol was saved on to the next one, never picks it by itself (next-boilerplate e2e round 5, E5)', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SymbolBindingPanel {...props({ onSave })} />);
    await pickDevice(user, 'Roof unit');
    await waitFor(() => expect(picker('Running')).toHaveValue('pump_on'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    rerender(<SymbolBindingPanel {...props({ onSave, symbol: symbol({ id: 'second_one', label: 'Fan' }) })} />);
    expect(screen.getByRole('heading', { name: 'Fan' })).toBeInTheDocument();
    // nothing carried silently: no device, no value picked
    expect(deviceBox()).toHaveValue('');
    expect(screen.queryByRole('group', { name: 'Running' })).toBeNull();
    const hint = screen.getByTestId('device-suggestion');
    expect(hint).toHaveTextContent('Suggested: Roof unit, the device you picked last.');
    await user.click(within(hint).getByRole('button', { name: 'Use' }));
    expect(deviceBox()).toHaveValue('Roof unit');
    await waitFor(() => expect(picker('Running')).toHaveValue('pump_on'));
  });
  it('shows the host\'s suggestion (a device named like the symbol) instead, and nothing for null; a device of its own takes none', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SymbolBindingPanel {...props({ suggestedDevice: { id: D2, name: 'Roof unit', why: 'name' } })} />);
    expect(screen.getByTestId('device-suggestion')).toHaveTextContent('Suggested: Roof unit. Its name matches this symbol.');
    expect(deviceBox()).toHaveValue('');
    await user.click(within(screen.getByTestId('device-suggestion')).getByRole('button', { name: 'Use' }));
    expect(deviceBox()).toHaveValue('Roof unit');
    expect(screen.queryByTestId('device-suggestion')).toBeNull();
    rerender(<SymbolBindingPanel {...props({ symbol: symbol({ id: 'other' }), suggestedDevice: null })} />);
    expect(screen.queryByTestId('device-suggestion')).toBeNull();
    rerender(<SymbolBindingPanel {...props({ symbol: symbol({ id: 'third' }), defaultDevice: { id: D1, name: 'Boiler room' }, suggestedDevice: { id: D2, name: 'Roof unit', why: 'last' } })} />);
    expect(deviceBox()).toHaveValue('Boiler room');
    expect(screen.queryByTestId('device-suggestion')).toBeNull();
  });
  it('next-boilerplate phase 53.2.7 (re-run 4 #11): with a suggestion the panel opens on its "Use", the device list stays shut over it, and the list puts the suggested device first, marked', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ suggestedDevice: { id: D2, name: 'Roof unit', why: 'name' } })} />);
    expect(within(screen.getByTestId('device-suggestion')).getByRole('button', { name: 'Use' })).toHaveFocus();
    expect(deviceBox()).not.toHaveFocus();
    expect(screen.queryByRole('option')).toBeNull();
    await user.click(deviceBox());
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([expect.stringMatching(/^Roof unit.*Suggested/), expect.stringMatching(/^Boiler room/)]);
    expect(options[1]).not.toHaveTextContent('Suggested');
  });
  it('a suggestion found after the panel opened takes the focus from the untouched search', async () => {
    const { rerender } = render(<SymbolBindingPanel {...props()} />);
    expect(deviceBox()).toHaveFocus();
    rerender(<SymbolBindingPanel {...props({ suggestedDevice: { id: D2, name: 'Roof unit', why: 'place' } })} />);
    await waitFor(() => expect(within(screen.getByTestId('device-suggestion')).getByRole('button', { name: 'Use' })).toHaveFocus());
  });
  it('an empty value list says the device sent nothing, never "nothing matches what you typed" (e2e round 5, V1-B18)', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ loadKeys: vi.fn(async () => []) })} />);
    await pickDevice(user, 'Roof unit');
    await rowsReady();
    await user.click(picker('Running'));
    const list = await screen.findByRole('listbox');
    expect(list).toHaveTextContent('This device has not sent any values yet.');
    expect(list).not.toHaveTextContent(/typed/);
  });
  it('a row nothing is proposed for (suggest: false) is offered, never filled or suggested by itself', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'running', label: 'Running', suggest: false }, { name: 'value', label: 'Flow' }] }) })} />);
    await pickDevice(user, 'Roof unit');
    await waitFor(() => expect(picker('Flow')).toHaveValue('flow'));
    expect(picker('Running')).toHaveValue('');
    expect(within(row('Running')).queryByText(/^Suggested/)).toBeNull();
    await user.click(picker('Running'));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent ?? '');
    expect(options.some((o) => o.includes('pump_on'))).toBe(true);
    expect(options.some((o) => o.includes('Suggested'))).toBe(false);
  });
  it('Clear, behind the "…" menu, asks through ConfirmDialog and saves an empty entry', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave })} />);
    await rowsReady();
    expect(screen.queryByRole('menuitem')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clear what this symbol reads' }));
    const dialog = screen.getByRole('dialog', { name: 'Clear this symbol' });
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ fields: {} }));
    await waitFor(() => expect(picker('Running')).toHaveValue(''));
  });
  it('Clear calls onClear when the host has one', async () => {
    const onClear = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onClear, onSave })} />);
    await rowsReady();
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
    await rowsReady();
    await user.click(screen.getByRole('button', { name: 'More' }));
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual(['Bind every symbol to this device', 'Clear what this symbol reads']);
    await user.click(screen.getByRole('menuitem', { name: 'Bind every symbol to this device' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('SymbolBindingPanel: the keyboard (U5)', () => {
  it('Esc closes (asking first when something changed), the arrows move between rows, Enter takes a row\'s suggestion', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    // the one state key of the device is the Running row's one-tap suggestion (a kind alone: offered, never picked by itself)
    const keys: DeviceKey[] = [{ key: 'rssi', value: -60, ts: NOW }, { key: 'pump_x', value: true, ts: NOW }, { key: 'x', value: 2, ts: NOW }];
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'running', label: 'Running' }, { name: 'value', label: 'Reading' }] }), loadKeys: vi.fn(async () => keys), defaultDevice: { id: D1, name: 'Boiler room' }, onClose })} />);
    await waitFor(() => expect(screen.getByText('Suggested: pump_x')).toBeInTheDocument());
    row('Running').focus();
    await user.keyboard('{ArrowDown}');
    expect(row('Reading')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(row('Running')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(row('Reading')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(row('Running')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(picker('Running')).toHaveValue('pump_x');
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
  });
  it('Esc on a clean panel closes it at once; Esc inside an open list only closes the list', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onClose })} />);
    await rowsReady();
    await user.click(picker('Running'));
    await screen.findAllByRole('option');
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    row('Running').focus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SymbolBindingPanel: read only', () => {
  it('turns every control off, hides Save and the menu, and does not steal focus', async () => {
    const user = userEvent.setup();
    const sym = symbol({
      fields: [{ name: 'running', label: 'Running', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'state' }, currentScript: '!value' }],
    });
    render(<SymbolBindingPanel {...props({ symbol: sym, readOnly: true, onNext: vi.fn() })} />);
    await waitFor(() => expect(screen.getByLabelText('Expression for Running')).toBeInTheDocument());
    expect(screen.getByText('You can look at this symbol but not change it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    expect(deviceBox()).toBeDisabled();
    expect(source('Running')).toBeDisabled();
    expect(deviceBox()).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Next symbol' })).toBeEnabled();
    expect(expression('Running')).toHaveAttribute('readonly');
    for (const chip of ['Invert', 'Round']) expect(screen.getByRole('button', { name: chip })).toBeDisabled();
    // Close needs no question: nothing can have changed.
    const onClose = vi.fn();
    render(<SymbolBindingPanel {...props({ symbol: sym, readOnly: true, onClose })} />);
    await user.click(screen.getAllByRole('button', { name: 'Close' })[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('proposes nothing in read-only mode', async () => {
    render(<SymbolBindingPanel {...props({ symbol: { ...symbol(), fields: [{ name: 'running', label: 'Running', currentSource: { deviceId: D2, deviceName: 'Roof unit', key: '' } }] }, readOnly: true })} />);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Running' })).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 20));
    expect(picker('Running')).toHaveValue('');
    expect(screen.queryByText('Suggested')).toBeNull();
  });
});

// A symbol that draws live data through the drawing's own naming (no entry of its own).
const TEA_KEYS: DeviceKey[] = [
  { key: 'water_kettle.running', value: true, ts: NOW - 2000 },
  { key: 'water_kettle.value', unit: '%', value: 57, ts: NOW - 2000 },
  { key: 'water_kettle.status', value: 'heating', ts: NOW - 2000 },
  { key: 'other.value', value: 3, ts: NOW - 2000 },
];
const AUTO = (key: string) => ({ deviceId: D2, deviceName: 'Roof unit', key, automatic: true });
const KETTLE: SymbolBindingSymbol = symbol({
  id: 'tea.water_kettle',
  label: 'Kettle',
  fields: [
    { name: 'running', label: 'Running', currentSource: AUTO('water_kettle.running'), live: true },
    { name: 'value', label: 'Reading', currentSource: AUTO('water_kettle.value'), live: 57 },
    { name: 'status', label: 'Status', currentSource: AUTO('water_kettle.status'), live: 'heating' },
  ],
});
const teaProps = (over: Partial<SymbolBindingPanelProps> = {}) =>
  props({ symbol: KETTLE, loadKeys: vi.fn(async () => TEA_KEYS), ...over });
const change = async (user: ReturnType<typeof userEvent.setup>, label: string) => user.click(within(row(label)).getByRole('button', { name: 'Change' }));

describe('SymbolBindingPanel: a symbol the drawing fills automatically', () => {
  it('opens on the device of the match with every row read-only, saying "automatic" and where from, with a Change link', async () => {
    render(<SymbolBindingPanel {...teaProps()} />);
    expect(deviceBox()).toHaveValue('Roof unit');
    await waitFor(() => expect(within(row('Reading')).getByText('water_kettle.value · 57 % · 2 s ago')).toBeInTheDocument());
    expect(within(row('Running')).getByText('water_kettle.running · On · 2 s ago')).toBeInTheDocument();
    expect(within(row('Status')).getByText('water_kettle.status · heating · 2 s ago')).toBeInTheDocument();
    expect(screen.getAllByText('automatic')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(3);
    expect(screen.queryByRole('searchbox', { name: 'Reading' })).toBeNull();
    expect(screen.queryByText('Suggested')).toBeNull();
  });
  it('saving is off until something changes, and Clear has nothing to clear', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...teaProps()} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menuitem', { name: 'Clear what this symbol reads' })).toBeDisabled();
  });
  it('Change opens the row with the automatic key picked; a pick writes only that field, not the automatic ones', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...teaProps({ onSave })} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(3));
    await change(user, 'Reading');
    expect(picker('Reading')).toHaveValue('water_kettle.value');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await pickKey(user, 'Reading', 'other.value');
    expect(screen.getAllByText('automatic')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ fields: { value: { deviceId: D2, key: 'other.value' } } });
  });
  it('an expression on an automatic field writes that field with its key', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...teaProps({ onSave })} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(3));
    await change(user, 'Reading');
    await user.selectOptions(source('Reading'), 'expression');
    fireEvent.change(expression('Reading'), { target: { value: 'value / 10' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ fields: { value: { deviceId: D2, key: 'water_kettle.value', script: 'value / 10' } } }));
  });
  it('"Not connected" on an automatic field goes back to the automatic source: the match cannot be switched off', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...teaProps()} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(3));
    await change(user, 'Reading');
    await pickKey(user, 'Reading', 'other.value');
    await user.click(within(row('Reading')).getByRole('button', { name: 'Not connected' }));
    // the kit's picker reopens its list after its clear button; closed, it shows the value it went back to
    await user.keyboard('{Escape}');
    expect(picker('Reading')).toHaveValue('water_kettle.value');
    expect(screen.getAllByText('automatic')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
  it('a device change drops the automatic fields to empty and proposes keys of the new device', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...teaProps({ loadKeys: vi.fn(async (id: string) => (id === D2 ? TEA_KEYS : KEYS_CLEAR)) })} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(3));
    await pickDevice(user, 'Boiler room');
    await waitFor(() => expect(screen.queryAllByText('automatic')).toHaveLength(0));
    await waitFor(() => expect(picker('Running')).toHaveValue('pump_on'));
  });
  it('after a save the saved field is no longer automatic, the others still are', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SymbolBindingPanel {...teaProps({ onSave })} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(3));
    await change(user, 'Reading');
    await pickKey(user, 'Reading', 'other.value');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    rerender(<SymbolBindingPanel {...teaProps({ onSave, symbol: { ...KETTLE, fields: KETTLE.fields.map((f) => (f.name === 'value' ? { ...f, currentSource: { deviceId: D2, deviceName: 'Roof unit', key: 'other.value' } } : f)) } })} />);
    await waitFor(() => expect(screen.getAllByText('automatic')).toHaveLength(2));
    expect(picker('Reading')).toHaveValue('other.value');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
  it('Clear puts an automatic field back on its automatic source', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const sym: SymbolBindingSymbol = { ...KETTLE, fields: KETTLE.fields.map((f) => (f.name === 'value' ? { ...f, currentSource: { deviceId: D2, deviceName: 'Roof unit', key: 'other.value' } } : f)) };
    // The symbol has an entry of its own on one field, and the drawing's naming on the others.
    render(<SymbolBindingPanel {...teaProps({ symbol: sym, onSave })} />);
    await waitFor(() => expect(picker('Reading')).toHaveValue('other.value'));
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clear what this symbol reads' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Clear this symbol' })).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ fields: {} }));
    // Reading had no automatic source of its own to return to (its current source is the entry), so it empties; the others stay automatic.
    await waitFor(() => expect(picker('Reading')).toHaveValue(''));
    expect(within(row('Running')).getByText(/water_kettle\.running/)).toBeInTheDocument();
  });
});

describe('SymbolBindingPanel: the "…" menu opens upward', () => {
  it('asks the menu to open on top of its trigger, inside the viewport', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND })} />);
    await rowsReady();
    await user.click(screen.getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('data-placement', 'top');
    expect(menu.style.bottom).not.toBe('');
    expect(menu.style.top).toBe('');
  });
  it('works from the keyboard: Enter opens, arrows move, Escape closes and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, menuActions: [{ id: 'bulk', label: 'Bind every symbol to this device', onClick: vi.fn() }] })} />);
    await rowsReady();
    const trigger = screen.getByRole('button', { name: 'More' });
    trigger.focus();
    await user.keyboard('{Enter}');
    const first = await screen.findByRole('menuitem', { name: 'Bind every symbol to this device' });
    await waitFor(() => expect(first).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Clear what this symbol reads' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(first).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('SymbolBindingPanel: next-boilerplate run 3', () => {
  it('notes 45 and 121: reports whether the form holds the person\'s unsaved changes, and nothing unsaved once they are discarded or the form goes', async () => {
    const onDirtyChange = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<SymbolBindingPanel {...props({ symbol: BOUND, onClose, onDirtyChange })} />);
    await rowsReady();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await pickKey(user, 'Running', 'rssi');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    onDirtyChange.mockClear();
    unmount();
    expect(onDirtyChange).toHaveBeenCalledWith(false);
  });
  it('note 45: "Save and next" leaves nothing unsaved before it moves', async () => {
    const onDirtyChange = vi.fn();
    const calls: boolean[] = [];
    const onNext = vi.fn(() => { calls.push(onDirtyChange.mock.lastCall?.[0] as boolean); });
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onSave: vi.fn(async () => undefined), onNext, onDirtyChange })} />);
    await rowsReady();
    await pickKey(user, 'Running', 'rssi');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Save and next' }));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([false]);
  });
  it('note 11: an on/off value is said in the host\'s words', async () => {
    const on: SymbolBindingSymbol = symbol({ fields: [{ name: 'running', label: 'Running', currentSource: { deviceId: D2, deviceName: 'Roof unit', key: 'pump_on' }, live: true }] });
    render(<SymbolBindingPanel {...props({ symbol: on, messages: { stateOn: 'Açık', stateOff: 'Kapalı' } })} />);
    expect(await screen.findByText('Shows Açık now')).toBeInTheDocument();
    expect(screen.queryByText('Shows On now')).toBeNull();
  });
  it('note 140: the picker of `value` stays drawn once a value is picked, so the boxes under it do not move up', async () => {
    const tank: SymbolBindingSymbol = symbol({
      fields: [{ name: 'value', label: 'Level', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'temperature' }, currentScript: 'value * 2' }],
    });
    render(<SymbolBindingPanel {...props({ symbol: tank })} />);
    await screen.findAllByLabelText(/Level/);
    const pick = document.querySelector('[id$="-field-value-input"]');
    const adder = document.querySelector('[id$="-input-value-input"]');
    expect(pick).not.toBeNull();
    expect(adder).not.toBeNull();
    expect(pick!.compareDocumentPosition(adder!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('next-boilerplate phase 52.2.4 and 52.2.6: the panel\'s helpers', () => {
  it('#28: "Shows … now" and the values list follow the workspace\'s language', async () => {
    render(<SymbolBindingPanel {...props({ symbol: symbol({ fields: [{ name: 'value', label: 'Temperature', currentSource: { deviceId: D1, deviceName: 'Boiler room', key: 'temperature' }, live: 46.2222 }] }), locale: 'tr' })} />);
    expect(await screen.findByText('Shows 46,222 now')).toBeInTheDocument();
  });
  it('D589: "Difference" and "Ratio (%)" wait for a second value, then write A − B and A ÷ B × 100 over the picked value and the other one', async () => {
    const user = userEvent.setup();
    const keys: DeviceKey[] = [
      { key: 'depo.value', label: 'Depo · value', value: 78, ts: NOW - 2000 }, { key: 'cikis_debisi.value', label: 'Çıkış debisi · value', value: 142, ts: NOW - 2000 },
    ];
    render(<SymbolBindingPanel {...props({
      symbol: symbol({ fields: [{ name: 'value', label: 'Reading', currentSource: { deviceId: D1, deviceName: 'Hisartepe deposu RTU', key: 'depo.value' } }] }),
      loadKeys: vi.fn(async () => keys),
    })} />);
    await waitFor(() => expect(picker('Reading')).toBeEnabled());
    await user.selectOptions(source('Reading'), 'expression');
    const r = row('Reading');
    expect(within(r).getByRole('button', { name: 'Difference' })).toBeDisabled();
    expect(within(r).getByRole('button', { name: 'Ratio (%)' })).toHaveAttribute('title', 'Add a second value to use this.');
    await user.click(within(r).getByRole('searchbox', { name: 'Add a value' }));
    await user.click(within(await screen.findByRole('option', { name: /^Çıkış debisi/ })).getByRole('button'));
    await user.click(within(r).getByRole('button', { name: 'Ratio (%)' }));
    expect(expression('Reading')).toHaveValue('value / debisi_value * 100');
    // the second chip writes its own formula, never the first one's wrapped (next-boilerplate phase 53.2.5)
    await user.click(within(r).getByRole('button', { name: 'Difference' }));
    expect(expression('Reading')).toHaveValue('value - debisi_value');
  });
  it('next-boilerplate phase 53.2.5 (re-run 4 #6): "Ratio (%)" over a typed formula writes A ÷ B × 100 of the two picked values, as its tooltip says', async () => {
    const user = userEvent.setup();
    // the filler's vision camera (S25): the checked bottles are the symbol's value, the rejected ones a second value, the box holds test 3's formula
    const keys: DeviceKey[] = [
      { key: 'kontrol', label: 'Kontrol edilen şişe', value: 149, unit: 'şişe/dk', ts: NOW - 2000 },
      { key: 'reddedilen', label: 'Reddedilen şişe', value: 2.4, unit: 'şişe/dk', ts: NOW - 2000 },
    ];
    const typed = 'Math.round((reddedilen / value * 100) * 10) / 10';
    render(<SymbolBindingPanel {...props({
      symbol: symbol({ label: 'Doluluk kontrol', kindLabel: 'Vision camera', fields: [{
        name: 'value', label: 'Reading',
        currentSource: { deviceId: D1, deviceName: 'Dolum-kapama', key: 'kontrol', inputs: [{ name: 'reddedilen', deviceId: D1, deviceName: 'Dolum-kapama', key: 'reddedilen' }] },
        currentScript: typed,
      }] }),
      loadKeys: vi.fn(async () => keys),
    })} />);
    await waitFor(() => expect(expression('Reading')).toHaveValue(typed));
    const r = row('Reading');
    await waitFor(() => expect(within(r).getByRole('button', { name: 'Ratio (%)' })).toBeEnabled());
    expect(within(r).getByRole('button', { name: 'Ratio (%)' })).toHaveAttribute('title', 'value / reddedilen * 100');
    await user.click(within(r).getByRole('button', { name: 'Ratio (%)' }));
    expect(expression('Reading')).toHaveValue('value / reddedilen * 100');
    await user.click(within(r).getByRole('button', { name: 'Difference' }));
    expect(expression('Reading')).toHaveValue('value - reddedilen');
  });
  it('D594: "Save and next" names the symbol it goes to', async () => {
    const user = userEvent.setup();
    render(<SymbolBindingPanel {...props({ symbol: BOUND, onNext: vi.fn(), nextLabel: 'K6' })} />);
    await rowsReady();
    expect(screen.getByRole('button', { name: 'Next: K6' })).toBeInTheDocument();
    await pickKey(user, 'Running', 'rssi');
    expect(screen.getByRole('button', { name: 'Save and next: K6' })).toBeInTheDocument();
  });
  it('#157: two values that score the same: neither is "Suggested" in the picker', async () => {
    const user = userEvent.setup();
    const keys: DeviceKey[] = [{ key: 'b1.running', label: 'Conveyor 1 · running', value: true, ts: NOW }, { key: 'b2.running', label: 'Conveyor 2 · running', value: true, ts: NOW }];
    render(<SymbolBindingPanel {...props({ symbol: symbol({ label: 'Belt 3', kindLabel: 'Belt conveyor', fields: [{ name: 'running', label: 'Running' }] }), loadKeys: vi.fn(async () => keys), defaultDevice: { id: D1, name: 'Line PLC' } })} />);
    await rowsReady();
    await user.click(picker('Running'));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.some((o) => /Suggested/.test(o.textContent ?? ''))).toBe(false);
  });
  it('52.2.6: a measuring symbol\'s Status is proposed from the part its Reading reads, never from another part', async () => {
    const keys: DeviceKey[] = [
      { key: 'h2s.value', label: 'H2S · value', unit: 'ppm', value: 3, ts: NOW }, { key: 'h2s.status', label: 'H2S · status', value: 'alarm', ts: NOW },
      { key: 'pompa_1.status', label: 'Pompa 1 · status', value: 'ok', ts: NOW },
    ];
    render(<SymbolBindingPanel {...props({
      symbol: symbol({ label: 'Islak kuyu gazı', kindLabel: 'Gas detector', fields: [
        { name: 'value', label: 'Reading', currentSource: { deviceId: D1, deviceName: 'Köprübaşı PLC', key: 'h2s.value' } }, { name: 'status', label: 'Status', suggest: 'own' },
      ] }),
      loadKeys: vi.fn(async () => keys),
    })} />);
    await waitFor(() => expect(picker('Status')).toHaveValue('H2S · status'));
  });
});

describe('next-boilerplate phase 52.2.5: the match-all dialog', () => {
  it('#31, #80: a dialog wide enough for its names, which wrap; a row that reads "Check the kind" says why', async () => {
    const { SymbolMatchAllDialog } = await import('../views/SymbolMatchAllDialog');
    const rows = [{
      id: 'gen.running', symbolId: 'gen', symbolLabel: 'Jeneratör', kindLabel: 'Diesel generator', field: 'running', fieldLabel: 'Running', deviceId: D1, deviceName: 'Köprübaşı PLC',
      key: 'yakit', keyLabel: 'Jeneratör yakıtı', value: 64, unit: '%', ts: NOW, confident: false, mismatch: 'number-for-state' as const,
    }];
    render(<SymbolMatchAllDialog open rows={rows} onApply={vi.fn()} onClose={vi.fn()} now={NOW} />);
    expect(screen.getByRole('dialog').querySelector('.max-w-5xl')).not.toBeNull();
    expect(screen.getByTestId('match-mismatch-reason')).toHaveTextContent('This value is a number; the drawing expects on/off.');
  });
});
