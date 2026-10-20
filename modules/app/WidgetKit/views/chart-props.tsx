'use client';
// Settings → kui Chart props, shared by every chart view. The pure mapping lives in `chart-props-logic.ts`
// (re-exported here); this file keeps the one React hook.

import { useEffect, useRef, useState, type RefObject } from 'react';

export * from './chart-props-logic';

/** The card body's measured size (charts that pick a layout from their shape, e.g. a pie's legend side). */
export function useBoxSize(): [RefObject<HTMLDivElement | null>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const b = el.getBoundingClientRect();
      setSize((prev) => (prev.width === Math.floor(b.width) && prev.height === Math.floor(b.height) ? prev : { width: Math.floor(b.width), height: Math.floor(b.height) }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
