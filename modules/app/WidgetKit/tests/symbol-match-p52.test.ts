import { describe, it, expect } from 'vitest';
import {
  SYNONYMS, applyPair, canonicalWords, clearBest, deviceNameRelation, fieldWords, formatSample, formatValue, matchAllRows, mismatchOf, ownPartKeys, pairOperands,
  rankKeysForField, scaleOver, sharedNameWords, sharesCodeNumber, codesOf,
  type DeviceKey, type MatchSymbol, type RankedKey,
} from '../views/symbol-binding-logic';

/**
 * next-boilerplate phase 52.2 (UI e2e test 3): the matcher's false certainties (52.2.1), a device by name or place (52.2.2), the Turkish–English word table
 * (52.2.3, D585), the panel's helpers (52.2.4) and a measuring symbol's own Status (52.2.6). Each device and symbol below is a test 3 customer's, from the
 * scenario fixtures (`dashboard/tests/e2e/scenarios/fixtures/<nn>-*.json`) and the tester's screenshots.
 */
const NOW = 1_800_000_000_000;
const k = (key: string, value: unknown, extra: Partial<DeviceKey> = {}): DeviceKey => ({ key, value, ts: NOW - 3000, ...extra });
const uuid = (n: number) => `${String(n).repeat(8)}-0000-4000-8000-000000000000`;
const reading = { name: 'value', label: 'Reading', kind: 'number' as const };
const running = { name: 'running', label: 'Running', kind: 'state' as const };
const status = { name: 'status', label: 'Status', kind: 'text' as const };

describe('52.2.1 false certainties', () => {
  // S07: the DCIM bridge sends the hall's total flat and the racks under their element
  const dcim: DeviceKey[] = [
    k('it_load_kw', 51.1, { label: 'Hall IT load', unit: 'kW', type: 'number' }), k('pue', 1.42, { label: 'PUE', type: 'number' }),
    ...Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).flatMap((n) => [
      k(`rack_${n}.value`, 3.8, { label: `Rack ${n} · value`, unit: 'kW', type: 'number' }), k(`rack_${n}.value2`, 24, { label: `Rack ${n} · value2`, unit: '°C', type: 'number' }),
    ]),
  ];
  it('#55: a symbol whose name writes a code ("B01 power") is never certain of a key that writes no such code, on a device that writes none', () => {
    const ranked = rankKeysForField(reading, dcim, 'b01_power', [], ['B01 power', 'Panel indicator (PI)'], { device: 'DCIM bridge' });
    expect(ranked[0]).toMatchObject({ key: 'it_load_kw', confident: false });
    // the same key is certain on a device whose own name writes the code
    expect(rankKeysForField(reading, [k('p_kw', 4.1, { label: 'Power', unit: 'kW' }), k('t', 24, { unit: '°C' })], 'b01', [], ['B01 power', 'Panel indicator (PI)'], { device: 'B01 PDU' })[0])
      .toMatchObject({ key: 'p_kw', confident: true });
  });

  // S08: a string inverter, its AC side drawn as a breaker
  const inverter: DeviceKey[] = [
    k('ac_power_w', 75400, { label: 'AC power', unit: 'W', type: 'number' }), k('state', 'MPPT', { label: 'State', type: 'string' }),
    k('dc_voltage_v', 640, { label: 'DC voltage', unit: 'V', type: 'number' }), k('energy_today_kwh', 312, { label: 'Energy today', unit: 'kWh', type: 'number' }),
    k('heatsink_t', 41, { label: 'Heatsink temperature', unit: '°C', type: 'number' }),
  ];
  it('#62: one word of the symbol\'s name ("AC" of "AC breaker") is counted once and makes no certainty alone', () => {
    const [top] = rankKeysForField(reading, inverter, 'ac_breaker', [], ['AC breaker', 'Circuit breaker'], { device: 'PN1-A1' });
    expect(top).toMatchObject({ key: 'ac_power_w', confident: false });
    expect(top.reasons.filter((r) => r === 'synonym' || r === 'symbol')).toHaveLength(1);
  });

  it('#90: "this" joins a label, it names no thing: "Energy this session" is the "Session energy" symbol\'s own, certain', () => {
    const charger = [
      k('cp_state', 'Charging', { label: 'Connector status', type: 'string' }), k('session_kwh', 21.4, { label: 'Energy this session', unit: 'kWh', type: 'number' }),
      k('cable_t', 38, { label: 'Cable temperature', unit: '°C', type: 'number' }), k('enabled', true, { label: 'In service', type: 'boolean' }),
    ];
    const [top] = rankKeysForField(reading, charger, 'session', [], ['Session energy', 'Panel indicator (PI)'], { device: 'Kadikoy DC-1' });
    expect(top).toMatchObject({ key: 'session_kwh', confident: true });
    expect(top.foreign).toBeUndefined();
  });

  // S12: one substation gateway draws the exchanger, the heat meter and the network valves
  const substation: DeviceKey[] = [
    k('prim_flow_t', 74, { label: 'Primary flow temperature', unit: '°C', type: 'number' }), k('prim_return_t', 44.7, { label: 'Primary return temperature', unit: '°C', type: 'number' }),
    k('sec_flow_t', 65.3, { label: 'Secondary flow temperature', unit: '°C', type: 'number' }), k('sec_return_t', 43.2, { label: 'Secondary return temperature', unit: '°C', type: 'number' }),
    k('flow_m3h', 6.4, { label: 'Primary flow', unit: 'm³/h', type: 'number' }), k('heat_kw', 225, { label: 'Heat power', unit: 'kW', type: 'number' }),
    k('valve_pct', 40, { label: 'Control valve opening', unit: '%', type: 'number' }), k('pump_running', true, { label: 'Secondary pump running', type: 'boolean' }),
  ];
  const D = uuid(1);
  const sym = (id: string, label: string, kindLabel: string, fields: MatchSymbol['fields'] = [reading]): MatchSymbol => ({ id, label, kindLabel, deviceId: D, deviceName: 'Block A substation', fields });
  it('#91: the exchanger\'s "heat" and the valve\'s "flow" make no certainty; the heat meter alone stays certain of the heat power', () => {
    const rows = matchAllRows([
      sym('hx', 'Plate heat exchanger', 'Plate exchanger'), sym('hm', 'Heat meter', 'Heat meter'), sym('nv', 'Network flow valve', 'Gate valve'),
      sym('t1', 'Primary flow temperature', 'Dial thermometer'),
    ], new Map([[D, substation]]));
    const of = (id: string) => rows.find((r) => r.symbolId === id && r.field === 'value');
    expect(of('hx')).toMatchObject({ key: 'heat_kw', confident: false });
    expect(of('nv')).toMatchObject({ key: 'flow_m3h', confident: false });
    expect(of('hm')).toMatchObject({ key: 'heat_kw', confident: true });
    expect(of('t1')).toMatchObject({ key: 'prim_flow_t', confident: true });
  });

  it('several claimants of one value are never all certain: only a clear leader stays; an unticked claimant takes nothing from anyone', () => {
    const pumps = [k('pump_on', true, { type: 'boolean' }), k('t', 20, { unit: '°C' })];
    const two = matchAllRows([sym('p1', 'Pump', 'Pump', [running]), sym('p2', 'Pump', 'Pump', [running])], new Map([[D, pumps]]));
    expect(two.map((r) => r.confident)).toEqual([false, false]);
  });

  // S14: the tank farm: six radar gauges named after their tanks, the tanks and their level transmitters drawn
  it('#109: codes compared by their parts: each LT finds its own tank, unticked; the tanks stay certain; a level in mm is a level', () => {
    const gauge = (level: number): DeviceKey[] => [
      k('level_mm', level, { label: 'Product level', unit: 'mm', type: 'number' }), k('temp_c', 13.5, { label: 'Product temperature', unit: '°C', type: 'number' }),
      k('water_mm', 12, { label: 'Free water', unit: 'mm', type: 'number' }),
    ];
    const tanks = [101, 102, 103, 104, 105, 106];
    const devices = tanks.map((n, i) => ({ deviceId: uuid(i + 1), deviceName: `T-${n}`, place: i < 3 ? 'Bund A' : 'Bund B' }));
    const symbols: MatchSymbol[] = [
      ...tanks.map((n): MatchSymbol => ({ id: `t${n}`, label: `T-${n} · diesel`, kindLabel: 'Floating-roof tank', deviceId: '', deviceName: '', fields: [reading], candidates: devices })),
      ...tanks.map((n): MatchSymbol => ({ id: `lt${n}`, label: `LT-${n}`, kindLabel: 'Level transmitter', deviceId: '', deviceName: '', fields: [reading], candidates: devices })),
    ];
    const rows = matchAllRows(symbols, new Map(devices.map((d, i) => [d.deviceId, gauge(9000 + i)])));
    for (const n of tanks) {
      expect(rows.filter((r) => r.symbolId === `t${n}`).map((r) => [r.deviceName, r.key, r.confident])).toEqual([[`T-${n}`, 'level_mm', true]]);
      expect(rows.filter((r) => r.symbolId === `lt${n}`).map((r) => [r.deviceName, r.key, r.confident, r.mismatch])).toEqual([[`T-${n}`, 'level_mm', false, undefined]]);
    }
    expect(sharesCodeNumber(codesOf('LT-101'), 'T-101')).toBe(true);
    expect(sharesCodeNumber(codesOf('FT-101'), 'FT-102')).toBe(false);
    expect(sharesCodeNumber(codesOf('FT-101'), 'FT-101')).toBe(false);
  });

  // S15: a silo's cable logger, twelve thermometers drawn "Cable N · point M"
  const logger: DeviceKey[] = [
    ...[1, 2, 3].flatMap((c) => [1, 2, 3, 4].map((p) => k(`c${c}_t${p}`, 14 + c + p / 10, { label: `Cable ${c} · point ${p}`, unit: '°C', type: 'number' }))),
    k('fill_pct', 71, { label: 'Grain level', unit: '%', type: 'number' }),
  ];
  it('#116, #117: a label\'s numbers are compared in order: each "Cable N · point M" thermometer reads its own point, certain', () => {
    const symbols = [1, 2, 3].flatMap((c) => [1, 2, 3, 4].map((p): MatchSymbol => ({
      id: `c${c}p${p}`, label: `Cable ${c} · point ${p}`, kindLabel: 'Thermometer', deviceId: D, deviceName: 'Silo 1 logger', fields: [reading],
    })));
    const rows = matchAllRows(symbols, new Map([[D, logger]]));
    expect(rows).toHaveLength(12);
    for (const r of rows) expect([r.key, r.confident]).toEqual([`c${r.symbolId[1]}_t${r.symbolId[3]}`, true]);
    // the panel proposes the same (#117: "no Önerilen")
    const [top] = rankKeysForField(reading, logger, 'c2p1', [], ['Cable 2 · point 1', 'Thermometer'], { device: 'Silo 1 logger' });
    expect(top).toMatchObject({ key: 'c2_t1', confident: true });
  });

  it('a dock door\'s "Door closed" never reads its Running (open) as it is: a mismatch said in words, never certain', () => {
    const dock = [k('door_closed', 1, { label: 'Door closed', type: 'number' }), k('battery_pct', 88, { label: 'Battery', unit: '%', type: 'number' })];
    expect(mismatchOf(running, dock[0])).toBe('inverted');
    expect(mismatchOf({ name: 'running' }, k('door_kapali', true, { label: 'Kapı kapalı', type: 'boolean' }))).toBe('inverted');
    expect(mismatchOf(running, k('door_open', true, { label: 'Door open', type: 'boolean' }))).toBeNull();
    const rows = matchAllRows([{ id: 'dd1', label: 'Dock door 1', kindLabel: 'Dock door', deviceId: D, deviceName: 'Dock door 1 sensor', fields: [running] }], new Map([[D, dock]]));
    expect(rows).toEqual([expect.objectContaining({ key: 'door_closed', confident: false, mismatch: 'inverted' })]);
  });
});

describe('52.2.2 a device by name or place', () => {
  const ids = Array.from({ length: 9 }, (_, i) => uuid(i + 1));
  // S17: the cleanroom's monitors, each placed in its room
  const monitors = [
    { deviceId: ids[0], deviceName: 'Corridor monitor', place: 'Corridor' }, { deviceId: ids[1], deviceName: 'Gowning room monitor', place: 'Gowning room' },
    { deviceId: ids[2], deviceName: 'Airlock monitor', place: 'Airlock' }, { deviceId: ids[3], deviceName: 'Filling room monitor', place: 'Filling room' },
    { deviceId: ids[4], deviceName: 'Capping room monitor', place: 'Capping room' },
  ];
  const monitor = (pa: number): DeviceKey[] => [
    k('room.value', pa, { label: 'Room pressure · value', unit: 'Pa', type: 'number' }), k('room.status', 'ok', { label: 'Room pressure · status', type: 'string' }),
    k('temp_c', 20.4, { label: 'Room temperature', unit: '°C', type: 'number' }), k('rh_pct', 41, { label: 'Relative humidity', unit: '%', type: 'number' }),
    k('door_open', false, { label: 'Door open', type: 'boolean' }),
  ];
  const gauge = (id: string, label: string): MatchSymbol => ({
    id, label, kindLabel: 'Pressure gauge', deviceId: '', deviceName: '', candidates: monitors,
    fields: [{ ...running, suggest: false }, reading, { ...status, suggest: 'own' }],
  });
  it('#136: the monitor placed in "Gowning room" names "Gowning room pressure" without its reading word: its own device, certain', () => {
    expect(deviceNameRelation(monitors[1], 'Gowning room pressure', 'Pressure gauge')).toBe('names');
    expect(deviceNameRelation(monitors[3], 'Gowning room pressure', 'Pressure gauge')).toBe('shares');
    const rows = matchAllRows([gauge('g', 'Gowning room pressure'), gauge('f', 'Filling room pressure'), gauge('c', 'Capping room pressure')],
      new Map(monitors.map((m, i) => [m.deviceId, monitor(15 + i)])));
    expect(rows.filter((r) => r.field === 'value').map((r) => [r.symbolLabel, r.deviceName, r.key, r.confident])).toEqual([
      ['Gowning room pressure', 'Gowning room monitor', 'room.value', true], ['Filling room pressure', 'Filling room monitor', 'room.value', true],
      ['Capping room pressure', 'Capping room monitor', 'room.value', true],
    ]);
  });
  it('#144: "Reading hall thermostat" is the reading hall\'s sensor ("reading" of the place kept); a device is ranked by its best row, never by a sum', () => {
    expect(deviceNameRelation({ deviceName: 'Reading hall sensor', place: 'Reading hall' }, 'Reading hall thermostat', 'Room thermostat')).toBe('names');
    expect(deviceNameRelation({ deviceName: 'Library AHU', place: 'Library' }, 'Reading hall thermostat', 'Room thermostat')).toBe('none');
    const ahu = [
      k('ahu.running', true, { label: 'Air handling unit · running', type: 'boolean' }), k('ahu.value', 18, { label: 'Air handling unit · value', unit: '°C', type: 'number' }),
      k('ahu.status', 'ok', { label: 'Air handling unit · status', type: 'string' }),
    ];
    const sensor = [k('temperature', 21.4, { label: 'Temperature', unit: '°C', type: 'number' }), k('co2_ppm', 640, { label: 'CO2', unit: 'ppm', type: 'number' })];
    // a thermostat no device names: the sensor that answers its Reading best leads, though the AHU answers three fields
    const rows = matchAllRows([{
      id: 'th', label: 'Thermostat 2', kindLabel: 'Room thermostat', deviceId: '', deviceName: '', fields: [running, reading, status],
      candidates: [{ deviceId: ids[0], deviceName: 'Library AHU' }, { deviceId: ids[1], deviceName: 'Room sensor' }],
    }], new Map([[ids[0], ahu], [ids[1], sensor]]));
    expect(new Set(rows.map((r) => r.deviceName))).toEqual(new Set(['Room sensor']));
  });
  it('#180: a height written in a name ("Hisartepe +128 m") tags nothing; the bonus is for a word not every device holds, never "room"', () => {
    expect(deviceNameRelation({ deviceName: 'Hisartepe deposu RTU', place: 'Hisartepe deposu' }, 'Hisartepe +128 m', 'Ground reservoir')).toBe('names');
    expect(deviceNameRelation({ deviceName: 'Sahil BKV kaydedici', place: 'Sahil BKV' }, 'Sahil BKV +40 m', 'Pressure-reducing valve')).toBe('names');
    expect(deviceNameRelation({ deviceName: 'Sahil İÖB kaydedici', place: 'Sahil İÖB' }, 'Sahil BKV +40 m', 'Pressure-reducing valve')).toBe('shares');
    expect([...sharedNameWords({ deviceName: 'Gowning room monitor' }, 'Room pressure')]).toEqual([]);
    expect([...sharedNameWords({ deviceName: 'Çarşı deposu RTU' }, 'Çarşı deposu +104 m')]).toEqual(['carsi', 'tank']);
    // the analyser of the same reservoir may read the RTU the reservoir's name claims: it shares a word of its own with it
    const depo = [k('bakiye_klor.value', 0.46, { label: 'Bakiye klor · value', unit: 'mg/L', type: 'number' }), k('bakiye_klor.status', 'ok', { label: 'Bakiye klor · status', type: 'string' }),
      k('depo.value', 78, { label: 'Depo · value', unit: '%', type: 'number' })];
    const bkv = [k('giris_basinci', 6.1, { label: 'Giriş basıncı', unit: 'bar', type: 'number' }), k('pil', 88, { label: 'Pil', unit: '%', type: 'number' })];
    const candidates = [
      { deviceId: ids[0], deviceName: 'Hisartepe deposu RTU', place: 'Hisartepe deposu' }, { deviceId: ids[1], deviceName: 'Sahil İÖB kaydedici', place: 'Sahil İÖB' },
    ];
    const rows = matchAllRows([
      { id: 'res', label: 'Hisartepe +128 m', kindLabel: 'Ground reservoir', deviceId: '', deviceName: '', fields: [reading], candidates },
      { id: 'cl', label: 'Hisartepe klor', kindLabel: 'Analyser transmitter', deviceId: '', deviceName: '', fields: [{ ...running, suggest: false }, reading, { ...status, suggest: 'own' }], candidates },
    ], new Map([[ids[0], depo], [ids[1], bkv]]));
    expect(rows.map((r) => [r.symbolId, r.field, r.deviceName, r.key])).toEqual([
      ['res', 'value', 'Hisartepe deposu RTU', 'depo.value'], ['cl', 'value', 'Hisartepe deposu RTU', 'bakiye_klor.value'],
      ['cl', 'status', 'Hisartepe deposu RTU', 'bakiye_klor.status'],
    ]);
  });
});

describe('52.2.3 the Turkish–English word table (D585)', () => {
  it('one table, folded letters: kat/floor, sol/left, sağ/right, oksijen/oxygen, debimetre/flow meter', () => {
    expect(canonicalWords('Kat 3 oksijen')).toEqual(['floor', '3', 'oxygen']);
    expect(canonicalWords('Sağ tüp bankası')).toEqual(['right', 'cylinder', 'bank']);
    expect(canonicalWords('Giriş debimetresi')).toEqual(['inlet', 'flowmeter']);
    expect(canonicalWords('Flow meter 2')).toEqual(['flow', 'meter', 'flowmeter', '2']);
    expect(SYNONYMS.find((l) => l[0] === 'flow')).toContain('debimetre');
    expect(fieldWords({ name: 'value', label: 'Basınç' }).has('pressure')).toBe(true);
    expect(fieldWords({ name: 'value', label: 'Pressure' }).has('basinc')).toBe(true);
  });
  // S06: the riser drawn in Turkish, the panels named in English, each placed on its floor
  it('#45: "Kat 3 oksijen" meets "Floor 3 gas alarm panel"; floors 1, 2 and 4 are its twins and are never offered', () => {
    const panels = [1, 2, 3, 4].map((n) => ({ deviceId: uuid(n), deviceName: `Floor ${n} gas alarm panel`, place: `Floor ${n}` }));
    expect(deviceNameRelation(panels[1], 'Kat 3 oksijen', 'Pressure gauge')).toBe('twin');
    const panel = (bar: number) => [
      k('o2_bar', bar, { label: 'Oxygen pressure', unit: 'bar', type: 'number' }), k('vac_kpa', -60, { label: 'Vacuum', unit: 'kPa', type: 'number' }),
      k('panel_on_battery', false, { label: 'Panel on battery', type: 'boolean' }),
    ];
    const rows = matchAllRows([{ id: 'k3', label: 'Kat 3 oksijen', kindLabel: 'Pressure gauge', deviceId: '', deviceName: '', fields: [reading], candidates: panels }],
      new Map(panels.map((p, i) => [p.deviceId, panel(4 + i / 10)])));
    expect(rows.map((r) => [r.deviceName, r.key])).toEqual([['Floor 3 gas alarm panel', 'o2_bar']]);
  });
  it('#46: the left bank ("Sol banka") reads the left cylinder bank, the right one the right: by the table\'s sides', () => {
    const manifold = [
      k('bank_left_bar', 140, { label: 'Left cylinder bank', unit: 'bar', type: 'number' }), k('bank_right_bar', 152, { label: 'Right cylinder bank', unit: 'bar', type: 'number' }),
      k('line_bar', 4.4, { label: 'Oxygen line pressure', unit: 'bar', type: 'number' }),
    ];
    expect(rankKeysForField(reading, manifold, 'left', [], ['Sol banka', 'Gas cylinder'], { device: 'O2 manifold' })[0]).toMatchObject({ key: 'bank_left_bar', confident: true });
    expect(rankKeysForField(reading, manifold, 'right', [], ['Sağ banka', 'Gas cylinder'], { device: 'O2 manifold' })[0]).toMatchObject({ key: 'bank_right_bar', confident: true });
  });
});

describe('52.2.4 the panel\'s helpers (logic)', () => {
  it('#27: "Scale 0–100" scales the raw value, never what is typed', () => {
    expect(scaleOver({ from: 1500, to: 3300 }, [], true)).toBe('(value - 1500) / (3300 - 1500) * 100');
    expect(scaleOver({ from: 0, to: 4095 }, [{ name: 'raw' }], false)).toBe('raw / 4095 * 100');
  });
  it('#28: a number in the workspace\'s language', () => {
    expect(formatValue(46.2222, '%', undefined, 'tr')).toBe('46,222 %');
    expect(formatSample(1234.5, 'tr')).toBe('1.234,5');
    expect(formatValue(46.2222, '%')).toBe('46.222 %');
  });
  it('#157: "Suggested" only on a clear first', () => {
    const r = (key: string, score: number, extra: Partial<RankedKey> = {}): RankedKey => ({ key, score, confident: false, reasons: ['synonym'], ...extra });
    expect(clearBest([r('a', 80), r('b', 80)])).toBeNull();
    expect(clearBest([r('a', 81), r('b', 80)])?.key).toBe('a');
    expect(clearBest([r('a', 20)])).toBeNull();
    expect(clearBest([r('a', 80, { mismatch: 'quantity' })])).toBeNull();
  });
  it('D589: "Difference" and "Ratio (%)" over two picked values (a typed formula is replaced: phase 53.2.5, symbol-match-p53)', () => {
    expect(pairOperands(true, [])).toBeNull();
    expect(pairOperands(true, [{ name: 'debisi_value' }])).toEqual({ a: 'value', b: 'debisi_value' });
    expect(pairOperands(false, [{ name: 'giris' }, { name: 'cikis' }])).toEqual({ a: 'giris', b: 'cikis' });
    expect(applyPair('difference', { a: 'value', b: 'debisi_value' })).toBe('value - debisi_value');
    expect(applyPair('ratio', { a: 'value', b: 'debisi_value' })).toBe('value / debisi_value * 100');
  });
});

describe('52.2.6 a measuring symbol\'s own Status', () => {
  const D = uuid(1);
  // S22: the big lift station's PLC, its gas detectors as parts
  const plc = [
    k('h2s.value', 3, { label: 'H2S · value', unit: 'ppm', type: 'number' }), k('h2s.status', 'alarm', { label: 'H2S · status', type: 'string' }),
    k('lel.value', 2, { label: 'LEL · value', unit: '% LEL', type: 'number' }), k('lel.status', 'ok', { label: 'LEL · status', type: 'string' }),
    k('pompa_1.status', 'ok', { label: 'Pompa 1 · status', type: 'string' }),
  ];
  it('is proposed from its own part (the part its Reading reads, its element, or its name), never from another part', () => {
    expect(ownPartKeys(plc, ['h2s.value'], { label: 'Gas' }).map((x) => x.key)).toEqual(['h2s.value', 'h2s.status']);
    expect(ownPartKeys(plc, [], { label: 'LEL' }).map((x) => x.key)).toEqual(['lel.value', 'lel.status']);
    const rows = matchAllRows([
      { id: 'det', label: 'Islak kuyu gazı', kindLabel: 'Gas detector', deviceId: D, deviceName: 'Köprübaşı PLC', taken: ['h2s.value'], fields: [{ ...running, suggest: false }, { ...status, suggest: 'own' }] },
      { id: 'noread', label: 'Detector', kindLabel: 'Gas detector', deviceId: D, deviceName: 'Köprübaşı PLC', fields: [{ ...status, suggest: 'own' }] },
    ], new Map([[D, plc]]));
    expect(rows.map((r) => [r.symbolId, r.field, r.key])).toEqual([['det', 'status', 'h2s.status']]);
  });
});
