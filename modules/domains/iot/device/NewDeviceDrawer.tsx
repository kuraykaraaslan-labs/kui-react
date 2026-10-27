'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { errorMessage, IotApiError, type CreatedDevice } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { IssuedSecretNotice } from './DeviceCredentialPanel';

/**
 * NewDeviceDrawer — "New device" (phase 01 §1.1): name, label, profile (the default one when none is chosen) and the gateway
 * flag. On success the drawer shows the new access token once (`IssuedSecretNotice`) and a link to the device; the token lives
 * only in this open drawer's state and is gone when it closes.
 *
 * A host may offer other ways to add a device (`choices`: claiming a vendor's device with the code on its screen, …). The drawer
 * then opens on a choice between them and "Other device" (the form above, only with `canCreate`); a single way opens at once.
 * A host choice draws its own screen inside the drawer; "Back" returns to the choice.
 */
export type DeviceAddChoice = {
  id: string;
  label: string;
  description?: string;
  /** The choice's screen in the drawer: `close` closes the drawer, `added` tells the list a device was added. */
  render: (ctx: { close: () => void; added: () => void }) => React.ReactNode;
};

export type NewDeviceDrawerProps = {
  open: boolean;
  profiles: ReadonlyArray<{ id: string; name: string }>;
  deviceHref: (deviceId: string) => string;
  onClose: () => void;
  onCreated?: (created: CreatedDevice['device']) => void;
  /** A host choice added a device (the list re-reads). */
  onAdded?: () => void;
  /** The host's ways to add a device, offered before "Other device". */
  choices?: readonly DeviceAddChoice[];
  /** Whether "Other device" (the create form) is offered. Default true. */
  canCreate?: boolean;
};

/** The create form's id among the choices. */
const OTHER = '_other';

export function NewDeviceDrawer({ open, profiles, deviceHref, onClose, onCreated, onAdded, choices = [], canCreate = true }: NewDeviceDrawerProps) {
  const api = useIotAdapter().devices;
  const notify = useIotNotify();
  const { m } = useIotText();
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [profileId, setProfileId] = useState('');
  const [gateway, setGateway] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CreatedDevice | null>(null);
  const ways = [...choices.map((c) => c.id), ...(canCreate ? [OTHER] : [])];
  // with one way there is nothing to choose: it opens at once
  const [picked, setPicked] = useState<string | null>(ways.length === 1 ? ways[0] : null);
  const choice = choices.find((c) => c.id === picked);

  function close() {
    setCreated(null); // the secret leaves with the drawer
    onClose();
  }
  function back() {
    setCreated(null);
    setError(null);
    setFieldErrors({});
    setPicked(null);
  }

  async function submit() {
    if (!api?.create) return;
    if (!name.trim()) { setFieldErrors({ name: m.newDevice.nameRequired }); return; }
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api.create({ name: name.trim(), label: label.trim() || null, profileId: profileId || undefined, isGateway: gateway });
      setCreated(res);
      notify({ tone: 'success', message: m.newDevice.created });
      onCreated?.(res.device);
    } catch (e) {
      if (e instanceof IotApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      setError(errorMessage(e, m.newDevice.failed));
    } finally {
      setBusy(false);
    }
  }

  const backButton = ways.length > 1
    ? <Button variant="ghost" size="sm" className="mr-auto" onClick={back}>{m.newDevice.back}</Button>
    : null;

  if (picked === null || choice) {
    return (
      <Drawer
        open={open}
        onClose={close}
        title={choice ? choice.label : m.newDevice.title}
        closeLabel={m.common.close}
        footer={(
          <div className="flex justify-end gap-2">
            {choice && backButton}
            <Button variant="ghost" size="sm" onClick={close}>{choice ? m.common.close : m.common.cancel}</Button>
          </div>
        )}
      >
        {choice ? choice.render({ close, added: () => onAdded?.() }) : (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">{m.newDevice.choose}</p>
            <ul className="space-y-2">
              {[...choices.map((c) => ({ id: c.id, label: c.label, description: c.description })),
                ...(canCreate ? [{ id: OTHER, label: m.newDevice.other, description: m.newDevice.otherHint }] : [])].map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(c.id)}
                    className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-border bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    <span className="text-sm font-medium text-text-primary">{c.label}</span>
                    {c.description && <span className="text-xs text-text-secondary">{c.description}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={ways.length > 1 ? m.newDevice.other : m.newDevice.title}
      closeLabel={m.common.close}
      footer={created ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close}>{m.common.close}</Button>
          <Button as="a" href={deviceHref(created.device.deviceId)} variant="primary" size="sm">{m.newDevice.open}</Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          {backButton}
          <Button variant="ghost" size="sm" onClick={close}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} onClick={() => void submit()}>{m.newDevice.create}</Button>
        </div>
      )}
    >
      {created ? (
        <div className="space-y-3">
          <p className="text-sm text-text-primary">{created.device.name}</p>
          {created.secret && <IssuedSecretNotice secret={created.secret} />}
          <p className="text-xs text-text-secondary">{m.newDevice.credentialHint}</p>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <Input id="new-device-name" label={m.newDevice.name} required maxLength={128} value={name} error={fieldErrors.name} onChange={(e) => setName(e.target.value)} />
          <Input id="new-device-label" label={m.newDevice.label} maxLength={255} value={label} error={fieldErrors.label} onChange={(e) => setLabel(e.target.value)} />
          <Select
            id="new-device-profile"
            label={m.newDevice.profile}
            value={profileId}
            error={fieldErrors.deviceProfileId}
            onChange={(e) => setProfileId(e.target.value)}
            options={[{ value: '', label: m.newDevice.defaultProfile }, ...profiles.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <Checkbox id="new-device-gateway" label={m.newDevice.gateway} checked={gateway} onChange={(e) => setGateway(e.target.checked)} />
          <p className="text-xs text-text-secondary">{m.newDevice.credentialHint}</p>
        </form>
      )}
    </Drawer>
  );
}
