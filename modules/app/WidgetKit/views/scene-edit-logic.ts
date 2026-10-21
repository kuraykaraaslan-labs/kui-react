// The editing model of the process diagram editor (pure, no React): every edit is a function over the scene settings
// that returns new settings and never changes its input. An edit that would break a cap or a rule returns the input
// itself with a `refused` reason; one that changes nothing returns the input without one. The result of every edit passes
// the scene template's own validation (unique ids, no dangling connection) and leaves no rule naming a missing symbol.
//
// Symbols are addressed by id; connections and shapes by their index in the stored list (a connection need not have an
// id). Positions mean what the scene's `anchor` says (the centre by default). `scene-edit-geometry.ts` reads the drawn
// model, the history, snapping, assemblies and problems list live in their own files and are re-exported here.

import { isScadaSymbol } from './scada-logic';
import { parsePort, type SceneModel, type SceneSettings, type SceneShapeSetting, type SceneSide } from './scada-scene-logic';
import {
  appendCopies, arr, capRefusal, elementIds, elementsOf, finite, formatPort, freeId, isFormKey, isLinkKind, isRec, isSafeKey, mapList,
  noop, patched, pruneRules, refuse, replacePortId, round, sceneRules, shortName, targetNames, type EditResult, type EditSettings, type Rec, type Selection,
} from './scene-edit-core';
import { elementBoxes, shapeBounds, type Box, type Pt } from './scene-edit-geometry';

export * from './scene-edit-core';
export * from './scene-edit-history';
export * from './scene-edit-snap';
export * from './scene-edit-assembly';
export * from './scene-edit-problems';

const ELEMENT_TURNS = [0, 90, 180, 270];

// ─── Symbols ─────────────────────────────────────────────────────────────────

/** Adds a symbol of the registry at `at`, last in draw order, with the next free id of its short name (`pump1`, `pump2`). */
export function addElement(s: SceneSettings, symbol: string, at: Pt, props: Rec = {}): EditResult {
  if (!isScadaSymbol(symbol)) return refuse(s, 'Choose a symbol from the library');
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return refuse(s, 'The position is not a number');
  const why = capRefusal(s, { elements: 1 });
  if (why) return refuse(s, why);
  const bad = checkElementPatch(props);
  if (bad) return refuse(s, bad);
  const id = freeId(shortName(symbol), elementIds(s));
  const element: Rec = { id, symbol, x: round(at.x), y: round(at.y), ...clean(props) };
  return { settings: { ...s, elements: [...elementsOf(s), element] }, id, ids: [id] };
}

/** A patch without the keys that have their own edit (`id`, `symbol`) and without removals (for a record that is new). */
function clean(patch: Rec): Rec {
  const out: Rec = {};
  for (const [k, v] of Object.entries(patch)) if (k !== 'id' && k !== 'symbol' && v !== undefined) out[k] = v;
  return out;
}

/** The same, but a removal (`undefined`) stays, for a record that exists. */
function ownFields(patch: Rec): Rec {
  const out: Rec = {};
  for (const [k, v] of Object.entries(patch)) if (k !== 'id' && k !== 'symbol') out[k] = v;
  return out;
}

const NUM_RANGES: Record<string, [number, number]> = { x: [-1e5, 1e5], y: [-1e5, 1e5], scale: [0.2, 4], min: [-1e9, 1e9], max: [-1e9, 1e9] };
const ENUMS: Record<string, readonly string[]> = { labelPos: ['b', 't', 'n'], valuePos: ['b', 'r'], length: ['1', '2', '3'] };
const NULLABLE = new Set(['scale', 'min', 'max']);

/** Why a patch of a symbol's own fields cannot be written, or null. Unknown fields pass if they are plain values. */
function checkElementPatch(patch: Rec): string | null {
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id') return 'Rename a symbol with renameElement';
    if (!isSafeKey(k)) return `"${k}" is not a field name`;
    if (v === undefined) continue;
    if (k === 'symbol') { if (!isScadaSymbol(v)) return 'Choose a symbol from the library'; continue; }
    if (k === 'turn') { if (!ELEMENT_TURNS.includes(Number(v)) || v === '' || v === null) return 'A symbol turns by 0, 90, 180 or 270 degrees'; continue; }
    if (k in NUM_RANGES) {
      if (v === null && NULLABLE.has(k)) continue;
      const [lo, hi] = NUM_RANGES[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) return `${k} must be a number from ${lo} to ${hi}`;
      continue;
    }
    if (k in ENUMS) { if (!ENUMS[k].includes(String(v))) return `${k} must be one of ${ENUMS[k].join(', ')}`; continue; }
    if (k === 'mirror' || k === 'showValue') { if (typeof v !== 'boolean') return `${k} is on or off`; continue; }
    if (v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return `${k} must be a plain value`;
    if (typeof v === 'string' && v.length > 200) return `${k} is too long`;
    if (typeof v === 'number' && !Number.isFinite(v)) return `${k} must be a finite number`;
  }
  return null;
}

const toIds = (ids: string | readonly string[]): Set<string> => new Set(typeof ids === 'string' ? [ids] : ids);

function mapElements(s: SceneSettings, ids: ReadonlySet<string>, fn: (e: Rec) => Rec): EditResult {
  const list = elementsOf(s);
  const next = mapList(list, (e) => (isRec(e) && typeof e.id === 'string' && ids.has(e.id) ? fn(e) : e));
  return next === list ? noop(s) : { settings: { ...s, elements: next } };
}

/** Writes the symbol's own fields (label, medium, min, max, scale, label positions, colours ...). `undefined` removes a field. */
export function setElementProps(s: SceneSettings, ids: string | readonly string[], patch: Rec): EditResult {
  const bad = checkElementPatch(patch);
  if (bad) return refuse(s, bad);
  const own = ownFields(patch);
  const sym = patch.symbol !== undefined ? { symbol: patch.symbol } : {};
  return mapElements(s, toIds(ids), (e) => patched(e, { ...own, ...sym }));
}

/** Own size: a multiplier of the scene's symbol size (0.2 to 4), or null for none. */
export const setOwnSize = (s: SceneSettings, ids: string | readonly string[], scale: number | null): EditResult => setElementProps(s, ids, { scale });

/** Turns symbols by a quarter or half turn (`by` is 90, 180, 270 or -90); keeps the stored type (a number or the template's text). */
export function turnElements(s: SceneSettings, ids: string | readonly string[], by: 90 | 180 | 270 | -90): EditResult {
  return mapElements(s, toIds(ids), (e) => {
    const cur = Number(e.turn);
    const next = (((ELEMENT_TURNS.includes(cur) ? cur : 0) + by) % 360 + 360) % 360;
    return patched(e, { turn: typeof e.turn === 'string' ? String(next) : next });
  });
}

/** Flips symbols (each one the other way from what it is now). */
export function mirrorElements(s: SceneSettings, ids: string | readonly string[]): EditResult {
  return mapElements(s, toIds(ids), (e) => patched(e, { mirror: e.mirror !== true }));
}

/** Moves symbols and shapes by (`dx`, `dy`). One call is one history entry, so a drag is one undo step. */
export function moveSelection(s: SceneSettings, sel: Selection, dx: number, dy: number): EditResult {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return refuse(s, 'The distance is not a number');
  if (dx === 0 && dy === 0) return noop(s);
  const ids = new Set(sel.elements ?? []);
  const shapes = new Set(sel.shapes ?? []);
  const shift = (r: Rec): Rec => ({ ...r, x: round(finite(r.x, 0) + dx), y: round(finite(r.y, 0) + dy) });
  const elements = mapList(elementsOf(s), (e) => (isRec(e) && typeof e.id === 'string' && ids.has(e.id) ? shift(e) : e));
  const shapeList = mapList(arr(s.shapes), (h, i) => (isRec(h) && shapes.has(i) ? shift(h) : h));
  if (elements === elementsOf(s) && shapeList === arr(s.shapes)) return noop(s);
  const next: SceneSettings = { ...s };
  if (elements !== elementsOf(s)) next.elements = elements;
  if (shapeList !== arr(s.shapes)) next.shapes = shapeList;
  return { settings: next };
}

export const moveElements = (s: SceneSettings, ids: readonly string[], dx: number, dy: number): EditResult => moveSelection(s, { elements: ids }, dx, dy);
export const moveShapes = (s: SceneSettings, indices: readonly number[], dx: number, dy: number): EditResult => moveSelection(s, { shapes: indices }, dx, dy);

/**
 * Deletes symbols, with what hangs on them: every connection that ends on one, and every rule whose `target`, `of` or
 * `of2` names one (unless a connection that stays still carries that id).
 */
export function deleteElements(s: SceneSettings, ids: readonly string[]): EditResult {
  const gone = new Set(ids);
  const have = elementIds(s);
  for (const id of [...gone]) if (!have.has(id)) gone.delete(id);
  if (!gone.size) return noop(s);
  const next: SceneSettings = { ...s, elements: elementsOf(s).filter((e) => !(isRec(e) && typeof e.id === 'string' && gone.has(e.id))) };
  const links = arr(s.links);
  const keptLinks = links.filter((l) => !(isRec(l) && [l.from, l.to].some((ref) => { const p = parsePort(ref); return !!p && gone.has(p.id); })));
  if (keptLinks.length !== links.length) next.links = keptLinks;
  return { settings: pruneRules(s, next) };
}

/**
 * Gives a symbol another id (the row it reads in the bound table follows the name). Every connection end, and every
 * rule's `target`, `of` and `of2`, that named it follows. Refused: an id the table cannot use, an id another symbol has.
 */
export function renameElement(s: SceneSettings, from: string, to: string): EditResult {
  const have = elementIds(s);
  if (!have.has(from)) return refuse(s, 'No symbol has this id');
  if (from === to) return noop(s);
  if (!isFormKey(to)) return refuse(s, 'An id starts with a letter or _ and has only letters, digits, . _ -');
  if (have.has(to)) return refuse(s, 'Another symbol already has this id');
  const next: SceneSettings = { ...s, elements: mapList(elementsOf(s), (e) => (isRec(e) && e.id === from ? { ...e, id: to } : e)) };
  const links = mapList(arr(s.links), (l) => {
    if (!isRec(l)) return l;
    const f = replacePortId(l.from, from, to); const t = replacePortId(l.to, from, to);
    return f === l.from && t === l.to ? l : { ...l, from: f, to: t };
  });
  if (links !== arr(s.links)) next.links = links;
  const rules = mapList(sceneRules(s), (r) => {
    if (!isRec(r)) return r;
    const patch: Rec = {};
    for (const k of ['target', 'of', 'of2'] as const) if (r[k] === from) patch[k] = to;
    return patched(r, patch);
  });
  if (rules !== sceneRules(s)) (next as EditSettings).rules = rules;
  return { settings: next, id: to };
}

// ─── Connections ─────────────────────────────────────────────────────────────

export type PortRef = string | { id: string; side: SceneSide; at?: number };

const portOf = (ref: PortRef) => (typeof ref === 'string' ? parsePort(ref) : parsePort(formatPort(ref)));

/** Joins two ports (`{ id, side, at }` or a string like `pump1.r`). The route is the scene's own; nothing here decides geometry. */
export function addLink(s: SceneSettings, from: PortRef, to: PortRef, kind = 'pipe', props: Rec = {}): EditResult {
  const a = portOf(from); const b = portOf(to);
  if (!a || !b) return refuse(s, 'Use a symbol id and a side: l, r, t or b');
  if (!isLinkKind(kind)) return refuse(s, 'Choose a connection kind');
  const have = elementIds(s);
  if (!have.has(a.id) || !have.has(b.id)) return refuse(s, 'No symbol has this id');
  if (a.id === b.id) return refuse(s, 'A connection joins two different symbols');
  const why = capRefusal(s, { links: 1 });
  if (why) return refuse(s, why);
  const f = formatPort(a); const t = formatPort(b);
  const twin = arr(s.links).some((l) => isRec(l) && ((l.from === f && l.to === t) || (l.from === t && l.to === f)));
  if (twin) return refuse(s, 'These two ports are already joined');
  const bad = checkLinkPatch(props);
  if (bad) return refuse(s, bad);
  const link: Rec = { from: f, to: t, kind, ...clean(props) };
  return { settings: { ...s, links: [...arr(s.links), link] }, index: arr(s.links).length };
}

function checkLinkPatch(patch: Rec): string | null {
  for (const [k, v] of Object.entries(patch)) {
    if (!isSafeKey(k)) return `"${k}" is not a field name`;
    if (k === 'from' || k === 'to') return 'Move a connection end with reconnectLink';
    if (v === undefined) continue;
    if (k === 'kind') { if (!isLinkKind(v)) return 'Choose a connection kind'; continue; }
    if (k === 'mid') { if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e5)) return 'The middle leg is a number'; continue; }
    if (k === 'arrows') { if (typeof v !== 'boolean') return 'arrows is on or off'; continue; }
    if (k === 'id') { if (v !== '' && !isFormKey(v)) return 'An id starts with a letter or _ and has only letters, digits, . _ -'; continue; }
    if (v !== null && typeof v !== 'string') return `${k} must be text`;
    if (typeof v === 'string' && v.length > 200) return `${k} is too long`;
  }
  return null;
}

function mapLink(s: SceneSettings, index: number, fn: (l: Rec) => Rec): EditResult {
  const l = arr(s.links)[index];
  if (!isRec(l)) return refuse(s, 'No such connection');
  const next = fn(l);
  if (next === l) return noop(s);
  const links = arr(s.links).slice();
  links[index] = next;
  return { settings: { ...s, links } };
}

/** Writes a connection's own fields (kind, medium, mediumColor, mid, arrows, id). `undefined` and, for `mid`, null remove the field. */
export function setLinkProps(s: SceneSettings, index: number, patch: Rec): EditResult {
  const bad = checkLinkPatch(patch);
  if (bad) return refuse(s, bad);
  const fixed: Rec = { ...patch };
  if (fixed.mid === null) fixed.mid = undefined;
  const r = mapLink(s, index, (l) => patched(l, fixed));
  if (!('id' in patch) || r.settings === s) return r;
  // A connection's id is a name rules may target: when it changes, the rules that named it follow (or go, if it is cleared).
  const old = (arr(s.links)[index] as Rec).id;
  const to = typeof patch.id === 'string' ? patch.id : '';
  if (typeof old !== 'string' || !old || old === to || targetNames(r.settings).has(old)) return r;
  if (!to) return { settings: pruneRules(s, r.settings) };
  const rules = mapList(sceneRules(r.settings), (rule) => {
    if (!isRec(rule)) return rule;
    const change: Rec = {};
    for (const k of ['target', 'of', 'of2'] as const) if (rule[k] === old) change[k] = to;
    return patched(rule, change);
  });
  return rules === sceneRules(r.settings) ? r : { settings: { ...r.settings, rules } as SceneSettings };
}

export const setLinkKind = (s: SceneSettings, index: number, kind: string): EditResult => setLinkProps(s, index, { kind });

/** The middle leg of a Z route (an x for two horizontal ports, a y for two vertical ones); null goes back to automatic. */
export const setMid = (s: SceneSettings, index: number, value: number | null): EditResult => setLinkProps(s, index, { mid: value });

/** Moves one end of a connection to another port. */
export function reconnectLink(s: SceneSettings, index: number, end: 'from' | 'to', port: PortRef): EditResult {
  const p = portOf(port);
  const link = arr(s.links)[index];
  if (!isRec(link)) return refuse(s, 'No such connection');
  if (!p) return refuse(s, 'Use a symbol id and a side: l, r, t or b');
  if (!elementIds(s).has(p.id)) return refuse(s, 'No symbol has this id');
  const other = parsePort(end === 'from' ? link.to : link.from);
  if (other && other.id === p.id) return refuse(s, 'A connection joins two different symbols');
  return mapLink(s, index, (l) => patched(l, { [end]: formatPort(p) }));
}

export function deleteLinks(s: SceneSettings, indices: readonly number[]): EditResult {
  const gone = new Set(indices);
  const links = arr(s.links);
  const kept = links.filter((_, i) => !gone.has(i));
  return kept.length === links.length ? noop(s) : { settings: pruneRules(s, { ...s, links: kept }) };
}

export const deleteLink = (s: SceneSettings, index: number): EditResult => deleteLinks(s, [index]);

// ─── Shapes (titles, zones, dividers) ────────────────────────────────────────

const SHAPE_KINDS = ['text', 'zone', 'divider'] as const;
const SHAPE_ENUMS: Record<string, readonly string[]> = {
  size: ['s', 'm', 'l'], align: ['start', 'middle', 'end'], tone: ['neutral', 'info', 'success', 'warning', 'error'],
};

function checkShapePatch(patch: Rec): string | null {
  for (const [k, v] of Object.entries(patch)) {
    if (!isSafeKey(k)) return `"${k}" is not a field name`;
    if (v === undefined) continue;
    if (k === 'kind') { if (!(SHAPE_KINDS as readonly string[]).includes(String(v))) return 'A shape is a title, a zone or a divider'; continue; }
    if (k === 'x' || k === 'y') { if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e5) return `${k} must be a number`; continue; }
    if (k === 'w' || k === 'h') { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 4000) return `${k} must be a number from 0 to 4000`; continue; }
    if (k === 'text') { if (typeof v !== 'string' || v.length > 80) return 'The words are at most 80 characters'; continue; }
    if (k === 'dashed') { if (typeof v !== 'boolean') return 'dashed is on or off'; continue; }
    if (k in SHAPE_ENUMS) { if (!SHAPE_ENUMS[k].includes(String(v))) return `${k} must be one of ${SHAPE_ENUMS[k].join(', ')}`; continue; }
    return `"${k}" is not a shape field`;
  }
  return null;
}

/** Adds a title (anchor point), a zone or a divider (top-left corner) with the template's starting size. */
export function addShape(s: SceneSettings, kind: 'text' | 'zone' | 'divider', at: Pt, props: Rec = {}): EditResult {
  if (!(SHAPE_KINDS as readonly string[]).includes(kind)) return refuse(s, 'A shape is a title, a zone or a divider');
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return refuse(s, 'The position is not a number');
  const why = capRefusal(s, { shapes: 1 });
  if (why) return refuse(s, why);
  const bad = checkShapePatch(props);
  if (bad) return refuse(s, bad);
  const start: Rec = kind === 'text' ? { text: 'Title', size: 'm' } : kind === 'zone' ? { w: 200, h: 120 } : { w: 200, h: 0 };
  const shape: Rec = { kind, x: round(at.x), y: round(at.y), ...start, ...clean({ ...props, kind: undefined }) };
  return { settings: { ...s, shapes: [...arr(s.shapes), shape] }, index: arr(s.shapes).length };
}

function mapShape(s: SceneSettings, index: number, fn: (h: Rec) => Rec | string): EditResult {
  const h = arr(s.shapes)[index];
  if (!isRec(h)) return refuse(s, 'No such shape');
  const next = fn(h);
  if (typeof next === 'string') return refuse(s, next);
  if (next === h) return noop(s);
  const shapes = arr(s.shapes).slice();
  shapes[index] = next;
  return { settings: { ...s, shapes } };
}

/** Writes a shape's own fields (text, size, align, tone, dashed; the kind stays). */
export function setShapeProps(s: SceneSettings, index: number, patch: Rec): EditResult {
  if ('kind' in patch && patch.kind !== undefined) return refuse(s, 'A shape keeps its kind');
  const bad = checkShapePatch(patch);
  if (bad) return refuse(s, bad);
  return mapShape(s, index, (h) => patched(h, patch));
}

/**
 * Resizes a zone (width and height, 20 to 4000) or a divider (its length: the width of a horizontal one, the height of a
 * vertical one; the other side stays 0). A title has no size.
 */
export function resizeShape(s: SceneSettings, index: number, size: { w?: number; h?: number }): EditResult {
  for (const v of [size.w, size.h]) if (v !== undefined && (!Number.isFinite(v) || v < 0 || v > 4000)) return refuse(s, 'The size is a number from 0 to 4000');
  return mapShape(s, index, (h) => {
    const shape = h as SceneShapeSetting;
    if (shape.kind === 'zone') {
      return patched(h, { ...(size.w !== undefined ? { w: round(Math.max(20, size.w)) } : {}), ...(size.h !== undefined ? { h: round(Math.max(20, size.h)) } : {}) });
    }
    if (shape.kind === 'divider') {
      const vertical = finite(shape.w, 0) <= 0 && finite(shape.h, 0) > 0;
      const len = vertical ? size.h ?? size.w : size.w ?? size.h;
      return len === undefined ? h : patched(h, vertical ? { w: 0, h: round(Math.max(20, len)) } : { w: round(Math.max(20, len)), h: 0 });
    }
    return 'A title has no size';
  });
}

export function deleteShapes(s: SceneSettings, indices: readonly number[]): EditResult {
  const gone = new Set(indices);
  const shapes = arr(s.shapes);
  const kept = shapes.filter((_, i) => !gone.has(i));
  return kept.length === shapes.length ? noop(s) : { settings: { ...s, shapes: kept } };
}

/** Deletes whatever a selection holds: symbols (with their connections and rules), then shapes, then the listed connections. */
export function deleteSelection(s: SceneSettings, sel: Selection): EditResult {
  // Connections are listed by index in the settings as they are now; delete them first, so the indices still hold.
  let cur = s;
  const a = deleteLinks(cur, sel.links ?? []); cur = a.settings;
  const b = deleteShapes(cur, sel.shapes ?? []); cur = b.settings;
  const c = deleteElements(cur, sel.elements ?? []); cur = c.settings;
  return cur === s ? noop(s) : { settings: cur };
}

// ─── Selections: align, distribute, duplicate, reorder ───────────────────────

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

interface Item { kind: 'e' | 's'; key: string | number; box: Box }

function itemsOf(s: SceneSettings, model: Pick<SceneModel, 'hits'>, sel: Selection): Item[] {
  const boxes = elementBoxes(model);
  const out: Item[] = [];
  for (const e of elementsOf(s)) {
    if (!isRec(e) || typeof e.id !== 'string' || !(sel.elements ?? []).includes(e.id)) continue;
    const box = boxes.get(e.id);
    if (box) out.push({ kind: 'e', key: e.id, box });
  }
  arr(s.shapes).forEach((h, i) => {
    if (!isRec(h) || !(sel.shapes ?? []).includes(i)) return;
    const box = shapeBounds(h as SceneShapeSetting);
    if (box) out.push({ kind: 's', key: i, box });
  });
  return out;
}

/** Moves each item by its own offset; the same settings back when every offset is 0. */
function shiftEach(s: SceneSettings, offsets: Map<Item, Pt>): EditResult {
  const byElement = new Map<string, Pt>(); const byShape = new Map<number, Pt>();
  for (const [item, d] of offsets) {
    if (d.x === 0 && d.y === 0) continue;
    if (item.kind === 'e') byElement.set(item.key as string, d); else byShape.set(item.key as number, d);
  }
  if (!byElement.size && !byShape.size) return noop(s);
  const shift = (r: Rec, d: Pt): Rec => ({ ...r, x: round(finite(r.x, 0) + d.x), y: round(finite(r.y, 0) + d.y) });
  const next: SceneSettings = { ...s };
  if (byElement.size) next.elements = mapList(elementsOf(s), (e) => { const d = isRec(e) && typeof e.id === 'string' ? byElement.get(e.id) : undefined; return d ? shift(e as Rec, d) : e; });
  if (byShape.size) next.shapes = mapList(arr(s.shapes), (h, i) => { const d = byShape.get(i); return d && isRec(h) ? shift(h, d) : h; });
  return { settings: next };
}

/** Lines the selection up on the left, centre, right, top, middle or bottom of its common box (two or more items). */
export function align(s: SceneSettings, model: Pick<SceneModel, 'hits'>, sel: Selection, mode: AlignMode): EditResult {
  const items = itemsOf(s, model, sel);
  if (items.length < 2) return noop(s);
  const x0 = Math.min(...items.map((i) => i.box.x)); const x1 = Math.max(...items.map((i) => i.box.x + i.box.w));
  const y0 = Math.min(...items.map((i) => i.box.y)); const y1 = Math.max(...items.map((i) => i.box.y + i.box.h));
  const offsets = new Map<Item, Pt>();
  for (const it of items) {
    const b = it.box;
    const d: Pt = { x: 0, y: 0 };
    if (mode === 'left') d.x = x0 - b.x;
    else if (mode === 'right') d.x = x1 - (b.x + b.w);
    else if (mode === 'center') d.x = (x0 + x1) / 2 - (b.x + b.w / 2);
    else if (mode === 'top') d.y = y0 - b.y;
    else if (mode === 'bottom') d.y = y1 - (b.y + b.h);
    else d.y = (y0 + y1) / 2 - (b.y + b.h / 2);
    offsets.set(it, { x: Math.abs(d.x) < 0.005 ? 0 : d.x, y: Math.abs(d.y) < 0.005 ? 0 : d.y });
  }
  return shiftEach(s, offsets);
}

/** Spreads the selection so the gaps between its boxes are equal; the first and last (by centre) stay (three or more items). */
export function distribute(s: SceneSettings, model: Pick<SceneModel, 'hits'>, sel: Selection, axis: DistributeAxis): EditResult {
  const items = itemsOf(s, model, sel);
  if (items.length < 3) return noop(s);
  const horizontal = axis === 'horizontal';
  const start = (b: Box) => (horizontal ? b.x : b.y);
  const size = (b: Box) => (horizontal ? b.w : b.h);
  const sorted = items.slice().sort((p, q) => start(p.box) + size(p.box) / 2 - (start(q.box) + size(q.box) / 2));
  const first = sorted[0].box; const last = sorted[sorted.length - 1].box;
  const span = start(last) + size(last) - start(first);
  const gap = (span - sorted.reduce((sum, i) => sum + size(i.box), 0)) / (sorted.length - 1);
  const offsets = new Map<Item, Pt>();
  let cursor = start(first);
  for (const it of sorted) {
    const d = cursor - start(it.box);
    offsets.set(it, horizontal ? { x: Math.abs(d) < 0.005 ? 0 : d, y: 0 } : { x: 0, y: Math.abs(d) < 0.005 ? 0 : d });
    cursor += size(it.box) + gap;
  }
  return shiftEach(s, offsets);
}

/**
 * Copies the selection, offset by `offset` (20, 20 by default): symbols with new ids (`pump1` -> `pump2`), shapes, and the
 * connections that join two selected symbols. `ids`, `shapes` and `links` of the result name the copies.
 */
export function duplicate(s: SceneSettings, sel: Selection, offset: Pt = { x: 20, y: 20 }): EditResult {
  const ids = new Set(sel.elements ?? []);
  const shapes = new Set(sel.shapes ?? []);
  const elements = elementsOf(s).filter((e): e is Rec => isRec(e) && typeof e.id === 'string' && ids.has(e.id));
  const shapeCopies = arr(s.shapes).filter((h, i): h is Rec => isRec(h) && shapes.has(i));
  const chosen = new Set(elements.map((e) => e.id as string));
  const links = arr(s.links).filter((l): l is Rec => isRec(l) && [l.from, l.to].every((ref) => { const p = parsePort(ref); return !!p && chosen.has(p.id); }));
  if (!elements.length && !shapeCopies.length) return noop(s);
  return appendCopies(s, { elements, shapes: shapeCopies, links }, { dx: offset.x, dy: offset.y, keepIds: false });
}

export type ReorderMode = 'front' | 'back' | 'forward' | 'backward';

/** Reorders `list` so the picked positions move; returns the new list and where the picked ones ended up. */
function reorderList<T>(list: readonly T[], picked: ReadonlySet<number>, mode: ReorderMode): { list: T[]; picked: number[] } {
  const rows = list.map((item, i) => ({ item, on: picked.has(i) }));
  if (mode === 'front') rows.sort((a, b) => Number(a.on) - Number(b.on));
  else if (mode === 'back') rows.sort((a, b) => Number(b.on) - Number(a.on));
  else if (mode === 'forward') {
    for (let i = rows.length - 2; i >= 0; i -= 1) if (rows[i].on && !rows[i + 1].on) [rows[i], rows[i + 1]] = [rows[i + 1], rows[i]];
  } else {
    for (let i = 1; i < rows.length; i += 1) if (rows[i].on && !rows[i - 1].on) [rows[i], rows[i - 1]] = [rows[i - 1], rows[i]];
  }
  return { list: rows.map((r) => r.item), picked: rows.flatMap((r, i) => (r.on ? [i] : [])) };
}

/**
 * Changes the draw order (the order of the lists): to the front or back, or one step. Shapes keep their own list (zones
 * and dividers draw under everything, titles over it). `shapes` of the result are the new indices of the moved shapes.
 */
export function reorder(s: SceneSettings, sel: Selection, mode: ReorderMode): EditResult {
  const ids = new Set(sel.elements ?? []);
  const elements = elementsOf(s);
  const eRes = reorderList(elements, new Set(elements.flatMap((e, i) => (isRec(e) && typeof e.id === 'string' && ids.has(e.id) ? [i] : []))), mode);
  const shapes = arr(s.shapes);
  const picked = new Set((sel.shapes ?? []).filter((i) => isRec(shapes[i])));
  const sRes = reorderList(shapes, picked, mode);
  const next: SceneSettings = { ...s };
  let changed = false;
  if (eRes.list.some((e, i) => e !== elements[i])) { next.elements = eRes.list; changed = true; }
  if (sRes.list.some((h, i) => h !== shapes[i])) { next.shapes = sRes.list; changed = true; }
  return changed ? { settings: next, shapes: sRes.picked } : noop(s);
}

// ─── The canvas ──────────────────────────────────────────────────────────────

export interface CanvasPatch { width?: number; height?: number; scale?: number; anchor?: 'center' | 'corner' }

/**
 * Sets the canvas size (200 to 4000), the symbol size (0.2 to 2) and what x and y mean. Changing the anchor with the drawn
 * `model` at hand converts every position so nothing moves on the picture; without it the numbers stay as they are.
 */
export function setCanvas(s: SceneSettings, patch: CanvasPatch, model?: Pick<SceneModel, 'hits'>): EditResult {
  const bad = (v: number | undefined, lo: number, hi: number) => v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi);
  if (bad(patch.width, 200, 4000) || bad(patch.height, 200, 4000)) return refuse(s, 'The canvas is 200 to 4000 units wide and high');
  if (bad(patch.scale, 0.2, 2)) return refuse(s, 'The symbol size is from 0.2 to 2');
  if (patch.anchor !== undefined && patch.anchor !== 'center' && patch.anchor !== 'corner') return refuse(s, 'x and y are the centre or the top-left corner');
  const before = s.anchor === 'corner' ? 'corner' : 'center';
  // An anchor that is already in force (an absent one means the centre) is not written.
  const anchor = patch.anchor !== undefined && patch.anchor !== before ? { anchor: patch.anchor } : {};
  const fields = patched(s as Rec, { ...(patch.width !== undefined ? { width: patch.width } : {}), ...(patch.height !== undefined ? { height: patch.height } : {}),
    ...(patch.scale !== undefined ? { scale: patch.scale } : {}), ...anchor }) as SceneSettings;
  if (patch.anchor === undefined || patch.anchor === before || !model) return fields === s ? noop(s) : { settings: fields };
  const boxes = elementBoxes(model);
  const toCenter = patch.anchor === 'center';
  const elements = mapList(elementsOf(fields), (e) => {
    const box = isRec(e) && typeof e.id === 'string' ? boxes.get(e.id) : undefined;
    if (!isRec(e) || !box) return e;
    const k = toCenter ? 1 : -1;
    return { ...e, x: round(finite(e.x, 0) + k * (box.w / 2)), y: round(finite(e.y, 0) + k * (box.h / 2)) };
  });
  return { settings: elements === elementsOf(fields) ? fields : { ...fields, elements } };
}
