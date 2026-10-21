import type { RuleEdge, RuleGroup, RuleNode } from '../types';
import { diffFlows, edgeKey, type DiffItem, type DiffNode, type FlowDiff } from './diff';

/**
 * A diff drawn on the canvas: the tint of each added, changed or removed block and connection (`RulesetEditor`
 * `diffTint`), and the one graph that shows both versions at once (`diffView`). Pure.
 */
export type DiffTint = 'added' | 'changed' | 'removed';

export type CanvasDiffTint = {
  /** by node id */
  nodes: Record<string, DiffTint>;
  /** by `edgeKey(source node, source port, target node)` */
  edges?: Record<string, DiffTint>;
};

/** The tints of a diff. A node that was only moved is not tinted. */
export function diffTints(d: FlowDiff): CanvasDiffTint {
  const nodes: Record<string, DiffTint> = {};
  for (const n of d.nodes.added) nodes[n.id] = 'added';
  for (const n of d.nodes.changed) nodes[n.id] = 'changed';
  for (const n of d.nodes.removed) nodes[n.id] = 'removed';
  const edges: Record<string, DiffTint> = {};
  for (const e of d.edges.added) edges[e.key] = 'added';
  for (const e of d.edges.removed) edges[e.key] = 'removed';
  return { nodes, edges };
}

/** the tint of one canvas connection */
export function edgeTintOf(tint: CanvasDiffTint | undefined, edge: Pick<RuleEdge, 'sourceNodeId' | 'sourcePort' | 'targetNodeId'>): DiffTint | undefined {
  return tint?.edges?.[edgeKey(edge.sourceNodeId, edge.sourcePort, edge.targetNodeId)];
}

type GraphLike = { nodes: readonly RuleNode[]; edges: readonly RuleEdge[]; groups?: readonly RuleGroup[] };

/** An editor graph in the shape the diff reads: `nodeId` → `id`, `label` → `name`, `config` (and `script`) → `params`. */
export function graphDiffItem(graph: GraphLike): DiffItem {
  const nodes: DiffNode[] = graph.nodes.map((n) => ({
    id: n.nodeId, type: n.type, name: n.label, x: n.x, y: n.y,
    params: { ...(n.config ?? {}), ...(n.script !== undefined ? { script: n.script } : {}) },
    ...(n.disabled ? { disabled: true } : {}),
    ...(n.v !== undefined ? { v: n.v } : {}),
  }));
  const edges = graph.edges.map((e) => ({ from: e.sourceNodeId, from_port: e.sourcePort, to: e.targetNodeId }));
  const groups = (graph.groups ?? []).map((g) => ({ id: g.groupId, name: g.name, color: g.color, nodes: [...g.nodeIds].sort() }));
  return { nodes, edges, groups };
}

/** Diff two editor graphs (`before` null: everything is new). */
export function diffGraphs(before: GraphLike | null | undefined, after: GraphLike): FlowDiff {
  return diffFlows(before ? graphDiffItem(before) : null, graphDiffItem(after));
}

export type DiffView = { nodes: RuleNode[]; edges: RuleEdge[]; groups: RuleGroup[]; tint: CanvasDiffTint; diff: FlowDiff };

/**
 * One graph that shows a change: the `after` graph plus the blocks and connections only `before` had, at their old
 * places, with the tints. Show it in a read-only editor (`readOnly`, `diffTint={view.tint}`).
 */
export function diffView(before: GraphLike | null | undefined, after: GraphLike): DiffView {
  const diff = diffGraphs(before, after);
  const tint = diffTints(diff);
  const removed = new Set(diff.nodes.removed.map((n) => n.id));
  const nodes = [...after.nodes, ...(before?.nodes ?? []).filter((n) => removed.has(n.nodeId))];
  const ids = new Set(nodes.map((n) => n.nodeId));
  const edgeIds = new Set(after.edges.map((e) => e.edgeId));
  const goneEdges = (before?.edges ?? [])
    .filter((e) => edgeTintOf(tint, e) === 'removed' && ids.has(e.sourceNodeId) && ids.has(e.targetNodeId))
    .map((e) => {
      let edgeId = `removed-${e.edgeId}`;
      for (let i = 2; edgeIds.has(edgeId); i++) edgeId = `removed-${e.edgeId}-${i}`;
      edgeIds.add(edgeId);
      return { ...e, edgeId };
    });
  return { nodes, edges: [...after.edges, ...goneEdges], groups: [...(after.groups ?? [])], tint, diff };
}
