import { describe, it, expect } from 'vitest';
import { normalizePoints, projectBudget, activeTier, sortTiers, budgetState, nearestPointIndex, valueNear, DEFAULT_BURN_TIERS } from './_burn';

const H = 3_600_000;
const D = 24 * H;
const T0 = Date.UTC(2026, 9, 1);

describe('burn maths', () => {
  it('normalises, sorts and drops bad points', () => {
    const pts = normalizePoints([
      { t: T0 + H, value: 90 }, { t: T0, value: 100 }, { t: 'not a date', value: 5 }, { t: T0 + 2 * H, value: Number.NaN },
      { t: new Date(T0 + 3 * H).toISOString(), value: 80 },
    ]);
    expect(pts.map((p) => p.v)).toEqual([100, 90, 80]);
    expect(normalizePoints(undefined)).toEqual([]);
  });

  it('projects exhaustion at the recent pace', () => {
    // 100 % at day 0, losing 10 points a day: zero at day 10.
    const pts = Array.from({ length: 5 }, (_, i) => ({ t: T0 + i * D, v: 100 - i * 10 }));
    const p = projectBudget(pts)!;
    expect(p.spent).toBe(false);
    expect(p.exhaustedAt).toBeCloseTo(T0 + 10 * D, -3);
    expect(p.line[0]).toEqual(pts[4]);
    expect(p.line[1]).toMatchObject({ v: 0 });
    expect(p.slope).toBeLessThan(0);
  });

  it('uses only the recent pace: a fast burn after a calm period', () => {
    const calm = Array.from({ length: 8 }, (_, i) => ({ t: T0 + i * D, v: 100 - i * 0.5 }));
    const fast = Array.from({ length: 4 }, (_, i) => ({ t: T0 + (8 + i) * D, v: 96 - (i + 1) * 12 }));
    const p = projectBudget([...calm, ...fast], { lookbackMs: 3 * D })!;
    // the last four points fall 12 per day, from 48: zero about 4 days after the last point
    expect(p.exhaustedAt! - (T0 + 11 * D)).toBeLessThan(5 * D);
    expect(p.exhaustedAt! - (T0 + 11 * D)).toBeGreaterThan(2 * D);
  });

  it('says there is no exhaustion when the budget is flat or recovering, and caps the line at `until`', () => {
    const flat = Array.from({ length: 4 }, (_, i) => ({ t: T0 + i * D, v: 80 }));
    expect(projectBudget(flat)!.exhaustedAt).toBeNull();
    const until = T0 + 10 * D;
    const line = projectBudget(flat, { until })!.line;
    expect(line.at(-1)!.t).toBe(until);
  });

  it('cuts the line at the window end when exhaustion would come later', () => {
    const slow = Array.from({ length: 4 }, (_, i) => ({ t: T0 + i * D, v: 100 - i }));
    const p = projectBudget(slow, { until: T0 + 20 * D })!;
    expect(p.exhaustedAt).toBeNull();
    expect(p.line.at(-1)!.t).toBe(T0 + 20 * D);
    expect(p.line.at(-1)!.v).toBeGreaterThan(0);
  });

  it('reports a spent budget with the time it ran out', () => {
    const pts = [{ t: T0, v: 40 }, { t: T0 + D, v: 10 }, { t: T0 + 2 * D, v: -5 }, { t: T0 + 3 * D, v: -8 }];
    const p = projectBudget(pts)!;
    expect(p.spent).toBe(true);
    expect(p.exhaustedAt).toBe(T0 + 2 * D);
  });

  it('needs two points', () => {
    expect(projectBudget([{ t: T0, v: 50 }])).toBeNull();
    expect(projectBudget([])).toBeNull();
  });

  it('finds the active tier: the highest one reached', () => {
    expect(activeTier(0.5, DEFAULT_BURN_TIERS)).toBeNull();
    expect(activeTier(1, DEFAULT_BURN_TIERS)!.id).toBe('ticket-slow');
    expect(activeTier(7, DEFAULT_BURN_TIERS)!.id).toBe('page-slow');
    expect(activeTier(100, DEFAULT_BURN_TIERS)!.id).toBe('page-fast');
  });

  it('sorts tiers by rate and drops invalid ones', () => {
    expect(sortTiers([{ id: 'a', label: 'A', rate: 6 }, { id: 'b', label: 'B', rate: 0 }, { id: 'c', label: 'C', rate: 1 }]).map((t) => t.id)).toEqual(['c', 'a']);
  });

  it('classifies the budget', () => {
    expect(budgetState(80)).toBe('healthy');
    expect(budgetState(24.9)).toBe('low');
    expect(budgetState(0)).toBe('spent');
    expect(budgetState(-3)).toBe('spent');
  });

  it('finds the nearest point and a value within a gap', () => {
    const pts = [{ t: 0, v: 1 }, { t: 10, v: 2 }, { t: 20, v: 3 }];
    expect(nearestPointIndex(pts, 4)).toBe(0);
    expect(nearestPointIndex(pts, 6)).toBe(1);
    expect(nearestPointIndex(pts, 99)).toBe(2);
    expect(nearestPointIndex([], 1)).toBe(-1);
    expect(valueNear(pts, 11)).toBe(2);
    expect(valueNear(pts, 100, 5)).toBeNull();
  });
});
