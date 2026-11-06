'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Select } from '@/modules/ui/Select';
import { Spinner } from '@/modules/ui/Spinner';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { fill, formatDateTime } from '../format';
import type { OtaMessagesInput } from './messages';
import type { OtaAdapter } from './ota-adapter';
import { OtaAssignDrawer } from './OtaAssignDrawer';
import { OtaStateBadge, otaStateLabel } from './OtaStateBadge';
import { otaErrorText, useOtaText } from './OtaText';
import { OTA_FINISHED_STATES, OTA_RETRYABLE_STATES, type OtaAbilities, type OtaDeviceView, type OtaEvent, type OtaPackage, type OtaSettingsView, type OtaState } from './types';

type EventRow = OtaEvent & { id: string } & Record<string, unknown>;
type Metered = 'inherit' | 'on' | 'off';

export interface OtaDevicePanelProps {
  adapter: OtaAdapter;
  deviceId: string;
  deviceName: string;
  can?: OtaAbilities;
  /** Where a package's page is. */
  packageHref?: (packageId: string) => string;
  pollMs?: number;
  messages?: OtaMessagesInput;
  locale?: string;
  className?: string;
}

/**
 * OtaDevicePanel — the device page's Firmware tab: the version it runs, its current update (state with the wait reason or the progress,
 * the device's error, "Try again"), "Allow updates over LTE" for this device (same as its profile, allowed, not allowed; OD-7, off by
 * default; allowing it asks through the ConfirmDialog), the note that a router's own approval setting is changed on the router (OD-13),
 * "Assign firmware" (a drawer) and the update history (a DataTable). Reads again every `pollMs` while an update is on its way.
 */
export function OtaDevicePanel({ adapter, deviceId, deviceName, can = {}, packageHref, pollMs = 5000, messages, locale, className }: OtaDevicePanelProps) {
  const { m, locale: lang } = useOtaText(messages, locale);
  const [view, setView] = useState<OtaDeviceView | null>(null);
  const [settings, setSettings] = useState<OtaSettingsView | null>(null);
  const [packages, setPackages] = useState<OtaPackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [askMetered, setAskMetered] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([adapter.device(deviceId, ac.signal), adapter.settings.get('device', deviceId, ac.signal)]).then(([v, s]) => {
      setView(v); setSettings(s); setError(null);
    }, (e) => { if (!ac.signal.aborted) setError(otaErrorText(m, e)); });
    return () => ac.abort();
  }, [adapter, deviceId, tick, m]);
  useEffect(() => {
    if (!can.assign) return;
    const ac = new AbortController();
    adapter.packages.list(ac.signal).then(setPackages, () => setPackages([]));
    return () => ac.abort();
  }, [adapter, can.assign]);

  const attempt = view?.attempt ?? null;
  const live = !!attempt && !OTA_FINISHED_STATES.has(attempt.state);
  useEffect(() => {
    if (!pollMs || !live) return;
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') setTick((t) => t + 1); }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, live]);

  async function run(fn: () => Promise<unknown>, after?: string) {
    setBusy(true); setError(null); setNotice(null);
    try {
      await fn();
      if (after) setNotice(after);
      setTick((t) => t + 1);
    } catch (e) {
      setError(otaErrorText(m, e));
    } finally {
      setBusy(false);
      setAskMetered(false);
    }
  }

  if (!view || !settings) {
    return error
      ? <Callout variant="danger" className={className}><p>{error}</p><Button className="mt-2" size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>{m.common.retry}</Button></Callout>
      : <div className={cn('flex justify-center p-6', className)} role="status" aria-label={m.common.loading}><Spinner label={null} /></div>;
  }

  const stored = settings.stored.allowMetered;
  const metered: Metered = stored === true ? 'on' : stored === false ? 'off' : 'inherit';
  const inherited = settings.effective.allowMetered ? m.device.on : m.device.off;
  const setMetered = (v: Metered) => {
    if (v === metered) return;
    if (v === 'on') { setAskMetered(true); return; }
    void run(() => adapter.settings.put('device', deviceId, { allowMetered: v === 'off' ? false : null }), m.profile.saved);
  };
  const rows: EventRow[] = view.events.map((e, i) => ({ ...e, id: `${e.at}-${i}` }) as EventRow);
  const columns: Column<EventRow>[] = [
    { key: 'at', header: m.device.at, sortable: true, render: (r) => formatDateTime(r.at, { locale: lang }) },
    {
      key: 'to', header: m.device.change,
      render: (r) => (r.kind === 'ignored' ? <span className="text-text-secondary">{m.device.ignored}</span>
        : <span>{otaStateLabel(m, r.from as OtaState)} → <span className="font-medium">{otaStateLabel(m, r.to as OtaState)}</span></span>),
    },
    { key: 'fwError', header: m.rollout.error, hideBelow: 'sm', render: (r) => (r.fwError ? (m.block as Record<string, string>)[r.fwError] ?? r.fwError : m.common.none) },
  ];
  const filters: DataTableFilterField<EventRow>[] = [
    { id: 'moved', label: m.device.change, type: 'checkbox', match: (r, v) => !v || r.kind !== 'ignored' },
  ];
  const pkgOf = attempt ? packages.find((p) => p.packageId === attempt.packageId) : undefined;

  return (
    <div className={cn('space-y-5', className)} data-ota-device={deviceId}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-secondary">{m.device.running}</dt>
            <dd className="font-mono text-sm text-text-primary">{view.currentVersion ? `${view.currentTitle ? `${view.currentTitle} ` : ''}${view.currentVersion}` : m.device.unknownVersion}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">{m.device.target}</dt>
            <dd className="flex flex-wrap items-center gap-2 text-sm text-text-primary">
              {attempt ? (
                <>
                  {packageHref
                    ? <a href={packageHref(attempt.packageId)} className="font-mono text-primary hover:underline">{pkgOf ? `${pkgOf.title} ` : ''}{attempt.toVersion}</a>
                    : <span className="font-mono">{attempt.toVersion}</span>}
                  <OtaStateBadge state={attempt.state} waitReason={attempt.waitReason} progress={attempt.progress} messages={m} />
                </>
              ) : <span className="text-text-secondary">{m.device.noUpdate}</span>}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {can.assign && attempt && OTA_RETRYABLE_STATES.has(attempt.state) && (
            <Button variant="outline" onClick={() => void run(() => adapter.retry(deviceId), fill(m.rollout.retried, { device: deviceName }))} disabled={busy}>{m.rollout.retry}</Button>
          )}
          {can.assign && <Button variant="primary" onClick={() => setAssigning(true)}>{m.device.assign}</Button>}
        </div>
      </header>
      {attempt?.fwError && attempt.state !== 'SKIPPED' && <Callout variant="danger">{fill(m.device.error, { code: attempt.fwError })}</Callout>}
      {attempt?.state === 'SKIPPED' && attempt.fwError && <Callout variant="note">{(m.block as Record<string, string>)[attempt.fwError] ?? attempt.fwError}</Callout>}
      {notice && <Callout variant="tip">{notice}</Callout>}
      {error && <Callout variant="danger" role="alert">{error}</Callout>}
      <section className="space-y-2 rounded-lg border border-border p-4" aria-label={m.device.meteredTitle}>
        <h3 className="text-sm font-semibold text-text-primary">{m.device.meteredTitle}</h3>
        <Select
          id={`ota-metered-${deviceId}`} label={m.device.meteredLabel} hint={m.device.meteredHint} value={metered} disabled={!can.assign || busy}
          onChange={(e) => setMetered(e.target.value as Metered)}
          options={[
            { value: 'inherit', label: fill(m.device.meteredInherit, { value: inherited }) },
            { value: 'on', label: m.device.meteredOn },
            { value: 'off', label: m.device.meteredOff },
          ]}
        />
        <p className="text-xs text-text-secondary">{m.device.approvalNote}</p>
        {!can.assign && <p className="text-xs text-text-secondary">{m.common.viewOnly}</p>}
      </section>
      <DataTable<EventRow>
        columns={columns}
        rows={rows}
        mode="static"
        variant="plain"
        searchable={false}
        title={m.device.history}
        caption={m.device.historyCaption}
        rowId={(r) => r.id}
        filterFields={filters}
        defaultSort={[{ key: 'at', dir: 'desc' }]}
        emptyMessage={m.device.noUpdate}
        pageSize={10}
      />
      <ConfirmDialog
        open={askMetered}
        tone="warning"
        title={m.device.meteredLabel}
        message={m.profile.meteredHint}
        confirmLabel={m.device.meteredOn}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAskMetered(false)}
        onConfirm={() => void run(() => adapter.settings.put('device', deviceId, { allowMetered: true }), m.profile.saved)}
      />
      <OtaAssignDrawer
        open={assigning}
        onClose={() => setAssigning(false)}
        adapter={adapter}
        packages={packages}
        preset={{ targetType: 'DEVICE', targetId: deviceId, name: deviceName }}
        messages={m}
        onAssigned={() => { setAssigning(false); setNotice(m.assign.done); setTick((t) => t + 1); }}
      />
    </div>
  );
}
