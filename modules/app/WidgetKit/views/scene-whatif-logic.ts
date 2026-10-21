// The what-if overrides (pure, no React): values laid over the bound table's rows and the board's parameters while the
// editor is open, to preview every rule. Nothing here is stored or written back; `WhatIfState` lives in the editor's
// memory only. Every function returns a new state and never changes its input.

import type { WhatIfState } from './scene-editor-types';

type Row = Record<string, unknown>;

/** The columns the panel overrides. */
export const WHATIF_COLUMNS = ['value', 'value2', 'capacity', 'running', 'status'] as const;
export type WhatIfColumn = (typeof WHATIF_COLUMNS)[number];

export const emptyWhatIf = (): WhatIfState => ({ rows: {}, params: {} });

/** A name that can be a key of the state without touching a prototype member. */
const safe = (name: string): boolean => name !== '' && name.length <= 128 && !['__proto__', 'constructor', 'prototype'].includes(name);

/** How many values are overridden (rows' cells and parameters). */
export function overrideCount(state: WhatIfState): number {
  return Object.values(state.rows).reduce((n, r) => n + Object.keys(r).length, 0) + Object.keys(state.params).length;
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
