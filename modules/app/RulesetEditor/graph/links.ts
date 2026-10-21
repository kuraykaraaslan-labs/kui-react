import type { RuleNode } from '../types';
import { FLOW_INPUT, FLOW_RUN } from './types';

/**
 * Link blocks: a `link out` or `link call` leads to the `link in` it names, and a `link in` knows the blocks that
 * call it, in this flow or in another one. The same goes for flows that run each other: a `flow_run` block leads to
 * the `flow_input` of the flow it names, and a `flow_input` knows the `flow_run` blocks that run its flow. Pure: name resolution and the search over `RuleNode.config`; the host
 * loads the other flows (`createFlowCache` keeps them for 30 s).
 */

export const LINK_IN = 'trigger.link_in';
export const LINK_OUT = 'action.link_out';
export const LINK_CALL = 'logic.link_call';
export const LINK_TYPES: readonly string[] = [LINK_IN, LINK_OUT, LINK_CALL];

/** how long the other flows are kept before they are asked for again */
export const FLOW_CACHE_MS = 30_000;

export type LinkFlow = {
  id: string;
  name: string;
  nodes: RuleNode[];
};

export type LinkHit = {
  flow: string;
  flowName: string;
  node: string;
  /** what to show for the block */
  name: string;
  /** the link name that matched */
  link: string;
};

export type FlowRef = { id: string | null };

export function isLinkBlock(node: Pick<RuleNode, 'type'> | null | undefined): boolean {
  return !!node && LINK_TYPES.includes(node.type);
}

/** `flow_input` and `flow_run` blocks: they lead from one flow to another */
export function isFlowBlock(node: Pick<RuleNode, 'type'> | null | undefined): boolean {
  return !!node && (node.type === FLOW_INPUT || node.type === FLOW_RUN);
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** the link names a block points at (a link in: its own name) */
export function linkNames(node: Pick<RuleNode, 'type' | 'config'> | null | undefined): string[] {
  const c = node?.config ?? {};
  if (node?.type === LINK_IN) return str(c.name) ? [str(c.name)] : [];
  if (node?.type === LINK_CALL) return str(c.target) ? [str(c.target)] : [];
  if (node?.type === LINK_OUT && c.mode !== 'return') {
    const targets = Array.isArray(c.targets) ? c.targets.filter((t): t is string => typeof t === 'string' && t !== '') : [];
    return [...new Set(targets)];
  }
  return [];
}

/** the link in blocks called one of `names` */
export function findIns(flows: LinkFlow[], names: string[]): LinkHit[] {
  const out: LinkHit[] = [];
  for (const f of flows) {
    for (const n of f.nodes ?? []) {
      const link = str(n?.config?.name);
      if (n?.type === LINK_IN && names.includes(link)) out.push({ flow: f.id, flowName: f.name || f.id, node: n.nodeId, name: n.label || link, link });
    }
  }
  return out;
}

/** the link out and link call blocks that point at `name` */
export function findCallers(flows: LinkFlow[], name: string): LinkHit[] {
  const out: LinkHit[] = [];
  for (const f of flows) {
    for (const n of f.nodes ?? []) {
      if ((n?.type === LINK_OUT || n?.type === LINK_CALL) && linkNames(n).includes(name)) {
        out.push({ flow: f.id, flowName: f.name || f.id, node: n.nodeId, name: n.label || (n.type === LINK_CALL ? 'Link call' : 'Link out'), link: name });
      }
    }
  }
  return out;
}

/** the `flow_input` block of the flow with this id */
export function findFlowInputs(flows: LinkFlow[], flowId: string): LinkHit[] {
  const out: LinkHit[] = [];
  for (const f of flows) {
    if (f.id !== flowId) continue;
    for (const n of f.nodes ?? []) if (n?.type === FLOW_INPUT) out.push({ flow: f.id, flowName: f.name || f.id, node: n.nodeId, name: n.label || 'Flow input', link: flowId });
  }
  return out;
}

/** the `flow_run` blocks that run the flow with this id */
export function findRunners(flows: LinkFlow[], flowId: string): LinkHit[] {
  const out: LinkHit[] = [];
  for (const f of flows) {
    for (const n of f.nodes ?? []) {
      if (n?.type === FLOW_RUN && flowId !== '' && str(n.config?.flow) === flowId) out.push({ flow: f.id, flowName: f.name || f.id, node: n.nodeId, name: n.label || 'Run flow', link: flowId });
    }
  }
  return out;
}

/**
 * Where a link block leads: its link ins, or for a link in the blocks that call it. `name` narrows a link out to one
 * target. The block itself is never a hit.
 */
export function linkHits(flows: LinkFlow[], node: RuleNode, here: FlowRef, name?: string): LinkHit[] {
  const notSelf = (h: LinkHit) => !(h.flow === (here.id ?? '') && h.node === node.nodeId);
  if (node.type === FLOW_RUN) return findFlowInputs(flows, str(node.config?.flow)).filter(notSelf);
  if (node.type === FLOW_INPUT) return findRunners(flows, here.id ?? '').filter(notSelf);
  return node.type === LINK_IN ? findCallers(flows, str(node.config?.name)).filter(notSelf) : findIns(flows, name ? [name] : linkNames(node)).filter(notSelf);
}

/** the sentence for "nothing found" */
export function noHitsMessage(node: RuleNode, name?: string): string {
  if (node.type === FLOW_INPUT) return 'No Run flow block runs this flow.';
  if (node.type === FLOW_RUN) return 'The flow this block runs has no Flow input block.';
  if (node.type === LINK_IN) return 'No block calls this link in.';
  return `No link in is called ${(name ? [name] : linkNames(node)).join(', ') || '?'}.`;
}

export type FlowCache = {
  /** the flows of the ids: from the cache while fresh, the rest from the host in one call */
  get: (ids: string[]) => Promise<LinkFlow[]>;
  clear: () => void;
};

/**
 * A cache over the host's `loadFlows(ids)`. An entry is fresh for `ttl` ms. A failed load falls back to what is
 * kept, however old. Ids the host does not return are not asked for again until the entry would have expired.
 */
export function createFlowCache(
  load: (ids: string[]) => Promise<LinkFlow[] | null | undefined>, ttl = FLOW_CACHE_MS, now: () => number = Date.now,
): FlowCache {
  const kept = new Map<string, { at: number; flow: LinkFlow | null }>();
  return {
    async get(ids) {
      const stale = ids.filter((id) => { const e = kept.get(id); return !e || now() - e.at >= ttl; });
      if (stale.length) {
        let got: LinkFlow[] | null | undefined = null;
        try { got = await load(stale); } catch { got = null; }
        if (got) {
          const at = now();
          for (const id of stale) kept.set(id, { at, flow: null });
          for (const f of got) kept.set(f.id, { at, flow: f });
        }
      }
      return ids.map((id) => kept.get(id)?.flow).filter((f): f is LinkFlow => !!f);
    },
    clear: () => kept.clear(),
  };
}
