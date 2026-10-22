import { describe, it, expect } from 'vitest';
import { sceneModel, MAX_SCENE_ELEMENTS, type SceneSettings } from '../views/scada-scene-logic';
import {
  ASSEMBLY_FORMAT, captureAssembly, cleanAssembly, insertAssembly, MAX_CLIPBOARD_CHARS, parseClipboard, problems, serialize, type Assembly, type Rec,
} from '../views/scene-edit-logic';
import { clone, deepFreeze, smallScene } from './scene-edit-fixture';

const els = (s: SceneSettings) => s.elements as Rec[];
const links = (s: SceneSettings) => s.links as Rec[];

describe('captureAssembly', () => {
  const a = captureAssembly(smallScene(), { elements: ['tank1', 'pump1'], shapes: [2] }, { name: 'Feed' })!;
  it('keeps the symbols, the shapes and only the links among them, relative to the middle of the piece', () => {
    expect(a).toMatchObject({ format: ASSEMBLY_FORMAT, version: 1, name: 'Feed', anchor: 'center' });
    expect(a.elements.map((e) => e.id)).toEqual(['tank1', 'pump1']);
    expect(a.links).toEqual([{ from: 'tank1.r', to: 'pump1.l', kind: 'pipe' }]);
    // symbols at x 100 and 300, the divider reaches from 40 to 440: the middle of the piece is x 240
    expect(a.elements.map((e) => e.x)).toEqual([-140, 60]);
    expect(a.shapes[0]).toMatchObject({ kind: 'divider', x: -200, w: 400 });
  });
  it('is plain data: it survives a trip through JSON unchanged', () => {
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
  it('takes a plain list of ids, and nothing from an empty or unknown selection', () => {
    expect(captureAssembly(smallScene(), ['valve1'])!.elements).toHaveLength(1);
    expect(captureAssembly(smallScene(), [])).toBeNull();
    expect(captureAssembly(smallScene(), ['ghost'])).toBeNull();
  });
  it('drops the link that leaves the selection', () => {
    expect(captureAssembly(smallScene(), ['pump1', 'valve1'])!.links).toEqual([{ from: 'pump1.r', to: 'valve1.l:0.5', kind: 'pipe', id: 'line1' }]);
    expect(captureAssembly(smallScene(), ['pump1'])!.links).toEqual([]);
  });
  it('carries the own fields of a symbol and no unknown ones', () => {
    const s = deepFreeze({ elements: [{ id: 'a', symbol: 'home.tv', x: 5, y: 5, label: 'L', fillColor: '#abc', unit: 'bar', decimals: 2, sneaky: 'x' }] }) as SceneSettings;
    expect(captureAssembly(s, ['a'])!.elements[0]).toEqual({ id: 'a', symbol: 'home.tv', x: 0, y: 0, label: 'L', fillColor: '#abc', unit: 'bar', decimals: 2 });
  });
});

describe('insertAssembly', () => {
  const piece = captureAssembly(smallScene(), ['tank1', 'pump1'])!;
  it('into an empty scene keeps the ids and puts the middle at the point', () => {
    const r = insertAssembly({ width: 800 }, piece, { x: 400, y: 300 });
    expect(r.refused).toBeUndefined();
    expect(r.ids).toEqual(['tank1', 'pump1']);
    expect(els(r.settings).map((e) => [e.x, e.y])).toEqual([[300, 300], [500, 300]]);
    expect(links(r.settings)).toEqual([{ from: 'tank1.r', to: 'pump1.l', kind: 'pipe' }]);
  });
  it('gives fresh ids where they are taken and the links follow them', () => {
    const r = insertAssembly(smallScene(), piece, { x: 400, y: 500 });
    expect(r.ids).toEqual(['tank2', 'pump2']);
    expect(r.links).toEqual([2]);
    expect(links(r.settings)[2]).toEqual({ from: 'tank2.r', to: 'pump2.l', kind: 'pipe' });
    const again = insertAssembly(r.settings, piece, { x: 400, y: 600 });
    expect(again.ids).toEqual(['tank3', 'pump3']);
    const all = els(again.settings).map((e) => e.id);
    expect(new Set(all).size).toBe(all.length);
  });
  it('mixes a taken id and a free one correctly', () => {
    const s = deepFreeze({ elements: [{ id: 'tank1', symbol: 'home.tv', x: 0, y: 0 }] }) as SceneSettings;
    const r = insertAssembly(s, piece, { x: 0, y: 0 });
    expect(r.ids).toEqual(['tank2', 'pump1']);
    expect(links(r.settings)[0]).toEqual({ from: 'tank2.r', to: 'pump1.l', kind: 'pipe' });
  });
  it('draws what it inserted like the original', () => {
    const r = insertAssembly({ width: 1000, height: 600, scale: 0.6 }, piece, { x: 200, y: 200 });
    const orig = sceneModel(smallScene(), {}).hits;
    const hits = sceneModel(r.settings, {}).hits;
    expect(hits.map((h) => [h.id, h.x, h.y])).toEqual(orig.slice(0, 2).map((h) => [h.id, h.x, h.y]));
  });
  it('refuses at a cap and for an assembly of the other anchor', () => {
    const full: SceneSettings = { elements: Array.from({ length: MAX_SCENE_ELEMENTS - 1 }, (_, i) => ({ id: `a${i}`, symbol: 'home.tv', x: i, y: 0 })) };
    const r = insertAssembly(full, piece, { x: 0, y: 0 });
    expect(r.settings).toBe(full);
    expect(r.refused).toMatch(/200/);
    const corner = insertAssembly({ anchor: 'corner' }, piece, { x: 0, y: 0 });
    expect(corner.refused).toMatch(/x and y/);
  });
  it('refuses a broken assembly and a bad point', () => {
    const s = smallScene();
    expect(insertAssembly(s, { ...piece, elements: [] , shapes: []}, { x: 0, y: 0 }).refused).toBeTruthy();
    expect(insertAssembly(s, piece, { x: Number.NaN, y: 0 }).refused).toBeTruthy();
    expect(insertAssembly(s, 'nope', { x: 0, y: 0 }).settings).toBe(s);
  });
  it('does not touch the assembly it inserts', () => {
    const frozen = deepFreeze(clone(piece));
    expect(() => insertAssembly(smallScene(), frozen, { x: 1, y: 1 })).not.toThrow();
  });
});

describe('serialize and parseClipboard', () => {
  const piece = captureAssembly(smallScene(), ['tank1', 'pump1', 'valve1'], { name: 'Line' })!;
  it('round-trips an assembly through text', () => {
    const back = parseClipboard(serialize(piece));
    expect(back).toEqual({ ok: true, assembly: piece });
  });
  it('refuses text that is not JSON, not an assembly, too long or not text', () => {
    expect(parseClipboard('hello').ok).toBe(false);
    expect(parseClipboard('{"a":1}').ok).toBe(false);
    expect(parseClipboard('[]').ok).toBe(false);
    expect(parseClipboard(null).ok).toBe(false);
    expect(parseClipboard('x'.repeat(MAX_CLIPBOARD_CHARS + 1)).ok).toBe(false);
  });
  it('refuses another version and an unknown anchor', () => {
    expect(cleanAssembly({ ...piece, version: 2 }).ok).toBe(false);
    expect(cleanAssembly({ ...piece, anchor: 'middle' }).ok).toBe(false);
  });
  it('drops unknown fields everywhere and keeps the known ones', () => {
    const dirty = clone(piece) as unknown as Record<string, unknown>;
    dirty.extra = 1;
    (dirty.elements as Rec[])[0].onClick = 'alert(1)';
    (dirty.links as Rec[])[0].script = 'x';
    // A real own "__proto__" key can only come from text.
    const text = JSON.stringify(dirty).replace('"onClick"', '"__proto__":{"polluted":true},"onClick"');
    expect(text).toContain('"__proto__"');
    const r = parseClipboard(text);
    expect(r.ok).toBe(true);
    const a = (r as { assembly: Assembly }).assembly;
    expect(a).not.toHaveProperty('extra');
    expect(a.elements[0]).not.toHaveProperty('onClick');
    expect(a.links[0]).not.toHaveProperty('script');
    expect(({} as Rec).polluted).toBeUndefined();
    expect(a.elements[0].symbol).toBe('home.tv');
  });
  it('refuses a value of the wrong kind in a known field', () => {
    for (const patch of [{ x: 'a' }, { x: 1e12 }, { symbol: 'nope' }, { id: 'a b' }, { turn: 45 }, { scale: 99 }, { label: 'x'.repeat(61) }, { mirror: 'yes' }]) {
      const bad = clone(piece) as unknown as { elements: Rec[] };
      Object.assign(bad.elements[0], patch);
      expect(cleanAssembly(bad).ok, JSON.stringify(patch)).toBe(false);
    }
  });
  it('refuses duplicate ids, a link to a symbol that is not in the piece, and a bad link kind', () => {
    const dup = clone(piece) as unknown as { elements: Rec[] };
    dup.elements[1].id = dup.elements[0].id;
    expect(cleanAssembly(dup).ok).toBe(false);
    const dangling = clone(piece) as unknown as { links: Rec[] };
    dangling.links[0].to = 'ghost.l';
    expect(cleanAssembly(dangling).ok).toBe(false);
    const kind = clone(piece) as unknown as { links: Rec[] };
    kind.links[0].kind = 'rope';
    expect(cleanAssembly(kind).ok).toBe(false);
  });
  it('refuses lists past the caps', () => {
    const many = clone(piece) as unknown as { elements: Rec[] };
    many.elements = Array.from({ length: MAX_SCENE_ELEMENTS + 1 }, (_, i) => ({ id: `a${i}`, symbol: 'home.tv', x: 0, y: 0 }));
    expect(cleanAssembly(many).ok).toBe(false);
    const notList = { ...clone(piece), links: {} };
    expect(cleanAssembly(notList).ok).toBe(false);
  });
  it('only ever reads text as data (a string that looks like code stays a string)', () => {
    const t = clone(piece) as unknown as { elements: Rec[] };
    t.elements[0].label = '${process.exit(1)}';
    const r = cleanAssembly(t);
    expect(r.ok && r.assembly.elements[0].label).toBe('${process.exit(1)}');
  });
  it('refuses to serialize something that is not an assembly', () => {
    expect(() => serialize({ ...piece, elements: [], shapes: [] })).toThrow(RangeError);
  });
});

describe('problems', () => {
  const codes = (s: SceneSettings, data = {}) => problems(s, data).map((p) => `${p.code}:${p.id}`);
  const bound = { points: { shape: 'table', rows: [{ id: 'tank1' }, { id: 'pump1' }, { id: 'valve1' }, { id: 'line1' }] } } as never;
  it('finds nothing wrong in a clean scene', () => {
    expect(problems(smallScene(), bound)).toEqual([]);
  });
  it('finds duplicate and unusable ids and unknown symbols', () => {
    const s = deepFreeze({ elements: [
      { id: 'a', symbol: 'home.tv', x: 1, y: 1 }, { id: 'a', symbol: 'home.tv', x: 2, y: 2 }, { id: '1x', symbol: 'home.tv', x: 3, y: 3 }, { id: 'b', symbol: 'nope', x: 4, y: 4 },
    ] }) as SceneSettings;
    expect(codes(s)).toEqual(['duplicate-id:a', 'invalid-id:1x', 'unknown-symbol:b']);
  });
  it('finds a link that ends nowhere', () => {
    const s = { ...smallScene(), links: [{ from: 'tank1.r', to: 'ghost.l' }, { from: 'tank1.r', to: 'pump1' }, { from: 'tank1.r', to: 'pump1.l' }] } as SceneSettings;
    expect(codes(s)).toEqual(['dangling-link:link:0', 'dangling-link:link:1']);
  });
  it('finds a symbol with no row in the bound table, and says nothing when no table is bound', () => {
    expect(codes(smallScene(), { points: { shape: 'table', rows: [{ id: 'tank1' }] } })).toEqual(['unbound-symbol:pump1', 'unbound-symbol:valve1']);
    expect(codes(smallScene())).toEqual([]);
    expect(codes(smallScene(), { points: { shape: 'table', rows: [] } })).toHaveLength(3);
  });
  it('reads the id column the scene names', () => {
    const s = { ...smallScene(), idColumn: 'tag' } as SceneSettings;
    expect(codes(s, { points: { shape: 'table', rows: [{ tag: 'tank1' }, { tag: 'pump1' }, { tag: 'valve1' }] } })).toEqual([]);
  });
  it('finds symbols and shapes outside the canvas', () => {
    const s = deepFreeze({ width: 400, height: 300, elements: [{ id: 'a', symbol: 'home.tv', x: 500, y: 10 }, { id: 'b', symbol: 'home.tv', x: 10, y: 10 }], shapes: [{ kind: 'text', x: -5, y: 10, text: 'x' }] }) as SceneSettings;
    expect(codes(s)).toEqual(['off-canvas:a', 'off-canvas:shape:0']);
  });
  it('finds zero-size zones and titles without words', () => {
    const s = deepFreeze({ shapes: [{ kind: 'zone', x: 1, y: 1, w: 0, h: 50 }, { kind: 'zone', x: 1, y: 1 }, { kind: 'text', x: 1, y: 1, text: '' }] }) as SceneSettings;
    expect(codes(s)).toEqual(['zero-size-zone:shape:0', 'empty-title:shape:2']);
  });
  it('warns near a cap and errors past it', () => {
    const many = (n: number) => ({ elements: Array.from({ length: n }, (_, i) => ({ id: `a${i}`, symbol: 'home.tv', x: i, y: 0 })) }) as SceneSettings;
    expect(codes(many(179))).toEqual([]);
    expect(codes(many(180))).toEqual(['near-cap:scene']);
    expect(problems(many(180))[0].severity).toBe('warning');
    expect(problems(many(201))[0]).toMatchObject({ code: 'over-cap', severity: 'error' });
  });
  it('lists errors before warnings', () => {
    const s = deepFreeze({ width: 300, elements: [{ id: 'a', symbol: 'home.tv', x: 999, y: 0 }, { id: 'a', symbol: 'home.tv', x: 1, y: 1 }] }) as SceneSettings;
    expect(problems(s).map((p) => p.severity)).toEqual(['error', 'warning']);
  });
  it('takes the checks of the host, one or several, and survives one that throws', () => {
    const mine = () => [{ severity: 'warning' as const, code: 'rule-never-matches', id: 'rule:0', message: 'Never matches' }];
    expect(problems(smallScene(), bound, { extra: mine }).map((p) => p.code)).toEqual(['rule-never-matches']);
    expect(problems(smallScene(), bound, { extra: [mine, mine] })).toHaveLength(2);
    const boom = () => { throw new Error('x'); };
    expect(problems(smallScene(), bound, { extra: [boom, mine] }).map((p) => p.code)).toEqual(['check-failed', 'rule-never-matches']);
  });
  it('hands the settings and the data to a host check', () => {
    let seen: unknown[] = [];
    problems(smallScene(), bound, { extra: (...args) => { seen = args; return []; } });
    expect(seen[1]).toBe(bound);
    expect((seen[0] as SceneSettings).width).toBe(1000);
  });
});
