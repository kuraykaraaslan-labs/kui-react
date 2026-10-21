import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEdgePulse } from './useEdgePulse';
import { PULSE_GAP_MS, PULSE_ON_MS, type EdgeActivity } from '../../graph/activity';

afterEach(() => { cleanup(); vi.useRealTimers(); });

/** counts its own renders and shows the lit set */
function probe() {
  const seen: string[][] = [];
  function Probe({ activity }: { activity: Record<string, EdgeActivity> }) {
    const lit = useEdgePulse(activity);
    seen.push([...lit].sort());
    return null;
  }
  return { Probe, seen };
}
const counts = (n: number, ids: string[]) => Object.fromEntries(ids.map((id) => [id, { count: n }]));
const IDS = Array.from({ length: 10 }, (_, i) => `e${i}`);

describe('useEdgePulse batches its flashes', () => {
  it('lights every connection that went up together in one render and puts them out in one more', () => {
    vi.useFakeTimers();
    const { Probe, seen } = probe();
    const { rerender } = render(<Probe activity={counts(1, IDS)} />);
    const before = seen.length;
    rerender(<Probe activity={counts(2, IDS)} />);
    expect(seen.at(-1)).toEqual([...IDS].sort());
    expect(vi.getTimerCount()).toBe(1); // one timer for the batch (was one per connection)
    act(() => { vi.advanceTimersByTime(PULSE_ON_MS + 10); });
    expect(seen.at(-1)).toEqual([]);
    // the host update itself, one render to light all ten, one to put them out (was 1 + 10 + 10)
    expect(seen.length - before).toBe(3);
  });

  it('flashes the rises that had to wait together, with one timer', () => {
    vi.useFakeTimers();
    const { Probe, seen } = probe();
    const { rerender } = render(<Probe activity={counts(1, IDS)} />);
    rerender(<Probe activity={counts(2, IDS)} />);
    act(() => { vi.advanceTimersByTime(PULSE_ON_MS + 10); });
    rerender(<Probe activity={counts(3, IDS)} />);
    expect(seen.at(-1)).toEqual([]);
    const before = seen.length;
    expect(vi.getTimerCount()).toBe(1);
    act(() => { vi.advanceTimersByTime(PULSE_GAP_MS - PULSE_ON_MS); });
    expect(seen.at(-1)).toEqual([...IDS].sort());
    act(() => { vi.advanceTimersByTime(PULSE_ON_MS + 10); });
    expect(seen.at(-1)).toEqual([]);
    expect(seen.length - before).toBe(2);
  });

  it('keeps a connection lit when it flashes again before its older batch goes out', () => {
    vi.useFakeTimers();
    const { Probe, seen } = probe();
    const { rerender } = render(<Probe activity={{ a: { count: 1 }, b: { count: 1 } }} />);
    rerender(<Probe activity={{ a: { count: 2 }, b: { count: 1 } }} />);
    act(() => { vi.advanceTimersByTime(PULSE_GAP_MS - 50); });
    // `a` waits for its gap, `b` flashes now
    rerender(<Probe activity={{ a: { count: 3 }, b: { count: 2 } }} />);
    expect(seen.at(-1)).toEqual(['b']);
    act(() => { vi.advanceTimersByTime(60); });
    expect(seen.at(-1)).toEqual(['a', 'b']);
    act(() => { vi.advanceTimersByTime(PULSE_ON_MS - 60); });
    expect(seen.at(-1)).toEqual(['a']);
    act(() => { vi.advanceTimersByTime(100); });
    expect(seen.at(-1)).toEqual([]);
  });
});
