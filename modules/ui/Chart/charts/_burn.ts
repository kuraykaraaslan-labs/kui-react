// modules/ui/Chart/charts/_burn.ts
//
// Pure maths of the SLO burn chart: normalising points, projecting when the error budget runs out, the burn-rate
// tiers and which one a rate is in. Dependency-free; unit-tested in burn-math.test.ts.

import { linearRegression } from './_helpers';
import { toTime } from './_time';

export type BurnPoint = { t: number | string; value: number };

export type BurnTone = 'error' | 'warning' | 'info';

/** A burn-rate threshold: spending the budget at `rate` times the sustainable pace. */
export type BurnTier = {
  id: string;
  /** What the tier does: `Page`, `Ticket`. */
  label: string;
  /** Multiples of the sustainable burn rate (1 = the budget lasts exactly the SLO window). */
  rate: number;
  /** The window the rate is measured over, shown in the label (`1 h`). */
  window?: string;
  tone?: BurnTone;
};

/** The multi-window, multi-burn-rate alerting tiers of the Google SRE workbook (for a 30-day window). */
export const DEFAULT_BURN_TIERS: BurnTier[] = [
  { id: 'page-fast', label: 'Page', rate: 14.4, window: '1 h', tone: 'error' },
  { id: 'page-slow', label: 'Page', rate: 6, window: '6 h', tone: 'error' },
  { id: 'ticket-fast', label: 'Ticket', rate: 3, window: '1 d', tone: 'warning' },
  { id: 'ticket-slow', label: 'Ticket', rate: 1, window: '3 d', tone: 'info' },
];

export type Pt = { t: number; v: number };

/** Points as sorted `{ t, v }` with finite values and parsable times. */
export function normalizePoints(points: readonly BurnPoint[] | undefined): Pt[] {
  if (!points) return [];
  const out: Pt[] = [];
  for (const p of points) {
    const t = toTime(p.t);
    if (t === null || !Number.isFinite(p.value)) continue;
    out.push({ t, v: p.value });
  }
  return out.sort((a, b) => a.t - b.t);
}

export type Projection = {
  /** Value per ms (negative = the budget is shrinking). */
  slope: number;
  /** When the budget reaches zero; null if it does not at this pace. */
  exhaustedAt: number | null;
  /** The projected line: from the last point to the zero crossing (or to `until` when it never crosses). */
  line: Pt[];
  /** Budget is already spent at the last point. */
  spent: boolean;
};

/**
 * Where the budget goes if the recent pace continues: a least-squares line over the points of the last `lookbackMs`
 * (default a quarter of the data span, at least 3 points), extended to zero. `until` caps a line that never reaches zero.
 */
export function projectBudget(points: readonly Pt[], opts: { lookbackMs?: number; until?: number } = {}): Projection | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const span = last.t - points[0].t;
  const lookback = opts.lookbackMs ?? Math.max(span / 4, 1);
  let recent = points.filter((p) => p.t >= last.t - lookback);
  if (recent.length < 3) recent = points.slice(-Math.min(points.length, 3));
  const fit = linearRegression(recent.map((p) => ({ x: p.t - last.t, y: p.v })));
  if (!fit) return null;
  if (last.v <= 0) {
    const first = points.find((p) => p.v <= 0) ?? last;
    return { slope: fit.slope, exhaustedAt: first.t, line: [last], spent: true };
  }
  if (fit.slope >= 0) {
    const end = opts.until && opts.until > last.t ? opts.until : last.t;
    return { slope: fit.slope, exhaustedAt: null, line: end > last.t ? [last, { t: end, v: Math.min(100, last.v + fit.slope * (end - last.t)) }] : [last], spent: false };
  }
  // Anchor the line on the last observed value (not the fitted intercept) so it starts where the data ends.
  const at = last.t + last.v / -fit.slope;
  if (opts.until !== undefined && at > opts.until) {
    return { slope: fit.slope, exhaustedAt: null, line: [last, { t: opts.until, v: last.v + fit.slope * (opts.until - last.t) }], spent: false };
  }
  return { slope: fit.slope, exhaustedAt: at, line: [last, { t: at, v: 0 }], spent: false };
}

/** The highest tier whose rate the value reaches, or null. */
export function activeTier(rate: number, tiers: readonly BurnTier[]): BurnTier | null {
  let best: BurnTier | null = null;
  for (const t of tiers) if (rate >= t.rate && (!best || t.rate > best.rate)) best = t;
  return best;
}

/** Tiers sorted from the lowest rate to the highest, keeping only finite positive rates. */
export function sortTiers(tiers: readonly BurnTier[]): BurnTier[] {
  return tiers.filter((t) => Number.isFinite(t.rate) && t.rate > 0).sort((a, b) => a.rate - b.rate);
}

export type BudgetState = 'healthy' | 'low' | 'spent';

/** Percent remaining as a state: spent at or below 0, low under 25 %, else healthy. */
export function budgetState(remainingPct: number): BudgetState {
  if (remainingPct <= 0) return 'spent';
  return remainingPct < 25 ? 'low' : 'healthy';
}

/** Index of the point nearest in time to `t` (the points are sorted); -1 for none. */
export function nearestPointIndex(points: readonly Pt[], t: number): number {
  if (!points.length) return -1;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1].t - t) <= Math.abs(points[lo].t - t)) return lo - 1;
  return lo;
}

/** The value of a sorted series at `t`: the nearest point's value, or null when `t` is farther than `maxGap` from it. */
export function valueNear(points: readonly Pt[], t: number, maxGap = Infinity): number | null {
  const i = nearestPointIndex(points, t);
  if (i < 0 || Math.abs(points[i].t - t) > maxGap) return null;
  return points[i].v;
}
