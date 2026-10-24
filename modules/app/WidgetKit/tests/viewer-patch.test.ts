import { describe, it, expect } from 'vitest';
import { effective } from '../settings/engine';
import { VIEWER_MODEL } from '../templates/viewer-model';
import {
  applyViewerPatch, applyViewerRules, buildThings, cameraForTarget, MAX_THINGS, viewerView, viewerViewKey,
  type SensorMarker, type ThingMarker,
} from '../views/viewer-model-logic';
import { parseScenePatch, type ScenePatch } from '../views/scene-patch';

// The scene patch on the 3D viewer, in pure logic: things that replace the table's rows, overrides on markers and
// things after the rules, and the camera a view asks for.

const sensor = (id: string, extra: Partial<SensorMarker> = {}): SensorMarker =>
  ({ id, position: [0, 1, 0], color: 'var(--primary)', alarm: false, tooltip: { title: id, fields: [] }, row: { id }, ...extra });
const thing = (id: string, extra: Partial<ThingMarker> = {}): ThingMarker =>
  ({ id, kind: 'box', position: [1, 0, -2], heading: 0, color: 'var(--primary)', alarm: false, size: 0.5, row: { id }, ...extra });
const patchOf = (raw: unknown, maxThings = MAX_THINGS): ScenePatch => parseScenePatch(raw, { maxThings }).patch as ScenePatch;

describe('applyViewerPatch', () => {
  const sensors = [sensor('TT-1'), sensor('PT-2')];
  const things = [thing('B-1'), thing('B-2'), thing('B-3')];

  it('no patch, or a patch without objects, returns the same lists', () => {
    expect(applyViewerPatch(sensors, things, null)).toEqual({ sensors, things });
    const same = applyViewerPatch(sensors, things, patchOf({ problems: ['x'] }));
    expect(same.sensors).toBe(sensors);
    expect(same.things).toBe(things);
  });
  it('colours, hides, labels, pulses, resizes and lifts markers and things by id', () => {
    const out = applyViewerPatch(sensors, things, patchOf({
      objects: {
        'TT-1': { color: 'var(--warning)', label: 'Column top', size: 22, dz: 3 },
        'PT-2': { hidden: true },
        'B-1': { pulse: true, size: 2, dz: 0.5 },
        'B-2': { color: 'var(--error)' },
      },
    }));
    expect(out.sensors.map((m) => m.id)).toEqual(['TT-1']);
    expect(out.sensors[0]).toMatchObject({ color: 'var(--warning)', label: 'Column top', size: 22, position: [0, 4, 0], alarm: false });
    expect(out.things[0]).toMatchObject({ alarm: true, size: 2, position: [1, 0.5, -2] });
    expect(out.things[1]).toMatchObject({ color: 'var(--error)', alarm: true });
    expect(out.things[2]).toBe(things[2]);
  });
  it('the 2D effects and a designer item\'s params change nothing in 3D', () => {
    const out = applyViewerPatch(sensors, things, patchOf({ objects: { 'B-1': { state: 'warning', dx: 4, symbol: 'home.tv', params: { door: 'open' } } } }));
    expect(out.things).toBe(things);
  });
  it('is applied after the rules, so it wins over a rule for the same effect', () => {
    const ruled = applyViewerRules(sensors, things, [{ target: 'B-1', hidden: 'true' }, { target: 'B-2', color: 'var(--success)' }], {});
    expect(ruled.things.map((t) => t.id)).toEqual(['B-2', 'B-3']);
    // a hidden thing is gone after the rules; a patch can still recolour what is left
    const out = applyViewerPatch(ruled.sensors, ruled.things, patchOf({ objects: { 'B-2': { color: 'var(--info)' } } }));
    expect(out.things[0].color).toBe('var(--info)');
  });
  it('things:* in a 3D rule names the things', () => {
    const out = applyViewerRules(sensors, things, [{ target: 'things:*', hidden: 'true' }], {});
    expect(out.things).toEqual([]);
    expect(out.sensors).toHaveLength(2);
  });
});

describe('a patch\'s things replace the table\'s rows', () => {
  it('builds the things from the patch rows with the card\'s own columns, up to the viewer\'s cap of 2 000', () => {
    const s = effective(VIEWER_MODEL, {});
    const rows = Array.from({ length: 1200 }, (_, i) => ({ id: `cow${i}`, kind: 'sphere', x: i, y: 0, z: 0 }));
    const patch = patchOf({ things: rows });
    expect(patch.things).toHaveLength(1200);
    const { things } = buildThings({ shape: 'table', rows: patch.things }, s);
    expect(things).toHaveLength(1200);
    expect(things[0]).toMatchObject({ id: 'cow0', kind: 'sphere' });
    // the 2D default cap would have cut it at 500
    expect(parseScenePatch({ things: rows }).patch?.things).toHaveLength(500);
  });
});

describe('the camera a view asks for', () => {
  it('takes only the 3D views', () => {
    expect(viewerView({ preset: 'top' })).toEqual({ preset: 'top' });
    expect(viewerView({ target: [1, 2, 3], distance: 10 })).toEqual({ target: [1, 2, 3], distance: 10 });
    expect(viewerView('content')).toBeNull();
    expect(viewerView({ x0: 0, y0: 0, x1: 1, y1: 1 })).toBeNull();
    expect(viewerView(undefined)).toBeNull();
  });
  it('a stable key per view, so the camera moves when the view changes and not on every frame', () => {
    expect(viewerViewKey({ preset: 'iso' })).toBe(viewerViewKey({ preset: 'iso' }));
    expect(viewerViewKey({ preset: 'iso' })).not.toBe(viewerViewKey({ preset: 'top' }));
    expect(viewerViewKey(null)).toBe('');
  });
  it('a target in model coordinates becomes the orbit centre, the camera that far along the current direction', () => {
    const aim = cameraForTarget([10, 20, 5], 10, [0, 0, 2]);
    // z-up model coordinates → world (x, z, −y)
    expect(aim.target).toEqual([10, 5, -20]);
    expect(aim.position).toEqual([10, 5, -10]);
    const yUp = cameraForTarget([1, 2, 3], 5, [3, 4, 0], 'y-up');
    expect(yUp.target).toEqual([1, 2, 3]);
    expect(yUp.position[0]).toBeCloseTo(4, 6);
    expect(yUp.position[1]).toBeCloseTo(6, 6);
    expect(yUp.position[2]).toBeCloseTo(3, 6);
  });
  it('a zero direction falls back to the isometric one', () => {
    const aim = cameraForTarget([0, 0, 0], Math.hypot(1, 0.75, 1), [0, 0, 0], 'y-up');
    expect(aim.position[0]).toBeCloseTo(1, 6);
    expect(aim.position[1]).toBeCloseTo(0.75, 6);
    expect(aim.position[2]).toBeCloseTo(1, 6);
  });
});
