import { describe, it, expect } from 'vitest';
import { sceneModel } from '../views/scada-scene-logic';
import { addElement, captureAssembly, type Selection } from '../views/scene-edit-logic';
import {
  addToLibrary, baseBox, centerOn, clampViewport, clientToScene, connectFacing, elementAt, facingSides, fitViewport, fromMarquee, hasItem, isTextTarget, keyCommand, loadLibrary, loadRecent,
  ownSizeFromDrag, overlayData, overlayParams, only, panBy, pinch, pixelsPerUnit, pruneSelection, pushRecent, saveLibrary, saveRecent, selectAll, selectionBox, selectionCount,
  sceneToLocal, shapeHandles, sizeFromHandle, thingAt, thingHits, thingIdsOf, toggleItem, viewBoxFor, wheelFactor, withoutThings, withSessionHidden, zoomAt,
  LIBRARY_CAP, MAX_ZOOM, MIN_ZOOM, RECENT_CAP,
} from '../views/scene-editor-state';
import { smallScene } from './scene-edit-fixture';

const scene = smallScene();
const model = sceneModel(scene, {});
const SIZE = { w: 800, h: 500 };
const RECT = { left: 100, top: 50, width: 800, height: 500 };

describe('pointer to scene (no getScreenCTM needed)', () => {
  it('maps a client point through the element rectangle and the view box', () => {
    const vb = { x: 0, y: 0, w: 1000, h: 625 };
    expect(clientToScene({ x: 100, y: 50 }, RECT, vb)).toEqual({ x: 0, y: 0 });
    expect(clientToScene({ x: 500, y: 300 }, RECT, vb)).toEqual({ x: 500, y: 312.5 });
    expect(clientToScene({ x: 900, y: 550 }, RECT, vb)).toEqual({ x: 1000, y: 625 });
  });

  it('follows the viewport: zoomed in and panned', () => {
    const base = baseBox(scene, model);
    const vp = { cx: 300, cy: 200, zoom: 2 };
    const vb = viewBoxFor(vp, base, SIZE);
    // The middle of the element is the centre of the view, whatever the zoom.
    const mid = clientToScene({ x: RECT.left + 400, y: RECT.top + 250 }, RECT, vb);
    expect(mid.x).toBeCloseTo(300, 6);
    expect(mid.y).toBeCloseTo(200, 6);
    // Twice the zoom: half the scene units per pixel.
    expect(vb.w).toBeCloseTo(SIZE.w / pixelsPerUnit(vp, base, SIZE), 6);
    expect(pixelsPerUnit(vp, base, SIZE)).toBeCloseTo(2 * pixelsPerUnit(fitViewport(base), base, SIZE), 6);
  });

  it('is the inverse of sceneToLocal', () => {
    const vb = { x: -40, y: -20, w: 900, h: 560 };
    const p = { x: 123.5, y: 77 };
    const local = sceneToLocal(p, RECT, vb);
    const back = clientToScene({ x: RECT.left + local.x, y: RECT.top + local.y }, RECT, vb);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });

  it('uses a default size for an element that has none yet (jsdom, first paint) instead of dividing by zero', () => {
    const p = clientToScene({ x: 400, y: 250 }, { left: 0, top: 0, width: 0, height: 0 }, { x: 0, y: 0, w: 100, h: 100 });
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(p).toEqual({ x: 50, y: 50 });
  });
});

describe('the viewport', () => {
  const base = baseBox(scene, model);

  it('shows the whole canvas with a margin by default', () => {
    // The scene is 1000 x 600; the fitted view holds all of it and more.
    const vb = viewBoxFor(fitViewport(base), base, SIZE);
    expect(vb.x).toBeLessThanOrEqual(-40 + 1e-9);
    expect(vb.y).toBeLessThanOrEqual(-40 + 1e-9);
    expect(vb.x + vb.w).toBeGreaterThanOrEqual(1040 - 1e-9);
    expect(vb.y + vb.h).toBeGreaterThanOrEqual(640 - 1e-9);
    // The view has the aspect of the element, so nothing is letterboxed.
    expect(vb.w / vb.h).toBeCloseTo(SIZE.w / SIZE.h, 9);
  });

  it('grows the base box for content outside the canvas', () => {
    const far = addElement(scene, 'home.router', { x: 2500, y: 900 }).settings;
    const wide = baseBox(far, sceneModel(far, {}));
    expect(wide.x + wide.w).toBeGreaterThan(2500);
    expect(wide.y + wide.h).toBeGreaterThan(900);
  });

  it('zooms about a point and keeps that point still on screen', () => {
    const vp = fitViewport(base);
    const at = { x: 250, y: 120 };
    const before = sceneToLocal(at, { left: 0, top: 0, ...{ width: SIZE.w, height: SIZE.h } }, viewBoxFor(vp, base, SIZE));
    const zoomed = zoomAt(vp, base, 2, at);
    const after = sceneToLocal(at, { left: 0, top: 0, width: SIZE.w, height: SIZE.h }, viewBoxFor(zoomed, base, SIZE));
    expect(zoomed.zoom).toBe(2);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('clamps the zoom and keeps the diagram reachable', () => {
    const vp = fitViewport(base);
    expect(zoomAt(vp, base, 1e9, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(vp, base, 1e-9, { x: 0, y: 0 }).zoom).toBe(MIN_ZOOM);
    const lost = panBy(vp, base, 1e7, -1e7);
    expect(lost.cx).toBeLessThanOrEqual(base.x + base.w * 1.5);
    expect(lost.cy).toBeGreaterThanOrEqual(base.y - base.h / 2);
    expect(clampViewport({ cx: 0, cy: 0, zoom: 99 }, base).zoom).toBe(MAX_ZOOM);
  });

  it('moves the view to a point (the minimap click)', () => {
    const vp = centerOn(fitViewport(base), base, { x: 400, y: 300 });
    expect(vp.cx).toBe(400);
    expect(vp.cy).toBe(300);
  });

  it('turns a wheel step into a zoom factor: up zooms in, down zooms out, pinch gestures are stronger', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(0)).toBe(1);
    expect(wheelFactor(-50, true)).toBeGreaterThan(wheelFactor(-50, false));
    expect(wheelFactor(-1e9)).toBe(wheelFactor(-200));
  });

  it('reads a two-finger pinch as a zoom and a move of the middle', () => {
    const p = pinch({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 200, y: 0 });
    expect(p.factor).toBe(2);
    expect(p.mid).toEqual({ x: 100, y: 0 });
    expect(p.dx).toBe(50);
    expect(pinch({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 0, y: 0 }, { x: 9, y: 9 }).factor).toBe(1);
  });
});

describe('tool and selection state', () => {
  const none: Selection = { elements: [], shapes: [], links: [] };

  it('selects one item alone and toggles items in and out with shift', () => {
    const a = only({ kind: 'element', id: 'pump1' });
    expect(a).toEqual({ elements: ['pump1'], shapes: [], links: [] });
    const b = toggleItem(a, { kind: 'element', id: 'tank1' });
    expect(b.elements).toEqual(['pump1', 'tank1']);
    expect(toggleItem(b, { kind: 'element', id: 'pump1' }).elements).toEqual(['tank1']);
    expect(toggleItem(b, { kind: 'shape', index: 2 }).shapes).toEqual([2]);
    expect(toggleItem(b, { kind: 'link', index: 1 }).links).toEqual([1]);
    // An input selection is never changed.
    expect(a.elements).toEqual(['pump1']);
    expect(hasItem(b, { kind: 'element', id: 'tank1' })).toBe(true);
    expect(hasItem(b, { kind: 'shape', index: 0 })).toBe(false);
  });

  it('replaces the selection with a marquee result, or adds to it with shift', () => {
    const before = only({ kind: 'element', id: 'valve1' });
    expect(fromMarquee(before, { elements: ['tank1'], shapes: [0] }, false)).toEqual({ elements: ['tank1'], shapes: [0], links: [] });
    const added = fromMarquee(before, { elements: ['tank1', 'valve1'], shapes: [] }, true);
    expect(added.elements).toEqual(['valve1', 'tank1']);
  });

  it('counts, selects all (not what is locked or hidden) and finds the box of a selection', () => {
    expect(selectionCount(none)).toBe(0);
    const all = selectAll(scene, model);
    expect(all.elements).toEqual(['tank1', 'pump1', 'valve1']);
    expect(all.shapes).toEqual([0, 1, 2]);
    expect(selectAll(scene, model, new Set(['pump1'])).elements).toEqual(['tank1', 'valve1']);
    const box = selectionBox({ elements: ['tank1', 'valve1'] }, model, scene);
    const tank = model.hits[0]; const valve = model.hits[2];
    expect(box?.x).toBe(tank.x);
    expect((box?.x ?? 0) + (box?.w ?? 0)).toBe(valve.x + valve.w);
    expect(selectionBox(none, model, scene)).toBeNull();
  });

  it('drops what an undo or a delete removed, and returns the same object when nothing went', () => {
    const sel = { elements: ['pump1', 'ghost'], shapes: [1, 9], links: [0, 7] };
    expect(pruneSelection(sel, scene)).toEqual({ elements: ['pump1'], shapes: [1], links: [0] });
    const ok = { elements: ['pump1'], shapes: [1], links: [0] };
    expect(pruneSelection(ok, scene)).toBe(ok);
  });
});

describe('the keyboard map', () => {
  const canvas = { canvas: true };
  const outside = { canvas: false };
  it('maps the editing keys', () => {
    expect(keyCommand({ key: 'z', ctrlKey: true }, outside)).toEqual({ type: 'undo' });
    expect(keyCommand({ key: 'z', metaKey: true }, outside)).toEqual({ type: 'undo' });
    expect(keyCommand({ key: 'Z', ctrlKey: true, shiftKey: true }, outside)).toEqual({ type: 'redo' });
    expect(keyCommand({ key: 'y', ctrlKey: true }, outside)).toEqual({ type: 'redo' });
    expect(keyCommand({ key: 'c', ctrlKey: true }, outside)).toEqual({ type: 'copy' });
    expect(keyCommand({ key: 'v', metaKey: true }, outside)).toEqual({ type: 'paste' });
    expect(keyCommand({ key: 'd', ctrlKey: true }, outside)).toEqual({ type: 'duplicate' });
    expect(keyCommand({ key: 'Delete' }, canvas)).toEqual({ type: 'delete' });
    expect(keyCommand({ key: 'Backspace' }, canvas)).toEqual({ type: 'delete' });
    expect(keyCommand({ key: 'a' }, canvas)).toEqual({ type: 'selectAll' });
    expect(keyCommand({ key: 'a', ctrlKey: true }, canvas)).toEqual({ type: 'selectAll' });
    expect(keyCommand({ key: 'Escape' }, canvas)).toEqual({ type: 'escape' });
    expect(keyCommand({ key: 'F2' }, canvas)).toEqual({ type: 'rename' });
  });

  it('maps zoom and fit', () => {
    expect(keyCommand({ key: '+' }, canvas)).toEqual({ type: 'zoomIn' });
    expect(keyCommand({ key: '=' }, canvas)).toEqual({ type: 'zoomIn' });
    expect(keyCommand({ key: '-' }, canvas)).toEqual({ type: 'zoomOut' });
    expect(keyCommand({ key: '0' }, canvas)).toEqual({ type: 'fit' });
  });

  it('moves with the arrows: 1 unit, Shift = 10, Alt resizes', () => {
    expect(keyCommand({ key: 'ArrowLeft' }, canvas)).toEqual({ type: 'nudge', dx: -1, dy: 0 });
    expect(keyCommand({ key: 'ArrowDown', shiftKey: true }, canvas)).toEqual({ type: 'nudge', dx: 0, dy: 10 });
    expect(keyCommand({ key: 'ArrowRight', altKey: true }, canvas)).toEqual({ type: 'resize', dx: 10, dy: 0 });
  });

  it('chooses tools by letter inside the canvas', () => {
    expect(keyCommand({ key: 'c' }, canvas)).toEqual({ type: 'tool', tool: 'connect' });
    expect(keyCommand({ key: 'v' }, canvas)).toEqual({ type: 'tool', tool: 'select' });
    expect(keyCommand({ key: 'h' }, canvas)).toEqual({ type: 'tool', tool: 'pan' });
    expect(keyCommand({ key: 'k' }, canvas)).toEqual({ type: 'connectSelected' });
  });

  it('leaves single keys alone outside the canvas, so typing in a panel never edits the diagram', () => {
    for (const key of ['Delete', 'ArrowLeft', 'a', 'c', '+', '0', 'F2']) expect(keyCommand({ key }, outside)).toBeNull();
    expect(keyCommand({ key: 'Escape' }, outside)).toEqual({ type: 'escape' });
    expect(keyCommand({ key: 'q' }, canvas)).toBeNull();
  });

  it('knows which targets take typed text', () => {
    expect(isTextTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTextTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTextTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTextTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTextTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTextTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTextTarget(null)).toBe(false);
  });
});

describe('handles and drags', () => {
  it('offers the resize handles of a zone and a divider, none for a title', () => {
    expect(shapeHandles({ kind: 'zone', x: 10, y: 20, w: 100, h: 60 }).map((h) => [h.handle, h.x, h.y])).toEqual([['se', 110, 80], ['e', 110, 50], ['s', 60, 80]]);
    expect(shapeHandles({ kind: 'divider', x: 0, y: 0, w: 200, h: 0 })).toEqual([{ handle: 'end', x: 200, y: 0 }]);
    expect(shapeHandles({ kind: 'text', x: 0, y: 0, text: 'T' })).toEqual([]);
  });

  it('turns a handle drag into the size it asks for, on the grid or free', () => {
    const zone = { kind: 'zone', x: 40, y: 80, w: 100, h: 60 } as const;
    expect(sizeFromHandle(zone, 'se', { x: 197, y: 163 }, 10)).toEqual({ w: 160, h: 80 });
    expect(sizeFromHandle(zone, 'e', { x: 197.234, y: 0 })).toEqual({ w: 157.23 });
    expect(sizeFromHandle(zone, 's', { x: 0, y: 163 }, 10)).toEqual({ h: 80 });
    expect(sizeFromHandle({ kind: 'divider', x: 0, y: 0, w: 200, h: 0 }, 'end', { x: 305, y: 40 }, 10)).toEqual({ w: 310 });
    expect(sizeFromHandle({ kind: 'divider', x: 0, y: 0, w: 0, h: 120 }, 'end', { x: 40, y: 305 }, 10)).toEqual({ h: 310 });
  });

  it('scales a symbol by how much farther the pointer is from its anchor, within the limits', () => {
    const anchor = { x: 100, y: 100 };
    expect(ownSizeFromDrag(anchor, { x: 150, y: 100 }, 1, { x: 200, y: 100 })).toBe(2);
    expect(ownSizeFromDrag(anchor, { x: 150, y: 100 }, 0.5, { x: 200, y: 100 })).toBe(1);
    expect(ownSizeFromDrag(anchor, { x: 150, y: 100 }, 1, { x: 1000, y: 100 })).toBe(4);
    expect(ownSizeFromDrag(anchor, { x: 150, y: 100 }, 1, { x: 101, y: 100 })).toBe(0.2);
    expect(ownSizeFromDrag(anchor, anchor, 1.5, { x: 300, y: 300 })).toBe(1.5);
  });

  it('chooses the sides that face each other', () => {
    expect(facingSides({ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 0, w: 10, h: 10 })).toEqual({ from: 'r', to: 'l' });
    expect(facingSides({ x: 100, y: 0, w: 10, h: 10 }, { x: 0, y: 5, w: 10, h: 10 })).toEqual({ from: 'l', to: 'r' });
    expect(facingSides({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 100, w: 10, h: 10 })).toEqual({ from: 'b', to: 't' });
    expect(facingSides({ x: 0, y: 100, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toEqual({ from: 't', to: 'b' });
  });

  it('joins two symbols by their facing sides, refusing a join that is already there', () => {
    const r = connectFacing(scene, model, 'tank1', 'valve1', 'hose');
    expect(r.refused).toBeUndefined();
    expect((r.settings.links as unknown[]).at(-1)).toMatchObject({ from: 'tank1.r', to: 'valve1.l', kind: 'hose' });
    expect(connectFacing(scene, model, 'tank1', 'pump1', 'pipe').refused).toMatch(/already joined/);
    expect(connectFacing(scene, model, 'tank1', 'nope', 'pipe').refused).toBeDefined();
  });

  it('finds the symbol under a point (topmost first), ignoring skipped ones, with a pad', () => {
    const pump = model.hits[1];
    const c = { x: pump.x + pump.w / 2, y: pump.y + pump.h / 2 };
    expect(elementAt(model, c)).toBe('pump1');
    expect(elementAt(model, c, new Set(['pump1']))).toBeNull();
    expect(elementAt(model, { x: pump.x + pump.w + 5, y: c.y })).toBeNull();
    expect(elementAt(model, { x: pump.x + pump.w + 5, y: c.y }, new Set(), 8)).toBe('pump1');
  });
});

describe('the what-if overlay', () => {
  const data = { points: { shape: 'table' as const, rows: [{ id: 'pump1', running: false, value: 3 }, { id: 'tank1', value: 40 }] } };

  it('lays what-if rows over the table rows and adds a row that is not there, without changing the real data', () => {
    const frozen = JSON.stringify(data);
    const out = overlayData(data, { rows: { pump1: { running: true }, valve1: { status: 'open' } }, params: {} });
    const rows = out.points?.rows as Array<Record<string, unknown>>;
    expect(rows.find((r) => r.id === 'pump1')).toEqual({ id: 'pump1', running: true, value: 3 });
    expect(rows.find((r) => r.id === 'valve1')).toEqual({ id: 'valve1', status: 'open' });
    expect(rows.find((r) => r.id === 'tank1')).toEqual({ id: 'tank1', value: 40 });
    expect(JSON.stringify(data)).toBe(frozen);
  });

  it('creates the table when there is none, honours another id column, and returns the input when nothing is overridden', () => {
    const created = overlayData({}, { rows: { pump1: { running: true } }, params: {} });
    expect(created.points?.rows).toEqual([{ id: 'pump1', running: true }]);
    const other = overlayData({ points: { shape: 'table', rows: [{ tag: 'p', v: 1 }] } }, { rows: { p: { v: 2 } }, params: {} }, 'tag');
    expect(other.points?.rows).toEqual([{ tag: 'p', v: 2 }]);
    expect(overlayData(data, { rows: {}, params: {} })).toBe(data);
    expect(overlayData(data, { rows: { pump1: {} }, params: {} })).toBe(data);
  });

  it('lays parameter overrides over the board parameters', () => {
    const params = { mode: 'auto', site: 'a' };
    expect(overlayParams(params, { rows: {}, params: { mode: 'manual' } })).toEqual({ mode: 'manual', site: 'a' });
    expect(overlayParams(params, { rows: {}, params: {} })).toBe(params);
  });

  it('adds one hidden rule per session-hidden symbol on the end, within the rules cap', () => {
    const out = withSessionHidden(scene, new Set(['pump1']));
    const rules = out.rules as Array<Record<string, unknown>>;
    expect(rules.at(-1)).toEqual({ target: 'pump1', hidden: true });
    expect(rules).toHaveLength(5);
    expect(withSessionHidden(scene, new Set())).toBe(scene);
    const many = { ...scene, rules: Array.from({ length: 200 }, () => ({ target: '*' })) };
    const capped = withSessionHidden(many, new Set(['a', 'b'])).rules as unknown[];
    expect(capped).toHaveLength(200);
    expect(capped.at(-1)).toEqual({ target: 'b', hidden: true });
  });
});

describe('the local libraries', () => {
  const memory = () => {
    const map = new Map<string, string>();
    return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
  };
  const assembly = captureAssembly(scene, ['tank1', 'pump1'], { name: 'x' }) as NonNullable<ReturnType<typeof captureAssembly>>;

  it('keeps pieces by name, replaces a piece of the same name and caps the list', () => {
    let lib = addToLibrary([], 'Feed', assembly);
    lib = addToLibrary(lib, 'Other', assembly);
    lib = addToLibrary(lib, 'Feed', assembly);
    expect(lib.map((i) => i.name)).toEqual(['Other', 'Feed']);
    expect(addToLibrary(lib, '   ', assembly)).toEqual(lib);
    let full = lib;
    for (let i = 0; i < LIBRARY_CAP + 5; i += 1) full = addToLibrary(full, `p${i}`, assembly);
    expect(full).toHaveLength(LIBRARY_CAP);
    expect(full.at(-1)?.name).toBe(`p${LIBRARY_CAP + 4}`);
  });

  it('saves and loads through storage, and drops entries that are not valid pieces', () => {
    const store = memory();
    const lib = addToLibrary([], 'Feed', assembly);
    expect(saveLibrary(store, 'k', lib)).toBe(true);
    expect(loadLibrary(store, 'k')).toEqual(lib);
    store.map.set('k.library', JSON.stringify([{ name: 'bad', assembly: { format: 'nope' } }, { assembly }, ...lib]));
    expect(loadLibrary(store, 'k')).toEqual(lib);
  });

  it('works without storage and survives storage that throws or holds junk', () => {
    expect(loadLibrary(null, 'k')).toEqual([]);
    expect(saveLibrary(null, 'k', [])).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadLibrary(broken, 'k')).toEqual([]);
    expect(saveLibrary(broken, 'k', [])).toBe(false);
    expect(loadRecent(broken, 'k')).toEqual([]);
    expect(saveRecent(broken, 'k', ['a'])).toBe(false);
    const junk = memory();
    junk.map.set('k.library', '{not json');
    junk.map.set('k.recent', '{"a":1}');
    expect(loadLibrary(junk, 'k')).toEqual([]);
    expect(loadRecent(junk, 'k')).toEqual([]);
  });

  it('keeps the recent symbols newest first, without repeats, capped', () => {
    let list: string[] = [];
    for (const s of ['a', 'b', 'c', 'a']) list = pushRecent(list, s);
    expect(list).toEqual(['a', 'c', 'b']);
    for (let i = 0; i < 20; i += 1) list = pushRecent(list, `s${i}`);
    expect(list).toHaveLength(RECENT_CAP);
    expect(list[0]).toBe('s19');
    const store = memory();
    saveRecent(store, 'k', list);
    expect(loadRecent(store, 'k')).toEqual(list);
  });
});

describe('things from data: a locked layer', () => {
  const things = [{ id: 'cow7', symbol: 'home.tv', x: 700, y: 400 }, { id: 'cow8', symbol: 'home.tv', x: 850, y: 400 }];
  const full = sceneModel(scene, { things: { shape: 'table', rows: things } });

  it('the editing model leaves the things out; the things layer is just them', () => {
    expect(full.hits.map((h) => h.id)).toEqual(['tank1', 'pump1', 'valve1', 'cow7', 'cow8']);
    expect(withoutThings(full).hits.map((h) => h.id)).toEqual(['tank1', 'pump1', 'valve1']);
    expect(thingHits(full).map((h) => h.id)).toEqual(['cow7', 'cow8']);
    // a model without things comes back as it was
    expect(withoutThings(model)).toBe(model);
  });
  it('a thing is never selected by select-all or found by a click as a symbol, but a click finds it as a thing', () => {
    const editing = withoutThings(full);
    expect(selectAll(scene, editing).elements).toEqual(['tank1', 'pump1', 'valve1']);
    const cow = thingHits(full)[0];
    const centre = { x: cow.x + cow.w / 2, y: cow.y + cow.h / 2 };
    expect(elementAt(editing, centre)).toBeNull();
    expect(thingAt(full, centre)).toBe('cow7');
    expect(thingAt(full, { x: -500, y: -500 })).toBeNull();
  });
  it('lists the things table\'s ids under the scene\'s id column, without repeats or unusable ones', () => {
    const data = { things: { shape: 'table' as const, rows: [{ tag: 'A' }, { tag: 'B' }, { tag: 'A' }, { tag: '' }, { tag: 7 }, {}] } };
    expect(thingIdsOf(data, { thingsIdColumn: 'tag' })).toEqual(['A', 'B', '7']);
    expect(thingIdsOf({}, {})).toEqual([]);
  });
  it('the what-if overlay adds the sample things after the table\'s rows, without changing the data', () => {
    const data = { things: { shape: 'table' as const, rows: [{ id: 'cow7', x: 1, y: 1 }] } };
    const out = overlayData(data, { rows: {}, params: {}, things: [{ id: 'sample1', x: 5, y: 5 }] });
    expect(out.things?.rows?.map((r) => r.id)).toEqual(['cow7', 'sample1']);
    expect(data.things.rows).toHaveLength(1);
    expect(overlayData({}, { rows: {}, params: {}, things: [{ id: 'sample1' }] }).things).toEqual({ shape: 'table', rows: [{ id: 'sample1' }] });
    // nothing to lay over: the same object
    expect(overlayData(data, { rows: {}, params: {}, things: [] })).toBe(data);
  });
});
