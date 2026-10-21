import { describe, expect, it } from 'vitest';
import type { Catalog } from '../catalog/types';
import { createDraftStore, type DraftStorage } from './draft';
import { scrubNode, scrubSnapshot, secretTestOf } from './scrub';
import { snapshotOf } from './state';
import type { GraphNode } from './types';

const node = (nodeId: string, extra: Partial<GraphNode> = {}): GraphNode => ({ nodeId, type: 'action.http', label: nodeId, x: 0, y: 0, ...extra });
const state = (nodes: GraphNode[]) => ({ nodes, edges: [], groups: [] });
const memory = () => {
  const data = new Map<string, string>();
  const s: DraftStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  return { s, data };
};

describe('scrubNode', () => {
  it('drops secret values and keeps markers, empty values and other settings', () => {
    const n = node('a', { config: { url: 'u', password: 'p', apiKey: 'k', token: { $secret: true }, secret: null, list: [{ credential: 'c', ok: 1 }] } });
    expect(scrubNode(n).config).toEqual({ url: 'u', token: { $secret: true }, secret: null, list: [{ ok: 1 }] });
    expect((n.config as { password: string }).password).toBe('p');
  });
  it('scrubs the read-only settings of an imported node', () => {
    const n = node('a', { original: { type: 'mqtt in', settings: { broker: 'b', password: 'p' } } });
    expect(scrubNode(n).original?.settings).toEqual({ broker: 'b' });
  });
  it('knows the params a catalog declares as secret', () => {
    const catalog = { blocks: { 'x.y': { params: { dsn: { type: 'secret' }, host: { type: 'string' } } } }, groups: [] } as unknown as Catalog;
    const n = node('a', { type: 'x.y', config: { dsn: 'd', host: 'h' } });
    expect(scrubNode(n, secretTestOf(catalog)).config).toEqual({ host: 'h' });
    expect(scrubNode(n).config).toEqual({ dsn: 'd', host: 'h' });
    expect(secretTestOf(undefined)('x.y', 'dsn')).toBe(false);
  });
});

describe('scrubSnapshot', () => {
  it('scrubs every node', () => {
    const snap = snapshotOf(state([node('a', { config: { password: 'p', u: 1 } }), node('b', { config: { token: 't', u: 2 } })]));
    const out = scrubSnapshot(snap);
    expect(out).not.toContain('"p"');
    expect(out).not.toContain('"t"');
    expect(out).toContain('"u":1');
    expect(out).toContain('"u":2');
  });
  it('is the same text when there is nothing to scrub, and leaves a broken text alone', () => {
    const snap = snapshotOf(state([node('a', { config: { u: 1 } })]));
    expect(scrubSnapshot(snap)).toBe(snap);
    expect(scrubSnapshot('not json')).toBe('not json');
  });
});

describe('the draft keeps no secret', () => {
  const base = snapshotOf(state([node('a', { config: { password: 'old', u: 1 } })]));
  const edited = snapshotOf(state([node('a', { config: { password: 'new', u: 2 } })]));

  it('writes the scrubbed snapshot', () => {
    const { s, data } = memory();
    const store = createDraftStore(() => s);
    expect(store.write('k', edited, base)).toBe(true);
    expect(data.get('k')).not.toContain('new');
    expect(data.get('k')).not.toContain('old');
    expect(store.read('k', base)?.snap).toContain('"u":2');
  });
  it('is no draft when only a secret differs from the saved state', () => {
    const { s } = memory();
    const store = createDraftStore(() => s);
    const onlySecret = snapshotOf(state([node('a', { config: { password: 'new', u: 1 } })]));
    store.write('k', onlySecret, base);
    expect(store.read('k', base)).toBeNull();
  });
});
