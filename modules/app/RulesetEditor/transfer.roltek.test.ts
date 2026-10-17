import { describe, expect, it } from 'vitest';
import type { RuleChain, RuleSubflow } from './types';
import { catalogFromBlocks } from './catalog';
import { chainsToRoltek, ROLTEK_FORMAT, roltekToChains } from './format/roltek';
import { newNode } from './graph/edit';
import { applyImport, buildExport, buildRoltekExport, cloneChain, parseImport, type ImportPreview } from './transfer';

const NOW = new Date('2026-10-04T10:00:00Z');

const catalog = catalogFromBlocks([[
  { type: 'trigger.quota' },
  { type: 'action.notify', params: { token: { type: 'secret' } } },
]]);

const FILE = {
  format: ROLTEK_FORMAT,
  rev: 3,
  flows: [
    { id: 'guest', name: 'Guest', enabled: true, nodes: [{ id: 'n1', type: 'trigger.quota', params: {}, x: 0, y: 0 }, { id: 'n2', type: 'action.notify', params: { token: { $secret: true } }, x: 200, y: 0 }], edges: [{ from: 'n1', from_port: 'out', to: 'n2' }] },
    { id: 'other', name: 'Other', enabled: false, nodes: [{ id: 'n1', type: 'trigger.quota', params: {}, x: 0, y: 0 }], edges: [] },
  ],
  subflows: [],
  configs: [],
};

const sf: RuleSubflow = {
  subflowId: 'sf-a', name: 'A', inputs: 1, outputs: ['out'], params: {},
  nodes: [
    { nodeId: 'pin', type: 'port.in', label: 'in', x: 0, y: 0 },
    { nodeId: 'pout', type: 'port.out', label: 'out', x: 200, y: 0, config: { port: 'out', apiKey: 'secret-key' } },
  ],
  edges: [{ edgeId: 'e1', sourceNodeId: 'pin', sourcePort: 'out', targetNodeId: 'pout', targetPort: 'in' }],
  groups: [],
};

function chain(over: Partial<RuleChain> = {}): RuleChain {
  return {
    chainId: 'guest', name: 'Guest', slug: 'guest', active: true,
    nodes: [
      { nodeId: 'n1', type: 'TRIGGER', label: 'In', x: 0, y: 0 },
      { nodeId: 'n2', type: 'TRANSFORM', label: 'Shape', x: 200, y: 0, config: { password: 'pw' } },
    ],
    edges: [{ edgeId: 'e1', sourceNodeId: 'n1', sourcePort: 'out', targetNodeId: 'n2', targetPort: 'in' }],
    groups: [{ groupId: 'g1', name: 'Both', color: 4, nodeIds: ['n1', 'n2'] }],
    subflows: [sf],
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-02-01'),
    ...over,
  };
}

describe('parseImport of roltek-automation-1', () => {
  it('reads a roltek file into a preview', () => {
    const r = parseImport(JSON.stringify(FILE), [], { now: NOW, catalog }) as ImportPreview;
    expect(r.ok).toBe(true);
    expect(r.source).toBe('roltek');
    expect(r.items.map((i) => [i.key, i.chain.chainId, i.chain.active, i.nodes, i.placeholders])).toEqual([
      ['0:guest', 'guest', false, 2, 0], ['1:other', 'other', false, 1, 0],
    ]);
  });
  it('flags a flow whose id exists already', () => {
    const r = parseImport(JSON.stringify(FILE), [chain({ chainId: 'other', name: 'Mine' })], { now: NOW, catalog }) as ImportPreview;
    expect(r.items[0].existing).toBeUndefined();
    expect(r.items[1].existing).toEqual({ chainId: 'other', name: 'Mine' });
  });
  it('turns every block into a placeholder when no catalog is given', () => {
    const r = parseImport(JSON.stringify(FILE), [], { now: NOW }) as ImportPreview;
    expect(r.items[0].placeholders).toBe(2);
    expect(r.items[0].notes).toEqual(['2 nodes not available here (placeholder)']);
  });
  it('carries the config nodes of the file, secrets empty, instead of a note per flow', () => {
    const file = { ...FILE, configs: [{ id: 'acct', type: 'action.notify', params: { token: { $secret: true }, label: 'A' } }] };
    const r = parseImport(JSON.stringify(file), [], { now: NOW, catalog }) as ImportPreview;
    expect(r.configs).toEqual({ configs: [{ id: 'acct', type: 'action.notify', params: { token: null, label: 'A' } }], secretsToEnter: ['acct.token'], skipped: [] });
    expect(r.items[0].notes).toEqual([]);
    expect((parseImport(JSON.stringify(FILE), [], { now: NOW, catalog }) as ImportPreview).configs).toBeUndefined();
  });
  it('writes the configs it is given into a roltek export', () => {
    const r = buildRoltekExport([chain()], { now: NOW, catalog, configs: [{ id: 'acct', type: 'action.notify', params: { token: 't' } }] });
    expect(r.file.configs).toEqual([{ id: 'acct', type: 'action.notify', params: { token: { $secret: true } } }]);
    expect(r.omitted).toContain('configs.acct.params.token');
  });
  it('rejects a file without flows, or with too many', () => {
    expect(parseImport(JSON.stringify({ format: ROLTEK_FORMAT, flows: [] }), [])).toMatchObject({ ok: false, code: 'empty' });
    expect(parseImport(JSON.stringify({ format: ROLTEK_FORMAT }), [])).toMatchObject({ ok: false, code: 'empty' });
    const many = { format: ROLTEK_FORMAT, flows: Array.from({ length: 201 }, (_, i) => ({ id: 'f' + i, name: 'F', nodes: [], edges: [] })) };
    expect(parseImport(JSON.stringify(many), [])).toMatchObject({ ok: false, code: 'too-big' });
  });
  it('applies like any other import: inactive, copies on a clash', () => {
    const existing = [chain({ chainId: 'other', name: 'Mine', slug: 'mine' })];
    const r = parseImport(JSON.stringify(FILE), existing, { now: NOW, catalog }) as ImportPreview;
    const out = applyImport(existing, r.items, {}, NOW);
    expect(out.added).toBe(2);
    expect(out.chains.map((c) => c.chainId)).toEqual(['other', 'guest', 'other-copy']);
    expect(out.imported.every((c) => !c.active)).toBe(true);
  });
  it('keeps reading kui-ruleset-1 files', () => {
    const exported = buildExport([chain()], { now: NOW }).json;
    expect((parseImport(exported, []) as ImportPreview).source).toBe('kui');
  });
});

describe('buildRoltekExport', () => {
  const r = buildRoltekExport([chain()], { now: NOW });
  it('builds a file, its text and a file name', () => {
    expect(r.file.format).toBe(ROLTEK_FORMAT);
    expect(JSON.parse(r.json)).toEqual(JSON.parse(JSON.stringify(r.file)));
    expect(r.fileName).toBe('automation-guest-2026-10-04.json'.replace('2026-10-04', r.fileName.slice(-15, -5)));
    expect(r.fileName).toMatch(/^automation-guest-\d{4}-\d{2}-\d{2}\.json$/);
  });
  it('names all-exports and suffixes', () => {
    expect(buildRoltekExport([chain(), chain({ chainId: 'b' })], { all: true, now: NOW }).fileName).toMatch(/^automation-all-/);
    expect(buildRoltekExport([chain()], { now: NOW, suffix: 'v2' }).fileName).toMatch(/^automation-guest-v2-/);
  });
  it('lists the secrets it left out, including the ones inside subflows', () => {
    const used = chain({ nodes: [...chain().nodes, { nodeId: 'n3', type: 'subflow.sf-a', label: 'A', x: 400, y: 0 }] });
    const withSub = buildRoltekExport([used], { now: NOW });
    expect(withSub.omitted).toEqual(['flows.guest.nodes.n2.params.password', 'subflows.sf-a.nodes.pout.params.apiKey']);
    expect(JSON.stringify(withSub.file)).not.toContain('secret-key');
    expect(JSON.stringify(withSub.file)).not.toContain('"pw"');
  });
  it('can be read back into the same chains', () => {
    const used = chain({ nodes: [...chain().nodes, { nodeId: 'n3', type: 'subflow.sf-a', label: 'A', x: 400, y: 0 }] });
    const back = parseImport(buildRoltekExport([used], { now: NOW }).json, [], { now: NOW }) as ImportPreview;
    expect(back.source).toBe('roltek');
    expect(back.items[0].chain.nodes.map((n) => n.type)).toEqual(['TRIGGER', 'TRANSFORM', 'subflow.sf-a']);
    expect(back.items[0].chain.subflows?.[0].subflowId).toBe('sf-a');
  });
  it('does not write a subflow that no node uses', () => {
    expect(r.file.subflows).toEqual([]);
    expect(r.omitted).toEqual(['flows.guest.nodes.n2.params.password']);
  });
});

describe('groups and subflows in kui-ruleset-1', () => {
  it('survive an export and an import', () => {
    const exported = buildExport([chain()], { now: NOW });
    const r = parseImport(exported.json, [], { now: NOW }) as ImportPreview;
    const back = r.items[0].chain;
    expect(back.groups).toEqual([{ groupId: 'g1', name: 'Both', color: 4, nodeIds: ['n1', 'n2'] }]);
    expect(back.subflows?.[0]).toMatchObject({ subflowId: 'sf-a', outputs: ['out'] });
  });
  it('are scrubbed of secrets like nodes are', () => {
    const exported = buildExport([chain()], { now: NOW });
    expect(exported.file.rulesets[0].subflows?.[0].nodes[1].config).toEqual({ port: 'out', apiKey: null });
    expect(exported.omitted).toContain('Guest / subflow A / out / config.apiKey');
    expect(chain().subflows?.[0].nodes[1].config?.apiKey).toBe('secret-key');
  });
  it('are read leniently: bad groups and subflows are skipped, missing members dropped', () => {
    const file = JSON.parse(buildExport([chain()], { now: NOW }).json);
    file.rulesets[0].groups = [{ groupId: 'g1', name: 'x', color: 99, nodeIds: ['n1'] }, { groupId: 'g2', name: 'ok', color: 1, nodeIds: ['n1', 'zzz'] }, { groupId: 'g3', name: 'empty', color: 1, nodeIds: ['zzz'] }];
    file.rulesets[0].subflows = [{ subflowId: 'broken' }, ...file.rulesets[0].subflows];
    const back = (parseImport(JSON.stringify(file), [], { now: NOW }) as ImportPreview).items[0].chain;
    expect(back.groups).toEqual([{ groupId: 'g2', name: 'ok', color: 1, nodeIds: ['n1'] }]);
    expect(back.subflows?.map((s) => s.subflowId)).toEqual(['sf-a']);
  });
  it('are left out when a chain has none', () => {
    const plain = chain();
    delete plain.groups;
    delete plain.subflows;
    const back = (parseImport(buildExport([plain], { now: NOW }).json, [], { now: NOW }) as ImportPreview).items[0].chain;
    expect(back).not.toHaveProperty('groups');
    expect(back).not.toHaveProperty('subflows');
  });
});

describe('cloneChain', () => {
  it('copies groups and subflows deeply', () => {
    const original = chain();
    const copy = cloneChain(original);
    copy.groups![0].nodeIds.push('x');
    copy.subflows![0].nodes[1].config!.port = 'changed';
    expect(original.groups![0].nodeIds).toEqual(['n1', 'n2']);
    expect(original.subflows![0].nodes[1].config!.port).toBe('out');
  });
  it('adds nothing a chain did not have', () => {
    const plain = chain();
    delete plain.groups;
    delete plain.subflows;
    const copy = cloneChain(plain);
    expect(copy).not.toHaveProperty('groups');
    expect(copy).not.toHaveProperty('subflows');
  });
});

describe('the block version of a node (v)', () => {
  const versioned = catalogFromBlocks([[{ type: 'trigger.quota', version: 2 }, { type: 'action.notify', version: 3 }]]);
  const file = { format: ROLTEK_FORMAT, flows: [{ id: 'f', name: 'F', enabled: true, nodes: [{ id: 'n1', type: 'trigger.quota', params: {}, x: 0, y: 0, v: 2 }, { id: 'n2', type: 'action.notify', params: {}, x: 200, y: 0 }], edges: [] }], subflows: [], configs: [] };

  it('is read on import, kept untouched when a node has none, and written back on export', () => {
    const [c] = roltekToChains(file, versioned, NOW);
    expect(c.chain.nodes[0].v).toBe(2);
    expect(c.chain.nodes[1].v).toBeUndefined();
    const out = chainsToRoltek([c.chain], { catalog: versioned, now: NOW }).file;
    expect(out.flows[0].nodes[0].v).toBe(2);
    expect(out.flows[0].nodes[1]).not.toHaveProperty('v');
  });

  it('ignores a version that is not a whole number of at least 1', () => {
    const bad = { ...file, flows: [{ ...file.flows[0], nodes: [{ ...file.flows[0].nodes[0], v: 0 }, { ...file.flows[0].nodes[1], v: 1.5 }] }] };
    const [c] = roltekToChains(bad, versioned, NOW);
    expect(c.chain.nodes.map((n) => n.v)).toEqual([undefined, undefined]);
  });

  it('is stamped on a node made from a block that declares a version', () => {
    const n = newNode(versioned, 'action.notify', { x: 0, y: 0 }, [], { width: 100, headerHeight: 20 });
    expect(n.v).toBe(3);
    expect(newNode(catalog, 'action.notify', { x: 0, y: 0 }, [], { width: 100, headerHeight: 20 })).not.toHaveProperty('v');
  });
});
