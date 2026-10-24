// The geometry of the diagram editor (pure, no React): what is under a point, what a rectangle touches, where the ports
// of a symbol are and how a connection runs, all read from the output of `sceneModel` so the editor never decides a
// position the drawing does not. Ports sit on the centre lines of a symbol's box and are a few pixels at the default
// scale, so they get a hit area of their own. `scene-edit-logic.ts` builds on the boxes and bounds exported here.

import {
  parsePort, portPoint, routeLink, type PlacedElement, type SceneLinkSetting, type SceneModel, type SceneSettings, type SceneShapeSetting,
  type SceneSide,
} from './scada-scene-logic';
import { r2 } from './svg-node';

export interface Pt { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

/** What the geometry reads of a scene model: the boxes of the drawn symbols. */
export type HitModel = Pick<SceneModel, 'hits'>;

export const SIDES: readonly SceneSide[] = ['l', 'r', 't', 'b'];

const finite = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The text approximation the scene model uses to widen its content box (also the hit box of a title). */
const TEXT_SIZE: Record<string, number> = { s: 12, m: 15, l: 22 };

/** The raw `shapes` list of the settings (indices stay those of the stored array; a stray non-object entry is skipped by readers). */
export const shapesOf = (s: SceneSettings): unknown[] => (Array.isArray(s.shapes) ? s.shapes : []);
export const linksOf = (s: SceneSettings): unknown[] => (Array.isArray(s.links) ? s.links : []);

/** The box a shape occupies on the canvas, or null when the scene does not draw it (a title with no words, an unknown kind). */
export function shapeBounds(h: SceneShapeSetting): Box | null {
  if (!isRec(h)) return null;
  const x = finite(h.x, 0); const y = finite(h.y, 0);
  if (h.kind === 'zone') return { x, y, w: Math.max(20, finite(h.w, 200)), h: Math.max(20, finite(h.h, 120)) };
  if (h.kind === 'divider') {
    const vertical = finite(h.w, 0) <= 0 && finite(h.h, 0) > 0;
    const len = Math.max(20, vertical ? finite(h.h, 100) : finite(h.w, 200));
    return vertical ? { x, y, w: 0, h: len } : { x, y, w: len, h: 0 };
  }
  if (h.kind === 'text' && typeof h.text === 'string' && h.text) {
    const size = TEXT_SIZE[h.size ?? 'm'] ?? TEXT_SIZE.m;
    const approx = h.text.length * size * 0.56;
    const x0 = h.align === 'start' ? x : h.align === 'end' ? x - approx : x - approx / 2;
    return { x: x0, y: y - size, w: approx, h: size + 4 };
  }
  return null;
}

/** The box of a placed symbol (from `hits`) as the scene model's own `PlacedElement`, so `portPoint` and the router can read it. */
const placed = (b: { id: string } & Box): PlacedElement => ({ id: b.id, symbol: '', x: b.x, y: b.y, w: b.w, h: b.h, k: 1 });

/** One box per drawn symbol id. */
export function elementBoxes(model: HitModel): Map<string, Box> {
  const out = new Map<string, Box>();
  for (const h of model.hits) out.set(h.id, { x: h.x, y: h.y, w: h.w, h: h.h });
  return out;
}

/** The smallest box that holds all of `boxes`, or null for none. */
export function unionBox(boxes: readonly Box[]): Box | null {
  if (!boxes.length) return null;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const b of boxes) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A rectangle given by any two corners (a drag to the left has a negative width). */
export function normalizeRect(r: Box): Box {
  return { x: r.w < 0 ? r.x + r.w : r.x, y: r.h < 0 ? r.y + r.h : r.y, w: Math.abs(r.w), h: Math.abs(r.h) };
}

const touches = (a: Box, b: Box) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
const inside = (outer: Box, b: Box) => b.x >= outer.x && b.y >= outer.y && b.x + b.w <= outer.x + outer.w && b.y + b.h <= outer.y + outer.h;
const within = (b: Box, p: Pt, pad = 0) => p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;

/** The distance from a point to a segment. */
export function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The distance from a point to a polyline. */
export function polylineDistance(p: Pt, points: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) best = Math.min(best, segmentDistance(p, points[i], points[i + 1]));
  return best;
}

// ─── Ports ───────────────────────────────────────────────────────────────────

export interface PortHandle { id: string; side: SceneSide; at: number; x: number; y: number }
export interface PortHit extends PortHandle { distance: number }

/** The four side midpoints of a symbol: where a connection can be started or ended by default. */
export function portHandles(model: HitModel, id: string): PortHandle[] {
  const h = model.hits.find((e) => e.id === id);
  if (!h) return [];
  const box = placed(h);
  return SIDES.map((side) => ({ id, side, at: 0.5, ...portPoint(box, side, 0.5) }));
}

export interface EdgeSnapOptions {
  /** A position this close (as a fraction of the edge) to the middle snaps to it. Default 0.06. */
  magnet?: number;
}

function snapOnEdge(box: PlacedElement, side: SceneSide, point: Pt, o: EdgeSnapOptions = {}): { at: number; x: number; y: number } {
  const along = side === 'l' || side === 'r' ? (box.h > 0 ? (point.y - box.y) / box.h : 0.5) : (box.w > 0 ? (point.x - box.x) / box.w : 0.5);
  let at = Math.min(1, Math.max(0, along));
  at = Math.abs(at - 0.5) <= (o.magnet ?? 0.06) ? 0.5 : Math.round(at * 100) / 100;
  return { at, ...portPoint(box, side, at) };
}

/** The port a point on (or near) a symbol's edge maps to: `at` is the fraction along the edge, snapped to the middle and to 1/100. */
export function snapAlongEdge(model: HitModel, id: string, side: SceneSide, point: Pt, o: EdgeSnapOptions = {}): PortHandle | null {
  const h = model.hits.find((e) => e.id === id);
  if (!h) return null;
  return { id, side, ...snapOnEdge(placed(h), side, point, o) };
}

export interface NearestPortOptions {
  /** Symbols whose ports are never offered (the symbol a connection starts on). */
  exclude?: readonly string[];
  /** Only these symbols are looked at. */
  only?: readonly string[];
  /** With no side midpoint in reach, offer the nearest point along an edge (a port at a fraction). */
  edge?: boolean;
}

/** The port closest to a point within `radius`, or null. The topmost symbol wins a tie. */
export function nearestPort(model: HitModel, point: Pt, radius: number, o: NearestPortOptions = {}): PortHit | null {
  const skip = new Set(o.exclude ?? []);
  const only = o.only ? new Set(o.only) : null;
  let best: PortHit | null = null;
  for (let i = model.hits.length - 1; i >= 0; i -= 1) {
    const h = model.hits[i];
    if (skip.has(h.id) || (only && !only.has(h.id))) continue;
    const box = placed(h);
    for (const side of SIDES) {
      const p = portPoint(box, side, 0.5);
      const d = Math.hypot(point.x - p.x, point.y - p.y);
      if (d <= radius && (!best || d < best.distance - 1e-9)) best = { id: h.id, side, at: 0.5, x: p.x, y: p.y, distance: d };
    }
  }
  if (best || !o.edge) return best;
  for (let i = model.hits.length - 1; i >= 0; i -= 1) {
    const h = model.hits[i];
    if (skip.has(h.id) || (only && !only.has(h.id))) continue;
    const box = placed(h);
    for (const side of SIDES) {
      const s = snapOnEdge(box, side, point);
      const d = Math.hypot(point.x - s.x, point.y - s.y);
      if (d <= radius && (!best || d < best.distance - 1e-9)) best = { id: h.id, side, at: s.at, x: s.x, y: s.y, distance: d };
    }
  }
  return best;
}

// ─── Connections ─────────────────────────────────────────────────────────────

/** The draggable handle of the middle leg of a Z route: `axis` says what dragging it changes (`mid` is an x or a y). */
export interface MidHandle { x: number; y: number; axis: 'x' | 'y' }

export interface LinkLeg {
  /** The index in the stored `links` list. */
  index: number;
  kind: string;
  from: { id: string; side: SceneSide; at: number };
  to: { id: string; side: SceneSide; at: number };
  /** The route in scene units, the same polyline the scene draws. */
  points: Pt[];
  /** Null when the route has no adjustable middle leg (an L route: a horizontal and a vertical port). */
  handle: MidHandle | null;
}

const STUB = 16;
const DIR: Record<SceneSide, Pt> = { l: { x: -1, y: 0 }, r: { x: 1, y: 0 }, t: { x: 0, y: -1 }, b: { x: 0, y: 1 } };

/**
 * The routed polylines of every connection that has both ends (a dangling one is left out), for hit-testing and the
 * middle-leg handle. `anchors` are boxes a connection may end on that are not part of `model` (the things from data,
 * which the editor keeps out of every editing path): a link to a thing still gets its leg, so it can be selected,
 * re-routed and deleted from the canvas. A symbol in `model` wins over an anchor with the same id.
 */
export function linkLegs(settings: SceneSettings, model: HitModel, anchors: ReadonlyArray<HitModel['hits'][number]> = []): LinkLeg[] {
  const boxes = new Map([...anchors, ...model.hits].map((h) => [h.id, placed(h)] as const));
  const out: LinkLeg[] = [];
  linksOf(settings).forEach((raw, index) => {
    if (!isRec(raw)) return;
    const l = raw as SceneLinkSetting;
    const a = parsePort(l.from); const b = parsePort(l.to);
    const ba = a && boxes.get(a.id); const bb = b && boxes.get(b.id);
    if (!a || !b || !ba || !bb) return;
    const pa = portPoint(ba, a.side, a.at); const pb = portPoint(bb, b.side, b.at);
    const points = routeLink(pa, a.side, pb, b.side, l.mid ?? null);
    const as = { x: pa.x + DIR[a.side].x * STUB, y: pa.y + DIR[a.side].y * STUB };
    const bs = { x: pb.x + DIR[b.side].x * STUB, y: pb.y + DIR[b.side].y * STUB };
    const ha = a.side === 'l' || a.side === 'r'; const hb = b.side === 'l' || b.side === 'r';
    let handle: MidHandle | null = null;
    if (ha && hb) handle = { x: typeof l.mid === 'number' ? l.mid : (as.x + bs.x) / 2, y: (as.y + bs.y) / 2, axis: 'x' };
    else if (!ha && !hb) handle = { x: (as.x + bs.x) / 2, y: typeof l.mid === 'number' ? l.mid : (as.y + bs.y) / 2, axis: 'y' };
    if (handle) handle = { x: r2(handle.x), y: r2(handle.y), axis: handle.axis };
    out.push({ index, kind: typeof l.kind === 'string' ? l.kind : 'pipe', from: a, to: b, points, handle });
  });
  return out;
}

/** The `mid` value a drag of the handle to `point` stores. */
export const midValue = (handle: MidHandle, point: Pt): number => r2(handle.axis === 'x' ? point.x : point.y);

// ─── Picking and the marquee ─────────────────────────────────────────────────

export interface PickResult {
  kind: 'element' | 'shape' | 'link' | 'port' | 'none';
  /** An element or port: the symbol id. A shape or link: its index as a string. */
  id: string;
  /** A shape or link: the index in the stored list. */
  index?: number;
  /** A port: the side and the fraction along the edge (0.5 for a handle). */
  side?: SceneSide;
  at?: number;
}

export interface PickOptions {
  /** Hit radius of a port handle, scene units. Default 10 (a port is a few pixels at the default scale). */
  portRadius?: number;
  /** Which symbols offer ports: all (default), none, or a list (the symbol under the pointer). */
  ports?: 'all' | 'none' | readonly string[];
  /** How close to a connection, a divider or a zone's outline counts as on it. Default 6. */
  tolerance?: number;
  /** A click inside a zone selects it (default: only its outline and its title strip, so the inside stays free for a marquee). */
  zoneFill?: boolean;
  /** Boxes connections may end on that are never picked themselves (the things from data, see `linkLegs`). */
  anchors?: ReadonlyArray<HitModel['hits'][number]>;
}

const NONE: PickResult = { kind: 'none', id: '' };

/** What is under a point, topmost first: a port, a title, a symbol, a connection, then a divider or zone. */
export function pick(model: HitModel, settings: SceneSettings, point: Pt, o: PickOptions = {}): PickResult {
  const tol = o.tolerance ?? 6;
  const ports = o.ports ?? 'all';
  if (ports !== 'none') {
    const hit = nearestPort(model, point, o.portRadius ?? 10, ports === 'all' ? {} : { only: ports });
    if (hit) return { kind: 'port', id: hit.id, side: hit.side, at: hit.at };
  }
  const shapes = shapesOf(settings);
  const bounds = shapes.map((h) => (isRec(h) ? shapeBounds(h as SceneShapeSetting) : null));
  // Titles draw over everything.
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    const b = bounds[i];
    if (b && (shapes[i] as SceneShapeSetting).kind === 'text' && within(b, point, 2)) return { kind: 'shape', id: String(i), index: i };
  }
  for (let i = model.hits.length - 1; i >= 0; i -= 1) {
    const h = model.hits[i];
    if (within(h, point)) return { kind: 'element', id: h.id };
  }
  const legs = linkLegs(settings, model, o.anchors);
  for (let i = legs.length - 1; i >= 0; i -= 1) {
    if (polylineDistance(point, legs[i].points) <= tol) return { kind: 'link', id: String(legs[i].index), index: legs[i].index };
  }
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    const b = bounds[i];
    const kind = (shapes[i] as SceneShapeSetting | undefined)?.kind;
    if (!b) continue;
    if (kind === 'divider') {
      const a = { x: b.x, y: b.y }; const e = { x: b.x + b.w, y: b.y + b.h };
      if (segmentDistance(point, a, e) <= tol) return { kind: 'shape', id: String(i), index: i };
    } else if (kind === 'zone') {
      const onEdge = within(b, point, tol) && !within({ x: b.x + tol, y: b.y + tol, w: b.w - 2 * tol, h: b.h - 2 * tol }, point);
      const title = typeof (shapes[i] as SceneShapeSetting).text === 'string' && (shapes[i] as SceneShapeSetting).text && within({ x: b.x, y: b.y, w: b.w, h: Math.min(b.h, 28) }, point);
      if (o.zoneFill || onEdge || title) return { kind: 'shape', id: String(i), index: i };
    }
  }
  return NONE;
}

/** What a marquee selected: symbol ids and shape indices (connections follow their ends, so they are not picked). */
export interface MarqueeResult { elements: string[]; shapes: number[] }

/**
 * The symbols (and, given the settings, the shapes) a rectangle touches, or with `mode: 'contain'` only those it fully
 * holds. Symbol ids come in draw order.
 */
export function marquee(model: HitModel, rect: Box, settings?: SceneSettings, mode: 'touch' | 'contain' = 'touch'): MarqueeResult {
  const r = normalizeRect(rect);
  const test = mode === 'contain' ? (b: Box) => inside(r, b) : (b: Box) => touches(r, b);
  const elements = model.hits.filter((h) => test(h)).map((h) => h.id);
  const shapes: number[] = [];
  if (settings) {
    shapesOf(settings).forEach((h, i) => {
      const b = isRec(h) ? shapeBounds(h as SceneShapeSetting) : null;
      if (b && test(b)) shapes.push(i);
    });
  }
  return { elements, shapes };
}
