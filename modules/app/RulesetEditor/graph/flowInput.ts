import type { Catalog } from '../catalog/types';
import { newNodeId } from './ids';
import { FLOW_INPUT, type Graph, type GraphEdge, type GraphNode } from './types';

/**
 * The `trigger.flow_input` block is a fixed node of every flow: a flow always has exactly one, it cannot be deleted,
 * cut, copied or duplicated, and it does not matter whether it is wired. Pure helpers; the editor applies them when a
 * graph is loaded or replaced and in every delete, cut, copy, duplicate and paste.
 */

/** node id of a flow input that `ensureFlowInput` adds (a free variant when it is taken) */
export const FLOW_INPUT_ID = 'flow_input';

/** how far left of the leftmost node a new flow input goes (a node is 160 px wide, plus a gap) */
const FLOW_INPUT_OFFSET = 232;
/** the 4 px raster of node positions (`snapPos` of edit.ts, which imports this file) */
const snap = (value: number) => Math.round(value / 4) * 4;

export function isFlowInput(node: Pick<GraphNode, 'type'> | null | undefined): boolean {
  return node?.type === FLOW_INPUT;
}

/** the id of the fixed flow input: the first `trigger.flow_input` node of the list, or null */
export function fixedFlowInputId(nodes: readonly Pick<GraphNode, 'nodeId' | 'type'>[]): string | null {
  return nodes.find((n) => n.type === FLOW_INPUT)?.nodeId ?? null;
}

/** `ids` without the fixed flow input: what a delete may remove (an extra flow input of an imported graph can go) */
export function deletableIds(nodes: readonly Pick<GraphNode, 'nodeId' | 'type'>[], ids: Iterable<string>): string[] {
  const fixed = fixedFlowInputId(nodes);
  return [...ids].filter((id) => id !== fixed);
}

/** `ids` without any flow input: what cut, copy and duplicate may take */
export function copyableIds(nodes: readonly Pick<GraphNode, 'nodeId' | 'type'>[], ids: Iterable<string>): string[] {
  const inputs = new Set(nodes.filter((n) => n.type === FLOW_INPUT).map((n) => n.nodeId));
  return [...ids].filter((id) => !inputs.has(id));
}

/**
 * The graph with its flow input: when no `trigger.flow_input` node exists one is added (id `flow_input` or a free
 * variant, the title of the block as label, empty config, to the left of the leftmost node). The same graph object
 * comes back when a flow input exists already (the first stays, extras are left to validation) and when the catalog
 * has no `trigger.flow_input` block (a host without it is unaffected).
 */
export function ensureFlowInput<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, catalog: Pick<Catalog, 'blocks'> | undefined): Graph<N, E> {
  const decl = catalog?.blocks[FLOW_INPUT];
  if (!decl || graph.nodes.some((n) => n.type === FLOW_INPUT)) return graph;
  const taken = new Set(graph.nodes.map((n) => n.nodeId));
  const nodeId = taken.has(FLOW_INPUT_ID) ? newNodeId(graph.nodes, FLOW_INPUT_ID + '_') : FLOW_INPUT_ID;
  let x = 0, y = 0;
  if (graph.nodes.length) {
    const leftmost = graph.nodes.reduce((a, b) => (b.x < a.x ? b : a));
    x = snap(leftmost.x - FLOW_INPUT_OFFSET);
    y = snap(leftmost.y);
  }
  const node = { nodeId, type: FLOW_INPUT, label: decl.title, ...(decl.version !== undefined ? { v: decl.version } : {}), x, y, config: {} } as GraphNode as N;
  return { ...graph, nodes: [node, ...graph.nodes] };
}
