import { describe, expect, it } from 'vitest';
import { catalogFromBlocks } from '../catalog';
import {
  changeEdgePort, connect, connectProblem, edgeSourcePorts, insertOnEdge, MOVE_STEP, moveNodes, newNode, nodesBounds, pruneEdges, removeEdge, removeNodes,
  placeNodes, rewireEdge, snapPos, toggleDisabled, updateNode,
} from './edit';
import type { Graph, GraphEdge, GraphNode } from './types';

const catalog = catalogFromBlocks([[
  { type: 'trigger.boot' },
  { type: 'cond.compare' },
  { type: 'action.log', params: { text: { type: 'string', default: 'hello' }, level: { type: 'enum', options: ['info', 'warn'], default: 'info' } } },
  { type: 'logic.script', outputs: { count: 'outputs', prefix: 'o', max: 4 }, params: { code: { type: 'code', store: 'script', default: 'return msg;' }, outputs: { type: 'number', default: 1 } } },
]]);

const node = (nodeId: string, type: string, x = 0, y = 0, extra: Partial<GraphNode> = {}): GraphNode => ({ nodeId, type, label: nodeId, x, y, ...extra });
const edge = (edgeId: string, from: string, port: string, to: string): GraphEdge => ({ edgeId, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });
const graph = (nodes: GraphNode[], edges: GraphEdge[] = [], groups: Graph['groups'] = []): Graph => ({ nodes, edges, groups });
const SIZE = { width: 160, headerHeight: 36 };

describe('snapping', () => {
  it('rounds to the 4 px raster', () => {
    expect(MOVE_STEP).toBe(4);
    expect([0, 1, 2, 3, 5, 6, 10, -1, -3].map(snapPos)).toEqual([0, 0, 4, 4, 4, 8, 12, -0, -4]);
  });
});

describe('newNode', () => {
  it('is centred on the point, titled and filled with the defaults of its block', () => {
    const n = newNode(catalog, 'action.log', { x: 200, y: 100 }, [], SIZE);
    expect(n).toEqual({ nodeId: 'n1', type: 'action.log', label: 'action.log', x: 120, y: 84, config: { text: 'hello', level: 'info' } });
  });
  it('puts the default of a script param into the script field', () => {
    const n = newNode(catalog, 'logic.script', { x: 0, y: 0 }, [node('n1', 'trigger.boot')], SIZE);
    expect(n).toMatchObject({ nodeId: 'n2', script: 'return msg;', config: { outputs: 1 } });
    expect(n.config).not.toHaveProperty('code');
  });
  it('makes a bare node for a type the catalog lacks', () => {
    const n = newNode(catalog, 'who.knows', { x: 80, y: 18 }, [], SIZE);
    expect(n).toEqual({ nodeId: 'n1', type: 'who.knows', label: 'who.knows', x: 0, y: 0 });
  });
  it('uses the title of a block as the label', () => {
    const titled = catalogFromBlocks([[{ type: 'action.x', title: 'Do X' }]]);
    expect(newNode(titled, 'action.x', { x: 0, y: 0 }, [], SIZE).label).toBe('Do X');
  });
});

describe('removing', () => {
  const g = graph(
    [node('a', 'trigger.boot'), node('b', 'cond.compare'), node('c', 'action.log')],
    [edge('e1', 'a', 'out', 'b'), edge('e2', 'b', 'yes', 'c')],
    [{ groupId: 'g1', name: 'ab', color: 0, nodeIds: ['a', 'b'] }, { groupId: 'g2', name: 'c', color: 1, nodeIds: ['c'] }],
  );
  it('removes nodes with their connections, and prunes groups', () => {
    const next = removeNodes(g, ['b', 'c']);
    expect(next.nodes.map((n) => n.nodeId)).toEqual(['a']);
    expect(next.edges).toEqual([]);
    expect(next.groups).toEqual([{ groupId: 'g1', name: 'ab', color: 0, nodeIds: ['a'] }]);
  });
  it('removes a connection', () => {
    expect(removeEdge(g, 'e1').edges.map((e) => e.edgeId)).toEqual(['e2']);
  });
  it('does not change the graph it was given', () => {
    removeNodes(g, ['a']);
    expect(g.nodes).toHaveLength(3);
  });
});

describe('moveNodes', () => {
  it('moves the nodes with a start position and snaps the result', () => {
    const g = graph([node('a', 'trigger.boot', 10, 10), node('b', 'trigger.boot', 50, 50), node('c', 'trigger.boot', 0, 0)]);
    const next = moveNodes(g, { a: { x: 10, y: 10 }, b: { x: 50, y: 50 } }, 7, -3);
    expect(next.nodes.map((n) => [n.x, n.y])).toEqual([[16, 8], [56, 48], [0, 0]]);
  });
});

describe('connecting', () => {
  const g = graph([node('a', 'trigger.boot'), node('b', 'cond.compare'), node('c', 'logic.script', 0, 0, { config: { outputs: 2 } })], [edge('e1', 'a', 'out', 'b')]);
  it('allows a free connection', () => {
    expect(connectProblem(g, catalog, 'b', 'yes', 'c')).toBeNull();
    const next = connect(g, catalog, 'b', 'yes', 'c')!;
    expect(next.edges.map((e) => [e.edgeId, e.sourceNodeId, e.sourcePort, e.targetNodeId, e.targetPort])).toEqual([['e1', 'a', 'out', 'b', 'in'], ['e2', 'b', 'yes', 'c', 'in']]);
  });
  it('names why it refuses', () => {
    expect(connectProblem(g, catalog, 'b', 'yes', 'b')).toBe('self');
    expect(connectProblem(g, catalog, 'zz', 'out', 'b')).toBe('no_source');
    expect(connectProblem(g, catalog, 'a', 'out', 'zz')).toBe('no_target');
    expect(connectProblem(g, catalog, 'a', 'nope', 'b')).toBe('no_output');
    expect(connectProblem(g, catalog, 'b', 'yes', 'a')).toBe('no_input');
    expect(connectProblem(g, catalog, 'a', 'out', 'b')).toBe('duplicate');
    expect(connect(g, catalog, 'a', 'out', 'b')).toBeNull();
  });
  it('lets a block send from its error port and from generated ports', () => {
    expect(connectProblem(g, catalog, 'b', 'error', 'c')).toBeNull();
    expect(connectProblem(g, catalog, 'c', 'o1', 'b')).toBeNull();
    expect(connectProblem(g, catalog, 'c', 'o2', 'b')).toBe('no_output');
  });
});

describe('insertOnEdge', () => {
  const g = graph([node('a', 'trigger.boot'), node('b', 'action.log')], [edge('e1', 'a', 'out', 'b')]);
  it('replaces a connection by two with the new node in between', () => {
    const mid = node('m', 'cond.compare');
    const next = insertOnEdge(g, catalog, 'e1', mid)!;
    expect(next.nodes.map((n) => n.nodeId)).toEqual(['a', 'b', 'm']);
    expect(next.edges.map((e) => [e.sourceNodeId, e.sourcePort, e.targetNodeId])).toEqual([['a', 'out', 'm'], ['m', 'yes', 'b']]);
  });
  it('wires only the input when the node has no output', () => {
    const sink = catalogFromBlocks([[{ type: 'trigger.boot' }, { type: 'action.log' }, { type: 'action.end', outputs: [] }]]);
    const next = insertOnEdge(g, sink, 'e1', node('m', 'action.end'))!;
    expect(next.edges.map((e) => [e.sourceNodeId, e.targetNodeId])).toEqual([['a', 'm']]);
  });
  it('refuses an unknown connection or a node without an input', () => {
    expect(insertOnEdge(g, catalog, 'nope', node('m', 'cond.compare'))).toBeNull();
    expect(insertOnEdge(g, catalog, 'e1', node('m', 'trigger.boot'))).toBeNull();
  });
});

describe('pruneEdges and updateNode', () => {
  it('drops connections from ports a node no longer has', () => {
    const g = graph(
      [node('c', 'logic.script', 0, 0, { config: { outputs: 3 } }), node('t', 'action.log')],
      [edge('e1', 'c', 'o0', 't'), edge('e2', 'c', 'o2', 't'), edge('e3', 'c', 'error', 't')],
    );
    const smaller = updateNode(g, 'c', { config: { outputs: 1 } });
    expect(pruneEdges(smaller, catalog).edges.map((e) => e.edgeId)).toEqual(['e1', 'e3']);
    expect(pruneEdges(g, catalog)).toBe(g);
  });
  it('drops connections from a node that is gone', () => {
    const g = graph([node('t', 'action.log')], [edge('e1', 'x', 'out', 't')]);
    expect(pruneEdges(g, catalog).edges).toEqual([]);
  });
  it('patches one node', () => {
    const g = graph([node('a', 'trigger.boot'), node('b', 'trigger.boot')]);
    expect(updateNode(g, 'b', { label: 'B!' }).nodes.map((n) => n.label)).toEqual(['a', 'B!']);
  });
});

describe('toggleDisabled', () => {
  const g = graph([node('a', 'trigger.boot'), node('b', 'trigger.boot', 0, 0, { disabled: true }), node('c', 'trigger.boot')]);
  it('skips nodes, or wakes them when all are skipped', () => {
    const off = toggleDisabled(g, ['a', 'b']);
    expect(off.nodes.map((n) => !!n.disabled)).toEqual([true, true, false]);
    const on = toggleDisabled(off, ['a', 'b']);
    expect(on.nodes.map((n) => n.disabled)).toEqual([undefined, undefined, undefined]);
    expect(on.nodes[0]).not.toHaveProperty('disabled');
  });
});

describe('nodesBounds', () => {
  it('boxes nodes with their width and height', () => {
    expect(nodesBounds([{ x: 10, y: 20 }, { x: 100, y: 50 }], 160, () => 80)).toEqual({ x0: 10, y0: 20, x1: 260, y1: 130 });
    expect(nodesBounds([], 160, () => 80)).toBeNull();
  });
});

describe('placeNodes', () => {
  it('puts nodes at exact positions, without rounding', () => {
    const g = graph([node('a', 'action.log', 0, 0), node('b', 'action.log', 5, 5)]);
    const out = placeNodes(g, { a: { x: 13, y: 7 }, ghost: { x: 1, y: 1 } });
    expect(out.nodes.map((n) => [n.x, n.y])).toEqual([[13, 7], [5, 5]]);
    expect(out.nodes[1]).toBe(g.nodes[1]);
  });
  it('returns the same graph when nothing moves', () => {
    const g = graph([node('a', 'action.log', 3, 4)]);
    expect(placeNodes(g, { a: { x: 3, y: 4 } })).toBe(g);
  });
});

describe('changing the port of a connection', () => {
  const cat = catalogFromBlocks([[{ type: 'cond.test', outputs: ['yes', 'no'] }, { type: 'action.log' }, { type: 'trigger.boot' }]]);
  const n = (id: string, type: string) => ({ nodeId: id, type, label: id, x: 0, y: 0 });
  const e = (id: string, from: string, port: string, to: string) => ({ edgeId: id, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });
  const g = { nodes: [n('c', 'cond.test'), n('a', 'action.log'), n('b', 'action.log')], edges: [e('e1', 'c', 'yes', 'a'), e('e2', 'c', 'no', 'b'), e('e3', 'c', 'no', 'a')], groups: [] };

  it('lists the outputs of the source with the current one and the taken ones', () => {
    expect(edgeSourcePorts(g, cat, 'e1').map((p) => [p.id, p.current, p.taken])).toEqual([['yes', true, false], ['no', false, true], ['error', false, false]]);
    expect(edgeSourcePorts(g, cat, 'e2').map((p) => [p.id, p.current, p.taken])).toEqual([['yes', false, false], ['no', true, false], ['error', false, false]]);
    expect(edgeSourcePorts(g, cat, 'missing')).toEqual([]);
  });
  it('moves the source end to another output, keeping the rest', () => {
    const next = changeEdgePort(g, cat, 'e2', 'yes')!;
    expect(next.edges.find((x) => x.edgeId === 'e2')).toEqual(e('e2', 'c', 'yes', 'b'));
    expect(next.edges).toHaveLength(3);
    expect(changeEdgePort(g, cat, 'e1', 'error')!.edges[0].sourcePort).toBe('error');
  });
  it('refuses the same port, a taken one and one that does not exist', () => {
    expect(changeEdgePort(g, cat, 'e1', 'yes')).toBeNull();
    expect(changeEdgePort(g, cat, 'e1', 'no')).toBeNull();
    expect(changeEdgePort(g, cat, 'e1', 'nope')).toBeNull();
    expect(changeEdgePort(g, cat, 'zz', 'yes')).toBeNull();
  });
});

describe('dragging an end of a connection (UI-31)', () => {
  const cat = catalogFromBlocks([[{ type: 'cond.test', outputs: ['yes', 'no'] }, { type: 'action.log' }, { type: 'trigger.boot' }]]);
  const n = (id: string, type: string) => ({ nodeId: id, type, label: id, x: 0, y: 0 });
  const e = (id: string, from: string, port: string, to: string) => ({ edgeId: id, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });
  const g = { nodes: [n('t', 'trigger.boot'), n('c', 'cond.test'), n('a', 'action.log'), n('b', 'action.log')], edges: [e('e1', 'c', 'yes', 'a'), e('e2', 'c', 'no', 'b')], groups: [] };

  it('moves the target end to another block, keeping the id and the source', () => {
    const next = rewireEdge(g, cat, 'e1', 'target', 'b')!;
    expect(next.edges[0]).toEqual(e('e1', 'c', 'yes', 'b'));
    expect(next.edges).toHaveLength(2);
  });
  it('moves the source end to another block or port; a block without the port gives its first output', () => {
    expect(rewireEdge(g, cat, 'e1', 'source', 'c', 'no')!.edges[0]).toEqual(e('e1', 'c', 'no', 'a'));
    expect(rewireEdge(g, cat, 'e1', 'source', 't')!.edges[0]).toEqual(e('e1', 't', 'out', 'a'));
  });
  it('refuses what a new connection would refuse, and a drop on the same place', () => {
    expect(rewireEdge(g, cat, 'e1', 'target', 'c')).toBeNull(); // to itself
    expect(rewireEdge(g, cat, 'e1', 'target', 't')).toBeNull(); // a trigger has no input
    expect(rewireEdge(g, cat, 'e1', 'target', 'a')).toBeNull(); // nothing changes
    expect(rewireEdge({ ...g, edges: [...g.edges, e('e3', 'c', 'yes', 'b')] }, cat, 'e1', 'target', 'b')).toBeNull(); // duplicate
    expect(rewireEdge(g, cat, 'e1', 'source', 'a', 'nope')).toBeNull();
    expect(rewireEdge(g, cat, 'zz', 'target', 'b')).toBeNull();
    expect(rewireEdge(g, cat, 'e1', 'target', 'ghost')).toBeNull();
  });
});
