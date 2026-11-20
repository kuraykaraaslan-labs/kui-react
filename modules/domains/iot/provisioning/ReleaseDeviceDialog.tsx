'use client';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { fillText, mergeProvisioningMessages, type ProvisioningMessagesInput } from './messages';

export type ReleaseDeviceDialogProps = {
  open: boolean;
  /** The device's serial, typed again to confirm. */
  serial: string;
  /** The host releases (NB: `POST …/iot/devices/[id]/release { confirmSerial, reason }`) and closes the dialog when it is done. */
  onConfirm: (reason: string | null) => void;
  onCancel: () => void;
  busy?: boolean;
  /** The refusal in words; the dialog stays open. */
  error?: string;
  /** What releasing does, one line each, when the host says more than the default lines (references, certificates). */
  effects?: string[];
  messages?: ProvisioningMessagesInput;
};

/**
 * ReleaseDeviceDialog — the owner's "Release device" (NB `iot_provisioning` 04 §4.4, OD-24): the design system's `ConfirmDialog` (danger)
 * listing what a release does, an optional reason, and the serial typed again, since the device leaves the account and only someone with
 * physical access can add it again. A factory reset never releases a device; the list says so.
 */
export function ReleaseDeviceDialog({ open, serial, onConfirm, onCancel, busy, error, effects, messages }: ReleaseDeviceDialogProps) {
  const m = mergeProvisioningMessages(messages).release;
  const lines = effects ?? [m.effectLeaves, m.effectPool, m.effectNext, m.effectReset];
  return (
    <ConfirmDialog
      open={open}
      tone="danger"
      title={m.title}
      phrase={serial}
      phraseLabel={fillText(m.typeSerial, { serial })}
      confirmLabel={m.confirm}
      cancelLabel={m.cancel}
      input={{ kind: 'text', label: m.reason, maxLength: 500 }}
      busy={busy}
      error={error}
      onCancel={onCancel}
      onConfirm={({ value }) => onConfirm(value.trim() || null)}
      message={(
        <ul className="list-disc space-y-1 pl-5">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
    />
  );
}
