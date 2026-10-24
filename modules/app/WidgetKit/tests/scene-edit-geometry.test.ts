import { describe, it, expect } from 'vitest';
import { sceneModel, type SceneSettings } from '../views/scada-scene-logic';
import {
  linkLegs, marquee, midValue, nearestPort, pick, polylineDistance, portHandles, shapeBounds, snapAlongEdge, unionBox,
} from '../views/scene-edit-geometry';
import { setMid } from '../views/scene-edit-logic';
import { smallScene } from './scene-edit-fixture';

// smallScene drawn: tank1 box (77.2,169.4,45.6,61.2), pump1 (270,170,60,60), valve1 (470,170,60,60).
const s = smallScene();
const m = sceneModel(s, {});
const box = (id: string) => m.hits.find((h) => h.id === id)!;

describe('portHandles', () => {
  it('gives the four side midpoints of a symbol', () => {
    const hs = portHandles(m, 'pump1');
    expect(hs.map((h) => [h.side, h.x, h.y])).toEqual([['l', 270, 200], ['r', 330, 200], ['t', 300, 170], ['b', 300, 230]]);
    expect(hs.every((h) => h.at === 0.5 && h.id === 'pump1')).toBe(true);
  });
  it('is empty for an id that is not drawn', () => {
    expect(portHandles(m, 'ghost')).toEqual([]);
  });
});

describe('snapAlongEdge', () => {
  it('maps a point to a fraction along the edge, rounded to hundredths', () => {
    const r = snapAlongEdge(m, 'pump1', 't', { x: 270 + 60 * 0.2613, y: 150 })!;
    expect(r).toMatchObject({ id: 'pump1', side: 't', at: 0.26, y: 170 });
    expect(r.x).toBeCloseTo(285.6, 1);
  });
  it('snaps to the middle near it, and clamps beyond the corners', () => {
    expect(snapAlongEdge(m, 'pump1', 'l', { x: 0, y: 203 })!.at).toBe(0.5);
    expect(snapAlongEdge(m, 'pump1', 'l', { x: 0, y: 9999 })!.at).toBe(1);
    expect(snapAlongEdge(m, 'pump1', 'l', { x: 0, y: -50 })!.at).toBe(0);
    expect(snapAlongEdge(m, 'pump1', 'l', { x: 0, y: 203 }, { magnet: 0 })!.at).toBe(0.55);
  });
  it('is null for an unknown symbol', () => {
    expect(snapAlongEdge(m, 'ghost', 'l', { x: 0, y: 0 })).toBeNull();
  });
});

describe('nearestPort', () => {
  it('finds the closest side midpoint within the radius', () => {
    const hit = nearestPort(m, { x: 333, y: 203 }, 10)!;
    expect(hit).toMatchObject({ id: 'pump1', side: 'r', at: 0.5, x: 330, y: 200 });
    expect(hit.distance).toBeCloseTo(Math.hypot(3, 3), 5);
  });
  it('finds nothing out of reach', () => {
    expect(nearestPort(m, { x: 400, y: 400 }, 10)).toBeNull();
  });
  it('skips excluded symbols', () => {
    expect(nearestPort(m, { x: 333, y: 203 }, 10, { exclude: ['pump1'] })).toBeNull();
    expect(nearestPort(m, { x: 333, y: 203 }, 200, { exclude: ['pump1'] })!.id).not.toBe('pump1');
  });
  it('can be limited to some symbols', () => {
    expect(nearestPort(m, { x: 333, y: 203 }, 10, { only: ['tank1'] })).toBeNull();
  });
  it('offers a point along an edge when asked and no midpoint is near', () => {
    const p = { x: 270 + 60 * 0.8, y: 166 };
    expect(nearestPort(m, p, 8)).toBeNull();
    expect(nearestPort(m, p, 8, { edge: true })).toMatchObject({ id: 'pump1', side: 't', at: 0.8 });
  });
});

describe('linkLegs', () => {
  const legs = linkLegs(s, m);
  it('routes every joined link with the scene router and keeps the stored index', () => {
    expect(legs.map((l) => l.index)).toEqual([0, 1]);
    expect(legs[0].points[0]).toEqual({ x: 130, y: 200 });
    expect(legs[0].points.at(-1)).toEqual({ x: 270, y: 200 });
    expect(legs[0].from).toEqual({ id: 'tank1', side: 'r', at: 0.5 });
  });
  it('gives a handle on the middle leg of a Z route and none on an L route', () => {
    const z = { elements: [{ id: 'a', symbol: 'home.plug.smart', x: 100, y: 100 }, { id: 'b', symbol: 'home.plug.smart', x: 300, y: 250 }], links: [{ from: 'a.r', to: 'b.l' }, { from: 'a.b', to: 'b.l:0.2' }] } as SceneSettings;
    const zm = sceneModel(z, {});
    const [flat, l] = linkLegs(z, zm);
    expect(flat.handle).toMatchObject({ axis: 'x', x: (130 + 16 + 270 - 16) / 2 });
    expect(l.handle).toBeNull();
    const dragged = setMid(z, 0, 210).settings;
    expect(linkLegs(dragged, sceneModel(dragged, {}))[0].handle).toMatchObject({ axis: 'x', x: 210 });
    expect(midValue(flat.handle!, { x: 213.456, y: 0 })).toBe(213.46);
  });
  it('uses y for two vertical ports', () => {
    const v = { elements: [{ id: 'a', symbol: 'home.plug.smart', x: 100, y: 100 }, { id: 'b', symbol: 'home.plug.smart', x: 300, y: 300 }], links: [{ from: 'a.b', to: 'b.t' }] } as SceneSettings;
    expect(linkLegs(v, sceneModel(v, {}))[0].handle).toMatchObject({ axis: 'y', y: (130 + 16 + 270 - 16) / 2 });
  });
  it('leaves out a link that dangles', () => {
    const d = { ...s, links: [{ from: 'ghost.r', to: 'pump1.l' }, ...(s.links as unknown[])] } as SceneSettings;
    expect(linkLegs(d, sceneModel(d, {})).map((l) => l.index)).toEqual([1, 2]);
  });
  it('routes a straight link as just its two ports', () => {
    expect(legs[1].points).toEqual([{ x: 330, y: 200 }, { x: 470, y: 200 }]);
  });
  it('routes a link that ends on an anchor (a thing from data) that is not in the model, and lets a symbol win over one', () => {
    const t = { ...s, links: [...(s.links as unknown[]), { from: 'valve1.r', to: 'cow7.l' }] } as SceneSettings;
    const full = sceneModel(t, { things: { shape: 'table', rows: [{ id: 'cow7', symbol: 'home.plug.smart', x: 800, y: 200 }] } });
    const authored = { hits: full.hits.filter((h) => h.from !== 'things') };
    const anchors = full.hits.filter((h) => h.from === 'things');
    expect(anchors.map((h) => h.id)).toEqual(['cow7']);
    // without the anchors the link to the thing has no leg (it could not be picked)
    expect(linkLegs(t, authored).map((l) => l.index)).toEqual([0, 1]);
    const withThing = linkLegs(t, authored, anchors);
    expect(withThing.map((l) => l.index)).toEqual([0, 1, 2]);
    expect(withThing[2].points).toEqual([{ x: 530, y: 200 }, { x: 770, y: 200 }]);
    expect(pick(authored, t, { x: 650, y: 202 }, { ports: 'none', anchors })).toEqual({ kind: 'link', id: '2', index: 2 });
    // an anchor is never picked itself
    expect(pick(authored, t, { x: 800, y: 200 }, { ports: 'none', anchors }).kind).toBe('none');
    // an anchor with an authored symbol's id does not move that symbol's end
    const clash = [{ ...anchors[0], id: 'valve1', x: 0 }];
    expect(linkLegs(s, m, clash)[1].points).toEqual(legs[1].points);
  });
});

describe('shapeBounds', () => {
  it('follows the scene model: minimum sizes, divider direction, a title by its words', () => {
    expect(shapeBounds({ kind: 'zone', x: 1, y: 2, w: 5, h: 400 })).toEqual({ x: 1, y: 2, w: 20, h: 400 });
    expect(shapeBounds({ kind: 'zone', x: 0, y: 0 })).toEqual({ x: 0, y: 0, w: 200, h: 120 });
    expect(shapeBounds({ kind: 'divider', x: 5, y: 5, w: 0, h: 90 })).toEqual({ x: 5, y: 5, w: 0, h: 90 });
    expect(shapeBounds({ kind: 'divider', x: 5, y: 5, w: 100, h: 0 })).toEqual({ x: 5, y: 5, w: 100, h: 0 });
    expect(shapeBounds({ kind: 'text', x: 100, y: 50, text: 'abcd', size: 'm', align: 'start' })).toMatchObject({ x: 100, y: 35 });
    expect(shapeBounds({ kind: 'text', x: 100, y: 50, text: '' })).toBeNull();
    expect(shapeBounds({ kind: 'blob', x: 0, y: 0 })).toBeNull();
  });
});

describe('pick', () => {
  const at = (x: number, y: number, o = {}) => pick(m, s, { x, y }, o);
  it('picks a port with a larger hit area than the drawing, before the symbol', () => {
    expect(at(334, 203)).toEqual({ kind: 'port', id: 'pump1', side: 'r', at: 0.5 });
    expect(at(300, 200)).toEqual({ kind: 'element', id: 'pump1' });
  });
  it('picks only the ports it is told to offer', () => {
    expect(at(333, 208)).toMatchObject({ kind: 'port', id: 'pump1', side: 'r' });
    expect(at(333, 208, { ports: 'none' })).toEqual({ kind: 'none', id: '' });
    expect(at(333, 208, { ports: ['tank1'] })).toEqual({ kind: 'none', id: '' });
    expect(at(300, 200, { ports: 'none' })).toEqual({ kind: 'element', id: 'pump1' });
  });
  it('picks the topmost of overlapping symbols (the later one in the list)', () => {
    const o = { elements: [{ id: 'a', symbol: 'home.plug.smart', x: 100, y: 100 }, { id: 'b', symbol: 'home.plug.smart', x: 110, y: 100 }] } as SceneSettings;
    expect(pick(sceneModel(o, {}), o, { x: 105, y: 100 }, { ports: 'none' }).id).toBe('b');
  });
  it('picks a connection near its leg and not far from it', () => {
    expect(at(400, 203)).toEqual({ kind: 'link', id: '1', index: 1 });
    expect(at(400, 215)).toEqual({ kind: 'none', id: '' });
    expect(at(400, 212, { tolerance: 15 })).toEqual({ kind: 'link', id: '1', index: 1 });
  });
  it('picks a title by its box, a divider by its line, a zone by its outline and title strip', () => {
    expect(at(500, 35)).toEqual({ kind: 'shape', id: '0', index: 0 });
    expect(at(200, 400)).toEqual({ kind: 'shape', id: '2', index: 2 });
    expect(at(300, 80)).toEqual({ kind: 'shape', id: '1', index: 1 });
    expect(at(120, 90)).toEqual({ kind: 'shape', id: '1', index: 1 });
    expect(at(300, 300, { ports: 'none' })).toEqual({ kind: 'none', id: '' });
    expect(at(300, 300, { zoneFill: true })).toEqual({ kind: 'shape', id: '1', index: 1 });
  });
  it('lets a symbol win over the zone it sits in, and a title over a symbol', () => {
    expect(at(300, 200, { ports: 'none' }).kind).toBe('element');
    const t = { elements: [{ id: 'a', symbol: 'home.plug.smart', x: 100, y: 100 }], shapes: [{ kind: 'text', x: 100, y: 105, text: 'Over' }] } as SceneSettings;
    expect(pick(sceneModel(t, {}), t, { x: 100, y: 100 }, { ports: 'none' })).toMatchObject({ kind: 'shape', index: 0 });
  });
  it('is none on empty canvas', () => {
    expect(at(900, 550)).toEqual({ kind: 'none', id: '' });
  });
});

describe('marquee', () => {
  it('takes the symbols a rectangle touches, in draw order, and the shapes when given the settings', () => {
    expect(marquee(m, { x: 260, y: 160, w: 300, h: 100 }).elements).toEqual(['pump1', 'valve1']);
    expect(marquee(m, { x: 0, y: 0, w: 1000, h: 600 }, s)).toEqual({ elements: ['tank1', 'pump1', 'valve1'], shapes: [0, 1, 2] });
  });
  it('can require the whole box', () => {
    const r = { x: 260, y: 160, w: 90, h: 100 };
    expect(marquee(m, { x: 260, y: 160, w: 250, h: 100 }, undefined, 'contain').elements).toEqual(['pump1']);
    expect(marquee(m, r, undefined, 'contain').elements).toEqual(['pump1']);
    expect(marquee(m, { x: 280, y: 160, w: 40, h: 100 }, undefined, 'contain').elements).toEqual([]);
  });
  it('accepts a rectangle dragged up and to the left', () => {
    expect(marquee(m, { x: 560, y: 260, w: -300, h: -100 }).elements).toEqual(['pump1', 'valve1']);
  });
  it('selects nothing from empty space', () => {
    expect(marquee(m, { x: 800, y: 500, w: 50, h: 50 }, s)).toEqual({ elements: [], shapes: [] });
  });
});

describe('small helpers', () => {
  it('measures the distance to a polyline', () => {
    expect(polylineDistance({ x: 5, y: 3 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(3);
    expect(polylineDistance({ x: 13, y: 4 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(5);
    expect(polylineDistance({ x: 1, y: 1 }, [{ x: 0, y: 0 }])).toBe(Infinity);
  });
  it('unites boxes', () => {
    expect(unionBox([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 10 }])).toEqual({ x: 0, y: 0, w: 30, h: 15 });
    expect(unionBox([])).toBeNull();
    expect(box('pump1').w).toBe(60);
  });
});
