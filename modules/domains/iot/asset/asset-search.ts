'use client';
import { useEffect, useRef, useState } from 'react';
import type { Page } from '../api/adapter';
import type { IotMessages } from '../messages';
import type { AssetRow } from '../types/asset';

/**
 * Searching a tree the host cut (NB 41-ui-fixes/25 1.9): when the host holds more assets than its tree answers (`truncated`), a search
 * asks the host (its flat list, every asset) instead of filtering only what was read, and the hits are shown flat with their place.
 * Every search waits for typing to pause (`SEARCH_PAUSE_MS`), so a keystroke neither asks the host nor redraws the tree.
 */
export type AssetSearch = (search: string, signal: AbortSignal) => Promise<Page<AssetRow>>;

export const SEARCH_PAUSE_MS = 250;
/** The hits a host search shows at most (the rest: "type more"). */
export const SEARCH_HITS = 50;

/** `value` once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = SEARCH_PAUSE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(value, settled)) return;
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms, settled]);
  return settled;
}

/** The host's answer to `query` (already debounced; empty: none). A later query wins over an earlier answer that arrives late. */
export function useHostAssetSearch(search: AssetSearch | undefined, query: string): { hits: AssetRow[]; total: number; loading: boolean; failed: boolean } {
  const [state, setState] = useState<{ q: string; hits: AssetRow[]; total: number; failed: boolean } | null>(null);
  const seq = useRef(0);
  const q = query.trim();
  useEffect(() => {
    if (!search || !q) return;
    const mine = ++seq.current;
    const ctrl = new AbortController();
    search(q, ctrl.signal).then(
      (p) => { if (mine === seq.current && !ctrl.signal.aborted) setState({ q, hits: p.items, total: p.total, failed: false }); },
      () => { if (mine === seq.current && !ctrl.signal.aborted) setState({ q, hits: [], total: 0, failed: true }); },
    );
    return () => ctrl.abort();
  }, [search, q]);
  const current = state && state.q === q ? state : null;
  return { hits: current?.hits ?? [], total: current?.total ?? 0, loading: !!search && !!q && !current, failed: current?.failed ?? false };
}

/** A hit's words: its name and, after a separator, where it is ("Press 3 · Berlin plant › Hall A"; a top-level one says so). Pure. */
export function assetHitLabel(row: AssetRow, m: IotMessages): string {
  const place = row.location.length ? row.location.map((l) => l.name).join(' › ') : m.assets.searchTop;
  return `${row.name} · ${place}`;
}
