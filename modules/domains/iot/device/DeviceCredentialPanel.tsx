'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faEye, faEyeSlash, faKey, faRotate, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { useIotText } from '../api/IotAdapterProvider';
import { formatDateTime } from '../format';
import type { CredentialType, DeviceConnectionInfo, DeviceCredential, IssuedSecret } from '../types/device';
import type { IotMessagesInput } from '../messages';
import { DeviceConnectionCard } from './DeviceConnectionCard';

/**
 * DeviceCredentialPanel — a device's credential without its secret: the type, the non-secret identifiers (client id,
 * username, X.509 fingerprint, subject and expiry), and "Rotate secret" behind a `ConfirmDialog`. A secret the server has just
 * issued (`secret`) is shown once in `IssuedSecretNotice`: masked until "Show", copyable, gone for good when dismissed. The
 * component never stores a secret anywhere but in the host's prop (no storage, no logging).
 *
 * With `connection` (the host's endpoints) a "Connection details" card follows: inside the one-time notice while a secret is shown
 * (its lines then carry the secret while "Show" is on), under the credential otherwise (with a placeholder).
 */
export type DeviceCredentialPanelProps = {
  credential: DeviceCredential | null;
  loading?: boolean;
  /** A secret issued by the last rotate (or create): shown once. */
  secret?: IssuedSecret | null;
  onSecretDismiss?: () => void;
  /** Present only for a viewer who may rotate (`canViewCredentials`). */
  onRotate?: () => Promise<void> | void;
  /** Where the device connects: the "Connection details" card. */
  connection?: DeviceConnectionInfo | null;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function DeviceCredentialPanel({
  credential, loading = false, secret, onSecretDismiss, onRotate, connection, locale, messages, className,
}: DeviceCredentialPanelProps) {
  const { m, locale: lang } = useIotText(messages, locale);
  const [rotating, setRotating] = useState(false);

  async function rotate() {
    if (!onRotate) return;
    setRotating(true);
    try { await onRotate(); } finally { setRotating(false); }
  }

  const rows: Array<[string, React.ReactNode]> = [];
  if (credential) {
    rows.push([m.credential.type, m.credential[credential.type] ?? credential.type]);
    if (credential.clientId) rows.push([m.credential.clientId, <code key="c" className="font-mono">{credential.clientId}</code>]);
    if (credential.username) rows.push([m.credential.username, <code key="u" className="font-mono">{credential.username}</code>]);
    if (credential.certFingerprint) rows.push([m.credential.fingerprint, <code key="f" className="break-all font-mono text-xs">{credential.certFingerprint}</code>]);
    if (credential.certSubject) rows.push([m.credential.subject, credential.certSubject]);
    if (credential.certExpiresAt) rows.push([m.credential.expires, formatDateTime(credential.certExpiresAt, { locale: lang })]);
    if (credential.createdAt) rows.push([m.credential.created, formatDateTime(credential.createdAt, { locale: lang })]);
    if (credential.rotatedAt) rows.push([m.credential.rotated, formatDateTime(credential.rotatedAt, { locale: lang })]);
  }
  const canRotate = !!onRotate && !!credential && credential.type !== 'X509_CERTIFICATE';

  return (
    <section className={cn('space-y-4 rounded-xl border border-border bg-surface-raised p-4 sm:p-5', className)} aria-label={m.credential.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <FontAwesomeIcon icon={faKey} className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
          {m.credential.title}
        </h2>
        {canRotate && (
          <Button onClick={() => { void confirmDialog({ title: m.credential.rotateConfirm, message: m.credential.rotateHint, tone: 'danger', confirmLabel: m.credential.rotate, cancelLabel: m.common.cancel }).then((ok) => { if (ok) void rotate(); }); }} variant="outline" size="sm" loading={rotating} iconLeft={<FontAwesomeIcon icon={faRotate} className="h-3 w-3" aria-hidden="true" />}>
                {m.credential.rotate}
              </Button>
        )}
      </div>

      {secret && (
        <IssuedSecretNotice secret={secret} onDismiss={onSecretDismiss} messages={messages} connection={connection}
          credentialType={credential?.type} username={credential?.username} clientId={credential?.clientId} />
      )}

      {loading ? (
        <SkeletonText lines={3} label={m.common.loading} />
      ) : !credential ? (
        <p className="text-sm text-text-secondary">{m.credential.none}</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          {rows.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-text-secondary">{term}</dt>
              <dd className="min-w-0 text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-xs text-text-secondary">
        {credential?.type === 'X509_CERTIFICATE' ? m.credential.x509Note : m.credential.neverShown}
      </p>
      {connection && !secret && credential && (
        <DeviceConnectionCard info={connection} credentialType={credential.type} username={credential.username} clientId={credential.clientId} messages={messages} />
      )}
    </section>
  );
}

/**
 * IssuedSecretNotice — a secret shown exactly once: masked by default, "Show" / "Copy", a warning that it cannot be read
 * back, and "I have stored it", after which the host drops it. Also used by the "New device" dialog. With `connection` it carries the
 * "Connection details" card, whose lines hold the secret only while it is shown.
 */
export function IssuedSecretNotice({ secret, onDismiss, messages, connection, credentialType, username, clientId, className }: {
  secret: IssuedSecret;
  onDismiss?: () => void;
  messages?: IotMessagesInput;
  connection?: DeviceConnectionInfo | null;
  credentialType?: CredentialType;
  username?: string | null;
  clientId?: string | null;
  className?: string;
}) {
  const { m } = useIotText(messages);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const value = 'token' in secret ? secret.token : secret.password;
  const label = 'token' in secret ? m.credential.token : m.credential.password;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShown(true); // no clipboard: show it so it can be copied by hand
    }
  }

  return (
    <div role="status" className={cn('space-y-2 rounded-lg border border-warning bg-warning-subtle p-3', className)}>
      <p className="flex items-center gap-2 text-sm font-semibold text-warning-fg">
        <FontAwesomeIcon icon={faTriangleExclamation} className="h-3.5 w-3.5" aria-hidden="true" />
        {m.credential.secretTitle}: {m.credential.secretOnce}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-warning-fg">{label}</span>
        <code
          data-testid="issued-secret"
          className="min-w-0 flex-1 break-all rounded border border-border bg-surface-base px-2 py-1 font-mono text-xs text-text-primary"
        >
          {shown ? value : '•'.repeat(Math.min(32, value.length))}
        </code>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setShown((s) => !s)}
          iconLeft={<FontAwesomeIcon icon={shown ? faEyeSlash : faEye} className="h-3 w-3" aria-hidden="true" />}
        >
          {shown ? m.credential.hide : m.credential.show}
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => void copy()}
          iconLeft={<FontAwesomeIcon icon={copied ? faCheck : faCopy} className="h-3 w-3" aria-hidden="true" />}
        >
          {copied ? m.common.copied : m.common.copy}
        </Button>
      </div>
      {connection && (
        <DeviceConnectionCard info={connection} credentialType={credentialType ?? ('token' in secret ? 'ACCESS_TOKEN' : 'MQTT_BASIC')}
          secret={shown ? value : null} username={username} clientId={clientId} messages={messages} />
      )}
      {onDismiss && (
        <div className="flex justify-end">
          <Button variant="primary" size="xs" onClick={onDismiss}>{m.credential.stored}</Button>
        </div>
      )}
    </div>
  );
}
