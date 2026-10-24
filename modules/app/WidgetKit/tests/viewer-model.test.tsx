import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as THREE from 'three';
import { effective, migrate, templateDefaults, validate } from '../settings/engine';
import type { SlotData, WidgetViewProps } from '../kind';
import { VIEWER_MODEL, VIEWER_MODEL_KIND } from '../templates/viewer-model';
import { BUILTIN_VIEWS } from '../views';
import { resolveModelUrl } from '../views/content-logic';
import {
  applyViewerRules, buildSensors, buildThings, modelSources, toWorld, VIEWER_MODEL_VIEW, MAX_MODELS, MAX_THINGS, VIEWER_RULE_EFFECTS,
} from '../views/ViewerModelView';
import { validateRules } from '../views/scene-rules-logic';
import { thingMeshName } from '../views/viewer-things';
import { sampleData } from '../sample/sample-data';
import { PLANT_MODEL } from '../sample/sample-boards';

// ── A fake kui-viewer (jsdom has no WebGL) ────────────────────────────────────────────────────
// Just enough of the React binding: <KUIViewer> makes a viewer on mount and disposes it on unmount,
// <ModelLoader> resolves or rejects per URL, useViewer reads the context. The scene keeps what is
// added to it (the things layer's meshes), the camera is a plain object (three.js is real, the
// viewer is not).

class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  // An orthographic stand-in: world ±100 m → the canvas edges.
  project() { this.x /= 100; this.y /= 100; this.z = 0; return this; }
}

type FakeMesh = { name?: string; count?: number; position: Vec3 };
type FakeViewer = {
  disposed: boolean;
  controls: Record<string, unknown>;
  camera: { position: { x: number; y: number; z: number } };
  scene: { background: { isColor: boolean; set: (c: string) => void; value?: string }; children: FakeMesh[] };
  renderer: { domElement: HTMLCanvasElement };
  /** The origin shift and its listeners (`rtc.onChange`), fired by a test the way a re-tile would. */
  rtc: { global: Vec3; onChange: (listener: () => void) => () => void };
  originListeners: Array<() => void>;
  invalidate: ReturnType<typeof vi.fn>;
};

const fake = vi.hoisted(() => ({
  created: [] as FakeViewer[],
  failing: new Set<string>(),
  loads: [] as string[],
}));

vi.mock('@kuraykaraaslan/kui-viewer/styles.css', () => ({}));
vi.mock('@kuraykaraaslan/kui-viewer', () => ({ addGridHelpers: vi.fn(), removeHelpers: vi.fn() }));
vi.mock('@kuraykaraaslan/kui-viewer/react', () => {
  const Ctx = createContext<unknown>(null);
  function makeViewer() {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 400 });
    Object.defineProperty(canvas, 'clientHeight', { value: 200 });
    const background: { isColor: boolean; value?: string; set: (c: string) => void } = { isColor: true, set: (c: string) => { background.value = c; } };
    const children: FakeMesh[] = [];
    const scene = {
      background,
      children,
      add(o: FakeMesh) { children.push(o); return scene; },
      remove(o: FakeMesh) { const i = children.indexOf(o); if (i >= 0) children.splice(i, 1); return scene; },
    };
    const originListeners: Array<() => void> = [];
    const v = {
      disposed: false,
      scene,
      camera: { position: new Vec3(10, 10, 10), fov: 50, aspect: 2, updateMatrixWorld: () => {}, matrixWorld: { elements: [1, 0, 0, 0] } },
      controls: { enabled: true, enableZoom: true, target: new Vec3(), update: vi.fn() },
      renderer: { domElement: canvas },
      rtc: {
        global: new Vec3(),
        onChange: (listener: () => void) => {
          originListeners.push(listener);
          return () => { const i = originListeners.indexOf(listener); if (i >= 0) originListeners.splice(i, 1); };
        },
      },
      originListeners,
      invalidate: vi.fn(),
    };
    fake.created.push(v as never);
    return v;
  }
  function KUIViewer({ onReady, children, className }: { onReady?: (v: unknown) => void; children?: ReactNode; className?: string }) {
    const [viewer, setViewer] = useState<ReturnType<typeof makeViewer> | null>(null);
    useEffect(() => {
      const v = makeViewer();
      setViewer(v);
      onReady?.(v);
      return () => { v.disposed = true; };
    }, [onReady]);
    return <div data-testid="kui-viewer" className={className}><Ctx.Provider value={viewer}>{viewer ? children : null}</Ctx.Provider></div>;
  }
  function ModelLoader({ source, onLoad, onError }: { source: string; onLoad?: (h: unknown) => void; onError?: (e: Error) => void }) {
    useEffect(() => {
      fake.loads.push(source);
      const t = setTimeout(() => {
        if (fake.failing.has(source)) onError?.(new Error(`404 ${source}`));
        else onLoad?.({ id: source, globalIdToCentroid: new Map([['a', new Vec3(-10, 0, -5)], ['b', new Vec3(10, 6, 5)]]), dispose: () => {} });
      }, 0);
      return () => clearTimeout(t);
    }, [source, onLoad, onError]);
    return null;
  }
  return {
    KUIViewer,
    ModelLoader,
    NavCube: () => <div data-testid="navcube" />,
    useViewer: () => useContext(Ctx),
  };
});

const TABLE: SlotData = {
  shape: 'table',
  columns: [
    { key: 'id', label: 'Tag', type: 'text' }, { key: 'label', label: 'Sensor', type: 'text' },
    { key: 'x', label: 'X', type: 'number' }, { key: 'y', label: 'Y', type: 'number' }, { key: 'z', label: 'Z', type: 'number' },
    { key: 'value', label: 'Reading', type: 'number' }, { key: 'unit', label: 'Unit', type: 'text' }, { key: 'status', label: 'Status', type: 'text' },
  ],
  rows: [
    { id: 'TT-1', label: 'Column top', x: 1, y: 2, z: 3, value: 118.4, unit: '°C', status: 'Normal' },
    { id: 'PT-2', label: 'Drum', x: 4, y: 5, z: 6, value: 9.8, unit: 'bar', status: 'Alarm' },
    { id: 'BAD', label: 'No coordinates', x: 1, y: null, z: 3, value: 1, status: 'Normal' },
  ],
};

/** The dashboard's `things` contract (phase 35 B.4): one row per object in the room. */
const THINGS: SlotData = {
  shape: 'table',
  columns: [
    { key: 'id', label: 'Badge', type: 'text' }, { key: 'kind', label: 'Kind', type: 'text' }, { key: 'label', label: 'Who', type: 'text' },
    { key: 'x', label: 'X', type: 'number' }, { key: 'y', label: 'Y', type: 'number' }, { key: 'z', label: 'Z', type: 'number' },
    { key: 'heading', label: 'Heading', type: 'number' }, { key: 'status', label: 'Status', type: 'text' }, { key: 'size', label: 'Size', type: 'number' },
  ],
  rows: [
    { id: 'B-1', kind: 'Cylinder', label: 'Ayşe', x: 1, y: 2, z: 0, heading: 90, status: 'Normal', size: 1.7 },
    { id: 'B-2', kind: 'box', label: 'Forklift 3', x: 4, y: 5, z: 0, heading: 180, status: 'Alarm' },
    { id: 'B-3', kind: 'no-such', label: 'Crate', x: 7, y: 8, z: 0, status: 'Normal' },
    { id: 'B-4', kind: 'pin', x: 'n/a', y: 1, z: 0 },
  ],
};

const props = (settings: Record<string, unknown> = {}, data: WidgetViewProps['data'] = { sensors: TABLE }): WidgetViewProps =>
  ({ settings: effective(VIEWER_MODEL, settings), format: {}, data, locale: 'en', title: 'Plant' });

const MODELS = { models: [{ url: '/m/a.ifc', label: 'A', visible: true }, { url: '/m/b.ifc', label: 'B', visible: true }] };

function withWebgl() {
  const ctx2d = { fillStyle: '', fillRect: () => {}, getImageData: () => ({ data: [1, 2, 3, 255] }) };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => (kind === '2d' ? ctx2d : {})) as never);
}

beforeEach(() => {
  fake.created.length = 0;
  fake.loads.length = 0;
  fake.failing.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('builtin:viewer.model template', () => {
  it('is v3 (things and rules, then the label mode) with a note-only step and a renaming one, valid defaults, a registered view and the kind\'s geometry', () => {
    expect(VIEWER_MODEL.version).toBe(3);
    expect(VIEWER_MODEL.migrations).toHaveLength(2);
    expect(VIEWER_MODEL.migrations[0]).toMatchObject({ from: 1, to: 2 });
    expect(VIEWER_MODEL.migrations[1]).toMatchObject({ from: 2, to: 3 });
    expect(VIEWER_MODEL_KIND).toMatchObject({ type: 'viewer.model', label: '3D model', icon: 'fas fa-cube', defaultW: 6, defaultH: 8, group: 'viewer' });
    expect(VIEWER_MODEL_KIND.slots).toEqual([
      { key: 'sensors', label: 'Sensors', shape: 'table', required: false },
      { key: 'things', label: 'Things (one row each)', shape: 'table', required: false },
    ]);
    expect(BUILTIN_VIEWS['viewer.model']).toBe(VIEWER_MODEL_VIEW);
    expect(validate(VIEWER_MODEL, templateDefaults(VIEWER_MODEL)).issues).toEqual([]);
    const groups = new Set(VIEWER_MODEL.groups.map((g) => g.id));
    for (const [key, f] of Object.entries(VIEWER_MODEL.fields)) {
      expect(groups.has(f.group ?? ''), key).toBe(true);
      const v3 = ['labelMode', 'thingLabelMode', 'roleColumn', 'alertColumn', 'labelAnonymous', 'identityColumns'];
      expect(f.since, key).toBe(v3.includes(key) ? 3 : key.startsWith('thing') || key === 'rules' ? 2 : 1);
    }
    expect((VIEWER_MODEL.fields.rules.fields!.op as { options: Array<{ value: string }> }).options.map((o) => o.value)).toContain('between');
  });

  it('settings saved by v1 migrate unchanged', () => {
    const stored = { ...PLANT_MODEL, showGrid: true };
    const r = migrate(VIEWER_MODEL, stored, 1);
    expect(r.values).toEqual(stored);
    expect(r.applied.map((a) => [a.from, a.to])).toEqual([[1, 2], [2, 3]]);
  });

  it('settings saved before the label mode keep what their on / off switches said: on is always, off is never', () => {
    expect(migrate(VIEWER_MODEL, { showSensorLabels: false, showThingLabels: true }, 2).values).toEqual({ labelMode: 'none', thingLabelMode: 'always' });
    expect(migrate(VIEWER_MODEL, { showSensorLabels: true, showThingLabels: false }, 2).values).toEqual({ labelMode: 'always', thingLabelMode: 'none' });
    // a card that never set them keeps the default, which is the old one (labels on)
    expect(templateDefaults(VIEWER_MODEL)).toMatchObject({ labelMode: 'always', thingLabelMode: 'always' });
  });

  it('accepts internal and https models and refuses anything else', () => {
    expect(validate(VIEWER_MODEL, { models: [{ url: '/samples/x.ifc' }, { url: 'https://cdn.example.com/y.ifc' }] }).issues).toEqual([]);
    const bad = validate(VIEWER_MODEL, { models: [{ url: 'http://example.com/a.ifc' }, { url: '//evil.example/a.ifc' }] }).issues;
    expect([...new Set(bad.map((i) => i.path))].sort()).toEqual(['models.0.url', 'models.1.url']);
    expect(resolveModelUrl('javascript:alert(1)')).toBeNull();
    expect(resolveModelUrl('/a b.ifc')).toBeNull();
  });

  it('checks the shape of a rule (the targets are row ids the data brings)', () => {
    expect(validate(VIEWER_MODEL, { rules: [{ target: 'B-2', key: 'status', op: 'eq', value: 'Alarm', color: 'var(--error)', pulse: 'true', size: 2, dz: 0.5 }] }).issues).toEqual([]);
    expect(validate(VIEWER_MODEL, { rules: [{ target: '*', op: 'gt', key: 'value', value: '10', hidden: 'true', label: 'High: {value}' }] }).issues).toEqual([]);
    const paths = validate(VIEWER_MODEL, { rules: [{ target: '', op: 'gt', key: 'value', value: 'abc', size: 'big' }] }).issues.map((i) => i.path);
    expect(paths).toContain('rules.0.target');
    expect(paths).toContain('rules.0.value');
    expect(paths).toContain('rules.0.size');
    // the engine's own check, with the viewer's effects: a thing id is any text, `state` is not an effect here
    expect(validateRules([{ target: 'anything', of: 'other', key: 'v', op: 'set', state: 'dead' }], { elementIds: [], fromData: true }, VIEWER_RULE_EFFECTS)).toEqual([]);
  });

  it('the sample plant settings and source pass unchanged', () => {
    const r = validate(VIEWER_MODEL, PLANT_MODEL);
    expect(r.issues).toEqual([]);
    expect(r.values).toEqual(PLANT_MODEL);
    const data = sampleData('sample.plant.sensors');
    expect(data?.shape).toBe('table');
    expect(buildSensors(data, effective(VIEWER_MODEL, PLANT_MODEL)).sensors).toHaveLength(9);
  });
});

describe('models and sensors', () => {
  it('loads visible, allowed models once each, rewritten by the host and checked again', () => {
    const s = effective(VIEWER_MODEL, {
      models: [
        { url: '/a.ifc', label: 'A' }, { url: '/a.ifc' }, { url: '/hidden.ifc', visible: false },
        { url: 'ftp://x/y.ifc' }, { url: 'https://h.example/models/b.ifc?v=2' },
      ],
    });
    expect(modelSources(s)).toEqual([{ url: '/a.ifc', label: 'A' }, { url: 'https://h.example/models/b.ifc?v=2', label: 'b.ifc' }]);
    expect(modelSources(s, (u) => `/t/acme${u}`)[0].url).toBe('/t/acme/a.ifc');
    expect(modelSources(s, () => '//evil.example/x')).toEqual([{ url: 'https://h.example/models/b.ifc?v=2', label: 'b.ifc' }]);
    const many = effective(VIEWER_MODEL, { models: Array.from({ length: 12 }, (_, i) => ({ url: `/m${i}.ifc` })) });
    expect(modelSources(many)).toHaveLength(MAX_MODELS);
  });

  it('maps IFC (Z up) coordinates to the viewer world (Y up)', () => {
    expect(toWorld([1, 2, 3])).toEqual([1, 3, -2]);
    expect(toWorld([1, 2, 3], 'y-up')).toEqual([1, 2, 3]);
  });

  it('turns rows into markers: coordinates, reading with unit, status colour, tooltip, the row', () => {
    const { sensors } = buildSensors(TABLE, effective(VIEWER_MODEL, { tooltipColumns: ['label'] }), 'en');
    expect(sensors.map((m) => m.id)).toEqual(['TT-1', 'PT-2']); // the row without a y is not placed
    expect(sensors[0]).toMatchObject({ position: [1, 3, -2], label: 'Column top', color: 'var(--success)', alarm: false });
    expect(sensors[0].valueText).toContain('118.4');
    expect(sensors[0].valueText).toContain('°C');
    expect(sensors[1]).toMatchObject({ color: 'var(--error)', alarm: true });
    expect(sensors[1].tooltip.description).toBe('Alarm');
    expect(sensors[0].tooltip.fields.map((f) => f.label)).toEqual(['Reading', 'Sensor']);
    expect(sensors[1].row).toBe(TABLE.rows![1]);
  });

  it('colours by ranges on the reading, or one fixed colour', () => {
    const ranges = buildSensors(TABLE, effective(VIEWER_MODEL, { colorBy: 'ranges', ranges: [{ to: 50, color: 'var(--info)' }, { from: 50, color: 'var(--warning)' }] })).sensors;
    expect(ranges.map((m) => m.color)).toEqual(['var(--warning)', 'var(--info)']);
    const fixed = buildSensors(TABLE, effective(VIEWER_MODEL, { colorBy: 'fixed', markerColor: '#123456' })).sensors;
    expect(fixed.every((m) => m.color === '#123456')).toBe(true);
  });

  it('is empty with no model, no placed sensor and no thing; exports the sensor columns as CSV', () => {
    const s = effective(VIEWER_MODEL, {});
    expect(VIEWER_MODEL_VIEW.isEmpty!({}, s)).toBe(true);
    expect(VIEWER_MODEL_VIEW.isEmpty!({ sensors: TABLE }, s)).toBe(false);
    expect(VIEWER_MODEL_VIEW.isEmpty!({ things: THINGS }, s)).toBe(false);
    expect(VIEWER_MODEL_VIEW.isEmpty!({}, effective(VIEWER_MODEL, MODELS))).toBe(false);
    const csv = VIEWER_MODEL_VIEW.toCsv!({ sensors: TABLE }, s, {});
    expect(csv[0]).toEqual(['Tag', 'Sensor', 'X', 'Y', 'Z', 'Reading', 'Unit', 'Status']);
    expect(csv).toHaveLength(3);
  });
});

describe('things from rows', () => {
  it('builds one thing per row with a kind, a point it stands on, a heading, a label, a colour and a size', () => {
    const { things, rows } = buildThings(THINGS, effective(VIEWER_MODEL, { thingSizeColumn: 'size' }));
    expect(things.map((t) => t.id)).toEqual(['B-1', 'B-2', 'B-3']); // the row without an x is not placed
    expect(things[0]).toMatchObject({ kind: 'cylinder', position: [1, 0, -2], heading: 90, label: 'Ayşe', color: 'var(--success)', alarm: false, size: 1.7 });
    expect(things[1]).toMatchObject({ kind: 'box', heading: 180, label: 'Forklift 3', color: 'var(--error)', alarm: true, size: 0.5 });
    // an unknown kind word takes the fixed kind; no heading = 0
    expect(things[2]).toMatchObject({ kind: 'box', heading: 0, size: 0.5 });
    expect(things[0].row).toBe(THINGS.rows![0]);
    expect([...rows.keys()]).toEqual(['B-1', 'B-2', 'B-3']);
  });
  it('takes the fixed kind and size, the sensors\' coordinate convention and colour settings', () => {
    const s = effective(VIEWER_MODEL, { thingKind: 'pin', thingKindColumn: '', thingSize: 2, coordinates: 'y-up', colorBy: 'fixed', markerColor: '#123456' });
    const { things } = buildThings(THINGS, s);
    expect(things.every((t) => t.kind === 'pin' && t.size === 2 && t.color === '#123456' && !t.alarm)).toBe(true);
    expect(things[0].position).toEqual([1, 2, 0]);
    // ranges on the reading column, read from the thing's own row
    const ranged = buildThings({ shape: 'table', rows: [{ id: 'a', x: 0, y: 0, z: 0, value: 80 }] }, effective(VIEWER_MODEL, { colorBy: 'ranges', ranges: [{ from: 50, color: 'var(--warning)' }] })).things;
    expect(ranged[0].color).toBe('var(--warning)');
  });
  it('names a thing by the row number without an id column, keeps duplicate ids apart, and stops at the cap', () => {
    const rows = Array.from({ length: MAX_THINGS + 5 }, (_, i) => ({ id: i < 2 ? 'dup' : `t${i}`, x: i, y: 0, z: 0 }));
    const { things } = buildThings({ shape: 'table', rows }, effective(VIEWER_MODEL, {}));
    expect(things).toHaveLength(MAX_THINGS);
    expect(things.slice(0, 2).map((t) => t.id)).toEqual(['dup', 'dup#1']);
    const numbered = buildThings({ shape: 'table', rows: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] }, effective(VIEWER_MODEL, { thingIdColumn: '' })).things;
    expect(numbered.map((t) => t.id)).toEqual(['0', '1']);
  });
});

describe('rules on markers and things', () => {
  const s = effective(VIEWER_MODEL, { thingSizeColumn: 'size' });
  const sensors = buildSensors(TABLE, s, 'en').sensors;
  const things = buildThings(THINGS, s).things;

  it('colour, pulse, size and lift from a row, hidden from a parameter, a label with tokens, on both', () => {
    const rules = [
      { target: '*', key: 'status', op: 'eq', value: 'Alarm', color: 'var(--warning)', size: 20, dz: 2 },
      { target: 'B-1', source: 'param', key: 'floor', op: 'ne', value: '1', hidden: 'true' },
      { target: 'TT-1', label: '{label}: {value}', pulse: 'true' },
    ];
    const out = applyViewerRules(sensors, things, rules, { floor: 2 });
    expect(out.sensors.map((m) => m.id)).toEqual(['TT-1', 'PT-2']);
    expect(out.sensors[1]).toMatchObject({ color: 'var(--warning)', alarm: false, size: 20, position: [4, 8, -5] });
    expect(out.sensors[0]).toMatchObject({ label: 'Column top: 118.4', alarm: true });
    expect(out.sensors[0].size).toBeUndefined();
    expect(out.things.map((t) => t.id)).toEqual(['B-2', 'B-3']);
    expect(out.things[0]).toMatchObject({ color: 'var(--warning)', alarm: false, size: 20, position: [4, 2, -5] });
    expect(out.things[1]).toBe(things[2]); // untouched: the same object
    // the parameter on the other value keeps the thing
    expect(applyViewerRules(sensors, things, rules, { floor: 1 }).things.map((t) => t.id)).toEqual(['B-1', 'B-2', 'B-3']);
  });
  it('a pulse follows the colour unless a rule says otherwise; a colour that is the error tone pulses', () => {
    const red = applyViewerRules(sensors, things, [{ target: 'B-1', color: 'var(--error)' }], {});
    expect(red.things[0]).toMatchObject({ color: 'var(--error)', alarm: true });
    const calm = applyViewerRules(sensors, things, [{ target: 'B-2', pulse: 'false' }], {});
    expect(calm.things[1]).toMatchObject({ color: 'var(--error)', alarm: false });
  });
  it('does nothing without rules, with no targets, or when no rule matches', () => {
    expect(applyViewerRules(sensors, things, [], {})).toEqual({ sensors, things });
    expect(applyViewerRules(sensors, things, undefined, {}).things).toBe(things);
    expect(applyViewerRules([], [], [{ target: '*', hidden: 'true' }], {})).toEqual({ sensors: [], things: [] });
    expect(applyViewerRules(sensors, things, [{ target: 'ghost', hidden: 'true' }], {}).things).toBe(things);
  });
});

describe('ViewerModelView', () => {
  const View = VIEWER_MODEL_VIEW.View;

  it('shows an error state, not a blank card, without WebGL', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<View {...props(MODELS)} />);
    expect(screen.getByRole('alert').textContent).toMatch(/WebGL/);
    expect(screen.queryByTestId('kui-viewer')).toBeNull();
  });

  it('loads the viewer lazily, loads every model, fits the camera and places the sensors', async () => {
    withWebgl();
    render(<View {...props(MODELS)} />);
    expect(await screen.findByTestId('kui-viewer')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Loading models/)).toBeNull());
    expect(fake.loads).toEqual(['/m/a.ifc', '/m/b.ifc']);
    const v = fake.created[0];
    // fitted on the centre of the element centroids, from the iso direction
    expect((v.controls.target as Vec3)).toMatchObject({ x: 0, y: 3, z: 0 });
    expect(v.camera.position.x).toBeGreaterThan(0);
    expect(v.scene.background.value).toBe('#010203');
    expect(screen.getByTestId('navcube')).toBeTruthy();
    const markers = document.querySelectorAll('[data-sensor]');
    expect(markers).toHaveLength(2);
    expect(screen.getByText('Column top · 118.4 °C')).toBeTruthy();
    await waitFor(() => expect((markers[0] as HTMLElement).style.visibility).toBe('visible'));
    expect((markers[0] as HTMLElement).style.transform).toMatch(/translate\(/);
    expect(screen.getByRole('list', { name: 'Legend' }).textContent).toContain('Alarm');
    // no thing: three.js was never brought in, the scene holds no mesh of the kit's
    expect(v.scene.children.some((c) => String(c.name ?? '').startsWith('widget-kit:things'))).toBe(false);
  });

  it('opens a tooltip with the reading and the status on hover', async () => {
    withWebgl();
    render(<View {...props()} />);
    const button = await screen.findByRole('button', { name: /Drum/ });
    fireEvent.mouseEnter(button);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Drum');
    expect(tip.textContent).toContain('Alarm');
    expect(tip.textContent).toContain('9.8');
    fireEvent.mouseLeave(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a click on a sensor marker reports its row (and still toggles the tooltip on a click trigger)', async () => {
    withWebgl();
    const onMarkerClick = vi.fn();
    render(<View {...props({ tooltipTrigger: 'click' })} onMarkerClick={onMarkerClick} />);
    const button = await screen.findByRole('button', { name: /Drum/ });
    fireEvent.click(button);
    expect(onMarkerClick).toHaveBeenCalledWith(TABLE.rows![1]);
    expect(screen.getByRole('tooltip').textContent).toContain('Drum');
    fireEvent.click(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onMarkerClick).toHaveBeenCalledTimes(2);
  });

  it('draws the things as one instanced mesh per kind, updated in place, with a label over the nearest ones', async () => {
    withWebgl();
    const { rerender } = render(<View {...props({ thingSizeColumn: 'size' }, { things: THINGS })} />);
    await screen.findByTestId('kui-viewer');
    const v = fake.created[0];
    // three.js arrives lazily; then every kind present has its mesh with one instance per row
    await waitFor(() => expect(v.scene.children.map((c) => c.name).filter((n) => String(n).startsWith('widget-kit:things')).sort())
      .toEqual([thingMeshName('box'), thingMeshName('cylinder')]));
    const box = v.scene.children.find((c) => c.name === thingMeshName('box'))!;
    expect(box.count).toBe(2);
    expect(v.scene.children.find((c) => c.name === thingMeshName('cylinder'))!.count).toBe(1);
    expect(v.invalidate).toHaveBeenCalledWith('widget-kit:things');
    // the labels: the three labelled things, placed by the camera
    await waitFor(() => expect(document.querySelectorAll('[data-thing]')).toHaveLength(3));
    expect(screen.getByText('Forklift 3')).toBeTruthy();
    await waitFor(() => expect((document.querySelector('[data-thing="B-2"]') as HTMLElement).style.visibility).toBe('visible'));
    // rows leave and one moves: the same box mesh with one instance, the cylinder's mesh gone, one label left
    const fewer: SlotData = { ...THINGS, rows: [{ ...THINGS.rows![1], x: 9 }] };
    rerender(<View {...props({ thingSizeColumn: 'size' }, { things: fewer })} />);
    await waitFor(() => expect(box.count).toBe(1));
    expect(v.scene.children.find((c) => c.name === thingMeshName('box'))).toBe(box);
    expect(v.scene.children.find((c) => c.name === thingMeshName('cylinder'))).toBeUndefined();
    await waitFor(() => expect(document.querySelectorAll('[data-thing]')).toHaveLength(1));
  });

  it('a click on a thing\'s shape reports its row, a drag or an empty spot does not, and the meshes follow the origin shift', async () => {
    withWebgl();
    const onMarkerClick = vi.fn();
    render(<View {...props({ thingSizeColumn: 'size' }, { things: THINGS })} onMarkerClick={onMarkerClick} />);
    await screen.findByTestId('kui-viewer');
    const v = fake.created[0];
    await waitFor(() => expect(v.scene.children.find((c) => c.name === thingMeshName('cylinder'))).toBeTruthy());
    // The fake camera cannot cast a ray: a real one, above the room looking down, takes its place (the viewer object is
    // the same, and the click handler reads the camera at click time). The canvas gets a size for the NDC maths.
    const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 1000);
    camera.position.set(0, 30, 0.01);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    (v as { camera: unknown }).camera = camera;
    const canvas = v.renderer.domElement;
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    const at = (x: number, y: number, z: number) => {
      const p = new THREE.Vector3(x, y, z).project(camera);
      return { clientX: ((p.x + 1) / 2) * 400, clientY: ((1 - p.y) / 2) * 200, button: 0 };
    };
    // B-1 is the cylinder standing on world (1, 0, −2) (IFC x=1, y=2, z=0), 1.7 m tall: a click on its middle
    const onB1 = at(1, 0.8, -2);
    fireEvent.pointerDown(canvas, onB1);
    fireEvent.pointerUp(canvas, onB1);
    expect(onMarkerClick).toHaveBeenCalledTimes(1);
    expect(onMarkerClick).toHaveBeenCalledWith(THINGS.rows![0]);
    // an orbit: the pointer travelled further than a click allows
    fireEvent.pointerDown(canvas, onB1);
    fireEvent.pointerUp(canvas, { ...onB1, clientX: onB1.clientX + 40 });
    expect(onMarkerClick).toHaveBeenCalledTimes(1);
    // nothing stands there
    const onNothing = at(-9, 0, 9);
    fireEvent.pointerDown(canvas, onNothing);
    fireEvent.pointerUp(canvas, onNothing);
    expect(onMarkerClick).toHaveBeenCalledTimes(1);
    // the viewer moves its origin (a re-tile): every instance is placed again from the new shift
    const box = v.scene.children.find((c) => c.name === thingMeshName('box')) as unknown as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    box.getMatrixAt(0, m);
    const before = m.elements[12];
    expect(v.originListeners).toHaveLength(1);
    v.rtc.global.set(100, 0, 0);
    act(() => { for (const l of v.originListeners) l(); });
    await waitFor(() => { box.getMatrixAt(0, m); expect(m.elements[12]).toBe(before - 100); });
    expect(v.scene.children.find((c) => c.name === thingMeshName('box'))).toBe(box as unknown as FakeMesh);
  });

  it('locks the camera and hides the view cube when not interactive', async () => {
    withWebgl();
    render(<View {...props({ ...MODELS, interactive: false })} />);
    await screen.findByTestId('kui-viewer');
    await waitFor(() => expect(fake.created[0]?.controls.enabled).toBe(false));
    expect(screen.queryByTestId('navcube')).toBeNull();
  });

  it('reports a model that failed, and an error state when every model failed', async () => {
    withWebgl();
    fake.failing.add('/m/b.ifc');
    const { unmount } = render(<View {...props(MODELS)} />);
    expect(await screen.findByText('Not loaded: B')).toBeTruthy();
    unmount();
    fake.failing.add('/m/a.ifc');
    render(<View {...props(MODELS)} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be loaded.*404/);
  });

  it('disposes the viewer when the card goes away', async () => {
    withWebgl();
    const { unmount } = render(<View {...props(MODELS)} />);
    await screen.findByTestId('kui-viewer');
    await act(async () => { unmount(); });
    expect(fake.created.every((v) => v.disposed)).toBe(true);
  });
});
