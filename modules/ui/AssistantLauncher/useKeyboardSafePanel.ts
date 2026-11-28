'use client';
import { useEffect, type RefObject } from 'react';

/** The width below which the panel takes the whole screen (Tailwind's `max-sm`). */
const PHONE = '(max-width: 639px)';

/**
 * Phones: the open panel is the screen, like an app's. The on-screen keyboard shrinks the visual viewport and the browser
 * pans the page up to the focused field, which would carry the panel's header and messages off the top. While the panel
 * is open on a phone it follows the visual viewport (its top and height) and the page under it does not scroll.
 */
export function useKeyboardSafePanel(panelRef: RefObject<HTMLElement | null>, open: boolean): void {
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const panel = panelRef.current;
    const phone = window.matchMedia?.(PHONE);
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!panel || !phone) return;
    const prev = { html: root.style.overflow, body: document.body.style.overflow };

    function fit() {
      const on = phone!.matches;
      root.style.overflow = on ? 'hidden' : prev.html;
      document.body.style.overflow = on ? 'hidden' : prev.body;
      if (on && vv) {
        panel!.style.top = `${vv.offsetTop}px`;
        panel!.style.height = `${vv.height}px`;
        panel!.style.bottom = 'auto';
      } else {
        panel!.style.top = panel!.style.height = panel!.style.bottom = '';
      }
    }

    fit();
    vv?.addEventListener('resize', fit);
    vv?.addEventListener('scroll', fit);
    phone.addEventListener?.('change', fit);
    return () => {
      vv?.removeEventListener('resize', fit);
      vv?.removeEventListener('scroll', fit);
      phone.removeEventListener?.('change', fit);
      root.style.overflow = prev.html;
      document.body.style.overflow = prev.body;
      panel.style.top = panel.style.height = panel.style.bottom = '';
    };
  }, [panelRef, open]);
}
