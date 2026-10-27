'use client';
import { useEffect, useCallback } from 'react';

/**
 * Shared focus trap for Modal / Drawer / Popover.
 *
 * - Tab / Shift+Tab loop inside the container.
 * - Uses `data-focus-guard` sentinel awareness: sentinel elements at the
 *   container edges are skipped by treating them as boundary triggers.
 * - Saves the previously-focused element and restores it on close.
 * - Nested-overlay safe: a layer stack tracks "current top" so only the
 *   topmost active trap reacts to Tab/Escape.
 * - An Escape whose `defaultPrevented` is set was handled by a control
 *   inside the overlay (an open dropdown) and does not dismiss it.
 * - Tab with focus in another dialog layered over the overlay (one that is
 *   not on this stack, e.g. a host's confirm portaled to <body>) is that
 *   dialog's to move: the trap does not pull focus back.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Options = {
  active: boolean;
  onEscape?: () => void;
  /**
   * If true the trap also owns Escape handling. Defaults to true.
   * Set to false when you want a parent useDismiss hook to handle Escape
   * (avoids duplicate handlers in the same overlay).
   */
  handleEscape?: boolean;
};

/**
 * Layer stack for nested overlays. The top element of the stack is the
 * one currently allowed to intercept Tab and Escape. Stored as refs to
 * the trap containers (insertion order = open order).
 */
const layerStack: Array<React.RefObject<HTMLElement | null>> = [];

function isTopLayer(ref: React.RefObject<HTMLElement | null>): boolean {
  return layerStack[layerStack.length - 1] === ref;
}

export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  { active, onEscape, handleEscape = true }: Options,
) {
  // Push/pop on the nested-overlay stack.
  useEffect(() => {
    if (!active) return;
    layerStack.push(ref);
    return () => {
      const idx = layerStack.lastIndexOf(ref);
      if (idx !== -1) layerStack.splice(idx, 1);
    };
  }, [active, ref]);

  // Save previously focused element and restore it on close.
  useEffect(() => {
    if (!active) return;
    const prev = document.activeElement as HTMLElement | null;
    // Defer initial focus so the panel has actually mounted.
    const t = window.setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const firstFocusable = root.querySelector<HTMLElement>(FOCUSABLE);
      (firstFocusable ?? root).focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      prev?.focus?.();
    };
  }, [active, ref]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only the topmost active overlay should react.
      if (!isTopLayer(ref)) return;

      if (handleEscape && e.key === 'Escape') {
        // An inner control (an open ComboBox / Select list, an inline editor)
        // already handled this Escape: it closes that control, not the overlay.
        if (e.defaultPrevented) return;
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const container = ref.current;
      if (!container) return;

      // Focus in a dialog layered over this one (not on the stack, so it is not the top layer here) is that dialog's to move.
      const current = document.activeElement;
      const layer = current?.closest('[role="dialog"], [role="alertdialog"]');
      if (layer && !layer.contains(container) && !container.contains(current)) return;

      // Skip sentinel guards if present.
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.dataset.focusGuard !== 'true');
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [ref, onEscape, handleEscape],
  );

  useEffect(() => {
    if (!active) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, handleKeyDown]);
}

/**
 * Check whether a ref is the current top-most active overlay layer.
 * Exposed so sibling hooks (useDismiss) can de-duplicate Escape handling.
 */
export function isFocusTrapTopLayer(
  ref: React.RefObject<HTMLElement | null>,
): boolean {
  return isTopLayer(ref);
}
