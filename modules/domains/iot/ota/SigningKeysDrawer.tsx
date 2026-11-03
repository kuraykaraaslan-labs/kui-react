'use client';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { Textarea } from '@/modules/ui/Textarea';
import { fill, formatDateTime } from '../format';
import type { OtaMessagesInput } from './messages';
import type { OtaAdapter } from './ota-adapter';
import { otaErrorText, useOtaText } from './OtaText';
import { OTA_KEY_SCHEMES, type OtaKeyScheme, type OtaSigningKey } from './types';

type Row = OtaSigningKey & Record<string, unknown>;

export interface SigningKeysDrawerProps {
  open: boolean;
  onClose: () => void;
  adapter: OtaAdapter;
  /** The viewer may add and revoke keys (the account owner). */
  canManage?: boolean;
  messages?: OtaMessagesInput;
  locale?: string;
}

/**
 * SigningKeysDrawer — the PUBLIC keys firmware images are checked against (usign `.pub` text or an ESP32 key digest; the platform never
 * holds a private key and never signs). A DataTable (sort, filter by kind and state) with Revoke per key behind a ConfirmDialog that says
 * what it does (its packages are revoked, their updates not yet installing are stopped); the add form below for the owner.
 */
export function SigningKeysDrawer({ open, onClose, adapter, canManage, messages, locale }: SigningKeysDrawerProps) {
  const { m, locale: lang } = useOtaText(messages, locale);
  const [keys, setKeys] = useState<OtaSigningKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheme, setScheme] = useState<OtaKeyScheme>('usign-ed25519');
  const [label, setLabel] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<OtaSigningKey | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    adapter.keys.list(signal).then((k) => { setKeys(k); setError(null); }, (e) => { if (!signal?.aborted) setError(otaErrorText(m, e)); });
  }, [adapter, m]);
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [open, load]);

  async function add() {
    setBusy(true); setError(null); setNotice(null);
    try {
      await adapter.keys.add({ scheme, label: label.trim(), publicKey: publicKey.trim() });
      setLabel(''); setPublicKey('');
      load();
    } catch (e) {
      setError(otaErrorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(k: OtaSigningKey) {
    setBusy(true); setError(null);
    try {
      const r = await adapter.keys.revoke(k.keyId);
      setNotice(fill(m.keys.revokedNotice, { packages: r.revokedPackages, cancelled: r.cancelled }));
      setRevoking(null);
      load();
    } catch (e) {
      setRevoking(null);
      setError(otaErrorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Row>[] = [
    { key: 'label', header: m.keys.label, sortable: true, render: (r) => <span className="font-medium text-text-primary">{r.label}</span> },
    { key: 'scheme', header: m.keys.scheme, sortable: true, render: (r) => m.scheme[r.scheme] ?? r.scheme },
    { key: 'fingerprint', header: m.keys.fingerprint, hideBelow: 'sm', render: (r) => <span className="break-all font-mono text-xs">{r.fingerprint}</span> },
    { key: 'createdAt', header: m.keys.added, sortable: true, hideBelow: 'md', render: (r) => formatDateTime(r.createdAt, { locale: lang }) },
    { key: 'revokedAt', header: m.list.status, render: (r) => (r.revokedAt ? <Badge size="sm" variant="neutral">{m.keys.revoked}</Badge> : <Badge size="sm" variant="success">{m.keys.active}</Badge>) },
  ];
  const filters: DataTableFilterField<Row>[] = [
    { id: 'scheme', label: m.keys.scheme, type: 'select', options: OTA_KEY_SCHEMES.map((s) => ({ value: s, label: m.scheme[s] })), match: (r, v) => !v || r.scheme === v },
    {
      id: 'state', label: m.list.status, type: 'select', options: [{ value: 'active', label: m.keys.active }, { value: 'revoked', label: m.keys.revoked }],
      match: (r, v) => !v || (v === 'revoked' ? !!r.revokedAt : !r.revokedAt),
    },
  ];

  return (
    <Drawer open={open} onClose={onClose} title={m.keys.title} closeLabel={m.common.close} className="w-full max-w-2xl">
      <div className="space-y-4" data-ota-keys>
        <p className="text-sm text-text-secondary">{m.keys.intro}</p>
        {error && <Callout variant="danger" role="alert">{error}</Callout>}
        {notice && <Callout variant="info">{notice}</Callout>}
        <DataTable<Row>
          columns={columns}
          rows={(keys ?? []) as Row[]}
          mode="static"
          variant="plain"
          loading={keys === null && !error}
          caption={m.keys.caption}
          rowId={(r) => r.keyId}
          filterFields={filters}
          defaultSort={[{ key: 'createdAt', dir: 'desc' }]}
          emptyMessage={m.keys.empty}
          rowActions={canManage ? [{ id: 'revoke', label: m.keys.revoke, destructive: true, hidden: (r) => !!r.revokedAt, onClick: (r) => setRevoking(r) }] : undefined}
        />
        {canManage ? (
          <section className="space-y-3 rounded-md border border-border p-3" aria-label={m.keys.add}>
            <h3 className="text-sm font-semibold text-text-primary">{m.keys.add}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="ota-key-label" label={m.keys.label} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} required disabled={busy} />
              <Select id="ota-key-scheme" label={m.keys.scheme} value={scheme} onChange={(e) => setScheme(e.target.value as OtaKeyScheme)} options={OTA_KEY_SCHEMES.map((s) => ({ value: s, label: m.scheme[s] }))} disabled={busy} />
            </div>
            <Textarea id="ota-key-public" label={m.keys.publicKey} hint={m.keys.publicKeyHint} value={publicKey} onChange={(e) => setPublicKey(e.target.value)} rows={3} maxLength={1024} required disabled={busy} />
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => void add()} loading={busy} disabled={busy || !label.trim() || publicKey.trim().length < 16}>{m.keys.add}</Button>
            </div>
          </section>
        ) : <p className="text-sm text-text-secondary">{m.keys.ownerOnly}</p>}
      </div>
      <ConfirmDialog
        open={!!revoking}
        tone="danger"
        title={fill(m.keys.revokeTitle, { label: revoking?.label ?? '' })}
        message={m.keys.revokeMessage}
        confirmLabel={m.keys.revoke}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setRevoking(null)}
        onConfirm={() => { if (revoking) void revoke(revoking); }}
      />
    </Drawer>
  );
}
