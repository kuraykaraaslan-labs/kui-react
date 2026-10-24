'use client';
import { useEffect } from 'react';
import { isFocusTrapTopLayer } from './useFocusTrap';

/**
 * Handles Escape + outside-click dismissal for overlays.
 *
 * - Escape: only the topmost active overlay (per useFocusTrap stack)
 *   dismisses, so stacking modals do not all close together.
 *   An Escape an inner control already handled (`defaultPrevented`) is
 *   ignored, so closing a dropdown inside the overlay keeps it open.
 * - Outside click: capture-phase pointerdown so children listening on
 *   the bubble phase can still consume the event (e.g. Popover triggers
 *   nested inside their own root).
 *
 * Pass `escape: false` to opt out (e.g. when useFocusTrap already owns
 * Escape) or `outsidePointer: false` to disable click-outside (Modal
 * uses an explicit backdrop click handler instead).
 *
 * `ref` is used for the outside-click containment check (typically the
 * outer wrapper, so a click on the trigger doesn't count as "outside").
 * The top-of-stack check needs the *same* ref useFocusTrap pushed onto
 * its layer stack (typically the panel itself, a different element) —
 * pass that as `layerRef` when it differs from `ref`, or the check
 * always fails and Escape/outside-click silently do nothing.
 */

type Options = {
  active: boolean;
  ref: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  escape?: boolean;
  outsidePointer?: boolean;
  layerRef?: React.RefObject<HTMLElement | null>;
};

export function useDismiss({
  active,
  ref,
  onDismiss,
  escape = true,
  outsidePointer = true,
  layerRef = ref,
}: Options) {
  useEffect(() => {
    if (!active) return;

    function onKey(e: KeyboardEvent) {
      if (!escape) return;
      if (e.key !== 'Escape') return;
      // An inner control (an open ComboBox / Select list, an inline editor)
      // already handled this Escape: it closes that control, not the overlay.
      if (e.defaultPrevented) return;
      if (!isFocusTrapTopLayer(layerRef)) return;
      onDismiss();
    }

    function onPointer(e: PointerEvent) {
      if (!outsidePointer) return;
      const root = ref.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      if (!isFocusTrapTopLayer(layerRef)) return;
      onDismiss();
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [active, ref, layerRef, onDismiss, escape, outsidePointer]);
}
