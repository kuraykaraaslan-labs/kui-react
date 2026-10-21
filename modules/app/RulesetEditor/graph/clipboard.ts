import { copyableIds } from './flowInput';
import { clone, newEdgeId, newNodeId } from './ids';
import type { Graph, GraphEdge, GraphNode } from './types';
import type { Point } from './edit';
import { snapPos } from './edit';
import { scrubNode, secretByName, type SecretTest } from './scrub';
import { FLOW_INPUT } from './types';

export const CLIPBOARD_FORMAT = 'kui-ruleset-clip';

export type ClipPayload = { format: typeof CLIPBOARD_FORMAT; nodes: GraphNode[]; edges: GraphEdge[] };

/**
 * Copy the selected nodes and the connections between them. Null when nothing is selected. A flow input is never
 * copied (every flow has its own fixed one). Secret values are left
 * out (`secretTest` tells which keys are secrets; the default goes by key name), so a clip never carries them.
 */
export function copySelection(graph: Pick<Graph, 'nodes' | 'edges'>, ids: Iterable<string>, secretTest: SecretTest = secretByName): ClipPayload | null {
  const set = new Set(copyableIds(graph.nodes, ids));
  const nodes = graph.nodes.filter((n) => set.has(n.nodeId));
  if (!nodes.length) return null;
  const edges = graph.edges.filter((e) => set.has(e.sourceNodeId) && set.has(e.targetNodeId));
  return { format: CLIPBOARD_FORMAT, nodes: clone(nodes).map((n) => scrubNode(n, secretTest)), edges: clone(edges) };
}

export function serializeClip(clip: ClipPayload): string {
  return JSON.stringify(clip);
}

/** Read clipboard text; null when it is not a clip of this editor. */
export function parseClip(text: string | null | undefined): ClipPayload | null {
  if (!text) return null;
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  if (typeof data !== 'object' || data === null) return null;
  const clip = data as Partial<ClipPayload>;
  if (clip.format !== CLIPBOARD_FORMAT || !Array.isArray(clip.nodes) || !Array.isArray(clip.edges)) return null;
  const nodes = clip.nodes.filter((n): n is GraphNode => typeof n === 'object' && n !== null && typeof n.nodeId === 'string' && typeof n.type === 'string');
  if (!nodes.length) return null;
  return { format: CLIPBOARD_FORMAT, nodes, edges: clip.edges.filter((e) => typeof e === 'object' && e !== null) };
}

function place<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, clip: ClipPayload, dx: number, dy: number): { graph: Graph<N, E>; ids: string[] } {
  const nodes: N[] = [...graph.nodes];
  const idMap = new Map<string, string>();
  for (const source of clip.nodes) {
    if (source.type === FLOW_INPUT) continue; // a flow has one fixed flow input: a pasted one is dropped
    const nodeId = newNodeId(nodes);
    idMap.set(source.nodeId, nodeId);
    nodes.push({ ...clone(source), nodeId, x: snapPos(source.x + dx), y: snapPos(source.y + dy) } as N);
  }
  const edges: E[] = [...graph.edges];
  for (const source of clip.edges) {
    const from = idMap.get(source.sourceNodeId);
    const to = idMap.get(source.targetNodeId);
    if (!from || !to) continue;
    edges.push({ ...clone(source), edgeId: newEdgeId(edges), sourceNodeId: from, targetNodeId: to } as E);
  }
  return { graph: { ...graph, nodes, edges }, ids: [...idMap.values()] };
}

/**
 * Paste a clip: nodes get new ids, keep their relative positions and are centred on a point;
 * connections are remapped. Groups are not copied. Returns the new graph and the ids of the new nodes.
 */
export function pasteClip<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, clip: ClipPayload, center: Point, nodeWidth: number): { graph: Graph<N, E>; ids: string[] } {
  const x0 = Math.min(...clip.nodes.map((n) => n.x));
  const x1 = Math.max(...clip.nodes.map((n) => n.x + nodeWidth));
  const y0 = Math.min(...clip.nodes.map((n) => n.y));
  const y1 = Math.max(...clip.nodes.map((n) => n.y));
  return place(graph, clip, center.x - (x0 + x1) / 2, center.y - (y0 + y1) / 2);
}

/** Duplicate nodes (with the connections between them) a little to the lower right. */
export function duplicateNodes<N extends GraphNode, E extends GraphEdge>(graph: Graph<N, E>, ids: Iterable<string>, offset: Point = { x: 32, y: 32 }, secretTest: SecretTest = secretByName): { graph: Graph<N, E>; ids: string[] } {
  const clip = copySelection(graph, ids, secretTest);
  return clip ? place(graph, clip, offset.x, offset.y) : { graph, ids: [] };
}
