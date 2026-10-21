import { describe, expect, it } from 'vitest';
import { edgeKey, mergeGraphs } from './merge';
import type { EditorState } from './state';
import type { GraphEdge, GraphNode } from './types';

const node = (nodeId: string, x = 0, extra: Partial<GraphNode> = {}): GraphNode => ({ nodeId, type: 'FILTER', label: nodeId, x, y: 0, ...extra });
const edge = (edgeId: string, from: string, to: string, port = 'out'): GraphEdge => ({ edgeId, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });
const state = (p: Partial<EditorState> = {}): EditorState => ({ nodes: [], edges: [], groups: [], ...p });
const ids = (s: EditorState) => s.nodes.map((n) => n.nodeId);

const BASE = state({ nodes: [node('a'), node('b', 100), node('c', 200)], edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')] });

describe('mergeGraphs: nodes', () => {
  it('takes what only theirs changed, keeps what only mine changed', () => {
    const mine = state({ ...BASE, nodes: [node('a', 4), node('b', 100), node('c', 200)] });
    const theirs = state({ ...BASE, nodes: [node('a'), node('b', 100, { label: 'B!' }), node('c', 200)] });
    const r = mergeGraphs(BASE, mine, theirs);
    expect(r.conflicts).toEqual([]);
    expect(r.graph.nodes.find((n) => n.nodeId === 'a')?.x).toBe(4);
    expect(r.graph.nodes.find((n) => n.nodeId === 'b')?.label).toBe('B!');
    expect(r.fromTheirs).toEqual([{ kind: 'node', id: 'b' }]);
  });

  it('keeps mine and lists a node both sides changed differently', () => {
    const mine = state({ ...BASE, nodes: [node('a', 4), node('b', 100), node('c', 200)] });
    const theirs = state({ ...BASE, nodes: [node('a', 8), node('b', 100), node('c', 200)] });
    const r = mergeGraphs(BASE, mine, theirs);
    expect(r.conflicts).toEqual([{ kind: 'node', id: 'a', deleted: false }]);
    expect(r.graph.nodes[0].x).toBe(4);
  });

  it('a node both sides changed the same way is not a conflict', () => {
    const both = state({ ...BASE, nodes: [node('a', 4), node('b', 100), node('c', 200)] });
    const r = mergeGraphs(BASE, both, both);
    expect(r.conflicts).toEqual([]);
    expect(r.fromTheirs).toEqual([]);
  });

  it('adds what theirs added after mine and keeps what mine added', () => {
    const mine = state({ ...BASE, nodes: [...BASE.nodes, node('m1')] });
    const theirs = state({ ...BASE, nodes: [...BASE.nodes, node('t1')] });
    expect(ids(mergeGraphs(BASE, mine, theirs).graph)).toEqual(['a', 'b', 'c', 'm1', 't1']);
  });

  it('deleting on one side deletes, unless the other side changed it', () => {
    const mine = state({ ...BASE, nodes: [node('a'), node('c', 200)], edges: [] });
    const theirs = state({ ...BASE, nodes: [node('a'), node('b', 100, { label: 'changed' }), node('c', 200)] });
    const r = mergeGraphs(BASE, mine, theirs);
    expect(r.conflicts).toEqual([{ kind: 'node', id: 'b', deleted: true }]);
    // mine deleted it: the editor's version (gone) is kept
    expect(ids(r.graph)).toEqual(['a', 'c']);
  });

  it('theirs deleting a node that mine did not touch removes it', () => {
    const theirs = state({ nodes: [node('a'), node('c', 200)], edges: [] });
    const r = mergeGraphs(BASE, BASE, theirs);
    expect(ids(r.graph)).toEqual(['a', 'c']);
    expect(r.conflicts).toEqual([]);
  });

  it('does not touch its arguments', () => {
    const mine = state({ ...BASE });
    const theirs = state({ nodes: [node('z')], edges: [] });
    const before = JSON.stringify([BASE, mine, theirs]);
    mergeGraphs(BASE, mine, theirs).graph.nodes[0].x = 999;
    expect(JSON.stringify([BASE, mine, theirs])).toBe(before);
  });

  it('works without a base: both sides count as changed', () => {
    const mine = state({ nodes: [node('a', 4)] });
    const theirs = state({ nodes: [node('a', 8), node('t')] });
    const r = mergeGraphs(null, mine, theirs);
    expect(r.conflicts).toEqual([{ kind: 'node', id: 'a', deleted: false }]);
    expect(ids(r.graph)).toEqual(['a', 't']);
  });
});

describe('mergeGraphs: connections', () => {
  it('a connection is a set: added by one side stays, removed by one side stays removed', () => {
    const mine = state({ ...BASE, edges: [edge('e1', 'a', 'b')] }); // removed b -> c
    const theirs = state({ ...BASE, edges: [...BASE.edges, edge('e3', 'a', 'c')] }); // added a -> c
    const r = mergeGraphs(BASE, mine, theirs);
    expect(r.graph.edges.map(edgeKey).sort()).toEqual([edgeKey(edge('', 'a', 'b')), edgeKey(edge('', 'a', 'c'))].sort());
  });

  it('matches connections by their ends, not their ids', () => {
    const mine = state({ ...BASE, edges: [edge('x1', 'a', 'b'), edge('x2', 'b', 'c')] });
    const theirs = state({ ...BASE });
    const r = mergeGraphs(BASE, mine, theirs);
    expect(r.graph.edges.map((e) => e.edgeId)).toEqual(['x1', 'x2']);
  });

  it('drops a connection to a node that is gone', () => {
    const theirs = state({ nodes: [node('a'), node('b', 100)], edges: [edge('e1', 'a', 'b')] }); // c removed there
    const mine = state({ ...BASE, edges: [...BASE.edges, edge('e3', 'a', 'c')] });
    const r = mergeGraphs(BASE, mine, theirs);
    expect(ids(r.graph)).toEqual(['a', 'b']);
    expect(r.graph.edges.every((e) => e.targetNodeId !== 'c' && e.sourceNodeId !== 'c')).toBe(true);
  });

  it('gives a connection added on both sides with one id a new id', () => {
    const mine = state({ ...BASE, nodes: [...BASE.nodes, node('m')], edges: [...BASE.edges, edge('e3', 'a', 'm')] });
    const theirs = state({ ...BASE, nodes: [...BASE.nodes, node('t')], edges: [...BASE.edges, edge('e3', 'a', 't')] });
    const r = mergeGraphs(BASE, mine, theirs);
    const edgeIds = r.graph.edges.map((e) => e.edgeId);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
    expect(r.graph.edges).toHaveLength(4);
  });
});

describe('mergeGraphs: groups', () => {
  const g = (groupId: string, nodeIds: string[], name = groupId) => ({ groupId, name, color: 0, nodeIds });
  it('merges groups by id and drops members that are gone, and empty groups', () => {
    const base = state({ ...BASE, groups: [g('g1', ['a', 'b'])] });
    const mine = state({ ...base, nodes: [node('a'), node('c', 200)], edges: [], groups: [g('g1', ['a'])] });
    const theirs = state({ ...base, groups: [g('g1', ['a', 'b'], 'Renamed'), g('g2', ['c'])] });
    const r = mergeGraphs(base, mine, theirs);
    expect(r.graph.groups.map((x) => [x.groupId, x.nodeIds])).toEqual([['g1', ['a']], ['g2', ['c']]]);
  });

  it('a node stays in the first group that holds it', () => {
    const base = state({ ...BASE, groups: [g('g1', ['a']), g('g2', ['b'])] });
    const mine = state({ ...base, groups: [g('g1', ['a', 'b']), g('g2', ['b'])] });
    const r = mergeGraphs(base, mine, base);
    expect(r.graph.groups.find((x) => x.groupId === 'g2')).toBeUndefined();
  });
});
