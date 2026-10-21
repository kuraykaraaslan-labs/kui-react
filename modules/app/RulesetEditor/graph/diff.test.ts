import { describe, expect, it } from 'vitest';
import { diffFlows, edgeKey, shortText, stableJson, type DiffItem } from './diff';

const flow = (o: Partial<DiffItem> = {}): DiffItem => ({
  name: 'F',
  nodes: [
    { id: 'n1', type: 'trigger.inject', params: { every: 5 }, x: 0, y: 0 },
    { id: 'n2', type: 'logic.change', params: { rules: [{ a: 1, b: 2 }] }, x: 200, y: 0, name: 'Shape' },
    { id: 'n3', type: 'action.notify', params: { to: 'ops' }, x: 400, y: 0 },
  ],
  edges: [{ from: 'n1', from_port: 'out', to: 'n2' }, { from: 'n2', from_port: 'out', to: 'n3' }],
  groups: [{ id: 'g1', name: 'A', nodes: ['n1'] }],
  ...o,
});

describe('diffFlows', () => {
  it('finds nothing between equal flows, whatever the key order', () => {
    const a = flow();
    const b = flow({ nodes: a.nodes!.map((n) => (n.id === 'n2' ? { ...n, params: { rules: [{ b: 2, a: 1 }] } } : n)) });
    const d = diffFlows(a, b);
    expect(d.total).toBe(0);
    expect(d.isNew).toBe(false);
  });

  it('lists added, removed and changed nodes with the changed field paths, sorted by id', () => {
    const a = flow();
    const b = flow({
      nodes: [
        { id: 'n1', type: 'trigger.inject', params: { every: 10 }, x: 0, y: 0, disabled: true, v: 2 },
        { id: 'n2', type: 'logic.switch', params: { rules: [{ a: 1, b: 2 }] }, x: 200, y: 0, name: 'Route' },
        { id: 'n0', type: 'logic.delay', params: {}, x: 0, y: 100 },
      ],
    });
    const d = diffFlows(a, b);
    expect(d.nodes.added).toEqual([{ id: 'n0', type: 'logic.delay', name: '' }]);
    expect(d.nodes.removed).toEqual([{ id: 'n3', type: 'action.notify', name: '' }]);
    expect(d.nodes.changed.map((c) => [c.id, c.fields.map((f) => f.key)])).toEqual([
      ['n1', ['disabled', 'v', 'params.every']],
      ['n2', ['type', 'name']],
    ]);
    expect(d.nodes.changed[0].fields[2]).toEqual({ key: 'params.every', from: '5', to: '10' });
  });

  it('counts a move apart from changes, and connections and groups by key', () => {
    const a = flow();
    const b = flow({
      nodes: a.nodes!.map((n) => (n.id === 'n3' ? { ...n, x: 999 } : n)),
      edges: [{ from: 'n1', from_port: 'out', to: 'n2' }, { from: 'n2', from_port: 'error', to: 'n3' }],
      groups: [{ id: 'g1', name: 'B', nodes: ['n1'] }, { id: 'g2', name: 'C', nodes: ['n3'] }],
    });
    const d = diffFlows(a, b);
    expect(d.nodes.changed).toEqual([]);
    expect(d.nodes.moved).toEqual(['n3']);
    expect(d.edges.added).toEqual([{ key: edgeKey('n2', 'error', 'n3'), from: 'n2', from_port: 'error', to: 'n3' }]);
    expect(d.edges.removed.map((e) => e.key)).toEqual([edgeKey('n2', 'out', 'n3')]);
    expect(d.groups).toEqual({ added: ['g2'], removed: [], changed: ['g1'] });
    expect(d.total).toBe(5);
  });

  it('marks a new item and lists its meta changes; an empty description that was never set is no change', () => {
    const d = diffFlows(null, flow({ description: '' }));
    expect(d.isNew).toBe(true);
    expect(d.meta.map((m) => m.key)).toEqual(['name']);
    expect(d.nodes.added).toHaveLength(3);
    const sub = diffFlows({ outputs: ['a'], params: {} }, { outputs: ['a', 'b'], params: {} });
    expect(sub.meta).toEqual([{ key: 'outputs', from: '["a"]', to: '["a","b"]' }]);
  });

  it('reads a missing port as out', () => {
    expect(diffFlows(flow({ edges: [{ from: 'n1', to: 'n2' }] }), flow({ edges: [{ from: 'n1', from_port: 'out', to: 'n2' }] })).total).toBe(0);
  });
});

describe('helpers', () => {
  it('stableJson sorts keys and reads undefined as null', () => {
    expect(stableJson({ b: 1, a: [undefined, { d: 1, c: 2 }] })).toBe('{"a":[null,{"c":2,"d":1}],"b":1}');
    expect(stableJson(undefined)).toBe('null');
  });
  it('shortText cuts at 60', () => {
    expect(shortText('x'.repeat(80))).toHaveLength(58);
    expect(shortText(undefined)).toBe('');
    expect(shortText({ a: 1 })).toBe('{"a":1}');
  });
});
