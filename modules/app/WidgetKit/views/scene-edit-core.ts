// Shared pieces of the diagram editor's pure model (no React): the result of an edit, ids, port strings and the scene's
// caps. Every edit is a function from scene settings to scene settings that never changes its input; an edit that
// would break a cap or a rule returns the input itself plus a `refused` reason.

import { isFormKey } from './control-form-logic';
import type { Pt } from './scene-edit-geometry';
import { MAX_SCENE_ELEMENTS, MAX_SCENE_LINKS, MAX_SCENE_SHAPES, parsePort, type SceneSettings, type SceneSide } from './scada-scene-logic';
import { r2 } from './svg-node';

export type Rec = Record<string, unknown>;

/**
 * What an edit returns. `settings` is the input itself when nothing changed (a no-op or a refusal), so a caller can
 * compare by reference. The other fields name what an edit created: `id` and `ids` symbols, `index` and `indices`
 * shapes or connections (see each edit), `shapes` and `links` the copies a duplicate or an insert made.
 */
export interface EditResult {
  settings: SceneSettings;
  refused?: string;
  id?: string;
  ids?: string[];
  index?: number;
  shapes?: number[];
  links?: number[];
}

/** A scene with the editor's view of `rules` (the rules agent owns their layout; the editor only reads `target`, `of` and `of2`). */
export type EditSettings = SceneSettings & { rules?: unknown };

/** What an edit works on: symbols by id, shapes and connections by their index in the stored list. */
export interface Selection {
  elements?: readonly string[];
  shapes?: readonly number[];
  links?: readonly number[];
}

export const CAPS = { elements: MAX_SCENE_ELEMENTS, links: MAX_SCENE_LINKS, shapes: MAX_SCENE_SHAPES } as const;

/** The connection kinds the scene draws (the template's own list). */
export const SCENE_LINK_KINDS = ['pipe', 'hose', 'cable', 'wire', 'strip', 'line', 'sld'] as const;
export const isLinkKind = (v: unknown): v is (typeof SCENE_LINK_KINDS)[number] => typeof v === 'string' && (SCENE_LINK_KINDS as readonly string[]).includes(v);

/** A key an edit never writes into a record: it names a prototype member. */
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
export const isSafeKey = (k: string): boolean => /^[A-Za-z][A-Za-z0-9]*$/.test(k) && !UNSAFE.has(k);

export const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
/** One shared empty list (never written to), so "nothing there" compares equal to itself by reference. */
const NONE: unknown[] = Object.freeze([]) as unknown as unknown[];
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : NONE);
export const finite = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const round = r2;

export const refuse = (settings: SceneSettings, why: string): EditResult => ({ settings, refused: why });
export const noop = (settings: SceneSettings): EditResult => ({ settings });

export const sceneRules = (s: SceneSettings): unknown[] => arr((s as EditSettings).rules);

/** The symbols as stored (a stray non-object entry is kept in place and ignored by readers). */
export const elementsOf = (s: SceneSettings): unknown[] => arr(s.elements);

/** Every name a rule can target: symbol ids and the ids connections carry. */
export const targetNames = (s: SceneSettings): Set<string> => new Set([...elementIds(s), ...linkIds(s)]);

/**
 * `next` without the rules that name something `before` had and `next` no longer has (a deleted symbol, a deleted
 * connection, a connection id that went away). Names that were already unknown before are left alone.
 */
export function pruneRules(before: SceneSettings, next: SceneSettings): SceneSettings {
  const rules = sceneRules(next);
  if (!rules.length) return next;
  const was = targetNames(before); const now = targetNames(next);
  const gone = (v: unknown) => typeof v === 'string' && was.has(v) && !now.has(v);
  const keep = rules.filter((r) => !(isRec(r) && [r.target, r.of, r.of2].some(gone)));
  return keep.length === rules.length ? next : ({ ...next, rules: keep } as SceneSettings);
}

export function elementIds(s: SceneSettings): Set<string> {
  const ids = new Set<string>();
  for (const e of elementsOf(s)) if (isRec(e) && typeof e.id === 'string') ids.add(e.id);
  return ids;
}

/** The ids the connections name in their optional `id` (the row that tints them): rules may target these too. */
export function linkIds(s: SceneSettings): Set<string> {
  const ids = new Set<string>();
  for (const l of arr(s.links)) if (isRec(l) && typeof l.id === 'string' && l.id) ids.add(l.id);
  return ids;
}

const PACKS = new Set(['process', 'isa', 'hvac', 'sld', 'energy', 'telecom', 'food', 'agri', 'wastewater', 'oilgas', 'factory', 'mining', 'city']);

/** `pump.volute` -> `pump`, `isa.controller.flow` -> `controller`: the word a new symbol's id starts with. */
export function shortName(symbol: string): string {
  const parts = symbol.split('.');
  if (parts.length > 1 && PACKS.has(parts[0])) parts.shift();
  const word = (parts[0] ?? '').replace(/[^A-Za-z0-9_]/g, '');
  const base = /^[A-Za-z_]/.test(word) ? word : `s${word}`;
  return base.slice(0, 40) || 'item';
}

/** `pump` + the first number that no id in `taken` uses (`pump1`, `pump2`). */
export function freeId(base: string, taken: ReadonlySet<string>): string {
  const stem = base.slice(0, 56) || 'item';
  for (let n = 1; ; n += 1) {
    const id = `${stem}${n}`;
    if (!taken.has(id)) return id;
  }
}

/** The id after `id` that nothing uses: `pump7` -> `pump8` (or the next free number), `flt` -> `flt1`. */
export function nextAfter(id: string, taken: ReadonlySet<string>): string {
  const m = /^(.*?)(\d{1,6})$/.exec(id);
  const stem = (m && m[1] ? m[1] : id).slice(0, 56) || 'item';
  for (let n = m && m[1] ? Number(m[2]) + 1 : 1; ; n += 1) {
    const next = `${stem}${n}`;
    if (!taken.has(next)) return next;
  }
}

const fraction = (at: number): string => String(Math.round(Math.min(1, Math.max(0, at)) * 1000) / 1000);

/** `pump1.r`, or `pump1.t:0.26` when the port is not in the middle of its edge. */
export function formatPort(p: { id: string; side: SceneSide; at?: number }): string {
  const at = p.at ?? 0.5;
  return `${p.id}.${p.side}${Math.abs(at - 0.5) < 1e-9 ? '' : `:${fraction(at)}`}`;
}

/** The same port string with another symbol id, everything else (separator, spaces, fraction) as written. */
export function replacePortId(ref: unknown, from: string, to: string): unknown {
  const port = parsePort(ref);
  if (!port || port.id !== from || typeof ref !== 'string') return ref;
  const lead = ref.length - ref.trimStart().length;
  return ref.slice(0, lead) + to + ref.slice(lead + from.length);
}

/** Applies a patch to a record: `undefined` removes a key. Returns the record itself when nothing changed. */
export function patched(rec: Rec, patch: Rec): Rec {
  let out: Rec | null = null;
  for (const [k, v] of Object.entries(patch)) {
    const cur = out ?? rec;
    if (v === undefined) {
      if (!Object.hasOwn(cur, k)) continue;
      out ??= { ...rec };
      delete out[k];
    } else if (!Object.hasOwn(cur, k) || cur[k] !== v) {
      out ??= { ...rec };
      out[k] = v;
    }
  }
  return out ?? rec;
}

/** `list` with the entries `fn` returns a different object for replaced; the same array when none changed. */
export function mapList(list: unknown[], fn: (item: unknown, i: number) => unknown): unknown[] {
  let out: unknown[] | null = null;
  list.forEach((item, i) => {
    const next = fn(item, i);
    if (next !== item) { out ??= list.slice(); out[i] = next; }
  });
  return out ?? list;
}

/** A refusal for a list that would pass its cap, or null. */
export function capRefusal(s: SceneSettings, add: { elements?: number; links?: number; shapes?: number }): string | null {
  if (arr(s.elements).length + (add.elements ?? 0) > CAPS.elements) return `A diagram holds at most ${CAPS.elements} symbols`;
  if (arr(s.links).length + (add.links ?? 0) > CAPS.links) return `A diagram holds at most ${CAPS.links} connections`;
  if (arr(s.shapes).length + (add.shapes ?? 0) > CAPS.shapes) return `A diagram holds at most ${CAPS.shapes} titles, zones and dividers`;
  return null;
}

/**
 * Appends copies of symbols, shapes and the connections among them, shifted by (`dx`, `dy`). Symbol ids are kept when
 * free and `keepIds` is set (an inserted assembly), otherwise numbered from their stem; connection ends follow.
 */
export function appendCopies(
  s: SceneSettings, parts: { elements: Rec[]; shapes: Rec[]; links: Rec[] }, o: { dx: number; dy: number; keepIds: boolean },
): EditResult {
  const refusal = capRefusal(s, { elements: parts.elements.length, links: parts.links.length, shapes: parts.shapes.length });
  if (refusal) return refuse(s, refusal);
  const taken = elementIds(s);
  const rename = new Map<string, string>();
  const elements = parts.elements.map((e) => {
    const old = String(e.id);
    const id = o.keepIds && !taken.has(old) ? old : nextAfter(old, taken);
    taken.add(id);
    rename.set(old, id);
    return { ...e, id, x: round(finite(e.x, 0) + o.dx), y: round(finite(e.y, 0) + o.dy) };
  });
  const shapes = parts.shapes.map((h) => ({ ...h, x: round(finite(h.x, 0) + o.dx), y: round(finite(h.y, 0) + o.dy) }));
  const links = parts.links.map((l) => {
    let out: Rec = l;
    for (const end of ['from', 'to'] as const) {
      const port = parsePort(l[end]);
      const to = port && rename.get(port.id);
      if (port && to && typeof l[end] === 'string') out = { ...out, [end]: replacePortId(l[end], port.id, to) };
    }
    return out === l ? { ...l } : out;
  });
  const baseShapes = arr(s.shapes).length;
  const baseLinks = arr(s.links).length;
  const next: SceneSettings = { ...s };
  if (elements.length) next.elements = [...elementsOf(s), ...elements];
  if (shapes.length) next.shapes = [...arr(s.shapes), ...shapes];
  if (links.length) next.links = [...arr(s.links), ...links];
  return {
    settings: next,
    ids: elements.map((e) => e.id),
    shapes: shapes.map((_, i) => baseShapes + i),
    links: links.map((_, i) => baseLinks + i),
  };
}

export { isFormKey };
export type { Pt };
