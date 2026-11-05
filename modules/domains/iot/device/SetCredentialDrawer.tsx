'use client';
import { useEffect, useRef, useState } from 'react';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { errorMessage, IotApiError, type CertificateOption, type SetCredentialInput } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime } from '../format';
import { CREDENTIAL_TYPES, type CredentialType, type DeviceCredential, type DeviceRecord, type IssuedSecret } from '../types/device';
import type { IotMessages } from '../messages';

/**
 * SetCredentialDrawer — "Set credential" on the device page's Credentials tab (NB 41-ui-fixes/22 1.1): gives the device a credential of
 * a type its profile allows (`device.allowedAuthModes`; every type when the host does not say), replacing the active one, through
 * `credentials.set`. An access token is generated; MQTT basic takes a username (1–128 printable characters, not `provision`), an
 * optional client id and an optional password (left empty: a generated one, shown once; a chosen one is never shown back, and the
 * simple strength rules are checked here, the rest by the host); X.509 picks one of the certificates the host offers
 * (`credentials.certificates`, with `canAttachCertificates`). Replacing a credential asks first, naming the device: the old one stops
 * working at once and the live session ends. The drawer cannot close while the request runs; closing it drops the draft (the password
 * too). A generated secret goes to `onIssued`, whose notice keeps it until "I have stored it".
 */
export type SetCredentialDrawerProps = {
  open: boolean;
  device: Pick<DeviceRecord, 'deviceId' | 'name' | 'serial' | 'allowedAuthModes'>;
  /** The active credential (its type is the default choice; replacing it asks first). */
  current: DeviceCredential | null;
  onClose: () => void;
  onIssued?: (result: { credential: DeviceCredential | null; secret: IssuedSecret | null }) => void;
};

/** The host's username rule: printable ASCII without spaces, 1–128 (NB `SetIotDeviceCredentialDTO`). */
export const MQTT_USERNAME = /^[\x21-\x7e]{1,128}$/;
/** The host's client id rule (protocol 01 §3). */
export const MQTT_CLIENT_ID = /^[A-Za-z0-9._:-]{1,64}$/;
export const RESERVED_MQTT_USERNAME = 'provision';
export const MIN_CHOSEN_PASSWORD = 16;
export const MAX_CHOSEN_PASSWORD = 128;

/**
 * The simple strength rules of a chosen MQTT-basic password, as the host checks them (NB `chosenPasswordProblem`): length, at least 8
 * different characters, not containing the username or client id (4 characters or more). Patterns and common passwords are the host's
 * to refuse (its answer marks the field).
 */
export function passwordProblem(password: string, ids: { username?: string; clientId?: string }, m: IotMessages['credential']): string | null {
  if (password.length < MIN_CHOSEN_PASSWORD) return m.passwordTooShort;
  if (password.length > MAX_CHOSEN_PASSWORD) return m.passwordTooLong;
  if (new Set(password).size < 8) return m.passwordTooFewDistinct;
  const lower = password.toLowerCase();
  for (const id of [ids.username, ids.clientId]) if (id && id.length >= 4 && lower.includes(id.toLowerCase())) return m.passwordContainsId;
  return null;
}

export function SetCredentialDrawer({ open, device, current, onClose, onIssued }: SetCredentialDrawerProps) {
  const api = useIotAdapter().credentials;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale, timeZone } = useIotText();
  const allowed: readonly CredentialType[] = device.allowedAuthModes?.length ? device.allowedAuthModes : device.allowedAuthModes ? [] : CREDENTIAL_TYPES;
  const initialType = (): CredentialType | '' => (current && allowed.includes(current.type) ? current.type : allowed[0] ?? '');
  const [type, setType] = useState<CredentialType | ''>(initialType);
  const [username, setUsername] = useState('');
  const [clientId, setClientId] = useState('');
  const [password, setPassword] = useState('');
  const [certificateId, setCertificateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [certificates, setCertificates] = useState<{ for: string; list: CertificateOption[] | null; error: boolean } | null>(null);
  const canPick = caps.canAttachCertificates && !!api?.certificates;
  // one submit at a time: a fast second click while the confirm is open or the request runs does nothing (41-ui-fixes/22 C11)
  const submitting = useRef(false);

  // every opening starts from the device as it is now (state adjusted while rendering, not in an effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setType(initialType()); setUsername(current?.type === 'MQTT_BASIC' ? current.username ?? '' : ''); setClientId(current?.type === 'MQTT_BASIC' ? current.clientId ?? '' : '');
      setPassword(''); setCertificateId(''); setError(null); setFieldErrors({});
    } else {
      setPassword('');
    }
  }

  // the certificates naming this device, when X.509 is chosen
  const loadCertificates = api?.certificates;
  const certKey = `${device.deviceId}|${device.serial ?? ''}`;
  useEffect(() => {
    if (!open || type !== 'X509_CERTIFICATE' || !canPick || !loadCertificates) return;
    const ctrl = new AbortController();
    loadCertificates({ deviceId: device.deviceId, serial: device.serial }, ctrl.signal).then(
      (list) => { if (!ctrl.signal.aborted) setCertificates({ for: certKey, list, error: false }); },
      () => { if (!ctrl.signal.aborted) setCertificates({ for: certKey, list: null, error: true }); },
    );
    return () => ctrl.abort();
  }, [open, type, canPick, loadCertificates, device.deviceId, device.serial, certKey]);
  const certs = certificates?.for === certKey ? certificates : null;

  function close() {
    if (busy) return;
    setPassword('');
    onClose();
  }

  function check(): SetCredentialInput | null {
    const errs: Record<string, string> = {};
    let input: SetCredentialInput | null = null;
    if (type === 'ACCESS_TOKEN') input = { type };
    else if (type === 'MQTT_BASIC') {
      const u = username.trim();
      const c = clientId.trim();
      if (!MQTT_USERNAME.test(u)) errs.username = m.credential.usernameInvalid;
      else if (u.toLowerCase() === RESERVED_MQTT_USERNAME) errs.username = m.credential.usernameReserved;
      if (c && !MQTT_CLIENT_ID.test(c)) errs.clientId = m.credential.clientIdInvalid;
      const weak = password ? passwordProblem(password, { username: u, clientId: c }, m.credential) : null;
      if (weak) errs.password = weak;
      input = { type, username: u, clientId: c || null, password: password || null };
    } else if (type === 'X509_CERTIFICATE') {
      if (!certificateId) errs.certificateId = m.credential.certificateRequired;
      input = { type, certificateId };
    }
    setFieldErrors(errs);
    return Object.keys(errs).length ? null : input;
  }

  async function submit() {
    if (!api?.set || busy || !type || submitting.current) return;
    submitting.current = true;
    try { await send(); } finally { submitting.current = false; }
  }

  async function send() {
    if (!api?.set || !type) return;
    const input = check();
    if (!input) return;
    // replacing a credential ends the device's session: say so, naming the device
    if (current) {
      const ok = await confirmDialog({
        title: fill(m.credential.setConfirm, { name: device.name }), message: m.credential.setReplaces, tone: 'danger',
        confirmLabel: m.credential.setConfirmLabel, cancelLabel: m.common.cancel,
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.set(device.deviceId, input);
      notify({ tone: 'success', message: m.credential.setOk });
      setPassword('');
      setBusy(false);
      onIssued?.(res);
      onClose();
    } catch (e) {
      if (e instanceof IotApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      setError(errorMessage(e, m.credential.setFailed));
      setBusy(false);
    }
  }

  const certOptions = (certs?.list ?? []).map((c) => ({
    value: c.id,
    label: c.expiresAt ? fill(m.credential.certificateOption, { subject: c.subject, time: formatDateTime(c.expiresAt, { locale, timeZone }) }) : c.subject,
  }));

  return (
    <Drawer
      open={open}
      onClose={close}
      title={fill(m.credential.setTitle, { name: device.name })}
      closeLabel={m.common.close}
    >
      <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <p className="text-sm text-text-secondary">{current ? m.credential.setReplaces : m.credential.setFirst}</p>
        {allowed.length === 0 ? (
          <p className="text-sm text-text-secondary">{m.credential.setNoType}</p>
        ) : (
          <Select
            id="set-credential-type"
            label={m.credential.type}
            value={type}
            error={fieldErrors.type}
            onChange={(e) => { setType(e.target.value as CredentialType); setFieldErrors({}); setError(null); }}
            options={allowed.map((t) => ({ value: t, label: m.credential[t] }))}
          />
        )}
        {type === 'ACCESS_TOKEN' && <p className="text-xs text-text-secondary">{m.credential.neverShown}</p>}
        {type === 'MQTT_BASIC' && (
          <>
            <Input id="set-credential-username" label={m.credential.username} required maxLength={128} autoComplete="off" spellCheck={false}
              hint={m.credential.usernameHint} value={username} error={fieldErrors.username} onChange={(e) => setUsername(e.target.value)} />
            <Input id="set-credential-client" label={m.credential.clientIdOptional} maxLength={64} autoComplete="off" spellCheck={false}
              hint={m.credential.clientIdHint} value={clientId} error={fieldErrors.clientId} onChange={(e) => setClientId(e.target.value)} />
            <Input id="set-credential-password" type="password" label={m.credential.passwordOptional} maxLength={MAX_CHOSEN_PASSWORD} autoComplete="new-password"
              hint={m.credential.passwordHint} value={password} error={fieldErrors.password} onChange={(e) => setPassword(e.target.value)} />
          </>
        )}
        {type === 'X509_CERTIFICATE' && (!canPick ? (
          <p className="text-sm text-text-secondary">{m.credential.certificatesUnavailable}</p>
        ) : certs?.error ? (
          <p role="alert" className="text-sm text-error">{m.credential.certificatesError}</p>
        ) : certs && certOptions.length === 0 ? (
          <p className="text-sm text-text-secondary">{m.credential.certificatesNone}</p>
        ) : (
          <Select
            id="set-credential-certificate"
            label={m.credential.certificate}
            hint={m.credential.certificateHint}
            placeholder={certs ? undefined : m.common.loading}
            value={certificateId}
            error={fieldErrors.certificateId}
            disabled={!certs}
            onChange={(e) => setCertificateId(e.target.value)}
            options={[{ value: '', label: '—' }, ...certOptions]}
          />
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={close} disabled={busy}>{m.common.cancel}</Button>
          <Button type="submit" variant="primary" size="sm" loading={busy} disabled={busy || !type || (type === 'X509_CERTIFICATE' && !canPick)}>
            {m.credential.set}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
