import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { effective } from '../settings/engine';
import { resolvePlacement } from '../settings/resolve';
import { metaFormat, metaLabel, metaValue, primaryMeta, valueMapList, directionOption } from '../settings/source-meta';
import type { SlotData } from '../kind';
import { STAT_VALUE, STAT_VALUE_KIND } from '../templates/stat-value';
import { DATA_TABLE, DATA_TABLE_KIND } from '../templates/data-table';
import { STAT_VALUE_VIEW, comparison } from '../views/StatValueView';
import { DATA_TABLE_VIEW, tableColumns, csvCell, csvHeader } from '../views/DataTableView';
import { evaluateState } from '../views/StateView';
import { STATE } from '../templates/state';
import { buildMarkers, effectiveValueColors, mapLegend } from '../views/MapView';
import { MAP } from '../templates/map';

const doorMap = { '0': { label: 'Closed', color: '#00aa00' }, '1': { label: 'Open', color: '#cc0000', icon: 'fas fa-door-open' } };

const table: SlotData = {
  shape: 'table',
  columns: [
    { key: 'name', label: 'Device', type: 'text' },
    { key: 'level', label: 'Level', type: 'number', unit: 'm', decimals: 2 },
    { key: 'door', label: 'Door', type: 'number', kind: 'enum', valueMap: doorMap },
  ],
  rows: [
    { name: 'A', level: 1.23456, door: 0 },
    { name: 'B', level: 2, door: 1 },
  ],
};

describe('source meta helpers', () => {
  it('picks a label by language, then base language, English, anything', () => {
    expect(metaLabel('Door')).toBe('Door');
    expect(metaLabel({ en: 'Door', tr: 'Kapı' }, 'tr-TR')).toBe('Kapı');
    expect(metaLabel({ en: 'Door', tr: 'Kapı' }, 'de')).toBe('Door');
    expect(metaLabel({ tr: 'Kapı' }, 'de')).toBe('Kapı');
    expect(metaLabel(undefined)).toBeUndefined();
    expect(metaLabel('')).toBeUndefined();
  });
  it('turns unit and decimals into a partial format and ignores bad values', () => {
    expect(metaFormat({ unit: 'kWh', decimals: 1 })).toEqual({ unit: 'kWh', decimals: 1 });
    expect(metaFormat({ unit: '', decimals: -1 })).toEqual({});
    expect(metaFormat({ decimals: 1.5 })).toEqual({});
    expect(metaFormat(undefined)).toEqual({});
  });
  it('maps a direction to the stat "increase is" option', () => {
    expect(directionOption('higherIsBetter')).toBe('good');
    expect(directionOption('lowerIsBetter')).toBe('bad');
    expect(directionOption('neutral')).toBe('neutral');
    expect(directionOption(undefined)).toBeUndefined();
  });
  it('lists and looks up a value map, trimmed and case-insensitive', () => {
    expect(valueMapList({ valueMap: doorMap }).map((e) => e.value)).toEqual(['0', '1']);
    expect(valueMapList(undefined)).toEqual([]);
    expect(metaValue({ valueMap: { RUNNING: { label: 'Running' } } }, ' running ')?.label).toBe('Running');
    expect(metaValue({ valueMap: doorMap }, 5)).toBeUndefined();
  });
  it('takes the first bound slot that carries meta', () => {
    const slots = [{ key: 'value' }, { key: 'compare' }];
    expect(primaryMeta(slots, { compare: { shape: 'scalar', meta: { unit: 'x' } } })).toEqual({ unit: 'x' });
    expect(primaryMeta(slots, { value: { shape: 'scalar' }, compare: { shape: 'scalar' } })).toBeUndefined();
    expect(primaryMeta([{ key: 'series' }], { series: { shape: 'series', series: [{}, { meta: { unit: '°C' } }] } })).toEqual({ unit: '°C' });
  });
});

describe('resolvePlacement with a source', () => {
  const input = { template: STAT_VALUE, slotCount: 2 };
  it('the source beats the type default, the placement beats the source', () => {
    expect(resolvePlacement({ ...input, settings: {} }).format).toMatchObject({ decimals: 0 });
    expect(resolvePlacement({ ...input, settings: {}, sourceMeta: { unit: '%', decimals: 1 } }).format).toMatchObject({ unit: '%', decimals: 1 });
    const own = resolvePlacement({ ...input, settings: { $format: { unit: 'pct', decimals: 3 } }, sourceMeta: { unit: '%', decimals: 1 } });
    expect(own.format).toMatchObject({ unit: 'pct', decimals: 3 });
  });
  it('a saved definition beats the source', () => {
    const r = resolvePlacement({ ...input, settings: {}, definitionDefaults: { $format: { unit: 'W' } }, sourceMeta: { unit: '%' } });
    expect(r.format.unit).toBe('W');
  });
  it('the source default shows in the editor layers, so the form can say "from the source"', () => {
    expect(resolvePlacement({ ...input, settings: {}, sourceMeta: { unit: 'kWh' } }).layers['core:format']).toMatchObject({ unit: 'kWh' });
  });
  it('direction defaults "an increase is" until the placement says otherwise', () => {
    const base = { ...input, sourceMeta: { direction: 'lowerIsBetter' as const } };
    expect(resolvePlacement({ ...base, settings: {} }).settings.increaseIs).toBe('bad');
    expect(resolvePlacement({ ...base, settings: { increaseIs: 'good' } }).settings.increaseIs).toBe('good');
    expect(resolvePlacement({ ...input, settings: {} }).settings.increaseIs).toBe('neutral');
  });
  it('a template that prints no numbers is untouched', () => {
    expect(resolvePlacement({ template: STATE, slotCount: 1, settings: {}, sourceMeta: { unit: '%' } }).format).toEqual({});
  });
  it('the stat comparison colours a change by the source direction', () => {
    const r = resolvePlacement({ ...input, settings: {}, sourceMeta: { direction: 'lowerIsBetter' } });
    expect(comparison(12, 10, r.settings, r.format, 'en')?.meaning).toBe('bad');
    expect(comparison(8, 10, r.settings, r.format, 'en')?.meaning).toBe('good');
  });
  it('the kind still declares its slots', () => {
    expect(STAT_VALUE_KIND.slots.map((s) => s.key)).toEqual(['value', 'compare']);
    expect(DATA_TABLE_KIND.template).toBe(DATA_TABLE);
  });
});

describe('table columns from the source', () => {
  it('unit, decimals and the value map are the column defaults, with a badge cell for a mapped column', () => {
    const cols = tableColumns(table, effective(DATA_TABLE, {}));
    const level = cols.find((c) => c.key === 'level')!;
    expect(level.override).toEqual({ unit: 'm', decimals: 2 });
    const door = cols.find((c) => c.key === 'door')!;
    expect(door.cell).toBe('badge');
    expect(door.valueMap?.map((e) => e.label)).toEqual(['Closed', 'Open']);
  });
  it('a placement setting wins over the source', () => {
    const settings = effective(DATA_TABLE, {
      columns: [{ key: 'level', unit: 'cm', decimals: 0 }, { key: 'door', valueMap: [{ value: '0', label: 'Shut' }] }],
    });
    const cols = tableColumns(table, settings);
    expect(cols.find((c) => c.key === 'level')!.override).toEqual({ unit: 'cm', decimals: 0 });
    expect(cols.find((c) => c.key === 'door')!.valueMap?.map((e) => e.label)).toEqual(['Shut']);
  });
  it('renders the words, not the codes', () => {
    const View = DATA_TABLE_VIEW.View;
    const { container } = render(<View settings={effective(DATA_TABLE, {})} format={{}} data={{ rows: table }} locale="en" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Closed');
    expect(text).toContain('Open');
    expect(text).toContain('1.23 m');
  });
  it('exports the header with its unit, mapped words and column decimals', () => {
    const csv = DATA_TABLE_VIEW.toCsv!({ rows: table }, effective(DATA_TABLE, {}), {});
    expect(csv[0]).toEqual(['Device', 'Level (m)', 'Door']);
    expect(csv[1]).toEqual(['A', '1.23', 'Closed']);
    expect(csv[2]).toEqual(['B', '2.00', 'Open']);
  });
  it('a column with no meta exports exactly as before', () => {
    const plain: SlotData = { shape: 'table', columns: [{ key: 'v', label: 'V', type: 'number' }], rows: [{ v: 1.23456 }] };
    const [col] = tableColumns(plain, effective(DATA_TABLE, {}));
    expect(csvHeader(col)).toBe('V');
    expect(csvCell(col, 1.23456)).toBe('1.23456');
  });
});

describe('state and map from the source', () => {
  it('a state with no matching rule uses the source word and colour', () => {
    const meta = { valueMap: { RUNNING: { label: 'Running', color: '#00aa00' } } };
    const out = evaluateState('RUNNING', effective(STATE, {}), false, 'Unknown', meta);
    expect(out).toMatchObject({ label: 'Running', color: '#00aa00', matched: true });
    // an explicit rule still wins
    const ruled = evaluateState('RUNNING', effective(STATE, { states: [{ match: 'RUNNING', label: 'Up', color: '#0000ff' }] }), false, 'Unknown', meta);
    expect(ruled.label).toBe('Up');
    // and without meta the fallback stays as it was
    expect(evaluateState('RUNNING', effective(STATE, {}), false, 'Unknown').matched).toBe(false);
  });
  const points: SlotData = {
    shape: 'table',
    columns: [
      { key: 'lat', label: 'Lat', type: 'number' }, { key: 'lng', label: 'Lng', type: 'number' },
      { key: 'status', label: 'Status', type: 'text', valueMap: { ok: { label: 'Normal', color: '#00aa00' }, alarm: { label: 'Alarm', color: '#cc0000' } } },
    ],
    rows: [{ lat: 41, lng: 29, status: 'ok' }, { lat: 40, lng: 28, status: 'alarm' }],
  };
  it('marker colours and the legend come from the status column meta', () => {
    const settings = effective(MAP, { colorBy: 'column', colorColumn: 'status' });
    expect(effectiveValueColors(points, settings as never)?.length).toBe(2);
    const colors = buildMarkers(points, settings).markers.map((m) => m.color);
    expect(colors).toEqual(['#00aa00', '#cc0000']);
    expect(mapLegend(points, settings).map((e) => e.label)).toEqual(['Normal', 'Alarm']);
  });
  it('the placement colour map wins', () => {
    const settings = effective(MAP, { colorBy: 'column', colorColumn: 'status', valueColors: [{ value: 'ok', color: '#111111' }] });
    expect(buildMarkers(points, settings).markers[0].color).toBe('#111111');
  });
});

describe('a stat over a scalar with meta', () => {
  it('prints the source label when the placement has none', () => {
    const View = STAT_VALUE_VIEW.View;
    const data: Record<string, SlotData> = { value: { shape: 'scalar', value: 21, meta: { label: { en: 'Room temperature' }, unit: '°C' } } };
    const { container } = render(<View settings={effective(STAT_VALUE, {})} format={{ decimals: 0, unit: '°C' }} data={data} locale="en" />);
    expect(container.textContent).toContain('Room temperature');
    expect(container.textContent).toContain('°C');
  });
});
