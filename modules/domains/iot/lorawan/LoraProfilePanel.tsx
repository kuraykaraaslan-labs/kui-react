'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { fillText, mergeLoraMessages, type LoraMessagesInput } from './messages';
import type { LoraCodecOption, LoraProfileSettings, LoraProfileView } from './types';

/**
 * LoraProfilePanel — the LoRaWAN tab of a device profile (NB iot_lorawan 08 §8.1, 13 §13.1 `LoraProfileSettingsPanel`; kui-react iot 10.6):
 * one form, plain headings, no accordion: radio (region EU868 only in this release, OD-55; LoRaWAN version; class; RX1 delay, 5 s by
 * default, OD-56; ADR and its data-rate range; the de-duplication window), decoding (the profile's codec, used by its devices on
 * Automatic, D306; the radio values on every message), joining (any JoinEUI; the shared AppKey, write-only: set, replace or remove, never
 * shown), and the profile's online rule read-only (OD-57 / OD-63: it is chosen in the profile's own Online status). The host saves only
 * what changed (`onSave`, NB `PUT …/profiles/[id]/settings`). A profile that is not a LoRaWAN profile (`view` null) shows one line.
 */
export type LoraProfileChange = Partial<LoraProfileSettings> & { sharedAppKey?: string | null };

export type LoraProfilePanelProps = {
  view: LoraProfileView | null;
  codecOptions: readonly LoraCodecOption[];
  onSave?: (change: LoraProfileChange) => Promise<void>;
  /** The profile's online rule in words (the host's names for ON_CONNECT / UPLINK_WINDOW / LAST_SEEN_ONLY). */
  onlineRuleLabel?: (rule: string) => string;
  loading?: boolean;
  error?: string | null;
  messages?: LoraMessagesInput;
};

const KEY = /^[0-9A-Fa-f]{32}$/;

/** What changed between the stored settings and the form (only those fields are sent). Pure. */
export function profileChange(stored: LoraProfileSettings, form: LoraProfileSettings): Partial<LoraProfileSettings> {
  const out: Partial<LoraProfileSettings> = {};
  for (const k of Object.keys(form) as Array<keyof LoraProfileSettings>) if (form[k] !== stored[k]) (out as Record<string, unknown>)[k] = form[k];
  return out;
}

export function LoraProfilePanel({ view, codecOptions, onSave, onlineRuleLabel, loading, error, messages }: LoraProfilePanelProps) {
  const all = mergeLoraMessages(messages);
  const m = all.profileTab;
  const [form, setForm] = useState<LoraProfileSettings | null>(view?.settings ?? null);
  const [key, setKey] = useState('');
  const [removeKey, setRemoveKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // the two number fields are kept as typed (a person clears one and types again); they are checked on save, never clamped while typing
  const [rx1Text, setRx1Text] = useState(String(view?.settings.rx1DelayS ?? ''));
  const [dedupText, setDedupText] = useState(String(view?.settings.dedupMs ?? ''));
  const [seen, setSeen] = useState(view);
  if (view !== seen) {
    setSeen(view); setForm(view?.settings ?? null); setKey(''); setRemoveKey(false);
    setRx1Text(String(view?.settings.rx1DelayS ?? '')); setDedupText(String(view?.settings.dedupMs ?? ''));
  }
  if (error) return <Callout variant="danger">{error}</Callout>;
  if (loading && !view) return <p className="text-sm text-text-secondary">{all.common.loading}</p>;
  if (!view || !form) return <Callout variant="note">{m.notLora}</Callout>;
  const set = <K extends keyof LoraProfileSettings>(k: K, v: LoraProfileSettings[K]) => { setForm((f) => (f ? { ...f, [k]: v } : f)); setSaved(false); };
  const drBad = form.minDr > form.maxDr;
  const rx1 = Number(rx1Text);
  const dedup = Number(dedupText);
  const rx1Bad = !(Number.isInteger(rx1) && rx1 >= 1 && rx1 <= 15);
  const dedupBad = !(Number.isInteger(dedup) && dedup >= 50 && dedup <= 1000);
  const keyBad = key !== '' && !KEY.test(key.replace(/\s/g, ''));
  const dr = Array.from({ length: 6 }, (_, i) => ({ value: String(i), label: `DR${i}` }));
  const disabled = !onSave;
  const options = codecOptions.some((o) => o.value === form.codecId) ? codecOptions : [...codecOptions, { value: form.codecId, label: form.codecId }];
  return (
    <form className="flex max-w-3xl flex-col gap-6" noValidate onSubmit={(e) => {
      e.preventDefault();
      if (!onSave || drBad || keyBad || rx1Bad || dedupBad) return;
      const change: LoraProfileChange = { ...profileChange(view.settings, { ...form, rx1DelayS: rx1, dedupMs: dedup }), ...(key ? { sharedAppKey: key.replace(/\s/g, '').toLowerCase() } : removeKey ? { sharedAppKey: null } : {}) };
      setBusy(true); setSaveError(null); setSaved(false);
      onSave(change).then(() => { setSaved(true); setKey(''); setRemoveKey(false); }, (err: unknown) => setSaveError(err instanceof Error ? err.message : String(err))).finally(() => setBusy(false));
    }}>
      <section className="grid gap-4 sm:grid-cols-2">
        <h3 className="text-sm font-semibold text-text-primary sm:col-span-2">{m.radio}</h3>
        <Select id="lora-profile-region" label={m.region} options={[{ value: 'EU868', label: all.gatewayForm.regionEu868 }]} value={form.region} disabled />
        <Select id="lora-profile-mac" label={m.macVersion} options={['1.0.2', '1.0.3', '1.0.4'].map((x) => ({ value: x, label: x }))} value={form.macVersion} disabled={disabled}
          onChange={(e) => set('macVersion', e.target.value as LoraProfileSettings['macVersion'])} />
        <Select id="lora-profile-class" label={m.class} options={[{ value: 'A', label: all.deviceForm.classA }, { value: 'C', label: all.deviceForm.classC }]} value={form.class} disabled={disabled}
          onChange={(e) => set('class', e.target.value as LoraProfileSettings['class'])} />
        <Input id="lora-profile-rx1" type="number" min={1} max={15} label={m.rx1Delay} hint={m.rx1DelayHint} value={rx1Text} disabled={disabled}
          error={rx1Bad ? m.rx1DelayInvalid : undefined} onChange={(e) => { setRx1Text(e.target.value); setSaved(false); }} />
        <div className="sm:col-span-2"><Checkbox id="lora-profile-adr" label={m.adr} checked={form.adrEnabled} disabled={disabled} onChange={(e) => set('adrEnabled', e.target.checked)} /></div>
        <Select id="lora-profile-mindr" label={m.minDr} options={dr} value={String(form.minDr)} disabled={disabled || !form.adrEnabled} error={drBad ? m.drInvalid : undefined}
          onChange={(e) => set('minDr', Number(e.target.value))} />
        <Select id="lora-profile-maxdr" label={m.maxDr} options={dr} value={String(form.maxDr)} disabled={disabled || !form.adrEnabled}
          onChange={(e) => set('maxDr', Number(e.target.value))} />
        <Input id="lora-profile-dedup" type="number" min={50} max={1000} label={m.dedup} hint={m.dedupHint} value={dedupText} disabled={disabled}
          error={dedupBad ? m.dedupInvalid : undefined} onChange={(e) => { setDedupText(e.target.value); setSaved(false); }} />
      </section>
      <section className="grid gap-4">
        <h3 className="text-sm font-semibold text-text-primary">{m.decoding}</h3>
        <Select id="lora-profile-codec" label={all.choice.label} hint={all.choice.hint} options={options as LoraCodecOption[]} value={form.codecId} searchable disabled={disabled}
          onChange={(e) => set('codecId', e.target.value)} />
        <Checkbox id="lora-profile-radiokeys" label={m.radioKeys} checked={form.storeRadioKeys} disabled={disabled} onChange={(e) => set('storeRadioKeys', e.target.checked)} />
      </section>
      <section className="grid gap-4">
        <h3 className="text-sm font-semibold text-text-primary">{m.joining}</h3>
        <Checkbox id="lora-profile-anyjoin" label={m.anyJoinEui} checked={form.anyJoinEui} disabled={disabled} onChange={(e) => set('anyJoinEui', e.target.checked)} />
        <p className="text-sm text-text-secondary">{view.hasSharedAppKey ? m.sharedKeySet : m.sharedKeyNone}</p>
        {!disabled && (
          <>
            <Input id="lora-profile-key" type="password" autoComplete="off" label={m.sharedKeyNew} value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); }}
              error={keyBad ? m.sharedKeyInvalid : undefined} className="font-mono" />
            {view.hasSharedAppKey && <Checkbox id="lora-profile-key-remove" label={m.sharedKeyRemove} checked={removeKey} disabled={!!key} onChange={(e) => setRemoveKey(e.target.checked)} />}
          </>
        )}
      </section>
      <section className="space-y-1">
        <h3 className="text-sm font-semibold text-text-primary">{m.online}</h3>
        <p className="text-sm text-text-secondary">{view.onlineRule ? fillText(m.onlineRule, { rule: onlineRuleLabel?.(view.onlineRule) ?? view.onlineRule }) : m.onlineNone}</p>
      </section>
      {saveError && <Callout variant="danger">{saveError}</Callout>}
      {onSave && (
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-success-fg">{m.saved}</span>}
          <Button type="submit" loading={busy} disabled={drBad || keyBad || rx1Bad || dedupBad}>{m.save}</Button>
        </div>
      )}
    </form>
  );
}
