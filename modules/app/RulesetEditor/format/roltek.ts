/**
 * The `roltek-automation-1` file format, converted to and from the chains of this editor. Pure, no React.
 *
 *   { format, rev?, flows: [{ id, name, enabled, nodes: [{ id, type, params, x, y, name?, disabled? }],
 *     edges: [{ from, from_port, to }], groups: [{ id, name, color, nodes }] }], subflows: [...], configs: [...] }
 *
 * A chain maps to a flow: `nodeId` to `id`, `label` to `name`, `config` to `params`, the script of a
 * built-in node to the param its block stores in `script`, `sourceNodeId` / `sourcePort` / `targetNodeId`
 * to `from` / `from_port` / `to`. Nodes whose block the catalog does not have become placeholders and
 * leave again as `unsupported` blocks, so a round trip through this editor loses nothing. A flow carries
 * the subflows it uses; a subflow definition that no node uses is not written.
 *
 * Config nodes (`configs`: `{ id, type, name?, params }`, a broker or an account several flows name) are not part of
 * a chain: the host passes the ones to write (`chainsToRoltek(chains, { configs })`) and reads them back with
 * `roltekConfigs(file)`. Their secrets never travel: a secret param leaves as `{ "$secret": true }` (listed in
 * `omitted`) and comes back empty (`null`, listed in `secretsToEnter`).
 */
import { BUILTIN_CATALOG } from '../catalog/builtin';
import { withNoteBlock } from '../catalog/note';
import { nodePortsOf } from '../catalog/ports';
import type { Catalog, ParamSpec } from '../catalog/types';
import { clone, newId, slug } from '../graph/ids';
import { catalogWithSubflows, usesOf } from '../graph/subflows';
import { isSecretKey, looksLikeSecret } from '../secrets';
import type { RuleChain, RuleEdge, RuleGroup, RuleNode, RuleSubflow } from '../types';

export const ROLTEK_FORMAT = 'roltek-automation-1';

/** ids of nodes in a roltek-automation-1 file */
export const NODE_ID_RE = /^[A-Za-z0-9_]{1,16}$/;
/** ids of flows and subflows in a roltek-automation-1 file */
export const FLOW_ID_RE = /^[a-z0-9_-]{1,32}$/;

export type RoltekNode = {
  id: string; type: string; params: Record<string, unknown>; x: number; y: number; name?: string; disabled?: boolean;
  /** the block version the params were made for; a host that migrates old nodes reads it */
  v?: number;
};
export type RoltekEdge = { from: string; from_port: string; to: string };
export type RoltekGroup = { id: string; name: string; color: number; nodes: string[] };
export type RoltekFlow = {
  id: string; name: string; enabled: boolean; description?: string;
  nodes: RoltekNode[]; edges: RoltekEdge[]; groups?: RoltekGroup[];
};
export type RoltekSubflow = {
  id: string; name: string; description?: string; inputs: 0 | 1; outputs: string[];
  params: Record<string, ParamSpec>; nodes: RoltekNode[]; edges: RoltekEdge[]; groups?: RoltekGroup[];
};
export type RoltekOmitted = { path: string; reason: 'secret' };
/** a config node of the file: its type is a `config.*` block of the catalog, its params that block's params */
export type RoltekConfig = { id: string; type: string; name?: string; params: Record<string, unknown> };
export type RoltekFile = {
  format: typeof ROLTEK_FORMAT;
  rev?: number;
  exported_at?: string;
  source?: string;
  flows: RoltekFlow[];
  subflows: RoltekSubflow[];
  configs: RoltekConfig[];
  omitted?: RoltekOmitted[];
};

const UNSUPPORTED = new Set(['PLACEHOLDER', 'unsupported']);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function str(v: unknown): string { return typeof v === 'string' ? v : ''; }
function num(v: unknown, fallback: number): number { return typeof v === 'number' && Number.isFinite(v) ? v : fallback; }

/** keys of the params a block stores in node.script */
function scriptKeys(catalog: Catalog, type: string): string[] {
  return Object.entries(catalog.blocks[type]?.params ?? {}).filter(([, spec]) => spec.store === 'script').map(([key]) => key);
}

/* ─── Export ─────────────────────────────────────────────────────────────── */

type ExportState = { omitted: RoltekOmitted[]; suspicious: string[]; descriptions: string[] };

/** the marker of a secret the file does not carry: keep the stored value */
function isSecretMarker(v: unknown): boolean {
  return isObject(v) && v.$secret === true;
}

/** copy a value without its secret keys (listed in `omitted`); a `{ "$secret": true }` marker stays */
function omitSecrets(value: unknown, path: string, state: ExportState): unknown {
  if (typeof value === 'string') {
    if (looksLikeSecret(value)) state.suspicious.push(path);
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => omitSecrets(v, `${path}[${i}]`, state));
  if (!isObject(value)) return value;
  if (isSecretMarker(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (isSecretKey(key) && v !== null && v !== undefined && v !== '' && !isSecretMarker(v)) {
      state.omitted.push({ path: `${path}.${key}`, reason: 'secret' });
    } else {
      out[key] = omitSecrets(v, `${path}.${key}`, state);
    }
  }
  return out;
}

/** node ids that fit the format: those that already do stay, the others become n1, n2 … */
function nodeIdMap(nodes: { nodeId: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set(nodes.map((n) => n.nodeId).filter((id) => NODE_ID_RE.test(id)));
  let next = 1;
  for (const node of nodes) {
    if (NODE_ID_RE.test(node.nodeId)) { map.set(node.nodeId, node.nodeId); continue; }
    while (used.has('n' + next)) next++;
    used.add('n' + next);
    map.set(node.nodeId, 'n' + next);
  }
  return map;
}

function nodeToRoltek(node: RuleNode, id: string, catalog: Catalog, at: string, state: ExportState): RoltekNode {
  const place = { x: Math.round(node.x), y: Math.round(node.y) };
  const flags = { ...(node.disabled ? { disabled: true } : {}), ...(Number.isInteger(node.v) && (node.v as number) >= 1 ? { v: node.v } : {}) };
  /* the router contract (O1) has no node description yet: it stays out of the file and is reported */
  if (node.description) state.descriptions.push(`${at}.description`);
  if (UNSUPPORTED.has(node.type)) {
    const original = node.original;
    return {
      id, type: 'unsupported',
      params: {
        orig_type: original?.type ?? 'unknown',
        orig_params: omitSecrets(original?.settings ?? {}, `${at}.orig_params`, state),
        ports: original?.outputs ?? [],
        reason: 'unknown',
      },
      ...place, ...(node.label && node.label !== original?.type ? { name: node.label } : {}), ...flags,
    };
  }
  const params = omitSecrets(clone(node.config ?? {}), `${at}.params`, state) as Record<string, unknown>;
  if (node.script !== undefined) {
    if (looksLikeSecret(node.script)) state.suspicious.push(`${at}.script`);
    const keys = scriptKeys(catalog, node.type);
    params[keys[0] ?? 'script'] = node.script;
  }
  const title = catalog.blocks[node.type]?.title;
  if (looksLikeSecret(node.label)) state.suspicious.push(`${at}.name`);
  return { id, type: node.type, params, ...place, ...(node.label && node.label !== title ? { name: node.label } : {}), ...flags };
}

function graphToRoltek(
  graph: { nodes: RuleNode[]; edges: RuleEdge[]; groups?: RuleGroup[] }, catalog: Catalog, at: string, state: ExportState,
): { nodes: RoltekNode[]; edges: RoltekEdge[]; groups?: RoltekGroup[] } {
  const ids = nodeIdMap(graph.nodes);
  const nodes = graph.nodes.map((n) => nodeToRoltek(n, ids.get(n.nodeId) as string, catalog, `${at}.nodes.${ids.get(n.nodeId)}`, state));
  const edges = graph.edges
    .filter((e) => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId))
    .map((e) => ({ from: ids.get(e.sourceNodeId) as string, from_port: e.sourcePort, to: ids.get(e.targetNodeId) as string }));
  const groups = (graph.groups ?? [])
    .map((g) => ({ id: g.groupId, name: g.name, color: g.color, nodes: g.nodeIds.filter((id) => ids.has(id)).map((id) => ids.get(id) as string) }))
    .filter((g) => g.nodes.length);
  return { nodes, edges, ...(groups.length ? { groups } : {}) };
}

export type RoltekExportOptions = {
  catalog?: Catalog; now?: Date; source?: string;
  /** the config nodes to write with the flows (usually the ones they name); secrets are left out */
  configs?: RoltekConfig[];
};

/** is a param of a config type secret: its block declares it `secret`, or its key reads like one (`password`, `token` …) */
function isSecretParam(catalog: Catalog, type: string, key: string): boolean {
  return catalog.blocks[type]?.params?.[key]?.type === 'secret' || isSecretKey(key);
}

function configsToRoltek(configs: RoltekConfig[], catalog: Catalog, state: ExportState): RoltekConfig[] {
  const seen = new Set<string>();
  const out: RoltekConfig[] = [];
  for (const c of configs) {
    if (!c || typeof c.id !== 'string' || seen.has(c.id)) continue;
    seen.add(c.id);
    const at = `configs.${c.id}`;
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(c.params ?? {})) {
      if (isSecretParam(catalog, c.type, key)) {
        if (value !== null && value !== undefined && value !== '' && !isSecretMarker(value)) state.omitted.push({ path: `${at}.params.${key}`, reason: 'secret' });
        params[key] = { $secret: true };
      } else {
        params[key] = omitSecrets(clone(value), `${at}.params.${key}`, state);
      }
    }
    if (c.name && looksLikeSecret(c.name)) state.suspicious.push(`${at}.name`);
    out.push({ id: c.id, type: c.type, ...(c.name ? { name: c.name } : {}), params });
  }
  return out;
}

/**
 * Convert chains (and the subflows they carry) to a roltek-automation-1 file. Secret settings are left
 * out and listed in `omitted`; text that looks like a password is listed in `suspicious`.
 */
export function chainsToRoltek(
  chains: RuleChain[], options: RoltekExportOptions = {},
): { file: RoltekFile; omitted: string[]; suspicious: string[]; omittedDescriptions: string[] } {
  const base = withNoteBlock(options.catalog ?? BUILTIN_CATALOG);
  const state: ExportState = { omitted: [], suspicious: [], descriptions: [] };

  // a flow carries the subflows it uses (and the ones those use); a definition nobody uses is not written
  const subflows: RuleSubflow[] = [];
  for (const chain of chains) {
    for (const sf of neededSubflows(chain.nodes, chain.subflows ?? [])) if (!subflows.some((s) => s.subflowId === sf.subflowId)) subflows.push(sf);
  }
  const outer = catalogWithSubflows(base, subflows);

  const usedIds = new Set<string>();
  const flows: RoltekFlow[] = chains.map((chain) => {
    const id = FLOW_ID_RE.test(chain.chainId) && !usedIds.has(chain.chainId) ? chain.chainId : newId(usedIds, chain.name, 'flow');
    usedIds.add(id);
    if (chain.description && looksLikeSecret(chain.description)) state.suspicious.push(`flows.${id}.description`);
    return {
      id, name: chain.name, enabled: chain.active, ...(chain.description ? { description: chain.description } : {}),
      ...graphToRoltek(chain, outer, `flows.${id}`, state),
    } as RoltekFlow;
  });

  const exportedSubflows: RoltekSubflow[] = subflows.map((sf) => {
    const inner = catalogWithSubflows(base, subflows, { subflowId: sf.subflowId, outputs: sf.outputs });
    return {
      id: sf.subflowId, name: sf.name, ...(sf.description ? { description: sf.description } : {}),
      inputs: sf.inputs, outputs: [...sf.outputs], params: clone(sf.params),
      ...graphToRoltek(sf, inner, `subflows.${sf.subflowId}`, state),
    };
  });

  const file: RoltekFile = {
    format: ROLTEK_FORMAT,
    exported_at: (options.now ?? new Date()).toISOString(),
    source: options.source ?? 'kui-react',
    flows,
    subflows: exportedSubflows,
    configs: configsToRoltek(options.configs ?? [], base, state),
    ...(state.omitted.length ? { omitted: state.omitted } : {}),
  };
  return { file, omitted: state.omitted.map((o) => o.path), suspicious: state.suspicious, omittedDescriptions: state.descriptions };
}

/* ─── Import ─────────────────────────────────────────────────────────────── */

export type RoltekConversion = {
  /** id of the flow in the file */
  id: string;
  chain: RuleChain;
  placeholders: number;
  notes: string[];
};

function plural(n: number, one: string, many = `${one}s`): string { return `${n} ${n === 1 ? one : many}`; }

function wiredOutputs(id: string, rawEdges: Record<string, unknown>[]): string[] {
  return [...new Set(rawEdges.filter((e) => str(e.from) === id).map((e) => str(e.from_port) || 'out'))];
}

type GraphResult = { nodes: RuleNode[]; edges: RuleEdge[]; groups: RuleGroup[]; placeholders: number; dropped: number };

function graphFromRoltek(raw: Record<string, unknown>, catalog: Catalog): GraphResult {
  const rawEdges = (Array.isArray(raw.edges) ? raw.edges : []).filter(isObject);
  const seen = new Set<string>();
  let placeholders = 0;
  const nodes: RuleNode[] = [];
  (Array.isArray(raw.nodes) ? raw.nodes : []).filter(isObject).forEach((n, j) => {
    const nodeId = str(n.id) || `n${j + 1}`;
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const type = str(n.type);
    const params = isObject(n.params) ? n.params : {};
    const base = { nodeId, x: Math.round(num(n.x, 60 + j * 220)), y: Math.round(num(n.y, 80)), ...(n.disabled === true ? { disabled: true } : {}), ...(Number.isInteger(n.v) && (n.v as number) >= 1 ? { v: n.v as number } : {}) };
    const decl = UNSUPPORTED.has(type) ? undefined : catalog.blocks[type];
    if (!decl) {
      placeholders++;
      const wasUnsupported = type === 'unsupported';
      const ports = wasUnsupported && Array.isArray(params.ports) ? params.ports.map(String) : wiredOutputs(nodeId, rawEdges);
      nodes.push({
        ...base, type: 'PLACEHOLDER', label: str(n.name) || (wasUnsupported ? str(params.orig_type) : type) || 'Node',
        original: {
          type: wasUnsupported ? str(params.orig_type) || 'unknown' : type || 'unknown', source: 'roltek',
          settings: wasUnsupported ? params.orig_params ?? {} : params, inputs: ['in'], outputs: ports,
        },
      });
      return;
    }
    const keys = scriptKeys(catalog, type);
    const config: Record<string, unknown> = {};
    let script: string | undefined;
    for (const [key, value] of Object.entries(params)) {
      if (keys.includes(key)) { if (typeof value === 'string') script = value; } else config[key] = value;
    }
    nodes.push({ ...base, type, label: str(n.name) || decl.title, config, ...(script !== undefined ? { script } : {}) });
  });

  let dropped = 0;
  const edges: RuleEdge[] = [];
  rawEdges.forEach((e, k) => {
    const from = nodes.find((n) => n.nodeId === str(e.from));
    const to = nodes.find((n) => n.nodeId === str(e.to));
    const port = str(e.from_port) || 'out';
    const ok = !!from && !!to
      && nodePortsOf(catalog, from).outputs.some((p) => p.id === port)
      && nodePortsOf(catalog, to).inputs.length > 0;
    if (!ok || !from || !to) { dropped++; return; }
    edges.push({ edgeId: `e${k + 1}`, sourceNodeId: from.nodeId, sourcePort: port, targetNodeId: to.nodeId, targetPort: 'in' });
  });

  const groups: RuleGroup[] = (Array.isArray(raw.groups) ? raw.groups : []).filter(isObject).map((g, k) => ({
    groupId: str(g.id) || `g${k + 1}`,
    name: str(g.name),
    color: Math.min(7, Math.max(0, Math.round(num(g.color, 0)))),
    nodeIds: (Array.isArray(g.nodes) ? g.nodes : []).map(String).filter((id) => seen.has(id)),
  })).filter((g) => g.nodeIds.length);
  return { nodes, edges, groups, placeholders, dropped };
}

function subflowFromRoltek(raw: Record<string, unknown>, catalog: Catalog, subflows: RuleSubflow[]): RuleSubflow | null {
  const id = str(raw.id);
  if (!FLOW_ID_RE.test(id)) return null;
  const outputs = (Array.isArray(raw.outputs) ? raw.outputs : []).map(String);
  const inner = catalogWithSubflows(catalog, subflows, { subflowId: id, outputs });
  const { nodes, edges, groups } = graphFromRoltek(raw, inner);
  return {
    subflowId: id, name: str(raw.name) || id, ...(str(raw.description) ? { description: str(raw.description) } : {}),
    inputs: raw.inputs === 0 ? 0 : 1, outputs,
    params: isObject(raw.params) ? (raw.params as Record<string, ParamSpec>) : {},
    nodes, edges, groups,
  };
}

/** the subflows a list of nodes needs, and the ones those need in turn */
function neededSubflows(nodes: RuleNode[], all: RuleSubflow[]): RuleSubflow[] {
  const byId = new Map(all.map((sf) => [sf.subflowId, sf]));
  const out: RuleSubflow[] = [];
  const queue = [...usesOf(nodes)];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const sf = byId.get(id);
    if (!sf || out.includes(sf)) continue;
    out.push(sf);
    queue.push(...usesOf(sf.nodes));
  }
  return out;
}

export type RoltekConfigImport = {
  /** the config nodes to store, every secret param empty (`null`) */
  configs: RoltekConfig[];
  /** `<config id>.<param>` of each secret the user enters again */
  secretsToEnter: string[];
  /** config nodes left out: an id that is not a flow id, a second one with the same id, a type the catalog lacks */
  skipped: { id: string; reason: 'bad_id' | 'duplicate' | 'unknown_type' }[];
};

/**
 * The config nodes of a roltek-automation-1 file (already parsed). Their secrets come back empty. With a `catalog`,
 * a config whose type it does not have is skipped (`unknown_type`); without one every type is kept.
 */
export function roltekConfigs(file: Record<string, unknown>, catalog?: Catalog): RoltekConfigImport {
  const out: RoltekConfigImport = { configs: [], secretsToEnter: [], skipped: [] };
  const known = catalog ?? BUILTIN_CATALOG;
  const seen = new Set<string>();
  for (const raw of (Array.isArray(file.configs) ? file.configs : []).filter(isObject)) {
    const id = str(raw.id);
    const type = str(raw.type);
    if (!FLOW_ID_RE.test(id)) { out.skipped.push({ id, reason: 'bad_id' }); continue; }
    if (seen.has(id)) { out.skipped.push({ id, reason: 'duplicate' }); continue; }
    seen.add(id);
    if (!type || (catalog && !catalog.blocks[type])) { out.skipped.push({ id, reason: 'unknown_type' }); continue; }
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(isObject(raw.params) ? raw.params : {})) {
      if (isSecretParam(known, type, key) || isSecretMarker(value)) {
        params[key] = null;
        out.secretsToEnter.push(`${id}.${key}`);
      } else {
        params[key] = clone(value);
      }
    }
    out.configs.push({ id, type, ...(str(raw.name) ? { name: str(raw.name) } : {}), params });
  }
  return out;
}

/**
 * Convert the flows of a roltek-automation-1 file (already parsed, with `format` checked) to chains.
 * Imported chains are inactive. A block the catalog does not know becomes a placeholder; connections
 * that point to a missing block or port are dropped; config nodes are not part of a chain (`roltekConfigs`
 * reads them), so each flow notes how many the file has.
 */
export function roltekToChains(
  file: Record<string, unknown>, givenCatalog: Catalog = BUILTIN_CATALOG, now: Date = new Date(),
  options: { /** note the config nodes the chains leave out (default true); false when the host imports them with `roltekConfigs` */ noteConfigs?: boolean } = {},
): RoltekConversion[] {
  const catalog = withNoteBlock(givenCatalog);
  const rawSubflows = (Array.isArray(file.subflows) ? file.subflows : []).filter(isObject);
  // the blocks of all subflows must exist before any graph is read: they may use each other
  const declared: RuleSubflow[] = rawSubflows
    .filter((raw) => FLOW_ID_RE.test(str(raw.id)))
    .map((raw) => ({ subflowId: str(raw.id), name: str(raw.name), inputs: raw.inputs === 0 ? 0 : 1, outputs: (Array.isArray(raw.outputs) ? raw.outputs : []).map(String), params: isObject(raw.params) ? (raw.params as Record<string, ParamSpec>) : {}, nodes: [], edges: [], groups: [] } as RuleSubflow));
  const subflows = rawSubflows.map((raw) => subflowFromRoltek(raw, catalog, declared)).filter((sf): sf is RuleSubflow => sf !== null);
  const outer = catalogWithSubflows(catalog, declared);
  const configs = options.noteConfigs !== false && Array.isArray(file.configs) ? file.configs.length : 0;

  return (Array.isArray(file.flows) ? file.flows : []).filter(isObject).map((raw, i) => {
    const chainId = str(raw.id) || `import-${i + 1}`;
    const name = str(raw.name).trim() || chainId;
    const graph = graphFromRoltek(raw, outer);
    const carried = neededSubflows(graph.nodes, subflows);
    const notes: string[] = [];
    if (graph.placeholders) notes.push(`${plural(graph.placeholders, 'node')} not available here (placeholder)`);
    if (graph.dropped) notes.push(`${plural(graph.dropped, 'connection')} dropped`);
    if (configs) notes.push(`${plural(configs, 'config node')} in the file not imported`);
    const chain: RuleChain = {
      chainId, name, slug: slug(name, chainId), description: str(raw.description) || undefined, active: false,
      nodes: graph.nodes, edges: graph.edges,
      ...(graph.groups.length ? { groups: graph.groups } : {}),
      ...(carried.length ? { subflows: carried } : {}),
      createdAt: now, updatedAt: now,
    };
    return { id: chainId, chain, placeholders: graph.placeholders, notes };
  });
}
