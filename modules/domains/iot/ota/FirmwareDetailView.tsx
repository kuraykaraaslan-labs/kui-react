'use client';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Spinner } from '@/modules/ui/Spinner';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { Textarea } from '@/modules/ui/Textarea';
import { fill, formatDateTime } from '../format';
import type { OtaMessagesInput } from './messages';
import { formatBytes, type OtaAdapter } from './ota-adapter';
import { OtaAssignDrawer } from './OtaAssignDrawer';
import { OtaRolloutView } from './OtaRolloutView';
import { OtaPackageStatusBadge } from './OtaStateBadge';
import { otaErrorText, useOtaText } from './OtaText';
import type { OtaAbilities, OtaAssignment, OtaOption, OtaPackage, OtaSigningKey, OtaState } from './types';

type AssignmentRow = OtaAssignment & Record<string, unknown>;
type Ask = 'retire' | 'revoke' | 'delete' | { remove: OtaAssignment } | null;

export interface FirmwareDetailViewProps {
  adapter: OtaAdapter;
  packageId: string;
  can?: OtaAbilities;
  backHref?: string;
  deviceHref?: (deviceId: string) => string;
  /** After a delete (the host goes back to the list). */
  onDeleted?: () => void;
  messages?: OtaMessagesInput;
  locale?: string;
  className?: string;
}

/**
 * FirmwareDetailView — one package: its status, details (type, size, SHA-256, the signature and the key it verified with, the profile,
 * hardware models, the lowest version it updates from), release notes (editable), where it is assigned (a DataTable; Remove behind a
 * ConfirmDialog) and its devices (`OtaRolloutView`). The header holds Assign (a drawer), Retire / Offer again, Revoke and Delete, each
 * asked through the ConfirmDialog in words that say what happens.
 */
export function FirmwareDetailView({ adapter, packageId, can = {}, backHref, deviceHref, onDeleted, messages, locale, className }: FirmwareDetailViewProps) {
  const { m, locale: lang } = useOtaText(messages, locale);
  const [pkg, setPkg] = useState<OtaPackage | null>(null);
  const [counts, setCounts] = useState<Partial<Record<OtaState, number>>>({});
  const [assignments, setAssignments] = useState<OtaAssignment[] | null>(null);
  const [profiles, setProfiles] = useState<OtaOption[]>([]);
  const [keys, setKeys] = useState<OtaSigningKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [assigning, setAssigning] = useState(false);
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([adapter.packages.get(packageId, ac.signal), adapter.assignments.list({ packageId }, ac.signal)]).then(([g, a]) => {
      setPkg(g.package); setCounts(g.states); setAssignments(a); setError(null);
    }, (e) => { if (!ac.signal.aborted) setError(otaErrorText(m, e)); });
    return () => ac.abort();
  }, [adapter, packageId, tick, m]);
  useEffect(() => {
    const ac = new AbortController();
    adapter.profiles(ac.signal).then(setProfiles, () => setProfiles([]));
    adapter.keys.list(ac.signal).then(setKeys, () => setKeys([]));
    return () => ac.abort();
  }, [adapter]);

  const act = useCallback(async (run: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setError(null);
    try {
      await run();
      setAsk(null);
      after?.();
      setTick((t) => t + 1);
    } catch (e) {
      setAsk(null);
      setError(otaErrorText(m, e));
    } finally {
      setBusy(false);
    }
  }, [m]);

  if (!pkg) {
    return error
      ? <Callout variant="danger" className={className}><p>{error}</p><Button className="mt-2" size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>{m.common.retry}</Button></Callout>
      : <div className={cn('flex justify-center p-6', className)} role="status" aria-label={m.common.loading}><Spinner label={null} /></div>;
  }

  const key = keys.find((k) => k.keyId === pkg.signingKeyId);
  const signature = pkg.signatureScheme === 'none' ? m.detail.unsigned
    : `${m.scheme[pkg.signatureScheme]} · ${key ? fill(m.detail.verifiedWith, { key: key.label }) : m.detail.verifiedWithUnknown}`;
  const profileName = pkg.profileId ? profiles.find((p) => p.id === pkg.profileId)?.name ?? m.common.none : m.common.anyProfile;
  const facts: Array<[string, React.ReactNode]> = [
    [m.detail.type, m.type[pkg.type]],
    [m.detail.size, formatBytes(pkg.size)],
    [m.detail.checksum, <span key="c" className="break-all font-mono text-xs">{pkg.checksum}</span>],
    [m.detail.signature, signature],
    [m.detail.profile, profileName],
    [m.detail.hardware, pkg.hardwareModels.length ? pkg.hardwareModels.join(', ') : m.common.none],
    [m.detail.minFrom, pkg.minFromVersion ?? m.detail.anyVersion],
    [m.detail.uploaded, formatDateTime(pkg.createdAt, { locale: lang })],
  ];
  const targetLabel = (a: OtaAssignment) => (a.targetType === 'PROFILE' ? m.detail.targetProfile : a.targetType === 'DEVICE' ? m.detail.targetDevice : m.detail.targetGroup);
  const columns: Column<AssignmentRow>[] = [
    { key: 'targetType', header: m.detail.target, sortable: true, render: (r) => targetLabel(r) },
    {
      key: 'targetName', header: m.rollout.device, sortable: true,
      render: (r) => (
        <span>
          {r.targetType === 'GROUP' ? fill(m.detail.groupOf, { n: r.deviceCount ?? 0 })
            : r.targetType === 'DEVICE' && deviceHref ? <a href={deviceHref(r.targetId)} className="text-primary hover:underline">{r.targetName ?? r.targetId}</a>
              : r.targetName ?? r.targetId}
          {r.rolloutId ? <span className="text-text-secondary"> · {m.detail.inWaves}</span> : null}
        </span>
      ),
    },
    { key: 'createdAt', header: m.detail.since, sortable: true, hideBelow: 'sm', render: (r) => formatDateTime(r.createdAt, { locale: lang }) },
  ];
  const filters: DataTableFilterField<AssignmentRow>[] = [
    {
      id: 'targetType', label: m.detail.target, type: 'select',
      options: [{ value: 'PROFILE', label: m.detail.targetProfile }, { value: 'GROUP', label: m.detail.targetGroup }, { value: 'DEVICE', label: m.detail.targetDevice }],
      match: (r, v) => !v || r.targetType === v,
    },
  ];
  const title = { title: pkg.title, version: pkg.version };

  return (
    <div className={cn('space-y-5', className)} data-ota-package={pkg.packageId}>
      {backHref && <a href={backHref} className="text-sm text-text-secondary hover:text-text-primary">← {m.detail.back}</a>}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold text-text-primary">{pkg.title} <span className="font-mono text-base text-text-secondary">{pkg.version}</span></h1>
          <OtaPackageStatusBadge status={pkg.status} messages={m} />
        </div>
        <div className="flex flex-wrap gap-2">
          {can.assign && pkg.status === 'READY' && <Button variant="primary" onClick={() => setAssigning(true)}>{m.detail.assign}</Button>}
          {can.managePackages && pkg.status === 'READY' && <Button variant="outline" onClick={() => setAsk('retire')}>{m.detail.retire}</Button>}
          {can.managePackages && pkg.status === 'DEPRECATED' && <Button variant="outline" onClick={() => void act(() => adapter.packages.update(pkg.packageId, { status: 'READY' }))} disabled={busy}>{m.detail.ready}</Button>}
          {can.managePackages && (pkg.status === 'READY' || pkg.status === 'DEPRECATED') && <Button variant="danger" onClick={() => setAsk('revoke')}>{m.detail.revoke}</Button>}
          {can.managePackages && <Button variant="ghost" onClick={() => setAsk('delete')}>{m.detail.delete}</Button>}
        </div>
      </header>
      {pkg.status === 'DRAFT' && <Callout variant="info">{m.detail.draft}</Callout>}
      {pkg.status === 'REJECTED' && <Callout variant="danger">{fill(m.detail.rejected, { reason: pkg.rejectReason ?? m.common.none })}</Callout>}
      {notice && <Callout variant="tip">{notice}</Callout>}
      {error && <Callout variant="danger" role="alert">{error}</Callout>}
      <section className="rounded-lg border border-border bg-surface-raised p-4" aria-label={m.detail.details}>
        <h2 className="mb-3 text-base font-semibold text-text-primary">{m.detail.details}</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-text-secondary">{k}</dt>
              <dd className="text-sm text-text-primary">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">{m.detail.notes}</h3>
            {can.managePackages && notes === null && <Button size="xs" variant="ghost" onClick={() => setNotes(pkg.releaseNotes ?? '')}>{m.detail.editNotes}</Button>}
          </div>
          {notes === null ? (
            <p className="whitespace-pre-line text-sm text-text-secondary">{pkg.releaseNotes || m.detail.noNotes}</p>
          ) : (
            <div className="space-y-2">
              <Textarea id="ota-notes" label={m.detail.notes} value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={4000} disabled={busy} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setNotes(null)} disabled={busy}>{m.common.cancel}</Button>
                <Button size="sm" variant="primary" loading={busy} onClick={() => void act(() => adapter.packages.update(pkg.packageId, { releaseNotes: notes.trim() || null }), () => setNotes(null))}>{m.common.save}</Button>
              </div>
            </div>
          )}
        </div>
      </section>
      <DataTable<AssignmentRow>
        columns={columns}
        rows={(assignments ?? []) as AssignmentRow[]}
        mode="static"
        variant="plain"
        loading={assignments === null}
        title={m.detail.assignments}
        caption={m.detail.assignmentsCaption}
        searchable={false}
        rowId={(r) => r.assignmentId}
        filterFields={filters}
        defaultSort={[{ key: 'createdAt', dir: 'desc' }]}
        emptyMessage={m.detail.noAssignments}
        rowActions={can.assign ? [{ id: 'remove', label: m.detail.remove, destructive: true, onClick: (r) => setAsk({ remove: r }) }] : undefined}
      />
      <OtaRolloutView
        adapter={adapter} packageId={pkg.packageId} counts={counts} canRetry={can.assign} canManageRollouts={can.assign} title={pkg.title} version={pkg.version}
        deviceHref={deviceHref} reloadKey={tick} messages={m} locale={lang}
      />
      <OtaAssignDrawer
        open={assigning}
        onClose={() => setAssigning(false)}
        adapter={adapter}
        pkg={pkg}
        messages={m}
        onAssigned={() => { setAssigning(false); setNotice(m.assign.done); setTick((t) => t + 1); }}
      />
      <ConfirmDialog
        open={ask === 'retire'}
        tone="warning"
        title={fill(m.detail.retireTitle, title)}
        message={m.detail.retireMessage}
        confirmLabel={m.detail.retire}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => void act(() => adapter.packages.update(pkg.packageId, { status: 'DEPRECATED' }))}
      />
      <ConfirmDialog
        open={ask === 'revoke'}
        tone="danger"
        title={fill(m.detail.revokeTitle, title)}
        message={m.detail.revokeMessage}
        confirmLabel={m.detail.revoke}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => void act(() => adapter.packages.update(pkg.packageId, { status: 'REVOKED' }))}
      />
      <ConfirmDialog
        open={ask === 'delete'}
        tone="danger"
        title={fill(m.detail.deleteTitle, title)}
        message={m.detail.deleteMessage}
        confirmLabel={m.detail.delete}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => void act(() => adapter.packages.remove(pkg.packageId), onDeleted)}
      />
      <ConfirmDialog
        open={typeof ask === 'object' && ask !== null}
        tone="warning"
        title={m.detail.removeTitle}
        message={m.detail.removeMessage}
        confirmLabel={m.detail.remove}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => { if (typeof ask === 'object' && ask) void act(() => adapter.assignments.remove(ask.remove.assignmentId)); }}
      />
    </div>
  );
}
