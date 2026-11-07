import { describe, it, expect } from 'vitest';
import { deviceNameRelation, matchAllRows, type DeviceKey, type MatchSymbol } from '../views/symbol-binding-logic';

/**
 * next-boilerplate phase 53.2.6 (re-run 4 #9, #10): on a site, a symbol named after the place ("Silo" on the site "Silo 1", whose logger and fan are both
 * placed there) names every device of it, so it picks none out: it claims no device from the other symbols, and it is ranked across the devices by its
 * kind. The case is scenario 15's silo section (fixture `15-grain-silos.json`, run 3 and test 3): a cable logger with 3 cables × 4 points and the grain
 * level, an aeration fan starter, the drawing's bin "Silo", the fan "Aeration fan", the level bar "Grain level" and twelve dial thermometers.
 */
const NOW = 1_800_000_000_000;
const k = (key: string, value: unknown, extra: Partial<DeviceKey> = {}): DeviceKey => ({ key, value, ts: NOW - 3000, ...extra });
const uuid = (n: number) => `${String(n).repeat(8)}-0000-4000-8000-000000000000`;

// the fields a measuring symbol draws (a bin, a level bar, a thermometer) and a turning one (the blower), as the next-boilerplate host gives them
const measuring: MatchSymbol['fields'] = [
  { name: 'running', label: 'Running', kind: 'state', suggest: false }, { name: 'status', label: 'Status', kind: 'text', suggest: 'own' },
  { name: 'value', label: 'Reading', kind: 'number' }, { name: 'value2', label: 'Second reading', kind: 'number', suggest: false },
];
const turning: MatchSymbol['fields'] = [
  { name: 'running', label: 'Running', kind: 'state' }, { name: 'status', label: 'Status', kind: 'text' }, { name: 'value', label: 'Reading', kind: 'number' },
  { name: 'value2', label: 'Second reading', kind: 'number', suggest: false }, { name: 'speed', label: 'Speed', kind: 'number' },
  { name: 'mode', label: 'Mode', kind: 'text', suggest: 'own' },
];

const POINTS = [1, 2, 3].flatMap((c) => [1, 2, 3, 4].map((p) => ({ c, p })));
const loggerKeys = (n: number): DeviceKey[] => [
  ...POINTS.map(({ c, p }) => k(`c${c}_t${p}`, 14 + n + c + p / 10, { label: `Cable ${c} · point ${p}`, unit: '°C', type: 'number' })),
  k('fill_pct', 81, { label: 'Grain level', unit: '%', type: 'number' }),
];
const fanKeys: DeviceKey[] = [
  k('fan.running', true, { label: 'Aeration fan · running', type: 'boolean' }), k('fan.value', 19.1, { label: 'Aeration fan · value', unit: 'A', type: 'number' }),
  k('fan.status', 'ok', { label: 'Aeration fan · status', type: 'string' }), k('run_hours', 9.6, { label: 'Run hours today', unit: 'h', type: 'number' }),
];

type Candidate = NonNullable<MatchSymbol['candidates']>[number];
const drawing = (candidates: readonly Candidate[]): MatchSymbol[] => {
  const sym = (id: string, label: string, kindLabel: string, fields: MatchSymbol['fields']): MatchSymbol => ({ id, label, kindLabel, deviceId: '', deviceName: '', fields, candidates });
  return [
    sym('silo', 'Silo', 'Grain bin', measuring), sym('fan', 'Aeration fan', 'Blower', turning), sym('level', 'Grain level', 'LED bar graph', measuring),
    ...POINTS.map(({ c, p }) => sym(`c${c}p${p}`, `Cable ${c} · point ${p}`, 'Dial thermometer', measuring)),
  ];
};
const summary = (rows: ReturnType<typeof matchAllRows>) => rows.map((r) => [r.symbolLabel, r.field, r.deviceName, r.key]);

describe('53.2.6 a name every device of the place holds claims none of them', () => {
  const LOGGER = uuid(1);
  const FAN = uuid(2);
  const silo1 = [{ deviceId: LOGGER, deviceName: 'Silo 1 logger', place: 'Silo 1' }, { deviceId: FAN, deviceName: 'Silo 1 fan', place: 'Silo 1' }];

  it('#9: on the site "Silo 1" the twelve cable thermometers are proposed again, each its own point on the logger', () => {
    // "Silo" names both devices by their place: that is why it picks neither out
    expect(silo1.map((c) => deviceNameRelation(c, 'Silo', 'Grain bin'))).toEqual(['names', 'names']);
    const rows = matchAllRows(drawing(silo1), new Map([[LOGGER, loggerKeys(1)], [FAN, fanKeys]]));
    const thermometers = rows.filter((r) => r.symbolId.startsWith('c'));
    expect(thermometers).toHaveLength(12);
    for (const r of thermometers) expect([r.deviceName, r.field, r.key]).toEqual(['Silo 1 logger', 'value', `c${r.symbolId[1]}_t${r.symbolId[3]}`]);
    // the level bar reads the grain level, the fan its own rows (certain by its name on its keys)
    expect(summary(rows.filter((r) => r.symbolId === 'level'))).toEqual([['Grain level', 'value', 'Silo 1 logger', 'fill_pct']]);
    expect(rows.filter((r) => r.symbolId === 'fan' && r.confident).map((r) => [r.field, r.key])).toEqual([
      ['running', 'fan.running'], ['status', 'fan.status'], ['value', 'fan.value'],
    ]);
  });

  it('#10: the bin "Silo" is offered the grain level, never the fan\'s current or status', () => {
    const rows = matchAllRows(drawing(silo1), new Map([[LOGGER, loggerKeys(1)], [FAN, fanKeys]]));
    expect(summary(rows.filter((r) => r.symbolId === 'silo'))).toEqual([['Silo', 'value', 'Silo 1 logger', 'fill_pct']]);
    // a guess across the site's devices: offered, never ticked by itself
    expect(rows.find((r) => r.symbolId === 'silo')?.confident).toBe(false);
  });

  it('on a site that holds the logger alone, "Silo" takes nothing from the thermometers: each reads its own point, certain', () => {
    const only = [silo1[0]];
    const rows = matchAllRows(drawing(only), new Map([[LOGGER, loggerKeys(1)]]));
    const thermometers = rows.filter((r) => r.symbolId.startsWith('c'));
    expect(thermometers).toHaveLength(12);
    for (const r of thermometers) expect([r.key, r.confident]).toEqual([`c${r.symbolId[1]}_t${r.symbolId[3]}`, true]);
  });

  it('a name that picks devices out keeps them: on the yard "Silo 1" is matched among silo 1\'s devices by its kind (the grain level), never silo 2\'s', () => {
    const yard = [1, 2].flatMap((n) => [
      { deviceId: uuid(10 + n), deviceName: `Silo ${n} logger`, place: `Silo ${n}` }, { deviceId: uuid(20 + n), deviceName: `Silo ${n} fan`, place: `Silo ${n}` },
    ]);
    const keys = new Map<string, readonly DeviceKey[]>([[uuid(11), loggerKeys(1)], [uuid(12), loggerKeys(2)], [uuid(21), fanKeys], [uuid(22), fanKeys]]);
    const rows = matchAllRows([
      { id: 's1', label: 'Silo 1', kindLabel: 'Grain bin', deviceId: '', deviceName: '', fields: measuring, candidates: yard },
      { id: 's2', label: 'Silo 2', kindLabel: 'Grain bin', deviceId: '', deviceName: '', fields: measuring, candidates: yard },
    ], keys);
    expect(summary(rows)).toEqual([['Silo 1', 'value', 'Silo 1 logger', 'fill_pct'], ['Silo 2', 'value', 'Silo 2 logger', 'fill_pct']]);
  });
});
