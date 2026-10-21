/**
 * Undo / redo as a stack of snapshots (strings). A snapshot is the JSON of the editable state with
 * sorted keys, so equal content is an equal string and pushing the same state twice adds no step.
 */

/** JSON with sorted keys; undefined values are left out. */
export function stable(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  const record = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => JSON.stringify(key) + ':' + stable(record[key]))
      .join(',') +
    '}'
  );
}

export type History = {
  /** start over from this snapshot: no steps in either direction */
  reset: (snapshot: string) => void;
  present: () => string | null;
  /** change the present state without a step (a save turned pending changes into saved ones) */
  replace: (snapshot: string) => void;
  /**
   * Add a step. Returns false when nothing changed. A push with the same key as the one before it,
   * within one second, joins that step instead (typing in a field is one step).
   */
  push: (snapshot: string, key?: string, now?: number) => boolean;
  undo: () => string | null;
  redo: () => string | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** [steps back, steps forward] */
  steps: () => [number, number];
};

export const HISTORY_LIMIT = 100;
export const HISTORY_MAX_BYTES = 16_000_000;
export const HISTORY_MERGE_MS = 1000;

export function createHistory(limit = HISTORY_LIMIT, maxBytes = HISTORY_MAX_BYTES): History {
  let past: string[] = [];
  let future: string[] = [];
  let current: string | null = null;
  let lastKey: string | null = null;
  let lastAt = 0;
  let bytes = 0;
  return {
    reset(snapshot) {
      past = []; future = []; current = snapshot; lastKey = null; lastAt = 0; bytes = 0;
    },
    present: () => current,
    replace(snapshot) {
      current = snapshot;
    },
    push(snapshot, key, now = Date.now()) {
      if (snapshot === current) return false;
      if (key && key === lastKey && now - lastAt < HISTORY_MERGE_MS && past.length) {
        current = snapshot;
        lastAt = now;
        future = [];
        return true;
      }
      if (current !== null) {
        past.push(current);
        bytes += current.length;
      }
      while (past.length > limit || (bytes > maxBytes && past.length > 1)) bytes -= (past.shift() as string).length;
      current = snapshot;
      future = [];
      lastKey = key ?? null;
      lastAt = now;
      return true;
    },
    undo() {
      if (!past.length) return null;
      if (current !== null) future.push(current);
      current = past.pop() as string;
      bytes -= current.length;
      lastKey = null;
      return current;
    },
    redo() {
      if (!future.length) return null;
      if (current !== null) past.push(current);
      if (current !== null) bytes += current.length;
      current = future.pop() as string;
      lastKey = null;
      return current;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    steps: () => [past.length, future.length],
  };
}
