'use client';
import { cn } from '@/libs/utils/cn';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useFocusTrap } from '../shared/useFocusTrap';
import { useScrollLock } from '../shared/useScrollLock';
import { usePresence } from '../shared/usePresence';
import { usePortal } from '../shared/usePortal';
import { useRouteClose } from '../shared/useRouteClose';

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /**
   * Replaces the default title row with custom content in a fixed h-14 bar
   * (the close button stays on the right). `title` is still the dialog's
   * accessible name.
   */
  header?: React.ReactNode;
  side?: 'left' | 'right';
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Accessible name of the close button. Default = "Close drawer". */
  closeLabel?: string;
  /**
   * TODO M6: when true, close on Next.js route change. Drawer use case
   * is typical: closes when the user navigates from a nav drawer.
   * Accepted in M1 but currently a no-op (see useRouteClose stub).
   */
  closeOnRouteChange?: boolean;
  /** TODO M5: respect prefers-reduced-motion when true. */
  reducedMotion?: boolean;
  /** Portal mount target — defaults to document.body. */
  portalTarget?: Element | string | null;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
};

export function Drawer({
  open,
  onClose,
  title,
  header,
  side = 'right',
  children,
  footer,
  closeLabel = 'Close drawer',
  closeOnRouteChange,
  // TODO M5: reducedMotion
  reducedMotion: _reducedMotion,
  portalTarget,
  className,
  ref,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, state } = usePresence(open);

  useFocusTrap(panelRef, { active: open, onEscape: onClose });
  useScrollLock(open);
  useRouteClose({ active: open, closeOnRouteChange, onClose });

  const portalNode = usePortal(portalTarget);

  if (!mounted) return null;

  const node = (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex',
        state !== 'open' && 'pointer-events-none',
      )}
      aria-modal="true"
      role="dialog"
      aria-label={title}
      data-state={state}
    >
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-200',
          state === 'open' ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={(node) => {
          (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        tabIndex={-1}
        data-state={state}
        className={cn(
          'relative z-[101] flex flex-col w-80 max-w-full h-full bg-surface-raised border-border shadow-xl',
          'transition-transform duration-200 focus-visible:outline-none',
          side === 'right' ? 'ml-auto border-l' : 'mr-auto border-r',
          state === 'open'
            ? 'translate-x-0'
            : side === 'right'
              ? 'translate-x-full'
              : '-translate-x-full',
          className,
        )}
      >
        {header ? (
          <div className="flex items-center gap-3 h-14 px-4 border-b border-border shrink-0">
            <div className="flex-1 min-w-0">{header}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <FontAwesomeIcon icon={faXmark} className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-border shrink-0">
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="text-text-disabled hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
            >
              <FontAwesomeIcon icon={faXmark} className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="px-4 py-4 border-t border-border shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );

  if (!portalNode) return null;
  return createPortal(node, portalNode);
}
