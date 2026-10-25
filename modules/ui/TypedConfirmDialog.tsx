'use client';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * TypedConfirmDialog — a confirmation that needs more than a click: the user types an exact phrase (a device's serial before a
 * release, a command's confirmation text before a reboot) and only then may confirm.
 *
 * @deprecated Use `ConfirmDialog` with `phrase` (or `confirmDialog({ phrase })`); this is a thin wrapper kept for existing callers.
 */
export type TypedConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  /** What must be typed. */
  phrase: string;
  /** The field's label ("Type REBOOT to confirm"). */
  label: string;
  confirmLabel: string;
  cancelLabel?: string;
  closeLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
};

export function TypedConfirmDialog({
  open, title, description, phrase, label, confirmLabel, cancelLabel = 'Cancel', closeLabel, danger = true, busy = false, onConfirm, onCancel, className,
}: TypedConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={description}
      tone={danger ? 'danger' : 'default'}
      phrase={phrase}
      phraseLabel={label}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      closeLabel={closeLabel}
      busy={busy}
      onConfirm={() => onConfirm()}
      onCancel={onCancel}
      className={className}
    />
  );
}
