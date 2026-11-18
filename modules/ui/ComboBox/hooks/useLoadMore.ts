'use client';
// useLoadMore — IntersectionObserver-backed sentinel hook.
// Caller passes a sentinel ref + onLoadMore; hook fires onLoadMore once per
// intersection event while not already loading. Errors are swallowed silently
// (caller is expected to surface them via onSearch failure semantics).
// `query` is the search whose list is on screen: onLoadMore gets it (a cached search does not call onSearch, so the host
// cannot know it otherwise), and the page is handed back with it, so a page that lands after the search changed joins its
// own search's list, not the one on screen. `shown`: whether the sentinel is drawn. The list draws it only once its
// results are in, so the observer is attached when it appears (attached when the panel opened, before the first results,
// it never fired) (NB 41-ui-fixes/38 A4.5).

import { useEffect, useRef, useState } from 'react';
import type { LoadMoreFn, ComboBoxOption } from '../types';

export function useLoadMore(
  open: boolean,
  sentinelRef: React.RefObject<HTMLElement | null>,
  onLoadMore: LoadMoreFn | undefined,
  onAppend: (next: ComboBoxOption[], query: string) => void,
  query = '',
  shown = true
) {
  const [loadingMore, setLoadingMore] = useState(false);
  const inFlightRef = useRef(false);
  // Read when the sentinel fires, so typing does not re-create the observer (which would fire again at once).
  const queryRef = useRef(query.trim());
  useEffect(() => { queryRef.current = query.trim(); }, [query]);

  useEffect(() => {
    if (!open || !onLoadMore || !shown) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || inFlightRef.current) return;

        inFlightRef.current = true;
        setLoadingMore(true);
        const q = queryRef.current;
        Promise.resolve(onLoadMore(q))
          .then((next) => {
            if (next && next.length > 0) onAppend(next, q);
          })
          .catch(() => { /* swallow — see header */ })
          .finally(() => {
            inFlightRef.current = false;
            setLoadingMore(false);
          });
      },
      { root: node.closest('[data-combobox-list]') ?? null, rootMargin: '40px' }
    );

    io.observe(node);
    return () => io.disconnect();
  }, [open, onLoadMore, onAppend, sentinelRef, shown]);

  return loadingMore;
}
