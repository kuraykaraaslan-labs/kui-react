import { stable } from './history';
import { clone } from './ids';
import type { EditorState } from './state';
import type { GraphEdge, RuleGroup, GraphNode } from './types';

/**
 * Three-way merge of one flow (a chain with its groups): the flow as it was when it was
 * opened (`base`), as it is in the editor (`mine`) and as the host has it now (`theirs`).
 *
 * - A node or group only one side changed (or added, or deleted) is taken from that side.
 * - Changed on both sides in different ways: a conflict. It keeps the editor's version and is listed.
 * - Connections are a set, keyed by their ends: one removed or added by either side stays removed or added.
 *   A connection to a node that is gone goes with it.
 *
 * Pure: no DOM, no storage.
 */

export type MergeKind = 'node' | 'group';

export type MergeConflict = { kind: MergeKind; id: string; /** the editor's side deleted it */ deleted: boolean };

export type MergeTaken = { kind: MergeKind | 'edge'; id: string };

export type MergeResult = {
  graph: EditorState;
  /** changed on both sides; the editor's version was kept */
  conflicts: MergeConflict[];
  /** what was taken from the other side */
  fromTheirs: MergeTaken[];
};

const same = (a: unknown, b: unknown) => stable(a) === stable(b);

type Pick<T> = { value: T | undefined; from: 'both' | 'theirs' | 'mine'; conflict?: boolean };

function pick<T>(base: T | undefined, mine: T | undefined, theirs: T | undefined): Pick<T> {
  if (same(mine, theirs)) return { value: mine, from: 'both' };
  if (same(base, mine)) return { value: theirs, from: 'theirs' };
  if (same(base, theirs)) return { value: mine, from: 'mine' };
  return { value: mine, from: 'mine', conflict: true };
}

function index<T>(list: T[] | undefined, idOf: (item: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const item of Array.isArray(list) ? list : []) {
    const id = item ? idOf(item) : undefined;
    if (id != null) m.set(id, item);
  }
  return m;
}

/** items by id: the order of `mine` first, then what only `theirs` added */
function mergeItems<T>(
  base: T[] | undefined, mine: T[] | undefined, theirs: T[] | undefined, kind: MergeKind, idOf: (item: T) => string,
  out: { conflicts: MergeConflict[]; fromTheirs: MergeTaken[] },
): T[] {
  const B = index(base, idOf), M = index(mine, idOf), T = index(theirs, idOf);
  const ids = [...M.keys(), ...[...T.keys()].filter((id) => !M.has(id))];
  const list: T[] = [];
  for (const id of ids) {
    const r = pick(B.get(id), M.get(id), T.get(id));
    if (r.conflict) out.conflicts.push({ kind, id, deleted: M.get(id) === undefined });
    if (r.from === 'theirs' && !same(M.get(id), T.get(id))) out.fromTheirs.push({ kind, id });
    if (r.value !== undefined) list.push(clone(r.value));
  }
  return list;
}

/** what a connection is: its ends (its id is only a name) */
export function edgeKey(e: GraphEdge): string {
  return [e.sourceNodeId, e.sourcePort, e.targetNodeId, e.targetPort].join('\u0000');
}

function mergeEdges(
  base: GraphEdge[] | undefined, mine: GraphEdge[] | undefined, theirs: GraphEdge[] | undefined, out: { fromTheirs: MergeTaken[] },
): GraphEdge[] {
  const set = (l: GraphEdge[] | undefined) => new Map((Array.isArray(l) ? l : []).map((e) => [edgeKey(e), e] as const));
  const B = set(base), M = set(mine), T = set(theirs);
  const list: GraphEdge[] = [];
  for (const [k, e] of M) {
    if (T.has(k) || !B.has(k)) list.push(clone(e));
    else out.fromTheirs.push({ kind: 'edge', id: e.edgeId });
  }
  for (const [k, e] of T) {
    if (M.has(k) || B.has(k)) continue;
    list.push(clone(e));
    out.fromTheirs.push({ kind: 'edge', id: e.edgeId });
  }
  // two connections with one id (made on both sides): the later one gets the next free `e<n>`
  const used = new Set<string>();
  return list.map((e) => {
    let id = e.edgeId;
    for (let n = list.length + 1; used.has(id); n++) id = `e${n}`;
    used.add(id);
    return id === e.edgeId ? e : { ...e, edgeId: id };
  });
}

function mergeGroups(
  base: RuleGroup[] | undefined, mine: RuleGroup[] | undefined, theirs: RuleGroup[] | undefined, have: Set<string>,
  out: { conflicts: MergeConflict[]; fromTheirs: MergeTaken[] },
): RuleGroup[] {
  const taken = new Set<string>();
  return mergeItems(base, mine, theirs, 'group', (g) => g.groupId, out)
    // a node is in one group only; a group loses the nodes that are gone, and an empty group goes
    .map((g) => ({ ...g, nodeIds: (g.nodeIds ?? []).filter((id) => have.has(id) && !taken.has(id) && !!taken.add(id)) }))
    .filter((g) => g.nodeIds.length);
}

/** The merge. `base` may be missing (nothing is known about the start): then both sides count as changed. */
export function mergeGraphs(base: EditorState | null | undefined, mine: EditorState, theirs: EditorState): MergeResult {
  const out = { conflicts: [] as MergeConflict[], fromTheirs: [] as MergeTaken[] };
  const b: Partial<EditorState> = base ?? {};
  const nodes = mergeItems<GraphNode>(b.nodes, mine.nodes, theirs.nodes, 'node', (n) => n.nodeId, out);
  const have = new Set(nodes.map((n) => n.nodeId));
  const edges = mergeEdges(b.edges, mine.edges, theirs.edges, out).filter((e) => have.has(e.sourceNodeId) && have.has(e.targetNodeId));
  const groups = mergeGroups(b.groups, mine.groups, theirs.groups, have, out);
  return { graph: { nodes, edges, groups }, conflicts: out.conflicts, fromTheirs: out.fromTheirs };
}
