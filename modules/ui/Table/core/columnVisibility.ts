'use client';
// The column chooser's state (`DataTable` `columnChooser`): which columns this viewer hid or showed, saved in this
// browser's localStorage under the table's `tableId`. Only the viewer's own changes are stored (key -> shown), so a
// column added later follows its `defaultHidden`, and Reset drops them all.

import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Column } from '../types';

/** Choices of one table: column key -> shown. Only the columns the viewer changed. */
export type ColumnChoices = Record<string, boolean>;

/** The localStorage key a table's choices live under. */
export function columnChoicesKey(tableId: string): string {
  return `kui.dataTable.columns.${tableId}`;
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

function writeStored(key: string, choices: ColumnChoices | null) {
  try {
    if (choices === null || Object.keys(choices).length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(choices));
  } catch {
    // Storage blocked (a private window): the choice lasts while the table is mounted.
  }
  for (const listener of listeners) listener();
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
  // Kept beside the stored copy, so the chooser still works where storage is blocked.
  const [local, setLocal] = useState<ColumnChoices>({});
  const choices = useMemo(() => (key && stored !== null ? parseColumnChoices(stored) : local), [key, stored, local]);

  const isShown = (column: Column<T>) =>
    !enabled || !isHideable(column) || (choices[String(column.key)] ?? !column.defaultHidden);
  const picked = columns.filter(isShown);
  // A stored choice never leaves the table without a column.
  const shown = picked.length > 0 ? picked : columns;

  function save(next: ColumnChoices) {
    setLocal(next);
    if (key) writeStored(key, next);
  }

  return {
    /** The columns to draw, in their order. */
    columns: shown,
    isShown: (column: Column<T>) => shown.includes(column),
    setShown: (columnKey: string, value: boolean) => save({ ...choices, [columnKey]: value }),
    /** Back to the columns' defaults; the stored choice is removed. */
    reset: () => save({}),
    /** Columns of the chooser the viewer currently does not see. */
    hiddenCount: columns.filter((c) => isHideable(c) && !shown.includes(c)).length,
    /** The viewer changed something (Reset has work to do). */
    changed: Object.keys(choices).length > 0,
  };
}
