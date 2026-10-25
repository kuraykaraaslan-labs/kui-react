'use client';
import { cn } from '@/libs/utils/cn';
import { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { Button } from './Button';
import { useFocusTrap } from './Overlays/shared/useFocusTrap';
import { useDismiss } from './Overlays/shared/useDismiss';
import { type Placement, placementClasses } from './Overlays/shared/positioning';

type PopconfirmProps = {
  trigger: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  placement?: Placement;
  onConfirm: () => void;
  onCancel?: () => void;
  className?: string;
};

/**
 * @deprecated Every confirmation uses `ConfirmDialog` (or `confirmDialog()`); kept only for existing callers.
 */
export function Popconfirm({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  placement = 'bottom',
  onConfirm,
  onCancel,
  className,
}: PopconfirmProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // useFocusTrap below pushes panelRef (not containerRef) onto the layer
  // stack — the top-of-stack check needs the same ref or it never
  // matches, silently disabling Escape/outside-click.
  useDismiss({ active: open, ref: containerRef, layerRef: panelRef, onDismiss: () => setOpen(false) });
  useFocusTrap(panelRef, { active: open, onEscape: () => setOpen(false), handleEscape: false });

  function handleCancel() {
    setOpen(false);
    onCancel?.();
  }

  function handleConfirm() {
    setOpen(false);
    onConfirm();
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : 'Confirm action'}
          tabIndex={-1}
          data-state="open"
          className={cn(
            'absolute z-[70] w-72 rounded-lg border border-border bg-surface-raised p-4 shadow-xl',
            'focus-visible:outline-none',
            placementClasses[placement],
            className
          )}
        >
          <div className="flex gap-2.5">
            <FontAwesomeIcon
              icon={faCircleQuestion}
              aria-hidden="true"
              className={cn('mt-0.5 h-4 w-4 shrink-0', danger ? 'text-error' : 'text-warning')}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">{title}</p>
              {description && <p className="mt-1 text-xs text-text-secondary">{description}</p>}
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>{cancelLabel}</Button>
            <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={handleConfirm}>{confirmLabel}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
