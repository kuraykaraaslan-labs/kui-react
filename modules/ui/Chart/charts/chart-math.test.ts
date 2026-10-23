import { describe, it, expect } from 'vitest';
import {
  toTime, isTimeSeries, timeExtent, timePoints, visibleYExtent, xTime, invTime, timeTicks,
  formatTick, brushDomain, brushRange, bandIndex, bandRange, keyRange, keyedTimeRange, nearestIndex,
} from './_time';
import { buildHeatGrid, heatIntensity } from './_heatmap';
import type { Series } from '../types';

const rect = { x: 40, y: 0, width: 400, height: 100 };
const s = (id: string, pts: Array<[string | number, number | null]>): Series => ({ id, name: id, data: pts.map(([x, y]) => ({ x, y })) });

describe('time axis maths', () => {
  it('parses ISO strings and epoch numbers, rejects labels', () => {
    expect(toTime('2026-10-06T00:00:00Z')).toBe(Date.parse('2026-10-06T00:00:00Z'));
    expect(toTime(1000)).toBe(1000);
    expect(toTime('Mon')).toBeNull();
    expect(toTime(NaN)).toBeNull();
  });
  it('a date-only string is the local calendar day, not UTC midnight', () => {
    const d = new Date(toTime('2026-10-06')!);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 6, 0]);
  });
  it('isTimeSeries needs every x to be a time and at least one point', () => {
    expect(isTimeSeries([s('a', [[1, 1], ['2026-10-06', 2]])])).toBe(true);
    expect(isTimeSeries([s('a', [[1, 1], ['Mon', 2]])])).toBe(false);
    expect(isTimeSeries([s('a', [])])).toBe(false);
  });
  it('widens a single instant so the scale has a width', () => {
    const [lo, hi] = timeExtent([s('a', [[1_000_000, 1]])]);
    expect(hi - lo).toBeGreaterThan(0);
    expect(timeExtent([])).toEqual([0, 1]);
  });
  it('maps time to pixels and back (round trip)', () => {
    const d: [number, number] = [1000, 5000];
    expect(xTime(1000, d, rect)).toBe(40);
    expect(xTime(5000, d, rect)).toBe(440);
    expect(invTime(xTime(3333, d, rect), d, rect)).toBeCloseTo(3333);
  });
  it('series with different sampling instants share the axis; points sort by time', () => {
    const pts = timePoints([s('a', [[3000, 1], [1000, 2]]), s('b', [[2000, 5]])]);
    expect(pts[0].map((p) => p.t)).toEqual([1000, 3000]);
    expect(pts[1].map((p) => p.t)).toEqual([2000]);
  });
  it('zoom rescales y to the visible points (zero stays in)', () => {
    const all = timePoints([s('a', [[1000, 100], [2000, 5], [3000, 7], [4000, 90]])]);
    expect(visibleYExtent(all, [1500, 3500])).toEqual({ min: 0, max: 7 });
    expect(visibleYExtent(all, [9000, 9500])).toEqual({ min: 0, max: 1 });
  });
  it('picks a sensible tick step and bounded tick counts', () => {
    for (const span of [30_000, 3_600_000, 86_400_000, 30 * 86_400_000, 800 * 86_400_000]) {
      const lo = Date.parse('2026-01-01T00:00:00Z');
      const ticks = timeTicks([lo, lo + span], 6);
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.length).toBeLessThanOrEqual(8);
      expect(ticks.every((t) => t >= lo && t <= lo + span)).toBe(true);
    }
  });
  it('formats ticks by span', () => {
    const t = Date.parse('2026-10-06T12:34:56');
    expect(formatTick(t, 5 * 60_000, 'en-US')).toMatch(/12:34:56/);
    expect(formatTick(t, 3_600_000, 'en-US')).not.toMatch(/Oct/);
    expect(formatTick(t, 30 * 86_400_000, 'en-US')).toMatch(/Oct/);
  });
  it('a brush becomes a zoom domain, clamped; a click or a sliver is ignored', () => {
    const full: [number, number] = [0, 10_000];
    expect(brushDomain(240, 240, full, full, rect)).toBeNull();
    expect(brushDomain(100, 104, full, full, rect)).toBeNull();
    const z = brushDomain(440, 140, full, full, rect)!; // dragged right-to-left
    expect(z[0]).toBeCloseTo(2500);
    expect(z[1]).toBeCloseTo(10_000);
    expect(brushDomain(0, 1000, [0, 10_000], full, rect)![0]).toBe(0); // clamped at the data start
  });
  it('nearestIndex finds the closest instant', () => {
    expect(nearestIndex([], 5)).toBe(-1);
    expect(nearestIndex([10, 20, 40], 26)).toBe(1);
    expect(nearestIndex([10, 20, 40], 31)).toBe(2);
    expect(nearestIndex([10, 20, 40], -5)).toBe(0);
    expect(nearestIndex([10, 20, 40], 99)).toBe(2);
  });
});

describe('a range for the host (brush, band and keyboard)', () => {
  const full: [number, number] = [0, 10_000];
  it('a time brush reports the zoom domain as from / to, with the same click and sliver rules', () => {
    expect(brushRange(240, 240, full, full, rect)).toBeNull();
    expect(brushRange(100, 104, full, full, rect)).toBeNull();
    const r = brushRange(440, 140, full, full, rect)!;
    expect(r.from).toBeCloseTo(2500);
    expect(r.to).toBeCloseTo(10_000);
  });
  it('bandIndex clamps a pixel along the axis to a category', () => {
    expect(bandIndex(-5, 100, 4)).toBe(0);
    expect(bandIndex(0, 100, 4)).toBe(0);
    expect(bandIndex(150, 100, 4)).toBe(1);
    expect(bandIndex(999, 100, 4)).toBe(3);
    expect(bandIndex(50, 0, 4)).toBe(0);
    expect(bandIndex(50, 100, 0)).toBe(0);
  });
  it('bandRange spans whole buckets, to the end of the last one, in either order', () => {
    const times = [1000, 2000, 3000, 4000];
    expect(bandRange(times, 1, 2)).toEqual({ from: 2000, to: 4000 });
    expect(bandRange(times, 2, 1)).toEqual({ from: 2000, to: 4000 });
    expect(bandRange(times, 0, 0)).toEqual({ from: 1000, to: 2000 });
    // the last bucket is as long as the gap before it
    expect(bandRange(times, 3, 3)).toEqual({ from: 4000, to: 5000 });
    expect(bandRange(times, -4, 99)).toEqual({ from: 1000, to: 5000 });
    expect(bandRange([1000], 0, 0)).toBeNull();
    expect(bandRange([], 0, 0)).toBeNull();
    expect(bandRange([5000, 5000], 0, 1)).toBeNull();
  });
  it('keyRange: arrows move the end, Shift + arrows the start, inside the bounds and never crossing', () => {
    expect(keyRange(null, 1, false, 0, 100, 10)).toEqual({ anchor: 0, focus: 10 });
    expect(keyRange({ anchor: 0, focus: 10 }, 1, false, 0, 100, 10)).toEqual({ anchor: 0, focus: 20 });
    expect(keyRange({ anchor: 0, focus: 20 }, 1, true, 0, 100, 10)).toEqual({ anchor: 10, focus: 20 });
    // the start cannot pass the end; the end cannot leave the bounds
    expect(keyRange({ anchor: 10, focus: 20 }, 1, true, 0, 100, 50)).toEqual({ anchor: 20, focus: 20 });
    expect(keyRange({ anchor: 10, focus: 95 }, 1, false, 0, 100, 10)).toEqual({ anchor: 10, focus: 100 });
    expect(keyRange({ anchor: 10, focus: 20 }, -1, false, 0, 100, 50)).toEqual({ anchor: 0, focus: 0 });
    expect(keyRange(null, -1, false, 0, 100, 10)).toEqual({ anchor: 0, focus: 0 });
  });
  it('keyedTimeRange needs at least the smallest zoom', () => {
    expect(keyedTimeRange({ anchor: 0, focus: 0 })).toBeNull();
    expect(keyedTimeRange({ anchor: 0, focus: 999 })).toBeNull();
    expect(keyedTimeRange({ anchor: 0, focus: 1000 })).toEqual({ from: 0, to: 1000 });
  });
});

describe('heatmap grid', () => {
  it('builds a dense grid, sorts numeric axes, keeps first-appearance order for labels, newest duplicate wins', () => {
    const g = buildHeatGrid([
      { x: 10, y: 'Mon', value: 1 }, { x: 2, y: 'Mon', value: 3 }, { x: 2, y: 'Tue', value: 9 }, { x: 2, y: 'Tue', value: 4 },
    ]);
    expect(g.xs).toEqual(['2', '10']);
    expect(g.ys).toEqual(['Mon', 'Tue']);
    expect(g.values).toEqual([[3, 1], [4, null]]);
    expect([g.min, g.max]).toEqual([1, 4]);
  });
  it('non-finite values are empty cells; an empty input has a usable domain', () => {
    const g = buildHeatGrid([{ x: 'a', y: 'b', value: Number.NaN }]);
    expect(g.values).toEqual([[null]]);
    expect([g.min, g.max]).toEqual([0, 1]);
  });
  it('caps axis length', () => {
    const cells = Array.from({ length: 300 }, (_, i) => ({ x: `x${i}`, y: 'a', value: i }));
    expect(buildHeatGrid(cells, 50).xs).toHaveLength(50);
  });
  it('intensity is clamped 0..1 and a flat range is full', () => {
    expect(heatIntensity(5, 0, 10)).toBe(0.5);
    expect(heatIntensity(-5, 0, 10)).toBe(0);
    expect(heatIntensity(50, 0, 10)).toBe(1);
    expect(heatIntensity(3, 3, 3)).toBe(1);
  });
});
