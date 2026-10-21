/**
 * The browser draft of a flow: unsaved work kept in `localStorage`, one entry per flow, so a closed
 * tab, a crash or a switch to another flow does not lose it. Pure apart from the storage it is given; every
 * storage access is guarded, because storage can be blocked, full or missing.
 */

import { scrubSnapshot, secretByName, type SecretTest } from './scrub';

export const DRAFT_PREFIX = 'kui-ruleset-draft:';
/** a draft larger than this (characters) is not kept */
export const DRAFT_MAX = 2_000_000;
/** pause after the last change before the draft is written */
export const DRAFT_DELAY_MS = 800;

export type Draft = {
  v: 1;
  /** checksum of the saved state the draft was made from */
  base: number;
  /** the graph as a snapshot string (`snapshotOf`) */
  snap: string;
  /** seconds since the epoch */
  ts: number;
};

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** `kui-ruleset-draft:f:<id>`; a flow not saved yet has an empty id */
export function draftKey(id: string | null | undefined): string {
  return `${DRAFT_PREFIX}f:${id ?? ''}`;
}

/** a short checksum of a text: what a draft was made from */
export function hashText(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return h;
}

function defaultStorage(): DraftStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

export type DraftStore = {
  /** keep the snapshot; false when it is too large or the browser cannot keep it */
  write: (key: string, snap: string, baseSnap: string, now?: number) => boolean;
  /** the draft of the key, unless it is empty, broken or equal to the saved state */
  read: (key: string, baseSnap: string) => Draft | null;
  clear: (key: string) => void;
  /** the saved state changed since the draft was made */
  isStale: (draft: Draft, baseSnap: string) => boolean;
};

/**
 * A draft store over a storage (`localStorage` by default). A storage that throws behaves like no storage.
 * Secret values never reach the storage (`secretTest` tells which keys are secrets; the default goes by key
 * name): a draft restored in the editor has the secret keys empty, a `{ "$secret": true }` marker stays.
 */
export function createDraftStore(getStorage: () => DraftStorage | null = defaultStorage, secretTest: SecretTest = secretByName): DraftStore {
  const guarded = <T,>(fn: (s: DraftStorage) => T): T | null => {
    try {
      const s = getStorage();
      return s ? fn(s) : null;
    } catch {
      return null;
    }
  };
  return {
    write(key, snap, baseSnap, now = Date.now()) {
      const kept = scrubSnapshot(snap, secretTest);
      if (kept.length > DRAFT_MAX) return false;
      const draft: Draft = { v: 1, base: hashText(baseSnap), snap: kept, ts: Math.floor(now / 1000) };
      return guarded((s) => { s.setItem(key, JSON.stringify(draft)); return true; }) === true;
    },
    read(key, baseSnap) {
      const d = guarded((s) => JSON.parse(s.getItem(key) || 'null') as Partial<Draft> | null);
      return d && d.v === 1 && typeof d.snap === 'string' && typeof d.base === 'number' && typeof d.ts === 'number' && d.snap !== scrubSnapshot(baseSnap, secretTest)
        ? { v: 1, base: d.base, snap: d.snap, ts: d.ts }
        : null;
    },
    clear(key) {
      guarded((s) => s.removeItem(key));
    },
    isStale(draft, baseSnap) {
      return draft.base !== hashText(baseSnap);
    },
  };
}
