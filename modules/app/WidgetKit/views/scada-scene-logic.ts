// The pure logic of the process scene (no React): a canvas of process symbols placed by coordinates, joined by pipes,
// hoses, cables, signal wires and strip lines that route themselves between the symbols' ports. One bound table feeds
// every symbol and link: a row per `id` with the columns `value`, `value2`, `running`, `status`, `warning`, `critical`,
// `label` and `capacity`. The scene is an SVG node tree; `ScadaSceneView.tsx` draws it and kui-ejs vendors this file.
//
// Coordinates are scene units (the canvas is `width` x `height`). A symbol is drawn at `scale` (the scene's, times its
// own); every connection has the thickness of a symbol port at that scale, so a pipe leaving a pump matches it.
//
// Things (phase 35): a second table, `things`, places one symbol per row where the row says (a room's people, a pen's
// animals, a yard's vehicles). A thing is drawn, ruled and clickable like an authored symbol and connections may end on
// it by its id; it is placed by the data, never by hand. A scene patch from a compute script (`scene-patch.ts`) is
// applied last: authored settings, then the rules, then the patch.

import type { SlotData } from '../kind';
import { arrow, flowColor, INK, MUTED, pipes, wire, type Paint } from './scada-draw';
import { cablePath, hosePath, strip } from './scene-connections';
import {
  drawScada, isScadaSymbol, SCADA_SYMBOL_DEFS, scadaPaint, type ScadaSettings, type ScadaSymbol, type SymbolDef,
} from './scada-logic';
import { applyStates, isLocked, mergeStates, STATE_COLUMNS, type SymbolStates } from './scada-states';
import { evaluateRules, parseTurn, type SceneEffects, type RuleState } from './scene-rules-logic';
import { MAX_PATCH_COORD, MAX_PATCH_LINKS, patchId, type ObjectPatch, type ScenePatch } from './scene-patch';
import { cssColor } from '../settings/style';
import { el, r2, text, type SvgNode } from './svg-node';

export type SceneLinkKind = 'pipe' | 'hose' | 'cable' | 'wire' | 'strip' | 'line' | 'sld';
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
  mediumColor?: string;
  min?: number | null;
  max?: number | null;
  showValue?: boolean;
  /** Where the name sits: under the symbol (default), above it, or nowhere. */
  labelPos?: 'b' | 't' | 'n';
  /** Where the number of a level or dial sits: under the symbol (default) or beside it. */
  valuePos?: 'b' | 'r';
  /** Own colours and number words; empty = the scene's or the symbol's default. */
  fillColor?: string;
  idleColor?: string;
  runningColor?: string;
  warningColor?: string;
  criticalColor?: string;
  unit?: string;
  decimals?: number | null;
};

/** A drawing on the canvas that is not a process symbol: a title, a zone outline, a divider. Never takes a reading. */
export type SceneShapeSetting = {
  kind?: 'text' | 'zone' | 'divider' | string;
  /** text: the anchor point; zone and divider: the top-left corner. Scene units. */
  x?: number;
  y?: number;
  /** zone and divider: the size (a divider with a height of 0 or less is horizontal, with a width of 0 or less vertical). */
  w?: number;
  h?: number;
  /** text: the words; zone: its title. */
  text?: string;
  size?: 's' | 'm' | 'l';
  align?: 'start' | 'middle' | 'end';
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'error';
  dashed?: boolean;
};

export type SceneLinkSetting = {
  id?: string;
  from?: string;
  to?: string;
  kind?: SceneLinkKind | string;
  medium?: string;
  mediumColor?: string;
  mid?: number | null;
  arrows?: boolean;
};

export type SceneSettings = {
  width?: number;
  height?: number;
  scale?: number;
  background?: 'none' | 'dots' | 'panel';
  /** What an element's x and y mean: its centre (default) or its top-left corner. */
  anchor?: 'center' | 'corner';
  /** The view: the content with a margin (default), or the whole canvas. */
  fit?: 'content' | 'canvas';
  showLabels?: boolean;
  idColumn?: string;
  elements?: unknown;
  links?: unknown;
  shapes?: unknown;
  /** ISA-101 style: running parts are not green, only a warning or an alarm draws in colour. */
  calm?: boolean;
  animation?: boolean;
  idleColor?: string;
  runningColor?: string;
  warningColor?: string;
  criticalColor?: string;
  /** Data-driven rules (`scene-rules-logic.ts`). */
  rules?: unknown;
  // Things from the `things` table (phase 35): which column holds what, and how its x and y map onto the canvas.
  thingsIdColumn?: string;
  thingsSymbolColumn?: string;
  /** One symbol for every thing; empty = each row's symbol column. */
  thingsSymbol?: string;
  thingsXColumn?: string;
  thingsYColumn?: string;
  thingsTurnColumn?: string;
  thingsLabelColumn?: string;
  /** What a thing's x and y are: scene units (default), or metres mapped with `thingsScale` from `thingsOriginX/Y`. */
  thingsUnits?: 'scene' | 'metres';
  /** Scene units per metre (default 50). */
  thingsScale?: number;
  /** Where the site's 0, 0 lies on the canvas, in scene units. */
  thingsOriginX?: number;
  thingsOriginY?: number;
};

/** The height of a label line and the margin around the content, in scene units. */
const LABEL = 16;
const MARGIN = 20;

export const MAX_SCENE_ELEMENTS = 200;
export const MAX_SCENE_LINKS = 300;
/** At most this many things from the `things` table (or a patch); past it, the first ones and a problem, never a blank. */
export const MAX_SCENE_THINGS = 500;
/** Scene units per metre when a thing's x and y are metres and the scene names no scale. */
export const DEFAULT_THINGS_SCALE = 50;
export const SCENE_COLUMNS = ['value', 'value2', 'running', 'status', 'warning', 'critical', 'label', 'capacity', ...STATE_COLUMNS] as const;

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
  /** Placed by a row of the `things` table (or a patch's things), not by the author. */
  from?: 'things';
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

const LINK_KINDS: ReadonlySet<string> = new Set(['pipe', 'hose', 'cable', 'wire', 'strip', 'line', 'sld']);
export const MAX_SCENE_SHAPES = 100;

const TONE: Record<string, string> = { neutral: 'var(--border-strong)', info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)', error: 'var(--error)' };
const TEXT_SIZE: Record<string, number> = { s: 12, m: 15, l: 22 };

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
  else if (kind === 'sld') inner = [el('path', { d, fill: 'none', stroke: paint.state === 'idle' ? INK : paint.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'butt' })];
  else inner = [el('path', { d, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })];
  const spot = arrowSpot(unit);
  if (spot && (kind === 'line' || paint.arrows)) inner.push(arrow(spot.x, spot.y, spot.deg, kind === 'line' ? 13 : 11, kind === 'pipe' || kind === 'hose' ? flowColor(paint) ?? INK : INK));
  return [el('g', { transform: `scale(${r2(k * 1000) / 1000})` }, applyStates(inner, 0, 0, paint, false))];
}

/** The settings a symbol draws with, from the scene's colours, one element's own choices and what the rules decided. */
function symbolSettings(scene: SceneSettings, e: SceneElementSetting, link?: SceneLinkSetting, fx: SceneEffects = {}): ScadaSettings {
  return {
    symbol: e.symbol,
    length: e.length,
    min: typeof e.min === 'number' ? e.min : undefined,
    max: typeof e.max === 'number' ? e.max : undefined,
    // An `off` part carries nothing.
    medium: fx.state === 'off' ? 'none' : fx.medium ?? link?.medium ?? e.medium,
    mediumColor: link?.mediumColor ?? e.mediumColor,
    arrows: link?.arrows === true,
    animation: fx.animate === false ? false : scene.animation,
    fillColor: e.fillColor || undefined,
    idleColor: e.idleColor || scene.idleColor,
    runningColor: e.runningColor || (scene.calm === true ? 'var(--text-primary)' : scene.runningColor),
    warningColor: e.warningColor || scene.warningColor,
    criticalColor: e.criticalColor || scene.criticalColor,
  };
}

/** How much a passive (dimmed) part shows through. */
export const DIM_OPACITY = 0.4;

const slot = (value: SlotData['value']): SlotData => ({ shape: 'scalar', value });

/** The slots a symbol reads with a state the rules forced: the alarm columns are replaced, the table is not touched. */
function withState(slots: Record<string, SlotData>, state: RuleState): Record<string, SlotData> {
  const out = { ...slots };
  if (state === 'running') out.running = slot(true);
  else if (state === 'idle' || state === 'off') out.running = slot(false);
  out.status = slot(state === 'warning' || state === 'critical' ? state : null);
  out.warning = slot(false);
  out.critical = slot(false);
  return out;
}

/**
 * The accent replaces the state colour (and the liquid's, in an alarm); `fillColor` replaces the liquid's. Symbols draw
 * an idle part in the muted ink, so an accent, or an idle colour that is not the default, makes it a coloured part that
 * does not move (state `running`, `running` flag unchanged).
 */
function withColors(base: Paint, fx: SceneEffects): Paint {
  const paint = withStates(base, fx);
  const idle = paint.state === 'idle';
  const accent = fx.color ?? (idle && paint.idle !== MUTED ? paint.idle : undefined);
  if (!accent && !fx.fillColor) return paint;
  const alarm = paint.state === 'warning' || paint.state === 'critical';
  return { ...paint, state: accent && idle ? 'running' : paint.state, color: accent ?? paint.color, fill: fx.fillColor ?? (fx.color && alarm ? fx.color : paint.fill) };
}

/**
 * The states the rules (or a patch) forced, over what the row reported. A lockout is one-way: a rule or a patch may
 * impose one, but never lift the one the row reports (LOTO is set on the equipment, not drawn by a script), so the
 * symbol keeps its padlock and its gestures stay off.
 */
function withStates(paint: Paint, fx: SceneEffects): Paint {
  const forced: Partial<SymbolStates> = {};
  if (fx.mode !== undefined && !(isLocked(paint.states) && fx.mode !== 'lockout')) forced.mode = fx.mode;
  if (fx.quality !== undefined) forced.quality = fx.quality;
  if (fx.speed !== undefined) forced.speed = fx.speed;
  if (fx.reverse !== undefined) forced.reverse = fx.reverse;
  if (fx.ack !== undefined) forced.ack = fx.ack;
  if (fx.position !== undefined) forced.position = fx.position;
  if (fx.pending !== undefined) forced.pending = fx.pending;
  if (fx.failed !== undefined) forced.failed = fx.failed;
  return Object.keys(forced).length ? { ...paint, states: mergeStates(paint.states, forced) } : paint;
}

/** A passive look and a blink around a drawing. The blink only runs where motion is allowed (`paint.animate`). */
function dressed(nodes: SvgNode[], paint: Paint, fx: SceneEffects): SvgNode[] {
  let out = nodes;
  if (fx.dim ?? fx.state === 'off') out = [el('g', { opacity: DIM_OPACITY }, out)];
  if (fx.blink === true && paint.animate) {
    out = [el('g', undefined, [...out, el('animate', { attributeName: 'opacity', values: '1;0.2;1', dur: '1.2s', repeatCount: 'indefinite' })])];
  }
  return out;
}

/** A number as text; a symbol's own `unit` and `decimals` ask the host's formatter for them. */
export type SceneFormat = (n: number, own?: { unit?: string; decimals?: number }) => string;

const defaultFormat: SceneFormat = (n, own) => {
  const t = typeof own?.decimals === 'number' ? n.toFixed(own.decimals) : String(r2(n));
  return own?.unit ? `${t} ${own.unit}` : t;
};

export interface SceneModelInput {
  /** Reduced motion off = animated. */
  animate?: boolean;
  /** The host's number words (unit included). */
  format?: SceneFormat;
  /** The effective board parameters, for rules that read a parameter. */
  params?: Record<string, unknown>;
  /** The host's words of an on / off reading, for a rule label's `{condition}` (the state card's `stat.on` / `stat.off`); default On / Off. */
  onOff?: { on: string; off: string };
  /**
   * A compute script's scene patch, already parsed (`parseScenePatch`), applied last: its things replace the things
   * table's rows, its objects override what the rules decided per id, its links and shapes add to the authored ones,
   * its view says what to fit and its problems join the problem list.
   */
  patch?: ScenePatch | null;
}

/** A clickable box: a symbol's or a thing's, its name, whether it is locked out, and where it came from. */
export interface SceneHit {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  locked: boolean;
  /** Placed by a row of the things table (or a patch); absent for an authored symbol. */
  from?: 'things';
}

/** A thing's turn from its row: degrees snapped to the nearest quarter (0, 90, 180, 270), or the words of a turn. */
export function thingTurn(v: unknown): 0 | 90 | 180 | 270 {
  const word = parseTurn(v);
  if (word) return Number(word) as 0 | 90 | 180 | 270;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return 0;
  return ((Math.round((((n % 360) + 360) % 360) / 90) * 90) % 360) as 0 | 90 | 180 | 270;
}

const coord = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** One thing to place: the element it stands for (id, symbol, place, turn, name) and the row it reads. */
export interface SceneThing { e: SceneElementSetting; row: Row }

/**
 * The things of a scene: the patch's things when it has them, else the `things` table's rows, read through the
 * scene's thing columns. A row without a usable id or a place is skipped, as is one whose id an authored symbol (or an
 * earlier thing) already has: each counts as a problem. A place more than `MAX_PATCH_COORD` scene units from the
 * canvas origin (after the metres mapping) is not a place either: one far-off row would otherwise stretch the content
 * box until every symbol is a speck, or overflow the view box. Past `MAX_SCENE_THINGS` the rest count as one problem.
 */
export function sceneThings(s: SceneSettings, rows: ReadonlyArray<Record<string, unknown>>, authored: ReadonlySet<string>): { things: SceneThing[]; problems: number } {
  const col = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);
  const idCol = col(s.thingsIdColumn, 'id');
  const symbolCol = col(s.thingsSymbolColumn, 'symbol');
  const xCol = col(s.thingsXColumn, 'x'); const yCol = col(s.thingsYColumn, 'y');
  const turnCol = col(s.thingsTurnColumn, 'turn'); const labelCol = col(s.thingsLabelColumn, 'label');
  const fixed = typeof s.thingsSymbol === 'string' && s.thingsSymbol.trim() ? s.thingsSymbol.trim() : '';
  const metres = s.thingsUnits === 'metres';
  const k = finite(s.thingsScale, DEFAULT_THINGS_SCALE) > 0 ? Math.min(1000, finite(s.thingsScale, DEFAULT_THINGS_SCALE)) : DEFAULT_THINGS_SCALE;
  const bound = (v: number) => Math.min(MAX_PATCH_COORD, Math.max(-MAX_PATCH_COORD, v));
  const ox = bound(finite(s.thingsOriginX, 0)); const oy = bound(finite(s.thingsOriginY, 0));
  // A scene place, or null when it lies off every canvas (an overflow to Infinity included).
  const onCanvas = (v: number | null): number | null => (v !== null && Number.isFinite(v) && Math.abs(v) <= MAX_PATCH_COORD ? v : null);
  const things: SceneThing[] = [];
  const seen = new Set<string>();
  let problems = rows.length > MAX_SCENE_THINGS ? 1 : 0;
  for (const row of rows.slice(0, MAX_SCENE_THINGS)) {
    if (!row || typeof row !== 'object') { problems += 1; continue; }
    const id = patchId(row[idCol]);
    const cx = coord(row[xCol]); const cy = coord(row[yCol]);
    const x = onCanvas(cx === null ? null : metres ? ox + cx * k : cx);
    const y = onCanvas(cy === null ? null : metres ? oy + cy * k : cy);
    if (id === null || x === null || y === null || authored.has(id) || seen.has(id)) { problems += 1; continue; }
    seen.add(id);
    const own = typeof row[symbolCol] === 'string' ? (row[symbolCol] as string).trim() : '';
    const label = row[labelCol];
    things.push({
      e: {
        id,
        symbol: fixed || own,
        x,
        y,
        turn: thingTurn(row[turnCol]),
        ...(typeof label === 'string' && label ? { label } : typeof label === 'number' && Number.isFinite(label) ? { label: String(label) } : {}),
      },
      row,
    });
  }
  return { things, problems };
}

/** What a thing or a re-skinned symbol draws when its key is not one this registry can draw (unknown or locked). */
export function placeholderDrawing(): { nodes: SvgNode[]; w: number; h: number } {
  return {
    w: 100, h: 100,
    nodes: [
      el('rect', { x: 6, y: 6, width: 88, height: 88, rx: 12, fill: 'var(--surface-sunken)', stroke: MUTED, 'stroke-width': 3, 'stroke-dasharray': '8 6' }),
      text(50, 63, '?', { 'text-anchor': 'middle', 'font-size': 38, 'font-weight': 600, fill: MUTED, 'font-family': 'inherit' }),
    ],
  };
}

/** The 2D effects of a patch's object override (the reading, the 3D effects and the designer params are not effects). */
function patchEffects(o: ObjectPatch | undefined): SceneEffects | undefined {
  if (!o) return undefined;
  const { value: _value, pulse: _pulse, size: _size, dz: _dz, params: _params, ...fx } = o;
  return fx;
}

/** Everything the scene draws, decided once. `problems` counts what could not be placed or joined. */
export function sceneModel(s: SceneSettings, data: Record<string, SlotData | undefined>, o: SceneModelInput = {}) {
  const width = Math.min(4000, Math.max(200, finite(s.width, 1200)));
  const height = Math.min(4000, Math.max(200, finite(s.height, 700)));
  const scale = Math.min(2, Math.max(0.2, finite(s.scale, 0.6)));
  const patch = o.patch ?? null;
  const rows = rowsById(data.points, s.idColumn || 'id');
  const list = (Array.isArray(s.elements) ? (s.elements as SceneElementSetting[]) : []).filter((e) => e && typeof e === 'object').slice(0, MAX_SCENE_ELEMENTS);
  const authoredLinks = (Array.isArray(s.links) ? (s.links as SceneLinkSetting[]) : []).filter((l) => l && typeof l === 'object').slice(0, MAX_SCENE_LINKS);
  // A patch's connections come on top of the authored ones, under their own cap.
  const links: SceneLinkSetting[] = [...authoredLinks, ...(patch?.links ?? []).slice(0, MAX_PATCH_LINKS)];
  const baseFormat: SceneFormat = o.format ?? defaultFormat;
  // A symbol's own unit and decimals, when it has them; every other number follows the host.
  const fmtOf = (e: SceneElementSetting | undefined): ((n: number) => string) => {
    const unit = typeof e?.unit === 'string' && e.unit.trim() ? e.unit.trim() : undefined;
    const decimals = typeof e?.decimals === 'number' && Number.isFinite(e.decimals) ? Math.min(6, Math.max(0, Math.round(e.decimals))) : undefined;
    return unit === undefined && decimals === undefined ? (n) => baseFormat(n) : (n) => baseFormat(n, { unit, decimals });
  };
  const ownLinkIds = authoredLinks.map((l) => (typeof l.id === 'string' ? l.id : '')).filter(Boolean);
  const placeable = list.filter((e) => typeof e.id === 'string' && e.id && isScadaSymbol(e.symbol));
  const byId = new Map<string, SceneElementSetting>();
  for (const e of placeable) if (!byId.has(e.id as string)) byId.set(e.id as string, e);
  const authoredIds = new Set(list.map((e) => (typeof e.id === 'string' ? e.id : '')).filter(Boolean));
  // The things: the patch's when it has them, else the table's rows. Their rows are what a rule reads for them.
  const placed = sceneThings(s, patch?.things ?? data.things?.rows ?? [], authoredIds);
  const thingRows = new Map(rows);
  for (const t of placed.things) thingRows.set(t.e.id as string, t.row);
  // What the rules decided, by symbol id, connection id and thing id; a patch's override wins over a rule.
  const ruled = Array.isArray(s.rules) && s.rules.length
    ? evaluateRules(s.rules, {
      rows: thingRows, params: o.params ?? {}, targets: [...byId.keys(), ...ownLinkIds], thingIds: placed.things.map((t) => t.e.id as string),
      format: (id, n) => fmtOf(byId.get(id))(n), ...(o.onOff ? { onOff: o.onOff } : {}),
    })
    : new Map<string, SceneEffects>();
  const objects = patch?.objects ?? {};
  const effects = new Map(ruled);
  for (const [id, over] of Object.entries(objects)) {
    const fx = patchEffects(over);
    if (fx && Object.keys(fx).length) effects.set(id, { ...effects.get(id), ...fx });
  }
  /** A row with a patch's reading laid over it (the table is not changed). */
  const rowOf = (id: string, base: Row | undefined): Row | undefined => {
    const over = Object.hasOwn(objects, id) ? objects[id] : undefined;
    return over && Object.hasOwn(over, 'value') ? { ...(base ?? {}), value: over.value } : base;
  };
  const boxes = new Map<string, PlacedElement>();
  const settingsOf = new Map<string, SceneElementSetting>();
  // A symbol on a line takes the medium of the first connection that touches it, so a pipe and the valve in it agree.
  const touching = new Map<string, string>();
  for (const l of links) {
    if (typeof l.medium !== 'string' || l.medium === 'none') continue;
    for (const ref of [l.from, l.to]) {
      const port = parsePort(ref);
      if (port && !touching.has(port.id)) touching.set(port.id, l.medium);
    }
  }
  const centred = s.anchor !== 'corner';
  let bounds: { x0: number; y0: number; x1: number; y1: number } | null = null;
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    bounds = bounds ? { x0: Math.min(bounds.x0, x0), y0: Math.min(bounds.y0, y0), x1: Math.max(bounds.x1, x1), y1: Math.max(bounds.y1, y1) } : { x0, y0, x1, y1 };
  };
  const elementNodes: SvgNode[] = [];
  const labelNodes: SvgNode[] = [];
  const hidden = new Set<string>();
  const locked = new Set<string>();
  const names = new Map<string, string>();
  let problems = placed.problems;

  /**
   * Places one symbol: an authored element (its row from the table) or a thing (its own row). The rules and the patch
   * may move it (`dx`, `dy`), resize it (`scale`), turn it and draw it as another symbol; a key this registry cannot
   * draw (a thing's, or a re-skin) draws the placeholder, so data never blanks a symbol.
   */
  const place = (e: SceneElementSetting, row: Row | undefined, from?: 'things') => {
    const id = e.id as string;
    const fx = effects.get(id) ?? {};
    const wanted = fx.symbol ?? e.symbol;
    const drawable = isScadaSymbol(wanted);
    const symbolKey = (drawable ? wanted : e.symbol) as ScadaSymbol;
    const def = drawable ? (SCADA_SYMBOL_DEFS[symbolKey] as SymbolDef) : undefined;
    const k = scale * (typeof e.scale === 'number' && e.scale > 0 ? e.scale : 1) * (fx.scale ?? 1);
    const own = e.medium && e.medium !== 'none' ? e : { ...e, medium: touching.get(id) ?? 'none' };
    const fmtE = fmtOf(e);
    const slots = rowSlots(rowOf(id, row));
    const paint = withColors(scadaPaint(symbolSettings(s, { ...own, symbol: drawable ? symbolKey : undefined }, undefined, fx), fx.state ? withState(slots, fx.state) : slots, { animate: o.animate, format: fmtE }), fx);
    if (isLocked(paint.states)) locked.add(id);
    const turn = Number(fx.turn ?? e.turn);
    const drawn = def ? drawScada(symbolKey, paint, turn === 90 || turn === 180 || turn === 270 ? turn : 0, e.mirror === true) : placeholderDrawing();
    const w = r2(drawn.w * k); const h = r2(drawn.h * k);
    const x = r2(finite(e.x, 0) + (fx.dx ?? 0) - (centred ? w / 2 : 0)); const y = r2(finite(e.y, 0) + (fx.dy ?? 0) - (centred ? h / 2 : 0));
    const box: PlacedElement = { id, symbol: drawable ? symbolKey : String(wanted ?? ''), x, y, w, h, k, ...(from ? { from } : {}) };
    boxes.set(id, box);
    settingsOf.set(id, e);
    const named = s.showLabels !== false && (!!e.label || !!fx.label || typeof row?.label === 'string') && e.labelPos !== 'n';
    grow(x - 2, y - (named && e.labelPos === 't' ? LABEL : 2), x + w + (e.valuePos === 'r' ? 56 : 2), y + h + (s.showLabels !== false && e.labelPos !== 'n' ? LABEL * 2 + 2 : 2));
    const name = fx.label ?? (typeof row?.label === 'string' && row.label ? row.label : e.label ?? '');
    names.set(id, name || id);
    // A hidden symbol keeps its box (connections still join it and the view does not jump), but draws nothing.
    if (fx.hidden === true) { hidden.add(id); return; }
    elementNodes.push(el('g', { transform: `translate(${x} ${y}) scale(${r2(k * 1000) / 1000})`, ...(from ? { 'data-from': from } : {}) }, dressed(drawn.nodes, paint, fx)));
    if (s.showLabels !== false) {
      const showValue = def?.valueUnder === true && e.showValue !== false && paint.value !== null;
      let ty = y + box.h + 14;
      if (name && e.labelPos !== 'n') {
        const above = e.labelPos === 't';
        labelNodes.push(text(r2(x + box.w / 2), r2(above ? y - 7 : ty), name, { 'text-anchor': 'middle', 'font-size': 14, fill: MUTED, 'font-family': 'inherit' }));
        if (!above) ty += 16;
      }
      if (showValue) {
        const beside = e.valuePos === 'r';
        labelNodes.push(text(r2(beside ? x + box.w + 8 : x + box.w / 2), r2(beside ? y + box.h / 2 + 5 : ty), fmtE(paint.value as number),
          { 'text-anchor': beside ? 'start' : 'middle', 'font-size': 14, 'font-weight': 600, fill: INK, 'font-family': 'inherit' }));
      }
    }
  };

  for (const e of list) {
    if (typeof e.id !== 'string' || !e.id || boxes.has(e.id) || !isScadaSymbol(e.symbol)) { problems += 1; continue; }
    place(e, rows.get(e.id));
  }
  // Things after the authored symbols: they draw on top and never take an authored id.
  for (const t of placed.things) place(t.e, t.row, 'things');

  // Shapes: zones and dividers sit under everything, titles on top. They widen the content box like a symbol does.
  const shapes = [
    ...(Array.isArray(s.shapes) ? (s.shapes as SceneShapeSetting[]) : []).filter((h) => h && typeof h === 'object').slice(0, MAX_SCENE_SHAPES),
    ...(patch?.shapes ?? []).slice(0, MAX_SCENE_SHAPES),
  ];
  const shapeUnder: SvgNode[] = [];
  const shapeOver: SvgNode[] = [];
  for (const h of shapes) {
    const x = finite(h.x, 0); const y = finite(h.y, 0);
    const color = TONE[h.tone ?? 'neutral'] ?? TONE.neutral;
    if (h.kind === 'zone') {
      const w = Math.max(20, finite(h.w, 200)); const hh = Math.max(20, finite(h.h, 120));
      grow(x - 2, y - 2, x + w + 2, y + hh + 2);
      shapeUnder.push(el('rect', { x, y, width: w, height: hh, rx: 10, fill: color, 'fill-opacity': h.tone && h.tone !== 'neutral' ? 0.08 : 0.04, stroke: color, 'stroke-width': 1.5, ...(h.dashed === false ? {} : { 'stroke-dasharray': '6 5' }) }));
      if (typeof h.text === 'string' && h.text) shapeOver.push(text(r2(x + 12), r2(y + 20), h.text, { 'font-size': 13, 'font-weight': 600, fill: MUTED, 'font-family': 'inherit' }));
    } else if (h.kind === 'divider') {
      const vertical = finite(h.w, 0) <= 0 && finite(h.h, 0) > 0;
      const len = Math.max(20, vertical ? finite(h.h, 100) : finite(h.w, 200));
      grow(x - 2, y - 2, vertical ? x + 2 : x + len + 2, vertical ? y + len + 2 : y + 2);
      shapeUnder.push(el('line', { x1: x, y1: y, x2: vertical ? x : x + len, y2: vertical ? y + len : y, stroke: color, 'stroke-width': 1.5, ...(h.dashed === true ? { 'stroke-dasharray': '6 5' } : {}) }));
    } else if (h.kind === 'text' && typeof h.text === 'string' && h.text) {
      const size = TEXT_SIZE[h.size ?? 'm'] ?? TEXT_SIZE.m;
      const anchor = h.align === 'start' || h.align === 'end' ? h.align : 'middle';
      const approx = h.text.length * size * 0.56;
      grow(anchor === 'start' ? x : anchor === 'end' ? x - approx : x - approx / 2, y - size, anchor === 'start' ? x + approx : anchor === 'end' ? x : x + approx / 2, y + 4);
      shapeOver.push(text(x, y, h.text, { 'text-anchor': anchor, 'font-size': size, 'font-weight': size >= 22 ? 700 : 600, fill: h.tone && h.tone !== 'neutral' ? color : size >= 15 ? INK : MUTED, 'font-family': 'inherit' }));
    } else problems += 1;
  }

  const linkNodeList: SvgNode[] = [];
  for (const l of links) {
    const a = parsePort(l.from); const b = parsePort(l.to);
    const ba = a && boxes.get(a.id); const bb = b && boxes.get(b.id);
    if (!a || !b || !ba || !bb) { problems += 1; continue; }
    const kind = (typeof l.kind === 'string' && LINK_KINDS.has(l.kind) ? l.kind : 'pipe') as SceneLinkKind;
    const stateId = typeof l.id === 'string' && l.id ? l.id : a.id;
    // A connection with its own id answers its own rules; without one it follows its "from" symbol's state, colours
    // and motion (an `off` symbol's line is passive too; never its hidden, dim, blink, label or medium).
    const own = typeof l.id === 'string' && l.id ? effects.get(l.id) : undefined;
    const fromFx = effects.get(a.id);
    const fx: SceneEffects = own ?? (!(typeof l.id === 'string' && l.id) && fromFx
      ? { state: fromFx.state, color: fromFx.color, fillColor: fromFx.fillColor, animate: fromFx.animate, speed: fromFx.speed, reverse: fromFx.reverse }
      : {});
    if (fx.hidden === true) continue;
    const slots = rowSlots(rowOf(stateId, thingRows.get(stateId)));
    const paint = withColors(scadaPaint(symbolSettings(s, settingsOf.get(a.id) ?? {}, l, fx), fx.state ? withState(slots, fx.state) : slots, { animate: o.animate, format: fmtOf(settingsOf.get(a.id)) }), fx);
    const pa = portPoint(ba, a.side, a.at); const pb = portPoint(bb, b.side, b.at);
    const route = routeLink(pa, a.side, pb, b.side, l.mid ?? null);
    for (const pt of route) grow(pt.x - 8, pt.y - 8, pt.x + 8, pt.y + 8);
    linkNodeList.push(...dressed(linkNodes(kind, route, paint, scale), paint, fx));
  }

  // The view: the content with a margin, or the whole canvas; a patch may name either, or a region of its own.
  const view = patch?.view;
  const fit = view === 'content' || view === 'canvas' ? view : s.fit;
  const region = view && typeof view === 'object' && 'x0' in view ? view : null;
  const box = region ? { x0: Math.floor(region.x0), y0: Math.floor(region.y0), x1: Math.ceil(region.x1), y1: Math.ceil(region.y1) }
    : (fit === 'canvas' || !bounds) ? { x0: 0, y0: 0, x1: width, y1: height }
      : { x0: Math.floor((bounds as { x0: number }).x0 - MARGIN), y0: Math.floor((bounds as { y0: number }).y0 - MARGIN), x1: Math.ceil((bounds as { x1: number }).x1 + MARGIN), y1: Math.ceil((bounds as { y1: number }).y1 + MARGIN) };
  const vw = box.x1 - box.x0; const vh = box.y1 - box.y0;
  const background: SvgNode[] = [];
  if (s.background === 'dots') {
    let d = '';
    for (let yy = Math.ceil(box.y0 / 50) * 50 + 25; yy < box.y1; yy += 50) for (let xx = Math.ceil(box.x0 / 50) * 50 + 25; xx < box.x1; xx += 50) d += `M${xx} ${yy}h0`;
    background.push(el('path', { d, stroke: 'var(--border)', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }));
  } else if (s.background === 'panel') {
    background.push(el('rect', { x: box.x0, y: box.y0, width: vw, height: vh, rx: 8, fill: 'var(--surface-raised)', stroke: 'var(--border)', 'stroke-width': 2 }));
  }

  // Each symbol's and thing's box and name, for a host that makes them clickable (the view draws a hit area where one
  // has an action); a thing's hit says so (`from: 'things'`), so a host looks its row up in the things table.
  const hits = [...boxes.values()].filter((b) => !hidden.has(b.id)).map((b): SceneHit => ({
    id: b.id, name: names.get(b.id) ?? b.id, x: b.x, y: b.y, w: b.w, h: b.h, locked: locked.has(b.id), ...(b.from ? { from: b.from } : {}),
  }));
  const patchProblems = patch?.problems ?? [];

  return {
    width: vw, height: vh, scale, problems: problems + patchProblems.length, hits,
    /** The patch's own problem lines (plain text), for a problem list. */
    patchProblems,
    /** The ids of the things that were placed (hidden ones included). */
    thingIds: placed.things.map((t) => t.e.id as string),
    viewBox: `${box.x0} ${box.y0} ${vw} ${vh}`,
    empty: boxes.size === 0,
    nodes: [...background, ...shapeUnder, ...linkNodeList, ...elementNodes, ...labelNodes, ...shapeOver],
  };
}

export type SceneModel = ReturnType<typeof sceneModel>;
