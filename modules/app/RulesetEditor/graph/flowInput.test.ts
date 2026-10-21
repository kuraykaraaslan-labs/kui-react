import { describe, expect, it } from 'vitest';
import { BUILTIN_CATALOG, catalogFromBlocks, FLOW_BLOCKS } from '../catalog';
import { paletteGroups } from '../catalog/palette';
import { copySelection, duplicateNodes, parseClip, pasteClip, serializeClip, type ClipPayload } from './clipboard';
import { removeNodes } from './edit';
import { copyableIds, deletableIds, ensureFlowInput, fixedFlowInputId, isFlowInput } from './flowInput';
import type { Graph, GraphEdge, GraphNode } from './types';

const catalog = catalogFromBlocks([[{ type: 'action.log', title: 'Log' }], FLOW_BLOCKS]);
const node = (nodeId: string, type: string, x = 0, y = 0): GraphNode => ({ nodeId, type, label: nodeId, x, y });
const edge = (edgeId: string, from: string, to: string): GraphEdge => ({ edgeId, sourceNodeId: from, sourcePort: 'out', targetNodeId: to, targetPort: 'in' });
const graph = (nodes: GraphNode[], edges: GraphEdge[] = []): Graph => ({ nodes, edges, groups: [] });

describe('ensureFlowInput', () => {
  it('adds a flow input to the left of the leftmost node, labelled with the block title, with an empty config', () => {
    const g = graph([node('a', 'action.log', 300, 40), node('b', 'action.log', 100, 80)]);
    const out = ensureFlowInput(g, catalog);
    expect(out.nodes).toHaveLength(3);
    expect(out.nodes[0]).toMatchObject({ nodeId: 'flow_input', type: 'trigger.flow_input', label: 'Flow input', config: {}, y: 80 });
    expect(out.nodes[0].x).toBeLessThan(100);
    expect(Math.abs(out.nodes[0].x % 4)).toBe(0);
    expect(out.nodes.slice(1)).toEqual(g.nodes);
    expect(out.edges).toBe(g.edges);
    expect(g.nodes).toHaveLength(2);
  });
  it('puts one in an empty graph', () => {
    expect(ensureFlowInput(graph([]), catalog).nodes.map((n) => [n.nodeId, n.x, n.y])).toEqual([['flow_input', 0, 0]]);
  });
  it('takes a free id when flow_input is used by another block', () => {
    const out = ensureFlowInput(graph([node('flow_input', 'action.log', 0, 0)]), catalog);
    const added = out.nodes[0];
    expect(added.type).toBe('trigger.flow_input');
    expect(added.nodeId).not.toBe('flow_input');
    expect(new Set(out.nodes.map((n) => n.nodeId)).size).toBe(2);
  });
  it('returns the same graph when one exists, and keeps several as they are', () => {
    const one = graph([node('in', 'trigger.flow_input'), node('a', 'action.log')]);
    expect(ensureFlowInput(one, catalog)).toBe(one);
    const two = graph([node('in', 'trigger.flow_input'), node('in2', 'trigger.flow_input')]);
    expect(ensureFlowInput(two, catalog)).toBe(two);
  });
  it('does nothing when the catalog has no flow input block', () => {
    const g = graph([node('a', 'action.log')]);
    expect(ensureFlowInput(g, BUILTIN_CATALOG)).toBe(g);
    expect(ensureFlowInput(g, undefined)).toBe(g);
  });
});

describe('what may be deleted, copied and pasted', () => {
  const g = graph([node('in', 'trigger.flow_input'), node('a', 'action.log', 300), node('in2', 'trigger.flow_input', 0, 100)], [edge('e1', 'in', 'a')]);
  it('knows the fixed flow input: the first one', () => {
    expect(isFlowInput(g.nodes[0])).toBe(true);
    expect(isFlowInput(g.nodes[1])).toBe(false);
    expect(fixedFlowInputId(g.nodes)).toBe('in');
    expect(fixedFlowInputId([node('a', 'action.log')])).toBeNull();
  });
  it('lets a delete take everything but the fixed flow input (an extra one can go)', () => {
    expect(deletableIds(g.nodes, ['in', 'a', 'in2'])).toEqual(['a', 'in2']);
    const out = removeNodes(g, ['in', 'a', 'in2']);
    expect(out.nodes.map((n) => n.nodeId)).toEqual(['in']);
    expect(out.edges).toEqual([]);
    expect(removeNodes(g, ['in'])).toEqual(g);
  });
  it('keeps every flow input out of copy, cut and duplicate', () => {
    expect(copyableIds(g.nodes, ['in', 'a', 'in2'])).toEqual(['a']);
    expect(copySelection(g, ['in'])).toBeNull();
    const clip = copySelection(g, ['in', 'a', 'in2']);
    expect(clip?.nodes.map((n) => n.nodeId)).toEqual(['a']);
    expect(clip?.edges).toEqual([]);
    expect(duplicateNodes(g, ['in'])).toEqual({ graph: g, ids: [] });
    const dup = duplicateNodes(g, ['in', 'a']);
    expect(dup.graph.nodes.filter((n) => n.type === 'trigger.flow_input')).toHaveLength(2);
    expect(dup.ids).toHaveLength(1);
  });
  it('drops a flow input, with its connections, from a pasted clip', () => {
    const clip: ClipPayload = { format: 'kui-ruleset-clip', nodes: [node('x', 'trigger.flow_input'), node('y', 'action.log', 300)], edges: [edge('xe', 'x', 'y')] };
    const text = serializeClip(clip);
    const parsed = parseClip(text)!;
    const out = pasteClip(graph([node('in', 'trigger.flow_input')]), parsed, { x: 0, y: 0 }, 160);
    expect(out.graph.nodes.filter((n) => n.type === 'trigger.flow_input')).toHaveLength(1);
    expect(out.graph.nodes).toHaveLength(2);
    expect(out.graph.edges).toEqual([]);
    expect(out.ids).toHaveLength(1);
  });
});

describe('the palette', () => {
  it('never lists the flow input block, but lists the run flow block', () => {
    const types = paletteGroups(catalog).flatMap((grp) => grp.blocks.map((b) => b.type));
    expect(types).toContain('action.flow_run');
    expect(types).not.toContain('trigger.flow_input');
    expect(paletteGroups(catalog, 'flow input').flatMap((grp) => grp.blocks.map((b) => b.type))).not.toContain('trigger.flow_input');
  });
});
