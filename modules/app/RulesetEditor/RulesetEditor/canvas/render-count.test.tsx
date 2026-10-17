import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { RulesetEditor } from '../index';
import { PULSE_ON_MS, type CanvasActivity } from '../../graph/activity';
import * as geometry from '../geometry';
import * as note from '../../catalog/note';
import type { RuleEdge, RuleNode } from '../../types';

/* edgePath runs once per RuleEdge render and isNote once per RuleNode render (no side panel is open): spies on them count the renders */
vi.mock('../geometry', async (orig) => {
  const real = await orig<typeof import('../geometry')>();
  return { ...real, edgePath: vi.fn(real.edgePath) };
});
vi.mock('../../catalog/note', async (orig) => {
  const real = await orig<typeof import('../../catalog/note')>();
  return { ...real, isNote: vi.fn(real.isNote) };
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

const N = 20;
const NODES: RuleNode[] = Array.from({ length: N }, (_, i) => ({ nodeId: `n${i}`, type: i === 0 ? 'TRIGGER' : 'ACTION', label: `Block ${i}`, x: i * 300, y: 0 }));
const EDGES: RuleEdge[] = Array.from({ length: N - 1 }, (_, i) => ({ edgeId: `e${i}`, sourceNodeId: `n${i}`, sourcePort: 'out', targetNodeId: `n${i + 1}`, targetPort: 'in' }));
/* every connection gets a fresh counter object each tick, as a host decoding a socket message does */
const activity = (hot: number): CanvasActivity => ({ edges: Object.fromEntries(EDGES.map((e, i) => [e.edgeId, { count: i === 0 ? hot : 1 }])) });

describe('a live flash re-renders only what changed', () => {
  it('re-renders the one connection that lit up, and no block', () => {
    vi.useFakeTimers();
    const ui = (hot: number) => <RulesetEditor initialNodes={NODES} initialEdges={EDGES} chainName="Chain" activity={activity(hot)} />;
    const { rerender, container } = render(ui(1));
    const edgeRenders = vi.mocked(geometry.edgePath), nodeRenders = vi.mocked(note.isNote);
    edgeRenders.mockClear(); nodeRenders.mockClear();
    rerender(ui(2));
    expect(container.querySelector('[data-edge-id="e0"]')?.parentElement?.querySelector('[data-testid="edge-activity"]')?.getAttribute('data-lit')).toBe('true');
    act(() => { vi.advanceTimersByTime(PULSE_ON_MS + 10); });
    // e0 only: its new count, lit, out (was N - 1 connections and N blocks on every one of those renders)
    expect(edgeRenders.mock.calls.length).toBe(3);
    expect(nodeRenders.mock.calls.length).toBe(0);
  });
});
