'use client';
import { useId, useMemo, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DescriptionList } from '@/modules/ui/DescriptionList';
import { Select } from '@/modules/ui/Select';
import { formatRelative } from '../format';
import { fillText, mergePkiMessages, type PkiMessagesInput } from './messages';
import type { RecoveryDecision, RecoveryRequest, RecoveryRevocationReason, RecoveryStatus } from './types';

const STATUS_VARIANT: Record<RecoveryStatus, 'warning' | 'success' | 'error' | 'neutral' | 'info'> = {
  PENDING: 'warning', APPROVED: 'info', REJECTED: 'error', USED: 'success', EXPIRED: 'neutral',
};

export function RecoveryStatusBadge({ status, messages }: { status: RecoveryStatus; messages?: PkiMessagesInput }) {
  const m = mergePkiMessages(messages).recovery;
  return <Badge variant={STATUS_VARIANT[status] ?? 'neutral'} size="sm" dot={status === 'PENDING'}>{m[status] ?? status}</Badge>;
}

export type RecoveryRequestCardProps = {
  recovery: RecoveryRequest;
  /**
   * The owner's decision (NB: `PATCH …/pki/recoveries/[recoveryId] { decision, revocationReason? }`). Left out: no buttons (the viewer may
   * not decide, or it is another tenant's request). A rejected promise's message is shown in the dialog.
   */
  onDecide?: (decision: RecoveryDecision) => Promise<void>;
  now?: number;
  locale?: string;
  messages?: PkiMessagesInput;
  className?: string;
};

/**
 * RecoveryRequestCard — a device that lost its key asks for a new certificate while its current one is still valid (NB iot_pki 03 §3.2):
 * who asks, when, until when the request stands, the key an approval is bound to and the attempts with another key (a warning: a clone may
 * be trying). A PENDING request gets Approve (the current certificate is revoked; Key compromise unless the owner knows the old key was
 * destroyed) and Reject, each behind the design system's `ConfirmDialog`.
 */
export function RecoveryRequestCard({ recovery: r, onDecide, now, locale, messages, className }: RecoveryRequestCardProps) {
  const all = mergePkiMessages(messages);
  const m = all.recovery;
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }), [locale]);
  const [open, setOpen] = useState<'approve' | 'reject' | null>(null);
  const reasonId = useId();
  const [reason, setReason] = useState<RecoveryRevocationReason>('keyCompromise');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [drawnAt] = useState(() => Date.now());
  const pending = r.status === 'PENDING' && new Date(r.expiresAt).getTime() > (now ?? drawnAt);
  const decide = async (d: RecoveryDecision) => {
    if (!onDecide) return;
    setBusy(true);
    setError(undefined);
    try {
      await onDecide(d);
      setOpen(null);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const ask = (which: 'approve' | 'reject') => { setError(undefined); setReason('keyCompromise'); setOpen(which); };

  return (
    <section className={['rounded-xl border border-border bg-surface-raised p-4 space-y-4', className].filter(Boolean).join(' ')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">{m.title}<RecoveryStatusBadge status={r.status} messages={messages} /></h3>
        {pending && onDecide && (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => ask('approve')}>{m.approve}</Button>
            <Button variant="outline" size="sm" onClick={() => ask('reject')}>{m.reject}</Button>
          </div>
        )}
      </div>
      {pending && <p className="text-sm text-text-secondary">{fillText(m.intro, { serial: r.deviceSerial })}</p>}
      {r.otherKeyAttempts > 0 && <Callout variant="warning">{fillText(m.otherKeysWarning, { count: r.otherKeyAttempts })}</Callout>}
      <DescriptionList
        dense
        columns={2}
        messages={{ copy: all.common.copy, copied: all.common.copied }}
        items={[
          { label: m.device, value: r.deviceSerial, mono: true },
          { label: m.requested, value: dateTime.format(new Date(r.requestedAt)) },
          { label: m.lastAttempt, value: formatRelative(r.lastAttemptAt, { locale, now }) },
          { label: m.expires, value: dateTime.format(new Date(r.expiresAt)), hidden: !pending && r.status !== 'APPROVED' },
          { label: m.keyId, value: r.keygen ? m.keygen : r.keyId ? <span className="break-all">{r.keyId}</span> : undefined, mono: !r.keygen, copyValue: r.keygen ? undefined : r.keyId ?? undefined, wide: true },
          { label: m.otherKeys, value: String(r.otherKeyAttempts) },
          { label: m.decided, value: r.decidedAt ? dateTime.format(new Date(r.decidedAt)) : undefined, hidden: !r.decidedAt },
        ]}
      />

      <ConfirmDialog
        open={open === 'approve'}
        title={fillText(m.approveTitle, { serial: r.deviceSerial })}
        message={m.approveBody}
        tone="warning"
        confirmLabel={m.approve}
        cancelLabel={all.common.cancel}
        details={(
          <Select
            id={reasonId}
            label={m.approveReason}
            hint={m.approveReasonHint}
            value={reason}
            onChange={(e) => setReason(e.target.value as RecoveryRevocationReason)}
            options={(['keyCompromise', 'superseded'] as const).map((v) => ({ value: v, label: all.reason[v] }))}
            disabled={busy}
          />
        )}
        busy={busy}
        error={open === 'approve' ? error : undefined}
        onConfirm={() => void decide({ decision: 'APPROVE', revocationReason: reason })}
        onCancel={() => setOpen(null)}
      />
      <ConfirmDialog
        open={open === 'reject'}
        title={fillText(m.rejectTitle, { serial: r.deviceSerial })}
        message={m.rejectBody}
        tone="danger"
        confirmLabel={m.reject}
        cancelLabel={all.common.cancel}
        busy={busy}
        error={open === 'reject' ? error : undefined}
        onConfirm={() => void decide({ decision: 'REJECT' })}
        onCancel={() => setOpen(null)}
      />
    </section>
  );
}
