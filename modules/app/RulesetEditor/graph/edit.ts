import { defaultParams } from '../catalog/params';
import { nodePortsOf } from '../catalog/ports';
import type { Catalog } from '../catalog/types';
import { newEdgeId, newNodeId } from './ids';
import { pruneGroups } from './groups';
import type { Graph, GraphEdge, GraphNode, RuleGroup } from './types';

/** nodes are placed on a 4 px raster */
export const MOVE_STEP = 4;

export function snapPos(value: number): number {
  return Math.round(value / MOVE_STEP) * MOVE_STEP;
}

export type Point = { x: number; y: number };

/**
 * A new node of a block, centred on a point. The label is the title of the block, the params are the
 * defaults, and a param the block stores in the script field starts with its default there.
 */
export function newNode(catalog: Catalog, type: string, at: Point, existing: Pick<GraphNode, 'nodeId'>[], size: { width: number; headerHeight: number }): GraphNode {
  const decl = catalog.blocks[type];
  const scriptSpec = Object.values(decl?.params ?? {}).find((spec) => spec.store === 'script');
  const script = scriptSpec && typeof scriptSpec.default === 'string' ? scriptSpec.default : undefined;
  return {
    nodeId: newNodeId(existing),
    type,
    label: decl?.title ?? type,
    ...(decl?.version !== undefined ? { v: decl.version } : {}),
    x: snapPos(at.x - size.width / 2),
    y: snapPos(at.y - size.headerHeight / 2),
    ...(decl ? { config: defaultParams(decl) } : {}),
    ...(script !== undefined ? { script } : {}),
  };
}

/** Remove nodes with every connection that touches them; groups lose the members and the empty ones go. */
export function removeNodes<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, ids: Iterable<string>): Graph<N, E> {
  const gone = new Set(ids);
  const nodes = graph.nodes.filter((n) => !gone.has(n.nodeId));
  return {
    nodes,
    edges: graph.edges.filter((e) => !gone.has(e.sourceNodeId) && !gone.has(e.targetNodeId)),
    groups: pruneGroups(graph.groups, nodes),
  } as Graph<N, E>;
}

export function removeEdge<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, edgeId: string): Graph<N, E> {
  return { ...graph, edges: graph.edges.filter((e) => e.edgeId !== edgeId) };
}

/** Move nodes from their start positions by a distance; the result is snapped to the raster. */
export function moveNodes<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, starts: Record<string, Point>, dx: number, dy: number): Graph<N, E> {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const start = starts[n.nodeId];
      return start ? { ...n, x: snapPos(start.x + dx), y: snapPos(start.y + dy) } : n;
    }),
  };
}

/** Put nodes at exact positions (auto layout, snapped drags): no further rounding. Unknown ids are ignored. */
export function placeNodes<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, positions: Record<string, Point>): Graph<N, E> {
  let changed = false;
  const nodes = graph.nodes.map((n) => {
    const p = positions[n.nodeId];
    if (!p || (p.x === n.x && p.y === n.y)) return n;
    changed = true;
    return { ...n, x: p.x, y: p.y };
  });
  return changed ? { ...graph, nodes } : graph;
}

/** Why a connection is refused, or null when it is allowed: no self-connection, the target needs an input, no duplicates. */
export function connectProblem(graph: Pick<Graph, 'nodes' | 'edges'>, catalog: Catalog, from: string, fromPort: string, to: string, toPort = 'in'): 'self' | 'no_source' | 'no_target' | 'no_output' | 'no_input' | 'duplicate' | null {
  if (from === to) return 'self';
  const source = graph.nodes.find((n) => n.nodeId === from);
  const target = graph.nodes.find((n) => n.nodeId === to);
  if (!source) return 'no_source';
  if (!target) return 'no_target';
  if (!nodePortsOf(catalog, source).outputs.some((p) => p.id === fromPort)) return 'no_output';
  if (!nodePortsOf(catalog, target).inputs.some((p) => p.id === toPort)) return 'no_input';
  if (graph.edges.some((e) => e.sourceNodeId === from && e.sourcePort === fromPort && e.targetNodeId === to)) return 'duplicate';
  return null;
}

/** Add a connection; null when it is not allowed. */
export function connect<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, catalog: Catalog, from: string, fromPort: string, to: string, toPort = 'in'): Graph<N, E> | null {
  if (connectProblem(graph, catalog, from, fromPort, to, toPort)) return null;
  const edge = { edgeId: newEdgeId(graph.edges), sourceNodeId: from, sourcePort: fromPort, targetNodeId: to, targetPort: toPort } as E;
  return { ...graph, edges: [...graph.edges, edge] };
}

/** The outputs the source of a connection could leave from instead, with whether each is taken (it is the one it uses now, or the same node already has such a connection to the same target). */
export function edgeSourcePorts(graph: Pick<Graph, 'nodes' | 'edges'>, catalog: Catalog, edgeId: string): { id: string; label: string; current: boolean; taken: boolean }[] {
  const edge = graph.edges.find((e) => e.edgeId === edgeId);
  const source = edge && graph.nodes.find((n) => n.nodeId === edge.sourceNodeId);
  if (!edge || !source) return [];
  return nodePortsOf(catalog, source).outputs.map((p) => ({
    id: p.id, label: p.label, current: p.id === edge.sourcePort,
    taken: p.id !== edge.sourcePort && graph.edges.some((e) => e.edgeId !== edgeId && e.sourceNodeId === edge.sourceNodeId && e.sourcePort === p.id && e.targetNodeId === edge.targetNodeId && e.targetPort === edge.targetPort),
  }));
}

/** Move the source end of a connection to another output of the same block; null when the port does not exist, is the same, or the block already has that connection to the target. */
export function changeEdgePort<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, catalog: Catalog, edgeId: string, port: string): Graph<N, E> | null {
  const ports = edgeSourcePorts(graph, catalog, edgeId);
  const to = ports.find((p) => p.id === port);
  if (!to || to.current || to.taken) return null;
  return { ...graph, edges: graph.edges.map((e) => (e.edgeId === edgeId ? { ...e, sourcePort: port } : e)) };
}

/**
 * Move one end of a connection (UI-31, dragging its end): `end: 'target'` takes it to another input (`port`, or the first
 * input of `nodeId`), `end: 'source'` to another output (`port`, or the port it leaves now when the new block has it, else
 * its first output that is not the error path). The connection keeps its id, so it stays selected. The same rules as a new
 * connection apply (`connectProblem`, with this connection taken out first). Null when it is refused or nothing changes.
 */
export function rewireEdge<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, catalog: Catalog, edgeId: string, end: 'source' | 'target', nodeId: string, port?: string): Graph<N, E> | null {
  const edge = graph.edges.find((e) => e.edgeId === edgeId);
  const node = graph.nodes.find((n) => n.nodeId === nodeId);
  if (!edge || !node) return null;
  const ports = nodePortsOf(catalog, node);
  const rest = { nodes: graph.nodes, edges: graph.edges.filter((e) => e.edgeId !== edgeId) };
  let next: E;
  if (end === 'target') {
    const toPort = port ?? ports.inputs[0]?.id;
    if (!toPort) return null;
    if (nodeId === edge.targetNodeId && toPort === edge.targetPort) return null;
    if (connectProblem(rest, catalog, edge.sourceNodeId, edge.sourcePort, nodeId, toPort)) return null;
    next = { ...edge, targetNodeId: nodeId, targetPort: toPort };
  } else {
    const fromPort = port ?? (ports.outputs.some((p) => p.id === edge.sourcePort) ? edge.sourcePort : ports.outputs.find((p) => p.id !== 'error')?.id);
    if (!fromPort) return null;
    if (nodeId === edge.sourceNodeId && fromPort === edge.sourcePort) return null;
    if (connectProblem(rest, catalog, nodeId, fromPort, edge.targetNodeId, edge.targetPort)) return null;
    next = { ...edge, sourceNodeId: nodeId, sourcePort: fromPort };
  }
  return { ...graph, edges: graph.edges.map((e) => (e.edgeId === edgeId ? next : e)) };
}

/**
 * Put a new node in the middle of a connection: the connection is replaced by one into the node and,
 * when the node has an output, one from its first output to the old target. Null for an unknown connection.
 */
export function insertOnEdge<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, catalog: Catalog, edgeId: string, node: N): Graph<N, E> | null {
  const edge = graph.edges.find((e) => e.edgeId === edgeId);
  if (!edge) return null;
  const ports = nodePortsOf(catalog, node);
  if (!ports.inputs.length) return null;
  let next: Graph<N, E> = { ...graph, nodes: [...graph.nodes, node], edges: graph.edges.filter((e) => e.edgeId !== edgeId) };
  const first = connect(next, catalog, edge.sourceNodeId, edge.sourcePort, node.nodeId, ports.inputs[0].id);
  if (!first) return null;
  next = first;
  const out = ports.outputs.find((p) => p.id !== 'error');
  if (out) next = connect(next, catalog, node.nodeId, out.id, edge.targetNodeId, edge.targetPort) ?? next;
  return next;
}

/** After params changed: drop the connections that leave a port the node no longer has. */
export function pruneEdges<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, catalog: Catalog): Graph<N, E> {
  const byId = new Map(graph.nodes.map((n) => [n.nodeId, n]));
  const edges = graph.edges.filter((e) => {
    const source = byId.get(e.sourceNodeId);
    return !!source && nodePortsOf(catalog, source).outputs.some((p) => p.id === e.sourcePort);
  });
  return edges.length === graph.edges.length ? graph : { ...graph, edges };
}

export function updateNode<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, nodeId: string, patch: Partial<GraphNode>): Graph<N, E> {
  return { ...graph, nodes: graph.nodes.map((n) => (n.nodeId === nodeId ? { ...n, ...patch } : n)) };
}

/** Skip or wake nodes: a disabled node stops messages but keeps its wires. If any is enabled, all are disabled. */
export function toggleDisabled<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, ids: Iterable<string>): Graph<N, E> {
  const set = new Set(ids);
  const disable = graph.nodes.some((n) => set.has(n.nodeId) && !n.disabled);
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (!set.has(n.nodeId)) return n;
      const { disabled: _drop, ...rest } = n;
      void _drop;
      return (disable ? { ...rest, disabled: true } : rest) as N;
    }),
  };
}

/** Bounding box of nodes, for "fit" and for paste placement. */
export function nodesBounds(nodes: Pick<GraphNode, 'x' | 'y'>[], width: number, height: (n: Pick<GraphNode, 'x' | 'y'>) => number): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!nodes.length) return null;
  return {
    x0: Math.min(...nodes.map((n) => n.x)),
    y0: Math.min(...nodes.map((n) => n.y)),
    x1: Math.max(...nodes.map((n) => n.x + width)),
    y1: Math.max(...nodes.map((n) => n.y + height(n))),
  };
}

export type { RuleGroup };
