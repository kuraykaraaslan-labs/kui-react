'use client';
import { useId, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * TypedConfirmDialog — a confirmation that needs more than a click: the user types an exact phrase (a device's serial before a
 * release, a command's confirmation text before a reboot) and only then may confirm. Stronger than `Popconfirm` for actions that
 * cannot be undone. The phrase is compared exactly (no trimming of the inside, case-sensitive); paste works.
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
  const id = useId();
  const [typed, setTyped] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped('');
  }
  const matches = typed.trim() === phrase;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      closeLabel={closeLabel}
      className={className}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" disabled={!matches || busy} loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      )}
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (matches && !busy) onConfirm(); }}>
        {description && <div className="text-sm text-text-secondary">{description}</div>}
        <label htmlFor={id} className="block text-sm font-medium text-text-primary">{label}</label>
        <input
          id={id}
          autoComplete="off"
          spellCheck={false}
          value={typed}
          aria-invalid={typed !== '' && !matches}
          onChange={(e) => setTyped(e.target.value)}
          className={cn(
            'block w-full rounded-md border bg-surface-base px-3 py-2 font-mono text-sm text-text-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            typed !== '' && !matches ? 'border-error' : 'border-border',
          )}
        />
      </form>
    </Modal>
  );
}
