/**
 * Ruleset transfer logic — pure, no React, no DOM:
 *   - export (`kui-ruleset-1` JSON, secrets left out, password-looking text reported)
 *   - import (validation, preview, conflict choices, unknown types → placeholder nodes)
 *   - Node-RED flow conversion (inject / switch / change / debug / delay / function)
 *   - versions (change summary, restore) and recently deleted rulesets
 *   - templates (defaults, validation, fill)
 *
 * The rulesets theme page wires these to dialogs; everything here is unit-tested
 * in `transfer.test.ts`.
 */
import { RuleNodeTypeEnum, RuleGroupSchema, RuleSubflowSchema } from './types';
import type { RuleChain, RuleEdge, RuleGroup, RuleNode, RuleNodeOriginal, RuleNodeType, RuleSubflow } from './types';
import type { Catalog } from './catalog/types';
import { chainsToRoltek, roltekConfigs, roltekToChains, ROLTEK_FORMAT, type RoltekConfig, type RoltekConfigImport, type RoltekFile } from './format/roltek';
import { isSecretKey, looksLikeSecret } from './secrets';

/* ─── Shared helpers ─────────────────────────────────────────────────────── */

export const EXPORT_FORMAT = 'kui-ruleset-1';
/** largest import accepted (bytes) */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
/** most rulesets one import may carry */
export const IMPORT_MAX_RULESETS = 200;

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** `base`, or `base-2`, `base-3`… — whichever is not taken yet */
export function uniqueValue(base: string, taken: Iterable<string>) {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function clone<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/** a deep copy of a ruleset that keeps its dates as `Date` */
export function cloneChain(c: RuleChain): RuleChain {
  return {
    ...c,
    nodes: c.nodes.map((n) => ({ ...n, config: clone(n.config), original: clone(n.original) })),
    edges: c.edges.map((e) => ({ ...e })),
    ...(c.groups && { groups: clone(c.groups) }),
    ...(c.subflows && { subflows: clone(c.subflows) }),
    createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function str(v: unknown) { return typeof v === 'string' ? v : ''; }
function num(v: unknown, fallback: number) { return typeof v === 'number' && Number.isFinite(v) ? v : fallback; }

/** local calendar date as YYYY-MM-DD */
export function isoDay(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Input / output port ids per node type (mirrors the editor's node-meta). */
export const TYPE_PORTS: Record<Exclude<RuleNodeType, 'PLACEHOLDER'>, { inputs: string[]; outputs: string[] }> = {
  TRIGGER:    { inputs: [],     outputs: ['out'] },
  FILTER:     { inputs: ['in'], outputs: ['true', 'false'] },
  SWITCH:     { inputs: ['in'], outputs: ['c1', 'c2', 'def'] },
  TRANSFORM:  { inputs: ['in'], outputs: ['out'] },
  ACTION:     { inputs: ['in'], outputs: [] },
  DELAY:      { inputs: ['in'], outputs: ['out', 'timeout'] },
  ALARM:      { inputs: ['in'], outputs: ['created', 'cleared'] },
  ENRICHMENT: { inputs: ['in'], outputs: ['success', 'failure'] },
  REST_API:   { inputs: ['in'], outputs: ['success', 'failure'] },
  SAVE_TS:    { inputs: ['in'], outputs: ['success', 'failure'] },
};

function portsOf(n: RuleNode) {
  if (n.type === 'PLACEHOLDER') return { inputs: n.original?.inputs ?? ['in'], outputs: n.original?.outputs ?? [] };
  return TYPE_PORTS[n.type as keyof typeof TYPE_PORTS] ?? { inputs: ['in'], outputs: ['out'] };
}

const KNOWN_TYPES = new Set<string>(RuleNodeTypeEnum.options);

/* ─── Export ─────────────────────────────────────────────────────────────── */

export type ExportedRuleset = Omit<RuleChain, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string };

export type RulesetExportFile = {
  format: typeof EXPORT_FORMAT;
  exported_at: string;
  rulesets: ExportedRuleset[];
  /** paths of secret fields that were set to null */
  omitted?: string[];
};

export type ExportResult = {
  file: RulesetExportFile;
  json: string;
  fileName: string;
  /** secret fields left out (set to null) */
  omitted: string[];
  /** free text that looks like a password / token — ask before downloading */
  suspicious: string[];
};

export { isSecretKey, looksLikeSecret };

/** copy `value`, nulling secret keys (listed in `omitted`) and noting suspicious strings */
function scrub(value: unknown, path: string, omitted: string[], suspicious: string[]): unknown {
  if (typeof value === 'string') {
    if (looksLikeSecret(value)) suspicious.push(path);
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => scrub(v, `${path}[${i}]`, omitted, suspicious));
  if (!isObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (isSecretKey(k) && v !== null && v !== undefined && v !== '') {
      out[k] = null;
      omitted.push(`${path}.${k}`);
    }
    else out[k] = scrub(v, `${path}.${k}`, omitted, suspicious);
  }
  return out;
}

export function exportFileName(label: string, now: Date) {
  return `rulesets-${slugify(label) || 'all'}-${isoDay(now)}.json`;
}

/**
 * Build an export file. `all` names the file `rulesets-all-…`, otherwise it is
 * named after the (first) ruleset; `suffix` is appended to that name (e.g. `v3`).
 */
export function buildExport(chains: RuleChain[], opts: { all?: boolean; now?: Date; suffix?: string } = {}): ExportResult {
  const now = opts.now ?? new Date();
  const omitted: string[] = [];
  const suspicious: string[] = [];
  const rulesets: ExportedRuleset[] = chains.map((c) => {
    if (c.description && looksLikeSecret(c.description)) suspicious.push(`${c.name} / description`);
    const scrubNodes = (list: RuleNode[], owner: string) => list.map((n) => {
      const at = `${owner} / ${n.label}`;
      const out: RuleNode = { ...n };
      if (n.config) out.config = scrub(n.config, `${at} / config`, omitted, suspicious) as Record<string, unknown>;
      if (n.original) out.original = { ...n.original, settings: scrub(n.original.settings, `${at} / settings`, omitted, suspicious) };
      if (n.script && looksLikeSecret(n.script)) suspicious.push(`${at} / script`);
      if (looksLikeSecret(n.label)) suspicious.push(`${at} / label`);
      return out;
    });
    const nodes = scrubNodes(c.nodes, c.name);
    return {
      ...c,
      nodes,
      edges: c.edges.map((e) => ({ ...e })),
      ...(c.groups && { groups: clone(c.groups) }),
      ...(c.subflows && { subflows: c.subflows.map((sf) => ({ ...clone(sf), nodes: scrubNodes(sf.nodes, `${c.name} / subflow ${sf.name}`) })) }),
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
      updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : undefined,
    };
  });
  const file: RulesetExportFile = {
    format: EXPORT_FORMAT,
    exported_at: now.toISOString(),
    rulesets,
    ...(omitted.length ? { omitted } : {}),
  };
  const base = opts.all || !chains.length ? 'all' : chains[0].name;
  return {
    file,
    json: JSON.stringify(file, null, 2),
    fileName: exportFileName(opts.suffix ? `${base}-${opts.suffix}` : base, now),
    omitted,
    suspicious,
  };
}

export type RoltekExportResult = {
  file: RoltekFile;
  json: string;
  fileName: string;
  /** paths of the secret settings left out of the file */
  omitted: string[];
  /** free text that looks like a password / token — ask before downloading */
  suspicious: string[];
  /** paths of the block descriptions left out of the file (the router contract has no node description yet) */
  omittedDescriptions: string[];
};

/**
 * Build a `roltek-automation-1` export of chains. Pass the catalog the chains were made with, so the
 * scripts of its blocks go back into the params they belong to. Secrets are left out like in `buildExport`.
 */
export function buildRoltekExport(
  chains: RuleChain[], opts: { all?: boolean; now?: Date; suffix?: string; catalog?: Catalog; configs?: RoltekConfig[] } = {},
): RoltekExportResult {
  const now = opts.now ?? new Date();
  const { file, omitted, suspicious, omittedDescriptions } = chainsToRoltek(chains, { catalog: opts.catalog, now, configs: opts.configs });
  const base = opts.all || !chains.length ? 'all' : chains[0].name;
  const label = opts.suffix ? `${base}-${opts.suffix}` : base;
  return { file, json: JSON.stringify(file, null, 2), fileName: `automation-${slugify(label) || 'all'}-${isoDay(now)}.json`, omitted, suspicious, omittedDescriptions };
}

/* ─── Import ─────────────────────────────────────────────────────────────── */

export type ImportErrorCode = 'too-big' | 'not-json' | 'wrong-format' | 'empty';

export type ImportError = { ok: false; code: ImportErrorCode; message: string };

export type ImportItem = {
  /** stable key for the preview row and the conflict choice */
  key: string;
  /** the ruleset as it will be added (inactive) */
  chain: RuleChain;
  nodes: number;
  placeholders: number;
  notes: string[];
  /** a ruleset with the same id already exists */
  existing?: { chainId: string; name: string };
};

/** Node-RED conversion tally, per node */
export type NodeRedReport = { exact: number; changed: number; placeholders: number; skipped: number };

export type ImportPreview = {
  ok: true; source: 'kui' | 'node-red' | 'roltek'; items: ImportItem[]; report?: NodeRedReport;
  /** `roltek`: the file's config nodes, secrets empty; the host stores them (`applyImport` handles chains only) */
  configs?: RoltekConfigImport;
};

export type ConflictChoice = 'copy' | 'replace' | 'skip';

export const CONFLICT_LABELS: Record<ConflictChoice, string> = {
  copy: 'Add as a copy',
  replace: 'Replace',
  skip: 'Skip',
};

const IMPORT_MESSAGES: Record<ImportErrorCode, string> = {
  'too-big': `The file is too big (over ${IMPORT_MAX_BYTES / 1024 / 1024} MB).`,
  'not-json': 'This is not JSON. Choose a file exported from rulesets, or a Node-RED flow.',
  'wrong-format': `This JSON is not a "${EXPORT_FORMAT}" export or a Node-RED flow.`,
  empty: 'The file contains no rulesets.',
};

function fail(code: ImportErrorCode, message = IMPORT_MESSAGES[code]): ImportError {
  return { ok: false, code, message };
}

function byteLength(s: string) {
  return new TextEncoder().encode(s).length;
}

/** placeholder ports: the ports its wires use */
function wiredPorts(nodeId: string, edges: { sourceNodeId: string; sourcePort: string; targetNodeId: string; targetPort: string }[]) {
  const ins = [...new Set(edges.filter((e) => e.targetNodeId === nodeId).map((e) => e.targetPort))];
  const outs = [...new Set(edges.filter((e) => e.sourceNodeId === nodeId).map((e) => e.sourcePort))];
  return { inputs: ins.length ? ins : ['in'], outputs: outs };
}

function plural(n: number, one: string, many = `${one}s`) { return `${n} ${n === 1 ? one : many}`; }

function normalizeKui(raw: unknown, i: number, existing: RuleChain[], now: Date): ImportItem | null {
  if (!isObject(raw) || !Array.isArray(raw.nodes)) return null;
  const name = str(raw.name).trim() || `Imported ruleset ${i + 1}`;
  const chainId = str(raw.chainId) || `import-${i + 1}`;
  const rawEdges = (Array.isArray(raw.edges) ? raw.edges : []).filter(isObject).map((e, k) => ({
    edgeId: str(e.edgeId) || `e${k + 1}`,
    sourceNodeId: str(e.sourceNodeId), sourcePort: str(e.sourcePort) || 'out',
    targetNodeId: str(e.targetNodeId), targetPort: str(e.targetPort) || 'in',
  }));

  const seen = new Set<string>();
  let placeholders = 0;
  const nodes: RuleNode[] = [];
  raw.nodes.filter(isObject).forEach((n, j) => {
    const nodeId = str(n.nodeId) || `n${j + 1}`;
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const type = str(n.type);
    const base = {
      nodeId,
      label: str(n.label) || type || 'Node',
      x: num(n.x, 60 + j * 220),
      y: num(n.y, 80),
    };
    const script = typeof n.script === 'string' ? n.script : undefined;
    const config = isObject(n.config) ? n.config : undefined;
    if (type === 'PLACEHOLDER' && isObject(n.original)) {
      placeholders++;
      const o = n.original;
      const original: RuleNodeOriginal = {
        type: str(o.type) || 'unknown', source: o.source === 'node-red' ? 'node-red' : 'kui', settings: o.settings,
        inputs: Array.isArray(o.inputs) ? o.inputs.map(String) : undefined,
        outputs: Array.isArray(o.outputs) ? o.outputs.map(String) : undefined,
      };
      nodes.push({ ...base, type: 'PLACEHOLDER', original });
    }
    else if (KNOWN_TYPES.has(type) && type !== 'PLACEHOLDER') {
      nodes.push({ ...base, type: type as RuleNodeType, ...(script !== undefined && { script }), ...(config && { config }) });
    }
    else {
      placeholders++;
      const settings: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(n)) if (!['nodeId', 'type', 'label', 'x', 'y'].includes(k)) settings[k] = v;
      nodes.push({ ...base, type: 'PLACEHOLDER',
        original: { type: type || 'unknown', source: 'kui', settings, ...wiredPorts(nodeId, rawEdges) } });
    }
  });

  let dropped = 0;
  const edges: RuleEdge[] = rawEdges.filter((e) => {
    const s = nodes.find((n) => n.nodeId === e.sourceNodeId);
    const t = nodes.find((n) => n.nodeId === e.targetNodeId);
    const ok = !!s && !!t && portsOf(s).outputs.includes(e.sourcePort) && portsOf(t).inputs.includes(e.targetPort);
    if (!ok) dropped++;
    return ok;
  });

  const ids = new Set(nodes.map((n) => n.nodeId));
  const groups: RuleGroup[] = (Array.isArray(raw.groups) ? raw.groups : [])
    .map((g) => RuleGroupSchema.safeParse(g))
    .flatMap((r) => (r.success ? [{ ...r.data, nodeIds: r.data.nodeIds.filter((id) => ids.has(id)) }] : []))
    .filter((g) => g.nodeIds.length);
  const subflows: RuleSubflow[] = (Array.isArray(raw.subflows) ? raw.subflows : [])
    .map((sf) => RuleSubflowSchema.safeParse(sf))
    .flatMap((r) => (r.success ? [r.data] : []));

  const notes: string[] = [];
  if (placeholders) notes.push(`${plural(placeholders, 'node')} not available here (placeholder)`);
  if (dropped) notes.push(`${plural(dropped, 'connection')} dropped`);
  const clash = existing.find((c) => c.chainId === chainId);
  return {
    key: `${i}:${chainId}`,
    chain: {
      chainId, name, slug: slugify(name) || chainId,
      description: str(raw.description) || undefined,
      active: false, nodes, edges,
      ...(groups.length && { groups }), ...(subflows.length && { subflows }),
      createdAt: now, updatedAt: now,
    },
    nodes: nodes.length,
    placeholders,
    notes,
    ...(clash && { existing: { chainId: clash.chainId, name: clash.name } }),
  };
}

/**
 * Check an import (file text or pasted JSON) and build the preview.
 * Accepts a `kui-ruleset-1` export or a Node-RED flow export.
 */
export function parseImport(text: string, existing: RuleChain[], opts: { now?: Date; catalog?: Catalog } = {}): ImportPreview | ImportError {
  const now = opts.now ?? new Date();
  if (byteLength(text) > IMPORT_MAX_BYTES) return fail('too-big');
  if (!text.trim()) return fail('empty', 'Nothing to check: choose a file or paste JSON.');
  let data: unknown;
  try { data = JSON.parse(text); } catch { return fail('not-json'); }

  if (Array.isArray(data)) {
    if (!data.some((o) => isObject(o) && Array.isArray(o.wires))) {
      return data.length ? fail('wrong-format') : fail('empty');
    }
    const { items, report } = convertNodeRed(data, existing, now);
    if (!items.length) return fail('empty', 'The Node-RED flow has no nodes to import.');
    return { ok: true, source: 'node-red', items, report };
  }

  if (isObject(data) && data.format === ROLTEK_FORMAT) return parseRoltek(data, existing, now, opts.catalog);

  if (!isObject(data) || data.format !== EXPORT_FORMAT || !Array.isArray(data.rulesets)) return fail('wrong-format');
  if (!data.rulesets.length) return fail('empty');
  if (data.rulesets.length > IMPORT_MAX_RULESETS) return fail('too-big', `Too many rulesets (over ${IMPORT_MAX_RULESETS}).`);
  const items = data.rulesets.map((r, i) => normalizeKui(r, i, existing, now)).filter((x): x is ImportItem => !!x);
  if (!items.length) return fail('wrong-format', 'None of the rulesets in this file could be read.');
  return { ok: true, source: 'kui', items };
}

function parseRoltek(data: Record<string, unknown>, existing: RuleChain[], now: Date, catalog?: Catalog): ImportPreview | ImportError {
  if (!Array.isArray(data.flows) || !data.flows.length) return fail('empty');
  if (data.flows.length > IMPORT_MAX_RULESETS) return fail('too-big', `Too many flows (over ${IMPORT_MAX_RULESETS}).`);
  const items: ImportItem[] = roltekToChains(data, catalog, now, { noteConfigs: false }).map(({ chain, placeholders, notes }, i) => {
    const clash = existing.find((c) => c.chainId === chain.chainId);
    return {
      key: `${i}:${chain.chainId}`, chain, nodes: chain.nodes.length, placeholders, notes,
      ...(clash && { existing: { chainId: clash.chainId, name: clash.name } }),
    };
  });
  if (!items.length) return fail('wrong-format', 'None of the flows in this file could be read.');
  const configs = roltekConfigs(data, catalog);
  return { ok: true, source: 'roltek', items, ...(configs.configs.length || configs.skipped.length ? { configs } : {}) };
}

export type ApplyImportResult = {
  chains: RuleChain[];
  /** rulesets added or replaced, as stored */
  imported: RuleChain[];
  added: number;
  replaced: number;
  skipped: number;
};

/** Apply a checked import. Every imported ruleset arrives inactive. */
export function applyImport(
  existing: RuleChain[], items: ImportItem[], choices: Record<string, ConflictChoice> = {}, now = new Date(),
): ApplyImportResult {
  let chains = existing.slice();
  const imported: RuleChain[] = [];
  let added = 0, replaced = 0, skipped = 0;
  for (const item of items) {
    const choice: ConflictChoice = item.existing ? (choices[item.key] ?? 'copy') : 'copy';
    if (choice === 'skip') { skipped++; continue; }
    const chain = { ...cloneChain(item.chain), active: false, updatedAt: now };
    const idx = chains.findIndex((c) => c.chainId === chain.chainId);
    if (choice === 'replace' && idx >= 0) {
      const old = chains[idx];
      const next = { ...chain, createdAt: old.createdAt ?? now,
        slug: uniqueValue(chain.slug, chains.filter((c) => c.chainId !== old.chainId).map((c) => c.slug)) };
      chains = chains.map((c, i) => (i === idx ? next : c));
      imported.push(next);
      replaced++;
      continue;
    }
    const isCopy = idx >= 0;
    const name = isCopy ? `${chain.name} (copy)` : chain.name;
    const next: RuleChain = {
      ...chain,
      name,
      chainId: uniqueValue(isCopy ? `${chain.chainId}-copy` : chain.chainId, chains.map((c) => c.chainId)),
      slug: uniqueValue(slugify(name) || 'ruleset', chains.map((c) => c.slug)),
      createdAt: now,
    };
    chains = [...chains, next];
    imported.push(next);
    added++;
  }
  return { chains, imported, added, replaced, skipped };
}

/* ─── Node-RED conversion ────────────────────────────────────────────────── */

type NrNode = Record<string, unknown> & { id: string; type: string; wires: unknown[] };

type Converted = {
  node: RuleNode;
  status: 'exact' | 'changed' | 'placeholder';
  note?: string;
  /** Node-RED output index → our port id (null: dropped) */
  port: (i: number) => string | null;
};

const IDENT_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/** a Node-RED `msg.<p>` property as an expression here, where `msg` is the payload */
function nrProp(p: string): { expr: string; exact: boolean } {
  if (p === 'payload') return { expr: 'msg', exact: true };
  if (p.startsWith('payload.') && IDENT_PATH.test(p)) return { expr: `msg${p.slice(7)}`, exact: true };
  if (IDENT_PATH.test(p)) return { expr: `metadata.${p}`, exact: false };
  return { expr: 'undefined', exact: false };
}

/** a Node-RED typed value as a JS literal; null when it cannot be expressed here */
function nrValue(v: unknown, t: unknown): string | null {
  switch (t ?? 'str') {
    case 'num': { const n = Number(v); return Number.isFinite(n) ? String(n) : null; }
    case 'str': return JSON.stringify(String(v ?? ''));
    case 'bool': return String(v) === 'true' ? 'true' : 'false';
    case 'json': try { return JSON.stringify(JSON.parse(String(v))); } catch { return null; }
    case 'msg': { const p = nrProp(String(v ?? '')); return p.exact ? p.expr : null; }
    default: return null;
  }
}

function nrCondition(rule: Record<string, unknown>, e: string): string | null {
  const a = nrValue(rule.v, rule.vt);
  const ops: Record<string, string> = { eq: '==', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' };
  const t = str(rule.t);
  if (t in ops) return a === null ? null : `${e} ${ops[t]} ${a}`;
  if (t === 'btwn') { const b = nrValue(rule.v2, rule.v2t); return a === null || b === null ? null : `${e} >= ${a} && ${e} <= ${b}`; }
  if (t === 'cont') return a === null ? null : `String(${e}).includes(${a})`;
  if (t === 'true') return `${e} === true`;
  if (t === 'false') return `${e} === false`;
  if (t === 'null') return `${e} == null`;
  if (t === 'nnull') return `${e} != null`;
  if (t === 'empty') return `(${e} === '' || (Array.isArray(${e}) && ${e}.length === 0))`;
  return null;
}

const TIME_UNITS: Record<string, number> = { milliseconds: 1, seconds: 1000, minutes: 60_000, hours: 3_600_000, days: 86_400_000 };

function nrLabel(n: NrNode) { return str(n.name) || n.type; }

function convertNrNode(n: NrNode, base: { nodeId: string; x: number; y: number }): Converted {
  const label = nrLabel(n);
  const outs = n.wires.length;
  const header = `// Converted from Node-RED ${n.type}${n.name ? ` "${str(n.name)}"` : ''}\n`;

  switch (n.type) {
    case 'inject': {
      const repeat = str(n.repeat), cron = str(n.crontab);
      const when = cron ? `// schedule (cron): ${cron}\n` : repeat ? `// repeats every ${repeat} s\n` : n.once ? '// runs once at start\n' : '';
      const changed = !!(repeat || cron);
      return {
        node: { ...base, type: 'TRIGGER', label, script: `${header}${when}return msg;` },
        status: changed ? 'changed' : 'exact',
        note: changed ? `${label}: schedule kept as a comment` : undefined,
        port: (i) => (i === 0 ? 'out' : null),
      };
    }
    case 'switch': {
      const rules = (Array.isArray(n.rules) ? n.rules : []).filter(isObject);
      const prop = str(n.propertyType || 'msg') === 'msg' ? nrProp(str(n.property) || 'payload') : { expr: 'undefined', exact: false };
      const conds = rules.map((r) => (str(r.t) === 'else' ? 'else' : nrCondition(r, 'v')));
      let exact = prop.exact && conds.every((c) => c !== null);
      const nonElse = conds.filter((c) => c !== 'else').length;
      const isFilter = (rules.length === 1 && conds[0] !== 'else') || (rules.length === 2 && conds[0] !== 'else' && conds[1] === 'else');
      if (isFilter) {
        return {
          node: { ...base, type: 'FILTER', label, script: `${header}var v = ${prop.expr};\nreturn !!(${conds[0] ?? 'false'});` },
          status: exact ? 'exact' : 'changed',
          note: exact ? undefined : `${label}: a rule could not be converted`,
          port: (i) => (i === 0 ? 'true' : i === 1 ? 'false' : null),
        };
      }
      const ports: (string | null)[] = [];
      const lines = [`${header}var v = ${prop.expr};`];
      let c = 0;
      conds.forEach((cond) => {
        if (cond === 'else') { ports.push('def'); return; }
        if (c >= 2) { ports.push(null); exact = false; return; }
        c++;
        ports.push(`c${c}`);
        lines.push(`if (${cond ?? 'false'}) return 'c${c}';`);
      });
      lines.push(`return 'def';`);
      const firstMatch = n.checkall !== 'false' && nonElse > 1;
      const notes = [
        nonElse > 2 && `only the first 2 rules kept`,
        firstMatch && 'first matching rule wins',
        !prop.exact && 'property is not in the payload',
      ].filter(Boolean);
      return {
        node: { ...base, type: 'SWITCH', label, script: lines.join('\n') },
        status: exact && !firstMatch ? 'exact' : 'changed',
        note: notes.length ? `${label}: ${notes.join(', ')}` : exact ? undefined : `${label}: a rule could not be converted`,
        port: (i) => ports[i] ?? null,
      };
    }
    case 'change': {
      const rules = (Array.isArray(n.rules) ? n.rules : []).filter(isObject);
      let exact = true;
      const lines = [header.trimEnd()];
      for (const r of rules) {
        const t = str(r.t), p = str(r.p), pt = str(r.pt || 'msg');
        const target = pt === 'msg' ? nrProp(p) : { expr: '', exact: false };
        if (t === 'set' && target.expr && target.expr !== 'undefined') {
          const val = nrValue(r.to, r.tot);
          if (val === null) { exact = false; lines.push(`// set ${pt}.${p}: value type "${str(r.tot)}" not available`); continue; }
          lines.push(`${target.expr} = ${val};`);
          if (!target.exact) exact = false;
        }
        else if (t === 'delete' && target.exact && target.expr !== 'msg') lines.push(`delete ${target.expr};`);
        else { exact = false; lines.push(`// ${t} ${pt}.${p}: not converted`); }
      }
      lines.push('return msg;');
      return {
        node: { ...base, type: 'TRANSFORM', label, script: lines.join('\n') },
        status: exact ? 'exact' : 'changed',
        note: exact ? undefined : `${label}: some rules kept as comments`,
        port: (i) => (i === 0 ? 'out' : null),
      };
    }
    case 'debug':
      return {
        node: { ...base, type: 'ACTION', label, script: `${header}// log the message\nsend(msg);` },
        status: 'exact',
        port: () => null,
      };
    case 'delay': {
      const ms = Number(n.timeout) * (TIME_UNITS[str(n.timeoutUnits)] ?? 1000);
      const plain = str(n.pauseType || 'delay') === 'delay' && Number.isFinite(ms);
      return {
        node: { ...base, type: 'DELAY', label, script: `${header}${plain ? '' : `// mode "${str(n.pauseType)}" is not available: a fixed delay is used\n`}return ${Number.isFinite(ms) ? ms : 1000};` },
        status: plain ? 'exact' : 'changed',
        note: plain ? undefined : `${label}: ${str(n.pauseType)} mode became a fixed delay`,
        port: (i) => (i === 0 ? 'out' : null),
      };
    }
    case 'function':
      return {
        node: { ...base, type: 'TRANSFORM', label,
          script: `${header}// check this code: here msg is the payload (msg.payload in Node-RED)\n${str(n.func)}` },
        status: 'changed',
        note: `${label}: code copied, check it${outs > 1 ? ' (only the first output kept)' : ''}`,
        port: (i) => (i === 0 ? 'out' : null),
      };
    default: {
      const outputs = n.wires.map((_, i) => (outs === 1 ? 'out' : `out${i + 1}`));
      const settings: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(n)) if (!['id', 'type', 'z', 'x', 'y', 'wires', 'g'].includes(k)) settings[k] = v;
      return {
        node: { ...base, type: 'PLACEHOLDER', label,
          original: { type: n.type, source: 'node-red', settings, inputs: ['in'], outputs } },
        status: 'placeholder',
        port: (i) => outputs[i] ?? null,
      };
    }
  }
}

/** Convert a Node-RED flow export: one ruleset per flow tab. */
export function convertNodeRed(flow: unknown[], existing: RuleChain[], now = new Date()): { items: ImportItem[]; report: NodeRedReport } {
  const report: NodeRedReport = { exact: 0, changed: 0, placeholders: 0, skipped: 0 };
  const objs = flow.filter(isObject);
  const tabs = new Map(objs.filter((o) => o.type === 'tab').map((o) => [str(o.id), o]));
  const groups = new Map<string, NrNode[]>();
  for (const o of objs) {
    if (o.type === 'tab') continue;
    if (!Array.isArray(o.wires) || typeof o.type !== 'string' || typeof o.id !== 'string' || o.type === 'comment') {
      report.skipped++; // config nodes, comments, groups
      continue;
    }
    const z = str(o.z) || '_';
    groups.set(z, [...(groups.get(z) ?? []), o as NrNode]);
  }

  const items: ImportItem[] = [];
  let flowNo = 0;
  for (const [z, list] of groups) {
    flowNo++;
    const tab = tabs.get(z);
    const xs = list.map((n) => num(n.x, 100)), ys = list.map((n) => num(n.y, 100));
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const converted = new Map<string, Converted>();
    list.forEach((n, j) => {
      const c = convertNrNode(n, {
        nodeId: `n${j + 1}`,
        x: Math.round((num(n.x, 100) - x0) * 1.5) + 40,
        y: Math.round((num(n.y, 100) - y0) * 2.2) + 40,
      });
      converted.set(n.id, c);
      if (c.status === 'exact') report.exact++;
      else if (c.status === 'changed') report.changed++;
      else report.placeholders++;
    });

    const edges: RuleEdge[] = [];
    let dropped = 0;
    for (const n of list) {
      const src = converted.get(n.id)!;
      n.wires.forEach((targets, i) => {
        for (const t of Array.isArray(targets) ? targets : []) {
          const tgt = converted.get(String(t));
          const port = src.port(i);
          const tgtIn = tgt ? portsOf(tgt.node).inputs[0] : undefined;
          if (!tgt || !port || !tgtIn) { dropped++; continue; }
          edges.push({ edgeId: `e${edges.length + 1}`, sourceNodeId: src.node.nodeId, sourcePort: port, targetNodeId: tgt.node.nodeId, targetPort: tgtIn });
        }
      });
    }

    const all = [...converted.values()];
    const counts = { exact: 0, changed: 0, placeholder: 0 };
    all.forEach((c) => { counts[c.status]++; });
    const notes = [
      `${counts.exact} exact, ${counts.changed} changed, ${plural(counts.placeholder, 'placeholder')}`,
      ...all.map((c) => c.note).filter((s): s is string => !!s),
      ...(dropped ? [`${plural(dropped, 'connection')} dropped`] : []),
    ];
    const name = str(tab?.label).trim() || (groups.size > 1 ? `Node-RED flow ${flowNo}` : 'Node-RED flow');
    const chainId = `nr-${slugify(z === '_' ? String(flowNo) : z) || flowNo}`;
    const clash = existing.find((c) => c.chainId === chainId);
    items.push({
      key: `${flowNo - 1}:${chainId}`,
      chain: {
        chainId, name, slug: slugify(name) || chainId,
        description: str(tab?.info).trim() || 'Imported from Node-RED.',
        active: false, nodes: all.map((c) => c.node), edges, createdAt: now, updatedAt: now,
      },
      nodes: all.length,
      placeholders: counts.placeholder,
      notes,
      ...(clash && { existing: { chainId: clash.chainId, name: clash.name } }),
    });
  }
  return { items, report };
}

/* ─── Versions ───────────────────────────────────────────────────────────── */

export type RulesetVersion = {
  version: number;
  savedAt: string;
  by: string;
  summary: string;
  snapshot: RuleChain;
};

function nodeSig(n: RuleNode) {
  return JSON.stringify([n.type, n.label, n.script ?? '', n.config ?? null, n.original ?? null]);
}

/** A short, human summary of what changed between two versions of a ruleset. */
export function summarizeChange(prev: RuleChain | null, next: RuleChain): string {
  if (!prev) return 'Created';
  const parts: string[] = [];
  const before = new Map(prev.nodes.map((n) => [n.nodeId, n]));
  const after = new Map(next.nodes.map((n) => [n.nodeId, n]));
  const added = next.nodes.filter((n) => !before.has(n.nodeId)).length;
  const removed = prev.nodes.filter((n) => !after.has(n.nodeId)).length;
  const changed = next.nodes.filter((n) => before.has(n.nodeId) && nodeSig(before.get(n.nodeId)!) !== nodeSig(n)).length;
  const eKey = (e: RuleEdge) => `${e.sourceNodeId}:${e.sourcePort}>${e.targetNodeId}:${e.targetPort}`;
  const eBefore = new Set(prev.edges.map(eKey)), eAfter = new Set(next.edges.map(eKey));
  const eAdded = [...eAfter].filter((k) => !eBefore.has(k)).length;
  const eRemoved = [...eBefore].filter((k) => !eAfter.has(k)).length;
  if (added) parts.push(`+${plural(added, 'node')}`);
  if (removed) parts.push(`−${plural(removed, 'node')}`);
  if (changed) parts.push(`${plural(changed, 'node')} changed`);
  if (eAdded) parts.push(`+${plural(eAdded, 'connection')}`);
  if (eRemoved) parts.push(`−${plural(eRemoved, 'connection')}`);
  if (prev.name !== next.name) parts.push('renamed');
  if ((prev.description ?? '') !== (next.description ?? '')) parts.push('description changed');
  return parts.length ? parts.join(', ') : 'No changes';
}

/** Append a version (numbered after the highest one). */
export function addVersion(
  versions: RulesetVersion[], chain: RuleChain, opts: { now?: Date; by: string; summary?: string },
): RulesetVersion[] {
  const now = opts.now ?? new Date();
  const last = versions.reduce<RulesetVersion | null>((a, v) => (!a || v.version > a.version ? v : a), null);
  return [...versions, {
    version: (last?.version ?? 0) + 1,
    savedAt: now.toISOString(),
    by: opts.by,
    summary: opts.summary ?? summarizeChange(last?.snapshot ?? null, chain),
    snapshot: cloneChain(chain),
  }];
}

/**
 * Restore an old version: its content becomes the ruleset again and is saved as
 * a new version, so nothing in between is lost. Keeps the current id, address
 * and on/off state.
 */
export function restoreVersion(
  current: RuleChain, versions: RulesetVersion[], version: number, opts: { now?: Date; by: string },
): { chain: RuleChain; versions: RulesetVersion[] } | null {
  const v = versions.find((x) => x.version === version);
  if (!v) return null;
  const now = opts.now ?? new Date();
  const chain: RuleChain = {
    ...cloneChain(v.snapshot),
    chainId: current.chainId, slug: current.slug, active: current.active,
    createdAt: current.createdAt, updatedAt: now,
  };
  return { chain, versions: addVersion(versions, chain, { now, by: opts.by, summary: `Restored version ${version}` }) };
}

/* ─── Recently deleted ───────────────────────────────────────────────────── */

export const DELETED_KEEP_DAYS = 7;

export type DeletedRuleset = { chain: RuleChain; deletedAt: string };

/** deleted in the last 7 days, newest first */
export function recentlyDeleted(list: DeletedRuleset[], now = new Date()): DeletedRuleset[] {
  const limit = now.getTime() - DELETED_KEEP_DAYS * 86_400_000;
  return list
    .filter((d) => new Date(d.deletedAt).getTime() >= limit)
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** bring a deleted ruleset back; it comes back inactive, with a free id and address */
export function restoreDeleted(chains: RuleChain[], entry: DeletedRuleset, now = new Date()): RuleChain {
  const c = cloneChain(entry.chain);
  return {
    ...c,
    active: false,
    chainId: uniqueValue(c.chainId, chains.map((x) => x.chainId)),
    slug: uniqueValue(c.slug, chains.map((x) => x.slug)),
    updatedAt: now,
  };
}

/* ─── Templates ──────────────────────────────────────────────────────────── */

export type TemplateInputKind = 'text' | 'number' | 'select' | 'time' | 'weekdays' | 'duration';
export type TemplateValue = string | number | string[];

export type TemplateInput = {
  key: string;
  label: string;
  kind: TemplateInputKind;
  default: TemplateValue;
  options?: { value: string; label: string }[];
  /** number / duration (seconds) bounds */
  min?: number;
  max?: number;
  hint?: string;
  required?: boolean;
};

/**
 * A ready-made ruleset. Strings in `name`, node labels, scripts and config may
 * use `{{key}}` (readable text) and `{{json:key}}` (a JS / JSON literal).
 */
export type RulesetTemplate = {
  id: string;
  category: string;
  title: string;
  description: string;
  name: string;
  inputs: TemplateInput[];
  nodes: RuleNode[];
  edges: RuleEdge[];
};

export const WEEKDAYS = [
  { value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' }, { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' }, { value: 'fri', label: 'Fri' }, { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];

/** 90 → "1 min 30 s", 3600 → "1 h" */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return [h && `${h} h`, m && `${m} min`, (r || !s) && `${r} s`].filter(Boolean).join(' ');
}

export function templateDefaults(t: RulesetTemplate): Record<string, TemplateValue> {
  return Object.fromEntries(t.inputs.map((i) => [i.key, Array.isArray(i.default) ? [...i.default] : i.default]));
}

/** errors per input key; empty when the values are usable */
export function validateTemplateValues(t: RulesetTemplate, values: Record<string, TemplateValue>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const i of t.inputs) {
    const v = values[i.key];
    if (i.kind === 'number' || i.kind === 'duration') {
      const n = typeof v === 'number' ? v : Number(v);
      if (v === '' || v === undefined || !Number.isFinite(n)) { errors[i.key] = 'Enter a number.'; continue; }
      if (i.kind === 'duration' && (!Number.isInteger(n) || n < 1)) { errors[i.key] = 'Enter whole seconds (1 or more).'; continue; }
      if (i.min !== undefined && n < i.min) errors[i.key] = `Must be ${i.min} or more.`;
      else if (i.max !== undefined && n > i.max) errors[i.key] = `Must be ${i.max} or less.`;
    }
    else if (i.kind === 'time') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v ?? ''))) errors[i.key] = 'Enter a time as HH:MM.';
    }
    else if (i.kind === 'weekdays') {
      if (!Array.isArray(v) || !v.length) errors[i.key] = 'Choose at least one day.';
    }
    else if (i.kind === 'select') {
      if (!i.options?.some((o) => o.value === v)) errors[i.key] = 'Choose an option.';
    }
    else if (i.required !== false && !String(v ?? '').trim()) errors[i.key] = 'Required.';
  }
  return errors;
}

function readable(i: TemplateInput, v: TemplateValue): string {
  if (i.kind === 'weekdays' && Array.isArray(v)) {
    return v.length === 7 ? 'every day' : WEEKDAYS.filter((d) => v.includes(d.value)).map((d) => d.label).join(', ');
  }
  if (i.kind === 'duration') return formatDuration(Number(v));
  if (i.kind === 'select') return i.options?.find((o) => o.value === v)?.label ?? String(v);
  return String(v);
}

function literal(i: TemplateInput, v: TemplateValue) {
  if (i.kind === 'number' || i.kind === 'duration') return String(Number(v));
  return JSON.stringify(v);
}

function fill(text: string, t: RulesetTemplate, values: Record<string, TemplateValue>) {
  return text.replace(/\{\{(json:)?(\w+)\}\}/g, (m, json: string | undefined, key: string) => {
    const input = t.inputs.find((i) => i.key === key);
    if (!input) return m;
    const v = values[key] ?? input.default;
    return json ? literal(input, v) : readable(input, v);
  });
}

function fillDeep(v: unknown, t: RulesetTemplate, values: Record<string, TemplateValue>): unknown {
  if (typeof v === 'string') return fill(v, t, values);
  if (Array.isArray(v)) return v.map((x) => fillDeep(x, t, values));
  if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillDeep(x, t, values)]));
  return v;
}

/** Build a new (inactive) ruleset from a template and its values. */
export function fillTemplate(
  t: RulesetTemplate, values: Record<string, TemplateValue>, opts: { existing: RuleChain[]; now?: Date; name?: string },
): RuleChain {
  const now = opts.now ?? new Date();
  const name = (opts.name?.trim() || fill(t.name, t, values)).trim() || t.title;
  return {
    chainId: uniqueValue(`chain-${t.id}`, opts.existing.map((c) => c.chainId)),
    name,
    slug: uniqueValue(slugify(name) || t.id, opts.existing.map((c) => c.slug)),
    description: fill(t.description, t, values),
    active: false,
    nodes: t.nodes.map((n) => ({
      ...n,
      label: fill(n.label, t, values),
      ...(n.script !== undefined && { script: fill(n.script, t, values) }),
      ...(n.config && { config: fillDeep(n.config, t, values) as Record<string, unknown> }),
    })),
    edges: t.edges.map((e) => ({ ...e })),
    createdAt: now,
    updatedAt: now,
  };
}
