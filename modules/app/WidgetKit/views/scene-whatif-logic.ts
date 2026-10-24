// The what-if overrides (pure, no React): values laid over the bound table's rows and the board's parameters while the
// editor is open, to preview every rule. Nothing here is stored or written back; `WhatIfState` lives in the editor's
// memory only. Every function returns a new state and never changes its input.

import type { SceneSettings } from './scada-scene-logic';
import type { WhatIfState } from './scene-editor-types';

type Row = Record<string, unknown>;

/** The columns the panel overrides. */
export const WHATIF_COLUMNS = ['value', 'value2', 'capacity', 'running', 'status'] as const;
export type WhatIfColumn = (typeof WHATIF_COLUMNS)[number];

export const emptyWhatIf = (): WhatIfState => ({ rows: {}, params: {} });

/** A name that can be a key of the state without touching a prototype member. */
const safe = (name: string): boolean => name !== '' && name.length <= 128 && !['__proto__', 'constructor', 'prototype'].includes(name);

/** How many values are overridden (rows' cells and parameters), each sample thing counting as one. */
export function overrideCount(state: WhatIfState): number {
  return Object.values(state.rows).reduce((n, r) => n + Object.keys(r).length, 0) + Object.keys(state.params).length + (state.things?.length ?? 0);
}

export const isEmptyWhatIf = (state: WhatIfState): boolean => overrideCount(state) === 0;

/** Overrides `column` of every row in `ids` with `value` (`undefined` puts the real value back). A row left with nothing goes. */
export function setOverride(state: WhatIfState, ids: readonly string[], column: string, value: unknown): WhatIfState {
  if (!safe(column)) return state;
  const rows: Record<string, Row> = { ...state.rows };
  for (const id of ids) {
    if (!safe(id)) continue;
    const row: Row = { ...(rows[id] ?? {}) };
    if (value === undefined) delete row[column]; else row[column] = value;
    if (Object.keys(row).length) rows[id] = row; else delete rows[id];
  }
  return { ...state, rows };
}

/** Whether `ids` all share one override of a column (`same`), have different ones or only some have one (`mixed`), or none has (`none`). */
export function readOverride(state: WhatIfState, ids: readonly string[], column: string): { kind: 'none' | 'same' | 'mixed'; value?: unknown } {
  if (!ids.length) return { kind: 'none' };
  const have = ids.map((id) => (state.rows[id] && Object.hasOwn(state.rows[id], column) ? { v: state.rows[id][column] } : null));
  if (have.every((h) => h === null)) return { kind: 'none' };
  const first = have[0];
  if (first && have.every((h) => h && h.v === first.v)) return { kind: 'same', value: first.v };
  return { kind: 'mixed' };
}

/** Overrides a board parameter (`undefined` puts the real one back). */
export function setParamOverride(state: WhatIfState, key: string, value: unknown): WhatIfState {
  if (!safe(key)) return state;
  const params = { ...state.params };
  if (value === undefined || value === '') delete params[key]; else params[key] = value;
  return { ...state, params };
}

/** The rows with the overrides laid over them (a row the table lacks is made). The real rows are not changed. */
export function overlayRows(rows: ReadonlyMap<string, Row>, state: WhatIfState): Map<string, Row> {
  const out = new Map<string, Row>();
  for (const [id, row] of rows) out.set(id, row);
  for (const [id, over] of Object.entries(state.rows)) out.set(id, { ...(out.get(id) ?? {}), ...over });
  return out;
}

/** The board parameters with the overrides laid over them. */
export const overlayParams = (params: Record<string, unknown>, state: WhatIfState): Record<string, unknown> => ({ ...params, ...state.params });

// ── Sample things ────────────────────────────────────────────────────────────

/** At most this many sample things: enough to preview a rule, never a data set. */
export const MAX_SAMPLE_THINGS = 20;

/** The things table's columns as the scene reads them (the template's defaults when a setting is empty). */
export function thingColumns(s: SceneSettings): { id: string; symbol: string; x: string; y: string } {
  const col = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);
  return { id: col(s.thingsIdColumn, 'id'), symbol: col(s.thingsSymbolColumn, 'symbol'), x: col(s.thingsXColumn, 'x'), y: col(s.thingsYColumn, 'y') };
}

/** The sample things of a state (none = an empty list). */
export const sampleThings = (state: WhatIfState): Array<Record<string, unknown>> => state.things ?? [];

/** The id of a sample row under the scene's id column ('' when it has none). */
export const sampleId = (s: SceneSettings, row: Record<string, unknown>): string => {
  const v = row[thingColumns(s).id];
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
};

/**
 * Adds a sample thing at a point of the canvas (scene units, written back in metres when the scene reads metres),
 * drawn as `symbol` unless the scene draws every thing as one fixed symbol. Its id is the first `sample<n>` that no
 * symbol, thing or other sample has (`taken`). Refused (the same state) past `MAX_SAMPLE_THINGS`.
 */
export function addSampleThing(state: WhatIfState, s: SceneSettings, at: { x: number; y: number }, symbol: string, taken: Iterable<string> = []): WhatIfState {
  const list = sampleThings(state);
  if (list.length >= MAX_SAMPLE_THINGS) return state;
  const c = thingColumns(s);
  const used = new Set([...taken, ...list.map((r) => sampleId(s, r))]);
  let n = 1;
  while (used.has(`sample${n}`)) n += 1;
  const metres = s.thingsUnits === 'metres';
  const k = typeof s.thingsScale === 'number' && s.thingsScale > 0 ? s.thingsScale : 50;
  const ox = typeof s.thingsOriginX === 'number' ? s.thingsOriginX : 0;
  const oy = typeof s.thingsOriginY === 'number' ? s.thingsOriginY : 0;
  const round = (v: number) => Math.round(v * 100) / 100;
  const row: Record<string, unknown> = {
    [c.id]: `sample${n}`,
    [c.x]: round(metres ? (at.x - ox) / k : at.x),
    [c.y]: round(metres ? (at.y - oy) / k : at.y),
  };
  if (!(typeof s.thingsSymbol === 'string' && s.thingsSymbol.trim())) row[c.symbol] = symbol;
  return { ...state, things: [...list, row] };
}

/** Sets one column of the sample thing with this id (`undefined` removes the column; the id itself is not changed). */
export function setSampleThing(state: WhatIfState, s: SceneSettings, id: string, column: string, value: unknown): WhatIfState {
  const c = thingColumns(s);
  if (!safe(column) || column === c.id) return state;
  let changed = false;
  const things = sampleThings(state).map((r) => {
    if (sampleId(s, r) !== id) return r;
    changed = true;
    const next = { ...r };
    if (value === undefined) delete next[column]; else next[column] = value;
    return next;
  });
  return changed ? { ...state, things } : state;
}

/** Removes the sample thing with this id. */
export function removeSampleThing(state: WhatIfState, s: SceneSettings, id: string): WhatIfState {
  const list = sampleThings(state);
  const things = list.filter((r) => sampleId(s, r) !== id);
  if (things.length === list.length) return state;
  const { things: _gone, ...rest } = state;
  return things.length ? { ...rest, things } : rest;
}
