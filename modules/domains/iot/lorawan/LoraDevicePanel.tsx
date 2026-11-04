'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { DescriptionList } from '@/modules/ui/DescriptionList';
import { Select } from '@/modules/ui/Select';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { mergeLoraMessages, type LoraMessagesInput } from './messages';
import { LoraJoinStateBadge } from './LoraBadges';
import { LoraFrameTable } from './LoraFrameTable';
import type { LoraCodecOption, LoraDeviceDetail, LoraFrameRow } from './types';

/**
 * LoraDevicePanel — the LoRaWAN tab of a device (NB iot_lorawan 13 §13.1 `LoraDeviceTab`; kui-react iot 10.4), one column of sections, no
 * nested tabs: who the device is on the network (DevEUI, JoinEUI, DevAddr, version and class, frame counters, last uplink, the AppKey
 * never shown) with its join state; its codec (Automatic, None, a library codec or the tenant's own; saved by the host); the latest
 * reception, one row per gateway that heard the last uplink (OD-103: no history, the note says where history comes from); its recent
 * frames. "Reset session" is the host's (confirmed by its ConfirmDialog). A device that is not a LoRaWAN device (`device` null) shows one
 * line pointing at the LoRaWAN page.
 */
export type LoraDevicePanelProps = {
  device: LoraDeviceDetail | null;
  frames: readonly LoraFrameRow[];
  codecOptions: readonly LoraCodecOption[];
  onCodecChange?: (codecId: string) => Promise<void>;
  onResetSession?: () => void;
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
  device, frames, codecOptions, onCodecChange, onResetSession, gatewayName, loading, error, locale, messages,
}: LoraDevicePanelProps) {
  const all = mergeLoraMessages(messages);
  const m = all.deviceTab;
  const [codec, setCodec] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
  const options = codecOptions.some((o) => o.value === current) ? codecOptions : [...codecOptions, { value: current, label: current }];
  return (
    <div className="space-y-6">
      {onResetSession && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={onResetSession}>{m.reset}</Button></div>}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">{m.identity}<LoraJoinStateBadge device={device} messages={messages} /></h3>
        <DescriptionList
          dense columns={2}
          messages={{ copy: all.common.copy, copied: all.common.copied }}
          items={[
            { label: m.devEui, value: device.devEui, mono: true, copyValue: device.devEui },
            { label: m.joinEui, value: device.joinEui, mono: true },
            { label: m.devAddr, value: session?.devAddr, mono: true },
            { label: m.version, value: `${device.macVersion} · ${device.class}` },
            { label: m.counters, value: session ? `${session.fCntUp ?? all.common.none} / ${session.fCntDown}` : undefined },
            { label: m.lastUplink, value: session?.lastUplinkAt ? date.format(new Date(session.lastUplinkAt)) : all.common.never },
            { label: m.appKey, value: device.useProfileKey ? m.appKeyProfile : m.appKeyHidden },
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
