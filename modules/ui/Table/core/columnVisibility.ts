'use client';
// The column chooser's state (`DataTable` `columnChooser`): which columns this viewer hid or showed, saved in this
// browser's localStorage under the table's `tableId`. Only the viewer's own changes are stored (key -> shown), so a
// column added later follows its `defaultHidden`, and Reset drops them all.

import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Column } from '../types';

/** Choices of one table: column key -> shown. Only the columns the viewer changed. */
export type ColumnChoices = Record<string, boolean>;

/** The localStorage key a table's choices live under; `v1` is the stored shape, so a later shape gets a new key. */
export function columnChoicesKey(tableId: string): string {
  return `kui.dataTable.columns.v1.${tableId}`;
}

/** Stored text -> choices; anything unreadable counts as none. */
export function parseColumnChoices(raw: string | null): ColumnChoices {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: ColumnChoices = {};
    for (const [key, shown] of Object.entries(value)) if (typeof shown === 'boolean') out[key] = shown;
    return out;
  } catch {
    return {};
  }
}

// Every table on the page re-reads after a write (two tables with one tableId stay in step); other tabs through `storage`.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes (or, for no choices, removes) the stored choice; false when storage is blocked. */
function writeStored(key: string, choices: ColumnChoices): boolean {
  let saved = true;
  try {
    if (Object.keys(choices).length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(choices));
  } catch {
    // Storage blocked (a private window): the choice lasts while the table is mounted.
    saved = false;
  }
  for (const listener of listeners) listener();
  return saved;
}

/** A column the chooser lists (`hideable` is not `false`). */
export function isHideable<T>(column: Column<T>): boolean {
  return column.hideable !== false;
}

/**
 * The columns to draw and the chooser's actions. Off (`enabled` false): every column, nothing stored. Without a
 * `tableId` the choice lives in memory. The server render and hydration use the defaults; the stored choice follows.
 */
export function useColumnVisibility<T>(columns: Column<T>[], enabled: boolean, tableId: string | undefined) {
  const key = enabled && tableId ? columnChoicesKey(tableId) : null;
  const stored = useSyncExternalStore(subscribe, () => (key ? readStored(key) : null), () => null);
  // Kept beside the stored copy, so the chooser still works where storage is blocked. Once a write went through, the
  // stored copy rules: a Reset in another table or tab with this tableId (key removed) brings back the defaults here too.
  const [local, setLocal] = useState<{ choices: ColumnChoices; saved: boolean }>({ choices: {}, saved: false });
  const choices = useMemo(
    () => (key && (stored !== null || local.saved) ? parseColumnChoices(stored) : local.choices),
    [key, stored, local],
  );

  const resolve = (from: ColumnChoices) =>
    columns.filter((c) => !enabled || !isHideable(c) || (from[String(c.key)] ?? !c.defaultHidden));
  // A column without `hideBelow` shows on every screen; when the table has one, it keeps one such column on screen.
  const anyOnEveryScreen = columns.some((c) => !c.hideBelow);
  const enough = (list: Column<T>[]) => list.length > 0 && (!anyOnEveryScreen || list.some((c) => !c.hideBelow));
  // The choice the chooser edits. A stored choice that would leave the table without a column is ignored (the defaults
  // apply, and the next change starts from them); columns that all start hidden all show.
  let base = choices;
  let shown = resolve(base);
  if (!enough(shown)) {
    base = {};
    shown = resolve(base);
  }
  if (shown.length === 0) {
    base = Object.fromEntries(columns.map((c) => [String(c.key), true]));
    shown = columns;
  }
  // The last shown column that keeps the table readable on every screen is locked, unless one that cannot be hidden does that.
  const keepers = anyOnEveryScreen ? shown.filter((c) => !c.hideBelow) : shown;
  const lockNeeded = !keepers.some((c) => !isHideable(c));

  function save(next: ColumnChoices) {
    const saved = key ? writeStored(key, next) : false;
    setLocal({ choices: next, saved });
  }

  return {
    /** The columns to draw, in their order. */
    columns: shown,
    isShown: (column: Column<T>) => shown.includes(column),
    /** The viewer may not hide this column: the table would lose its last one. */
    isLocked: (column: Column<T>) => lockNeeded && keepers.length <= 1 && keepers.includes(column),
    setShown: (columnKey: string, value: boolean) => save({ ...base, [columnKey]: value }),
    /** Back to the columns' defaults; the stored choice is removed. */
    reset: () => save({}),
    /** Columns of the chooser the viewer currently does not see. */
    hiddenCount: columns.filter((c) => isHideable(c) && !shown.includes(c)).length,
    /** The viewer changed something (Reset has work to do). */
    changed: Object.keys(choices).length > 0,
  };
}
