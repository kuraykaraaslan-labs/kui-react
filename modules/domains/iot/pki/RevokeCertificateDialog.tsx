'use client';
import { useId, useState } from 'react';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Select } from '@/modules/ui/Select';
import { fillText, mergePkiMessages, type PkiMessagesInput } from './messages';
import type { DeviceCertificate, RevokeReason } from './types';

/** The reasons a person revokes with; `superseded` is the renewal's own (NB refuses it on the revoke route). */
export const REVOKE_REASONS: readonly RevokeReason[] = ['keyCompromise', 'cessationOfOperation', 'unspecified'];

export type RevokeCertificateDialogProps = {
  open: boolean;
  certificate: Pick<DeviceCertificate, 'certificateId' | 'deviceSerial' | 'subjectCn'> | null;
  /** The host revokes (NB: `POST …/certificates/[id]/revoke { reason }`) and closes the dialog when it is done. */
  onConfirm: (reason: RevokeReason) => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string;
  messages?: PkiMessagesInput;
};

/**
 * RevokeCertificateDialog — the one way to revoke a device certificate: the design system's `ConfirmDialog` (danger) with the reason as a
 * select (Key compromise by default, the safe assumption for a certificate someone wants gone; Device retired; Unspecified) and the
 * device serial typed again, since a revocation cannot be undone and disconnects the device at once.
 */
export function RevokeCertificateDialog({ open, certificate, onConfirm, onCancel, busy, error, messages }: RevokeCertificateDialogProps) {
  const all = mergePkiMessages(messages);
  const m = all.revoke;
  const reasonId = useId();
  const [reason, setReason] = useState<RevokeReason>('keyCompromise');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReason('keyCompromise');
  }
  const serial = certificate?.deviceSerial ?? certificate?.subjectCn ?? '';
  return (
    <ConfirmDialog
      open={open}
      title={fillText(m.title, { serial })}
      message={m.body}
      tone="danger"
      confirmLabel={m.confirm}
      cancelLabel={all.common.cancel}
      details={(
        <Select
          id={reasonId}
          label={m.reason}
          hint={m.reasonHint}
          value={reason}
          onChange={(e) => setReason(e.target.value as RevokeReason)}
          options={REVOKE_REASONS.map((r) => ({ value: r, label: all.reason[r] }))}
          disabled={busy}
        />
      )}
      phrase={serial}
      phraseLabel={fillText(m.phrase, { serial })}
      busy={busy}
      error={error}
      onConfirm={() => onConfirm(reason)}
      onCancel={onCancel}
    />
  );
}
