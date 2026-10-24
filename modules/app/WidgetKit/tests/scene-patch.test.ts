import { describe, it, expect } from 'vitest';
import {
  MAX_PATCH_LINKS, MAX_PATCH_OBJECTS, MAX_PATCH_PROBLEMS, MAX_PATCH_SHAPES, MAX_PATCH_TEXT, MAX_PATCH_THINGS,
  parseScenePatch, patchId, patchThingIds, plainText,
} from '../views/scene-patch';

const parse = (raw: unknown, o?: { maxThings?: number }) => parseScenePatch(raw, o);
const RLO = String.fromCharCode(0x202e);
const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);

describe('parseScenePatch: what is not a patch', () => {
  it('no patch is no patch and no problem', () => {
    expect(parse(undefined)).toEqual({ patch: null, problems: [] });
    expect(parse(null)).toEqual({ patch: null, problems: [] });
  });
  it('anything that is not a plain object is refused with one problem', () => {
    for (const raw of ['scene', 3, [], [{ things: [] }], new Date(0), new Map()]) {
      expect(parse(raw)).toEqual({ patch: null, problems: ['The scene patch is not an object'] });
    }
  });
  it('an empty object is an empty patch', () => {
    expect(parse({})).toEqual({ patch: {}, problems: [] });
  });
  it('a field it does not know is dropped with a problem, never passed on', () => {
    const r = parse({ setParams: { room: 'b' }, command: 'open', navigate: '/x', problems: ['ok'] });
    expect(r.patch).toEqual({ problems: ['ok'] });
    expect(r.problems).toEqual(['Unknown field setParams dropped', 'Unknown field command dropped', 'Unknown field navigate dropped']);
  });
});

describe('things', () => {
  it('keeps plain rows with their columns, and a numeric id as it came', () => {
    const r = parse({ things: [{ id: 'cow7', symbol: 'home.tv', x: 10, y: 20.5, running: true, status: null, label: 'Cow 7' }, { id: 12, x: 1, y: 2 }] });
    expect(r.patch?.things).toEqual([{ id: 'cow7', symbol: 'home.tv', x: 10, y: 20.5, running: true, status: null, label: 'Cow 7' }, { id: 12, x: 1, y: 2 }]);
    expect(r.problems).toEqual([]);
  });
  it('an empty list removes every thing (it replaces the slot\'s rows)', () => {
    expect(parse({ things: [] }).patch).toEqual({ things: [] });
  });
  it('caps at 500 by default, keeps the first ones and says so; the 3D viewer passes its own cap', () => {
    const many = Array.from({ length: 612 }, (_, i) => ({ id: `t${i}`, x: i, y: 0 }));
    const r = parse({ things: many });
    expect(r.patch?.things).toHaveLength(MAX_PATCH_THINGS);
    expect(r.patch?.things?.[499].id).toBe('t499');
    expect(r.problems).toEqual(['things: 612 given, only the first 500 are used']);
    expect(parse({ things: many }, { maxThings: 2000 }).patch?.things).toHaveLength(612);
  });
  it('drops a row whose id is not usable or repeats', () => {
    const r = parse({ things: [{ id: '' }, { id: { a: 1 } }, { id: 'x'.repeat(65) }, { id: '__proto__' }, { id: `a${NUL}b` }, { id: 'ok' }, { id: 'ok' }, { id: null }] });
    expect(r.patch?.things).toEqual([{ id: 'ok' }]);
    // seven dropped rows, and the object id's cell counted as a cell that is not a plain value
    expect(r.problems).toHaveLength(8);
    expect(r.problems[5]).toBe('things.6: the id ok repeats');
    expect(r.problems[6]).toBe('things.7: the id is not usable');
    expect(r.problems[7]).toBe('things: 1 cells that are not plain values were dropped');
  });
  it('keeps a row without an id (the card may read another id column)', () => {
    expect(parse({ things: [{ tag: 'A', x: 1, y: 2 }] }).patch?.things).toEqual([{ tag: 'A', x: 1, y: 2 }]);
  });
  it('drops cells that are not plain values and keys that are not column names, counted in one problem', () => {
    const r = parse({ things: [{ id: 'a', nested: { x: 1 }, list: [1], fn: () => 1, inf: Infinity, 'bad key': 1, constructor: 1, x: 3 }] });
    expect(r.patch?.things).toEqual([{ id: 'a', x: 3 }]);
    expect(r.problems).toEqual(['things: 6 cells that are not plain values were dropped']);
  });
  it('makes every text cell plain and short', () => {
    const r = parse({ things: [{ id: 'a', label: `  <b>Cow</b>\n\t${RLO}seven  ${'x'.repeat(200)}` }] });
    const label = r.patch?.things?.[0].label as string;
    expect(label.startsWith('<b>Cow</b> seven x')).toBe(true);
    expect(label).not.toContain(RLO);
    expect(label.length).toBe(MAX_PATCH_TEXT);
  });
  it('a row that is not an object, and things that are not a list, are problems', () => {
    expect(parse({ things: [1, 'a', null] }).problems).toEqual(['things.0 is not an object', 'things.1 is not an object', 'things.2 is not an object']);
    expect(parse({ things: { a: 1 } })).toEqual({ patch: {}, problems: ['things is not a list'] });
  });
  it('the ids of the things under the card\'s id column', () => {
    const { patch } = parse({ things: [{ id: 'a', tag: 'T1' }, { id: 'b' }, { tag: 'T3' }] });
    expect(patchThingIds(patch)).toEqual(['a', 'b']);
    expect(patchThingIds(patch, 'tag')).toEqual(['T1', 'T3']);
    expect(patchThingIds(null)).toEqual([]);
  });
});

describe('objects', () => {
  it('reads the 2D effects, the reading and the 3D effects of an object, each by its kind', () => {
    const r = parse({
      objects: {
        pump1: { state: 'warning', color: 'var(--info)', hidden: false, blink: 'true', label: 'Hot', speed: 900, dx: 12, scale: 9, turn: 90, symbol: 'home.tv', value: 42 },
        cow7: { pulse: true, size: 2, dz: 0.5, params: { door: 'open', level: 3 } },
      },
    });
    expect(r.patch?.objects).toEqual({
      pump1: { state: 'warning', color: 'var(--info)', hidden: false, blink: true, label: 'Hot', speed: 400, dx: 12, scale: 4, turn: '90', symbol: 'home.tv', value: 42 },
      cow7: { pulse: true, size: 2, dz: 0.5, params: { door: 'open', level: 3 } },
    });
    expect(r.problems).toEqual([]);
  });
  it('a value that does not fit its field, and a field it does not know, are dropped with a problem', () => {
    const r = parse({ objects: { p: { state: 'exploded', color: 'url(javascript:x)', turn: 45, onClick: 'run', symbol: '../../etc', dim: true } } });
    expect(r.patch?.objects).toEqual({ p: { dim: true } });
    expect(r.problems).toEqual([
      'objects.p.state is not valid', 'objects.p.color is not valid', 'objects.p.turn is not valid',
      'objects.p: unknown field onClick dropped', 'objects.p.symbol is not a symbol key',
    ]);
  });
  it('a label is plain text without tokens being filled in, at most 80 characters', () => {
    const r = parse({ objects: { p: { label: `{param:secret}\n${'y'.repeat(100)}` } } });
    expect(r.patch?.objects?.p.label).toBe(`{param:secret} ${'y'.repeat(100)}`.slice(0, 80));
  });
  it('an id that is not usable, an object that is not an object, an empty override are dropped', () => {
    const r = parse({ objects: { ' p ': { dim: true }, __proto__x: { dim: true }, q: 'red', e: {} } });
    expect(Object.keys(r.patch?.objects ?? {})).toEqual(['__proto__x']);
    expect(r.problems).toEqual(['objects: the id p is not usable', 'objects.q is not an object']);
  });
  it('caps the number of overrides', () => {
    const objects = Object.fromEntries(Array.from({ length: MAX_PATCH_OBJECTS + 5 }, (_, i) => [`o${i}`, { dim: true }]));
    const r = parse({ objects });
    expect(Object.keys(r.patch?.objects ?? {})).toHaveLength(MAX_PATCH_OBJECTS);
    expect(r.problems[0]).toBe(`objects: ${MAX_PATCH_OBJECTS + 5} given, only the first ${MAX_PATCH_OBJECTS} are used`);
  });
  it('params keep only plain values under column names', () => {
    const r = parse({ objects: { d: { params: { ok: 1, 'no way': 2, deep: { a: 1 } } } } });
    expect(r.patch?.objects?.d.params).toEqual({ ok: 1 });
    expect(r.problems).toEqual(['objects.d.params.no way dropped', 'objects.d.params.deep dropped']);
  });
});

describe('links and shapes', () => {
  it('keeps connections whose ends are in the scene\'s grammar, kind pipe by default', () => {
    const r = parse({ links: [{ from: 'pump1.r', to: 'cow7.l:0.3', kind: 'hose', medium: 'water', id: 'feed2' }, { from: 'a.r', to: 'b.l' }] });
    expect(r.patch?.links).toEqual([{ from: 'pump1.r', to: 'cow7.l:0.3', kind: 'hose', medium: 'water', id: 'feed2' }, { from: 'a.r', to: 'b.l', kind: 'pipe' }]);
  });
  it('drops a connection with a bad end, and bad optional fields with a problem each', () => {
    const r = parse({ links: [{ from: 'nonsense', to: 'b.l' }, { from: 'a.r', to: 'b.l', kind: 'teleport', medium: 'x y', id: '9x', style: 'red' }] });
    expect(r.patch?.links).toEqual([{ from: 'a.r', to: 'b.l', kind: 'pipe' }]);
    expect(r.problems).toEqual([
      'links.0: an end is not an id and a side (pump1.r)', 'links.1.kind is not a connection kind', 'links.1.medium is not a medium',
      'links.1.id is not an id', 'links.1: unknown field style dropped',
    ]);
  });
  it('caps the extra connections at 300 and the shapes at 100', () => {
    const links = Array.from({ length: MAX_PATCH_LINKS + 1 }, () => ({ from: 'a.r', to: 'b.l' }));
    const shapes = Array.from({ length: MAX_PATCH_SHAPES + 2 }, () => ({ kind: 'zone', x: 0, y: 0 }));
    const r = parse({ links, shapes });
    expect(r.patch?.links).toHaveLength(MAX_PATCH_LINKS);
    expect(r.patch?.shapes).toHaveLength(MAX_PATCH_SHAPES);
    expect(r.problems).toEqual(['links: 301 given, only the first 300 are used', 'shapes: 102 given, only the first 100 are used']);
  });
  it('keeps titles and zones with valid fields, clamped; refuses another kind and a title without words', () => {
    const r = parse({
      shapes: [
        { kind: 'zone', x: 10, y: -20, w: 9000, h: 120, text: 'Pen A', tone: 'warning', dashed: false },
        { kind: 'text', x: 1e9, y: 5, text: `Room${BEL} B`, size: 'l', align: 'start' },
        { kind: 'divider', x: 0, y: 0 },
        { kind: 'text', x: 0, y: 0 },
        { kind: 'zone', x: 'left', y: 0 },
        { kind: 'zone', x: 0, y: 0, tone: 'neon', onclick: 'x' },
      ],
    });
    expect(r.patch?.shapes).toEqual([
      { kind: 'zone', x: 10, y: -20, w: 4000, h: 120, text: 'Pen A', tone: 'warning', dashed: false },
      { kind: 'text', x: 10_000, y: 5, text: 'Room B', size: 'l', align: 'start' },
      { kind: 'zone', x: 0, y: 0 },
    ]);
    expect(r.problems).toEqual([
      'shapes.2: the kind is not text or zone', 'shapes.3: a title has no words', 'shapes.4: x and y must be numbers',
      'shapes.5.tone is not valid', 'shapes.5: unknown field onclick dropped',
    ]);
  });
});

describe('view', () => {
  it.each([
    ['content', 'content'],
    ['canvas', 'canvas'],
    [{ x0: 0, y0: 10, x1: 400, y1: 300 }, { x0: 0, y0: 10, x1: 400, y1: 300 }],
    [{ preset: 'top' }, { preset: 'top' }],
    [{ target: [1, 2, 3], distance: 25 }, { target: [1, 2, 3], distance: 25 }],
  ])('accepts %j', (raw, view) => {
    expect(parse({ view: raw })).toEqual({ patch: { view }, problems: [] });
  });
  it.each([
    ['everything', 'view is not one of the views a scene knows'],
    [{ x0: 10, y0: 0, x1: 5, y1: 10 }, 'view: the region needs x0 < x1 and y0 < y1'],
    [{ x0: 0, y0: 0, x1: 5 }, 'view is not one of the views a scene knows'],
    [{ preset: 'bird' }, 'view.preset is not iso, top or front'],
    [{ preset: 'top', zoom: 2 }, 'view is not one of the views a scene knows'],
    [{ target: [1, 2], distance: 5 }, 'view: the target needs three numbers and a distance above 0'],
    [{ target: [1, 2, 3], distance: 0 }, 'view: the target needs three numbers and a distance above 0'],
  ])('refuses %j', (raw, problem) => {
    expect(parse({ view: raw })).toEqual({ patch: {}, problems: [problem] });
  });
});

describe('problems', () => {
  it('keeps the script\'s problems as plain short text, capped', () => {
    const r = parse({ problems: ['  two   cows\nmissing ', '', 42, { a: 1 }, 'z'.repeat(90)] });
    expect(r.patch?.problems).toEqual(['two cows missing', '42', 'z'.repeat(80)]);
    const many = parse({ problems: Array.from({ length: MAX_PATCH_PROBLEMS + 3 }, (_, i) => `p${i}`) });
    expect(many.patch?.problems).toHaveLength(MAX_PATCH_PROBLEMS);
    expect(many.problems).toEqual([`problems: ${MAX_PATCH_PROBLEMS + 3} given, only the first ${MAX_PATCH_PROBLEMS} are used`]);
  });
  it('the parser\'s own problems are capped at 20 lines, the rest counted', () => {
    const r = parse({ links: Array.from({ length: 30 }, () => ({ from: 'x', to: 'y' })) });
    expect(r.problems).toHaveLength(20);
    expect(r.problems[19]).toBe('11 more problems in the scene patch');
  });
});

describe('plain values', () => {
  it('plainText drops control and direction characters and collapses space', () => {
    expect(plainText(`a${NUL}b${RLO}c\n\n d `)).toBe('a b c d');
    expect(plainText(12.5)).toBe('12.5');
    expect(plainText({})).toBe('');
  });
  it('patchId: short, nothing unseen, never a prototype key', () => {
    expect(patchId(' cow 7 ')).toBe('cow 7');
    expect(patchId(7)).toBe('7');
    expect([patchId(''), patchId('prototype'), patchId(NaN), patchId(`a${RLO}`), patchId('y'.repeat(65)), patchId(true)]).toEqual([null, null, null, null, null, null]);
  });
});
