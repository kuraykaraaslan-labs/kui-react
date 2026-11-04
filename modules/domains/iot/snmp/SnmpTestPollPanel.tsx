'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableRowAction } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { failureText, fillSnmp, mergeSnmpMessages, type SnmpMessagesInput } from './messages';
import {
  SNMP_SYSTEM_OIDS, SNMP_TEST_POLL_MAX_OIDS, keysOf, mappedPreview, normaliseOid, parseOidList, rowFromVarbind,
  type SnmpMapping, type SnmpScalarRow, type SnmpTestPollDevice, type SnmpTestPollResult, type SnmpTestPollVarbind,
} from './types';

/**
 * SnmpTestPollPanel — the MIB-free test poll (kui-react iot 11.4; NB iot_gateway 11.3): pick a device of the profile (one bound to an SNMP
 * endpoint; the host answers with its stored credentials, never shown), type or paste numeric OIDs (or take the system group, or this
 * mapping's values), run. The answer is a kit DataTable: OID, SNMP type, raw value, the key and scaled value the mapping would store
 * (a rate needs two samples), per-OID errors, and the poll's duration. "Add to mapping" puts an unmapped OID in the mapping with a
 * suggested key and the detected type (`onAdd`; the editor's Save sends it). A refusal for too many test polls shows the retry time.
 */
export type SnmpTestPollPanelProps = {
  devices: readonly SnmpTestPollDevice[];
  /** Runs the poll; throws `SnmpTestPollRetry` for a rate limit, any other error for a failure the host words. */
  onPoll?: (deviceId: string, oids: string[]) => Promise<SnmpTestPollResult>;
  /** The draft mapping, for the mapped key and value of each OID. */
  mapping?: SnmpMapping;
  onAdd?: (row: SnmpScalarRow) => void;
  /** The last answer, kept by the host (the editor previews from it). */
  onResult?: (result: SnmpTestPollResult) => void;
  loading?: boolean;
  messages?: SnmpMessagesInput;
  className?: string;
};

/** Thrown by `onPoll` when the host refused for too many test polls. */
export class SnmpTestPollRetry extends Error {
  constructor(readonly retryAfterS: number) {
    super('test_poll_rate_limited');
    this.name = 'SnmpTestPollRetry';
  }
}

type Row = SnmpTestPollVarbind & { i: number; mappedKey: string | null; mappedValue: string | number | null; rate: boolean };

export function SnmpTestPollPanel({ devices, onPoll, mapping, onAdd, onResult, loading, messages, className }: SnmpTestPollPanelProps) {
  const m = useMemo(() => mergeSnmpMessages(messages), [messages]);
  const ready = devices.filter((d) => !d.blocked);
  const [deviceId, setDeviceId] = useState<string>(ready[0]?.deviceId ?? devices[0]?.deviceId ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SnmpTestPollResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const device = devices.find((d) => d.deviceId === deviceId);
  const parsed = parseOidList(text);
  const rows = mapping?.mapping ?? [];
  const byOid = new Map(rows.map((r) => [normaliseOid(r.oid), r]));

  async function run() {
    if (!onPoll || !deviceId) return;
    const oids = parsed.oids.length ? parsed.oids : SNMP_SYSTEM_OIDS.map((s) => s.oid);
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await onPoll(deviceId, oids);
      setResult(r);
      onResult?.(r);
    } catch (e) {
      setError(e instanceof SnmpTestPollRetry ? fillSnmp(m.test.retryIn, { seconds: e.retryAfterS }) : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const tableRows: Row[] = (result?.varbinds ?? []).map((vb, i) => {
    const row = byOid.get(normaliseOid(vb.oid));
    const p = row ? mappedPreview(row, vb) : null;
    return { ...vb, i, mappedKey: p?.key ?? null, mappedValue: p?.value ?? null, rate: !!p?.rate };
  });
  const columns: Column<Row>[] = [
    { key: 'oid', header: m.test.oid, sortable: true, render: (r) => <span><code className="font-mono text-xs">{r.oid}</code>{r.name && <span className="ml-1.5 text-xs text-text-secondary">{r.name}</span>}</span> },
    { key: 'type', header: m.test.snmpType, sortable: true, hideBelow: 'sm', render: (r) => <code className="font-mono text-xs">{r.type}</code> },
    {
      key: 'value', header: m.test.raw, searchValue: (r) => String(r.value ?? r.error ?? ''),
      render: (r) => (r.error ? <Badge size="sm" variant="warning">{failureText(m, r.error)}</Badge> : <span className="break-all font-mono text-xs">{String(r.value ?? m.common.none)}</span>),
    },
    {
      key: 'mappedKey', header: m.test.mapped, sortable: true, searchValue: (r) => r.mappedKey ?? '',
      render: (r) => (r.mappedKey
        ? <span className="text-xs"><span className="font-medium">{r.mappedKey}</span>{' = '}<span className="font-mono">{r.rate ? m.test.rateNeedsTwo : String(r.mappedValue ?? m.common.none)}</span></span>
        : <span className="text-xs text-text-secondary">{m.test.notMapped}</span>),
    },
  ];
  const actions: DataTableRowAction<Row>[] = onAdd ? [{
    id: 'add', label: m.test.addToMapping,
    disabled: (r) => !!r.mappedKey || !!r.error,
    disabledReason: (r) => (r.mappedKey ? m.test.inMapping : r.error ? failureText(m, r.error) : undefined),
    onClick: (r) => {
      const row = rowFromVarbind(r, keysOf(mapping ?? {}));
      onAdd(row);
      setNotice(fillSnmp(m.test.added, { key: row.key }));
    },
  }] : [];

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-sm text-text-secondary">{m.test.hint}</p>
      <p className="text-xs text-text-secondary" data-testid="snmp-no-mib">{m.test.noMib}</p>
      {!devices.length && !loading ? <Callout variant="note" title={null}>{m.test.noDevices}</Callout> : (
        <>
          <Select id="snmp-test-device" label={m.test.device} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
            options={devices.map((d) => ({ value: d.deviceId, label: [d.name, d.endpointName, d.version].filter(Boolean).join(' · ') }))} />
          {device?.blocked && <Callout variant="warning" title={null}>{fillSnmp(m.test.blocked, { reason: failureText(m, device.blocked) })}</Callout>}
          <Textarea id="snmp-test-oids" label={m.test.oids} hint={fillSnmp(m.test.oidsHint, { max: SNMP_TEST_POLL_MAX_OIDS })} rows={4} value={text} className="font-mono"
            placeholder={SNMP_SYSTEM_OIDS.map((s) => s.oid).join('\n')}
            error={parsed.bad.length ? fillSnmp(m.test.oidsBad, { list: parsed.bad.slice(0, 5).join(', ') }) : undefined}
            onChange={(e) => setText(e.target.value)} />
          {parsed.capped && <p className="text-xs text-warning">{fillSnmp(m.test.oidsCapped, { max: SNMP_TEST_POLL_MAX_OIDS })}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setText(SNMP_SYSTEM_OIDS.map((s) => s.oid).join('\n'))}>{m.test.useDefaults}</Button>
            {rows.length > 0 && <Button variant="ghost" size="sm" onClick={() => setText(rows.map((r) => normaliseOid(r.oid)).slice(0, SNMP_TEST_POLL_MAX_OIDS).join('\n'))}>{m.test.useMapping}</Button>}
            <Button variant="primary" size="sm" loading={busy} disabled={!onPoll || !deviceId || !!device?.blocked || parsed.bad.length > 0} onClick={() => void run()}>
              {busy ? m.test.running : m.test.run}
            </Button>
          </div>
          {!onPoll && <p className="text-xs text-text-secondary">{m.test.cannotRun}</p>}
        </>
      )}
      {error && <Callout variant="danger" title={null}><span role="alert">{error}</span></Callout>}
      {result && !result.ok && result.failure && <Callout variant="danger" title={null}><span role="alert">{fillSnmp(m.test.failed, { reason: failureText(m, result.failure) })}</span></Callout>}
      {result?.warnings?.map((w) => <Callout key={w} variant="warning" title={null}>{(m.test as Record<string, string>)[`warning_${w}`] ?? w}</Callout>)}
      {notice && <p role="status" className="text-xs text-success">{notice}</p>}
      {result && <p className="text-xs text-text-secondary" data-testid="snmp-duration">{fillSnmp(m.test.duration, { ms: result.durationMs })}</p>}
      <DataTable<Row>
        mode="paginated" variant="plain" density="compact" caption={m.test.caption} columns={columns} rows={tableRows} rowId={(r) => `${r.i}:${r.oid}`}
        searchPlaceholder={m.test.search} emptyMessage={m.test.empty} pageSize={20} pageSizeOptions={LIST_PAGE_SIZES}
        rowActions={actions.length ? actions : undefined} messages={{ loading: m.common.loading, retry: m.common.retry }}
        state={busy && !result ? 'loading' : undefined}
      />
    </div>
  );
}
