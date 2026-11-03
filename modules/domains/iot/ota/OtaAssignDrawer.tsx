'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Checkbox } from '@/modules/ui/Checkbox';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableRowId } from '@/modules/ui/Table/types';
import { fill } from '../format';
import type { OtaMessages, OtaMessagesInput } from './messages';
import type { OtaAdapter } from './ota-adapter';
import { otaErrorText, useOtaText } from './OtaText';
import type { OtaAssignPreview, OtaAssignTarget, OtaOption, OtaPackage, OtaTargetType } from './types';

type DeviceRow = OtaOption & Record<string, unknown>;

/** A fixed target the drawer is opened for (the device page, the profile page): no target choice is shown. */
export type OtaAssignPreset = { targetType: 'PROFILE' | 'DEVICE'; targetId: string; name: string };

export interface OtaAssignDrawerProps {
  open: boolean;
  onClose: () => void;
  adapter: OtaAdapter;
  /** The package to send; or, with `packages`, the drawer offers a ready package to pick (the device and profile pages). */
  pkg?: OtaPackage | null;
  packages?: readonly OtaPackage[];
  preset?: OtaAssignPreset;
  onAssigned: () => void;
  messages?: OtaMessagesInput;
  locale?: string;
}

/** The confirmation's lines from a dry run: covered, offline, already on it, and the skipped by reason. */
export function previewLines(m: OtaMessages, p: OtaAssignPreview): { lines: string[]; skipped: Array<{ reason: string; n: number }> } {
  const lines = [fill(m.assign.previewDevices, { n: p.devices })];
  if (p.offline) lines.push(fill(m.assign.previewOffline, { n: p.offline }));
  if (p.alreadyOnTarget) lines.push(fill(m.assign.previewAlready, { n: p.alreadyOnTarget }));
  const skipped = Object.entries(p.incompatible).filter(([, n]) => (n ?? 0) > 0).map(([reason, n]) => ({ reason: (m.block as Record<string, string>)[reason] ?? reason, n: n ?? 0 }));
  return { lines, skipped };
}

/**
 * OtaAssignDrawer — who gets a package: every device of a profile (later ones too), some devices (a list frozen now: picked one by one,
 * or all devices a profile has now), or one device. "Check" runs a dry run and shows what would happen (devices covered, offline, already
 * on the version, and the ones that would not take it with the reason in words, plus the metered-link and router-approval rules,
 * OD-7/OD-13); "Assign" asks once more through the ConfirmDialog with the device count.
 */
export function OtaAssignDrawer({ open, onClose, adapter, pkg, packages, preset, onAssigned, messages, locale }: OtaAssignDrawerProps) {
  const { m } = useOtaText(messages, locale);
  const [chosenId, setChosenId] = useState('');
  const [targetType, setTargetType] = useState<OtaTargetType>(preset?.targetType ?? 'PROFILE');
  const [profiles, setProfiles] = useState<OtaOption[]>([]);
  const [profileId, setProfileId] = useState('');
  const [wholeProfile, setWholeProfile] = useState(false);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<OtaOption[]>([]);
  const [picked, setPicked] = useState<DataTableRowId[]>([]);
  const [checked, setPreview] = useState<{ key: string; preview: OtaAssignPreview } | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = useMemo(() => (packages ?? []).filter((p) => p.status === 'READY'), [packages]);
  const chosen = pkg ?? ready.find((p) => p.packageId === chosenId) ?? null;

  const close = () => {
    setChosenId(''); setTargetType(preset?.targetType ?? 'PROFILE'); setProfileId(''); setWholeProfile(false); setSearch(''); setPicked([]);
    setPreview(null); setError(null); setAsking(false);
    onClose();
  };

  useEffect(() => {
    if (!open || preset) return;
    const ac = new AbortController();
    adapter.profiles(ac.signal).then(setProfiles, () => setProfiles([]));
    return () => ac.abort();
  }, [open, preset, adapter]);

  const listing = open && !preset && (targetType === 'DEVICE' || (targetType === 'GROUP' && !wholeProfile));
  useEffect(() => {
    if (!listing) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      adapter.devices({ search: search.trim(), profileId: profileId || undefined, pageSize: 50 }, ac.signal).then(setFound, () => setFound([]));
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [listing, search, profileId, adapter]);


  const target: OtaAssignTarget | null = preset
    ? { targetType: preset.targetType, targetId: preset.targetId }
    : targetType === 'PROFILE' ? (profileId ? { targetType: 'PROFILE', targetId: profileId } : null)
      : targetType === 'DEVICE' ? (picked[0] ? { targetType: 'DEVICE', targetId: String(picked[0]) } : null)
        : wholeProfile ? (profileId ? { targetType: 'GROUP', selector: { profileId } } : null)
          : picked.length ? { targetType: 'GROUP', deviceIds: picked.map(String) } : null;

  // a new choice needs a new check: a result counts only for the choice it was made for
  const choiceKey = JSON.stringify([chosen?.packageId ?? null, target]);
  const preview = checked && checked.key === choiceKey ? checked.preview : null;

  async function check() {
    if (!chosen || !target) return;
    setBusy(true); setError(null);
    try {
      const r = await adapter.assignments.create(chosen.packageId, target, { dryRun: true });
      setPreview({ key: choiceKey, preview: r.preview });
    } catch (e) {
      setError(otaErrorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!chosen || !target) return;
    setBusy(true); setError(null);
    try {
      await adapter.assignments.create(chosen.packageId, target);
      close();
      onAssigned();
    } catch (e) {
      setAsking(false);
      setError(otaErrorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  const deviceColumns: Column<DeviceRow>[] = [
    { key: 'name', header: m.assign.device, sortable: true, render: (r) => <span className="font-medium text-text-primary">{r.name}</span> },
    { key: 'hint', header: m.list.profile, hideBelow: 'sm', render: (r) => r.hint ?? m.common.none },
  ];
  const lines = preview ? previewLines(m, preview) : null;

  return (
    <Drawer
      open={open}
      onClose={() => { if (!busy) close(); }}
      title={chosen ? fill(m.assign.title, { title: chosen.title, version: chosen.version }) : m.profile.assign}
      closeLabel={m.common.close}
      className="w-full max-w-2xl"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>{m.common.cancel}</Button>
          <Button variant="outline" onClick={() => void check()} loading={busy && !asking} disabled={busy || !chosen || !target}>{m.assign.check}</Button>
          <Button variant="primary" onClick={() => setAsking(true)} disabled={busy || !preview || preview.devices === 0}>{m.assign.submit}</Button>
        </div>
      )}
    >
      <div className="space-y-4" data-ota-assign>
        <p className="text-sm text-text-secondary">{m.assign.intro}</p>
        {!pkg && (
          <Select
            id="ota-assign-package" label={m.profile.pickPackage} hint={m.profile.pickPackageHint} value={chosenId} onChange={(e) => setChosenId(e.target.value)}
            options={ready.map((p) => ({ value: p.packageId, label: `${p.title} ${p.version}` }))} placeholder={m.profile.pickPackage}
          />
        )}
        {preset ? (
          <p className="text-sm text-text-primary"><span className="text-text-secondary">{m.assign.to}: </span><span className="font-medium">{preset.name}</span></p>
        ) : (
          <>
            <Select
              id="ota-assign-to" label={m.assign.to} value={targetType} onChange={(e) => { setTargetType(e.target.value as OtaTargetType); setPicked([]); }}
              options={[{ value: 'PROFILE', label: m.assign.toProfile }, { value: 'GROUP', label: m.assign.toGroup }, { value: 'DEVICE', label: m.assign.toDevice }]}
              hint={targetType === 'PROFILE' ? m.assign.toProfileHint : targetType === 'GROUP' ? m.assign.toGroupHint : undefined}
            />
            <Select
              id="ota-assign-profile" label={m.assign.profile} value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder={m.assign.profile}
              options={[...(targetType === 'PROFILE' ? [] : [{ value: '', label: m.common.anyProfile }]), ...profiles.map((p) => ({ value: p.id, label: p.name }))]}
            />
            {targetType === 'GROUP' && (
              <Checkbox id="ota-assign-whole" label={m.assign.allOfProfile} checked={wholeProfile} onChange={(e) => setWholeProfile(e.target.checked)} />
            )}
            {targetType === 'GROUP' && wholeProfile && !profileId && <p className="text-sm text-text-secondary">{m.assign.pickProfileFirst}</p>}
            {listing && (
              <div className="space-y-2">
                <Input id="ota-assign-search" label={m.assign.devices} placeholder={m.assign.searchDevices} value={search} onChange={(e) => setSearch(e.target.value)} />
                <DataTable<DeviceRow>
                  columns={deviceColumns}
                  rows={found as DeviceRow[]}
                  mode="static"
                  variant="plain"
                  searchable={false}
                  caption={m.assign.devices}
                  rowId={(r) => r.id}
                  selectable
                  rowSelectLabel={(r) => r.name}
                  selectedRowIds={picked}
                  onSelectionChange={(ids) => setPicked(targetType === 'DEVICE' ? ids.filter((id) => !picked.includes(id)).slice(-1) : ids)}
                  pageSize={10}
                />
                {targetType === 'GROUP' && picked.length > 0 && <p className="text-sm text-text-secondary">{fill(m.assign.selectedDevices, { n: picked.length })}</p>}
              </div>
            )}
          </>
        )}
        {lines && preview && (
          <section className="space-y-2 rounded-md border border-border bg-surface-sunken p-3 text-sm" aria-live="polite" data-ota-preview>
            <h3 className="font-semibold text-text-primary">{m.assign.previewTitle}</h3>
            {preview.devices === 0 ? <p>{m.assign.noDevices}</p> : lines.lines.map((l) => <p key={l}>{l}</p>)}
            {lines.skipped.length > 0 && (
              <>
                <p>{fill(m.assign.previewSkipped, { n: lines.skipped.reduce((a, s) => a + s.n, 0) })}</p>
                <ul className="list-disc pl-5">{lines.skipped.map((s) => <li key={s.reason}>{s.reason}: {s.n}</li>)}</ul>
              </>
            )}
            <p className="text-text-secondary">{m.assign.previewMetered}</p>
            <p className="text-text-secondary">{m.assign.previewApproval}</p>
          </section>
        )}
        {error && <Callout variant="danger" role="alert">{error}</Callout>}
      </div>
      <ConfirmDialog
        open={asking}
        tone="warning"
        title={chosen ? fill(m.assign.confirmTitle, { title: chosen.title, version: chosen.version, n: preview?.devices ?? 0 }) : ''}
        message={m.assign.confirmMessage}
        details={lines ? <ul className="list-disc pl-5 text-sm">{lines.lines.map((l) => <li key={l}>{l}</li>)}{lines.skipped.map((s) => <li key={s.reason}>{s.reason}: {s.n}</li>)}</ul> : undefined}
        confirmLabel={m.assign.submit}
        cancelLabel={m.common.back}
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => void assign()}
      />
    </Drawer>
  );
}
