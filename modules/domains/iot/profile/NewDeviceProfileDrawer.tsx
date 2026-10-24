'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { blankProfileDraft, profileDraftIssues, type DeviceProfile, type ProfileTransport } from '../types/profile';
import { OnlineRuleField, type OnlineRuleValue } from './OnlineRuleField';

/**
 * NewDeviceProfileDrawer — "New profile" (phase 01 §1.4): name, description, transport and the online rule. OD-63: the online rule
 * starts EMPTY for every transport and "Create" stays disabled until one is chosen; switching the transport never picks one. Every
 * other setting takes the protocol default and is edited on the profile page that opens after the create.
 */
export type NewDeviceProfileDrawerProps = {
  open: boolean;
  transports?: readonly ProfileTransport[];
  onClose: () => void;
  onCreated?: (profile: DeviceProfile) => void;
};

export function NewDeviceProfileDrawer({ open, transports, onClose, onCreated }: NewDeviceProfileDrawerProps) {
  const api = useIotAdapter().profiles;
  const notify = useIotNotify();
  const { m } = useIotText();
  const offered = transports ?? api?.transports ?? ['MQTT', 'HTTP', 'ANY'];
  const [draft, setDraft] = useState(() => blankProfileDraft());
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const issues = profileDraftIssues(draft);
  const word = (k: string) => (issues[k] ? m.issue[issues[k]!] : fieldErrors[k]);
  const blocking = ['name', 'onlineRule', 'expectedIntervalS', 'onlineWindowFactor'].some((k) => issues[k]);

  async function submit() {
    setTouched(true);
    if (!api?.create || blocking || !draft.onlineRule) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const created = await api.create({
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        transportType: draft.transportType,
        onlineRule: draft.onlineRule,
        ...(draft.onlineRule === 'UPLINK_WINDOW' ? { expectedIntervalS: draft.expectedIntervalS, onlineWindowFactor: draft.onlineWindowFactor } : {}),
      });
      notify({ tone: 'success', message: m.newProfile.created });
      onCreated?.(created);
    } catch (e) {
      if (e instanceof IotApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      setError(errorMessage(e, m.newProfile.failed));
    } finally {
      setBusy(false);
    }
  }

  const rule: OnlineRuleValue = { onlineRule: draft.onlineRule, expectedIntervalS: draft.expectedIntervalS, onlineWindowFactor: draft.onlineWindowFactor };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={m.newProfile.title}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={blocking} onClick={() => void submit()}>{m.newProfile.create}</Button>
        </div>
      )}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <Input id="new-profile-name" label={m.newProfile.name} required maxLength={128} value={draft.name}
          error={touched || draft.name ? word('name') : undefined} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Textarea id="new-profile-description" label={m.newProfile.description} rows={2} value={draft.description ?? ''}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <Select id="new-profile-transport" label={m.newProfile.transport} value={draft.transportType}
          onChange={(e) => setDraft({ ...draft, transportType: e.target.value as ProfileTransport })}
          options={offered.map((t) => ({ value: t, label: m.transport[t] }))} />
        <OnlineRuleField
          value={rule}
          transport={draft.transportType}
          onChange={(v) => setDraft({ ...draft, ...v })}
          errors={{
            onlineRule: word('onlineRule'),
            expectedIntervalS: draft.expectedIntervalS !== null || touched ? word('expectedIntervalS') : undefined,
            onlineWindowFactor: word('onlineWindowFactor'),
          }}
        />
        <p className="text-xs text-text-secondary">{m.newProfile.defaultsHint}</p>
      </form>
    </Drawer>
  );
}
