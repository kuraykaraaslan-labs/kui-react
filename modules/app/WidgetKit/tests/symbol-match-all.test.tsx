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
