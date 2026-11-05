'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DescriptionList } from '@/modules/ui/DescriptionList';
import { CertificateStatusBadge, certificateDaysLeft, renewOffered } from './CertificateStatusBadge';
import { RevokeCertificateDialog } from './RevokeCertificateDialog';
import { fillText, mergePkiMessages, type PkiMessagesInput } from './messages';
import type { DeviceCertificate, RevokeReason } from './types';

export type CertificateDetailCardProps = {
  certificate: DeviceCertificate | null;
  /**
   * Ask the device to renew (NB: `cert.renew` through the device's RPC). Offered only while `renewOffered` holds (fewer than 30 days left,
   * or a platform-generated key); asked through the ConfirmDialog. A rejected promise's message is shown in the dialog.
   */
  onRenew?: () => Promise<void>;
  /** Revoke (NB: `POST …/certificates/[id]/revoke`), through `RevokeCertificateDialog`. Left out: no Revoke button. */
  onRevoke?: (reason: RevokeReason) => Promise<void>;
  /** Extra header actions of the host. */
  actions?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  now?: number;
  locale?: string;
  messages?: PkiMessagesInput;
  className?: string;
};

const errorText = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));

/**
 * CertificateDetailCard — one device certificate: its state (`CertificateStatusBadge`), subject, issuer, serial number and fingerprint
 * (copyable), validity, key type, how it was issued, first use, when the cloud asked for a renewal, a revocation; a note when the platform
 * generated the key or the certificate is close to its end. Actions: "Renew certificate" (only when offered, NB iot_pki 03 §3.1) and
 * "Revoke", each behind the design system's confirmation. Presentational: the host loads the certificate and runs the actions.
 */
export function CertificateDetailCard({ certificate, onRenew, onRevoke, actions, loading, error, now, locale, messages, className }: CertificateDetailCardProps) {
  const all = mergePkiMessages(messages);
  const m = all.detail;
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }), [locale]);
  const [renewing, setRenewing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  // the moment the card was first drawn, when the host gives no `now` (the render stays pure)
  const [drawnAt] = useState(() => Date.now());
  const box = ['rounded-xl border border-border bg-surface-raised p-4 space-y-4', className].filter(Boolean).join(' ');

  if (!certificate) {
    return (
      <section className={box} aria-busy={loading || undefined}>
        <h3 className="text-sm font-semibold text-text-primary">{m.title}</h3>
        {error ? <Callout variant="danger">{error}</Callout> : <p className="text-sm text-text-secondary">{loading ? all.common.loading : m.none}</p>}
      </section>
    );
  }
  const c = certificate;
  const at = now ?? drawnAt;
  const left = certificateDaysLeft(c, at);
  const canRenew = !!onRenew && renewOffered(c, at);
  const canRevoke = !!onRevoke && (c.status === 'ACTIVE' || c.status === 'SUPERSEDED');
  const run = async (fn: () => Promise<void>, close: () => void) => {
    setBusy(true);
    setActionError(undefined);
    try {
      await fn();
      close();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const serial = c.deviceSerial ?? c.subjectCn;

  return (
    <section className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {m.title}
          <CertificateStatusBadge certificate={c} now={at} messages={messages} />
        </h3>
        {(canRenew || canRevoke || actions) && (
          <div className="flex flex-wrap gap-2">
            {actions}
            {canRenew && <Button variant="primary" size="sm" onClick={() => { setActionError(undefined); setRenewing(true); }}>{m.renew}</Button>}
            {canRevoke && <Button variant="outline" size="sm" onClick={() => { setActionError(undefined); setRevoking(true); }}>{m.revoke}</Button>}
          </div>
        )}
      </div>
      {error && <Callout variant="danger">{error}</Callout>}
      {c.status === 'ACTIVE' && c.serverKeygen && <Callout variant="warning">{m.serverKeygen}</Callout>}
      {c.status === 'ACTIVE' && !c.serverKeygen && left >= 0 && left < 30 && <Callout variant="info">{fillText(m.renewDue, { days: left })}</Callout>}
      <DescriptionList
        dense
        columns={2}
        messages={{ copy: all.common.copy, copied: all.common.copied }}
        items={[
          { label: m.subject, value: c.subjectCn, mono: true },
          { label: m.issuer, value: c.issuerName ?? c.issuerCaId, mono: !c.issuerName },
          { label: m.serialNumber, value: c.serialNumberHex, mono: true, copyValue: c.serialNumberHex },
          { label: m.fingerprint, value: <span className="break-all">{c.fingerprintSha256}</span>, mono: true, copyValue: c.fingerprintSha256, wide: true },
          { label: m.validity, value: fillText(m.validityValue, { from: date.format(new Date(c.notBefore)), to: date.format(new Date(c.notAfter)) }) },
          { label: m.keyAlg, value: c.keyAlg },
          { label: m.issuedVia, value: (all.issuedVia as Record<string, string>)[c.issuedVia] ?? c.issuedVia },
          { label: m.firstSeen, value: c.firstSeenAt ? dateTime.format(new Date(c.firstSeenAt)) : m.notSeen },
          { label: m.renewRequested, value: c.renewRequestedAt ? dateTime.format(new Date(c.renewRequestedAt)) : undefined, hidden: !c.renewRequestedAt },
          {
            label: m.revoked, hidden: c.status !== 'REVOKED',
            value: c.revokedAt ? fillText(m.revokedValue, { at: dateTime.format(new Date(c.revokedAt)), reason: c.revocationReason ? all.reason[c.revocationReason] ?? c.revocationReason : all.common.none }) : undefined,
          },
        ]}
      />

      <ConfirmDialog
        open={renewing}
        title={fillText(all.renew.title, { serial })}
        message={all.renew.body}
        confirmLabel={all.renew.confirm}
        cancelLabel={all.common.cancel}
        busy={busy}
        error={renewing ? actionError : undefined}
        onConfirm={() => { if (onRenew) void run(onRenew, () => setRenewing(false)); }}
        onCancel={() => setRenewing(false)}
      />
      <RevokeCertificateDialog
        open={revoking}
        certificate={c}
        busy={busy}
        error={revoking ? actionError : undefined}
        onConfirm={(reason) => { if (onRevoke) void run(() => onRevoke(reason), () => setRevoking(false)); }}
        onCancel={() => setRevoking(false)}
        messages={messages}
      />
    </section>
  );
}
