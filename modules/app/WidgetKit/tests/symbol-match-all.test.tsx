import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SymbolMatchAllDialog } from '../views/SymbolMatchAllDialog';
import { entriesOfMatches, matchAllRows, type DeviceKey, type MatchRow, type MatchSymbol } from '../views/symbol-binding-logic';

/**
 * "Match everything" (slice 16, U3): one proposal per unconnected parameter of every symbol of the drawing, the certain ones ticked by default, one Apply.
 */
const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const NOW = 1_800_000_000_000;
const k = (key: string, value: unknown, extra: Partial<DeviceKey> = {}): DeviceKey => ({ key, value, ts: NOW - 3000, ...extra });

// The acceptance journey's device: arbitrary key names, no convention.
const symbols: MatchSymbol[] = [
  { id: 'thermo', label: 'Thermometer', kindLabel: 'Thermometer', deviceId: D1, deviceName: 'Kitchen box', fields: [{ name: 'value', label: 'Reading' }] },
  { id: 'pump', label: 'Pump', kindLabel: 'Pump', deviceId: D1, deviceName: 'Kitchen box', fields: [{ name: 'running', label: 'Running' }, { name: 'value', label: 'Flow' }, { name: 'value2', label: 'Setpoint' }, { name: 'speed', label: 'Speed' }] },
  { id: 'door', label: 'Door', kindLabel: 'Door', deviceId: D2, deviceName: 'Roof unit', fields: [{ name: 'running', label: 'Open' }] },
  { id: 'far', label: 'Far', kindLabel: 'Far', deviceId: 'unknown-device', deviceName: 'Nobody', fields: [{ name: 'value', label: 'Reading' }] },
];
const keys = new Map<string, DeviceKey[]>([
  [D1, [k('temp_1', 21.5), k('pump_on', true), k('flow_lpm', 12.4, { unit: 'l/min' }), k('setpointx', 1)]],
  [D2, [k('door', 'closed'), k('fan_rpm', 1200, { unit: 'rpm' })]],
]);

describe('matchAllRows', () => {
  it('proposes the best key of the symbol\'s device for each parameter, once per symbol, certain or possible; nothing for an unread device, a tie or a kind alone', () => {
    const rows = matchAllRows(symbols, keys);
    expect(rows.map((r) => [r.id, r.key, r.confident])).toEqual([
      ['thermo.value', 'temp_1', true],
      ['pump.running', 'pump_on', true],
      ['pump.value', 'flow_lpm', true],
      // "setpointx" holds the word but sends a 0/1: offered, unticked, with the kind said
      ['pump.value2', 'setpointx', false],
      // the pump's speed: the one number left is a temperature by its name, never a speed: nothing proposed
      ['door.running', 'door', true],
    ]);
    expect(rows[0]).toMatchObject({ symbolLabel: 'Thermometer', fieldLabel: 'Reading', deviceName: 'Kitchen box', keyLabel: 'temp_1', value: 21.5 });
    expect(rows[2]).toMatchObject({ unit: 'l/min' });
    expect(rows[3]).toMatchObject({ mismatch: 'state-for-number' });
  });
  it('a tie between two state keys proposes nothing for that parameter; a mismatch on a named key is carried', () => {
    const rows = matchAllRows([{ ...symbols[2], fields: [{ name: 'running', label: 'Running' }, { name: 'value', label: 'Reading' }] }], new Map([[D2, [k('a', true), k('b', false), k('reading', 'high')]]]));
    expect(rows.map((r) => r.id)).toEqual(['door.value']);
    expect(rows[0]).toMatchObject({ key: 'reading', mismatch: 'text-for-number', confident: false });
  });
  it('the one state key of the device is proposed to every symbol\'s Running, but certain only where a word names that symbol (the real drawing, U3)', () => {
    const keys2 = new Map([[D1, [k('temp_1', 21.5), k('pump_on', true), k('supply_temp', 60.2), k('level_pct', 63)]]]);
    const drawing: MatchSymbol[] = [
      { id: 'pool', label: 'Pool', kindLabel: 'Open basin', deviceId: D1, deviceName: 'd', fields: [{ name: 'running', label: 'Running' }, { name: 'value', label: 'Reading' }] },
      { id: 'valve_supply', label: 'Supply valve', kindLabel: 'Actuated valve', deviceId: D1, deviceName: 'd', fields: [{ name: 'running', label: 'Running' }, { name: 'position', label: 'Opening' }] },
      { id: 'strainer', label: 'Strainer', kindLabel: 'Strainer', deviceId: D1, deviceName: 'd', fields: [{ name: 'running', label: 'Running' }] },
      { id: 'pump_circulation', label: 'Circulation pump', kindLabel: 'Pump', deviceId: D1, deviceName: 'd', fields: [{ name: 'running', label: 'Running' }] },
    ];
    const rows = matchAllRows(drawing, keys2);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    // pump_on fits every Running by its kind: proposed to all four, ticked only for the pump (its own word)
    expect(by['pool.running']).toMatchObject({ key: 'pump_on', confident: false });
    expect(by['valve_supply.running']).toMatchObject({ key: 'pump_on', confident: false });
    expect(by['strainer.running']).toMatchObject({ key: 'pump_on', confident: false });
    expect(by['pump_circulation.running']).toMatchObject({ key: 'pump_on', confident: true });
    // "supply_temp" shares the valve's word but measures a temperature, not an opening: offered, not certain, and said
    expect(by['valve_supply.position']).toMatchObject({ key: 'supply_temp', confident: false, mismatch: 'quantity' });
  });
  it('a key a symbol reads already is never proposed again for it', () => {
    const rows = matchAllRows([{ ...symbols[1], fields: [{ name: 'value', label: 'Reading' }], taken: ['pump_on', 'flow_lpm'] }], new Map([[D1, [k('pump_on', true), k('flow_lpm', 12.4), k('temp_1', 21.5)]]]));
    expect(rows.map((r) => [r.id, r.key])).toEqual([['pump.value', 'temp_1']]);
  });
  it('the element rule wins for a device that follows the convention', () => {
    const rows = matchAllRows([{ ...symbols[0], element: 'tea_maker' }], new Map([[D1, [k('tea_maker.value', 57), k('coffee.value', 3)]]]));
    expect(rows[0]).toMatchObject({ key: 'tea_maker.value', confident: true });
  });
});

describe('entriesOfMatches', () => {
  it('groups the ticked rows by symbol as entries with the device, the key and the label; a row left out is not written', () => {
    const rows = matchAllRows(symbols, keys);
    const out = entriesOfMatches(rows, new Set(['thermo.value', 'pump.running', 'pump.value']));
    expect(out).toEqual({
      thermo: { fields: { value: { deviceId: D1, key: 'temp_1' } } },
      pump: { fields: { running: { deviceId: D1, key: 'pump_on' }, value: { deviceId: D1, key: 'flow_lpm' } } },
    });
    expect(entriesOfMatches(rows, new Set())).toEqual({});
  });
});

const rowsFor = () => matchAllRows(symbols, keys);

describe('SymbolMatchAllDialog', () => {
  it('shows one row per proposal in the kit table, the certain ones ticked, and applies the ticked ids', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<SymbolMatchAllDialog open rows={rowsFor()} onApply={onApply} onClose={vi.fn()} now={NOW} />);
    const dialog = screen.getByRole('dialog', { name: 'Match everything' });
    expect(within(dialog).getByText('5 values proposed for this drawing; 4 are certain and ticked. Untick what is wrong, then apply.')).toBeInTheDocument();
    const table = within(dialog).getByRole('table', { name: 'Proposals' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(expect.arrayContaining(['Symbol', 'Shows', 'Reads', 'Certain']));
    const boxes = within(table).getAllByRole('checkbox', { name: /Apply this proposal/ });
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, true, true, false, true]);
    expect(within(table).getAllByText('Yes')).toHaveLength(4);
    expect(within(table).getByText('Check the kind')).toBeInTheDocument();
    expect(within(table).getByText('21.5 · 3 s ago · Kitchen box')).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/scene key|slot|\brole\b/i);
    await user.click(boxes[2]);
    await user.click(within(dialog).getByRole('button', { name: 'Apply 3 proposals' }));
    expect(onApply).toHaveBeenCalledWith(['thermo.value', 'pump.running', 'door.running']);
  });
  it('says so when there is nothing to propose, and Apply is off', () => {
    render(<SymbolMatchAllDialog open rows={[]} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Nothing to propose: every symbol is connected, or the devices have not sent values yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply 0 proposals' })).toBeDisabled();
  });
  it('waits while the host applies, and Cancel closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<SymbolMatchAllDialog open rows={rowsFor()} onApply={vi.fn()} onClose={onClose} busy />);
    expect(screen.getByRole('button', { name: 'Apply 4 proposals' })).toBeDisabled();
    rerender(<SymbolMatchAllDialog open rows={rowsFor()} onApply={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('rows that arrive after the dialog opened (the host reads first) are ticked by their certainty, and Apply counts them', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const { rerender } = render(<SymbolMatchAllDialog open rows={[]} onApply={onApply} onClose={vi.fn()} busy now={NOW} />);
    expect(screen.getByRole('button', { name: 'Apply 0 proposals' })).toBeDisabled();
    rerender(<SymbolMatchAllDialog open rows={rowsFor()} onApply={onApply} onClose={vi.fn()} now={NOW} />);
    const certain = rowsFor().filter((r) => r.confident && !r.mismatch).length;
    await user.click(screen.getByRole('button', { name: `Apply ${certain} proposals` }));
    expect(onApply).toHaveBeenCalledWith(rowsFor().filter((r) => r.confident && !r.mismatch).map((r) => r.id));
  });
  it('while the host reads the devices it says so (never "nothing to propose"), Apply waits and Cancel still closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SymbolMatchAllDialog open rows={[]} onApply={vi.fn()} onClose={onClose} loading />);
    expect(screen.getByText('Reading the values of the devices…')).toBeInTheDocument();
    expect(screen.queryByText(/Nothing to propose/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply 0 proposals' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('draws nothing while closed', () => {
    const { container } = render(<SymbolMatchAllDialog open={false} rows={rowsFor()} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
  it('a mismatch row is unticked and says to check the kind', () => {
    const rows: MatchRow[] = [{ id: 'x.value', symbolId: 'x', symbolLabel: 'X', kindLabel: 'X', field: 'value', fieldLabel: 'Reading', deviceId: D1, deviceName: 'd', key: 'mode', keyLabel: 'mode', value: 'auto', ts: NOW, confident: false, mismatch: 'text-for-number' }];
    render(<SymbolMatchAllDialog open rows={rows} onApply={vi.fn()} onClose={vi.fn()} now={NOW} />);
    expect(screen.getByText('Check the kind')).toBeInTheDocument();
    expect((screen.getByRole('checkbox', { name: /Apply this proposal/ }) as HTMLInputElement).checked).toBe(false);
  });
});
