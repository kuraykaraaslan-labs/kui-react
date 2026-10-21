import { describe, expect, it } from 'vitest';
import { aggregateErrors, barPct, busiestRows, caughtRows, fillOf, formatBytes, rootNode } from './stats';

describe('rootNode', () => {
  it('takes the canvas block of an id with a path', () => {
    expect(rootNode('s1/x')).toBe('s1');
    expect(rootNode('a/b/x')).toBe('a');
    expect(rootNode('n1')).toBe('n1');
    expect(rootNode(null)).toBe('');
  });
});

describe('busiestRows', () => {
  const nodes = {
    a: { in: 5, out: 5, avgMs: 2 },
    b: { in: 9, out: { ok: 4, err: 1 }, errors: 3, avgMs: 0.5 },
    c: { in: 0, out: 0 },
    d: { in: 9, out: 1, avgMs: 7 },
  };
  it('sorts by key, ties by in then id, and drops silent blocks', () => {
    expect(busiestRows(nodes, 'in').map((r) => r.id)).toEqual(['b', 'd', 'a']);
    expect(busiestRows(nodes, 'ms').map((r) => r.id)).toEqual(['d', 'a', 'b']);
    expect(busiestRows(nodes, 'errors').map((r) => r.id)).toEqual(['b', 'd', 'a']);
  });
  it('sums the out ports', () => {
    expect(busiestRows(nodes, 'in').find((r) => r.id === 'b')!.out).toBe(5);
  });
  it('copes with nothing', () => {
    expect(busiestRows(undefined, 'in')).toEqual([]);
  });
  it('scales a bar against the biggest', () => {
    expect(barPct(5, 10)).toBe(50);
    expect(barPct(0, 0)).toBe(0);
  });
});

describe('aggregateErrors', () => {
  it('merges the same text on the same block and counts only errors', () => {
    const rows = aggregateErrors([
      { seq: 1, ts: 10, node: 'a', kind: 'error', text: 'x' },
      { seq: 2, ts: 20, node: 'a', kind: 'error', text: 'x' },
      { seq: 3, ts: 30, node: 'a', kind: 'warn', text: 'w' },
      { seq: 4, ts: 5, node: 'b', kind: 'error', text: 'y' },
    ]);
    expect(rows.map((r) => [r.node, r.count, r.last])).toEqual([['a', 2, 20], ['b', 1, 5]]);
  });
});

describe('caughtRows', () => {
  it('lists only caught errors, one row per block, text and catcher', () => {
    const rows = caughtRows([
      { ts: 100, errors: [{ node: 'a', message: 'boom', caught: 'c1' }, { node: 'a', message: 'free' }] },
      { ts: 200, errors: [{ node: 'a', message: 'boom', caught: 'c1' }, { node: 'b', code: 'E', caught: 'b' }] },
    ]);
    expect(rows).toEqual([
      { node: 'a', text: 'boom', caught: 'c1', count: 2, last: 200 },
      { node: 'b', text: 'E', caught: 'b', count: 1, last: 200 },
    ].sort((x, y) => y.last - x.last));
  });
});

describe('fillOf', () => {
  it('is null without numbers or limit', () => {
    expect(fillOf(undefined, 100)).toBeNull();
    expect(fillOf(10, 0)).toBeNull();
    expect(fillOf(10, undefined)).toBeNull();
  });
  it('picks the tone: warn from 80, full at 100, capped', () => {
    expect(fillOf(79, 100)!.tone).toBe('ok');
    expect(fillOf(80, 100)!.tone).toBe('warn');
    expect(fillOf(100, 100)!.tone).toBe('full');
    expect(fillOf(250, 100)).toMatchObject({ pct: 100, tone: 'full' });
    expect(fillOf(0, 100)).toMatchObject({ pct: 0, tone: 'ok' });
  });
  it('formats bytes', () => {
    expect(formatBytes(2048)).toBe('2.0 kB');
    expect(formatBytes(1572864)).toBe('1.5 MB');
  });
});
