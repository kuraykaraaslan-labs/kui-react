// The pure logic of the process scene (no React): a canvas of process symbols placed by coordinates, joined by pipes,
// hoses, cables, signal wires and strip lines that route themselves between the symbols' ports. One bound table feeds
// every symbol and link: a row per `id` with the columns `value`, `value2`, `running`, `status`, `warning`, `critical`,
// `label` and `capacity`. The scene is an SVG node tree; `ScadaSceneView.tsx` draws it and kui-ejs vendors this file.
//
// Coordinates are scene units (the canvas is `width` x `height`). A symbol is drawn at `scale` (the scene's, times its
// own); every connection has the thickness of a symbol port at that scale, so a pipe leaving a pump matches it.

import type { SlotData } from '../kind';
import { arrow, flowColor, INK, MUTED, pipes, wire, type Paint } from './scada-draw';
import { cablePath, hosePath, strip } from './scada-line';
import {
  drawScada, isScadaSymbol, SCADA_SYMBOL_DEFS, scadaPaint, type ScadaSettings, type SymbolDef,
} from './scada-logic';
import { el, r2, text, type SvgNode } from './svg-node';

export type SceneLinkKind = 'pipe' | 'hose' | 'cable' | 'wire' | 'strip' | 'line';
export type SceneSide = 'l' | 'r' | 't' | 'b';

export type SceneElementSetting = {
  id?: string;
  symbol?: string;
  x?: number;
  y?: number;
  turn?: number | string;
  mirror?: boolean;
  length?: number | string;
  scale?: number | null;
  label?: string;
  medium?: string;
  min?: number | null;
  max?: number | null;
  showValue?: boolean;
};

export type SceneLinkSetting = {
  id?: string;
  from?: string;
  to?: string;
  kind?: SceneLinkKind | string;
  medium?: string;
  mid?: number | null;
  arrows?: boolean;
};

export type SceneSettings = {
  width?: number;
  height?: number;
  scale?: number;
  background?: 'none' | 'dots' | 'panel';
  showLabels?: boolean;
  idColumn?: string;
  elements?: unknown;
  links?: unknown;
  animation?: boolean;
  idleColor?: string;
  runningColor?: string;
  warningColor?: string;
  criticalColor?: string;
};

export const MAX_SCENE_ELEMENTS = 200;
export const MAX_SCENE_LINKS = 300;
export const SCENE_COLUMNS = ['value', 'value2', 'running', 'status', 'warning', 'critical', 'label', 'capacity'] as const;

type Row = Record<string, unknown>;
type Pt = { x: number; y: number };
const DIR: Record<SceneSide, Pt> = { l: { x: -1, y: 0 }, r: { x: 1, y: 0 }, t: { x: 0, y: -1 }, b: { x: 0, y: 1 } };

/** One row of the table as the slots a symbol reads. A missing column is a missing slot, never a zero. */
export function rowSlots(row: Row | undefined): Record<string, SlotData> {
  const out: Record<string, SlotData> = {};
  if (!row) return out;
  for (const key of SCENE_COLUMNS) {
    if (!Object.hasOwn(row, key)) continue;
    const v = row[key];
    out[key] = { shape: 'scalar', value: v === undefined ? null : (v as number | string | boolean | null) };
  }
  return out;
}

/** The rows of the bound table by id. */
export function rowsById(slot: SlotData | undefined, idColumn = 'id'): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of slot?.rows ?? []) {
    const id = row[idColumn];
    if (id !== null && id !== undefined && id !== '' && !map.has(String(id))) map.set(String(id), row);
  }
  return map;
}

const finite = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** A placed symbol: where it is on the canvas, how big, and its drawing. */
export interface PlacedElement {
  id: string;
  symbol: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The scale it is drawn at (scene scale times its own). */
  k: number;
}

/** `pump1.r`, `tank:b` or `pump1.t:0.26` (a fraction along the edge): an element, a side and where on it. */
export function parsePort(ref: unknown): { id: string; side: SceneSide; at: number } | null {
  if (typeof ref !== 'string') return null;
  const m = /^\s*([A-Za-z_][A-Za-z0-9_.-]*?)[.:]([lrtb])(?::(\d*\.?\d+))?\s*$/.exec(ref);
  if (!m) return null;
  const at = m[3] === undefined ? 0.5 : Math.min(1, Math.max(0, Number(m[3])));
  return { id: m[1], side: m[2] as SceneSide, at };
}

/** The point of a port on its element's box edge. */
export function portPoint(box: PlacedElement, side: SceneSide, at: number): Pt {
  if (side === 'l') return { x: box.x, y: r2(box.y + at * box.h) };
  if (side === 'r') return { x: r2(box.x + box.w), y: r2(box.y + at * box.h) };
  if (side === 't') return { x: r2(box.x + at * box.w), y: box.y };
  return { x: r2(box.x + at * box.w), y: r2(box.y + box.h) };
}

const same = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

/** Drops repeated points and the middle point of three on one line. */
export function simplify(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    if (out.length && same(out[out.length - 1], p)) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i > 0; i -= 1) {
    const a = out[i - 1]; const b = out[i]; const c = out[i + 1];
    if ((Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5)) out.splice(i, 1);
  }
  return out;
}

/**
 * The route between two ports: out of each port by `stub`, then horizontal and vertical legs only. Two horizontal ports
 * meet in a Z through `mid` (an x), two vertical ones through `mid` (a y), a horizontal and a vertical one in an L.
 */
export function routeLink(a: Pt, sideA: SceneSide, b: Pt, sideB: SceneSide, mid?: number | null, stub = 16): Pt[] {
  const da = DIR[sideA]; const db = DIR[sideB];
  const as = { x: a.x + da.x * stub, y: a.y + da.y * stub };
  const bs = { x: b.x + db.x * stub, y: b.y + db.y * stub };
  const ha = sideA === 'l' || sideA === 'r';
  const hb = sideB === 'l' || sideB === 'r';
  let inner: Pt[];
  if (ha && hb) {
    const mx = typeof mid === 'number' ? mid : (as.x + bs.x) / 2;
    inner = [as, { x: mx, y: as.y }, { x: mx, y: bs.y }, bs];
  } else if (!ha && !hb) {
    const my = typeof mid === 'number' ? mid : (as.y + bs.y) / 2;
    inner = [as, { x: as.x, y: my }, { x: bs.x, y: my }, bs];
  } else if (ha) {
    inner = [as, { x: bs.x, y: as.y }, bs];
  } else {
    inner = [as, { x: as.x, y: bs.y }, bs];
  }
  return simplify([a, ...inner, b]);
}

/** A polyline as a path with rounded corners of at most `radius`. */
export function roundedPath(points: Pt[], radius: number): string {
  if (points.length < 2) return '';
  let d = `M${r2(points[0].x)} ${r2(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i]; const prev = points[i - 1]; const next = points[i + 1];
    const l1 = Math.hypot(p.x - prev.x, p.y - prev.y);
    const l2 = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const s = { x: p.x + ((prev.x - p.x) / l1) * r, y: p.y + ((prev.y - p.y) / l1) * r };
    const e = { x: p.x + ((next.x - p.x) / l2) * r, y: p.y + ((next.y - p.y) / l2) * r };
    d += ` L${r2(s.x)} ${r2(s.y)} Q${r2(p.x)} ${r2(p.y)} ${r2(e.x)} ${r2(e.y)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${r2(last.x)} ${r2(last.y)}`;
}

/** The middle of the longest leg and its direction in degrees: where a flow arrow sits. */
export function arrowSpot(points: Pt[]): { x: number; y: number; deg: number } | null {
  let best = -1; let spot: { x: number; y: number; deg: number } | null = null;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]; const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > best) { best = len; spot = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, deg: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }; }
  }
  return spot;
}

const LINK_KINDS: ReadonlySet<string> = new Set(['pipe', 'hose', 'cable', 'wire', 'strip', 'line']);

/** The nodes of one connection along `points` (scene units), drawn at scale `k`. */
export function linkNodes(kind: SceneLinkKind, points: Pt[], paint: Paint, k: number, radius = 14): SvgNode[] {
  const unit = points.map((p) => ({ x: p.x / k, y: p.y / k }));
  const d = roundedPath(unit, radius / k);
  const first = unit[0]; const last = unit[unit.length - 1];
  const ends: Array<[number, number, boolean]> = [];
  const along = (from: Pt, to: Pt, inset: number): [number, number, boolean] => {
    const dx = to.x - from.x; const dy = to.y - from.y; const len = Math.hypot(dx, dy) || 1;
    return [r2(from.x + (dx / len) * inset), r2(from.y + (dy / len) * inset), Math.abs(dy) > Math.abs(dx)];
  };
  if (unit.length >= 2) {
    ends.push(along(first, unit[1], 6), along(last, unit[unit.length - 2], 6));
  }
  let inner: SvgNode[];
  if (kind === 'pipe') inner = pipes([d], paint, []);
  else if (kind === 'hose') inner = hosePath(d, paint, ends);
  else if (kind === 'cable') inner = cablePath(d, paint, ends.map(([x, y, v]) => [x, y, v]));
  else if (kind === 'wire') inner = wire(d, paint, [[first.x, first.y], [last.x, last.y]]);
  else if (kind === 'strip') inner = strip(d, paint);
  else inner = [el('path', { d, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })];
  const spot = arrowSpot(unit);
  if (spot && (kind === 'line' || paint.arrows)) inner.push(arrow(spot.x, spot.y, spot.deg, kind === 'line' ? 13 : 11, kind === 'pipe' || kind === 'hose' ? flowColor(paint) ?? INK : INK));
  return [el('g', { transform: `scale(${r2(k * 1000) / 1000})` }, inner)];
}

/** The settings a symbol draws with, from the scene's colours and one element's own choices. */
function symbolSettings(scene: SceneSettings, e: SceneElementSetting, link?: SceneLinkSetting): ScadaSettings {
  return {
    symbol: e.symbol,
    length: e.length,
    min: typeof e.min === 'number' ? e.min : undefined,
    max: typeof e.max === 'number' ? e.max : undefined,
    medium: link?.medium ?? e.medium,
    arrows: link?.arrows === true,
    animation: scene.animation,
    idleColor: scene.idleColor,
    runningColor: scene.runningColor,
    warningColor: scene.warningColor,
    criticalColor: scene.criticalColor,
  };
}

export interface SceneModelInput {
  /** Reduced motion off = animated. */
  animate?: boolean;
  /** The host's number words (unit included). */
  format?: (n: number) => string;
}

/** Everything the scene draws, decided once. `problems` counts what could not be placed or joined. */
export function sceneModel(s: SceneSettings, data: Record<string, SlotData | undefined>, o: SceneModelInput = {}) {
  const width = Math.min(4000, Math.max(200, finite(s.width, 1200)));
  const height = Math.min(4000, Math.max(200, finite(s.height, 700)));
  const scale = Math.min(2, Math.max(0.2, finite(s.scale, 0.6)));
  const rows = rowsById(data.points, s.idColumn || 'id');
  const list = (Array.isArray(s.elements) ? (s.elements as SceneElementSetting[]) : []).filter((e) => e && typeof e === 'object').slice(0, MAX_SCENE_ELEMENTS);
  const links = (Array.isArray(s.links) ? (s.links as SceneLinkSetting[]) : []).filter((l) => l && typeof l === 'object').slice(0, MAX_SCENE_LINKS);
  const fmt = o.format ?? ((n: number) => String(r2(n)));
  const boxes = new Map<string, PlacedElement>();
  const settingsOf = new Map<string, SceneElementSetting>();
  const elementNodes: SvgNode[] = [];
  const labelNodes: SvgNode[] = [];
  let problems = 0;

  for (const e of list) {
    if (typeof e.id !== 'string' || !e.id || boxes.has(e.id) || !isScadaSymbol(e.symbol)) { problems += 1; continue; }
    const def = SCADA_SYMBOL_DEFS[e.symbol] as SymbolDef;
    const k = scale * (typeof e.scale === 'number' && e.scale > 0 ? e.scale : 1);
    const row = rows.get(e.id);
    const paint = scadaPaint(symbolSettings(s, e), rowSlots(row), { animate: o.animate, format: fmt });
    const turn = Number(e.turn);
    const drawn = drawScada(e.symbol, paint, turn === 90 || turn === 180 || turn === 270 ? turn : 0, e.mirror === true);
    const x = finite(e.x, 0); const y = finite(e.y, 0);
    const box: PlacedElement = { id: e.id, symbol: e.symbol, x, y, w: r2(drawn.w * k), h: r2(drawn.h * k), k };
    boxes.set(e.id, box);
    settingsOf.set(e.id, e);
    elementNodes.push(el('g', { transform: `translate(${x} ${y}) scale(${r2(k * 1000) / 1000})` }, drawn.nodes));
    if (s.showLabels !== false) {
      const name = typeof row?.label === 'string' && row.label ? row.label : e.label ?? '';
      const showValue = def.valueUnder === true && e.showValue !== false && paint.value !== null;
      let ty = y + box.h + 11;
      if (name) {
        labelNodes.push(text(r2(x + box.w / 2), r2(ty), name, { 'text-anchor': 'middle', 'font-size': 11, fill: MUTED, 'font-family': 'inherit' }));
        ty += 13;
      }
      if (showValue) labelNodes.push(text(r2(x + box.w / 2), r2(ty), fmt(paint.value as number), { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: INK, 'font-family': 'inherit' }));
    }
  }

  const linkNodeList: SvgNode[] = [];
  for (const l of links) {
    const a = parsePort(l.from); const b = parsePort(l.to);
    const ba = a && boxes.get(a.id); const bb = b && boxes.get(b.id);
    if (!a || !b || !ba || !bb) { problems += 1; continue; }
    const kind = (typeof l.kind === 'string' && LINK_KINDS.has(l.kind) ? l.kind : 'pipe') as SceneLinkKind;
    const stateId = typeof l.id === 'string' && l.id ? l.id : a.id;
    const paint = scadaPaint(symbolSettings(s, settingsOf.get(a.id) ?? {}, l), rowSlots(rows.get(stateId)), { animate: o.animate, format: fmt });
    const pa = portPoint(ba, a.side, a.at); const pb = portPoint(bb, b.side, b.at);
    const route = routeLink(pa, a.side, pb, b.side, l.mid ?? null);
    linkNodeList.push(...linkNodes(kind, route, paint, scale));
  }

  const background: SvgNode[] = [];
  if (s.background === 'dots') {
    let d = '';
    for (let yy = 25; yy < height; yy += 50) for (let xx = 25; xx < width; xx += 50) d += `M${xx} ${yy}h0`;
    background.push(el('path', { d, stroke: 'var(--border)', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }));
  } else if (s.background === 'panel') {
    background.push(el('rect', { x: 0, y: 0, width, height, rx: 8, fill: 'var(--surface-raised)', stroke: 'var(--border)', 'stroke-width': 2 }));
  }

  return {
    width, height, scale, problems,
    viewBox: `0 0 ${width} ${height}`,
    empty: boxes.size === 0,
    nodes: [...background, ...linkNodeList, ...elementNodes, ...labelNodes],
  };
}

export type SceneModel = ReturnType<typeof sceneModel>;
