'use client';
import { useSyncExternalStore } from 'react';

export const SIDE_KEY = 'kui-ruleset-sidebar';

const listeners = new Set<() => void>();
/** the stored word: 'open', 'closed' or nothing (open) */
let memory: string | null = null;

function readStored(): string | null {
  try { return window.localStorage.getItem(SIDE_KEY); } catch { return memory; }
}

function writeStored(open: boolean) {
  memory = open ? 'open' : 'closed';
  try { window.localStorage.setItem(SIDE_KEY, memory); } catch { /* storage may be blocked: the choice lasts until reload */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => { listeners.delete(cb); window.removeEventListener('storage', cb); };
}

/**
 * Is the side bar shown, when the host does not keep it (`sideBar.open`): the last choice, kept in localStorage as the
 * mini map's is, open when there is none. The server render and the first client render show it open.
 */
export function useSidePref(): [boolean, (open: boolean) => void] {
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  return [stored !== 'closed', writeStored];
}
