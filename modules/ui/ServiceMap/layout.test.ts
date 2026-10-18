import { describe, it, expect } from 'vitest';
import { layoutServiceMap, neighbours } from './layout';

const N = (...ids: string[]) => ids.map((id) => ({ id }));

describe('layoutServiceMap', () => {
  it('puts callers left of callees, one layer per call depth', () => {
    const l = layoutServiceMap(N('web', 'api', 'db'), [{ from: 'web', to: 'api' }, { from: 'api', to: 'db' }]);
    const x = (id: string) => l.nodes.find((n) => n.id === id)!.x;
    expect(x('web')).toBeLessThan(x('api'));
    expect(x('api')).toBeLessThan(x('db'));
    expect(l.layers).toEqual([['web'], ['api'], ['db']]);
  });

  it('is deterministic', () => {
    const nodes = N('a', 'b', 'c', 'd', 'e');
    const edges = [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'b', to: 'd' }, { from: 'c', to: 'd' }, { from: 'a', to: 'd' }, { from: 'd', to: 'e' }];
    expect(JSON.stringify(layoutServiceMap(nodes, edges))).toBe(JSON.stringify(layoutServiceMap(nodes, edges)));
  });

  it('never overlaps nodes in a layer and keeps everything inside the bounds', () => {
    const nodes = N('gw', 'a', 'b', 'c', 'd', 'e', 'db');
    const edges = ['a', 'b', 'c', 'd', 'e'].flatMap((s) => [{ from: 'gw', to: s }, { from: s, to: 'db' }]);
    const l = layoutServiceMap(nodes, edges);
    for (const layer of l.layers) {
      const ys = layer.map((id) => l.nodes.find((n) => n.id === id)!).sort((p, q) => p.y - q.y);
      for (let i = 1; i < ys.length; i++) expect(ys[i].y).toBeGreaterThanOrEqual(ys[i - 1].y + ys[i - 1].height);
    }
    for (const n of l.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.width).toBeLessThanOrEqual(l.width);
      expect(n.y + n.height).toBeLessThanOrEqual(l.height + 1e-6);
    }
  });

  it('routes an edge that skips layers through a point per crossed layer', () => {
    const l = layoutServiceMap(N('a', 'b', 'c'), [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c' }]);
    const long = l.edges.find((e) => e.from === 'a' && e.to === 'c')!;
    expect(long.points).toHaveLength(3);
    expect(long.back).toBe(false);
    expect(long.path.startsWith('M')).toBe(true);
  });

  it('cuts cycles: the closing edge is drawn as a back edge and layout still terminates', () => {
    const l = layoutServiceMap(N('a', 'b', 'c'), [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }]);
    expect(l.edges.filter((e) => e.back).map((e) => e.id)).toEqual(['c->a']);
    expect(l.layers.flat().sort()).toEqual(['a', 'b', 'c']);
  });

  it('ignores unknown endpoints, self loops and duplicates; keeps isolated nodes', () => {
    const l = layoutServiceMap(N('a', 'b', 'lonely'), [
      { from: 'a', to: 'b' }, { from: 'a', to: 'b' }, { from: 'a', to: 'a' }, { from: 'a', to: 'ghost' },
    ]);
    expect(l.edges).toHaveLength(1);
    expect(l.nodes.map((n) => n.id)).toContain('lonely');
  });

  it('mirrors the layout for rtl', () => {
    const ltr = layoutServiceMap(N('a', 'b'), [{ from: 'a', to: 'b' }]);
    const rtl = layoutServiceMap(N('a', 'b'), [{ from: 'a', to: 'b' }], { direction: 'rtl' });
    const x = (l: typeof ltr, id: string) => l.nodes.find((n) => n.id === id)!.x;
    expect(x(ltr, 'a')).toBeLessThan(x(ltr, 'b'));
    expect(x(rtl, 'a')).toBeGreaterThan(x(rtl, 'b'));
    expect(rtl.width).toBe(ltr.width);
  });

  it('handles empty input', () => {
    const l = layoutServiceMap([], []);
    expect(l.nodes).toEqual([]);
    expect(l.edges).toEqual([]);
  });

  it('finds neighbours for keyboard navigation', () => {
    const l = layoutServiceMap(N('a', 'b', 'c'), [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }]);
    const n = neighbours(l, 'a');
    expect(n.downstream.sort()).toEqual(['b', 'c']);
    expect(neighbours(l, 'b').upstream).toEqual(['a']);
    expect(neighbours(l, 'b').sameLayer.sort()).toEqual(['b', 'c']);
  });
});
