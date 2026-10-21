// The pure state of the diagram editor shell and canvas (no React): the tools, the selection, the editor's own viewport
// (zoom and pan) with the pointer-to-scene conversion, the keyboard map, resize and own-size drags, the what-if overlay
// and the small local libraries (saved pieces, recent symbols). The edit operations themselves live in
// `scene-edit-logic.ts`; this file only decides what the pointer and the keys mean.

import type { SlotData } from '../kind';
import type { SceneModel, SceneSettings, SceneShapeSetting, SceneSide } from './scada-scene-logic';
import { addLink, cleanAssembly, type Assembly, type EditResult, type Selection } from './scene-edit-logic';
import { elementBoxes, linksOf, shapeBounds, shapesOf, unionBox, type Box, type MarqueeResult, type Pt } from './scene-edit-geometry';
import type { WhatIfState } from './scene-editor-types';

// ─── Tools and selection ─────────────────────────────────────────────────────

export type Tool = 'select' | 'connect' | 'pan' | 'text' | 'zone' | 'divider';
export const TOOLS: readonly Tool[] = ['select', 'connect', 'pan', 'text', 'zone', 'divider'];

/** Single keys that choose a tool (inside the canvas, no modifier). */
export const TOOL_KEYS: Readonly<Record<string, Tool>> = { v: 'select', c: 'connect', h: 'pan', t: 'text', z: 'zone', d: 'divider' };

export const EMPTY_SELECTION: Selection = Object.freeze({ elements: [], shapes: [], links: [] }) as Selection;

export type SelectItem = { kind: 'element'; id: string } | { kind: 'shape'; index: number } | { kind: 'link'; index: number };

export const selectionCount = (s: Selection): number => (s.elements?.length ?? 0) + (s.shapes?.length ?? 0) + (s.links?.length ?? 0);
export const isEmptySelection = (s: Selection): boolean => selectionCount(s) === 0;

/** A selection holding only `item`. */
export function only(item: SelectItem): Selection {
  return item.kind === 'element' ? { elements: [item.id], shapes: [], links: [] }
    : item.kind === 'shape' ? { elements: [], shapes: [item.index], links: [] } : { elements: [], shapes: [], links: [item.index] };
}

const flip = <T,>(list: readonly T[] | undefined, v: T): T[] => (list ?? []).includes(v) ? (list ?? []).filter((x) => x !== v) : [...(list ?? []), v];

/** Shift-click: adds the item, or takes it out when it is already selected. */
export function toggleItem(sel: Selection, item: SelectItem): Selection {
  const base = { elements: [...(sel.elements ?? [])], shapes: [...(sel.shapes ?? [])], links: [...(sel.links ?? [])] };
  if (item.kind === 'element') base.elements = flip(sel.elements, item.id);
  else if (item.kind === 'shape') base.shapes = flip(sel.shapes, item.index);
  else base.links = flip(sel.links, item.index);
  return base;
}

export function hasItem(sel: Selection, item: SelectItem): boolean {
  return item.kind === 'element' ? !!sel.elements?.includes(item.id) : item.kind === 'shape' ? !!sel.shapes?.includes(item.index) : !!sel.links?.includes(item.index);
}

/** The marquee's result, alone or added to what was selected. */
export function fromMarquee(sel: Selection, m: MarqueeResult, additive: boolean): Selection {
  if (!additive) return { elements: m.elements, shapes: m.shapes, links: [] };
  return {
    elements: [...new Set([...(sel.elements ?? []), ...m.elements])],
    shapes: [...new Set([...(sel.shapes ?? []), ...m.shapes])],
    links: [...(sel.links ?? [])],
  };
}

export const sameSelection = (a: Selection, b: Selection): boolean => {
  const eq = <T,>(x: readonly T[] | undefined, y: readonly T[] | undefined) => (x?.length ?? 0) === (y?.length ?? 0) && (x ?? []).every((v, i) => v === (y ?? [])[i]);
  return eq(a.elements, b.elements) && eq(a.shapes, b.shapes) && eq(a.links, b.links);
};

/** Everything that can be selected: symbols that are shown and unlocked, and every shape. */
export function selectAll(settings: SceneSettings, model: Pick<SceneModel, 'hits'>, skip: ReadonlySet<string> = new Set()): Selection {
  return {
    elements: model.hits.filter((h) => !skip.has(h.id)).map((h) => h.id),
    shapes: shapesOf(settings).map((h, i) => (h && typeof h === 'object' ? i : -1)).filter((i) => i >= 0),
    links: [],
  };
}

/** The selection without what no longer exists (an undo or a deletion removed it). Returns the same object when nothing went. */
export function pruneSelection(sel: Selection, settings: SceneSettings): Selection {
  const ids = new Set<string>();
  for (const e of Array.isArray(settings.elements) ? settings.elements : []) if (e && typeof (e as { id?: unknown }).id === 'string') ids.add((e as { id: string }).id);
  const shapes = shapesOf(settings).length; const links = linksOf(settings).length;
  const elements = (sel.elements ?? []).filter((id) => ids.has(id));
  const sh = (sel.shapes ?? []).filter((i) => i >= 0 && i < shapes);
  const li = (sel.links ?? []).filter((i) => i >= 0 && i < links);
  if (elements.length === (sel.elements?.length ?? 0) && sh.length === (sel.shapes?.length ?? 0) && li.length === (sel.links?.length ?? 0)) return sel;
  return { elements, shapes: sh, links: li };
}

/** The box of everything selected that has one (symbols and shapes). */
export function selectionBox(sel: Selection, model: Pick<SceneModel, 'hits'>, settings: SceneSettings): Box | null {
  const boxes = elementBoxes(model);
  const list: Box[] = [];
  for (const id of sel.elements ?? []) { const b = boxes.get(id); if (b) list.push(b); }
  const shapes = shapesOf(settings);
  for (const i of sel.shapes ?? []) { const b = shapeBounds(shapes[i] as SceneShapeSetting); if (b) list.push(b); }
  return unionBox(list);
}

/** `ids` without the locked ones. */
export const unlocked = (ids: readonly string[] | undefined, locked: ReadonlySet<string>): string[] => (ids ?? []).filter((id) => !locked.has(id));

// ─── The viewport ────────────────────────────────────────────────────────────

/** The editor's own view: the centre in scene units, and a zoom where 1 shows the whole base box. */
export interface Viewport { cx: number; cy: number; zoom: number }
export interface ViewBox { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }
export interface ClientRect { left: number; top: number; width: number; height: number }

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 16;
/** The margin around the canvas in the fitted view, scene units. */
export const FIT_MARGIN = 40;
/** What the viewport assumes for an element that has no size yet (before the first measure, in jsdom). */
export const DEFAULT_SIZE: Size = { w: 800, h: 500 };

const finite = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** The whole canvas with a margin, grown to hold anything that lies outside it. */
export function baseBox(settings: SceneSettings, model: Pick<SceneModel, 'hits'>): ViewBox {
  const width = clamp(finite(settings.width, 1200), 200, 4000);
  const height = clamp(finite(settings.height, 700), 200, 4000);
  const parts: Box[] = [{ x: 0, y: 0, w: width, h: height }];
  for (const h of model.hits) parts.push({ x: h.x, y: h.y, w: h.w, h: h.h });
  for (const raw of shapesOf(settings)) { const b = shapeBounds(raw as SceneShapeSetting); if (b) parts.push(b); }
  const u = unionBox(parts) as Box;
  return { x: u.x - FIT_MARGIN, y: u.y - FIT_MARGIN, w: u.w + 2 * FIT_MARGIN, h: u.h + 2 * FIT_MARGIN };
}

export const fitViewport = (base: ViewBox): Viewport => ({ cx: base.x + base.w / 2, cy: base.y + base.h / 2, zoom: 1 });

/** Pixels per scene unit when the view is at `zoom`. */
export const pixelsPerUnit = (vp: Viewport, base: ViewBox, size: Size): number => Math.min(size.w / base.w, size.h / base.h) * vp.zoom;

/** The scene rectangle the element shows: its aspect is the element's, so nothing is letterboxed. */
export function viewBoxFor(vp: Viewport, base: ViewBox, size: Size): ViewBox {
  const k = pixelsPerUnit(vp, base, size);
  const w = size.w / k; const h = size.h / k;
  return { x: vp.cx - w / 2, y: vp.cy - h / 2, w, h };
}

/** Where a client point lands in the scene. Pure, so it works where there is no `getScreenCTM`. */
export function clientToScene(client: Pt, rect: ClientRect, vb: ViewBox): Pt {
  const w = rect.width > 0 ? rect.width : DEFAULT_SIZE.w; const h = rect.height > 0 ? rect.height : DEFAULT_SIZE.h;
  return { x: vb.x + ((client.x - rect.left) / w) * vb.w, y: vb.y + ((client.y - rect.top) / h) * vb.h };
}

/** The inverse: where a scene point is in the element, in pixels from its top-left. */
export function sceneToLocal(p: Pt, rect: ClientRect, vb: ViewBox): Pt {
  const w = rect.width > 0 ? rect.width : DEFAULT_SIZE.w; const h = rect.height > 0 ? rect.height : DEFAULT_SIZE.h;
  return { x: ((p.x - vb.x) / vb.w) * w, y: ((p.y - vb.y) / vb.h) * h };
}

/** Keeps the centre within the base box grown by half its size on every side, so the diagram cannot be lost. */
export function clampViewport(vp: Viewport, base: ViewBox): Viewport {
  const zoom = clamp(vp.zoom, MIN_ZOOM, MAX_ZOOM);
  return {
    zoom,
    cx: clamp(vp.cx, base.x - base.w / 2, base.x + base.w * 1.5),
    cy: clamp(vp.cy, base.y - base.h / 2, base.y + base.h * 1.5),
  };
}

/** Zooms by `factor` keeping the scene point `at` where it is on screen. */
export function zoomAt(vp: Viewport, base: ViewBox, factor: number, at: Pt): Viewport {
  const zoom = clamp(vp.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const f = zoom / vp.zoom;
  return clampViewport({ zoom, cx: at.x - (at.x - vp.cx) / f, cy: at.y - (at.y - vp.cy) / f }, base);
}

export const panBy = (vp: Viewport, base: ViewBox, dx: number, dy: number): Viewport => clampViewport({ ...vp, cx: vp.cx + dx, cy: vp.cy + dy }, base);

/** Puts `point` (a scene point) in the middle of the view (a click on the minimap). */
export const centerOn = (vp: Viewport, base: ViewBox, point: Pt): Viewport => clampViewport({ ...vp, cx: point.x, cy: point.y }, base);

/** The zoom a wheel step means: one notch is a tenth. */
export const wheelFactor = (deltaY: number, ctrl = false): number => Math.exp(-clamp(deltaY, -200, 200) * (ctrl ? 0.01 : 0.0015));

/** Two pointers: the zoom factor and the move of their middle (client pixels) between two readings. */
export function pinch(a0: Pt, b0: Pt, a1: Pt, b1: Pt): { factor: number; dx: number; dy: number; mid: Pt } {
  const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y); const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }; const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  return { factor: d0 > 0 && d1 > 0 ? d1 / d0 : 1, dx: m1.x - m0.x, dy: m1.y - m0.y, mid: m1 };
}

// ─── The keyboard map ────────────────────────────────────────────────────────

export type KeyCommand =
  | { type: 'undo' } | { type: 'redo' } | { type: 'copy' } | { type: 'paste' } | { type: 'duplicate' } | { type: 'delete' }
  | { type: 'selectAll' } | { type: 'escape' } | { type: 'zoomIn' } | { type: 'zoomOut' } | { type: 'fit' } | { type: 'rename' }
  | { type: 'nudge'; dx: number; dy: number } | { type: 'resize'; dx: number; dy: number } | { type: 'tool'; tool: Tool }
  | { type: 'connectSelected' } | { type: 'scale'; factor: number } | { type: 'front' } | { type: 'back' };

export interface KeyInput { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean }

const ARROWS: Record<string, Pt> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };

/**
 * What a key press means. Combinations with Ctrl or Cmd work wherever the editor has focus (the caller leaves text
 * fields alone); single keys only inside the canvas, so typing in a panel never moves a symbol.
 */
export function keyCommand(e: KeyInput, where: { canvas: boolean }): KeyCommand | null {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const mod = !!(e.ctrlKey || e.metaKey);
  if (mod) {
    if (key === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' };
    if (key === 'y') return { type: 'redo' };
    if (key === 'c') return { type: 'copy' };
    if (key === 'v') return { type: 'paste' };
    if (key === 'd') return { type: 'duplicate' };
    if (key === 'a') return where.canvas ? { type: 'selectAll' } : null;
    if (key === ']') return { type: 'front' };
    if (key === '[') return { type: 'back' };
    return null;
  }
  if (!where.canvas) return key === 'Escape' ? { type: 'escape' } : null;
  const arrow = ARROWS[e.key];
  if (arrow) {
    if (e.altKey) { const step = e.shiftKey ? 50 : 10; return { type: 'resize', dx: arrow.x * step, dy: arrow.y * step }; }
    const step = e.shiftKey ? 10 : 1;
    return { type: 'nudge', dx: arrow.x * step, dy: arrow.y * step };
  }
  if (key === 'Delete' || key === 'Backspace') return { type: 'delete' };
  if (key === 'Escape') return { type: 'escape' };
  if (key === 'F2') return { type: 'rename' };
  if (key === '+' || key === '=') return { type: 'zoomIn' };
  if (key === '-' || key === '_') return { type: 'zoomOut' };
  if (key === '0') return { type: 'fit' };
  if (key === 'a') return { type: 'selectAll' };
  if (key === 'k') return { type: 'connectSelected' };
  if (key === ']') return { type: 'scale', factor: 1.1 };
  if (key === '[') return { type: 'scale', factor: 1 / 1.1 };
  if (Object.hasOwn(TOOL_KEYS, key)) return { type: 'tool', tool: TOOL_KEYS[key] };
  return null;
}

/** True for a target that takes typed text (the key map leaves it alone). */
export function isTextTarget(t: { tagName?: string; isContentEditable?: boolean; type?: string } | null): boolean {
  if (!t) return false;
  const tag = (t.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color'].includes((t.type ?? 'text').toLowerCase());
  return t.isContentEditable === true;
}

// ─── Drags ───────────────────────────────────────────────────────────────────

export type ShapeHandle = 'se' | 'e' | 's' | 'end';
export interface ShapeHandlePoint { handle: ShapeHandle; x: number; y: number }

/** The resize handles of a zone (corner and the middles of the right and bottom edges) or a divider (its far end). */
export function shapeHandles(shape: SceneShapeSetting): ShapeHandlePoint[] {
  const b = shapeBounds(shape);
  if (!b) return [];
  if (shape.kind === 'zone') return [
    { handle: 'se', x: b.x + b.w, y: b.y + b.h }, { handle: 'e', x: b.x + b.w, y: b.y + b.h / 2 }, { handle: 's', x: b.x + b.w / 2, y: b.y + b.h },
  ];
  if (shape.kind === 'divider') return [{ handle: 'end', x: b.x + b.w, y: b.y + b.h }];
  return [];
}

/** The size a drag of `handle` to `point` asks for (`resizeShape` clamps it); `grid` snaps it. */
export function sizeFromHandle(shape: SceneShapeSetting, handle: ShapeHandle, point: Pt, grid: number | false = false): { w?: number; h?: number } {
  const x = finite(shape.x, 0); const y = finite(shape.y, 0);
  const snap = (v: number) => (grid ? Math.round(v / grid) * grid : round2(v));
  if (shape.kind === 'divider') {
    const vertical = finite(shape.w, 0) <= 0 && finite(shape.h, 0) > 0;
    const len = snap(vertical ? point.y - y : point.x - x);
    return vertical ? { h: len } : { w: len };
  }
  if (handle === 'e') return { w: snap(point.x - x) };
  if (handle === 's') return { h: snap(point.y - y) };
  return { w: snap(point.x - x), h: snap(point.y - y) };
}

/** The own-size factor a drag of the corner handle asks for: the start factor times how much farther the pointer is from the symbol's anchor. */
export function ownSizeFromDrag(anchor: Pt, startPointer: Pt, startScale: number, point: Pt): number {
  const d0 = Math.hypot(startPointer.x - anchor.x, startPointer.y - anchor.y);
  if (d0 < 1e-6) return startScale;
  const d1 = Math.hypot(point.x - anchor.x, point.y - anchor.y);
  return clamp(round2((startScale * d1) / d0), 0.2, 4);
}

/** The sides a connection between two boxes leaves and enters by: along the longer way between their centres. */
export function facingSides(a: Box, b: Box): { from: SceneSide; to: SceneSide } {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2); const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? { from: 'r', to: 'l' } : { from: 'l', to: 'r' };
  return dy >= 0 ? { from: 'b', to: 't' } : { from: 't', to: 'b' };
}

/** Joins two symbols by the sides that face each other (the keyboard path of the connect tool). */
export function connectFacing(s: SceneSettings, model: Pick<SceneModel, 'hits'>, from: string, to: string, kind: string): EditResult {
  const boxes = elementBoxes(model);
  const a = boxes.get(from); const b = boxes.get(to);
  if (!a || !b) return { settings: s, refused: 'No symbol has this id' };
  const sides = facingSides(a, b);
  return addLink(s, { id: from, side: sides.from }, { id: to, side: sides.to }, kind);
}

/** The symbol whose box holds `p` (grown by `pad`), topmost first; `skip` ids are ignored. */
export function elementAt(model: Pick<SceneModel, 'hits'>, p: Pt, skip: ReadonlySet<string> = new Set(), pad = 0): string | null {
  for (let i = model.hits.length - 1; i >= 0; i -= 1) {
    const h = model.hits[i];
    if (!skip.has(h.id) && p.x >= h.x - pad && p.x <= h.x + h.w + pad && p.y >= h.y - pad && p.y <= h.y + h.h + pad) return h.id;
  }
  return null;
}

// ─── What-if ─────────────────────────────────────────────────────────────────

/** The real data with the what-if rows laid over the bound table's rows (a row that is not there yet is added). The input is not changed. */
export function overlayData(data: Record<string, SlotData | undefined>, whatIf: WhatIfState, idColumn = 'id'): Record<string, SlotData | undefined> {
  const ids = Object.keys(whatIf.rows).filter((id) => Object.keys(whatIf.rows[id] ?? {}).length > 0);
  if (!ids.length) return data;
  const points: SlotData = data.points ?? { shape: 'table', rows: [] };
  const rows = (points.rows ?? []).map((r) => ({ ...r }));
  for (const id of ids) {
    const at = rows.findIndex((r) => String(r[idColumn]) === id);
    if (at >= 0) Object.assign(rows[at], whatIf.rows[id]);
    else rows.push({ [idColumn]: id, ...whatIf.rows[id] });
  }
  return { ...data, points: { ...points, rows } };
}

/** The board parameters with the what-if overrides over them. */
export const overlayParams = (params: Record<string, unknown>, whatIf: WhatIfState): Record<string, unknown> => (Object.keys(whatIf.params).length ? { ...params, ...whatIf.params } : params);

/**
 * The scene's rules with one "hidden" rule per session-hidden symbol on the end (a later rule wins), so the editor can
 * draw the scene without a symbol while the stored settings stay untouched. Leaves room under the rules cap.
 */
export function withSessionHidden(settings: SceneSettings, hidden: ReadonlySet<string>, cap = 200): SceneSettings {
  if (!hidden.size) return settings;
  const rules = (Array.isArray(settings.rules) ? settings.rules : []).slice(0, Math.max(0, cap - hidden.size));
  return { ...settings, rules: [...rules, ...[...hidden].map((id) => ({ target: id, hidden: true }))] };
}

// ─── Local libraries (saved pieces, recent symbols) ──────────────────────────

export const LIBRARY_CAP = 30;
export const RECENT_CAP = 8;
export interface SavedAssembly { name: string; assembly: Assembly }

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;

/** The browser's storage, or null where there is none or it throws (a private window). */
export function browserStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

export function loadLibrary(storage: ReadStore | null, key: string): SavedAssembly[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(`${key}.library`);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    const out: SavedAssembly[] = [];
    for (const item of list.slice(0, LIBRARY_CAP)) {
      const name = item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string' ? (item as { name: string }).name.slice(0, 60) : '';
      const checked = cleanAssembly(item && typeof item === 'object' ? (item as { assembly?: unknown }).assembly : null);
      if (name && checked.ok) out.push({ name, assembly: checked.assembly });
    }
    return out;
  } catch { return []; }
}

export function saveLibrary(storage: WriteStore | null, key: string, items: readonly SavedAssembly[]): boolean {
  if (!storage) return false;
  try { storage.setItem(`${key}.library`, JSON.stringify(items.slice(0, LIBRARY_CAP))); return true; } catch { return false; }
}

/** The library with a piece added (a piece of the same name is replaced, the oldest goes past the cap). */
export function addToLibrary(items: readonly SavedAssembly[], name: string, assembly: Assembly): SavedAssembly[] {
  const clean = name.trim().slice(0, 60);
  if (!clean) return [...items];
  return [...items.filter((i) => i.name !== clean), { name: clean, assembly: { ...assembly, name: clean } }].slice(-LIBRARY_CAP);
}

export const removeFromLibrary = (items: readonly SavedAssembly[], name: string): SavedAssembly[] => items.filter((i) => i.name !== name);

export function loadRecent(storage: ReadStore | null, key: string): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(`${key}.recent`);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string' && v.length < 80).slice(0, RECENT_CAP) : [];
  } catch { return []; }
}

export function saveRecent(storage: WriteStore | null, key: string, list: readonly string[]): boolean {
  if (!storage) return false;
  try { storage.setItem(`${key}.recent`, JSON.stringify(list.slice(0, RECENT_CAP))); return true; } catch { return false; }
}

/** The symbol first, then the others it pushed down (no repeats, capped). */
export const pushRecent = (list: readonly string[], symbol: string): string[] => [symbol, ...list.filter((s) => s !== symbol)].slice(0, RECENT_CAP);
