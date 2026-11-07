import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SymbolMatchAllDialog } from '../views/SymbolMatchAllDialog';
import { deviceNameRelation, entriesOfMatches, matchAllRows, matchEmptyReason, type DeviceKey, type MatchRow, type MatchSymbol } from '../views/symbol-binding-logic';

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

describe('matchAllRows across a site\'s devices (next-boilerplate phase 46.2)', () => {
  const D3 = '33333333-3333-4333-8333-333333333333';
  const site = (over: Partial<MatchSymbol> = {}): MatchSymbol => ({ id: 'meter', label: 'Flow meter', kindLabel: 'Meter', deviceId: '', deviceName: '', fields: [{ name: 'value', label: 'Flow' }], ...over });
  const pumpBox = [k('pump_circulation.running', true, { label: 'Circulation pump · running' }), k('temp_1', 21.5)];
  const meterBox = [k('meter_flow.value', 12.4, { label: 'Flow meter · value', unit: 'l/min' })];
  it('a symbol with no device of its own takes the device that fits it best among the site\'s, certain when it leads clearly', () => {
    const rows = matchAllRows([site({ candidates: [{ deviceId: D1, deviceName: 'Pump box' }, { deviceId: D2, deviceName: 'Meter box' }] })], new Map([[D1, pumpBox], [D2, meterBox]]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deviceId: D2, deviceName: 'Meter box', key: 'meter_flow.value', confident: true });
  });
  it('with no candidate, or none whose keys are known, proposes nothing; one candidate is the device', () => {
    expect(matchAllRows([site()], new Map([[D1, meterBox]]))).toEqual([]);
    expect(matchAllRows([site({ candidates: [{ deviceId: D3, deviceName: 'Gone' }] })], new Map([[D1, meterBox]]))).toEqual([]);
    expect(matchAllRows([site({ candidates: [{ deviceId: D1, deviceName: 'Only box' }] })], new Map([[D1, meterBox]]))[0]).toMatchObject({ deviceId: D1, confident: true });
  });
  it('three devices of the same type tie: each is offered with its own row, none ticked (a tie dropped said "nothing to propose", e2e round 5, E4)', () => {
    const same = [{ deviceId: D1, deviceName: 'Pool plant · Antalya' }, { deviceId: D2, deviceName: 'Pool plant · Izmir' }, { deviceId: D3, deviceName: 'Pool plant · Konya' }];
    const rows = matchAllRows([site({ candidates: same })], new Map([[D1, meterBox], [D2, meterBox], [D3, meterBox]]));
    expect(rows.map((r) => [r.deviceId, r.confident])).toEqual([[D1, false], [D2, false], [D3, false]]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
    // ticking two of them writes the first: one parameter reads one value
    expect(entriesOfMatches(rows, new Set(rows.map((r) => r.id)))).toEqual({ meter: { fields: { value: { deviceId: D1, key: 'meter_flow.value', label: 'Flow meter · value' } } } });
  });
  it('a word the device\'s name shares with the symbol breaks the tie, but a close lead ticks nothing', () => {
    const named = [{ deviceId: D1, deviceName: 'Flow station' }, { deviceId: D2, deviceName: 'Spare box' }];
    const rows = matchAllRows([site({ candidates: named })], new Map([[D1, meterBox], [D2, meterBox]]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deviceId: D1, confident: false });
  });
  it('a symbol that has a device keeps it: the candidates are not read', () => {
    const rows = matchAllRows([site({ deviceId: D1, deviceName: 'Pump box', candidates: [{ deviceId: D2, deviceName: 'Meter box' }] })], new Map([[D1, pumpBox], [D2, meterBox]]));
    expect(rows.every((r) => r.deviceId === D1)).toBe(true);
  });
});

describe('matchAllRows: the run\'s sites (next-boilerplate e2e round 5, E3 and E4)', () => {
  const ids = Array.from({ length: 9 }, (_, i) => `${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}-0000-4000-8000-000000000000`);
  // S02: a cold store's site view, four rooms named after the rooms; four controllers (one per room) and three dock door sensors placed on the site
  const room = (id: string, label: string): MatchSymbol => ({
    id, label, kindLabel: 'Cold room', deviceId: '', deviceName: '',
    fields: [{ name: 'running', label: 'Running', suggest: false }, { name: 'value', label: 'Reading' }, { name: 'status', label: 'Status', suggest: false }],
  });
  const rooms = [room('cold1', 'Chiller 1'), room('cold2', 'Chiller 2'), room('cold3', 'Freezer 1'), room('cold4', 'Freezer 2')];
  const devices = [
    { deviceId: ids[0], deviceName: 'Chiller 1 controller', place: 'Chiller 1' }, { deviceId: ids[1], deviceName: 'Chiller 2 controller', place: 'Chiller 2' },
    { deviceId: ids[2], deviceName: 'Freezer 1 controller', place: 'Freezer 1' }, { deviceId: ids[3], deviceName: 'Freezer 2 controller', place: 'Freezer 2' },
    { deviceId: ids[4], deviceName: 'Dock door 1 sensor', place: 'Dock' }, { deviceId: ids[5], deviceName: 'Dock door 2 sensor', place: 'Dock' },
    { deviceId: ids[6], deviceName: 'Dock door 3 sensor', place: 'Dock' },
  ];
  const controller = (t: number): DeviceKey[] => [
    k('temperature', t, { label: 'Room temperature', unit: '°C', type: 'number' }), k('door_open', false, { label: 'Door open', type: 'boolean' }),
    k('defrost', false, { label: 'Defrost running', type: 'boolean' }), k('compressor', true, { label: 'Compressor running', type: 'boolean' }),
  ];
  const dock = (): DeviceKey[] => [k('door_closed', 1, { label: 'Door closed', type: 'number' }), k('battery_pct', 88, { label: 'Battery', unit: '%', type: 'number' })];
  const site = rooms.map((r) => ({ ...r, candidates: devices }));

  it('S02 as it ran: only Chiller 2 had sent values; the other rooms never take its temperature, let alone as certain', () => {
    const rows = matchAllRows(site, new Map([[ids[1], controller(3.7)], [ids[4], dock()], [ids[5], dock()], [ids[6], dock()]]));
    expect(rows.map((r) => [r.symbolLabel, r.deviceName, r.key, r.confident])).toEqual([['Chiller 2', 'Chiller 2 controller', 'temperature', true]]);
  });
  it('S02 with every controller live: each room reads its own controller, by its name and its place, certain', () => {
    const rows = matchAllRows(site, new Map([[ids[0], controller(3.4)], [ids[1], controller(3.7)], [ids[2], controller(-20.6)], [ids[3], controller(-15)], [ids[4], dock()]]));
    expect(rows.map((r) => [r.symbolLabel, r.field, r.deviceName, r.confident])).toEqual([
      ['Chiller 1', 'value', 'Chiller 1 controller', true], ['Chiller 2', 'value', 'Chiller 2 controller', true],
      ['Freezer 1', 'value', 'Freezer 1 controller', true], ['Freezer 2', 'value', 'Freezer 2 controller', true],
    ]);
    // only the place names the room: still the room's own device
    const byPlace = devices.map((d) => ({ ...d, deviceName: `Controller ${d.deviceId.slice(0, 1)}` }));
    const placed = matchAllRows(rooms.slice(0, 1).map((r) => ({ ...r, candidates: byPlace })), new Map([[ids[0], controller(3.4)], [ids[1], controller(3.7)]]));
    expect(placed.map((r) => [r.deviceId, r.confident])).toEqual([[ids[0], true]]);
  });
  it('four rooms pinned on ONE controller share its room temperature by their kind\'s word: proposed to each, certain for none', () => {
    const pinned = rooms.map((r) => ({ ...r, deviceId: ids[1], deviceName: 'Chiller 2 controller' }));
    const rows = matchAllRows(pinned, new Map([[ids[1], controller(3.7)]]));
    expect(rows.map((r) => [r.symbolLabel, r.key, r.confident])).toEqual([
      ['Chiller 1', 'temperature', false], ['Chiller 2', 'temperature', false], ['Freezer 1', 'temperature', false], ['Freezer 2', 'temperature', false],
    ]);
  });
  // S03: a farm's site view, six soil probes named in Turkish ("Sera 1 A"), six probe devices ("Sera 1 probe A") and the fertigation controller
  it('S03: each probe reads its own probe device, by the name\'s number and letter, certain; never the controller\'s greenhouse values', () => {
    const probe = (id: string, label: string): MatchSymbol => ({ id, label, kindLabel: 'Soil moisture probe', deviceId: '', deviceName: '', fields: [{ name: 'value', label: 'Ölçüm' }] });
    const probes = [probe('p1a', 'Sera 1 A'), probe('p1b', 'Sera 1 B'), probe('p2a', 'Sera 2 A')];
    const probeDevices = [
      { deviceId: ids[0], deviceName: 'Sera 1 probe A' }, { deviceId: ids[1], deviceName: 'Sera 1 probe B' }, { deviceId: ids[2], deviceName: 'Sera 2 probe A' },
      { deviceId: ids[3], deviceName: 'Fertigation controller' },
    ];
    const soil = (raw: number): DeviceKey[] => [k('vwc_raw', raw, { label: 'Soil moisture (raw)', type: 'number' }), k('soil_temp', 19, { label: 'Soil temperature', unit: '°C' }), k('battery_v', 3.4, { label: 'Battery', unit: 'V' })];
    const ctrl = [k('greenhouse_1.value', 61, { label: 'Greenhouse 1 · value' }), k('greenhouse_2.value', 58, { label: 'Greenhouse 2 · value' }), k('level', 62, { label: 'Tank level', unit: '%' })];
    const rows = matchAllRows(probes.map((p) => ({ ...p, candidates: probeDevices })), new Map([[ids[0], soil(2387)], [ids[1], soil(1820)], [ids[2], soil(2500)], [ids[3], ctrl]]));
    expect(rows.map((r) => [r.symbolLabel, r.deviceName, r.key, r.confident])).toEqual([
      ['Sera 1 A', 'Sera 1 probe A', 'vwc_raw', true], ['Sera 1 B', 'Sera 1 probe B', 'vwc_raw', true], ['Sera 2 A', 'Sera 2 probe A', 'vwc_raw', true],
    ]);
    // on the controller's own page the probes are offered nothing certain: its greenhouses and its tank are other equipment
    const onController = matchAllRows(probes.map((p) => ({ ...p, deviceId: ids[3], deviceName: 'Fertigation controller' })), new Map([[ids[3], ctrl]]));
    expect(onController.filter((r) => r.confident)).toEqual([]);
  });
  it('a parameter nothing is proposed for (suggest: false) has no row', () => {
    const rows = matchAllRows([{ ...rooms[0], deviceId: ids[0], deviceName: 'Chiller 1 controller' }], new Map([[ids[0], controller(3.4)]]));
    expect(rows.map((r) => r.field)).toEqual(['value']);
  });
});

describe('deviceNameRelation and matchEmptyReason (e2e round 5, E4)', () => {
  it('numbers and letters count: a twin is never the symbol\'s device', () => {
    expect(deviceNameRelation({ deviceName: 'Chiller 1 controller' }, 'Chiller 1')).toBe('names');
    expect(deviceNameRelation({ deviceName: 'Controller A', place: 'Chiller 1' }, 'Chiller 1')).toBe('names');
    expect(deviceNameRelation({ deviceName: 'Chiller 2 controller' }, 'Chiller 1')).toBe('twin');
    expect(deviceNameRelation({ deviceName: 'Sera 1 probe B' }, 'Sera 1 A')).toBe('twin');
    expect(deviceNameRelation({ deviceName: 'T-102' }, 'T-101')).toBe('twin');
    expect(deviceNameRelation({ deviceName: 'Flow station' }, 'Flow meter')).toBe('shares');
    expect(deviceNameRelation({ deviceName: 'RTU 4' }, 'Pump 1')).toBe('none');
    expect(deviceNameRelation({ deviceName: 'Kazan Dairesi' }, 'Kazan dairesi')).toBe('names');
  });
  it('says why nothing is proposed: all linked, no device, no values, or nothing sure', () => {
    const s = (over: Partial<MatchSymbol> = {}): MatchSymbol => ({ id: 's', label: 'S', kindLabel: 'S', deviceId: D1, deviceName: 'd', fields: [{ name: 'value', label: 'Reading' }], ...over });
    expect(matchEmptyReason([], new Map())).toBe('allLinked');
    expect(matchEmptyReason([s({ fields: [{ name: 'running', label: 'Running', suggest: false }] })], new Map())).toBe('allLinked');
    expect(matchEmptyReason([s({ deviceId: '', candidates: [] })], new Map())).toBe('noDevices');
    expect(matchEmptyReason([s()], new Map([[D1, []]]))).toBe('noValues');
    expect(matchEmptyReason([s()], new Map([[D1, [k('x', 'a')]]]))).toBe('unsure');
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
    // the device leads the line, so a narrow window cuts the age, never the device (next-boilerplate run 3 note 105)
    expect(within(table).getByText('Kitchen box · 21.5 · 3 s ago')).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/scene key|slot|\brole\b/i);
    await user.click(boxes[2]);
    await user.click(within(dialog).getByRole('button', { name: 'Apply 3 proposals' }));
    expect(onApply).toHaveBeenCalledWith(['thermo.value', 'pump.running', 'door.running']);
  });
  it('says so when there is nothing to propose, and offers no Apply of nothing (next-boilerplate e2e round 5, S01-J3-12)', () => {
    render(<SymbolMatchAllDialog open rows={[]} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Nothing to propose: every symbol is connected, or the devices have not sent values yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Apply/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });
  it('says why there is nothing to propose when the host knows (e2e round 5, E4)', () => {
    const { rerender } = render(<SymbolMatchAllDialog open rows={[]} onApply={vi.fn()} onClose={vi.fn()} emptyReason="noValues" />);
    expect(screen.getByText('The devices have not sent any values yet, so there is nothing to compare. Try again once they do.')).toBeInTheDocument();
    rerender(<SymbolMatchAllDialog open rows={[]} onApply={vi.fn()} onClose={vi.fn()} emptyReason="unsure" />);
    expect(screen.getByText('No proposal is sure enough. Click a symbol to pick its device and value by hand.')).toBeInTheDocument();
    rerender(<SymbolMatchAllDialog open rows={[]} onApply={vi.fn()} onClose={vi.fn()} emptyReason="allLinked" />);
    expect(screen.getByText('Every symbol is already connected.')).toBeInTheDocument();
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

describe('SymbolMatchAllDialog: next-boilerplate run 3', () => {
  const row: MatchRow = {
    id: 'p1.value', symbolId: 'p1', symbolLabel: 'Pump 1', kindLabel: 'Pump', field: 'value', fieldLabel: 'Value', deviceId: D1, deviceName: 'Turbine controller A',
    key: 'on', keyLabel: 'On', value: true, ts: NOW - 3000, confident: false,
  };
  it('notes 105 and 11: the device name leads the line (its title holds it whole), and on/off is in the host\'s words', () => {
    render(<SymbolMatchAllDialog open rows={[row]} onApply={vi.fn()} onClose={vi.fn()} now={NOW} messages={{ stateOn: 'Açık', stateOff: 'Kapalı' }} />);
    const line = screen.getByText('Turbine controller A · Açık · 3 s ago');
    expect(line).toHaveAttribute('title', 'Turbine controller A');
  });
  it('note 146: nothing sure on a partly connected drawing says how much is connected; none connected keeps the plain reason', () => {
    const { rerender } = render(<SymbolMatchAllDialog open rows={[]} emptyReason="unsure" connected={{ connected: 7, total: 9 }} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('7 of 9 symbols are connected. No proposal for the rest is sure enough: click a symbol to pick its device and value by hand.')).toBeInTheDocument();
    rerender(<SymbolMatchAllDialog open rows={[]} emptyReason="unsure" connected={{ connected: 0, total: 9 }} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('No proposal is sure enough. Click a symbol to pick its device and value by hand.')).toBeInTheDocument();
    rerender(<SymbolMatchAllDialog open rows={[]} emptyReason="unsure" onApply={vi.fn()} onClose={vi.fn()} messages={{ matchAll: { unsureCount: (c, t) => `${c} / ${t} bağlı.` } }} connected={{ connected: 2, total: 3 }} />);
    expect(screen.getByText('2 / 3 bağlı.')).toBeInTheDocument();
  });
  it('next-boilerplate phase 52.6.1: the table\'s own search, "N selected" and "Clear selection" are in the host\'s words; the dialog\'s own stay its', () => {
    const many: MatchRow[] = Array.from({ length: 9 }, (_, i) => ({ ...row, id: `p${i}.value`, symbolId: `p${i}`, symbolLabel: `Pump ${i}`, confident: i < 2 }));
    render(<SymbolMatchAllDialog
      open rows={many} onApply={vi.fn()} onClose={vi.fn()} now={NOW}
      tableMessages={{ searchPlaceholder: 'Ara…', selectedCount: '{count} seçili', clearSelection: 'Seçimi temizle', tableLabel: 'Veri tablosu' }}
    />);
    expect(screen.getByPlaceholderText('Ara…')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search…')).toBeNull();
    expect(screen.getByText('2 seçili')).toBeInTheDocument();
    expect(screen.getByText('Seçimi temizle')).toBeInTheDocument();
    // the dialog's own name for its table wins over the host's generic one
    expect(screen.getByRole('table', { name: 'Proposals' })).toBeInTheDocument();
  });
  it('note 51: ticking the first row moves no row: the selection line keeps its room while nothing is ticked', async () => {
    const user = userEvent.setup();
    render(<SymbolMatchAllDialog open rows={[row]} onApply={vi.fn()} onClose={vi.fn()} now={NOW} />);
    expect(document.querySelector('[data-part="selection-summary-slot"]')).not.toBeNull();
    await user.click(screen.getByRole('checkbox', { name: /Apply this proposal/ }));
    expect(document.querySelector('[data-part="selection-summary"]')).not.toBeNull();
    expect(document.querySelector('[data-part="selection-summary-slot"]')).toBeNull();
  });
});
