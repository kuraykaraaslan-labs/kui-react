'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faUpload } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { fill, formatDateTime } from '../format';
import { FirmwareUploadDrawer } from './FirmwareUploadDrawer';
import type { OtaMessagesInput } from './messages';
import { formatBytes, type OtaAdapter } from './ota-adapter';
import { OtaPackageStatusBadge } from './OtaStateBadge';
import { otaErrorText, useOtaText } from './OtaText';
import { SigningKeysDrawer } from './SigningKeysDrawer';
import { OTA_PACKAGE_STATUSES, OTA_PACKAGE_TYPES, OTA_SIGNATURE_SCHEMES, type OtaAbilities, type OtaOption, type OtaPackage } from './types';

type Row = OtaPackage & { profileName: string } & Record<string, unknown>;

export interface FirmwareListViewProps {
  adapter: OtaAdapter;
  can?: OtaAbilities;
  /** Where a package's page is (a row is a link). */
  packageHref?: (packageId: string) => string;
  onOpenPackage?: (packageId: string) => void;
  messages?: OtaMessagesInput;
  locale?: string;
  className?: string;
}

/**
 * FirmwareListView — the account's firmware packages in one DataTable: name, version, type, profile, size, SHA-256 (short), signature,
 * status and upload time, sortable, with filters by status, type, profile and signature and a search over name and version. The header
 * holds "Signing keys" (a drawer) and "Upload firmware" (a drawer); a row opens the package's page.
 */
export function FirmwareListView({ adapter, can = {}, packageHref, onOpenPackage, messages, locale, className }: FirmwareListViewProps) {
  const { m, locale: lang } = useOtaText(messages, locale);
  const [packages, setPackages] = useState<OtaPackage[] | null>(null);
  const [profiles, setProfiles] = useState<OtaOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    adapter.packages.list(ac.signal).then((p) => { setPackages(p); setError(null); }, (e) => { if (!ac.signal.aborted) setError(otaErrorText(m, e)); });
    return () => ac.abort();
  }, [adapter, tick, m]);
  useEffect(() => {
    const ac = new AbortController();
    adapter.profiles(ac.signal).then(setProfiles, () => { /* the profile filter stays empty */ });
    return () => ac.abort();
  }, [adapter]);

  const profileName = useCallback((id: string | null) => (id ? profiles.find((p) => p.id === id)?.name ?? m.common.none : m.common.anyProfile), [profiles, m]);
  const rows = useMemo(() => (packages ?? []).map((p) => ({ ...p, profileName: profileName(p.profileId) }) as Row), [packages, profileName]);

  const columns: Column<Row>[] = [
    {
      key: 'title', header: m.list.name, sortable: true, searchValue: (r) => `${r.title} ${r.version}`,
      render: (r) => (packageHref
        ? <a href={packageHref(r.packageId)} className="font-medium text-primary hover:underline" onClick={(e) => { if (onOpenPackage) { e.preventDefault(); onOpenPackage(r.packageId); } }}>{r.title}</a>
        : <span className="font-medium text-text-primary">{r.title}</span>),
    },
    { key: 'version', header: m.list.version, sortable: true, render: (r) => <span className="font-mono text-xs">{r.version}</span> },
    { key: 'type', header: m.list.type, sortable: true, hideBelow: 'md', render: (r) => m.type[r.type] ?? r.type },
    { key: 'profileName', header: m.list.profile, sortable: true, hideBelow: 'md' },
    { key: 'size', header: m.list.size, sortable: true, align: 'right', hideBelow: 'lg', render: (r) => <span className="tabular-nums">{formatBytes(r.size)}</span> },
    { key: 'checksum', header: m.list.checksum, hideBelow: 'lg', render: (r) => <span className="font-mono text-xs" title={r.checksum}>{r.checksum.slice(0, 12)}…</span> },
    { key: 'signatureScheme', header: m.list.signature, sortable: true, hideBelow: 'lg', render: (r) => m.scheme[r.signatureScheme] ?? r.signatureScheme },
    { key: 'status', header: m.list.status, sortable: true, render: (r) => <OtaPackageStatusBadge status={r.status} messages={m} /> },
    { key: 'createdAt', header: m.list.uploaded, sortable: true, hideBelow: 'sm', render: (r) => <span className="text-text-secondary">{formatDateTime(r.createdAt, { locale: lang })}</span> },
  ];
  const filters: DataTableFilterField<Row>[] = [
    { id: 'status', label: m.list.status, type: 'checkboxes', options: OTA_PACKAGE_STATUSES.map((s) => ({ value: s, label: m.status[s] })), match: (r, v) => !Array.isArray(v) || !v.length || (v as string[]).includes(r.status) },
    { id: 'type', label: m.list.type, type: 'select', options: OTA_PACKAGE_TYPES.map((t) => ({ value: t, label: m.type[t] })), match: (r, v) => !v || r.type === v },
    {
      id: 'profile', label: m.list.profile, type: 'select', options: [{ value: '*', label: m.common.anyProfile }, ...profiles.map((p) => ({ value: p.id, label: p.name }))],
      match: (r, v) => !v || (v === '*' ? r.profileId === null : r.profileId === v),
    },
    { id: 'signature', label: m.list.signature, type: 'select', options: OTA_SIGNATURE_SCHEMES.map((s) => ({ value: s, label: m.scheme[s] })), match: (r, v) => !v || r.signatureScheme === v },
  ];

  return (
    <div className={cn('space-y-4', className)} data-ota-firmware-list>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-text-primary">{m.list.title}</h1>
          <p className="text-sm text-text-secondary">{m.list.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" iconLeft={<FontAwesomeIcon icon={faKey} />} onClick={() => setKeysOpen(true)}>{m.list.keys}</Button>
          {can.managePackages && <Button variant="primary" iconLeft={<FontAwesomeIcon icon={faUpload} />} onClick={() => setUploading(true)}>{m.list.upload}</Button>}
        </div>
      </header>
      {notice && <Callout variant="tip">{notice}</Callout>}
      {error && (
        <Callout variant="danger">
          <p>{error}</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>{m.common.retry}</Button>
        </Callout>
      )}
      <DataTable<Row>
        columns={columns}
        rows={rows}
        mode="static"
        loading={packages === null && !error}
        caption={m.list.caption}
        searchPlaceholder={m.list.search}
        rowId={(r) => r.packageId}
        filterFields={filters}
        defaultSort={[{ key: 'createdAt', dir: 'desc' }]}
        emptyMessage={m.list.empty}
        onRowClick={onOpenPackage ? (r) => onOpenPackage(r.packageId) : undefined}
      />
      <FirmwareUploadDrawer
        open={uploading}
        onClose={() => setUploading(false)}
        adapter={adapter}
        existing={packages ?? []}
        profiles={profiles}
        messages={m}
        onUploaded={(p) => { setUploading(false); setNotice(fill(m.list.uploadedNotice, { title: p.title, version: p.version })); setTick((t) => t + 1); }}
      />
      <SigningKeysDrawer open={keysOpen} onClose={() => setKeysOpen(false)} adapter={adapter} canManage={can.manageKeys} messages={m} />
    </div>
  );
}
