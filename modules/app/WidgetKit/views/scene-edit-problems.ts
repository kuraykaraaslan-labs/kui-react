// The problems list of the diagram editor (pure, no React): what is wrong or close to wrong in a scene, found without
// drawing it. The host can add checks of its own (the rules' checks, for one) through `extra`.

import type { SlotData } from '../kind';
import { isScadaSymbol } from './scada-logic';
import { parsePort, rowsById, type SceneSettings, type SceneShapeSetting } from './scada-scene-logic';
import { arr, CAPS, elementsOf, finite, isFormKey, isRec } from './scene-edit-core';

export type ProblemSeverity = 'error' | 'warning' | 'info';

export interface Problem {
  severity: ProblemSeverity;
  /** A stable code: `duplicate-id`, `invalid-id`, `unknown-symbol`, `dangling-link`, `unbound-symbol`, `off-canvas`, `near-cap`, `over-cap`, `zero-size-zone`, `empty-title`, `thing-id-taken`. */
  code: string;
  /** What it is about: a symbol id, `link:<index>`, `shape:<index>`, or `scene`. */
  id: string;
  message: string;
}

/** A check the host adds: scene settings and the bound data in, problems out. */
export type ProblemCheck = (settings: SceneSettings, data: Record<string, SlotData | undefined>) => Problem[];

/** A list at this share of its cap gets a warning. */
export const NEAR_CAP = 0.9;

const RANK: Record<ProblemSeverity, number> = { error: 0, warning: 1, info: 2 };

export function problems(
  s: SceneSettings, data: Record<string, SlotData | undefined> = {}, o: { extra?: ProblemCheck | readonly ProblemCheck[] } = {},
): Problem[] {
  const out: Problem[] = [];
  const add = (severity: ProblemSeverity, code: string, id: string, message: string) => out.push({ severity, code, id, message });
  const width = Math.min(4000, Math.max(200, finite(s.width, 1200)));
  const height = Math.min(4000, Math.max(200, finite(s.height, 700)));

  const seen = new Set<string>();
  const known = new Set<string>();
  const elements = elementsOf(s);
  for (const e of elements) {
    if (!isRec(e)) continue;
    const id = typeof e.id === 'string' ? e.id : '';
    if (!isFormKey(id)) add('error', 'invalid-id', id || 'scene', 'A symbol has no usable id (a letter or _ first, then letters, digits, . _ -)');
    else if (seen.has(id)) add('error', 'duplicate-id', id, `More than one symbol has the id ${id}`);
    else { seen.add(id); known.add(id); }
    if (!isScadaSymbol(e.symbol)) add('error', 'unknown-symbol', id || 'scene', `${id || 'A symbol'} uses a symbol the library does not have`);
    const x = finite(e.x, 0); const y = finite(e.y, 0);
    if (x < 0 || y < 0 || x > width || y > height) add('warning', 'off-canvas', id || 'scene', `${id || 'A symbol'} is outside the canvas`);
  }

  // With a things table, a connection may end on a thing by its id: one the table has now is fine, one it lacks only
  // draws while a thing has it (a warning). Without one, an end that names no symbol is an error, as it always was.
  const things = data.things ? rowsById(data.things, typeof s.thingsIdColumn === 'string' && s.thingsIdColumn ? s.thingsIdColumn : 'id') : null;
  arr(s.links).forEach((l, i) => {
    if (!isRec(l)) return;
    const ends = [l.from, l.to].map((ref) => parsePort(ref));
    const missing = ends.filter((p) => p && !known.has(p.id) && !things?.has(p.id));
    if (ends.some((p) => !p) || (missing.length && !things)) add('error', 'dangling-link', `link:${i}`, `Connection ${i + 1} ends on a symbol that is not on the canvas`);
    else if (missing.length) add('warning', 'dangling-link', `link:${i}`, `Connection ${i + 1} ends on ${missing[0]!.id}, which no symbol or thing from data has now`);
  });

  arr(s.shapes).forEach((h, i) => {
    if (!isRec(h)) return;
    const shape = h as SceneShapeSetting;
    const id = `shape:${i}`;
    if (shape.kind === 'zone') {
      if ((typeof shape.w === 'number' && shape.w <= 0) || (typeof shape.h === 'number' && shape.h <= 0)) add('warning', 'zero-size-zone', id, 'A zone has no width or no height');
    } else if (shape.kind === 'text' && !(typeof shape.text === 'string' && shape.text)) add('warning', 'empty-title', id, 'A title has no words');
    const x = finite(shape.x, 0); const y = finite(shape.y, 0);
    if (x < 0 || y < 0 || x > width || y > height) add('warning', 'off-canvas', id, 'A shape starts outside the canvas');
  });

  // A thing whose id a symbol has is never drawn (the symbol keeps its id).
  if (things) for (const id of known) if (things.has(id)) add('warning', 'thing-id-taken', id, `A thing from data has the id ${id}, which this symbol has: the thing is not drawn`);

  // A table that is bound but has no row for a symbol: the symbol never moves. With nothing bound there is nothing to compare.
  if (data.points) {
    const rows = rowsById(data.points, s.idColumn || 'id');
    for (const id of known) if (!rows.has(id)) add('warning', 'unbound-symbol', id, `${id} has no row in the bound table`);
  }

  for (const [key, cap, count] of [['symbols', CAPS.elements, elements.length], ['connections', CAPS.links, arr(s.links).length], ['shapes', CAPS.shapes, arr(s.shapes).length]] as const) {
    if (count > cap) add('error', 'over-cap', 'scene', `There are more ${key} (${count}) than a diagram holds (${cap})`);
    else if (count >= cap * NEAR_CAP) add('warning', 'near-cap', 'scene', `${count} of ${cap} ${key} are used`);
  }

  const extra = o.extra === undefined ? [] : Array.isArray(o.extra) ? o.extra : [o.extra as ProblemCheck];
  for (const check of extra as readonly ProblemCheck[]) {
    try { out.push(...check(s, data)); } catch { add('warning', 'check-failed', 'scene', 'A check could not run'); }
  }
  return out.map((p, i) => ({ p, i })).sort((a, b) => RANK[a.p.severity] - RANK[b.p.severity] || a.i - b.i).map((e) => e.p);
}
