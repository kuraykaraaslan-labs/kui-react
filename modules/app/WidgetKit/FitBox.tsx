'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { fitScale } from './card-logic';

/**
 * The view of a kind whose content has a height of its own (`WidgetKindView.fit`), in a fixed-height cell: when the content needs
 * more height than the body has, it is laid out in a box as much larger as it needs and drawn scaled down into the body, so a small
 * card shows all of its value, label and state instead of cutting them off under the header. Never under `MIN_FIT_SCALE`: below it
 * the body scrolls. The natural height is measured at the body's width with the height left open, so a wider box (which wraps less)
 * only ever needs less, and the scale settles in one step.
 */
export function FitBox({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const b = box.current;
    const c = content.current;
    if (!b || !c || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const { width, height } = c.style;
      c.style.width = `${b.clientWidth}px`;
      c.style.height = 'auto';
      const needed = c.scrollHeight;
      c.style.width = width;
      c.style.height = height;
      const next = fitScale(b.clientHeight, needed);
      setScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
    };
    const later = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resized = new ResizeObserver(later);
    resized.observe(b);
    // New data can make the content taller without the cell changing size.
    const changed = typeof MutationObserver === 'undefined' ? null : new MutationObserver(later);
    changed?.observe(c, { childList: true, subtree: true, characterData: true });
    measure();
    return () => { resized.disconnect(); changed?.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);

  const style: CSSProperties = scale < 1
    ? { width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: 'top left' }
    : { height: '100%' };
  return (
    <div ref={box} className="relative h-full w-full" data-part="fit" data-scale={scale < 1 ? scale : undefined}>
      <div ref={content} style={style}>{children}</div>
    </div>
  );
}
