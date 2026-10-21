// Snapping and alignment guides while a symbol is dragged (pure, no React). The dragged thing is a point (a symbol's
// centre by default) with an optional size; it snaps to the grid, and to the centres and edges of its neighbours, which
// also come back as guide lines the view can draw. Both are switchable.

import type { Box, Pt } from './scene-edit-geometry';
import { r2 } from './svg-node';

export interface SnapOptions {
  /** Grid step in scene units; default 10; false or 0 turns the grid off. */
  grid?: number | false;
  /** Alignment guides to neighbours; default on. */
  guides?: boolean;
  /** The neighbours (never include what is being dragged). */
  others?: readonly Box[];
  /** How close (scene units) counts as aligned; default 5. */
  threshold?: number;
  /** The size of the dragged box around `point` (its centre); default a point. */
  size?: { w: number; h: number };
}

/** A line to draw: `axis` x is a vertical line at x = `at` from y = `from` to `to`; y a horizontal one. */
export interface Guide { axis: 'x' | 'y'; at: number; from: number; to: number; kind: 'center' | 'edge' }

export interface Snapped extends Pt { guides: Guide[] }

interface Line { v: number; kind: 'center' | 'edge' }

const lines = (start: number, size: number): Line[] => [
  { v: start + size / 2, kind: 'center' }, { v: start, kind: 'edge' }, { v: start + size, kind: 'edge' },
];

/** The smallest move that puts one dragged line on a target line, within the threshold. */
function bestShift(dragged: Line[], targets: Line[], threshold: number): number | null {
  let best: number | null = null;
  for (const d of dragged) for (const t of targets) {
    const shift = t.v - d.v;
    if (Math.abs(shift) <= threshold && (best === null || Math.abs(shift) < Math.abs(best) - 1e-9)) best = shift;
  }
  return best;
}

/** Snaps a point (the centre of a dragged box of `size`); returns the point and the guides it now sits on. */
export function snapPoint(point: Pt, o: SnapOptions = {}): Snapped {
  const w = o.size?.w ?? 0; const h = o.size?.h ?? 0;
  const threshold = o.threshold ?? 5;
  const grid = o.grid === undefined ? 10 : o.grid;
  const others = o.guides === false ? [] : o.others ?? [];
  let { x, y } = point;
  const shiftX = others.length ? bestShift(lines(x - w / 2, w), others.flatMap((b) => lines(b.x, b.w)), threshold) : null;
  const shiftY = others.length ? bestShift(lines(y - h / 2, h), others.flatMap((b) => lines(b.y, b.h)), threshold) : null;
  if (shiftX !== null) x += shiftX; else if (grid) x = Math.round(x / grid) * grid;
  if (shiftY !== null) y += shiftY; else if (grid) y = Math.round(y / grid) * grid;
  x = r2(x); y = r2(y);

  // Every neighbour whose centre or edge now lies on one of the dragged box's lines gets a guide, merged per line.
  const guides: Guide[] = [];
  const add = (axis: 'x' | 'y', at: number, kind: Guide['kind'], from: number, to: number) => {
    const g = guides.find((e) => e.axis === axis && Math.abs(e.at - at) < 0.01 && e.kind === kind);
    if (g) { g.from = Math.min(g.from, from); g.to = Math.max(g.to, to); } else guides.push({ axis, at: r2(at), kind, from, to });
  };
  const self = { x: x - w / 2, y: y - h / 2, w, h };
  for (const b of others) {
    for (const d of lines(self.x, self.w)) for (const t of lines(b.x, b.w)) {
      if (Math.abs(d.v - t.v) < 0.01) add('x', t.v, d.kind === 'center' && t.kind === 'center' ? 'center' : 'edge', Math.min(self.y, b.y), Math.max(self.y + self.h, b.y + b.h));
    }
    for (const d of lines(self.y, self.h)) for (const t of lines(b.y, b.h)) {
      if (Math.abs(d.v - t.v) < 0.01) add('y', t.v, d.kind === 'center' && t.kind === 'center' ? 'center' : 'edge', Math.min(self.x, b.x), Math.max(self.x + self.w, b.x + b.w));
    }
  }
  // A centre line that is also an edge line (a zero-size box, a neighbour of the same size) is drawn once, as the centre.
  return { x, y, guides: guides.filter((g) => g.kind === 'center' || !guides.some((c) => c.kind === 'center' && c.axis === g.axis && Math.abs(c.at - g.at) < 0.01)) };
}

/**
 * Snaps the move of a box (a selection's common box) by `delta`: returns the move to apply (`dx`, `dy`) and the guides.
 * The box's centre is what lands on the grid.
 */
export function snapMove(box: Box, delta: Pt, o: SnapOptions = {}): { dx: number; dy: number; guides: Guide[] } {
  const cx = box.x + box.w / 2; const cy = box.y + box.h / 2;
  const snapped = snapPoint({ x: cx + delta.x, y: cy + delta.y }, { ...o, size: { w: box.w, h: box.h } });
  return { dx: r2(snapped.x - cx), dy: r2(snapped.y - cy), guides: snapped.guides };
}
