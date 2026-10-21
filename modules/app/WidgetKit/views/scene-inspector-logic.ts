// The inspector's pure parts (no React): what a selection is, which fields it shows, how a change to a field becomes one
// edit of the scene model, and what several selected things share. The fields are the scene template's own definitions
// (elements, connections, shapes and the scene's top-level ones), so a field added to the template shows up in the
// inspector without a change here; only the grouping and a few "only when it matters" rules are written down below.

import { SCADA_SCENE } from '../templates/scada-scene';
import { cssColor } from '../settings/style';
import type { FieldSchema } from '../../SchemaForm/types';
import { SCADA_SYMBOL_DEFS, isScadaSymbol, type SymbolDef } from './scada-logic';
import type { SceneModel, SceneSettings } from './scada-scene-logic';
import {
  arr, elementsOf, isRec, noop, patched, refuse, reconnectLink, resizeShape, setCanvas, setElementProps, setLinkProps, setShapeProps,
  type CanvasPatch, type EditResult, type Rec, type Selection,
} from './scene-edit-logic';

// ─── What is selected ────────────────────────────────────────────────────────

export type InspectorTarget =
  | { kind: 'scene' }
  | { kind: 'elements'; ids: string[] }
  | { kind: 'links'; indices: number[] }
  | { kind: 'shapes'; indices: number[] }
  | { kind: 'mixed'; elements: number; links: number; shapes: number };

/** What the inspector edits for a selection: ids and indices that are not in the scene are dropped; nothing left = the scene. */
export function inspectorTarget(sel: Selection, s: SceneSettings): InspectorTarget {
  const have = new Set(elementsOf(s).filter(isRec).map((e) => e.id).filter((id): id is string => typeof id === 'string'));
  const elements = [...new Set(sel.elements ?? [])].filter((id) => have.has(id));
  const links = [...new Set(sel.links ?? [])].filter((i) => isRec(arr(s.links)[i]));
  const shapes = [...new Set(sel.shapes ?? [])].filter((i) => isRec(arr(s.shapes)[i]));
  const kinds = [elements.length, links.length, shapes.length].filter((n) => n > 0).length;
  if (kinds === 0) return { kind: 'scene' };
  if (kinds > 1) return { kind: 'mixed', elements: elements.length, links: links.length, shapes: shapes.length };
  if (elements.length) return { kind: 'elements', ids: elements };
  if (links.length) return { kind: 'links', indices: links };
  return { kind: 'shapes', indices: shapes };
}

export const elementRow = (s: SceneSettings, id: string): Rec | undefined => elementsOf(s).find((e): e is Rec => isRec(e) && e.id === id);

// ─── Fields ──────────────────────────────────────────────────────────────────

export type FieldScope = 'element' | 'link' | 'shape' | 'scene';
export interface FieldEntry { key: string; field: FieldSchema; group: string }

/** Which group of the panel each field sits in; a key not listed lands in "more" (a field added to the template later). */
const GROUPS: Record<FieldScope, Record<string, string>> = {
  element: {
    id: 'symbol', symbol: 'symbol', x: 'placement', y: 'placement', turn: 'placement', mirror: 'placement', length: 'placement', scale: 'placement',
    label: 'label', labelPos: 'label', valuePos: 'label', showValue: 'label', min: 'data', max: 'data', unit: 'data', decimals: 'data',
    medium: 'medium', mediumColor: 'medium',
    fillColor: 'colours', idleColor: 'colours', runningColor: 'colours', warningColor: 'colours', criticalColor: 'colours',
  },
  link: { from: 'connection', to: 'connection', kind: 'connection', id: 'connection', medium: 'medium', mediumColor: 'medium', mid: 'route', arrows: 'route' },
  shape: { kind: 'words', text: 'words', x: 'placement', y: 'placement', w: 'placement', h: 'placement', size: 'look', align: 'look', tone: 'look', dashed: 'look' },
  scene: {
    width: 'canvas', height: 'canvas', scale: 'canvas', anchor: 'canvas', background: 'look', fit: 'look', showLabels: 'look', calm: 'look', animation: 'look',
    idleColor: 'colours', runningColor: 'colours', warningColor: 'colours', criticalColor: 'colours', idColumn: 'source',
  },
};

/** The keys a scope never shows as a plain field (the panel draws them itself, or they are lists with their own editors). */
const HIDDEN: Record<FieldScope, readonly string[]> = { element: [], link: [], shape: ['kind'], scene: [] };

const REPEATERS = new Set(['elements', 'links', 'shapes', 'rules']);

/** The template's fields of a scope, in template order, each with its group. Lists of rows (`elements`, `rules` ...) are not fields here. */
export function fieldsOf(scope: FieldScope, template = SCADA_SCENE): FieldEntry[] {
  const defs: Record<string, FieldSchema> = scope === 'scene'
    ? Object.fromEntries(Object.entries(template.fields).filter(([k, f]) => !REPEATERS.has(k) && f.type !== 'repeater'))
    : (template.fields[scope === 'element' ? 'elements' : scope === 'link' ? 'links' : 'shapes']?.fields ?? {});
  return Object.entries(defs)
    .filter(([k]) => !HIDDEN[scope].includes(k))
    .map(([key, field]) => ({ key, field, group: GROUPS[scope][key] ?? 'more' }));
}

const def = (row: Rec | undefined): SymbolDef | undefined => (row && isScadaSymbol(row.symbol) ? (SCADA_SYMBOL_DEFS[row.symbol] as SymbolDef) : undefined);

/**
 * Whether a field shows for these rows (one for a single selection, several for a multi-selection: it shows when any
 * of them needs it). The extra rules mirror the symbol widget's: a minimum and maximum only for a symbol with a scale,
 * the number's place and "show the number" only for one that prints a number, a length only for a straight run, the
 * medium colour only for "a colour of my own"; a shape shows the fields its kind uses.
 */
export function fieldVisible(scope: FieldScope, key: string, rows: readonly Rec[]): boolean {
  const any = (test: (r: Rec) => boolean) => rows.length === 0 || rows.some(test);
  if (scope === 'element') {
    if (key === 'min' || key === 'max') return any((r) => def(r)?.scaled === true || def(r) === undefined);
    if (key === 'valuePos' || key === 'showValue') return any((r) => def(r)?.valueUnder === true || def(r) === undefined);
    if (key === 'length') return any((r) => def(r)?.runs === true || def(r) === undefined);
    if (key === 'mediumColor') return any((r) => r.medium === 'custom');
  }
  if (scope === 'link' && key === 'mediumColor') return any((r) => r.medium === 'custom');
  if (scope === 'shape') {
    const kind = (r: Rec) => (typeof r.kind === 'string' ? r.kind : 'text');
    if (key === 'w' || key === 'h') return any((r) => kind(r) !== 'text');
    if (key === 'dashed') return any((r) => kind(r) !== 'text');
    if (key === 'size' || key === 'align') return any((r) => kind(r) === 'text');
  }
  return true;
}

/**
 * What several rows share: a key's value when they all have the same, and the keys where they differ. A row without the
 * key counts as having the field's default (`defaults`), so "not set" and "set to the default" are not a difference.
 */
export function sharedValues(rows: readonly Rec[], keys: readonly string[], defaults: Rec = {}): { values: Rec; differs: Set<string> } {
  const values: Rec = {};
  const differs = new Set<string>();
  if (!rows.length) return { values, differs };
  for (const k of keys) {
    const at = (r: Rec) => r[k] ?? defaults[k];
    const first = at(rows[0]);
    if (rows.every((r) => JSON.stringify(at(r)) === JSON.stringify(first))) { if (rows[0][k] !== undefined) values[k] = rows[0][k]; } else differs.add(k);
  }
  return { values, differs };
}

/**
 * What a field's input value is stored as. An empty text, choice or colour removes the field; an empty number removes it
 * when it may be empty (`nullable`) and goes back to the default when it may not.
 */
export function storedValue(field: FieldSchema, value: unknown): unknown {
  if (field.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) return field.nullable || field.value === undefined ? undefined : field.value;
    return value;
  }
  if (value === '' || value === null) return field.type === 'boolean' ? false : undefined;
  return value;
}

/** Why a value is not a colour (a text typed into a colour field), or null. Empty is fine: it means the default. */
export const colourProblem = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '' && !cssColor(v);

// ─── Edits ───────────────────────────────────────────────────────────────────

/** Runs edits one after the other on the result of the one before; any refusal refuses the whole change and leaves the scene as it was. */
export function chain(s: SceneSettings, steps: ReadonlyArray<(cur: SceneSettings) => EditResult>): EditResult {
  let cur = s;
  for (const step of steps) {
    const r = step(cur);
    if (r.refused) return refuse(s, r.refused);
    cur = r.settings;
  }
  return cur === s ? noop(s) : { settings: cur };
}

/** A change to symbols' fields (never `id`: that is `renameElement`). */
export const elementOp = (ids: readonly string[], patch: Rec) => (s: SceneSettings): EditResult => setElementProps(s, ids, patch);

const LINK_ENDS = ['from', 'to'] as const;

/** A change to connections' fields: an end moves with `reconnectLink`, everything else with `setLinkProps`. */
export const linkOp = (indices: readonly number[], patch: Rec) => (s: SceneSettings): EditResult => {
  const rest: Rec = {};
  const ends: Array<[(typeof LINK_ENDS)[number], string]> = [];
  for (const [k, v] of Object.entries(patch)) {
    if ((LINK_ENDS as readonly string[]).includes(k)) ends.push([k as (typeof LINK_ENDS)[number], typeof v === 'string' ? v : '']);
    else rest[k] = v;
  }
  return chain(s, indices.flatMap((i) => [
    ...ends.map(([end, port]) => (cur: SceneSettings) => reconnectLink(cur, i, end, port)),
    ...(Object.keys(rest).length ? [(cur: SceneSettings) => setLinkProps(cur, i, rest)] : []),
  ]));
};

/** A change to shapes' fields: the size through `resizeShape` (which keeps a zone and a divider usable), the rest through `setShapeProps`. */
export const shapeOp = (indices: readonly number[], patch: Rec) => (s: SceneSettings): EditResult => {
  const size: { w?: number; h?: number } = {};
  const rest: Rec = {};
  for (const [k, v] of Object.entries(patch)) {
    if ((k === 'w' || k === 'h') && typeof v === 'number') size[k] = v;
    else rest[k] = v;
  }
  return chain(s, indices.flatMap((i) => [
    ...(Object.keys(rest).length ? [(cur: SceneSettings) => setShapeProps(cur, i, rest)] : []),
    ...(Object.keys(size).length ? [(cur: SceneSettings) => resizeShape(cur, i, size)] : []),
  ]));
};

const CANVAS_KEYS = new Set(['width', 'height', 'scale', 'anchor']);

/** Why a value cannot be written to one of the scene's own fields, by the template's definition; null if it can. */
function sceneFieldProblem(key: string, v: unknown): string | null {
  const f = SCADA_SCENE.fields[key];
  if (!f || f.type === 'repeater') return `"${key}" is not a diagram setting`;
  if (v === undefined) return null;
  switch (f.type) {
    case 'boolean': return typeof v === 'boolean' ? null : `${f.label} is on or off`;
    case 'number': return typeof v === 'number' && Number.isFinite(v) && (f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max) ? null : `${f.label} must be a number${f.min !== undefined && f.max !== undefined ? ` from ${f.min} to ${f.max}` : ''}`;
    case 'select': return typeof v === 'string' && (f.options ?? []).some((o) => (typeof o === 'string' ? o : o.value) === v) ? null : `${f.label}: choose one of the listed values`;
    case 'color': return typeof v === 'string' && cssColor(v) ? null : `${f.label} is not a colour`;
    default: return typeof v === 'string' && v.length <= (f.maxLength ?? 128) ? null : `${f.label} is too long`;
  }
}

/**
 * A change to the scene's own fields. The size, symbol size and anchor go through `setCanvas` (the anchor with `model`,
 * so a change of what x and y mean moves nothing on the picture); the rest is checked against the template's definition.
 */
export const sceneOp = (patch: Rec, model?: Pick<SceneModel, 'hits'>) => (s: SceneSettings): EditResult => {
  const canvas: CanvasPatch = {};
  const rest: Rec = {};
  for (const [k, v] of Object.entries(patch)) {
    if (CANVAS_KEYS.has(k)) {
      if (v === undefined) return refuse(s, `${SCADA_SCENE.fields[k]?.label ?? k} cannot be empty`);
      (canvas as Rec)[k] = v;
    } else {
      const why = sceneFieldProblem(k, v);
      if (why) return refuse(s, why);
      rest[k] = v;
    }
  }
  return chain(s, [
    ...(Object.keys(canvas).length ? [(cur: SceneSettings) => setCanvas(cur, canvas, model)] : []),
    ...(Object.keys(rest).length ? [(cur: SceneSettings): EditResult => {
      const next = patched(cur as Rec, rest) as SceneSettings;
      return next === cur ? noop(cur) : { settings: next };
    }] : []),
  ]);
};
