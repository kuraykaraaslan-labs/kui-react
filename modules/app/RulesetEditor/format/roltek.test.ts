import { describe, expect, it } from 'vitest';
import { BUILTIN_CATALOG, catalogFromBlocks } from '../catalog';
import { catalogWithSubflows } from '../graph/subflows';
import { validateGraph } from '../graph/validate';
import type { RuleChain, RuleNode, RuleSubflow } from '../types';
import { chainsToRoltek, FLOW_ID_RE, NODE_ID_RE, roltekConfigs, roltekToChains, ROLTEK_FORMAT } from './roltek';

const NOW = new Date('2026-10-04T10:00:00Z');

const catalog = catalogFromBlocks([[
  { type: 'trigger.quota', title: 'Quota', params: { level: { type: 'enum', options: ['exceeded', 'warning'], default: 'exceeded' } } },
  { type: 'action.wifi_set', title: 'Set Wi-Fi', params: { ssid: { type: 'string', required: true }, password: { type: 'secret' } } },
  { type: 'cond.compare', title: 'Compare' },
  { type: 'logic.script', title: 'Script', outputs: { count: 'outputs', prefix: 'o', max: 4 }, params: { code: { type: 'code', lang: 'js', store: 'script' }, outputs: { type: 'number', default: 1 } } },
]]);

const node = (nodeId: string, type: string, extra: Partial<RuleNode> = {}): RuleNode => ({ nodeId, type, label: nodeId, x: 100, y: 80, ...extra });
const edge = (id: string, from: string, port: string, to: string) => ({ edgeId: id, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });

/* the examples of the contract (phases/otomasyon O1), as a file */
const FILE = {
  format: ROLTEK_FORMAT,
  rev: 42,
  flows: [{
    id: 'kota-misafir', name: 'Guest quota', enabled: true, description: 'Switch the guest network off',
    nodes: [
      { id: 'n1', type: 'trigger.quota', params: { level: 'exceeded' }, x: 120, y: 80 },
      { id: 'n2', type: 'action.wifi_set', params: { ssid: 'Guest', password: { $secret: true } }, x: 320, y: 80, name: 'Close guest' },
      { id: 'n3', type: 'subflow.sf-esik', params: { limit: 90 }, x: 520, y: 80 },
    ],
    edges: [{ from: 'n1', from_port: 'out', to: 'n2' }, { from: 'n2', from_port: 'error', to: 'n3' }],
    groups: [{ id: 'g1', name: 'Quota', color: 3, nodes: ['n1', 'n2', 'gone'] }],
  }],
  subflows: [{
    id: 'sf-esik', name: 'Threshold + delay', inputs: 1, outputs: ['high', 'low'],
    params: { limit: { type: 'number', default: 80 } },
    nodes: [{ id: 'i', type: 'port.in', params: {}, x: 0, y: 0 }, { id: 'o1', type: 'port.out', params: { port: 'high' }, x: 400, y: 0 }],
    edges: [{ from: 'i', from_port: 'out', to: 'o1' }],
    groups: [],
  }],
  configs: [],
};

describe('roltekToChains', () => {
  const [conversion] = roltekToChains(FILE, catalog, NOW);
  const chain = conversion.chain;

  it('makes an inactive chain from a flow', () => {
    expect(chain).toMatchObject({ chainId: 'kota-misafir', name: 'Guest quota', slug: 'guest-quota', description: 'Switch the guest network off', active: false });
    expect(chain.createdAt).toEqual(NOW);
  });
  it('maps nodes: id, params to config, name to label, title as the default label', () => {
    expect(chain.nodes.map((n) => [n.nodeId, n.type, n.label])).toEqual([
      ['n1', 'trigger.quota', 'Quota'], ['n2', 'action.wifi_set', 'Close guest'], ['n3', 'subflow.sf-esik', 'Threshold + delay'],
    ]);
    expect(chain.nodes[0]).toMatchObject({ config: { level: 'exceeded' }, x: 120, y: 80 });
    expect(chain.nodes[1].config).toEqual({ ssid: 'Guest', password: { $secret: true } });
  });
  it('maps edges to the ports of the block, error included', () => {
    expect(chain.edges.map((e) => [e.sourceNodeId, e.sourcePort, e.targetNodeId, e.targetPort])).toEqual([
      ['n1', 'out', 'n2', 'in'], ['n2', 'error', 'n3', 'in'],
    ]);
  });
  it('keeps groups and drops members that do not exist', () => {
    expect(chain.groups).toEqual([{ groupId: 'g1', name: 'Quota', color: 3, nodeIds: ['n1', 'n2'] }]);
  });
  it('carries the subflows the flow uses, with their inside', () => {
    expect(chain.subflows).toHaveLength(1);
    const sf = chain.subflows![0];
    expect(sf).toMatchObject({ subflowId: 'sf-esik', inputs: 1, outputs: ['high', 'low'] });
    expect(sf.nodes.map((n) => n.type)).toEqual(['port.in', 'port.out']);
    expect(sf.nodes[1].config).toEqual({ port: 'high' });
    expect(sf.edges).toHaveLength(1);
  });
  it('reports no notes for a clean flow', () => {
    expect(conversion.notes).toEqual([]);
    expect(conversion.placeholders).toBe(0);
  });
  it('makes a flow that validates against its catalog', () => {
    const withSub = catalogWithSubflows(catalog, chain.subflows!);
    expect(validateGraph(chain, withSub).errors).toEqual([]);
  });

  it('turns an unknown block into a placeholder that keeps its wires', () => {
    const file = {
      format: ROLTEK_FORMAT,
      flows: [{
        id: 'f', name: 'F',
        nodes: [{ id: 'a', type: 'trigger.quota', params: {}, x: 0, y: 0 }, { id: 'b', type: 'action.nuke', params: { depth: 3 }, x: 0, y: 0 }],
        edges: [{ from: 'a', from_port: 'out', to: 'b' }, { from: 'b', from_port: 'done', to: 'a' }],
      }],
    };
    const [c] = roltekToChains(file, catalog, NOW);
    expect(c.placeholders).toBe(1);
    expect(c.chain.nodes[1]).toMatchObject({ type: 'PLACEHOLDER', original: { type: 'action.nuke', source: 'roltek', settings: { depth: 3 }, outputs: ['done'] } });
    // the connection into the placeholder stays; the one back into a block with no input is dropped
    expect(c.chain.edges.map((e) => e.sourceNodeId)).toEqual(['a']);
    expect(c.notes).toEqual(['1 node not available here (placeholder)', '1 connection dropped']);
  });

  it('reads an unsupported block of the file as the placeholder it stands for', () => {
    const file = {
      format: ROLTEK_FORMAT,
      flows: [{ id: 'f', name: 'F', nodes: [{ id: 'u', type: 'unsupported', params: { orig_type: 'logic.function', orig_params: { code: 'x' }, ports: ['out', 'error'], reason: 'tier' }, x: 1, y: 2 }], edges: [] }],
    };
    const [c] = roltekToChains(file, catalog, NOW);
    expect(c.chain.nodes[0]).toMatchObject({ type: 'PLACEHOLDER', label: 'logic.function', original: { type: 'logic.function', source: 'roltek', settings: { code: 'x' }, outputs: ['out', 'error'] } });
  });

  it('drops a connection to a port the block does not have, or to a missing node', () => {
    const file = {
      format: ROLTEK_FORMAT,
      flows: [{ id: 'f', name: 'F', nodes: [{ id: 'a', type: 'cond.compare', params: {}, x: 0, y: 0 }, { id: 'b', type: 'cond.compare', params: {}, x: 0, y: 0 }],
        edges: [{ from: 'a', from_port: 'maybe', to: 'b' }, { from: 'a', from_port: 'yes', to: 'zzz' }, { from: 'a', from_port: 'yes', to: 'b' }] }],
    };
    const [c] = roltekToChains(file, catalog, NOW);
    expect(c.chain.edges).toHaveLength(1);
    expect(c.notes).toContain('2 connections dropped');
  });

  it('splits a script out of the params when the block stores it in node.script', () => {
    const file = { format: ROLTEK_FORMAT, flows: [{ id: 'f', name: 'F', nodes: [{ id: 'a', type: 'logic.script', params: { code: 'return msg;', outputs: 2 }, x: 0, y: 0 }], edges: [] }] };
    const node1 = roltekToChains(file, catalog, NOW)[0].chain.nodes[0];
    expect(node1.script).toBe('return msg;');
    expect(node1.config).toEqual({ outputs: 2 });
  });

  it('notes config nodes, and skips duplicate and nameless things', () => {
    const file = {
      format: ROLTEK_FORMAT,
      configs: [{ id: 'broker', type: 'config.mqtt_broker', params: {} }],
      flows: [{ nodes: [{ id: 'a', type: 'subflow.ghost', params: {}, x: 0, y: 0 }, { id: 'a', type: 'cond.compare', params: {}, x: 5, y: 5 }, { type: 'cond.compare', params: {} }], edges: [] }],
    };
    const [c] = roltekToChains(file, catalog, NOW);
    expect(c.chain.chainId).toBe('import-1');
    expect(c.chain.name).toBe('import-1');
    expect(c.chain.nodes.map((n) => n.nodeId)).toEqual(['a', 'n3']);
    expect(c.notes).toEqual(['1 node not available here (placeholder)', '1 config node in the file not imported']);
  });

  it('carries subflows that other subflows use, and only those', () => {
    const file = {
      format: ROLTEK_FORMAT,
      flows: [{ id: 'f', name: 'F', nodes: [{ id: 'a', type: 'subflow.outer', params: {}, x: 0, y: 0 }], edges: [] }],
      subflows: [
        { id: 'outer', name: 'Outer', inputs: 1, outputs: ['out'], params: {}, nodes: [{ id: 'x', type: 'subflow.inner', params: {}, x: 0, y: 0 }], edges: [] },
        { id: 'inner', name: 'Inner', inputs: 1, outputs: ['out'], params: {}, nodes: [], edges: [] },
        { id: 'unused', name: 'Unused', inputs: 1, outputs: ['out'], params: {}, nodes: [], edges: [] },
      ],
    };
    expect(roltekToChains(file, catalog, NOW)[0].chain.subflows?.map((s) => s.subflowId).sort()).toEqual(['inner', 'outer']);
  });

  it('reads a file with no flows as no chains', () => {
    expect(roltekToChains({ format: ROLTEK_FORMAT, flows: [] }, catalog, NOW)).toEqual([]);
    expect(roltekToChains({ format: ROLTEK_FORMAT }, catalog, NOW)).toEqual([]);
  });
});

describe('chainsToRoltek', () => {
  const sf: RuleSubflow = {
    subflowId: 'sf-a', name: 'A', inputs: 1, outputs: ['out'], params: {},
    nodes: [node('pin', 'port.in'), node('pout', 'port.out', { config: { port: 'out' } })],
    edges: [edge('e1', 'pin', 'out', 'pout')], groups: [],
  };
  const chain: RuleChain = {
    chainId: 'guest', name: 'Guest', slug: 'guest', description: 'd', active: true,
    nodes: [
      node('n1', 'trigger.quota', { label: 'Quota', config: { level: 'warning' }, x: 10.4, y: 20.6 }),
      node('n2', 'action.wifi_set', { label: 'Close it', config: { ssid: 'G' }, disabled: true }),
      node('n3', 'subflow.sf-a', { label: 'A' }),
    ],
    edges: [edge('e1', 'n1', 'out', 'n2'), edge('e2', 'n2', 'out', 'n3'), edge('e3', 'n1', 'out', 'ghost')],
    groups: [{ groupId: 'g1', name: 'All', color: 2, nodeIds: ['n1', 'n2', 'gone'] }],
    subflows: [sf],
  };
  const { file } = chainsToRoltek([chain], { catalog, now: NOW });

  it('writes the file header', () => {
    expect(file).toMatchObject({ format: 'roltek-automation-1', exported_at: NOW.toISOString(), source: 'kui-react', configs: [] });
    expect(file).not.toHaveProperty('rev');
  });
  it('writes a flow', () => {
    expect(file.flows[0]).toMatchObject({ id: 'guest', name: 'Guest', enabled: true, description: 'd' });
    expect(file.flows[0].nodes.map((n) => [n.id, n.type, n.x, n.y])).toEqual([['n1', 'trigger.quota', 10, 21], ['n2', 'action.wifi_set', 100, 80], ['n3', 'subflow.sf-a', 100, 80]]);
  });
  it('writes a name only when it differs from the title of the block', () => {
    expect(file.flows[0].nodes[0]).not.toHaveProperty('name');
    expect(file.flows[0].nodes[1]).toMatchObject({ name: 'Close it', disabled: true, params: { ssid: 'G' } });
  });
  it('writes edges and drops those that point nowhere', () => {
    expect(file.flows[0].edges).toEqual([{ from: 'n1', from_port: 'out', to: 'n2' }, { from: 'n2', from_port: 'out', to: 'n3' }]);
  });
  it('writes groups without missing members', () => {
    expect(file.flows[0].groups).toEqual([{ id: 'g1', name: 'All', color: 2, nodes: ['n1', 'n2'] }]);
  });
  it('writes subflows', () => {
    expect(file.subflows).toHaveLength(1);
    expect(file.subflows[0]).toMatchObject({ id: 'sf-a', name: 'A', inputs: 1, outputs: ['out'] });
    expect(file.subflows[0].nodes.map((n) => n.params)).toEqual([{}, { port: 'out' }]);
  });
  it('writes a script into the param its block stores it in', () => {
    const c: RuleChain = { ...chain, nodes: [node('s', 'logic.script', { script: 'return msg;', config: { outputs: 1 } })], edges: [], groups: [], subflows: [] };
    expect(chainsToRoltek([c], { catalog }).file.flows[0].nodes[0].params).toEqual({ outputs: 1, code: 'return msg;' });
    const built = chainsToRoltek([{ ...c, nodes: [node('t', 'TRANSFORM', { script: 'return msg;' })] }]).file.flows[0].nodes[0];
    expect(built.params).toEqual({ script: 'return msg;' });
  });
  it('gives ids that do not fit the format new ones, in nodes, edges and groups', () => {
    const c: RuleChain = {
      ...chain, chainId: 'Some Long Id With Spaces ???', subflows: [],
      nodes: [node('0b6f1c2e-aaaa-bbbb-cccc-111122223333', 'trigger.quota'), node('n1', 'cond.compare')],
      edges: [edge('e', '0b6f1c2e-aaaa-bbbb-cccc-111122223333', 'out', 'n1')],
      groups: [{ groupId: 'g', name: '', color: 0, nodeIds: ['0b6f1c2e-aaaa-bbbb-cccc-111122223333'] }],
    };
    const flow = chainsToRoltek([c], { catalog }).file.flows[0];
    expect(FLOW_ID_RE.test(flow.id)).toBe(true);
    expect(flow.nodes.map((n) => n.id)).toEqual(['n2', 'n1']);
    expect(flow.nodes.every((n) => NODE_ID_RE.test(n.id))).toBe(true);
    expect(flow.edges).toEqual([{ from: flow.nodes[0].id, from_port: 'out', to: 'n1' }]);
    expect(flow.groups?.[0].nodes).toEqual([flow.nodes[0].id]);
    expect(flow.nodes[0].id).not.toBe('n1');
  });
  it('keeps flow ids unique', () => {
    const a = { ...chain, subflows: [] };
    const out = chainsToRoltek([a, { ...a }, { ...a, chainId: 'x'.repeat(40), name: 'Other' }], { catalog }).file.flows.map((f) => f.id);
    expect(new Set(out).size).toBe(3);
    expect(out[0]).toBe('guest');
    expect(out.every((id) => FLOW_ID_RE.test(id))).toBe(true);
  });
  it('shares one subflow between chains', () => {
    const out = chainsToRoltek([chain, { ...chain, chainId: 'second' }], { catalog }).file;
    expect(out.subflows).toHaveLength(1);
  });

  describe('secrets', () => {
    const secret: RuleChain = {
      ...chain, groups: [], subflows: [{ ...sf, nodes: [node('pin', 'port.in', { config: { token: 'abc123' } })] }],
      nodes: [
        node('n1', 'action.wifi_set', { config: { ssid: 'G', password: 'hunter2', nested: { api_key: 'k', ok: 1 }, kept: { token: { $secret: true } } } }),
        node('n2', 'logic.script', { script: 'const token = "password=hunter22"', label: 'url https://user:pw@host/' }),
        node('n3', 'subflow.sf-a'),
      ],
      edges: [], description: 'password: secret1',
    };
    const result = chainsToRoltek([secret], { catalog });
    it('leaves secret settings out and lists them', () => {
      const params = result.file.flows[0].nodes[0].params as Record<string, unknown>;
      expect(params).toEqual({ ssid: 'G', nested: { ok: 1 }, kept: { token: { $secret: true } } });
      expect(result.file.omitted).toEqual([
        { path: 'flows.guest.nodes.n1.params.password', reason: 'secret' },
        { path: 'flows.guest.nodes.n1.params.nested.api_key', reason: 'secret' },
        { path: 'subflows.sf-a.nodes.pin.params.token', reason: 'secret' },
      ]);
      expect(result.omitted).toHaveLength(3);
    });
    it('lists text that looks like a password', () => {
      expect(result.suspicious).toEqual(expect.arrayContaining(['flows.guest.description', 'flows.guest.nodes.n2.script', 'flows.guest.nodes.n2.name']));
    });
  });

  it('does not add omitted when nothing was left out', () => {
    expect(file).not.toHaveProperty('omitted');
  });
});

describe('round trip', () => {
  it('gives back the chain a file was made from', () => {
    const [first] = roltekToChains(FILE, catalog, NOW);
    const out = chainsToRoltek([first.chain], { catalog, now: NOW }).file;
    const [second] = roltekToChains(out as unknown as Record<string, unknown>, catalog, NOW);
    expect(second.chain).toEqual({ ...first.chain, active: false });
    expect(out.flows[0].enabled).toBe(false);
  });
  it('keeps a placeholder through export and import', () => {
    const file = { format: ROLTEK_FORMAT, flows: [{ id: 'f', name: 'F', nodes: [{ id: 'u', type: 'action.nuke', params: { depth: 3 }, x: 5, y: 6, name: 'Boom' }], edges: [] }] };
    const [first] = roltekToChains(file, catalog, NOW);
    const out = chainsToRoltek([first.chain], { catalog, now: NOW }).file;
    expect(out.flows[0].nodes[0]).toMatchObject({ type: 'unsupported', params: { orig_type: 'action.nuke', orig_params: { depth: 3 }, reason: 'unknown' }, name: 'Boom' });
    const [second] = roltekToChains(out as unknown as Record<string, unknown>, catalog, NOW);
    expect(second.chain.nodes[0]).toMatchObject({ type: 'PLACEHOLDER', original: { type: 'action.nuke', settings: { depth: 3 } } });
  });
  it('works for the built-in catalog too', () => {
    const chain: RuleChain = {
      chainId: 'b', name: 'B', slug: 'b', active: false,
      nodes: [node('n1', 'TRIGGER', { script: 'return msg;' }), node('n2', 'FILTER', { script: 'return true;', label: 'Gate' })],
      edges: [edge('e1', 'n1', 'out', 'n2')], createdAt: NOW, updatedAt: NOW,
    };
    const out = chainsToRoltek([chain], { now: NOW }).file;
    const [back] = roltekToChains(out as unknown as Record<string, unknown>, BUILTIN_CATALOG, NOW);
    expect(back.chain.nodes.map((n) => [n.nodeId, n.type, n.script, n.label])).toEqual([['n1', 'TRIGGER', 'return msg;', 'n1'], ['n2', 'FILTER', 'return true;', 'Gate']]);
    expect(back.chain.edges).toHaveLength(1);
  });
});

describe('node descriptions in the roltek file', () => {
  const sf: RuleSubflow = {
    subflowId: 'sf-d', name: 'D', inputs: 1, outputs: ['out'], params: {},
    nodes: [node('pin', 'port.in', { description: 'inner note' }), node('pout', 'port.out', { config: { port: 'out' } })],
    edges: [edge('e1', 'pin', 'out', 'pout')], groups: [],
  };
  const chain: RuleChain = {
    chainId: 'noted', name: 'Noted', slug: 'noted', active: false,
    nodes: [
      node('n1', 'trigger.quota', { label: 'Quota', description: 'why this exists', config: { level: 'warning' } }),
      node('n2', 'action.wifi_set', { label: 'Close it', config: { ssid: 'G' } }),
      node('n3', 'subflow.sf-d', { label: 'D' }),
      node('u', 'PLACEHOLDER', { label: 'Odd', description: 'a note on a placeholder', original: { type: 'mqtt in', source: 'node-red', outputs: ['out'] } }),
    ],
    edges: [edge('e1', 'n1', 'out', 'n2')], groups: [], subflows: [sf],
  };

  it('leaves them out of the file and lists their paths', () => {
    const r = chainsToRoltek([chain], { catalog, now: NOW });
    expect(JSON.stringify(r.file)).not.toContain('why this exists');
    expect(JSON.stringify(r.file)).not.toContain('inner note');
    expect(JSON.stringify(r.file)).not.toContain('a note on a placeholder');
    expect(r.omittedDescriptions.sort()).toEqual(['flows.noted.nodes.n1.description', 'flows.noted.nodes.u.description', 'subflows.sf-d.nodes.pin.description'].sort());
  });
  it('does not put them under the file\'s own omitted list (that one is for secrets, the router counts it so)', () => {
    const r = chainsToRoltek([chain], { catalog, now: NOW });
    expect(r.file).not.toHaveProperty('omitted');
    expect(r.omitted).toEqual([]);
  });
  it('lists nothing when no block has one', () => {
    const plain = { ...chain, nodes: chain.nodes.map((n) => ({ ...n, description: undefined })), subflows: [{ ...sf, nodes: sf.nodes.map((n) => ({ ...n, description: undefined })) }] };
    expect(chainsToRoltek([plain], { catalog, now: NOW }).omittedDescriptions).toEqual([]);
  });
});

describe('comments in the roltek file', () => {
  const cat = catalogFromBlocks([[{ type: 'trigger.quota' }]]);
  const chain: RuleChain = {
    chainId: 'c', name: 'C', slug: 'c', active: false,
    nodes: [node('n1', 'trigger.quota', { label: 'Quota' }), node('k1', 'note.comment', { label: 'Comment', config: { text: 'Why this flow exists' } })],
    edges: [], groups: [], subflows: [],
  };
  it('writes a comment as a note.comment node with its text, and reads it back as a comment', () => {
    const { file } = chainsToRoltek([chain], { catalog: cat, now: NOW });
    expect(file.flows[0].nodes.find((n) => n.id === 'k1')).toMatchObject({ type: 'note.comment', params: { text: 'Why this flow exists' } });
    const back = roltekToChains(JSON.parse(JSON.stringify(file)), cat, NOW)[0].chain;
    expect(back.nodes.find((n) => n.nodeId === 'k1')).toMatchObject({ type: 'note.comment', config: { text: 'Why this flow exists' } });
    expect(back.nodes.some((n) => n.type === 'PLACEHOLDER')).toBe(false);
  });
});

describe('a block with no label in the roltek file', () => {
  const cat = catalogFromBlocks([[{ type: 'trigger.quota', title: 'Quota' }]]);
  it('writes no name, so the router shows the block title, and a label that is not the title stays a name', () => {
    const chain: RuleChain = { chainId: 'c', name: 'C', slug: 'c', active: false, nodes: [node('a', 'trigger.quota', { label: '' }), node('b', 'trigger.quota', { label: 'Mine' })], edges: [], groups: [], subflows: [] };
    const { file } = chainsToRoltek([chain], { catalog: cat, now: NOW });
    expect(file.flows[0].nodes.map((n) => n.name)).toEqual([undefined, 'Mine']);
  });
});

describe('config nodes', () => {
  const cat = catalogFromBlocks([[
    { type: 'config.mqtt_broker', title: 'MQTT broker', params: { host: { type: 'string' }, password: { type: 'secret' }, pin_code: { type: 'secret' }, port: { type: 'number' } } },
    { type: 'trigger.quota', title: 'Quota' },
  ]]);
  const chain: RuleChain = { chainId: 'c', name: 'C', slug: 'c', active: false, nodes: [node('a', 'trigger.quota')], edges: [], groups: [], subflows: [] };
  const broker = { id: 'broker', type: 'config.mqtt_broker', name: 'Main', params: { host: 'mq.local', port: 1883, password: 'pw', pin_code: '', api_token: 'tok', tls: { ca: 'x', private_key: 'k' } } };

  it('exports the configs it is given, every secret as a marker and listed in omitted', () => {
    const { file, omitted } = chainsToRoltek([chain], { catalog: cat, now: NOW, configs: [broker, { ...broker, name: 'dup' }] });
    expect(file.configs).toEqual([{ id: 'broker', type: 'config.mqtt_broker', name: 'Main', params: { host: 'mq.local', port: 1883, password: { $secret: true }, pin_code: { $secret: true }, api_token: { $secret: true }, tls: { ca: 'x' } } }]);
    expect(omitted).toEqual(expect.arrayContaining(['configs.broker.params.password', 'configs.broker.params.api_token', 'configs.broker.params.tls.private_key']));
    expect(omitted).not.toContain('configs.broker.params.pin_code');
    expect(broker.params.password).toBe('pw');
  });

  it('writes no configs when none are given', () => {
    expect(chainsToRoltek([chain], { catalog: cat, now: NOW }).file.configs).toEqual([]);
  });

  it('imports configs with every secret empty, and skips bad ids, duplicates and types the catalog lacks', () => {
    const { file } = chainsToRoltek([chain], { catalog: cat, now: NOW, configs: [broker] });
    const r = roltekConfigs({ ...file, configs: [...file.configs, { id: 'Bad Id', type: 'config.mqtt_broker', params: {} }, { id: 'broker', type: 'config.mqtt_broker', params: {} }, { id: 'other', type: 'config.unknown', params: {} }, 'junk'] }, cat);
    expect(r.configs).toEqual([{ id: 'broker', type: 'config.mqtt_broker', name: 'Main', params: { host: 'mq.local', port: 1883, password: null, pin_code: null, api_token: null, tls: { ca: 'x' } } }]);
    expect(r.secretsToEnter).toEqual(['broker.password', 'broker.pin_code', 'broker.api_token']);
    expect(r.skipped).toEqual([{ id: 'Bad Id', reason: 'bad_id' }, { id: 'broker', reason: 'duplicate' }, { id: 'other', reason: 'unknown_type' }]);
  });

  it('keeps every type without a catalog, and a plain secret sent by mistake comes back empty too', () => {
    const r = roltekConfigs({ configs: [{ id: 'x', type: 'config.unknown', params: { password: 'leaked', host: 'h' } }] });
    expect(r.configs).toEqual([{ id: 'x', type: 'config.unknown', params: { password: null, host: 'h' } }]);
  });

  it('roltekToChains leaves the configs note out when the host imports them', () => {
    const file = { format: ROLTEK_FORMAT, configs: [broker], flows: [{ id: 'f', name: 'F', nodes: [], edges: [] }] };
    expect(roltekToChains(file, cat, NOW)[0].notes).toEqual(['1 config node in the file not imported']);
    expect(roltekToChains(file, cat, NOW, { noteConfigs: false })[0].notes).toEqual([]);
  });
});
