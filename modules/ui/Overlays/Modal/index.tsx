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

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullscreen?: boolean;
  scrollable?: boolean;
  closeOnBackdropClick?: boolean;
  /** Accessible name of the close button. Default = "Close dialog". */
  closeLabel?: string;
  /**
   * TODO M6: when true, close on Next.js route change.
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

const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  fullscreen = false,
  scrollable = false,
  closeOnBackdropClick = true,
  closeLabel = 'Close dialog',
  closeOnRouteChange,
  // TODO M5: reducedMotion
  reducedMotion: _reducedMotion,
  portalTarget,
  className,
  ref,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = 'modal-title';
  const descId = description ? 'modal-desc' : undefined;
  const { mounted, state } = usePresence(open);

  useFocusTrap(panelRef, { active: open, onEscape: onClose });
  useScrollLock(open);
  useRouteClose({ active: open, closeOnRouteChange, onClose });

  const portalNode = usePortal(portalTarget);

  if (!mounted) return null;

  const sizeClass = sizeMap[size];

  const node = (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex p-4 transition-opacity duration-200',
        fullscreen ? 'items-stretch justify-stretch' : 'items-center justify-center',
        state === 'open' ? 'opacity-100' : 'opacity-0',
      )}
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      data-state={state}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeOnBackdropClick ? onClose : undefined}
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
          'relative z-[101] w-full border border-border bg-surface-raised shadow-xl flex flex-col',
          'transition-all duration-200 focus-visible:outline-none',
          state === 'open' ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
          fullscreen
            ? 'rounded-none max-w-none max-h-none h-full'
            : cn('rounded-xl', sizeClass),
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-text-primary">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-text-secondary mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="shrink-0 text-text-disabled hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {children && (
          <div className={cn('px-6 py-4 flex-1', scrollable && 'overflow-y-auto')}>
            {children}
          </div>
        )}
        {footer && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (!portalNode) return null;
  return createPortal(node, portalNode);
}
