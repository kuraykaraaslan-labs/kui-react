'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { mergeLoraMessages, type LoraMessagesInput } from './messages';
import type { LoraDeviceInput, LoraGatewayInput } from './types';

/**
 * The two add forms (NB iot_lorawan 13): a Basics Station gateway (name, EUI; region EU868 in this release, OD-55) and an end device
 * (name, DevEUI, JoinEUI, LoRaWAN 1.0.2–1.0.4, class A or C) that is either OTAA (its AppKey) or ABP (its DevAddr and two session keys,
 * NB D508). Identifiers are checked and normalised here (separators dropped, upper
 * case EUIs); the server checks them again. Keys are entered once: the form says they are never shown again, and nothing echoes them.
 */
const clean = (v: string) => v.replace(/[\s:-]/g, '');
export const isEui = (v: string) => /^[0-9A-Fa-f]{16}$/.test(clean(v)) && !/^(0{16}|[fF]{16})$/.test(clean(v));
export const isKey = (v: string) => /^[0-9A-Fa-f]{32}$/.test(clean(v));
/** An ABP DevAddr: 8 hex digits (the network checks its NetID prefix). */
export const isDevAddr = (v: string) => /^[0-9A-Fa-f]{8}$/.test(clean(v));

type FormProps<T> = { onSubmit: (v: T) => void; onCancel?: () => void; busy?: boolean; error?: string | null; messages?: LoraMessagesInput; idPrefix?: string };

export function LoraGatewayForm({ onSubmit, onCancel, busy, error, messages, idPrefix = 'lora-gw' }: FormProps<LoraGatewayInput>) {
  const m = mergeLoraMessages(messages).gatewayForm;
  const [name, setName] = useState('');
  const [eui, setEui] = useState('');
  const [tried, setTried] = useState(false);
  const nameErr = tried && !name.trim() ? m.nameRequired : undefined;
  const euiErr = tried && !isEui(eui) ? m.euiInvalid : undefined;
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); setTried(true); if (name.trim() && isEui(eui)) onSubmit({ name: name.trim(), eui: clean(eui).toUpperCase(), region: 'EU868' }); }}>
      <Input id={`${idPrefix}-name`} label={m.name} placeholder={m.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} error={nameErr} required maxLength={128} />
      <Input id={`${idPrefix}-eui`} label={m.eui} hint={m.euiHint} value={eui} onChange={(e) => setEui(e.target.value)} error={euiErr} required className="font-mono" />
      <Select id={`${idPrefix}-region`} label={m.region} options={[{ value: 'EU868', label: m.regionEu868 }]} value="EU868" disabled />
      <Callout variant="note">{m.note}</Callout>
      {error && <Callout variant="danger">{error}</Callout>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{mergeLoraMessages(messages).common.cancel}</Button>}
        <Button type="submit" loading={busy}>{m.submit}</Button>
      </div>
    </form>
  );
}

export function LoraDeviceForm({ onSubmit, onCancel, busy, error, messages, idPrefix = 'lora-dev' }: FormProps<LoraDeviceInput>) {
  const m = mergeLoraMessages(messages).deviceForm;
  const [v, setV] = useState({
    activation: 'OTAA' as NonNullable<LoraDeviceInput['activation']>, name: '', devEui: '', joinEui: '0000000000000000', appKey: '', devAddr: '', nwkSKey: '', appSKey: '',
    macVersion: '1.0.3' as LoraDeviceInput['macVersion'], class: 'A' as LoraDeviceInput['class'],
  });
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const abp = v.activation === 'ABP';
  const joinOk = /^[0-9A-Fa-f]{16}$/.test(clean(v.joinEui));
  const keysOk = abp ? isDevAddr(v.devAddr) && isKey(v.nwkSKey) && isKey(v.appSKey) : isKey(v.appKey);
  const ok = !!v.name.trim() && isEui(v.devEui) && joinOk && keysOk;
  return (
    <form className="flex flex-col gap-4" noValidate autoComplete="off" onSubmit={(e) => {
      e.preventDefault(); setTried(true);
      if (!ok) return;
      const base = { name: v.name.trim(), devEui: clean(v.devEui).toUpperCase(), joinEui: clean(v.joinEui).toUpperCase(), macVersion: v.macVersion, class: v.class };
      onSubmit(abp
        ? { ...base, activation: 'ABP', devAddr: clean(v.devAddr).toUpperCase(), nwkSKey: clean(v.nwkSKey).toLowerCase(), appSKey: clean(v.appSKey).toLowerCase() }
        : { ...base, appKey: clean(v.appKey).toLowerCase() });
    }}>
      <Select id={`${idPrefix}-activation`} label={m.activation} options={[{ value: 'OTAA', label: m.activationOtaa }, { value: 'ABP', label: m.activationAbp }]} value={v.activation}
        onChange={(e) => setV((s) => ({ ...s, activation: e.target.value as NonNullable<LoraDeviceInput['activation']> }))} />
      <Input id={`${idPrefix}-name`} label={m.name} value={v.name} onChange={set('name')} error={tried && !v.name.trim() ? m.nameRequired : undefined} required maxLength={128} />
      <Input id={`${idPrefix}-deveui`} label={m.devEui} value={v.devEui} onChange={set('devEui')} error={tried && !isEui(v.devEui) ? m.euiInvalid : undefined} required className="font-mono" />
      <Input id={`${idPrefix}-joineui`} label={m.joinEui} hint={m.joinEuiHint} value={v.joinEui} onChange={set('joinEui')} error={tried && !joinOk ? m.euiInvalid : undefined} required className="font-mono" />
      {abp ? (
        <>
          <Callout variant="note">{m.abpNote}</Callout>
          <Input id={`${idPrefix}-devaddr`} label={m.devAddr} hint={m.devAddrHint} value={v.devAddr} onChange={set('devAddr')} error={tried && !isDevAddr(v.devAddr) ? m.devAddrInvalid : undefined} required className="font-mono" />
          <Input id={`${idPrefix}-nwkskey`} type="password" label={m.nwkSKey} hint={m.sessionKeyHint} value={v.nwkSKey} onChange={set('nwkSKey')} error={tried && !isKey(v.nwkSKey) ? m.keyInvalid : undefined} required className="font-mono" />
          <Input id={`${idPrefix}-appskey`} type="password" label={m.appSKey} hint={m.sessionKeyHint} value={v.appSKey} onChange={set('appSKey')} error={tried && !isKey(v.appSKey) ? m.keyInvalid : undefined} required className="font-mono" />
        </>
      ) : (
        <Input id={`${idPrefix}-appkey`} type="password" label={m.appKey} hint={m.appKeyHint} value={v.appKey} onChange={set('appKey')} error={tried && !isKey(v.appKey) ? m.keyInvalid : undefined} required className="font-mono" />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id={`${idPrefix}-mac`} label={m.macVersion} options={['1.0.2', '1.0.3', '1.0.4'].map((x) => ({ value: x, label: x }))} value={v.macVersion} onChange={(e) => setV((s) => ({ ...s, macVersion: e.target.value as LoraDeviceInput['macVersion'] }))} />
        <Select id={`${idPrefix}-class`} label={m.class} options={[{ value: 'A', label: m.classA }, { value: 'C', label: m.classC }]} value={v.class} onChange={(e) => setV((s) => ({ ...s, class: e.target.value as LoraDeviceInput['class'] }))} />
      </div>
      {error && <Callout variant="danger">{error}</Callout>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{mergeLoraMessages(messages).common.cancel}</Button>}
        <Button type="submit" loading={busy}>{m.submit}</Button>
      </div>
    </form>
  );
}
