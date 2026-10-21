import { describe, expect, it } from 'vitest';
import { edgeActivityOf, outTotal, portCount, pulseStep, PULSE_GAP_MS, type PulseMemory } from './activity';

const edges = [
  { edgeId: 'e1', sourceNodeId: 'a', sourcePort: 'out' },
  { edgeId: 'e2', sourceNodeId: 'a', sourcePort: 'error' },
  { edgeId: 'e3', sourceNodeId: 'b', sourcePort: 'true' },
];

describe('activity counters', () => {
  it('reads a port count from a number or a per-port map', () => {
    expect(portCount({ out: 5 }, 'out')).toBe(5);
    expect(portCount({ out: 5 }, 'error')).toBeNull();
    expect(portCount({ out: { true: 2 } }, 'true')).toBe(2);
    expect(portCount({ out: { true: 2 } }, 'false')).toBeNull();
    expect(portCount(undefined, 'out')).toBeNull();
    expect(outTotal({ out: { a: 2, b: 3 } })).toBe(5);
    expect(outTotal({})).toBeNull();
  });

  it('gives each connection the host count, else the count of its source port', () => {
    const got = edgeActivityOf(edges, { edges: { e3: { count: 9, at: 1 } }, nodes: { a: { out: { out: 4, error: 1 } }, b: { out: { true: 2 } } } });
    expect(got).toEqual({ e1: { count: 4 }, e2: { count: 1 }, e3: { count: 9, at: 1 } });
    expect(edgeActivityOf(edges, undefined)).toEqual({});
  });
});

describe('pulseStep (at most 2 Hz per connection)', () => {
  it('records a connection the first time and flashes when its count goes up', () => {
    const mem: PulseMemory = new Map();
    expect(pulseStep(mem, { e1: { count: 3 } }, 0)).toEqual({ now: [], later: [] });
    expect(pulseStep(mem, { e1: { count: 3 } }, 100)).toEqual({ now: [], later: [] });
    expect(pulseStep(mem, { e1: { count: 4 } }, 200).now).toEqual(['e1']);
  });

  it('defers a second flash until the gap has passed', () => {
    const mem: PulseMemory = new Map();
    pulseStep(mem, { e1: { count: 0 } }, 0);
    expect(pulseStep(mem, { e1: { count: 1 } }, 1000).now).toEqual(['e1']);
    expect(pulseStep(mem, { e1: { count: 2 } }, 1100)).toEqual({ now: [], later: [{ id: 'e1', at: 1000 + PULSE_GAP_MS }] });
    expect(pulseStep(mem, { e1: { count: 3 } }, 1600).now).toEqual(['e1']);
  });

  it('flashes on a newer `at` and forgets connections that went away; a lower count is a new window', () => {
    const mem: PulseMemory = new Map();
    pulseStep(mem, { e1: { count: 5, at: 10 } }, 0);
    expect(pulseStep(mem, { e1: { count: 5, at: 20 } }, 600).now).toEqual(['e1']);
    expect(pulseStep(mem, { e1: { count: 1, at: 20 } }, 1200).now).toEqual([]);
    pulseStep(mem, {}, 1300);
    expect(mem.size).toBe(0);
  });
});
