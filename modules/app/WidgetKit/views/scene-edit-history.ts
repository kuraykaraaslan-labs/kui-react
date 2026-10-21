// The undo history of the diagram editor (pure, no React). It holds whole scene settings, which the edits share
// structurally (an edit copies only what it changes), so 100 steps stay cheap. It lives for one editing session.

import type { SceneSettings } from './scada-scene-logic';
import type { EditResult } from './scene-edit-core';

export const HISTORY_LIMIT = 100;

export interface History {
  /** Oldest first. */
  past: readonly SceneSettings[];
  present: SceneSettings;
  future: readonly SceneSettings[];
  /** The group key of the last edit: a following edit with the same key joins its entry (a drag is one step). */
  group: string | null;
}

export const createHistory = (initial: SceneSettings): History => ({ past: [], present: initial, future: [], group: null });

export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;

/**
 * Applies an edit. A refused or empty edit leaves the history as it is (the same object). With a `group` key, edits that
 * follow one another with that key share one entry, so every move of a drag is one undo step; any other edit, an undo
 * or a redo ends the group. A new edit drops the redo steps. At most `HISTORY_LIMIT` steps are kept.
 */
export function apply(h: History, op: (s: SceneSettings) => EditResult, group?: string): { history: History; result: EditResult } {
  const result = op(h.present);
  if (result.settings === h.present) return { history: h, result };
  if (group !== undefined && h.group === group && h.past.length > 0) {
    return { history: { ...h, present: result.settings, future: [] }, result };
  }
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { history: { past, present: result.settings, future: [], group: group ?? null }, result };
}

export function undo(h: History): History {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], group: null };
}

export function redo(h: History): History {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), group: null };
}
