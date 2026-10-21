import { describe, expect, it, vi } from 'vitest';
import { createFlowCache, findCallers, findFlowInputs, findIns, findRunners, isFlowBlock, isLinkBlock, linkHits, linkNames, noHitsMessage, type LinkFlow } from './links';
import type { RuleNode } from '../types';

const n = (nodeId: string, type: string, config: Record<string, unknown> = {}, label = nodeId): RuleNode => ({ nodeId, type, label, x: 0, y: 0, config });
const flow = (id: string, nodes: RuleNode[]): LinkFlow => ({ id, name: `Flow ${id}`, nodes });

describe('linkNames', () => {
  it('reads the name of each kind of link block', () => {
    expect(linkNames(n('a', 'trigger.link_in', { name: 'alarm' }))).toEqual(['alarm']);
    expect(linkNames(n('a', 'logic.link_call', { target: 'calc' }))).toEqual(['calc']);
    expect(linkNames(n('a', 'action.link_out', { targets: ['x', 'y', 'x', 5, ''] }))).toEqual(['x', 'y']);
  });
  it('a link out in return mode points nowhere', () => {
    expect(linkNames(n('a', 'action.link_out', { mode: 'return', targets: ['x'] }))).toEqual([]);
  });
  it('is empty for other blocks and empty names', () => {
    expect(linkNames(n('a', 'FILTER', { name: 'x' }))).toEqual([]);
    expect(linkNames(n('a', 'trigger.link_in', { name: '' }))).toEqual([]);
    expect(linkNames(n('a', 'trigger.link_in'))).toEqual([]);
    expect(linkNames(null)).toEqual([]);
  });
  it('knows a link block', () => {
    expect(isLinkBlock(n('a', 'logic.link_call'))).toBe(true);
    expect(isLinkBlock(n('a', 'FILTER'))).toBe(false);
    expect(isLinkBlock(undefined)).toBe(false);
    expect(isFlowBlock(n('a', 'action.flow_run'))).toBe(true);
    expect(isFlowBlock(n('a', 'trigger.flow_input'))).toBe(true);
    expect(isFlowBlock(n('a', 'logic.link_call'))).toBe(false);
  });
});

describe('finding hits', () => {
  const here = flow('a', [n('out1', 'action.link_out', { targets: ['alarm'] }), n('in1', 'trigger.link_in', { name: 'calc' }, 'Calc in')]);
  const there = flow('b', [n('in2', 'trigger.link_in', { name: 'alarm' }, 'Alarm in'), n('call', 'logic.link_call', { target: 'calc' }, 'Call calc')]);
  const flows = [here, there];

  it('finds the link ins of a name, across flows', () => {
    expect(findIns(flows, ['alarm'])).toEqual([{ flow: 'b', flowName: 'Flow b', node: 'in2', name: 'Alarm in', link: 'alarm' }]);
  });
  it('finds the callers of a name, across flows', () => {
    expect(findCallers(flows, 'calc').map((h) => h.node)).toEqual(['call']);
    expect(findCallers(flows, 'nothing')).toEqual([]);
  });
  it('a link out leads to its link in, a link in lists its callers', () => {
    expect(linkHits(flows, here.nodes[0], { id: 'a' }).map((h) => h.node)).toEqual(['in2']);
    expect(linkHits(flows, here.nodes[1], { id: 'a' }).map((h) => h.node)).toEqual(['call']);
  });
  it('narrows a link out to one target', () => {
    const out = n('o', 'action.link_out', { targets: ['alarm', 'calc'] });
    expect(linkHits(flows, out, { id: 'a' }).map((h) => h.node).sort()).toEqual(['in1', 'in2']);
    expect(linkHits(flows, out, { id: 'a' }, 'calc').map((h) => h.node)).toEqual(['in1']);
  });
  it('never offers the block itself', () => {
    const self = n('s', 'logic.link_call', { target: 'me' });
    const lonely = flow('a', [self, n('in', 'trigger.link_in', { name: 'me' })]);
    expect(linkHits([lonely], lonely.nodes[1], { id: 'a' }).map((h) => h.node)).toEqual(['s']);
    const loop = n('l', 'trigger.link_in', { name: 'x' });
    expect(linkHits([flow('a', [loop])], loop, { id: 'a' })).toEqual([]);
  });
  it('a flow_run block leads to the flow_input of its flow, a flow_input lists the blocks that run its flow', () => {
    const run = n('r', 'action.flow_run', { flow: 'b' }, 'Run b');
    const a = flow('a', [run]);
    const b = flow('b', [n('fi', 'trigger.flow_input', {}, 'Entry')]);
    expect(linkHits([a, b], run, { id: 'a' }).map((h) => [h.flow, h.node])).toEqual([['b', 'fi']]);
    expect(linkHits([a, b], b.nodes[0], { id: 'b' }).map((h) => [h.flow, h.node])).toEqual([['a', 'r']]);
    expect(findFlowInputs([a, b], 'a')).toEqual([]);
    expect(findRunners([a, b], 'c')).toEqual([]);
  });
  it('a flow_run without a flow leads nowhere', () => {
    const run = n('r', 'action.flow_run', {});
    expect(linkHits([flow('a', [run])], run, { id: 'a' })).toEqual([]);
  });
  it('says what was not found', () => {
    expect(noHitsMessage(n('a', 'trigger.link_in', { name: 'x' }))).toBe('No block calls this link in.');
    expect(noHitsMessage(n('a', 'action.link_out', { targets: ['x', 'y'] }))).toBe('No link in is called x, y.');
    expect(noHitsMessage(n('a', 'action.link_out', { targets: [] }), 'z')).toBe('No link in is called z.');
    expect(noHitsMessage(n('a', 'trigger.flow_input'))).toBe('No Run flow block runs this flow.');
  });
});

describe('createFlowCache', () => {
  it('asks the host once within 30 s and again after', async () => {
    let t = 1000;
    const load = vi.fn(async (ids: string[]) => ids.map((id) => flow(id, [])));
    const cache = createFlowCache(load, 30_000, () => t);
    expect((await cache.get(['a', 'b'])).map((f) => f.id)).toEqual(['a', 'b']);
    t += 29_000;
    await cache.get(['a', 'b']);
    expect(load).toHaveBeenCalledTimes(1);
    t += 2000;
    await cache.get(['a']);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('asks only for the ids it lacks', async () => {
    const load = vi.fn(async (ids: string[]) => ids.map((id) => flow(id, [])));
    const cache = createFlowCache(load);
    await cache.get(['a']);
    await cache.get(['a', 'b']);
    expect(load).toHaveBeenLastCalledWith(['b']);
  });
  it('falls back to what it has when the host fails', async () => {
    let t = 0;
    let fail = false;
    const load = vi.fn(async (ids: string[]) => { if (fail) throw new Error('down'); return ids.map((id) => flow(id, [])); });
    const cache = createFlowCache(load, 1000, () => t);
    await cache.get(['a']);
    fail = true;
    t += 5000;
    expect((await cache.get(['a'])).map((f) => f.id)).toEqual(['a']);
  });
  it('does not ask again for an id the host does not know until it expires', async () => {
    const load = vi.fn(async () => [] as LinkFlow[]);
    const cache = createFlowCache(load);
    await cache.get(['ghost']);
    expect(await cache.get(['ghost'])).toEqual([]);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('clear forgets everything', async () => {
    const load = vi.fn(async (ids: string[]) => ids.map((id) => flow(id, [])));
    const cache = createFlowCache(load);
    await cache.get(['a']);
    cache.clear();
    await cache.get(['a']);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
