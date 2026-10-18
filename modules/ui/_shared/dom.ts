// modules/ui/_shared/dom.ts
//
// Small DOM helpers shared by the observability components. Browser-only functions guard `window`.

/** True when the element renders right-to-left (its computed `direction`, which follows an ancestor's `dir`). */
export function isRtlElement(el: Element | null | undefined): boolean {
  if (!el || typeof window === 'undefined') return false;
  return window.getComputedStyle(el).direction === 'rtl';
}

/** Copy text to the clipboard; resolves true on success. Falls back to a hidden textarea where the async API is missing. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea route
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Visually hidden, still read by screen readers. */
export const SR_ONLY = 'sr-only';

/** Stable pseudo-hash of a string into `0..n-1` (used to give a service or kind a stable palette slot). */
export function hashIndex(text: string, n: number): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return Math.abs(h) % Math.max(1, n);
}
