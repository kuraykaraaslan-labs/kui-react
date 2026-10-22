import { describe, it, expect } from 'vitest';
import { SCADA_SYMBOLS } from '../views/scada-logic';
import { MAX_SCENE_ELEMENTS, MAX_SCENE_LINKS, MAX_SCENE_SHAPES, parsePort, sceneModel, type SceneSettings } from '../views/scada-scene-logic';
import {
  addElement, addLink, addShape, align, apply, captureAssembly, createHistory, deleteElements, deleteLink, deleteSelection, deleteShapes, distribute,
  duplicate, insertAssembly, isFormKey, mirrorElements, moveSelection, problems, reconnectLink, redo, renameElement, reorder, resizeShape, setCanvas,
  setElementProps, setLinkKind, setMid, setOwnSize, setShapeProps, turnElements, undo, type EditResult, type History, type Rec,
} from '../views/scene-edit-logic';
import { SCADA_SCENE } from '../templates/scada-scene';
import { HOME_SCENE } from '../sample/scada-home';
import { clone, deepFreeze, smallScene } from './scene-edit-fixture';

// ─── A seeded generator, so a failure names its seed ─────────────────────────

function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T,>(list: readonly T[]): T => list[int(list.length)];
  return { next, int, pick, chance: (p: number) => next() < p };
}
type Rng = ReturnType<typeof prng>;

const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const templateRule = SCADA_SCENE.rules![0] as (v: unknown) => Array<{ path: string; message: string }>;

/** The invariants every scene must hold after every edit. */
function check(s: SceneSettings, where: string) {
  const elements = arr(s.elements); const links = arr(s.links); const shapes = arr(s.shapes);
  const ids = elements.map((e) => e.id as string);
  expect(new Set(ids).size, `${where}: ids unique`).toBe(ids.length);
  for (const e of elements) {
    expect(isFormKey(e.id), `${where}: id ${String(e.id)}`).toBe(true);
    expect(SCADA_SYMBOLS).toContain(e.symbol);
    expect(Number.isFinite(e.x as number) && Number.isFinite(e.y as number), `${where}: finite position`).toBe(true);
  }
  const known = new Set(ids);
  for (const l of links) {
    for (const end of ['from', 'to'] as const) {
      const p = parsePort(l[end]);
      expect(p && known.has(p.id), `${where}: ${String(l[end])} dangles`).toBeTruthy();
    }
  }
  const linkIds = new Set(links.map((l) => l.id).filter((v) => typeof v === 'string' && v));
  for (const r of arr((s as { rules?: unknown }).rules)) {
    for (const k of ['target', 'of', 'of2'] as const) {
      const v = r[k];
      if (v === undefined || v === '' || v === '*') continue;
      expect(known.has(v as string) || linkIds.has(v), `${where}: rule ${k} ${String(v)} dangles`).toBe(true);
    }
  }
  expect(elements.length).toBeLessThanOrEqual(MAX_SCENE_ELEMENTS);
  expect(links.length).toBeLessThanOrEqual(MAX_SCENE_LINKS);
  expect(shapes.length).toBeLessThanOrEqual(MAX_SCENE_SHAPES);
  for (const h of shapes) expect(Number.isFinite(h.x as number) && Number.isFinite(h.y as number)).toBe(true);
  expect(templateRule(s), `${where}: template rules`).toEqual([]);
  expect(problems(s).filter((p) => p.severity === 'error' && p.code !== 'over-cap' && p.code !== 'near-cap'), `${where}: problems`).toEqual([]);
}

// ─── Random operations over the current state ────────────────────────────────

type Op = { name: string; run: (s: SceneSettings) => EditResult };

function randomPort(r: Rng, ids: string[]) {
  return { id: r.pick(ids), side: r.pick(['l', 'r', 't', 'b'] as const), at: r.chance(0.6) ? 0.5 : Math.round(r.next() * 100) / 100 };
}

function randomOp(r: Rng, s: SceneSettings): Op {
  const elements = arr(s.elements); const ids = elements.map((e) => e.id as string);
  const some = (n = 3) => Array.from({ length: Math.min(ids.length, 1 + r.int(n)) }, () => r.pick(ids));
  const shapeIdx = () => (arr(s.shapes).length ? r.int(arr(s.shapes).length + 1) : 0);
  const anyPos = () => ({ x: r.int(1400) - 100, y: r.int(900) - 100 });
  const model = () => sceneModel(s, {});
  const names = ['pump9', 'a', 'new_id', 'x.y', '9bad', 'has space', '', ...(ids.length ? [r.pick(ids)] : [])];
  const table: Array<[string, () => Op['run']]> = [
    ['addElement', () => { const sym = r.pick(SCADA_SYMBOLS); const at = anyPos(); return (x) => addElement(x, sym, at); }],
    ['moveSelection', () => { const sel = { elements: some(), shapes: [shapeIdx()] }; const dx = r.int(81) - 40; const dy = r.int(81) - 40; return (x) => moveSelection(x, sel, dx, dy); }],
    ['setElementProps', () => { const sel = some(); const patch = r.pick<Rec>([{ label: 'L' }, { labelPos: 't' }, { medium: 'hot' }, { scale: 1.5 }, { scale: 99 }, { turn: 90 }, { min: 0, max: 50 }, { label: undefined }, { fillColor: '#fff' }, { symbol: r.pick(SCADA_SYMBOLS) }]); return (x) => setElementProps(x, sel, patch); }],
    ['setOwnSize', () => { const sel = some(); const v = r.pick([null, 0.5, 2, 9]); return (x) => setOwnSize(x, sel, v); }],
    ['turn', () => { const sel = some(); const by = r.pick([90, 180, 270, -90] as const); return (x) => turnElements(x, sel, by); }],
    ['mirror', () => { const sel = some(); return (x) => mirrorElements(x, sel); }],
    ['deleteElements', () => { const sel = some(2); return (x) => deleteElements(x, sel); }],
    ['renameElement', () => { const from = ids.length ? r.pick(ids) : 'x'; const to = r.pick(names); return (x) => renameElement(x, from, to); }],
    ['addLink', () => { const a = ids.length ? randomPort(r, ids) : 'x.l'; const b = ids.length ? randomPort(r, ids) : 'y.l'; const kind = r.pick(['pipe', 'hose', 'cable', 'wire', 'strip', 'line', 'sld', 'rope']); return (x) => addLink(x, a, b, kind); }],
    ['deleteLink', () => { const i = r.int(arr(s.links).length + 1); return (x) => deleteLink(x, i); }],
    ['setLinkKind', () => { const i = r.int(arr(s.links).length + 1); const k = r.pick(['pipe', 'cable', 'bogus']); return (x) => setLinkKind(x, i, k); }],
    ['setMid', () => { const i = r.int(arr(s.links).length + 1); const v = r.pick([null, 123.456, Number.NaN]); return (x) => setMid(x, i, v); }],
    ['reconnectLink', () => { const i = r.int(arr(s.links).length + 1); const end = r.pick(['from', 'to'] as const); const p = ids.length ? randomPort(r, ids) : 'x.l'; return (x) => reconnectLink(x, i, end, p); }],
    ['addShape', () => { const kind = r.pick(['text', 'zone', 'divider'] as const); const at = anyPos(); return (x) => addShape(x, kind, at); }],
    ['resizeShape', () => { const i = shapeIdx(); const size = r.pick([{ w: 300 }, { h: 90 }, { w: 5, h: 5 }, { w: -4 }]); return (x) => resizeShape(x, i, size); }],
    ['setShapeProps', () => { const i = shapeIdx(); const patch = r.pick<Rec>([{ text: 'Hall' }, { tone: 'info' }, { tone: 'bad' }, { dashed: false }]); return (x) => setShapeProps(x, i, patch); }],
    ['deleteShapes', () => { const i = shapeIdx(); return (x) => deleteShapes(x, [i]); }],
    ['deleteSelection', () => { const sel = { elements: some(2), shapes: [shapeIdx()], links: [r.int(arr(s.links).length + 1)] }; return (x) => deleteSelection(x, sel); }],
    ['align', () => { const sel = { elements: some(4), shapes: [shapeIdx()] }; const mode = r.pick(['left', 'center', 'right', 'top', 'middle', 'bottom'] as const); return (x) => align(x, model(), sel, mode); }],
    ['distribute', () => { const sel = { elements: some(5) }; const axis = r.pick(['horizontal', 'vertical'] as const); return (x) => distribute(x, model(), sel, axis); }],
    ['duplicate', () => { const sel = { elements: some(4), shapes: [shapeIdx()] }; return (x) => duplicate(x, sel); }],
    ['reorder', () => { const sel = { elements: some(), shapes: [shapeIdx()] }; const mode = r.pick(['front', 'back', 'forward', 'backward'] as const); return (x) => reorder(x, sel, mode); }],
    ['setCanvas', () => { const p = r.pick([{ width: 1500 }, { scale: 0.9 }, { anchor: 'corner' as const }, { anchor: 'center' as const }, { height: 100 }]); return (x) => setCanvas(x, p, model()); }],
    ['insertAssembly', () => { const piece = ids.length ? captureAssembly(s, some(4)) : null; const at = anyPos(); return (x) => (piece ? insertAssembly(x, piece, at) : addElement(x, 'home.tv', at)); }],
  ];
  const [name, make] = r.pick(table);
  return { name, run: make() };
}

// ─── Starting scenes ─────────────────────────────────────────────────────────

function nearCap(): SceneSettings {
  return deepFreeze({
    width: 1400, height: 900,
    elements: Array.from({ length: MAX_SCENE_ELEMENTS - 2 }, (_, i) => ({ id: `n${i}`, symbol: SCADA_SYMBOLS[i % SCADA_SYMBOLS.length], x: 40 + (i % 20) * 60, y: 40 + Math.floor(i / 20) * 70 })),
    links: Array.from({ length: MAX_SCENE_LINKS - 2 }, (_, i) => ({ from: `n${i % 190}.r:0.${(i % 9) + 1}`, to: `n${(i % 190) + 1}.l`, kind: 'pipe' })),
    shapes: Array.from({ length: MAX_SCENE_SHAPES - 2 }, (_, i) => ({ kind: 'text', x: 10 + i, y: 10, text: `t${i}` })),
    rules: [{ target: 'n3', of: 'n4', of2: '', key: 'v' }, { target: '*', of: '' }],
  } as SceneSettings);
}

function withRules(s: SceneSettings): SceneSettings {
  const ids = arr(s.elements).map((e) => e.id as string);
  const rules = ids.slice(0, 6).map((id, i) => ({ target: id, of: i % 2 ? ids[(i + 1) % ids.length] : '', of2: i % 3 === 0 ? ids[(i + 2) % ids.length] : '', key: 'running', key2: 'value' }));
  return deepFreeze({ ...clone(s), rules: [...rules, { target: '*', of: '', key: 'status' }] }) as SceneSettings;
}

const STARTS: Array<[string, () => SceneSettings]> = [
  ['small', smallScene],
  ['empty', () => deepFreeze({ width: 800, height: 500 } as SceneSettings)],
  ['near caps', nearCap],
  [HOME_SCENE.title, () => withRules(HOME_SCENE.settings as SceneSettings)],
];

describe('random edit sequences hold the invariants', () => {
  it('starts from scenes that already hold them', () => {
    for (const [name, make] of STARTS) check(make(), name);
  });

  it.each(STARTS.map(([n, m]) => [n, m] as const))('random sequences from %s', (_name, make) => {
    const perScene = _name === 'near caps' ? 30 : 40;
    const sequences = _name === 'near caps' ? 10 : 40;
    const counts: Record<string, number> = {};
    let refusedTotal = 0;
    for (let seq = 0; seq < sequences; seq += 1) {
      const seed = 1000 + seq * 7919 + _name.length;
      const r = prng(seed);
      let h: History = createHistory(make());
      let refusedCount = 0;
      for (let step = 0; step < perScene; step += 1) {
        const where = `${_name} seed ${seed} step ${step}`;
        const pre = h.present;
        const snapshot = JSON.stringify(pre);
        if (r.chance(0.12) && (h.past.length || h.future.length)) {
          h = r.chance(0.5) ? undo(h) : redo(h);
          check(h.present, `${where} (undo or redo)`);
          continue;
        }
        const op = randomOp(r, pre);
        counts[op.name] = (counts[op.name] ?? 0) + 1;
        const { history, result } = apply(h, op.run);
        expect(JSON.stringify(pre), `${where} ${op.name}: input unchanged`).toBe(snapshot);
        if (result.refused) {
          refusedCount += 1;
          expect(result.settings, `${where} ${op.name}: a refusal returns its input`).toBe(pre);
          expect(history).toBe(h);
          continue;
        }
        deepFreeze(history.present);
        check(history.present, `${where} ${op.name}`);
        if (history.present !== pre) {
          const back = undo(history);
          expect(back.present, `${where} ${op.name}: undo`).toBe(pre);
          expect(JSON.stringify(back.present)).toBe(snapshot);
          expect(redo(back).present, `${where} ${op.name}: redo`).toBe(history.present);
        }
        h = history;
      }
      expect(refusedCount).toBeLessThan(perScene);
      refusedTotal += refusedCount;
    }
    // The generator really reaches the operations it claims to.
    expect(Object.keys(counts).length).toBeGreaterThan(10);
    // And it does hit refusals (bad ids, twins, caps), which must leave the scene alone.
    expect(refusedTotal).toBeGreaterThan(0);
  }, 60_000);
});

describe('the sample scene opens and comes back unchanged', () => {
  const all = [HOME_SCENE];
  describe.each(all.map((x) => [x.title, x] as const))('%s', (_t, scene) => {
    const settings = deepFreeze(clone(scene.settings)) as SceneSettings;
    const json = JSON.stringify(settings);

    it('passes the scene template and has no problem the editor calls an error', () => {
      check(settings, scene.title);
    });
    it('is the same after adding a symbol and undoing it', () => {
      const h = apply(createHistory(settings), (s) => addElement(s, 'home.router', { x: 10, y: 10 })).history;
      expect(arr(h.present.elements)).toHaveLength(arr(settings.elements).length + 1);
      const back = undo(h).present;
      expect(back).toBe(settings);
      expect(JSON.stringify(back)).toBe(json);
    });
    it('is the same after renaming every symbol and renaming it back', () => {
      for (const e of arr(settings.elements)) {
        const id = e.id as string;
        const there = renameElement(settings, id, 'renamed_x');
        expect(there.refused, id).toBeUndefined();
        check(there.settings, `${scene.title} ${id}`);
        const back = renameElement(there.settings, 'renamed_x', id);
        expect(back.settings, id).toEqual(settings);
        expect(JSON.stringify(back.settings), id).toBe(json);
      }
    });
    it('is the same after a move and the opposite move, and after edits that change nothing', () => {
      const ids = arr(settings.elements).map((e) => e.id as string);
      const there = apply(createHistory(settings), (s) => moveSelection(s, { elements: ids, shapes: arr(settings.shapes).map((_, i) => i) }, 30, -20)).history;
      const back = moveSelection(there.present, { elements: ids, shapes: arr(settings.shapes).map((_, i) => i) }, -30, 20).settings;
      expect(back).toEqual(settings);
      expect(setElementProps(settings, ids[0], {}).settings).toBe(settings);
      expect(setCanvas(settings, {}).settings).toBe(settings);
    });
    it('is carried whole by an assembly of everything, which draws the same picture elsewhere', () => {
      const ids = arr(settings.elements).map((e) => e.id as string);
      const piece = captureAssembly(settings, { elements: ids, shapes: arr(settings.shapes).map((_, i) => i) })!;
      expect(piece).not.toBeNull();
      // Nothing the sample sets on a symbol may be lost on the way.
      arr(settings.elements).forEach((e, i) => {
        for (const k of Object.keys(e)) expect(piece.elements[i], `${e.id}.${k}`).toHaveProperty(k);
      });
      expect(piece.links).toHaveLength(arr(settings.links).length);
      const into = insertAssembly({ width: settings.width, height: settings.height, scale: settings.scale, anchor: settings.anchor }, piece, { x: 0, y: 0 });
      expect(into.refused).toBeUndefined();
      expect(templateRule(into.settings)).toEqual([]);
      const a = sceneModel(settings, {}).hits; const b = sceneModel(into.settings, {}).hits;
      expect(b.map((h) => h.id)).toEqual(a.map((h) => h.id));
      const dx = b[0].x - a[0].x; const dy = b[0].y - a[0].y;
      for (let i = 0; i < a.length; i += 1) {
        expect(b[i].x - a[i].x).toBeCloseTo(dx, 1);
        expect(b[i].y - a[i].y).toBeCloseTo(dy, 1);
        expect(b[i].w).toBe(a[i].w);
      }
    });
  });
});
