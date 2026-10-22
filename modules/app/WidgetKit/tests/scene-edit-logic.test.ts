import { describe, it, expect } from 'vitest';
import { SCADA_SYMBOLS } from '../views/scada-logic';
import { MAX_SCENE_ELEMENTS, MAX_SCENE_LINKS, MAX_SCENE_SHAPES, sceneModel, type SceneSettings } from '../views/scada-scene-logic';
import {
  addElement, addLink, addShape, align, deleteElements, deleteLink, deleteSelection, deleteShapes, distribute, duplicate, formatPort, freeId, isFormKey,
  mirrorElements, moveElements, moveSelection, moveShapes, reconnectLink, renameElement, reorder, resizeShape, setCanvas, setElementProps, setLinkKind,
  setLinkProps, setMid, setOwnSize, setShapeProps, shortName, turnElements, type Rec,
} from '../views/scene-edit-logic';
import { deepFreeze, smallScene } from './scene-edit-fixture';

const els = (s: SceneSettings) => s.elements as Rec[];
const ids = (s: SceneSettings) => els(s).map((e) => e.id);
const links = (s: SceneSettings) => s.links as Rec[];
const shapes = (s: SceneSettings) => s.shapes as Rec[];
const rules = (s: SceneSettings) => (s as { rules: Rec[] }).rules;
const model = (s: SceneSettings) => sceneModel(s, {});

describe('ids', () => {
  it('names a new symbol from its short name, without the sector prefix', () => {
    expect(shortName('home.router')).toBe('router');
    expect(shortName('home.camera.security')).toBe('camera');
    expect(shortName('home.plug.smart')).toBe('plug');
    expect(shortName('gateway')).toBe('gateway');
  });
  it('gives every symbol of the library a usable id stem', () => {
    for (const k of SCADA_SYMBOLS) expect(isFormKey(`${shortName(k)}1`), k).toBe(true);
  });
  it('takes the first free number', () => {
    expect(freeId('pump', new Set(['pump1', 'pump2', 'pump4']))).toBe('pump3');
  });
});

describe('addElement', () => {
  it('adds last in draw order with the next free id', () => {
    const r = addElement(smallScene(), 'home.router', { x: 120.456, y: 80 });
    expect(r.refused).toBeUndefined();
    expect(r.id).toBe('router1');
    expect(els(r.settings).at(-1)).toEqual({ id: 'router1', symbol: 'home.router', x: 120.46, y: 80 });
    expect(ids(r.settings)).toEqual(['tank1', 'pump1', 'valve1', 'router1']);
    expect(addElement(r.settings, 'home.router', { x: 0, y: 0 }).id).toBe('router2');
  });
  it('does not touch its input', () => {
    const s = smallScene();
    addElement(s, 'home.router', { x: 1, y: 2 });
    expect(els(s)).toHaveLength(3);
  });
  it('adds to a scene that has no symbols yet', () => {
    const r = addElement({ width: 400 }, 'home.tv', { x: 0, y: 0 });
    expect(r.settings).toEqual({ width: 400, elements: [{ id: 'tv1', symbol: 'home.tv', x: 0, y: 0 }] });
  });
  it('refuses an unknown symbol and a bad position', () => {
    const s = smallScene();
    expect(addElement(s, 'nope', { x: 0, y: 0 })).toEqual({ settings: s, refused: expect.any(String) });
    expect(addElement(s, 'home.router', { x: Number.NaN, y: 0 }).refused).toBeTruthy();
  });
  it('takes starting fields and checks them', () => {
    const r = addElement(smallScene(), 'home.router', { x: 0, y: 0 }, { label: 'Feed pump', scale: 1.5 });
    expect(els(r.settings).at(-1)).toMatchObject({ label: 'Feed pump', scale: 1.5 });
    expect(addElement(smallScene(), 'home.router', { x: 0, y: 0 }, { scale: 99 }).refused).toBeTruthy();
    expect(addElement(smallScene(), 'home.router', { x: 0, y: 0 }, { id: 'x' }).refused).toBeTruthy();
  });
  it('is refused at the cap of symbols', () => {
    const full: SceneSettings = { elements: Array.from({ length: MAX_SCENE_ELEMENTS }, (_, i) => ({ id: `a${i}`, symbol: 'home.tv', x: i, y: 0 })) };
    const r = addElement(full, 'home.router', { x: 0, y: 0 });
    expect(r.settings).toBe(full);
    expect(r.refused).toMatch(/200/);
  });
});

describe('moveElements and moveSelection', () => {
  it('moves the listed symbols only', () => {
    const r = moveElements(smallScene(), ['pump1'], 10, -5);
    expect(els(r.settings)[1]).toMatchObject({ x: 310, y: 195 });
    expect(els(r.settings)[0]).toMatchObject({ x: 100, y: 200 });
  });
  it('moves symbols and shapes together as one edit', () => {
    const r = moveSelection(smallScene(), { elements: ['tank1'], shapes: [1] }, 20, 20);
    expect(els(r.settings)[0]).toMatchObject({ x: 120, y: 220 });
    expect(shapes(r.settings)[1]).toMatchObject({ x: 60, y: 100, w: 560 });
    expect(shapes(r.settings)[0]).toMatchObject({ x: 500, y: 40 });
  });
  it('keeps what it does not move by reference', () => {
    const s = smallScene();
    const r = moveElements(s, ['pump1'], 1, 1);
    expect(r.settings.elements).not.toBe(s.elements);
    expect(els(r.settings)[0]).toBe(els(s)[0]);
    expect(r.settings.links).toBe(s.links);
  });
  it('rounds the result to hundredths', () => {
    expect(els(moveElements(smallScene(), ['pump1'], 0.1 + 0.2, 0).settings)[1].x).toBe(300.3);
  });
  it('is a no-op for a zero move or an unknown id, a refusal for a bad number', () => {
    const s = smallScene();
    expect(moveElements(s, ['pump1'], 0, 0)).toEqual({ settings: s });
    expect(moveElements(s, ['ghost'], 5, 5).settings).toBe(s);
    expect(moveElements(s, ['pump1'], Number.NaN, 0).refused).toBeTruthy();
  });
  it('moves shapes by index and skips an index that is not there', () => {
    const r = moveShapes(smallScene(), [2, 9], 0, 10);
    expect(shapes(r.settings)[2]).toMatchObject({ y: 410 });
  });
});

describe('setElementProps and friends', () => {
  it('writes fields to one or several symbols and removes a field set to undefined', () => {
    const r = setElementProps(smallScene(), ['tank1', 'pump1'], { label: 'X', labelPos: 't' });
    expect(els(r.settings).slice(0, 2)).toEqual([expect.objectContaining({ label: 'X', labelPos: 't' }), expect.objectContaining({ label: 'X', labelPos: 't' })]);
    expect(els(r.settings)[2]).not.toHaveProperty('label');
    const back = setElementProps(r.settings, 'tank1', { label: undefined });
    expect(els(back.settings)[0]).not.toHaveProperty('label');
  });
  it('checks values against what the template allows', () => {
    const s = smallScene();
    for (const bad of [{ turn: 45 }, { scale: 0.1 }, { labelPos: 'x' }, { mirror: 'yes' }, { symbol: 'nope' }, { id: 'z' }, { x: Infinity }, { __proto__x: 1 }, { 'a-b': 1 }, { constructor: 1 }]) {
      const r = setElementProps(s, 'pump1', bad as Rec);
      expect(r.refused, JSON.stringify(bad)).toBeTruthy();
      expect(r.settings).toBe(s);
    }
  });
  it('is a no-op when the value is already there', () => {
    const s = smallScene();
    expect(setElementProps(s, 'pump1', { turn: '0' }).settings).toBe(s);
  });
  it('sets and clears the own size', () => {
    const r = setOwnSize(smallScene(), 'pump1', 2);
    expect(els(r.settings)[1].scale).toBe(2);
    expect(els(setOwnSize(r.settings, 'pump1', null).settings)[1].scale).toBeNull();
    expect(setOwnSize(smallScene(), 'pump1', 5).refused).toBeTruthy();
  });
  it('lets a symbol change into another one of the library', () => {
    expect(els(setElementProps(smallScene(), 'pump1', { symbol: 'home.camera.security' }).settings)[1].symbol).toBe('home.camera.security');
  });
  it('turns by quarter turns and keeps the stored type', () => {
    const s = smallScene();
    expect(els(turnElements(s, 'pump1', 90).settings)[1].turn).toBe('90');
    expect(els(turnElements(s, 'valve1', 90).settings)[2].turn).toBe(90);
    expect(els(turnElements(s, 'pump1', -90).settings)[1].turn).toBe('270');
    let spun = s;
    for (let i = 0; i < 4; i += 1) spun = turnElements(spun, 'pump1', 90).settings;
    expect(els(spun)[1].turn).toBe('0');
    expect(els(turnElements(s, 'pump1', 180).settings)[1].turn).toBe('180');
  });
  it('mirrors and mirrors back', () => {
    const once = mirrorElements(smallScene(), ['pump1']).settings;
    expect(els(once)[1].mirror).toBe(true);
    expect(els(mirrorElements(once, ['pump1']).settings)[1].mirror).toBe(false);
  });
});

describe('deleteElements', () => {
  it('removes the symbol, the connections that end on it and the rules that name it', () => {
    const r = deleteElements(smallScene(), ['pump1']);
    expect(ids(r.settings)).toEqual(['tank1', 'valve1']);
    expect(links(r.settings)).toEqual([]);
    // pump1 goes, so does the connection line1 that ended on it, and the rule that targeted line1 with it.
    expect(rules(r.settings).map((x) => x.target)).toEqual(['*']);
  });
  it('removes a rule that reads a deleted symbol through `of` or `of2`', () => {
    const viaOf = deleteElements(smallScene(), ['tank1']);
    expect(rules(viaOf.settings).map((x) => x.target)).toEqual(['pump1', '*', 'line1']);
    const viaOf2 = { ...smallScene(), rules: [{ target: 'tank1', of: '', of2: 'valve1', key: 'a' }, { target: '*', of: '' }] };
    expect(rules(deleteElements(deepFreeze(viaOf2), ['valve1']).settings)).toEqual([{ target: '*', of: '' }]);
  });
  it('keeps a rule whose target is a connection id that stays', () => {
    const r = deleteElements(smallScene(), ['tank1']);
    expect(rules(r.settings).some((x) => x.target === 'line1')).toBe(true);
    expect(links(r.settings)).toHaveLength(1);
  });
  it('does not add a rules field to a scene without one', () => {
    const { rules: _drop, ...plain } = smallScene() as SceneSettings & { rules: unknown };
    expect('rules' in deleteElements(deepFreeze(plain), ['pump1']).settings).toBe(false);
  });
  it('ignores ids that are not there', () => {
    const s = smallScene();
    expect(deleteElements(s, ['ghost']).settings).toBe(s);
  });
});

describe('renameElement', () => {
  it('follows in every connection end (the separator and the fraction stay) and in every rule field', () => {
    const r = renameElement(smallScene(), 'pump1', 'feedPump');
    expect(r.id).toBe('feedPump');
    expect(ids(r.settings)).toEqual(['tank1', 'feedPump', 'valve1']);
    expect(links(r.settings).map((l) => [l.from, l.to])).toEqual([['tank1.r', 'feedPump.l'], ['feedPump.r', 'valve1.l:0.5']]);
    expect(rules(r.settings).map((x) => [x.target, x.of, x.of2])).toEqual([['feedPump', '', undefined], ['*', '', undefined], ['valve1', 'tank1', 'feedPump'], ['line1', '', undefined]]);
  });
  it('renames the end that is written with a colon or with a fraction', () => {
    const s = deepFreeze({ elements: [{ id: 'a', symbol: 'home.tv', x: 0, y: 0 }, { id: 'b', symbol: 'home.tv', x: 100, y: 0 }], links: [{ from: 'a:t:0.26', to: ' b.l ', kind: 'pipe' }] }) as SceneSettings;
    const r = renameElement(s, 'b', 'bb');
    expect(links(r.settings)[0]).toEqual({ from: 'a:t:0.26', to: ' bb.l ', kind: 'pipe' });
    expect(links(renameElement(s, 'a', 'aa').settings)[0].from).toBe('aa:t:0.26');
  });
  it('renames an id that contains dots', () => {
    const s = deepFreeze({ elements: [{ id: 'a.l', symbol: 'home.tv', x: 0, y: 0 }, { id: 'b', symbol: 'home.tv', x: 100, y: 0 }], links: [{ from: 'a.l.r', to: 'b.l', kind: 'pipe' }] }) as SceneSettings;
    expect(links(renameElement(s, 'a.l', 'c').settings)[0].from).toBe('c.r');
  });
  it('refuses a duplicate, an unusable id and an id that is not there', () => {
    const s = smallScene();
    for (const [from, to] of [['pump1', 'tank1'], ['pump1', '1pump'], ['pump1', 'a b'], ['pump1', ''], ['pump1', '__proto__'], ['pump1', 'constructor'], ['ghost', 'x']]) {
      const r = renameElement(s, from, to);
      expect(r.refused, `${from} -> ${to}`).toBeTruthy();
      expect(r.settings).toBe(s);
    }
  });
  it('is a no-op to the same id', () => {
    const s = smallScene();
    expect(renameElement(s, 'pump1', 'pump1')).toEqual({ settings: s });
  });
});

describe('connections', () => {
  it('adds a link between two ports given as objects or strings', () => {
    const s = smallScene();
    const a = addLink(s, { id: 'tank1', side: 't' }, 'valve1.b', 'hose');
    expect(a.index).toBe(2);
    expect(links(a.settings)[2]).toEqual({ from: 'tank1.t', to: 'valve1.b', kind: 'hose' });
    const b = addLink(s, { id: 'tank1', side: 'b', at: 0.26 }, { id: 'valve1', side: 'l', at: 0.75 });
    expect(links(b.settings)[2]).toEqual({ from: 'tank1.b:0.26', to: 'valve1.l:0.75', kind: 'pipe' });
  });
  it('formats ports the scene can read back', () => {
    expect(formatPort({ id: 'p', side: 'r' })).toBe('p.r');
    expect(formatPort({ id: 'p', side: 't', at: 0.5 })).toBe('p.t');
    expect(formatPort({ id: 'p', side: 't', at: 0.123456 })).toBe('p.t:0.123');
    expect(formatPort({ id: 'p', side: 't', at: 7 })).toBe('p.t:1');
  });
  it('refuses a missing symbol, a loop, a bad kind, a twin and a bad end', () => {
    const s = smallScene();
    expect(addLink(s, 'ghost.r', 'tank1.l').refused).toBeTruthy();
    expect(addLink(s, 'tank1.r', 'tank1.l').refused).toBeTruthy();
    expect(addLink(s, 'tank1.t', 'valve1.t', 'rope').refused).toBeTruthy();
    expect(addLink(s, 'pump1.l', 'tank1.r').refused).toMatch(/already/);
    expect(addLink(s, 'tank1', 'valve1.t').refused).toBeTruthy();
    expect(addLink(s, 'tank1.t', 'valve1.t', 'pipe', { from: 'x.l' }).refused).toBeTruthy();
  });
  it('is refused at the cap of connections', () => {
    const s: SceneSettings = {
      elements: [{ id: 'a', symbol: 'home.tv', x: 0, y: 0 }, { id: 'b', symbol: 'home.tv', x: 9, y: 0 }],
      links: Array.from({ length: MAX_SCENE_LINKS }, (_, i) => ({ from: `a.l:0.${i}`, to: 'b.r', kind: 'pipe' })),
    };
    const r = addLink(s, 'a.t', 'b.b');
    expect(r.settings).toBe(s);
    expect(r.refused).toMatch(/300/);
  });
  it('changes the kind, the middle leg and other fields of a link by index', () => {
    const s = smallScene();
    expect(links(setLinkKind(s, 0, 'cable').settings)[0].kind).toBe('cable');
    expect(setLinkKind(s, 0, 'rope').refused).toBeTruthy();
    const withMid = setMid(s, 1, 310.256).settings;
    expect(links(withMid)[1].mid).toBe(310.256);
    expect(links(setMid(withMid, 1, null).settings)[1]).not.toHaveProperty('mid');
    expect(setMid(s, 1, Number.NaN).refused).toBeTruthy();
    expect(setMid(s, 7, 1).refused).toBeTruthy();
    expect(links(setLinkProps(s, 0, { arrows: true, medium: 'hot' }).settings)[0]).toMatchObject({ arrows: true, medium: 'hot' });
    expect(setLinkProps(s, 0, { arrows: 'x' }).refused).toBeTruthy();
    expect(setLinkProps(s, 0, { id: 'a b' }).refused).toBeTruthy();
  });
  it('moves one end of a link', () => {
    const s = smallScene();
    expect(links(reconnectLink(s, 0, 'to', { id: 'valve1', side: 't' }).settings)[0].to).toBe('valve1.t');
    expect(reconnectLink(s, 0, 'to', 'tank1.l').refused).toBeTruthy();
    expect(reconnectLink(s, 0, 'to', 'ghost.l').refused).toBeTruthy();
  });
  it('takes the rules that target a deleted connection with it, and keeps those of a connection id another one still carries', () => {
    const s = smallScene();
    expect(rules(deleteLink(s, 1).settings).map((x) => x.target)).toEqual(['pump1', '*', 'valve1']);
    expect(rules(deleteLink(s, 0).settings)).toHaveLength(4);
    const twin = deepFreeze({ ...s, links: [...(s.links as Rec[]), { from: 'tank1.t', to: 'valve1.t', id: 'line1' }] }) as SceneSettings;
    expect(rules(deleteLink(twin, 1).settings)).toHaveLength(4);
  });
  it('makes the rules follow a connection id that is changed, and drops them when it is cleared', () => {
    const s = smallScene();
    expect(rules(setLinkProps(s, 1, { id: 'main' }).settings).map((x) => x.target)).toEqual(['pump1', '*', 'valve1', 'main']);
    expect(rules(setLinkProps(s, 1, { id: '' }).settings).map((x) => x.target)).toEqual(['pump1', '*', 'valve1']);
    expect(rules(setLinkProps(s, 0, { id: 'first' }).settings)).toHaveLength(4);
  });
  it('deletes links by index', () => {
    const s = smallScene();
    expect(links(deleteLink(s, 0).settings)).toEqual([links(s)[1]]);
    expect(deleteLink(s, 5).settings).toBe(s);
  });
});

describe('shapes', () => {
  it('adds a title, a zone and a divider with the starting size', () => {
    let s = smallScene();
    const t = addShape(s, 'text', { x: 10, y: 20 }); s = t.settings;
    const z = addShape(s, 'zone', { x: 30, y: 40 }); s = z.settings;
    const d = addShape(s, 'divider', { x: 50, y: 60 }); s = d.settings;
    expect([t.index, z.index, d.index]).toEqual([3, 4, 5]);
    expect(shapes(s).slice(3)).toEqual([
      { kind: 'text', x: 10, y: 20, text: 'Title', size: 'm' }, { kind: 'zone', x: 30, y: 40, w: 200, h: 120 }, { kind: 'divider', x: 50, y: 60, w: 200, h: 0 },
    ]);
  });
  it('refuses a bad kind, a bad field and the cap', () => {
    const s = smallScene();
    expect(addShape(s, 'blob' as 'text', { x: 0, y: 0 }).refused).toBeTruthy();
    expect(addShape(s, 'zone', { x: 0, y: 0 }, { w: 9999 }).refused).toBeTruthy();
    expect(addShape(s, 'zone', { x: 0, y: 0 }, { colour: 'red' }).refused).toBeTruthy();
    const full: SceneSettings = { shapes: Array.from({ length: MAX_SCENE_SHAPES }, () => ({ kind: 'divider', x: 0, y: 0, w: 50, h: 0 })) };
    expect(addShape(full, 'text', { x: 0, y: 0 }).settings).toBe(full);
    expect(addShape(full, 'text', { x: 0, y: 0 }).refused).toMatch(/100/);
  });
  it('writes fields but never changes the kind', () => {
    const s = smallScene();
    expect(shapes(setShapeProps(s, 0, { text: 'Hall', tone: 'info' }).settings)[0]).toMatchObject({ text: 'Hall', tone: 'info' });
    expect(setShapeProps(s, 0, { kind: 'zone' }).refused).toBeTruthy();
    expect(setShapeProps(s, 0, { tone: 'loud' }).refused).toBeTruthy();
    expect(setShapeProps(s, 9, { text: 'x' }).refused).toBeTruthy();
  });
  it('resizes zones (at least 20) and dividers along their length, not titles', () => {
    const s = smallScene();
    expect(shapes(resizeShape(s, 1, { w: 300, h: 5 }).settings)[1]).toMatchObject({ w: 300, h: 20 });
    expect(shapes(resizeShape(s, 2, { w: 120 }).settings)[2]).toMatchObject({ w: 120, h: 0 });
    const vertical = addShape(s, 'divider', { x: 0, y: 0 }, { w: 0, h: 80 }).settings;
    expect(shapes(resizeShape(vertical, 3, { h: 150 }).settings)[3]).toMatchObject({ w: 0, h: 150 });
    expect(resizeShape(s, 0, { w: 100 }).refused).toBeTruthy();
    expect(resizeShape(s, 1, { w: -1 }).refused).toBeTruthy();
  });
  it('moves and deletes shapes', () => {
    const s = smallScene();
    expect(shapes(deleteShapes(s, [0, 2]).settings)).toEqual([shapes(s)[1]]);
    expect(deleteShapes(s, [7]).settings).toBe(s);
  });
});

describe('deleteSelection', () => {
  it('deletes connections, shapes and symbols in one edit, indices read before anything is removed', () => {
    const r = deleteSelection(smallScene(), { elements: ['valve1'], shapes: [0], links: [0] });
    expect(ids(r.settings)).toEqual(['tank1', 'pump1']);
    expect(links(r.settings)).toEqual([]);
    expect(shapes(r.settings).map((h) => h.kind)).toEqual(['zone', 'divider']);
  });
  it('is a no-op for an empty selection', () => {
    const s = smallScene();
    expect(deleteSelection(s, {}).settings).toBe(s);
  });
});

describe('align and distribute', () => {
  const s = deepFreeze({
    elements: [
      { id: 'a', symbol: 'home.plug.smart', x: 100, y: 100 }, { id: 'b', symbol: 'home.plug.smart', x: 200, y: 160 },
      { id: 'c', symbol: 'home.plug.smart', x: 450, y: 130 },
    ],
  }) as SceneSettings;
  const sel = { elements: ['a', 'b', 'c'] };
  const xy = (r: SceneSettings, i: number) => [els(r)[i].x, els(r)[i].y];
  it('aligns to left, centre, right', () => {
    expect(els(align(s, model(s), sel, 'left').settings).map((e) => e.x)).toEqual([100, 100, 100]);
    expect(els(align(s, model(s), sel, 'right').settings).map((e) => e.x)).toEqual([450, 450, 450]);
    expect(els(align(s, model(s), sel, 'center').settings).map((e) => e.x)).toEqual([275, 275, 275]);
  });
  it('aligns to top, middle, bottom', () => {
    expect(els(align(s, model(s), sel, 'top').settings).map((e) => e.y)).toEqual([100, 100, 100]);
    expect(els(align(s, model(s), sel, 'bottom').settings).map((e) => e.y)).toEqual([160, 160, 160]);
    expect(els(align(s, model(s), sel, 'middle').settings).map((e) => e.y)).toEqual([130, 130, 130]);
  });
  it('uses the drawn boxes, so symbols of different sizes line up on their edges', () => {
    const t = deepFreeze({ elements: [{ id: 'a', symbol: 'home.plug.smart', x: 100, y: 100 }, { id: 'b', symbol: 'home.plug.smart', x: 300, y: 100, scale: 2 }] }) as SceneSettings;
    const r = align(t, model(t), { elements: ['a', 'b'] }, 'top');
    const hit = (id: string) => model(r.settings).hits.find((h) => h.id === id)!;
    expect(hit('a').y).toBeCloseTo(hit('b').y, 1);
  });
  it('needs two items and does nothing for one', () => {
    expect(align(s, model(s), { elements: ['a'] }, 'left').settings).toBe(s);
    expect(align(s, model(s), { elements: ['a', 'ghost'] }, 'left').settings).toBe(s);
  });
  it('is a no-op for items that are already aligned', () => {
    const r = align(s, model(s), sel, 'left').settings;
    expect(align(r, model(r), sel, 'left').settings).toBe(r);
  });
  it('distributes with equal gaps and keeps the ends', () => {
    const r = distribute(s, model(s), sel, 'horizontal').settings;
    expect(xy(r, 0)[0]).toBe(100); expect(xy(r, 2)[0]).toBe(450);
    expect(xy(r, 1)[0]).toBe(275);
    expect(xy(r, 1)[1]).toBe(160);
  });
  it('distributes vertically, by centre order', () => {
    const t = deepFreeze({ elements: [
      { id: 'a', symbol: 'home.plug.smart', x: 100, y: 100 }, { id: 'b', symbol: 'home.plug.smart', x: 100, y: 120 }, { id: 'c', symbol: 'home.plug.smart', x: 100, y: 400 },
    ] }) as SceneSettings;
    const r = distribute(t, model(t), { elements: ['c', 'a', 'b'] }, 'vertical').settings;
    expect(els(r).map((e) => e.y)).toEqual([100, 250, 400]);
  });
  it('needs three items', () => {
    expect(distribute(s, model(s), { elements: ['a', 'b'] }, 'horizontal').settings).toBe(s);
  });
  it('aligns shapes with symbols', () => {
    const t = deepFreeze({ elements: [{ id: 'a', symbol: 'home.plug.smart', x: 100, y: 100 }], shapes: [{ kind: 'zone', x: 300, y: 200, w: 100, h: 100 }] }) as SceneSettings;
    const r = align(t, model(t), { elements: ['a'], shapes: [0] }, 'middle').settings;
    expect(els(r)[0].y).toBe(185);
    expect(shapes(r)[0].y).toBe(135);
  });
});

describe('duplicate', () => {
  it('copies symbols with new ids, shifted, with the links between them and none of the others', () => {
    const r = duplicate(smallScene(), { elements: ['tank1', 'pump1'], shapes: [2] });
    expect(r.ids).toEqual(['tank2', 'pump2']);
    expect(ids(r.settings)).toEqual(['tank1', 'pump1', 'valve1', 'tank2', 'pump2']);
    expect(els(r.settings)[3]).toMatchObject({ symbol: 'home.tv', x: 120, y: 220, label: 'Feed' });
    expect(links(r.settings)).toHaveLength(3);
    expect(links(r.settings)[2]).toEqual({ from: 'tank2.r', to: 'pump2.l', kind: 'pipe' });
    expect(r.links).toEqual([2]);
    expect(r.shapes).toEqual([3]);
    expect(shapes(r.settings)[3]).toMatchObject({ kind: 'divider', x: 60, y: 420 });
  });
  it('numbers from the stem, so a copy of pump1 is pump2 and a copy of a plain id gets 1', () => {
    const t = deepFreeze({ elements: [{ id: 'flt', symbol: 'home.plug.smart', x: 0, y: 0 }, { id: 'pump7', symbol: 'home.router', x: 50, y: 0 }] }) as SceneSettings;
    expect(duplicate(t, { elements: ['flt', 'pump7'] }).ids).toEqual(['flt1', 'pump8']);
  });
  it('is refused past the caps and a no-op for an empty selection', () => {
    const full: SceneSettings = { elements: Array.from({ length: MAX_SCENE_ELEMENTS }, (_, i) => ({ id: `a${i}`, symbol: 'home.tv', x: i, y: 0 })) };
    const r = duplicate(full, { elements: ['a1'] });
    expect(r.settings).toBe(full);
    expect(r.refused).toBeTruthy();
    const s = smallScene();
    expect(duplicate(s, {}).settings).toBe(s);
  });
});

describe('reorder', () => {
  it('brings to the front and sends to the back', () => {
    expect(ids(reorder(smallScene(), { elements: ['tank1'] }, 'front').settings)).toEqual(['pump1', 'valve1', 'tank1']);
    expect(ids(reorder(smallScene(), { elements: ['valve1'] }, 'back').settings)).toEqual(['valve1', 'tank1', 'pump1']);
  });
  it('moves one step and stops at the ends', () => {
    expect(ids(reorder(smallScene(), { elements: ['tank1'] }, 'forward').settings)).toEqual(['pump1', 'tank1', 'valve1']);
    expect(ids(reorder(smallScene(), { elements: ['valve1'] }, 'backward').settings)).toEqual(['tank1', 'valve1', 'pump1']);
    const s = smallScene();
    expect(reorder(s, { elements: ['valve1'] }, 'forward').settings).toBe(s);
    expect(reorder(s, { elements: ['tank1'] }, 'back').settings).toBe(s);
  });
  it('keeps a selection together in its own order', () => {
    expect(ids(reorder(smallScene(), { elements: ['tank1', 'valve1'] }, 'front').settings)).toEqual(['pump1', 'tank1', 'valve1']);
  });
  it('reorders shapes and says where they went', () => {
    const r = reorder(smallScene(), { shapes: [0] }, 'front');
    expect(shapes(r.settings).map((h) => h.kind)).toEqual(['zone', 'divider', 'text']);
    expect(r.shapes).toEqual([2]);
  });
});

describe('setCanvas', () => {
  it('sets the size, the symbol size and the anchor', () => {
    const r = setCanvas(smallScene(), { width: 1400, height: 800, scale: 0.8 });
    expect(r.settings).toMatchObject({ width: 1400, height: 800, scale: 0.8 });
  });
  it('refuses numbers outside what the template allows', () => {
    const s = smallScene();
    for (const p of [{ width: 100 }, { height: 5000 }, { scale: 3 }, { scale: 0.1 }, { anchor: 'middle' as 'center' }, { width: Number.NaN }]) {
      expect(setCanvas(s, p).refused, JSON.stringify(p)).toBeTruthy();
    }
  });
  it('converts positions when the anchor changes, so the picture stays put', () => {
    const s = smallScene();
    const r = setCanvas(s, { anchor: 'corner' }, model(s));
    expect(r.settings.anchor).toBe('corner');
    const before = model(s).hits; const after = model(r.settings).hits;
    for (const h of before) {
      const a = after.find((x) => x.id === h.id)!;
      expect(a.x).toBeCloseTo(h.x, 1); expect(a.y).toBeCloseTo(h.y, 1);
    }
    const back = setCanvas(r.settings, { anchor: 'center' }, model(r.settings));
    for (const e of els(back.settings)) expect(e.x).toBeCloseTo(els(s).find((o) => o.id === e.id)!.x as number, 1);
  });
  it('is a no-op for the values it already has', () => {
    const s = smallScene();
    expect(setCanvas(s, { width: 1000, scale: 0.6, anchor: 'center' }).settings).toBe(s);
  });
});

describe('every edit leaves its input alone', () => {
  it('runs each edit on a frozen scene without throwing', () => {
    const s = smallScene();
    const m = model(s);
    const runs: Array<() => unknown> = [
      () => addElement(s, 'home.router', { x: 1, y: 1 }), () => moveSelection(s, { elements: ['pump1'], shapes: [0] }, 3, 3), () => setElementProps(s, 'pump1', { label: 'x' }),
      () => renameElement(s, 'pump1', 'p'), () => deleteElements(s, ['pump1']), () => addLink(s, 'tank1.t', 'valve1.t'), () => setMid(s, 1, 4),
      () => deleteLink(s, 0), () => addShape(s, 'zone', { x: 0, y: 0 }), () => resizeShape(s, 1, { w: 90 }), () => deleteShapes(s, [0]),
      () => align(s, m, { elements: ['tank1', 'pump1'] }, 'top'), () => distribute(s, m, { elements: ['tank1', 'pump1', 'valve1'] }, 'horizontal'),
      () => duplicate(s, { elements: ['tank1'] }), () => reorder(s, { elements: ['tank1'] }, 'front'), () => setCanvas(s, { width: 900 }),
      () => turnElements(s, 'pump1', 90), () => mirrorElements(s, 'pump1'),
    ];
    for (const run of runs) expect(run).not.toThrow();
  });
});
