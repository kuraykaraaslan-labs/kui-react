import { describe, it, expect } from 'vitest';
import { MAX_SCENE_THINGS, sceneModel, sceneThings, thingTurn, type SceneSettings } from '../views/scada-scene-logic';
import { MAX_PATCH_COORD, parseScenePatch, type ScenePatch } from '../views/scene-patch';
import { svgToString } from '../views/svg-node';

type Row = Record<string, unknown>;

const scene = (over: Partial<SceneSettings> = {}): SceneSettings => ({
  fit: 'canvas', width: 800, height: 400, scale: 0.6,
  elements: [{ id: 'pump', symbol: 'home.router', x: 100, y: 100, label: 'Pump' }],
  ...over,
});
const draw = (s: SceneSettings, things?: Row[], o: Parameters<typeof sceneModel>[2] = {}, points: Row[] = []) =>
  sceneModel(s, { points: { shape: 'table', rows: points }, ...(things ? { things: { shape: 'table', rows: things } } : {}) }, o);
const markup = (m: ReturnType<typeof sceneModel>) => m.nodes.map(svgToString).join('');
const hit = (m: ReturnType<typeof sceneModel>, id: string) => m.hits.find((h) => h.id === id);
const patchOf = (raw: unknown): ScenePatch => parseScenePatch(raw).patch as ScenePatch;

describe('things from rows', () => {
  it('a scene with no things table, or an empty one, draws exactly as before', () => {
    const before = markup(draw(scene()));
    expect(markup(draw(scene(), []))).toBe(before);
    expect(draw(scene(), []).problems).toBe(0);
  });
  it('places one symbol per row, drawn and boxed like an authored symbol at the same place, marked as from things', () => {
    const m = draw(scene({ elements: [{ id: 'pump', symbol: 'home.tv', x: 100, y: 100 }] }), [{ id: 'cow7', symbol: 'home.tv', x: 100, y: 300 }]);
    const a = hit(m, 'pump')!; const t = hit(m, 'cow7')!;
    expect(t).toMatchObject({ from: 'things', w: a.w, h: a.h, x: a.x, locked: false });
    expect(t.y - a.y).toBe(200);
    expect(a.from).toBeUndefined();
    expect(m.thingIds).toEqual(['cow7']);
    expect(markup(m)).toContain('data-from="things"');
    expect(m.empty).toBe(false);
  });
  it('a things-only scene is not empty', () => {
    expect(draw(scene({ elements: [] }), [{ id: 't', symbol: 'home.tv', x: 1, y: 1 }]).empty).toBe(false);
  });
  it('reads its columns from the settings, and one fixed symbol wins over the symbol column', () => {
    const s = scene({ thingsIdColumn: 'tag', thingsSymbolColumn: 'kind', thingsXColumn: 'px', thingsYColumn: 'py', thingsLabelColumn: 'name' });
    const m = draw(s, [{ tag: 'A1', kind: 'home.tv', px: 300, py: 200, name: 'Badge A1' }]);
    expect(hit(m, 'A1')).toMatchObject({ name: 'Badge A1', from: 'things' });
    const fixed = draw({ ...s, thingsSymbol: 'home.plug.smart' }, [{ tag: 'A1', kind: 'home.tv', px: 300, py: 200 }]);
    expect(markup(fixed)).not.toBe(markup(m));
    expect(sceneThings({ ...s, thingsSymbol: 'home.plug.smart' }, [{ tag: 'A1', kind: 'home.tv', px: 1, py: 2 }], new Set()).things[0].e.symbol).toBe('home.plug.smart');
  });
  it('maps metres onto the canvas from the origin at the scale', () => {
    const { things } = sceneThings(scene({ thingsUnits: 'metres', thingsScale: 50, thingsOriginX: 100, thingsOriginY: 40 }), [{ id: 'a', x: 2, y: 3 }], new Set());
    expect(things[0].e).toMatchObject({ x: 200, y: 190 });
    // no scale: 50 units per metre
    expect(sceneThings(scene({ thingsUnits: 'metres' }), [{ id: 'a', x: 1, y: '1.5' }], new Set()).things[0].e).toMatchObject({ x: 50, y: 75 });
  });
  it('snaps a turn to the nearest quarter', () => {
    expect([0, 44, 46, 90, '180', 269, 359, -90, 450, 'nope', undefined].map(thingTurn)).toEqual([0, 0, 90, 90, 180, 270, 0, 270, 90, 0, 0]);
  });
  it('skips a row without an id or a place, one whose id a symbol has, and a repeated id: each is a problem', () => {
    const m = draw(scene(), [
      { id: 'pump', symbol: 'home.tv', x: 1, y: 1 }, { symbol: 'home.tv', x: 1, y: 1 }, { id: 'a', symbol: 'home.tv', y: 1 },
      { id: 'b', symbol: 'home.tv', x: 'left', y: 1 }, { id: 'c', symbol: 'home.tv', x: 5, y: 5 }, { id: 'c', symbol: 'home.tv', x: 9, y: 9 },
    ]);
    expect(m.thingIds).toEqual(['c']);
    expect(m.problems).toBe(5);
    // the authored symbol keeps its own place and box
    expect(hit(m, 'pump')?.from).toBeUndefined();
  });
  it(`draws at most ${MAX_SCENE_THINGS} things and counts the rest as one problem, never a blank`, () => {
    const rows = Array.from({ length: MAX_SCENE_THINGS + 7 }, (_, i) => ({ id: `t${i}`, symbol: 'home.tv', x: i, y: 10 }));
    const m = draw(scene({ elements: [] }), rows);
    expect(m.thingIds).toHaveLength(MAX_SCENE_THINGS);
    expect(m.problems).toBe(1);
  });
  it('a symbol key the diagram cannot draw shows the placeholder (still boxed and clickable)', () => {
    const m = draw(scene(), [{ id: 'x', symbol: 'locked.pack.pump', x: 300, y: 100 }, { id: 'y', x: 500, y: 100 }]);
    expect(hit(m, 'x')).toMatchObject({ from: 'things' });
    expect(hit(m, 'y')).toMatchObject({ from: 'things' });
    expect(markup(m)).toContain('>?<');
    expect(m.problems).toBe(0);
  });
  it('draws its own row\'s state columns', () => {
    const idle = markup(draw(scene(), [{ id: 'r', symbol: 'home.router', x: 300, y: 100 }]));
    const on = markup(draw(scene(), [{ id: 'r', symbol: 'home.router', x: 300, y: 100, running: true }]));
    const warn = markup(draw(scene(), [{ id: 'r', symbol: 'home.router', x: 300, y: 100, status: 'warning' }]));
    expect(on).not.toBe(idle);
    expect(warn).not.toBe(idle);
  });
  it('skips a row whose place lies off every canvas (an overflow in metres included), so one far-off row never stretches the view', () => {
    // 1e308 m at 50 units per metre is Infinity: never a view box of Infinity or NaN
    const metres = sceneThings(scene({ thingsUnits: 'metres', thingsScale: 50 }), [{ id: 'a', x: 1e308, y: 0 }, { id: 'b', x: 2, y: 1 }], new Set());
    expect(metres.things.map((t) => t.e.id)).toEqual(['b']);
    expect(metres.problems).toBe(1);
    // a huge origin is held to the same bound; a place on the bound is still a place
    expect(sceneThings(scene({ thingsUnits: 'metres', thingsOriginX: 1e12 }), [{ id: 'a', x: 0, y: 0 }], new Set()).things[0].e.x).toBe(MAX_PATCH_COORD);
    expect(sceneThings(scene(), [{ id: 'a', x: -MAX_PATCH_COORD, y: MAX_PATCH_COORD }, { id: 'b', x: MAX_PATCH_COORD + 1, y: 0 }], new Set()).things.map((t) => t.e.id)).toEqual(['a']);
    // with fit 'content', a far-off row does not shrink the authored symbols
    const content = scene({ fit: 'content' });
    const near = draw(content, [{ id: 'cow7', symbol: 'home.tv', x: 300, y: 100 }]);
    const far = draw(content, [{ id: 'cow7', symbol: 'home.tv', x: 300, y: 100 }, { id: 'stray', symbol: 'home.tv', x: 1e9, y: 0 }]);
    expect(far.viewBox).toBe(near.viewBox);
    expect(far.viewBox).not.toMatch(/Infinity|NaN/);
    expect(far.problems).toBe(near.problems + 1);
    // a patch's things are held to the same bound
    expect(draw(content, [], { patch: patchOf({ things: [{ id: 'p', symbol: 'home.tv', x: 1e300, y: 1 }] }) }).thingIds).toEqual([]);
  });
  it('a connection may end on a thing by its id; without the thing it is a problem', () => {
    const s = scene({ links: [{ from: 'pump.r', to: 'cow7.l', kind: 'pipe' }] });
    expect(draw(s, [{ id: 'cow7', symbol: 'home.tv', x: 400, y: 100 }]).problems).toBe(0);
    expect(draw(s, []).problems).toBe(1);
  });
});

describe('the new rule effects in the model', () => {
  const s = (rules: unknown[]) => scene({ elements: [{ id: 'pump', symbol: 'home.tv', x: 100, y: 100 }], rules });
  it('dx and dy move the box (and what joins it), scale resizes it, turn turns it', () => {
    const base = hit(draw(s([])), 'pump')!;
    expect(hit(draw(s([{ target: 'pump', dx: 30, dy: -10 }])), 'pump')).toMatchObject({ x: base.x + 30, y: base.y - 10, w: base.w });
    const big = hit(draw(s([{ target: 'pump', scale: 2 }])), 'pump')!;
    expect(big.w).toBeCloseTo(base.w * 2, 1);
    expect(markup(draw(s([{ target: 'pump', turn: '90' }])))).not.toBe(markup(draw(s([]))));
  });
  it('symbol draws another symbol in its place; a key it cannot draw shows the placeholder', () => {
    const swapped = draw(s([{ target: 'pump', symbol: 'home.router' }]));
    expect(markup(swapped)).toBe(markup(draw(scene({ elements: [{ id: 'pump', symbol: 'home.router', x: 100, y: 100 }] }))));
    expect(markup(draw(s([{ target: 'pump', symbol: 'no.such.symbol' }])))).toContain('>?<');
  });
  it('things:* rules every thing and no authored symbol; a thing reads its own row', () => {
    const rules = [{ target: 'things:*', key: 'value', op: 'gt', value: '39', hidden: 'true' }];
    const m = draw(s(rules), [{ id: 'cow7', symbol: 'home.tv', x: 300, y: 100, value: 40 }, { id: 'cow8', symbol: 'home.tv', x: 500, y: 100, value: 38 }]);
    expect(m.hits.map((h) => h.id)).toEqual(['pump', 'cow8']);
    // a hidden thing keeps its id among the placed ones (a connection still joins it)
    expect(m.thingIds).toEqual(['cow7', 'cow8']);
  });
});

describe('the scene patch in the model (applied last)', () => {
  const things = [{ id: 'cow7', symbol: 'home.tv', x: 300, y: 100 }];
  it('no patch, or an empty one, changes nothing', () => {
    const before = markup(draw(scene(), things));
    expect(markup(draw(scene(), things, { patch: null }))).toBe(before);
    expect(markup(draw(scene(), things, { patch: {} }))).toBe(before);
  });
  it('its things replace the table\'s rows: added, moved and removed', () => {
    const m = draw(scene(), things, { patch: patchOf({ things: [{ id: 'cow9', symbol: 'home.tv', x: 600, y: 300 }] }) });
    expect(m.thingIds).toEqual(['cow9']);
    expect(draw(scene(), things, { patch: patchOf({ things: [] }) }).thingIds).toEqual([]);
  });
  it('its objects win over a rule for the same effect, and its value replaces the reading', () => {
    const ruled = scene({ rules: [{ target: 'pump', hidden: 'true' }] });
    expect(hit(draw(ruled), 'pump')).toBeUndefined();
    expect(hit(draw(ruled, [], { patch: patchOf({ objects: { pump: { hidden: false, label: 'From script' } } }) }), 'pump')?.name).toBe('From script');
    const tv = scene({ elements: [{ id: 'tv', symbol: 'home.tv', x: 100, y: 100 }] });
    const shown = markup(draw(tv, [], { patch: patchOf({ objects: { tv: { value: 87 } } }) }, [{ id: 'tv', value: 12 }]));
    expect(shown).toContain('87');
    expect(shown).not.toContain('>12<');
  });
  it('its objects reach things too, and move them', () => {
    const before = hit(draw(scene(), things), 'cow7')!;
    const after = hit(draw(scene(), things, { patch: patchOf({ objects: { cow7: { dx: 50 } } }) }), 'cow7')!;
    expect(after.x).toBe(before.x + 50);
  });
  it('its links and shapes add to the authored ones', () => {
    const m = draw(scene(), things, { patch: patchOf({ links: [{ from: 'pump.r', to: 'cow7.l', kind: 'cable' }], shapes: [{ kind: 'text', x: 400, y: 30, text: 'Room B: 1 cow' }] }) });
    expect(m.problems).toBe(0);
    expect(markup(m)).toContain('Room B: 1 cow');
    expect(markup(m).length).toBeGreaterThan(markup(draw(scene(), things)).length);
  });
  it('its view sets what to fit: the canvas, the content, or a region', () => {
    const content = scene({ fit: 'content' });
    expect(draw(content, things, { patch: patchOf({ view: 'canvas' }) }).viewBox).toBe('0 0 800 400');
    expect(draw(scene(), things, { patch: patchOf({ view: 'content' }) }).viewBox).not.toBe('0 0 800 400');
    expect(draw(scene(), things, { patch: patchOf({ view: { x0: 50, y0: 60, x1: 450, y1: 260 } }) }).viewBox).toBe('50 60 400 200');
    // a 3D view means nothing to a diagram
    expect(draw(scene(), things, { patch: patchOf({ view: { preset: 'top' } }) }).viewBox).toBe('0 0 800 400');
  });
  it('a lockout is one-way: a patch or a rule may impose one, never lift the row\'s', () => {
    const lotoRow = [{ id: 'pump', mode: 'lockout' }];
    expect(hit(draw(scene(), [], {}, lotoRow), 'pump')?.locked).toBe(true);
    const lifted = draw(scene(), [], { patch: patchOf({ objects: { pump: { mode: 'auto' } } }) }, lotoRow);
    expect(hit(lifted, 'pump')?.locked).toBe(true);
    // the padlock stays drawn: the same picture as without the patch
    expect(markup(lifted)).toBe(markup(draw(scene(), [], {}, lotoRow)));
    expect(hit(draw(scene({ rules: [{ target: 'pump', mode: 'manual' }] }), [], {}, lotoRow), 'pump')?.locked).toBe(true);
    // imposing one works, on a symbol and on a thing
    expect(hit(draw(scene(), [], { patch: patchOf({ objects: { pump: { mode: 'lockout' } } }) }), 'pump')?.locked).toBe(true);
    expect(hit(draw(scene(), things, { patch: patchOf({ objects: { cow7: { mode: 'lockout' } } }) }), 'cow7')?.locked).toBe(true);
    // a thing whose own row is locked out stays locked under a patch too
    expect(hit(draw(scene(), [{ ...things[0], mode: 'lockout' }], { patch: patchOf({ objects: { cow7: { mode: 'auto' } } }) }), 'cow7')?.locked).toBe(true);
    // another mode over an unlocked row is applied as before
    expect(hit(draw(scene(), [], { patch: patchOf({ objects: { pump: { mode: 'manual' } } }) }, [{ id: 'pump', mode: 'auto' }]), 'pump')?.locked).toBe(false);
  });
  it('its problems join the count and are listed', () => {
    const m = draw(scene(), things, { patch: patchOf({ problems: ['Feed lost', 'Two tags unread'] }) });
    expect(m.problems).toBe(2);
    expect(m.patchProblems).toEqual(['Feed lost', 'Two tags unread']);
  });
});
