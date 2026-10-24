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
 */
export type NewDeviceDrawerProps = {
  open: boolean;
  profiles: ReadonlyArray<{ id: string; name: string }>;
  deviceHref: (deviceId: string) => string;
  onClose: () => void;
  onCreated?: (created: CreatedDevice['device']) => void;
};

export function NewDeviceDrawer({ open, profiles, deviceHref, onClose, onCreated }: NewDeviceDrawerProps) {
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

  function close() {
    setCreated(null); // the secret leaves with the drawer
    onClose();
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

  return (
    <Drawer
      open={open}
      onClose={close}
      title={m.newDevice.title}
      closeLabel={m.common.close}
      footer={created ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close}>{m.common.close}</Button>
          <Button as="a" href={deviceHref(created.device.deviceId)} variant="primary" size="sm">{m.newDevice.open}</Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
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
