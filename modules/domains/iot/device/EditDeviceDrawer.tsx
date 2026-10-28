'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { errorMessage, IotApiError, type UpdateDeviceInput } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import type { DeviceRecord } from '../types/device';

/**
 * EditDeviceDrawer — "Edit device" on the device page: name, label and type, through `devices.update` (only the fields that changed are
 * sent). The profile, the gateway flag and the status are not here: a profile change moves the device's online rule and its keys, so it
 * stays a deliberate act of its own. A new name ends a connected device's session (the host kicks it; it reconnects by itself), which the
 * drawer says once the name is edited. Closing the drawer drops the draft.
 */
export type EditDeviceDrawerProps = {
  open: boolean;
  device: Pick<DeviceRecord, 'deviceId' | 'name' | 'label' | 'type'>;
  onClose: () => void;
  /** The device after the save, as the host answered it. */
  onSaved?: (device: DeviceRecord) => void;
};

export function EditDeviceDrawer({ open, device, onClose, onSaved }: EditDeviceDrawerProps) {
  const api = useIotAdapter().devices;
  const notify = useIotNotify();
  const { m } = useIotText();
  const [name, setName] = useState(device.name);
  const [label, setLabel] = useState(device.label ?? '');
  const [type, setType] = useState(device.type ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // every opening starts from the device as it is now (state adjusted while rendering, not in an effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(device.name); setLabel(device.label ?? ''); setType(device.type ?? '');
      setError(null); setFieldErrors({});
    }
  }

  async function submit() {
    if (!api?.update) return;
    if (!name.trim()) { setFieldErrors({ name: m.editDevice.nameRequired }); return; }
    const patch: UpdateDeviceInput = {};
    if (name.trim() !== device.name) patch.name = name.trim();
    if ((label.trim() || null) !== (device.label || null)) patch.label = label.trim() || null;
    if ((type.trim() || null) !== (device.type || null)) patch.type = type.trim() || null;
    if (!Object.keys(patch).length) { onClose(); return; }
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const saved = await api.update(device.deviceId, patch);
      notify({ tone: 'success', message: m.editDevice.saved });
      onSaved?.(saved);
      onClose();
    } catch (e) {
      if (e instanceof IotApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      setError(errorMessage(e, m.editDevice.failed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={m.editDevice.title}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} onClick={() => void submit()}>{m.editDevice.save}</Button>
        </div>
      )}
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <Input id="edit-device-name" label={m.editDevice.name} required maxLength={128} value={name} error={fieldErrors.name} onChange={(e) => setName(e.target.value)} />
        {name.trim() !== device.name && <p className="text-xs text-text-secondary">{m.editDevice.liveHint}</p>}
        <Input id="edit-device-label" label={m.editDevice.label} maxLength={255} value={label} error={fieldErrors.label} onChange={(e) => setLabel(e.target.value)} />
        <Input id="edit-device-type" label={m.editDevice.type} hint={m.editDevice.typeHint} maxLength={64} value={type} error={fieldErrors.type} onChange={(e) => setType(e.target.value)} />
      </form>
    </Drawer>
  );
}
