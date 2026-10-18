'use client';
// modules/ui/Virtual/useVirtualList.ts
//
// A dependency-free windowing hook for lists in one scroll container: fixed or per-row heights,
// binary search over prefix sums, a small overscan, and `scrollToIndex` that respects a sticky header.
// The caller renders `[start, end)` between a top spacer (`offsetTop`) and a bottom spacer (`offsetBottom`),
// so rows keep their natural height and never overlap.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

export type VirtualListOptions = {
  /** Number of rows. */
  count: number;
  /** Row height in px: a number, or a function of the row index (used for wrapped log lines). A function must be memoised: a new one re-measures every row. */
  rowHeight: number | ((index: number) => number);
  /** The scroll container. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Extra rows rendered above and below the viewport. Default = 8. */
  overscan?: number;
  /** Viewport height used until the container is measured (and in a DOM without layout). Default = 400. */
  viewportFallback?: number;
  /** Height of a sticky header inside the scroll container, above the first row. Default = 0. */
  stickyTop?: number;
  /** false renders every row (the caller still gets offsets and `scrollToIndex`). Default = true. */
  enabled?: boolean;
};

export type VirtualList = {
  start: number;
  end: number;
  offsetTop: number;
  offsetBottom: number;
  total: number;
  viewportHeight: number;
  scrollTop: number;
  /** Top of a row in px, from the first row. */
  offsetOf: (index: number) => number;
  /** Scroll just enough to bring a row fully into view (below a sticky header). */
  scrollToIndex: (index: number) => void;
  /** The index of the row at a content offset. */
  indexAt: (offset: number) => number;
};

/** Prefix sums: `out[i]` is the top of row i, `out[count]` the total height. */
export function buildOffsets(count: number, rowHeight: number | ((i: number) => number)): Float64Array {
  const out = new Float64Array(count + 1);
  if (typeof rowHeight === 'number') {
    for (let i = 0; i <= count; i++) out[i] = i * rowHeight;
    return out;
  }
  let acc = 0;
  for (let i = 0; i < count; i++) {
    out[i] = acc;
    acc += Math.max(1, rowHeight(i));
  }
  out[count] = acc;
  return out;
}

/** Index of the row containing `offset` (clamped to `0..count-1`; -1 when empty). */
export function findIndex(offsets: Float64Array, offset: number): number {
  const count = offsets.length - 1;
  if (count <= 0) return -1;
  if (offset <= 0) return 0;
  if (offset >= offsets[count]) return count - 1;
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function useVirtualList(o: VirtualListOptions): VirtualList {
  const { count, rowHeight, scrollRef, overscan = 8, viewportFallback = 400, stickyTop = 0, enabled = true } = o;
  const [scrollTop, setScrollTop] = useState(0);
  const [measured, setMeasured] = useState(0);
  const raf = useRef<number | null>(null);

  const offsets = useMemo(() => buildOffsets(count, rowHeight), [count, rowHeight]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const read = () => setMeasured(el.clientHeight);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (raf.current !== null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        setScrollTop(el.scrollTop);
      });
    };
    setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [scrollRef]);

  const viewportHeight = measured > 0 ? measured : viewportFallback;
  const total = offsets[count] ?? 0;

  let start = 0;
  let end = count;
  if (enabled && count > 0) {
    const top = Math.max(0, scrollTop - stickyTop);
    start = Math.max(0, findIndex(offsets, top) - overscan);
    end = Math.min(count, findIndex(offsets, top + viewportHeight) + 1 + overscan);
  }

  const offsetOf = useCallback((i: number) => offsets[Math.min(Math.max(i, 0), offsets.length - 1)] ?? 0, [offsets]);
  const indexAt = useCallback((offset: number) => findIndex(offsets, offset), [offsets]);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el || index < 0 || index >= offsets.length - 1) return;
    const rowTop = offsets[index] + stickyTop;
    const rowBottom = offsets[index + 1] + stickyTop;
    const viewTop = el.scrollTop + stickyTop;
    const viewBottom = el.scrollTop + (el.clientHeight || viewportFallback);
    if (rowTop < viewTop) el.scrollTop = Math.max(0, rowTop - stickyTop);
    else if (rowBottom > viewBottom) el.scrollTop = rowBottom - (el.clientHeight || viewportFallback);
  }, [scrollRef, offsets, stickyTop, viewportFallback]);

  return {
    start,
    end,
    offsetTop: offsets[start] ?? 0,
    offsetBottom: Math.max(0, total - (offsets[end] ?? total)),
    total,
    viewportHeight,
    scrollTop,
    offsetOf,
    scrollToIndex,
    indexAt,
  };
}
