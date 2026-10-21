// Assemblies and the clipboard of the diagram editor (pure, no React). An assembly is a self-contained, JSON-able piece
// of a diagram: some symbols, shapes and the connections among them, at positions relative to the middle of the piece.
// It can be kept as a reusable block or copied as text between boards. Text from outside is data: it is parsed with
// JSON.parse only, checked field by field, capped, and anything unknown in it is dropped. Nothing in it is ever run.

import { isScadaSymbol } from './scada-logic';
import { parsePort, type SceneSettings, type SceneShapeSetting } from './scada-scene-logic';
import {
  appendCopies, arr, CAPS, finite, isFormKey, isLinkKind, isRec, round, refuse, elementsOf, type EditResult, type Rec, type Selection,
} from './scene-edit-core';
import { shapeBounds, type Pt } from './scene-edit-geometry';

export const ASSEMBLY_FORMAT = 'kui.scada.assembly';
export const ASSEMBLY_VERSION = 1;
/** Text longer than this is not read (about 200 symbols with every field set fits in a third of it). */
export const MAX_CLIPBOARD_CHARS = 300_000;

export interface Assembly {
  format: typeof ASSEMBLY_FORMAT;
  version: typeof ASSEMBLY_VERSION;
  name?: string;
  /** What x and y mean (the scene's anchor); an assembly only goes into a scene with the same one. */
  anchor: 'center' | 'corner';
  /** Symbols with their own local ids and positions relative to the middle of the piece. */
  elements: Rec[];
  shapes: Rec[];
  /** Connections between the local ids (`pump1.r`). */
  links: Rec[];
}

const INVALID = Symbol('invalid');
type Check = (v: unknown) => unknown;

const str = (max: number): Check => (v) => (typeof v === 'string' && v.length <= max ? v : INVALID);
const num = (lo: number, hi: number): Check => (v) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : INVALID);
const nullable = (c: Check): Check => (v) => (v === null ? null : c(v));
const bool: Check = (v) => (typeof v === 'boolean' ? v : INVALID);
const oneOf = (...values: Array<string | number>): Check => (v) => ((typeof v === 'string' || typeof v === 'number') && values.some((x) => String(x) === String(v)) && v !== '' ? v : INVALID);

/** The fields of a symbol an assembly carries (the template's own, plus the per-symbol colours, unit and decimals of version 3). */
const ELEMENT_FIELDS: Record<string, Check> = {
  id: (v) => (isFormKey(v) ? v : INVALID),
  symbol: (v) => (isScadaSymbol(v) ? v : INVALID),
  x: num(-1e5, 1e5), y: num(-1e5, 1e5),
  turn: oneOf(0, 90, 180, 270), mirror: bool, length: oneOf(1, 2, 3), scale: nullable(num(0.2, 4)),
  label: str(60), labelPos: oneOf('b', 't', 'n'), valuePos: oneOf('b', 'r'),
  medium: str(32), mediumColor: str(80), min: nullable(num(-1e9, 1e9)), max: nullable(num(-1e9, 1e9)), showValue: bool,
  fillColor: str(80), idleColor: str(80), runningColor: str(80), warningColor: str(80), criticalColor: str(80),
  unit: str(16), decimals: (v) => (v === '' || v === null ? v : num(0, 10)(v)),
};

const SHAPE_FIELDS: Record<string, Check> = {
  kind: oneOf('text', 'zone', 'divider'), x: num(-1e5, 1e5), y: num(-1e5, 1e5), w: num(0, 4000), h: num(0, 4000), text: str(80),
  size: oneOf('s', 'm', 'l'), align: oneOf('start', 'middle', 'end'), tone: oneOf('neutral', 'info', 'success', 'warning', 'error'), dashed: bool,
};

const LINK_FIELDS: Record<string, Check> = {
  from: (v) => (parsePort(v) ? v : INVALID),
  to: (v) => (parsePort(v) ? v : INVALID),
  kind: (v) => (isLinkKind(v) ? v : INVALID),
  id: (v) => (v === '' || isFormKey(v) ? v : INVALID),
  medium: str(32), mediumColor: str(80), mid: nullable(num(-1e5, 1e5)), arrows: bool,
};

/** Only the listed fields survive; a listed field with a wrong value fails the whole row. */
function pickFields(row: unknown, fields: Record<string, Check>, where: string): Rec | string {
  if (!isRec(row)) return `${where} is not an object`;
  const out: Rec = {};
  for (const [key, check] of Object.entries(fields)) {
    if (!Object.hasOwn(row, key)) continue;
    const v = check(row[key]);
    if (v === INVALID) return `${where}: "${key}" is not valid`;
    out[key] = v;
  }
  return out;
}

function cleanRows(raw: unknown, fields: Record<string, Check>, cap: number, what: string): Rec[] | string {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return `${what} must be a list`;
  if (raw.length > cap) return `Too many ${what} (at most ${cap})`;
  const out: Rec[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const row = pickFields(raw[i], fields, `${what} ${i + 1}`);
    if (typeof row === 'string') return row;
    out.push(row);
  }
  return out;
}

/** Checks an assembly (from storage or from text) and returns its clean copy, or the first problem found. */
export function cleanAssembly(raw: unknown): { ok: true; assembly: Assembly } | { ok: false; error: string } {
  if (!isRec(raw) || raw.format !== ASSEMBLY_FORMAT) return { ok: false, error: 'This is not a diagram piece' };
  if (raw.version !== ASSEMBLY_VERSION) return { ok: false, error: 'This diagram piece is from a version this editor does not read' };
  if (raw.anchor !== 'center' && raw.anchor !== 'corner') return { ok: false, error: 'The piece does not say what x and y mean' };
  if (raw.name !== undefined && (typeof raw.name !== 'string' || raw.name.length > 60)) return { ok: false, error: 'The name is at most 60 characters' };
  const elements = cleanRows(raw.elements, ELEMENT_FIELDS, CAPS.elements, 'symbols');
  if (typeof elements === 'string') return { ok: false, error: elements };
  const shapes = cleanRows(raw.shapes, SHAPE_FIELDS, CAPS.shapes, 'shapes');
  if (typeof shapes === 'string') return { ok: false, error: shapes };
  const links = cleanRows(raw.links, LINK_FIELDS, CAPS.links, 'connections');
  if (typeof links === 'string') return { ok: false, error: links };
  if (!elements.length && !shapes.length) return { ok: false, error: 'The piece is empty' };
  const ids = new Set<string>();
  for (const e of elements) {
    if (typeof e.id !== 'string' || !isScadaSymbol(e.symbol)) return { ok: false, error: 'Every symbol needs an id and a symbol' };
    if (ids.has(e.id)) return { ok: false, error: `The id ${e.id} is used twice` };
    ids.add(e.id);
    e.x = finite(e.x, 0); e.y = finite(e.y, 0);
  }
  for (const h of shapes) { h.x = finite(h.x, 0); h.y = finite(h.y, 0); if (h.kind === undefined) return { ok: false, error: 'Every shape needs a kind' }; }
  for (const l of links) {
    const a = parsePort(l.from); const b = parsePort(l.to);
    if (!a || !b) return { ok: false, error: 'Every connection needs two ends' };
    if (!ids.has(a.id) || !ids.has(b.id)) return { ok: false, error: 'A connection ends on a symbol that is not in the piece' };
  }
  const assembly: Assembly = {
    format: ASSEMBLY_FORMAT, version: ASSEMBLY_VERSION, ...(typeof raw.name === 'string' && raw.name ? { name: raw.name } : {}),
    anchor: raw.anchor, elements, shapes, links,
  };
  return { ok: true, assembly };
}

/**
 * Captures a selection as an assembly: its symbols and shapes, and the connections with both ends among those symbols.
 * Positions are relative to the middle of the piece. Null when the selection holds nothing.
 */
export function captureAssembly(s: SceneSettings, sel: readonly string[] | Selection, o: { name?: string } = {}): Assembly | null {
  const pickIds = new Set(Array.isArray(sel) ? (sel as readonly string[]) : (sel as Selection).elements ?? []);
  const pickShapes = new Set(Array.isArray(sel) ? [] : (sel as Selection).shapes ?? []);
  const elements = elementsOf(s).filter((e): e is Rec => isRec(e) && typeof e.id === 'string' && pickIds.has(e.id));
  const shapes = arr(s.shapes).filter((h, i): h is Rec => isRec(h) && pickShapes.has(i));
  if (!elements.length && !shapes.length) return null;
  const chosen = new Set(elements.map((e) => e.id as string));
  const links = arr(s.links).filter((l): l is Rec => isRec(l) && [l.from, l.to].every((ref) => { const p = parsePort(ref); return !!p && chosen.has(p.id); }));

  // The middle of the piece: of its anchor points (and the far corners of zones and dividers).
  const xs: number[] = []; const ys: number[] = [];
  for (const e of elements) { xs.push(finite(e.x, 0)); ys.push(finite(e.y, 0)); }
  for (const h of shapes) {
    xs.push(finite(h.x, 0)); ys.push(finite(h.y, 0));
    const b = shapeBounds(h as SceneShapeSetting);
    if (b && h.kind !== 'text') { xs.push(b.x + b.w); ys.push(b.y + b.h); }
  }
  const mid: Pt = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const move = (r: Rec): Rec => ({ ...r, x: round(finite(r.x, 0) - mid.x), y: round(finite(r.y, 0) - mid.y) });
  const checked = cleanAssembly({
    format: ASSEMBLY_FORMAT, version: ASSEMBLY_VERSION, ...(o.name ? { name: o.name.slice(0, 60) } : {}), anchor: s.anchor === 'corner' ? 'corner' : 'center',
    elements: elements.map(move), shapes: shapes.map(move), links,
  });
  return checked.ok ? checked.assembly : null;
}

/** Inserts an assembly with its middle at `at`: fresh ids where its own are taken, connections follow, caps hold. */
export function insertAssembly(s: SceneSettings, assembly: unknown, at: Pt): EditResult {
  const checked = cleanAssembly(assembly);
  if (!checked.ok) return refuse(s, checked.error);
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return refuse(s, 'The position is not a number');
  const a = checked.assembly;
  if (a.anchor !== (s.anchor === 'corner' ? 'corner' : 'center')) return refuse(s, 'The piece was drawn with another meaning of x and y');
  return appendCopies(s, { elements: a.elements, shapes: a.shapes, links: a.links }, { dx: at.x, dy: at.y, keepIds: true });
}

/** An assembly as text for the clipboard or a file. */
export function serialize(a: Assembly): string {
  const checked = cleanAssembly(a);
  if (!checked.ok) throw new RangeError(checked.error);
  return JSON.stringify(checked.assembly);
}

/** Reads text from the clipboard: an assembly, or why it is not one. Text is never run. */
export function parseClipboard(text: unknown): { ok: true; assembly: Assembly } | { ok: false; error: string } {
  if (typeof text !== 'string') return { ok: false, error: 'There is no text to read' };
  if (text.length > MAX_CLIPBOARD_CHARS) return { ok: false, error: 'The text is too long to be a diagram piece' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'This is not a diagram piece' }; }
  return cleanAssembly(raw);
}
