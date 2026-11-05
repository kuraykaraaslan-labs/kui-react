'use client';
import { useEffect, useRef, useState } from 'react';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { errorMessage, IotApiError, type UpdateDeviceInput } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { DeviceRecord } from '../types/device';

/**
 * EditDeviceDrawer — "Edit device", on the device page and as a row action of the device list: name, label, type, profile, status
 * (active or disabled) and the additional info (a small JSON object), through `devices.update` (only the fields that changed are sent).
 * A change that ends a connected device's session (a new name, a new profile, disabling it) asks first through the ConfirmDialog; the
 * device connects again by itself unless it is disabled. A quarantined device keeps its status (it is approved with Activate). The
 * gateway flag is not here. The profile list comes from `profiles` when the host page already has it, else from `profiles.options`.
 * Closing the drawer drops the draft; nothing closes it while the save runs, and Save sends once (NB 41-ui-fixes/22 2.1). A host refuses
 * a profile that does not allow the device's credential type (NB: 409 `auth_mode_not_allowed`), shown at the top. The draft is compared with
 * the device as it was when the drawer opened, so a re-read of the page while it is open never makes Save undo someone else's change;
 * when the device changed underneath, the drawer says so (41-ui-fixes/22 C11, C12).
 */
export type EditDeviceDrawerProps = {
  open: boolean;
  device: Pick<DeviceRecord, 'deviceId' | 'name' | 'label' | 'type' | 'deviceProfileId' | 'profileName' | 'status' | 'additionalInfo' | 'online'>;
  /** The profiles to pick from, when the page has them already. */
  profiles?: Array<{ id: string; name: string }>;
  onClose: () => void;
  /** The device after the save, as the host answered it. */
  onSaved?: (device: DeviceRecord) => void;
};

/** The additional info as the text area shows it: pretty JSON, nothing for an empty object. */
function infoText(info: Record<string, unknown> | null | undefined): string {
  return info && Object.keys(info).length ? JSON.stringify(info, null, 2) : '';
}

/** The text area's content as the value to send; `undefined` when it is not a JSON object, `null` for an empty text (no info). */
function parseInfo(text: string): Record<string, unknown> | null | undefined {
  if (!text.trim()) return null;
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export function EditDeviceDrawer({ open, device, profiles: profilesProp, onClose, onSaved }: EditDeviceDrawerProps) {
  const adapter = useIotAdapter();
  const api = adapter.devices;
  const notify = useIotNotify();
  const { m } = useIotText();
  const [name, setName] = useState(device.name);
  const [label, setLabel] = useState(device.label ?? '');
  const [type, setType] = useState(device.type ?? '');
  const [profileId, setProfileId] = useState(device.deviceProfileId);
  const [status, setStatus] = useState<'ACTIVE' | 'DISABLED'>(device.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE');
  const [info, setInfo] = useState(infoText(device.additionalInfo));
  const [loaded, setLoaded] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const profiles = profilesProp ?? loaded;
  // the device as it was when the drawer opened: what the draft is compared with
  const [base, setBase] = useState(device);
  const quarantined = base.status === 'QUARANTINED';
  const hasInfo = base.additionalInfo !== undefined;
  // one save at a time: a fast second click while the confirm is open or the request runs does nothing
  const submitting = useRef(false);

  // every opening starts from the device as it is now (state adjusted while rendering, not in an effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBase(device);
      setName(device.name); setLabel(device.label ?? ''); setType(device.type ?? '');
      setProfileId(device.deviceProfileId); setStatus(device.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'); setInfo(infoText(device.additionalInfo));
      setError(null); setFieldErrors({});
    }
  }

  // the profile list, when the page did not hand it over
  const loadOptions = adapter.profiles?.options;
  useEffect(() => {
    if (!open || profilesProp || !loadOptions) return;
    const ctrl = new AbortController();
    void loadOptions(ctrl.signal).then((list) => { if (!ctrl.signal.aborted) setLoaded(list); }).catch(() => undefined);
    return () => ctrl.abort();
  }, [open, profilesProp, loadOptions]);

  function close() {
    if (busy) return;
    onClose();
  }

  async function submit() {
    if (!api?.update || busy || submitting.current) return;
    submitting.current = true;
    try { await save(); } finally { submitting.current = false; }
  }

  async function save() {
    if (!api?.update) return;
    const device = base;
    if (!name.trim()) { setFieldErrors({ name: m.editDevice.nameRequired }); return; }
    const patch: UpdateDeviceInput = {};
    if (name.trim() !== device.name) patch.name = name.trim();
    if ((label.trim() || null) !== (device.label || null)) patch.label = label.trim() || null;
    if ((type.trim() || null) !== (device.type || null)) patch.type = type.trim() || null;
    if (profileId && profileId !== device.deviceProfileId) patch.profileId = profileId;
    if (!quarantined && status !== (device.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE')) patch.status = status;
    if (hasInfo && info.trim() !== infoText(device.additionalInfo)) {
      const parsed = parseInfo(info);
      if (parsed === undefined) { setFieldErrors({ additionalInfo: m.editDevice.additionalInfoInvalid }); return; }
      patch.additionalInfo = parsed;
    }
    if (!Object.keys(patch).length) { onClose(); return; }
    // a new name, a new profile or disabling ends the device's live session: say so before it happens
    const disables = patch.status === 'DISABLED';
    if (disables || ((patch.name !== undefined || patch.profileId !== undefined) && device.online !== false)) {
      const ok = await confirmDialog({
        title: fill(disables ? m.editDevice.confirmDisableTitle : m.editDevice.confirmTitle, { name: device.name }),
        message: disables ? m.editDevice.confirmDisable : m.editDevice.confirmKick,
        tone: disables ? 'danger' : 'warning',
        confirmLabel: disables ? m.editDevice.confirmDisableLabel : m.editDevice.confirmSave,
        cancelLabel: m.common.cancel,
      });
      if (!ok) return;
    }
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

  const profileOptions = profiles.some((p) => p.id === base.deviceProfileId)
    ? profiles.map((p) => ({ value: p.id, label: p.name }))
    : [{ value: base.deviceProfileId, label: base.profileName ?? base.deviceProfileId }, ...profiles.map((p) => ({ value: p.id, label: p.name }))];
  // changed underneath while open (another member, an earlier tab): Save sends only this draft's own changes
  const changed = open && (device.name !== base.name || (device.label ?? null) !== (base.label ?? null) || (device.type ?? null) !== (base.type ?? null)
    || device.deviceProfileId !== base.deviceProfileId || device.status !== base.status || infoText(device.additionalInfo) !== infoText(base.additionalInfo));

  return (
    <Drawer
      open={open}
      onClose={close}
      title={m.editDevice.title}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close} disabled={busy}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={busy} onClick={() => void submit()}>{m.editDevice.save}</Button>
        </div>
      )}
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        {changed && <p role="status" className="text-xs text-warning-fg">{m.editDevice.changedUnderneath}</p>}
        <Input id="edit-device-name" label={m.editDevice.name} required maxLength={128} value={name} error={fieldErrors.name} onChange={(e) => setName(e.target.value)} />
        {name.trim() !== base.name && <p className="text-xs text-text-secondary">{m.editDevice.liveHint}</p>}
        <Input id="edit-device-label" label={m.editDevice.label} maxLength={255} value={label} error={fieldErrors.label} onChange={(e) => setLabel(e.target.value)} />
        <Input id="edit-device-type" label={m.editDevice.type} hint={m.editDevice.typeHint} maxLength={64} value={type} error={fieldErrors.type} onChange={(e) => setType(e.target.value)} />
        <Select
          id="edit-device-profile"
          label={m.editDevice.profile}
          hint={m.editDevice.profileHint}
          value={profileId}
          error={fieldErrors.deviceProfileId}
          onChange={(e) => setProfileId(e.target.value)}
          options={profileOptions}
        />
        {quarantined ? (
          <p className="text-xs text-text-secondary">{m.editDevice.quarantinedHint}</p>
        ) : (
          <Select
            id="edit-device-status"
            label={m.editDevice.status}
            hint={m.editDevice.statusHint}
            value={status}
            error={fieldErrors.status}
            onChange={(e) => setStatus(e.target.value === 'DISABLED' ? 'DISABLED' : 'ACTIVE')}
            options={[{ value: 'ACTIVE', label: m.editDevice.statusActive }, { value: 'DISABLED', label: m.editDevice.statusDisabled }]}
          />
        )}
        {hasInfo && (
          <Textarea
            id="edit-device-info"
            label={m.editDevice.additionalInfo}
            hint={m.editDevice.additionalInfoHint}
            rows={5}
            spellCheck={false}
            className="font-mono"
            value={info}
            error={fieldErrors.additionalInfo}
            onChange={(e) => setInfo(e.target.value)}
          />
        )}
      </form>
    </Drawer>
  );
}
