import { missingRequired, paramLabel } from '../catalog/params';
import { nodePortsOf } from '../catalog/ports';
import type { Catalog } from '../catalog/types';
import { FLOW_INPUT, FLOW_RUN, type Graph, type GraphEdge, type GraphNode } from './types';

export type IssueCode =
  | 'unsupported' | 'unknown' | 'required' | 'edge' | 'edge_port'
  | 'no_input' | 'one_flow_input' | 'run_self' | 'unconnected' | 'no_feed' | 'cycle_sync';

export type GraphIssue = {
  code: IssueCode;
  severity: 'error' | 'warning';
  nodeId?: string;
  /** the param a `required` or `port` issue is about */
  param?: string;
  /** a value the message mentions (the unknown type, the missing port) */
  arg?: string;
  message: string;
};

export type ValidateContext = {
  /** the chain is switched on: a missing required param is an error, otherwise only a warning */
  active?: boolean;
  /** the id of the flow being checked: a `flow_run` block that runs its own flow is a problem */
  flowId?: string | null;
  /** the words of an issue, for a host that translates them (default `issueMessage`, English) */
  message?: (code: IssueCode, arg?: string, param?: string) => string;
};

export type ValidationResult = { errors: GraphIssue[]; warnings: GraphIssue[] };

const UNSUPPORTED = new Set(['PLACEHOLDER', 'unsupported']);

/** Plain-language text of an issue; the editor shows it next to the node. */
export function issueMessage(code: IssueCode, arg?: string, param?: string): string {
  switch (code) {
    case 'unsupported': return 'This block is not available here. It keeps its connections but cannot run.';
    case 'unknown': return `Unknown block type ${arg ?? ''}.`.replace(' .', '.');
    case 'required': return `${param ?? 'A parameter'} is required.`;
    case 'cycle_sync': return `These blocks send messages round in a loop that never waits, so it would never stop: ${arg ?? ''}. Put a block that waits (a delay, a timer, a network call) in the loop, or remove a connection.`.replace(': .', '.');
    case 'edge': return 'A connection points to a block that does not exist.';
    case 'edge_port': return `The connection leaves ${arg ?? 'a port'}, which this block does not have.`;
    case 'no_input': return 'A connection arrives at a block that has no input.';
    case 'one_flow_input': return 'A flow can have only one Flow input block.';
    case 'run_self': return 'A Run flow block cannot run its own flow.';
    case 'unconnected': return 'This block is not connected to anything.';
    case 'no_feed': return 'Nothing is connected to this block.';
  }
}

/**
 * Checks a graph against a catalog: unknown or unsupported types, required params that are shown
 * and empty, connections that use ports a block does not have, blocks nothing reaches. A flow holds at most
 * one `flow_input` block, and a `flow_run` block never runs its own flow. A port-less comment block is skipped.
 */
export function validateGraph<N extends GraphNode, E extends GraphEdge>(
  graph: Pick<Graph<N, E>, 'nodes' | 'edges'>,
  catalog: Catalog,
  ctx: ValidateContext = {},
): ValidationResult {
  const errors: GraphIssue[] = [];
  const warnings: GraphIssue[] = [];
  const add = (list: GraphIssue[], code: IssueCode, extra: { nodeId?: string; param?: string; arg?: string; label?: string } = {}) => {
    const { label, ...rest } = extra;
    list.push({ code, severity: list === errors ? 'error' : 'warning', ...rest, message: (ctx.message ?? issueMessage)(code, rest.arg, label ?? rest.param) });
  };
  const soft = ctx.active ? errors : warnings;
  const byId = new Map(graph.nodes.map((n) => [n.nodeId, n]));
  const flowInputs: GraphNode[] = [];

  for (const node of graph.nodes) {
    if (UNSUPPORTED.has(node.type)) { add(errors, 'unsupported', { nodeId: node.nodeId }); continue; }
    if (node.type === FLOW_INPUT) flowInputs.push(node);
    const decl = catalog.blocks[node.type];
    if (!decl) { add(errors, 'unknown', { nodeId: node.nodeId, arg: node.type }); continue; }
    const values: Record<string, unknown> = { ...node.config };
    // a param stored in node.script counts as filled when the script has text
    for (const [key, spec] of Object.entries(decl.params ?? {})) if (spec.store === 'script') values[key] = node.script;
    for (const param of missingRequired(decl, values)) add(soft, 'required', { nodeId: node.nodeId, param, label: paramLabel(param, decl.params?.[param] ?? {}) });
    if (node.type === FLOW_RUN && ctx.flowId && node.config?.flow === ctx.flowId) add(errors, 'run_self', { nodeId: node.nodeId, param: 'flow' });
  }

  const incoming = new Set<string>();
  const touched = new Set<string>();
  const syncNext = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const from = byId.get(edge.sourceNodeId);
    const to = byId.get(edge.targetNodeId);
    if (!from || !to) { add(errors, 'edge', { nodeId: from ? edge.sourceNodeId : edge.targetNodeId }); continue; }
    const outs = nodePortsOf(catalog, from).outputs;
    if (edge.sourcePort !== 'error' && !outs.some((p) => p.id === edge.sourcePort)) {
      add(errors, 'edge_port', { nodeId: from.nodeId, arg: edge.sourcePort });
      continue;
    }
    if (nodePortsOf(catalog, to).inputs.length < 1) { add(errors, 'no_input', { nodeId: to.nodeId }); continue; }
    if (!catalog.blocks[from.type]?.async && !catalog.blocks[to.type]?.async) syncNext.set(from.nodeId, [...(syncNext.get(from.nodeId) ?? []), to.nodeId]);
    incoming.add(to.nodeId);
    touched.add(from.nodeId);
    touched.add(to.nodeId);
  }

  const loop = syncCycle(syncNext);
  if (loop) add(errors, 'cycle_sync', { nodeId: loop[0], arg: loop.join(' → ') });

  // the first one is the entry; every other one is a problem
  for (const extra of flowInputs.slice(1)) add(errors, 'one_flow_input', { nodeId: extra.nodeId });

  for (const node of graph.nodes) {
    const decl = catalog.blocks[node.type];
    if (!decl || node.type === 'note.comment') continue;
    if (!touched.has(node.nodeId) && node.type !== FLOW_INPUT) add(warnings, 'unconnected', { nodeId: node.nodeId });
    else if (decl.inputs !== 0 && !incoming.has(node.nodeId) && nodePortsOf(catalog, node).inputs.length > 0) add(warnings, 'no_feed', { nodeId: node.nodeId });
  }
  return { errors, warnings };
}

/**
 * A cycle among connections whose two blocks are both synchronous (the router's `cycle_sync`): the blocks of the
 * first one found, in order, or null. Iterative, so a long chain cannot overflow the stack.
 */
export function syncCycle(next: ReadonlyMap<string, readonly string[]>): string[] | null {
  const state = new Map<string, 1 | 2>();
  for (const start of next.keys()) {
    if (state.has(start)) continue;
    const path: string[] = [start];
    const cursor: number[] = [0];
    state.set(start, 1);
    while (path.length) {
      const id = path[path.length - 1];
      const targets = next.get(id) ?? [];
      const i = cursor[cursor.length - 1]++;
      if (i >= targets.length) { state.set(id, 2); path.pop(); cursor.pop(); continue; }
      const to = targets[i];
      const seen = state.get(to);
      if (seen === 1) return path.slice(path.indexOf(to));
      if (!seen) { state.set(to, 1); path.push(to); cursor.push(0); }
    }
  }
  return null;
}

/** Issues by node id, for the badges on the canvas. Errors come before warnings. */
export function issuesByNode(result: ValidationResult): Map<string, GraphIssue[]> {
  const map = new Map<string, GraphIssue[]>();
  for (const issue of [...result.errors, ...result.warnings]) {
    if (!issue.nodeId) continue;
    map.set(issue.nodeId, [...(map.get(issue.nodeId) ?? []), issue]);
  }
  return map;
}
