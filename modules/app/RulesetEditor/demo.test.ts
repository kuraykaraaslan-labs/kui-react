import { describe, expect, it } from 'vitest';
import { DEMO_CATALOG, DEMO_CHOICES, DEMO_FLOW } from './demo';
import { chainsToRoltek, roltekToChains } from './format/roltek';
import { validateGraph } from './graph/validate';
import { validateParams } from './catalog/params';
import type { RuleChain } from './types';

const chain: RuleChain = { chainId: 'demo', name: 'Boiler', slug: 'boiler', active: false, ...DEMO_FLOW };

describe('the sample', () => {
  it('has the field types the demo is meant to show', () => {
    const types = new Set(Object.values(DEMO_CATALOG.blocks).flatMap((b) => Object.values(b.params ?? {}).map((p) => p.type)));
    for (const t of ['enum', 'time', 'weekdays', 'cron', 'number', 'source', 'topic', 'value', 'rules', 'code', 'duration', 'template', 'secret', 'bool', 'path', 'string', 'text']) {
      expect(types.has(t as never), t).toBe(true);
    }
  });
  it('uses only lists the host provides', () => {
    const sources = new Set(Object.values(DEMO_CATALOG.blocks).flatMap((b) => Object.values(b.params ?? {}).map((p) => p.source).filter(Boolean)));
    for (const s of sources) expect(DEMO_CHOICES[s as string], String(s)).toBeDefined();
  });
  it('has defaults that pass their own schema', () => {
    for (const block of Object.values(DEMO_CATALOG.blocks)) {
      const values = Object.fromEntries(Object.entries(block.params ?? {}).filter(([, s]) => s.default !== undefined && s.store !== 'script').map(([k, s]) => [k, s.default]));
      expect(validateParams(block, values).filter((i) => i.code !== 'required'), block.type).toEqual([]);
    }
  });
  it('has the flow with exactly the one problem it is meant to show', () => {
    const result = validateGraph({ nodes: DEMO_FLOW.nodes, edges: DEMO_FLOW.edges }, DEMO_CATALOG, { flowId: 'boiler-demo' });
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => [w.code, w.nodeId, w.param])).toEqual([['required', 'n4', 'channels']]);
  });
  it('runs a flow the host lists as callable', () => {
    const run = DEMO_FLOW.nodes.find((n) => n.type === 'action.flow_run');
    expect(DEMO_CHOICES.flows.map((c) => c.value)).toContain(run?.config?.flow);
    expect(DEMO_CATALOG.blocks['trigger.flow_input']).toMatchObject({ group: 'flow', inputs: 0, outputs: ['out'] });
    expect(DEMO_CATALOG.groups.some((g) => g.id === 'flow')).toBe(true);
  });
  it('survives a trip through roltek-automation-1', () => {
    const { file } = chainsToRoltek([chain], { catalog: DEMO_CATALOG });
    expect(file.flows[0].groups).toHaveLength(1);
    expect(file).not.toHaveProperty('subflows');
    const [back] = roltekToChains(JSON.parse(JSON.stringify(file)), DEMO_CATALOG);
    expect(back.placeholders).toBe(0);
    expect(back.chain.nodes.map((n) => [n.nodeId, n.type, n.label])).toEqual(chain.nodes.map((n) => [n.nodeId, n.type, n.label]));
    expect(back.chain.edges.map((e) => [e.sourceNodeId, e.sourcePort, e.targetNodeId])).toEqual(chain.edges.map((e) => [e.sourceNodeId, e.sourcePort, e.targetNodeId]));
    expect(back.chain.groups).toEqual(chain.groups);
    expect(back.chain).not.toHaveProperty('subflows');
  });
});
