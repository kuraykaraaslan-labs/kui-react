'use client';
import { cn } from '@/libs/utils/cn';
import { useRef, useState } from 'react';
import { useFocusTrap } from '../shared/useFocusTrap';
import { useDismiss } from '../shared/useDismiss';
import { useKeepInViewport } from '../shared/useKeepInViewport';
import { type Placement, placementClasses } from '../shared/positioning';

export type PopoverProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  placement?: Placement;
  className?: string;
  /**
   * Built-in focus trap on the panel (M1). For M4 this will be
   * conditional on the `as` prop (no trap for tooltips).
   */
  focusTrap?: boolean;
  /** Controlled open state. With it, the panel opens and closes only through `onOpenChange` (e.g. an Apply button inside). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Let the trigger shrink to the popover's container. The wrapper is an inline-block that sizes
   * itself to the whole trigger, so a trigger's own `max-w-full` and `truncate` never apply and a
   * long trigger overflows a narrow container. With `shrinkTrigger` the wrapper is capped at its
   * container's width (`max-w-full`) and such a trigger truncates instead. Off by default.
   */
  shrinkTrigger?: boolean;
};

export function Popover({
  trigger,
  children,
  placement = 'bottom',
  className,
  focusTrap = true,
  open: openProp,
  onOpenChange,
  shrinkTrigger = false,
}: PopoverProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (openProp === undefined) setOpenState(value);
    onOpenChange?.(value);
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // useDismiss replaces the old hand-rolled mousedown / keydown wiring.
  // Outside pointerdown + Escape, layered z-index aware.
  useDismiss({
    active: open,
    ref: containerRef,
    // useFocusTrap below pushes panelRef (not containerRef) onto the
    // layer stack — the top-of-stack check needs the same ref or it
    // never matches, silently disabling Escape/outside-click.
    layerRef: panelRef,
    onDismiss: () => setOpen(false),
  });

  // M1 baseline: panel keeps role="dialog". M4 will switch role based
  // on the `as` prop (tooltip / menu / popover).
  useFocusTrap(panelRef, {
    active: open && focusTrap,
    onEscape: () => setOpen(false),
    // useDismiss already handles Escape — avoid double handling.
    handleEscape: false,
  });

  useKeepInViewport(panelRef, open);

  return (
    <div ref={containerRef} className={cn('relative inline-block', shrinkTrigger && 'max-w-full')}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
          data-state={open ? 'open' : 'closed'}
          className={cn(
            'absolute z-[70] min-w-[12rem] rounded-lg border border-border bg-surface-raised shadow-xl',
            'focus-visible:outline-none',
            placementClasses[placement],
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
