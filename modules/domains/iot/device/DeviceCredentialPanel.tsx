'use client';
import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faCheck, faCopy, faEye, faEyeSlash, faKey, faPen, faRotate, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime } from '../format';
import type { CredentialType, DeviceConnectionInfo, DeviceCredential, IssuedSecret } from '../types/device';
import type { IotMessagesInput } from '../messages';
import { DeviceConnectionCard } from './DeviceConnectionCard';

/**
 * DeviceCredentialPanel — a device's credential without its secret: the type, the non-secret identifiers (client id,
 * username, X.509 fingerprint, certificate, subject and expiry), "Rotate secret" behind a `ConfirmDialog` that names the device, "Set
 * credential" (`onSet`, the host opens `SetCredentialDrawer`) and "Revoke" (`onRevoke`, behind a danger confirm naming the device: the
 * credential ends at once and the session with it). A secret the server has just issued (`secret`) is shown once in
 * `IssuedSecretNotice`: masked until "Show", copyable, gone for good when dismissed; while it waits for "I have stored it" none of the
 * actions is offered, so a second rotate cannot replace it unseen (NB 41-ui-fixes/22 2.3). A credential that could not be read is
 * `error` (with `onRetry`), never "no active credential" (4.1). The component never stores a secret anywhere but in the host's prop
 * (no storage, no logging).
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
  /** Opens "Set credential" (give the device a credential, or switch its type). */
  onSet?: () => void;
  /** Revokes the active credential (asked first here). */
  onRevoke?: () => Promise<void> | void;
  /** The device's name, for the confirms. */
  deviceName?: string;
  /** The credential could not be read: said with `onRetry`, not as "no credential". */
  error?: string | null;
  onRetry?: () => void;
  /** The page of the certificate an X.509 credential is bound to. */
  certificateHref?: (certificateId: string) => string;
  /** Where the device connects: the "Connection details" card. */
  connection?: DeviceConnectionInfo | null;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

/** A number per issued secret object, so a new secret remounts its notice (masked, not "Copied": NB 41-ui-fixes/22 N3). */
const secretIds = new WeakMap<object, number>();
let lastSecretId = 0;
function secretKey(secret: IssuedSecret): number {
  let id = secretIds.get(secret);
  if (id === undefined) { id = ++lastSecretId; secretIds.set(secret, id); }
  return id;
}

/** The marker of the history entry the leave guard pushes (its value: the guard's own id). */
const GUARD_KEY = '__iotLeaveGuard';
let lastGuardId = 0;

/**
 * While `active` (a secret shown and not stored): leaving the page asks first (NB 41-ui-fixes/22 2.3, C2).
 *  - A reload or a closed tab gets the browser's own question (`beforeunload`).
 *  - A plain click on a link that would leave the page is held and asks through the `ConfirmDialog` (`texts.message`, "Leave" /
 *    "Stay"), then goes on with the same click when the answer is yes, so the host's router still opens it.
 *  - Back and forward: a copy of the current history entry (the host router's state kept, a marker added) is pushed; going back off
 *    it asks, "Stay" puts the entry back and "Leave" goes back for real. When the guard ends (the secret is stored, the view goes away
 *    on this page) the entry is taken off again, so history holds no extra step.
 * A host router's own push from code (not a link) cannot be held.
 */
export function useLeaveGuard(active: boolean, texts: { message: string; leave: string; stay: string }): void {
  const textsRef = useRef(texts);
  useEffect(() => { textsRef.current = texts; });
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const id = ++lastGuardId;
    // the click that goes on after a "yes", and a page that is leaving: neither is asked again
    let passing = false;
    let leaving = false;
    let asking = false;
    const ask = () => {
      const t = textsRef.current;
      return confirmDialog({ title: t.message, tone: 'warning', confirmLabel: t.leave, cancelLabel: t.stay });
    };
    const ours = () => (window.history.state as Record<string, unknown> | null)?.[GUARD_KEY] === id;
    const push = () => window.history.pushState({ ...((window.history.state as Record<string, unknown> | null) ?? {}), [GUARD_KEY]: id }, '', window.location.href);
    push();
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (leaving) return; e.preventDefault(); e.returnValue = ''; };
    const onClick = (e: MouseEvent) => {
      if (passing || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin === window.location.origin && to.pathname === window.location.pathname && to.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      if (asking) return;
      asking = true;
      void ask().then((ok) => {
        asking = false;
        if (!ok) return;
        leaving = true;
        passing = true;
        try { a.click(); } finally { passing = false; }
      });
    };
    const onPopState = () => {
      // back off the guard entry (forward onto it again changes nothing)
      if (leaving || ours() || asking) return;
      asking = true;
      void ask().then((ok) => {
        asking = false;
        if (ok) { leaving = true; window.history.back(); } else push();
      });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClick, true);
      // still on the guard entry (stored, or the view went away on this page): take it off; after a navigation it is not ours to pop
      if (!leaving && ours()) window.history.back();
    };
  }, [active]);
}

export function DeviceCredentialPanel({
  credential, loading = false, secret, onSecretDismiss, onRotate, onSet, onRevoke, deviceName, error, onRetry, certificateHref, connection,
  locale, messages, className,
}: DeviceCredentialPanelProps) {
  const { m, locale: lang, timeZone } = useIotText(messages, locale);
  const [rotating, setRotating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const name = deviceName ?? '';
  // one confirm at a time: a fast second click while one is open or its request runs does nothing (41-ui-fixes/22 C11)
  const acting = useRef(false);
  const at = (v: Date | string) => formatDateTime(v, { locale: lang, timeZone });

  async function confirmThen(opts: Parameters<typeof confirmDialog>[0], run: () => Promise<void>) {
    if (acting.current) return;
    acting.current = true;
    try {
      if (await confirmDialog(opts)) await run();
    } finally {
      acting.current = false;
    }
  }
  async function rotate() {
    if (!onRotate) return;
    setRotating(true);
    try { await onRotate(); } finally { setRotating(false); }
  }
  async function revoke() {
    if (!onRevoke) return;
    setRevoking(true);
    try { await onRevoke(); } finally { setRevoking(false); }
  }

  const rows: Array<[string, React.ReactNode]> = [];
  if (credential) {
    rows.push([m.credential.type, m.credential[credential.type] ?? credential.type]);
    if (credential.clientId) rows.push([m.credential.clientId, <code key="c" className="font-mono">{credential.clientId}</code>]);
    if (credential.username) rows.push([m.credential.username, <code key="u" className="font-mono">{credential.username}</code>]);
    if (credential.certFingerprint) rows.push([m.credential.fingerprint, <code key="f" className="break-all font-mono text-xs">{credential.certFingerprint}</code>]);
    if (credential.certificateId) {
      const href = certificateHref?.(credential.certificateId);
      rows.push([m.credential.certificate, href
        ? <a key="ci" href={href} className="font-mono text-xs text-primary underline">{m.credential.openCertificate}</a>
        : <code key="ci" className="break-all font-mono text-xs">{credential.certificateId}</code>]);
    }
    if (credential.certSubject) rows.push([m.credential.subject, credential.certSubject]);
    // in the host's time zone, as the rest of the page (41-ui-fixes/22 C9)
    if (credential.certExpiresAt) rows.push([m.credential.expires, at(credential.certExpiresAt)]);
    if (credential.createdAt) rows.push([m.credential.created, at(credential.createdAt)]);
    if (credential.rotatedAt) rows.push([m.credential.rotated, at(credential.rotatedAt)]);
  }
  // a secret waiting for "I have stored it" holds every action back: a rotate or a switch now would replace it unseen
  const waiting = !!secret;
  const canRotate = !waiting && !error && !!onRotate && !!credential && credential.type !== 'X509_CERTIFICATE';
  const canSet = !waiting && !error && !loading && !!onSet;
  const canRevoke = !waiting && !error && !!onRevoke && !!credential;

  return (
    <section className={cn('space-y-4 rounded-xl border border-border bg-surface-raised p-4 sm:p-5', className)} aria-label={m.credential.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <FontAwesomeIcon icon={faKey} className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
          {m.credential.title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {waiting && <p className="text-xs text-text-secondary">{m.credential.storeFirst}</p>}
          {canRotate && (
            <Button onClick={() => { void confirmThen({ title: fill(m.credential.rotateConfirm, { name }), message: m.credential.rotateHint, tone: 'danger', confirmLabel: m.credential.rotate, cancelLabel: m.common.cancel }, rotate); }} variant="outline" size="sm" loading={rotating} iconLeft={<FontAwesomeIcon icon={faRotate} className="h-3 w-3" aria-hidden="true" />}>
              {m.credential.rotate}
            </Button>
          )}
          {canSet && (
            <Button onClick={onSet} variant="outline" size="sm" iconLeft={<FontAwesomeIcon icon={faPen} className="h-3 w-3" aria-hidden="true" />}>
              {m.credential.set}
            </Button>
          )}
          {canRevoke && (
            <Button onClick={() => { void confirmThen({ title: fill(m.credential.revokeConfirm, { name }), message: m.credential.revokeHint, tone: 'danger', confirmLabel: m.credential.revoke, cancelLabel: m.common.cancel }, revoke); }} variant="ghost" size="sm" loading={revoking} iconLeft={<FontAwesomeIcon icon={faBan} className="h-3 w-3" aria-hidden="true" />}>
              {m.credential.revoke}
            </Button>
          )}
        </div>
      </div>

      {secret && (
        <IssuedSecretNotice key={secretKey(secret)} secret={secret} onDismiss={onSecretDismiss} messages={messages} connection={connection}
          credentialType={credential?.type} username={credential?.username} clientId={credential?.clientId} />
      )}

      {loading ? (
        <SkeletonText lines={3} label={m.common.loading} />
      ) : error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-error">
          {error}
          {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{m.common.retry}</Button>}
        </div>
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
      {!error && (
        <p className="text-xs text-text-secondary">
          {credential?.type === 'X509_CERTIFICATE' ? m.credential.x509Note : m.credential.neverShown}
        </p>
      )}
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
