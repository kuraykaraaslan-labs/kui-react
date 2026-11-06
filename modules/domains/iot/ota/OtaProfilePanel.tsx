'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Input } from '@/modules/ui/Input';
import { Spinner } from '@/modules/ui/Spinner';
import { Toggle } from '@/modules/ui/Toggle';
import type { OtaMessagesInput } from './messages';
import type { OtaAdapter } from './ota-adapter';
import { OtaAssignDrawer } from './OtaAssignDrawer';
import { OtaPackageStatusBadge } from './OtaStateBadge';
import { otaErrorText, useOtaText } from './OtaText';
import type { OtaAbilities, OtaAssignment, OtaPackage, OtaProfileSettings } from './types';

const DEFAULTS: OtaProfileSettings = { otaEnabled: false, allowMetered: false, allowUnsigned: false, downloadTimeoutMin: 60, updateTimeoutMin: 20, maxAttempts: 3 };
const LIMITS = { downloadTimeoutMin: [5, 1440], updateTimeoutMin: [2, 240], maxAttempts: [1, 10] } as const;

export interface OtaProfilePanelProps {
  adapter: OtaAdapter;
  profileId: string;
  profileName: string;
  can?: OtaAbilities;
  packageHref?: (packageId: string) => string;
  messages?: OtaMessagesInput;
  locale?: string;
  className?: string;
}

/**
 * OtaProfilePanel — the device profile page's Firmware tab: whether its devices take firmware updates (off for a new profile, D238),
 * updates over LTE (OD-7, off by default; allowing it asks through the ConfirmDialog), unsigned images, the time limits and tries; the
 * package assigned to the whole profile and "Assign firmware" (a drawer, ready packages only).
 */
export function OtaProfilePanel({ adapter, profileId, profileName, can = {}, packageHref, messages, locale, className }: OtaProfilePanelProps) {
  const { m, locale: lang } = useOtaText(messages, locale);
  const [form, setForm] = useState<OtaProfileSettings | null>(null);
  const [saved, setSaved] = useState<OtaProfileSettings | null>(null);
  const [assignment, setAssignment] = useState<OtaAssignment | null>(null);
  const [packages, setPackages] = useState<OtaPackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [askMetered, setAskMetered] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      adapter.settings.get('profile', profileId, ac.signal),
      adapter.assignments.list({ targetType: 'PROFILE', targetId: profileId }, ac.signal),
      adapter.packages.list(ac.signal),
    ]).then(([s, a, p]) => {
      const v = { ...DEFAULTS, ...s.effective } as OtaProfileSettings;
      setForm(v); setSaved(v); setAssignment(a[0] ?? null); setPackages(p); setError(null);
    }, (e) => { if (!ac.signal.aborted) setError(otaErrorText(m, e)); });
    return () => ac.abort();
  }, [adapter, profileId, tick, m]);

  if (!form || !saved) {
    return error
      ? <Callout variant="danger" className={className}><p>{error}</p><Button className="mt-2" size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>{m.common.retry}</Button></Callout>
      : <div className={cn('flex justify-center p-6', className)} role="status" aria-label={m.common.loading}><Spinner label={null} /></div>;
  }

  const ro = !can.assign || busy;
  const set = <K extends keyof OtaProfileSettings>(k: K, v: OtaProfileSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const numError = (k: keyof typeof LIMITS) => {
    const [lo, hi] = LIMITS[k];
    const v = form[k];
    return Number.isInteger(v) && v >= lo && v <= hi ? undefined : `${lo}–${hi}`;
  };
  const invalid = !!(numError('downloadTimeoutMin') || numError('updateTimeoutMin') || numError('maxAttempts'));
  const changed = (Object.keys(form) as Array<keyof OtaProfileSettings>).filter((k) => form[k] !== saved[k]);

  async function save() {
    if (!form) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await adapter.settings.put('profile', profileId, Object.fromEntries(changed.map((k) => [k, form[k]])));
      setNotice(m.profile.saved);
      setAskMetered(false);
      setTick((t) => t + 1);
    } catch (e) {
      setAskMetered(false);
      setError(otaErrorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  const current = assignment ? packages.find((p) => p.packageId === assignment.packageId) : undefined;
  const num = (k: keyof typeof LIMITS, label: string) => (
    <Input
      id={`ota-profile-${k}-${profileId}`} label={label} type="number" inputMode="numeric" min={LIMITS[k][0]} max={LIMITS[k][1]} value={String(form[k])}
      onChange={(e) => set(k, Number(e.target.value))} error={numError(k)} disabled={ro || !form.otaEnabled}
    />
  );

  return (
    <div className={cn('space-y-5', className)} data-ota-profile={profileId}>
      <section className="space-y-4 rounded-lg border border-border p-4" aria-label={m.profile.title}>
        <div>
          <h3 className="text-base font-semibold text-text-primary">{m.profile.title}</h3>
          <p className="text-sm text-text-secondary">{m.profile.intro}</p>
        </div>
        <Toggle id={`ota-enabled-${profileId}`} label={m.profile.enabled} checked={form.otaEnabled} onChange={(v) => set('otaEnabled', v)} disabled={ro} />
        <Toggle id={`ota-metered-${profileId}`} label={m.profile.metered} description={m.profile.meteredHint} checked={form.allowMetered} onChange={(v) => set('allowMetered', v)} disabled={ro || !form.otaEnabled} />
        <Toggle id={`ota-unsigned-${profileId}`} label={m.profile.unsigned} description={m.profile.unsignedHint} checked={form.allowUnsigned} onChange={(v) => set('allowUnsigned', v)} disabled={ro || !form.otaEnabled} />
        <div className="grid gap-4 sm:grid-cols-3">
          {num('downloadTimeoutMin', m.profile.downloadTimeout)}
          {num('updateTimeoutMin', m.profile.updateTimeout)}
          {num('maxAttempts', m.profile.attempts)}
        </div>
        {notice && <Callout variant="tip">{notice}</Callout>}
        {error && <Callout variant="danger" role="alert">{error}</Callout>}
        {can.assign ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setForm(saved)} disabled={busy || !changed.length}>{m.common.cancel}</Button>
            <Button variant="primary" loading={busy} disabled={busy || !changed.length || invalid} onClick={() => (form.allowMetered && !saved.allowMetered ? setAskMetered(true) : void save())}>{m.common.save}</Button>
          </div>
        ) : <p className="text-xs text-text-secondary">{m.common.viewOnly}</p>}
      </section>
      <section className="space-y-2 rounded-lg border border-border p-4" aria-label={m.profile.current}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-text-primary">{m.profile.current}</h3>
          {can.assign && saved.otaEnabled && <Button variant="primary" onClick={() => setAssigning(true)}>{m.profile.assign}</Button>}
        </div>
        {current ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {packageHref ? <a href={packageHref(current.packageId)} className="font-medium text-primary hover:underline">{current.title} {current.version}</a> : <span className="font-medium">{current.title} {current.version}</span>}
            <OtaPackageStatusBadge status={current.status} messages={m} />
          </p>
        ) : <p className="text-sm text-text-secondary">{m.profile.noneAssigned}</p>}
        {!saved.otaEnabled && <p className="text-xs text-text-secondary">{m.errors.ota_disabled}</p>}
      </section>
      <ConfirmDialog
        open={askMetered}
        tone="warning"
        title={m.profile.metered}
        message={m.profile.meteredHint}
        confirmLabel={m.common.save}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAskMetered(false)}
        onConfirm={() => void save()}
      />
      <OtaAssignDrawer
        open={assigning}
        onClose={() => setAssigning(false)}
        adapter={adapter}
        packages={packages.filter((p) => !p.profileId || p.profileId === profileId)}
        preset={{ targetType: 'PROFILE', targetId: profileId, name: profileName }}
        messages={m}
        locale={lang}
        onAssigned={() => { setAssigning(false); setNotice(m.assign.done); setTick((t) => t + 1); }}
      />
    </div>
  );
}
