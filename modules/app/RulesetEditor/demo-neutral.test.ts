import { describe, expect, it } from 'vitest';
import { NEUTRAL_CATALOG, NEUTRAL_CHOICES, NEUTRAL_DIFF, NEUTRAL_FLOW, NEUTRAL_FLOW_NEXT } from './demo-neutral';
import { validateGraph } from './graph/validate';
import { buildRoltekExport } from './transfer';
import { roltekToChains } from './format/roltek';
import { paletteGroups } from './catalog/palette';

describe('the neutral demo', () => {
  it('has a next version whose compare tints one changed, one added and one removed block', () => {
    expect(validateGraph(NEUTRAL_FLOW_NEXT, NEUTRAL_CATALOG, { active: true })).toEqual({ errors: [], warnings: [] });
    expect(NEUTRAL_DIFF.tint.nodes).toEqual({ n2: 'changed', n4: 'removed', n5: 'added' });
    expect(NEUTRAL_DIFF.nodes.map((n) => n.nodeId)).toEqual(['n1', 'n2', 'n3', 'n5', 'n4']);
  });
  it('has no device in it: the blocks are schedule, webhook in, compare, notification and webhook out', () => {
    expect(Object.keys(NEUTRAL_CATALOG.blocks).sort()).toEqual(['action.notify', 'action.webhook', 'cond.compare', 'trigger.schedule', 'trigger.webhook_in']);
    expect(JSON.stringify(NEUTRAL_CATALOG)).not.toMatch(/mqtt|modbus|device|sensor|telemetry/i);
  });
  it('offers its blocks in the palette, grouped', () => {
    const types = paletteGroups(NEUTRAL_CATALOG).flatMap((g) => g.blocks.map((b) => b.type));
    expect(types.sort()).toEqual(['action.notify', 'action.webhook', 'cond.compare', 'trigger.schedule', 'trigger.webhook_in']);
  });
  it('has a flow with no error or warning, with every block known to the catalog', () => {
    expect(validateGraph(NEUTRAL_FLOW, NEUTRAL_CATALOG, { active: true })).toEqual({ errors: [], warnings: [] });
    expect(NEUTRAL_FLOW.nodes.every((n) => NEUTRAL_CATALOG.blocks[n.type])).toBe(true);
  });
  it('offers the teams its notify block asks for, and the flow names one of them', () => {
    const teams = NEUTRAL_CHOICES.teams.map((t) => t.value);
    expect(NEUTRAL_FLOW.nodes.find((n) => n.type === 'action.notify')?.config?.to).toSatisfy((v: string) => teams.includes(v));
  });
  it('goes into the roltek file and comes back with every block known (none turns into a placeholder)', () => {
    const chain = { chainId: 'overdue', name: 'Overdue', slug: 'overdue', active: false, ...NEUTRAL_FLOW, groups: [], subflows: [] };
    const out = buildRoltekExport([chain], { catalog: NEUTRAL_CATALOG });
    expect(out.file.flows[0].nodes.map((n) => n.type)).toEqual(['trigger.schedule', 'cond.compare', 'action.notify', 'action.webhook']);
    const back = roltekToChains(JSON.parse(out.json), NEUTRAL_CATALOG)[0].chain;
    expect(back.nodes.map((n) => n.type)).toEqual(['trigger.schedule', 'cond.compare', 'action.notify', 'action.webhook']);
    expect(back.nodes.find((n) => n.type === 'action.notify')?.config).toMatchObject({ channel: 'email', to: 'finance' });
  });
});
