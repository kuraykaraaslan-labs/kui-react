'use client';
import { useLayoutEffect, type RefObject } from 'react';

/**
 * Keeps an open overlay panel (a menu, a popover) inside the part of the page the viewer can
 * see. Whatever placed the panel (an `absolute right-0` class, a `fixed` style measured from the
 * trigger), the panel is measured after it renders and, when an edge would leave the visible
 * area, it is shifted back with the CSS `translate` property (which composes with any
 * `transform` the panel animates) and capped at the visible width minus the margins.
 *
 * The visible area is the visual viewport where the browser has one: on a phone that is the
 * screen, even when the page is pinch-zoomed or wider than the screen. Only the horizontal axis
 * is corrected; a menu below its trigger already scrolls inside its own max height.
 */
export function useKeepInViewport(ref: RefObject<HTMLElement | null>, active: boolean, margin = 8) {
  useLayoutEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const vv = window.visualViewport;

    const fit = () => {
      const left = vv ? vv.offsetLeft : 0;
      const width = vv ? vv.width : document.documentElement.clientWidth;
      el.style.translate = '';
      el.style.maxWidth = `${Math.max(0, width - 2 * margin)}px`;
      const r = el.getBoundingClientRect();
      let dx = 0;
      if (r.right > left + width - margin) dx = left + width - margin - r.right;
      if (r.left + dx < left + margin) dx = left + margin - r.left;
      if (dx !== 0) el.style.translate = `${Math.round(dx)}px 0`;
    };

    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('scroll', fit, true);
    vv?.addEventListener('resize', fit);
    vv?.addEventListener('scroll', fit);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(el);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('scroll', fit, true);
      vv?.removeEventListener('resize', fit);
      vv?.removeEventListener('scroll', fit);
      ro?.disconnect();
      el.style.translate = '';
      el.style.maxWidth = '';
    };
  }, [ref, active, margin]);
}
