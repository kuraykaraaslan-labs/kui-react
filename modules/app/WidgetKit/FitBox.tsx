'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { MIN_FIT_SCALE, fitScale } from './card-logic';

/**
 * The content box's style at `scale`: in flow at full size, or laid out as much larger and drawn scaled down into the box. The
 * scaled box is anchored to the box's top-left corner physically (absolute, `left: 0`), so a right-to-left page, where a block wider
 * than its parent overflows to the left, does not push it out of the card.
 */
export function fitStyle(scale: number): CSSProperties {
  return scale < 1
    ? { position: 'absolute', top: 0, left: 0, width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: '0 0' }
    : { height: '100%' };
}

function apply(c: HTMLElement, scale: number) {
  c.style.cssText = '';
  Object.assign(c.style, fitStyle(scale));
}

const overflows = (c: HTMLElement) => c.scrollHeight > c.clientHeight + 1;

/**
 * The scale the content needs, decided from its own layout: content that fits the box at full size keeps 1 (a part that flexes, a
 * dial or a vertical slider, is never measured at its largest); content that overflows is laid out at the scale its overflow asks
 * for and lowered until nothing overflows, never under `MIN_FIT_SCALE`. Leaves `c` laid out at the scale it returns.
 */
export function settleScale(b: HTMLElement, c: HTMLElement): number {
  apply(c, 1);
  if (!(b.clientHeight > 0) || !overflows(c)) return 1;
  let scale = fitScale(c.clientHeight, c.scrollHeight);
  for (let i = 0; i < 4; i++) {
    apply(c, scale);
    if (scale <= MIN_FIT_SCALE || !overflows(c)) return scale;
    scale = Math.max(MIN_FIT_SCALE, Math.floor(scale * (c.clientHeight / c.scrollHeight) * 1000) / 1000);
  }
  apply(c, scale);
  return scale;
}

/**
 * The view of a kind whose content has a height of its own (`WidgetKindView.fit`), in a fixed-height cell: content that overflows
 * the body is laid out in a box as much larger as it needs and drawn scaled down into the body, so a small card shows all of its
 * value, label and state instead of cutting them off under the header. Never under `MIN_FIT_SCALE`: below it the body scrolls.
 * Where the cell grows with its content (below lg) nothing overflows and the scale stays 1. Horizontal overflow is clipped here so a
 * scrollbar it would add to the body cannot change the height the next measure sees.
 */
export function FitBox({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const current = useRef(1);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const b = box.current;
    const c = content.current;
    if (!b || !c || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    let live = true;
    const measure = () => {
      frame = 0;
      if (!live) return;
      const next = settleScale(b, c);
      const kept = Math.abs(current.current - next) < 0.005 ? current.current : next;
      apply(c, kept);
      current.current = kept;
      setScale(kept);
    };
    const later = () => { if (live && !frame) frame = requestAnimationFrame(measure); };
    const resized = new ResizeObserver(later);
    resized.observe(b);
    // New data, settings (a larger lamp, a font) or a state shown by `hidden` can change the content without the cell changing size.
    // The content box's own style is written here, so its records are left out.
    const changed = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((records) => { if (records.some((r) => r.target !== c)) later(); });
    changed?.observe(c, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    void fonts?.ready.then(later);
    fonts?.addEventListener?.('loadingdone', later);
    measure();
    return () => {
      live = false;
      resized.disconnect();
      changed?.disconnect();
      fonts?.removeEventListener?.('loadingdone', later);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={box} className="relative h-full w-full overflow-x-clip" data-part="fit" data-scale={scale < 1 ? scale : undefined}>
      <div ref={content} style={fitStyle(scale)}>{children}</div>
    </div>
  );
}
