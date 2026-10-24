import { describe, it, expect } from 'vitest';
import { MAP } from '../templates/map';
import { effective, migrate } from '../settings/engine';
import { buildMarkers, mapModel } from '../views/map-logic';
import { VIEWER_MODEL } from '../templates/viewer-model';
import { buildSensors } from '../views/ViewerModelView';
import { buildThings } from '../views/viewer-model-logic';
import { nearestThings } from '../views/viewer-things';
import { DEFAULT_WIDGET_KIT_MESSAGES } from '../messages';
import { hiddenColumns, isAlertValue, isLabelMode, labelModeOf, labelShown, labelText, redactRow } from '../views/overlay-logic';

const table = (rows: Array<Record<string, unknown>>) => ({ shape: 'table' as const, rows });
const settings = (over: Record<string, unknown> = {}) => effective(MAP, over);

describe('the label mode of an overlay', () => {
  it('is the mode the settings name, else what the older on / off switch said, else the fallback', () => {
    expect(labelModeOf({ labelMode: 'alerts' })).toBe('alerts');
    expect(labelModeOf({ showLabels: true }, 'labelMode', 'showLabels', 'always', 'none')).toBe('always');
    expect(labelModeOf({ showLabels: false }, 'labelMode', 'showLabels', 'always', 'none')).toBe('none');
    expect(labelModeOf({}, 'labelMode', 'showLabels', 'always', 'none')).toBe('none');
    expect(labelModeOf({}, 'labelMode', 'showSensorLabels')).toBe('always');
    // a 3D model has a second one, for its things
    expect(labelModeOf({ thingLabelMode: 'alerts', labelMode: 'none' }, 'thingLabelMode')).toBe('alerts');
    expect(labelModeOf({ showThingLabels: false }, 'thingLabelMode', 'showThingLabels')).toBe('none');
    // a mode wins over the old switch, and a word that is not a mode is not one
    expect(labelModeOf({ labelMode: 'none', showLabels: true }, 'labelMode', 'showLabels')).toBe('none');
    expect(isLabelMode('hover')).toBe(false);
    expect(labelModeOf({ labelMode: 'hover' }, 'labelMode', undefined, 'always', 'none')).toBe('none');
  });

  it('names everyone in "always", only the alerts in "alerts", nobody in "none"', () => {
    expect([labelShown('always', false), labelShown('always', true)]).toEqual([true, true]);
    expect([labelShown('alerts', false), labelShown('alerts', true)]).toEqual([false, true]);
    expect([labelShown('none', false), labelShown('none', true)]).toEqual([false, false]);
  });

  it('reads an alert from a status word of any case, a true, or a status code; nothing else is one', () => {
    for (const v of ['Warning', ' CRITICAL ', 'sos', 'Fall', 'ppe', 'still', 'zone', 'alarm', true, 1, 2, '1']) expect(isAlertValue(v), String(v)).toBe(true);
    for (const v of ['ok', 'Normal', 'idle', '', null, undefined, false, 0, 3, {}]) expect(isAlertValue(v), String(v)).toBe(false);
  });
});

describe('privacy', () => {
  it('hides the label column and the identity columns only in privacy mode', () => {
    expect(hiddenColumns({ labelColumn: 'name', identityColumns: ['badge'] })).toEqual([]);
    expect(hiddenColumns({ labelAnonymous: true, labelColumn: 'name', identityColumns: ['badge', 'name', '', 3 as unknown as string] })).toEqual(['name', 'badge']);
  });

  it('takes the identifying columns out of a row, as a copy, and leaves a row it need not touch', () => {
    const row = { id: 'p1', name: 'Ann', badge: 'B-7', role: 'Supervisor' };
    expect(redactRow(row, ['name', 'badge'])).toEqual({ id: 'p1', role: 'Supervisor' });
    expect(row.name).toBe('Ann');
    expect(redactRow(row, [])).toBe(row);
  });

  it('labels with the role in privacy mode, never the name, and with the label column otherwise', () => {
    const row = { name: 'Ann', role: 'Supervisor' };
    expect(labelText(row, { labelColumn: 'name', roleColumn: 'role' })).toBe('Ann');
    expect(labelText(row, { labelColumn: 'name', roleColumn: 'role', labelAnonymous: true })).toBe('Supervisor');
    expect(labelText(row, { labelColumn: 'name', labelAnonymous: true })).toBeUndefined();
    expect(labelText({ name: '' }, { labelColumn: 'name' })).toBeUndefined();
  });
});

describe('the map card', () => {
  const rows = table([
    { lat: 41, lng: 29, id: 'p1', label: 'Ann Kaya', role: 'Supervisor', badge: 'B-7', status: 'Ok' },
    { lat: 41.1, lng: 29, id: 'p2', label: 'Bob Demir', role: 'Worker', badge: 'B-9', status: 'SOS' },
  ]);

  it('names every marker in "always", the ones in trouble in "alerts", none in "none"', () => {
    const labels = (labelMode: string) => buildMarkers(rows, settings({ labelMode, colorBy: 'column', colorColumn: 'status' })).markers.map((m) => [m.label, m.permanentLabel, m.alert]);
    // "always" is the map's own switch: no marker says anything of its own
    expect(labels('always')).toEqual([['Ann Kaya', undefined, undefined], ['Bob Demir', undefined, true]]);
    expect(labels('alerts')).toEqual([['Ann Kaya', false, undefined], ['Bob Demir', true, true]]);
    expect(labels('none')).toEqual([['Ann Kaya', undefined, undefined], ['Bob Demir', undefined, true]]);
    const input = { messages: { map: DEFAULT_WIDGET_KIT_MESSAGES.map, common: DEFAULT_WIDGET_KIT_MESSAGES.common } };
    const canvas = (labelMode: string) => mapModel(settings({ labelMode }), { points: rows }, 'en', input).canvas.showLabels;
    expect([canvas('always'), canvas('alerts'), canvas('none')]).toEqual([true, false, false]);
  });

  it('takes the alert from the alert column, else from the status column the colours come from', () => {
    const own = table([{ lat: 41, lng: 29, label: 'A', state: 'fall', status: 'Ok' }, { lat: 41.1, lng: 29, label: 'B', state: 'fine', status: 'Alarm' }]);
    expect(buildMarkers(own, settings({ labelMode: 'alerts', alertColumn: 'state' })).markers.map((m) => m.alert)).toEqual([true, undefined]);
    expect(buildMarkers(own, settings({ labelMode: 'alerts', colorBy: 'column', colorColumn: 'status' })).markers.map((m) => m.alert)).toEqual([undefined, true]);
  });

  it('leaves identity out of the page in privacy mode: the label is the role, and the tooltip, the click and the link carry no name', () => {
    const built = buildMarkers(rows, settings({
      labelMode: 'always', labelAnonymous: true, roleColumn: 'role', identityColumns: ['badge'],
      tooltipColumns: ['label', 'badge', 'role'], linkTemplate: '/people/{badge}/{id}', idColumn: 'id',
    }));
    expect(built.markers.map((m) => m.label)).toEqual(['Supervisor', 'Worker']);
    const json = JSON.stringify(built.markers) + JSON.stringify([...built.rows.values()]);
    for (const secret of ['Ann', 'Bob', 'Kaya', 'Demir', 'B-7', 'B-9']) expect(json, secret).not.toContain(secret);
    expect(built.markers[0]!.tooltip?.fields?.map((f) => f.label)).toEqual(['role']);
    expect(built.rows.get('p1')).toEqual({ lat: 41, lng: 29, id: 'p1', role: 'Supervisor', status: 'Ok' });
    // the link is expanded from the redacted row
    expect(JSON.stringify(built.markers[0]!.tooltip)).not.toContain('B-7');
  });

  it('shows the names of a card as before when it is not anonymous', () => {
    const built = buildMarkers(rows, settings({ labelMode: 'always', tooltipColumns: ['label', 'badge'] }));
    expect(built.markers[0]!.label).toBe('Ann Kaya');
    expect(built.markers[0]!.tooltip?.fields?.map((f) => f.value)).toEqual(['Ann Kaya', 'B-7']);
  });
});

describe('the map card from before the label mode', () => {
  it('migrates its on / off switch: on is "always", off is "none"; a card that never had one keeps the default', () => {
    expect(migrate(MAP, { showLabels: true }, 1).values).toEqual({ labelMode: 'always' });
    expect(migrate(MAP, { showLabels: false }, 1).values).toEqual({ labelMode: 'none' });
    expect(migrate(MAP, {}, 1).values).toEqual({});
    expect(effective(MAP, {}).labelMode).toBe('none');
    // a card already at version 2 is left alone
    expect(migrate(MAP, { labelMode: 'alerts' }, 2).values).toEqual({ labelMode: 'alerts' });
  });
});

describe('the 3D model card', () => {
  const sensors = table([
    { x: 1, y: 2, z: 3, id: 's1', name: 'Ann Kaya', role: 'Supervisor', badge: 'B-7', state: 'ok' },
    { x: 4, y: 5, z: 6, id: 's2', name: 'Bob Demir', role: 'Worker', badge: 'B-9', state: 'fall' },
  ]);
  const vm = (over: Record<string, unknown> = {}) => effective(VIEWER_MODEL, { idColumn: 'id', xColumn: 'x', yColumn: 'y', zColumn: 'z', labelColumn: 'name', ...over });

  it('marks a sensor in trouble by its colour or by its alert column', () => {
    const { sensors: built } = buildSensors(sensors, vm({ alertColumn: 'state' }));
    expect(built.map((s) => s.alert)).toEqual([false, true]);
    const red = buildSensors(table([{ x: 0, y: 0, z: 0, status: 'Alarm' }]), vm({ colorBy: 'column', colorColumn: 'status', valueColors: [{ value: 'Alarm', color: 'var(--error)' }] }));
    expect(red.sensors[0]!.alert).toBe(true);
  });

  it('leaves identity out in privacy mode: the sensor is labelled with its role, and its tooltip, its row and its click carry no name', () => {
    const { sensors: built, rows } = buildSensors(sensors, vm({ labelAnonymous: true, roleColumn: 'role', identityColumns: ['badge'], tooltipColumns: ['name', 'badge', 'role'] }));
    expect(built.map((s) => s.label)).toEqual(['Supervisor', 'Worker']);
    const json = JSON.stringify(built) + JSON.stringify([...rows.values()]);
    for (const secret of ['Ann', 'Bob', 'Kaya', 'Demir', 'B-7', 'B-9']) expect(json, secret).not.toContain(secret);
    expect(built[0]!.tooltip.fields.map((f) => f.label)).toEqual(['role']);
    expect(built[0]!.row).toEqual({ x: 1, y: 2, z: 3, id: 's1', role: 'Supervisor', state: 'ok' });
  });

  it('does the same for things: their label and the row a click reports', () => {
    const things = table([{ id: 't1', x: 1, y: 1, z: 0, name: 'Ann Kaya', role: 'Supervisor', badge: 'B-7', state: 'sos' }, { id: 't2', x: 2, y: 1, z: 0, name: 'Bob Demir', role: 'Worker', badge: 'B-9', state: 'ok' }]);
    const s = vm({ thingIdColumn: 'id', thingLabelColumn: 'name', labelAnonymous: true, roleColumn: 'role', identityColumns: ['badge'], alertColumn: 'state' });
    const built = buildThings(things, s);
    expect(built.things.map((t) => [t.label, t.alert])).toEqual([['Supervisor', true], ['Worker', false]]);
    const json = JSON.stringify(built.things) + JSON.stringify([...built.rows.values()]);
    for (const secret of ['Ann', 'Bob', 'B-7', 'B-9']) expect(json, secret).not.toContain(secret);
    // not anonymous: the name is the label, the row is whole
    const plain = buildThings(things, vm({ thingIdColumn: 'id', thingLabelColumn: 'name' }));
    expect(plain.things[0]!.label).toBe('Ann Kaya');
    expect(plain.things[0]!.row['badge']).toBe('B-7');
  });

  it('keeps the name of a thing in trouble when more things have labels than the screen carries', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, kind: 'box' as const, position: [i, 0, 0] as [number, number, number], heading: 0, label: `T${i}`, color: 'var(--primary)', alarm: false, size: 1, row: {} }));
    // the farthest one is in trouble: of two names it gets one
    const far = { ...many[4]!, alert: true };
    const near = nearestThings([...many.slice(0, 4), far], { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 2);
    expect(near.map((t) => t.id)).toEqual(['t4', 't0']);
  });
});
