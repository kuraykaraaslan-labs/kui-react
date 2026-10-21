import { describe, expect, it } from 'vitest';
import type { RuleEdge, RuleNode } from '../types';
import { edgeKey } from './diff';
import { diffGraphs, diffTints, diffView, edgeTintOf } from './diff-view';

const node = (nodeId: string, type: string, extra: Partial<RuleNode> = {}): RuleNode => ({ nodeId, type, label: nodeId, x: 0, y: 0, ...extra });
const edge = (edgeId: string, from: string, port: string, to: string): RuleEdge => ({ edgeId, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });

const before = { nodes: [node('a', 'T'), node('b', 'F', { config: { x: 1 } }), node('c', 'A')], edges: [edge('e1', 'a', 'out', 'b'), edge('e2', 'b', 'out', 'c')], groups: [] };
const after = { nodes: [node('a', 'T', { x: 50 }), node('b', 'F', { config: { x: 2 } }), node('d', 'A')], edges: [edge('e1', 'a', 'out', 'b'), edge('e2', 'b', 'out', 'd')], groups: [] };

describe('diff on the canvas', () => {
  it('diffs editor graphs: config and script are params, label is the name', () => {
    const d = diffGraphs(before, after);
    expect(d.nodes.changed.map((c) => [c.id, c.fields.map((f) => f.key)])).toEqual([['b', ['params.x']]]);
    expect(diffGraphs({ nodes: [node('s', 'S', { script: 'a' })], edges: [] }, { nodes: [node('s', 'S', { script: 'b', label: 'Run' })], edges: [] })
      .nodes.changed[0].fields.map((f) => f.key)).toEqual(['name', 'params.script']);
  });

  it('tints added, changed and removed blocks and connections; a moved block is not tinted', () => {
    const t = diffTints(diffGraphs(before, after));
    expect(t.nodes).toEqual({ b: 'changed', c: 'removed', d: 'added' });
    expect(t.edges).toEqual({ [edgeKey('b', 'out', 'c')]: 'removed', [edgeKey('b', 'out', 'd')]: 'added' });
    expect(edgeTintOf(t, edge('x', 'b', 'out', 'd'))).toBe('added');
    expect(edgeTintOf(t, edge('x', 'a', 'out', 'b'))).toBeUndefined();
    expect(edgeTintOf(undefined, edge('x', 'a', 'out', 'b'))).toBeUndefined();
  });

  it('diffView shows both versions in one graph: removed blocks and connections come back, with fresh edge ids', () => {
    const v = diffView(before, after);
    expect(v.nodes.map((n) => n.nodeId)).toEqual(['a', 'b', 'd', 'c']);
    expect(v.edges.map((e) => e.edgeId)).toEqual(['e1', 'e2', 'removed-e2']);
    expect(edgeTintOf(v.tint, v.edges[2])).toBe('removed');
    expect(new Set(v.edges.map((e) => e.edgeId)).size).toBe(v.edges.length);
  });

  it('with no earlier version everything is added', () => {
    const v = diffView(null, after);
    expect(Object.values(v.tint.nodes)).toEqual(['added', 'added', 'added']);
    expect(v.nodes).toHaveLength(3);
  });
});
