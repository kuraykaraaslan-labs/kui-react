'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { DescriptionList } from '@/modules/ui/DescriptionList';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { mergeLoraMessages, type LoraMessagesInput } from './messages';
import { LoraJoinStateBadge } from './LoraBadges';
import { LoraFrameTable } from './LoraFrameTable';
import { isDevAddr, isKey } from './LoraForms';
import type { LoraCodecOption, LoraDeviceDetail, LoraDeviceKeysChange, LoraFrameRow } from './types';

/**
 * LoraDevicePanel — the LoRaWAN tab of a device (NB iot_lorawan 13 §13.1 `LoraDeviceTab`; kui-react iot 10.4), one column of sections, no
 * nested tabs: who the device is on the network (DevEUI, JoinEUI, DevAddr, version and class, frame counters, last uplink, the AppKey
 * never shown) with its join state; its codec (Automatic, None, a library codec or the tenant's own; saved by the host); the latest
 * reception, one row per gateway that heard the last uplink (OD-103: no history, the note says where history comes from); its recent
 * frames. "Reset session" and "Remove" (the device, its keys and its DevEUI claim) are the host's, each confirmed by its ConfirmDialog. A device
 * without a LoRaWAN record (`device` null) shows one line saying where LoRaWAN devices are added (New device on the Devices page).
 *
 * NB D508-D525: the activation (OTAA or ABP) is shown; an ABP device has "Reset counters" instead of "Reset session" (it never joins, so its
 * session must not end) and shows when its counters were last reset; its class (A or C) is chosen here and saved with its own button; new
 * keys (an OTAA AppKey, or an ABP DevAddr with both session keys) are typed into write-only fields and handed to the host, which asks first;
 * a device pairing mode added and that waits for approval says so, with Approve. Nothing here ever shows a stored key.
 */
export type LoraDevicePanelProps = {
  device: LoraDeviceDetail | null;
  frames: readonly LoraFrameRow[];
  codecOptions: readonly LoraCodecOption[];
  onCodecChange?: (codecId: string) => Promise<void>;
  onResetSession?: () => void;
  /** ABP: clears the frame counters (the host asks first and audits it). Replaces Reset session for an ABP device. */
  onResetCounters?: () => void;
  /** Saves the device's class (A or C). */
  onClassChange?: (cls: 'A' | 'C') => Promise<void>;
  /** Replaces the device's keys (the host asks first); left out, no Keys section. */
  onKeysChange?: (change: LoraDeviceKeysChange) => Promise<void>;
  /** Approves a device pairing mode added (`device.held`). */
  onApprove?: () => void;
  /** Removes the LoRaWAN device (the host asks first); left out, no Remove button. */
  onRemove?: () => void;
  gatewayName?: (gatewayId: string) => string | undefined;
  loading?: boolean;
  error?: string | null;
  locale?: string;
  messages?: LoraMessagesInput;
};

type RxRow = { gatewayId: string; eui: string; rssi: number; snr: number; chosen: boolean };

/** The gateways that heard the device's newest uplink (frames newest first), best SNR first. Pure. */
export function latestReception(frames: readonly LoraFrameRow[]): RxRow[] {
  const up = frames.find((f) => (f.type === 'up' || f.type === 'cup') && f.gateways?.length);
  if (!up) return [];
  return [...up.gateways].sort((a, b) => b.snr - a.snr).map((g) => ({ ...g, chosen: up.chosenGatewayId === g.gatewayId }));
}

export function LoraDevicePanel({
  device, frames, codecOptions, onCodecChange, onResetSession, onResetCounters, onClassChange, onKeysChange, onApprove, onRemove, gatewayName, loading, error, locale, messages,
}: LoraDevicePanelProps) {
  const all = mergeLoraMessages(messages);
  const m = all.deviceTab;
  const [codec, setCodec] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cls, setCls] = useState<'A' | 'C' | null>(null);
  const [clsBusy, setClsBusy] = useState(false);
  const [clsError, setClsError] = useState<string | null>(null);
  const [clsSaved, setClsSaved] = useState(false);
  const [keys, setKeys] = useState({ appKey: '', devAddr: '', nwkSKey: '', appSKey: '' });
  const [keysTried, setKeysTried] = useState(false);
  const [keysBusy, setKeysBusy] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [keysSaved, setKeysSaved] = useState(false);
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }), [locale]);
  const rx = useMemo(() => latestReception(frames), [frames]);
  const columns: Column<RxRow>[] = [
    { key: 'gatewayId', header: m.gateway, sortable: true, render: (r) => <span className="text-sm">{gatewayName?.(r.gatewayId) ?? <code className="font-mono text-xs">{r.eui}</code>}</span> },
    { key: 'rssi', header: m.rssi, sortable: true, align: 'right', searchable: false, render: (r) => <span className="tabular-nums">{r.rssi}</span> },
    { key: 'snr', header: m.snr, sortable: true, align: 'right', searchable: false, render: (r) => <span className="tabular-nums">{r.snr}</span> },
    { key: 'chosen', header: m.chosen, searchable: false, render: (r) => (r.chosen ? '✓' : '') },
  ];
  if (error) return <Callout variant="danger">{error}</Callout>;
  if (loading && !device) return <p className="text-sm text-text-secondary">{all.common.loading}</p>;
  if (!device) return <Callout variant="note">{m.notLora}</Callout>;
  const current = codec ?? device.codecId ?? 'auto';
  const session = device.session;
  const abp = device.activation === 'ABP';
  const currentClass = cls ?? device.class;
  const clean = (v: string) => v.replace(/[\s:-]/g, '');
  const devAddrNow = keys.devAddr || device.abp?.devAddr || session?.devAddr || '';
  const keysOk = abp ? isDevAddr(devAddrNow) && isKey(keys.nwkSKey) && isKey(keys.appSKey) : isKey(keys.appKey);
  const resetAction = abp ? onResetCounters : onResetSession;
  const options = codecOptions.some((o) => o.value === current) ? codecOptions : [...codecOptions, { value: current, label: current }];
  return (
    <div className="space-y-6">
      {device.held && (
        <Callout variant="warning">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{m.held}</span>
            {onApprove && <Button size="sm" onClick={onApprove}>{m.approve}</Button>}
          </div>
        </Callout>
      )}
      {(resetAction || onRemove) && (
        <div className="flex flex-wrap gap-2">
          {resetAction && <Button variant="outline" size="sm" onClick={resetAction}>{abp ? m.resetCounters : m.reset}</Button>}
          {onRemove && <Button variant="danger" size="sm" onClick={onRemove}>{m.remove}</Button>}
        </div>
      )}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">{m.identity}<LoraJoinStateBadge device={device} messages={messages} /></h3>
        <DescriptionList
          dense columns={2}
          messages={{ copy: all.common.copy, copied: all.common.copied }}
          items={[
            { label: m.devEui, value: device.devEui, mono: true, copyValue: device.devEui },
            { label: m.joinEui, value: device.joinEui, mono: true },
            { label: m.activation, value: abp ? m.activationAbp : m.activationOtaa },
            { label: m.devAddr, value: session?.devAddr ?? device.abp?.devAddr, mono: true },
            { label: m.version, value: `${device.macVersion} · ${device.class}` },
            { label: m.counters, value: session ? `${session.fCntUp ?? all.common.none} / ${session.fCntDown}` : undefined },
            { label: m.lastUplink, value: session?.lastUplinkAt ? date.format(new Date(session.lastUplinkAt)) : all.common.never },
            abp
              ? { label: m.sessionKeys, value: m.sessionKeysHidden }
              : { label: m.appKey, value: device.useProfileKey ? m.appKeyProfile : m.appKeyHidden },
            ...(abp ? [{ label: m.countersReset, value: device.abp?.countersResetAt ? date.format(new Date(device.abp.countersResetAt)) : all.common.never }] : []),
          ]}
        />
      </section>
      <section className="space-y-2">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
          e.preventDefault();
          if (!onCodecChange) return;
          setSaving(true); setSaveError(null); setSaved(false);
          onCodecChange(current).then(() => setSaved(true), (err: unknown) => setSaveError(err instanceof Error ? err.message : String(err))).finally(() => setSaving(false));
        }}>
          <Select id={`lora-device-codec-${device.deviceId}`} label={all.choice.label} hint={all.choice.hint} options={options as LoraCodecOption[]} value={current}
            onChange={(e) => { setCodec(e.target.value); setSaved(false); }} searchable disabled={!onCodecChange} className="min-w-64 flex-1" />
          {onCodecChange && <Button type="submit" variant="outline" loading={saving} disabled={current === device.codecId}>{m.saveCodec}</Button>}
        </form>
        {saved && <p className="text-xs text-success-fg">{m.saved}</p>}
        {saveError && <Callout variant="danger">{saveError}</Callout>}
        <p className="text-xs text-text-secondary">{all.codec.flows}</p>
      </section>
      <section className="space-y-2">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
          e.preventDefault();
          if (!onClassChange || currentClass === device.class) return;
          setClsBusy(true); setClsError(null); setClsSaved(false);
          onClassChange(currentClass).then(() => setClsSaved(true), (err: unknown) => setClsError(err instanceof Error ? err.message : String(err))).finally(() => setClsBusy(false));
        }}>
          <Select id={`lora-device-class-${device.deviceId}`} label={m.classTitle} options={[{ value: 'A', label: all.deviceForm.classA }, { value: 'C', label: all.deviceForm.classC }]}
            value={currentClass} disabled={!onClassChange} onChange={(e) => { setCls(e.target.value as 'A' | 'C'); setClsSaved(false); }} className="min-w-64 flex-1" />
          {onClassChange && <Button type="submit" variant="outline" loading={clsBusy} disabled={currentClass === device.class}>{m.saveClass}</Button>}
        </form>
        {clsSaved && <p className="text-xs text-success-fg">{m.saved}</p>}
        {clsError && <Callout variant="danger">{clsError}</Callout>}
        <p className="text-xs text-text-secondary">{m.classNote}</p>
      </section>
      {onKeysChange && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">{m.keys}</h3>
          <form className="grid gap-3 sm:grid-cols-2" noValidate autoComplete="off" onSubmit={(e) => {
            e.preventDefault(); setKeysTried(true);
            if (!keysOk) return;
            const change: LoraDeviceKeysChange = abp
              ? { devAddr: clean(devAddrNow).toUpperCase(), nwkSKey: clean(keys.nwkSKey).toLowerCase(), appSKey: clean(keys.appSKey).toLowerCase() }
              : { appKey: clean(keys.appKey).toLowerCase() };
            setKeysBusy(true); setKeysError(null); setKeysSaved(false);
            onKeysChange(change).then(() => { setKeysSaved(true); setKeysTried(false); setKeys({ appKey: '', devAddr: '', nwkSKey: '', appSKey: '' }); },
              (err: unknown) => setKeysError(err instanceof Error ? err.message : String(err))).finally(() => setKeysBusy(false));
          }}>
            {abp ? (
              <>
                <Input id={`lora-device-devaddr-${device.deviceId}`} label={m.newDevAddr} value={devAddrNow} className="font-mono"
                  error={keysTried && !isDevAddr(devAddrNow) ? m.devAddrInvalid : undefined} onChange={(e) => { setKeys((k) => ({ ...k, devAddr: e.target.value })); setKeysSaved(false); }} />
                <span className="hidden sm:block" />
                <Input id={`lora-device-nwkskey-${device.deviceId}`} type="password" label={m.newNwkSKey} value={keys.nwkSKey} className="font-mono"
                  error={keysTried && !isKey(keys.nwkSKey) ? m.keyInvalid : undefined} onChange={(e) => { setKeys((k) => ({ ...k, nwkSKey: e.target.value })); setKeysSaved(false); }} />
                <Input id={`lora-device-appskey-${device.deviceId}`} type="password" label={m.newAppSKey} value={keys.appSKey} className="font-mono"
                  error={keysTried && !isKey(keys.appSKey) ? m.keyInvalid : undefined} onChange={(e) => { setKeys((k) => ({ ...k, appSKey: e.target.value })); setKeysSaved(false); }} />
              </>
            ) : (
              <Input id={`lora-device-appkey-${device.deviceId}`} type="password" label={m.newAppKey} value={keys.appKey} className="font-mono"
                error={keysTried && !isKey(keys.appKey) ? m.keyInvalid : undefined} onChange={(e) => { setKeys((k) => ({ ...k, appKey: e.target.value })); setKeysSaved(false); }} />
            )}
            <div className="flex items-end justify-end gap-3 sm:col-span-2">
              {keysSaved && <span className="text-xs text-success-fg">{m.saved}</span>}
              <Button type="submit" variant="outline" loading={keysBusy}>{m.saveKeys}</Button>
            </div>
          </form>
          {keysError && <Callout variant="danger">{keysError}</Callout>}
          <p className="text-xs text-text-secondary">{abp ? m.keysNoteAbp : m.keysNoteOtaa}</p>
        </section>
      )}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">{m.reception}</h3>
        <DataTable<RxRow>
          mode="paginated" variant="plain" density="compact" caption={m.reception} columns={columns} rows={rx} rowId={(r) => r.gatewayId}
          pageSize={10} searchPlaceholder={m.gateway} emptyMessage={m.receptionEmpty} defaultQuery={{ sort: [{ key: 'snr', dir: 'desc' }] }}
          messages={{ loading: all.common.loading, retry: all.common.retry }}
        />
        <p className="text-xs text-text-secondary">{m.receptionNote}</p>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">{m.recent}</h3>
        <LoraFrameTable rows={frames} gatewayName={gatewayName} messages={messages} locale={locale} />
      </section>
    </div>
  );
}
