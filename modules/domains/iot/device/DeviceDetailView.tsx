'use client';
import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faPenToSquare, faPowerOff, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { TabGroup, type Tab } from '@/modules/ui/TabGroup';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { iotTopics } from '../api/live';
import { fill, formatDateTime } from '../format';
import type {
  AttributeEntry, AttributeScope, DeviceConnectionInfo, DeviceCredential, DeviceLogFilter, DeviceRecord, IssuedSecret,
} from '../types/device';
import { DeviceAttributeTable } from './DeviceAttributeTable';
import { DeviceLogTimeline } from './DeviceLogTimeline';
import { DeviceCredentialPanel } from './DeviceCredentialPanel';
import { DeviceDetailHeader } from './DeviceDetailHeader';
import { EditDeviceDrawer } from './EditDeviceDrawer';
import { applyStatePatch } from './DeviceListView';
import { useDeviceLog } from './useDeviceLog';

/**
 * DeviceDetailView — one device (phase 01 §1.2, NB iot_device 05 §5.3), read through the adapter: `DeviceDetailHeader` and the
 * tabs Overview, Attributes (with `canReadAttributes`), Credentials (only with `canViewCredentials`; rotate shows the new
 * secret once) and Log (the connection log and the audited changes in one timeline, `DeviceLogTimeline`; a `connections` link opens
 * it too), plus the host's `extraTabs` (tabs other modules contribute: Alarms, Telemetry, RPC, …, ordered
 * by `order`). The header's actions: copy id, Edit (name, label, type, profile, status and additional info, `canEditDevice` and `devices.update`: `EditDeviceDrawer`), Activate
 * for a quarantined device (`canActivateDevice`, OD-1), delete
 * (`canDeleteDevice`), and the host's `actions`. No factory reset exists (OD-8). The connection follows `deviceState(id)` live;
 * without a live source the device is re-read every 30 s.
 */
export type DeviceDetailViewProps = {
  deviceId: string;
  hrefs?: { profile?: (profileId: string) => string };
  extraTabs?: Tab[];
  /** The open tab (e.g. from the URL) and its change. */
  tab?: string;
  onTabChange?: (tab: string) => void;
  /** More header actions from the host (another module's Activate / Release, …). */
  actions?: React.ReactNode;
  onDeleted?: () => void;
  now?: number;
  className?: string;
};

const LOG_PAGE = 50;

/** Tab ids an older link may still carry, and the tab they open now. */
const TAB_ALIASES: Record<string, string> = { connections: 'log' };

export function DeviceDetailView({
  deviceId, hrefs = {}, extraTabs = [], tab, onTabChange, actions, onDeleted, now, className,
}: DeviceDetailViewProps) {
  const adapter = useIotAdapter();
  const api = adapter.devices;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [device, setDevice] = useState<DeviceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback((signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return api.get(deviceId, signal).then(
      (d) => { if (!signal?.aborted) { setDevice(d); setError(null); } },
      (e) => { if (!signal?.aborted) setError(errorMessage(e, m.detail.loadError)); },
    );
  }, [api, deviceId, m.detail.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  useLiveOrPoll({
    key: deviceId,
    subscribe: api ? (live) => live.subscribe({
      ...iotTopics.deviceState(deviceId),
      onLive: (payload) => {
        const p = api.parseState?.(payload);
        if (p && p.deviceId === deviceId) setDevice((d) => (d ? applyStatePatch(d, p) : d));
      },
    }) : undefined,
    poll: () => { void load(); },
  });

  async function copyId() {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* nothing to copy into */ }
  }

  async function activate() {
    if (!api?.activate) return;
    try {
      await api.activate([deviceId]);
      notify({ tone: 'success', message: m.device.activated });
      await load();
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.detail.loadError) });
    }
  }

  async function remove() {
    if (!api?.remove) return;
    try {
      await api.remove(deviceId);
      notify({ tone: 'success', message: m.device.deleted });
      onDeleted?.();
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.detail.loadError) });
    }
  }

  if (!api) return null;
  if (error && !device) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-8 text-center text-sm text-error">
        {error}
        <Button variant="outline" size="sm" onClick={() => void load()}>{m.common.retry}</Button>
      </div>
    );
  }
  if (!device) return <SkeletonText lines={6} label={m.common.loading} className={className} />;

  const tabs: Tab[] = [
    { id: 'overview', label: m.detail.overview, order: 0, content: <Overview device={device} /> },
    ...(caps.canReadAttributes && adapter.attributes ? [{ id: 'attributes', label: m.detail.attributes, order: 10, content: <AttributesTab deviceId={deviceId} now={now} /> }] : []),
    ...(caps.canViewCredentials && adapter.credentials ? [{ id: 'credentials', label: m.detail.credentials, order: 20, content: <CredentialsTab deviceId={deviceId} /> }] : []),
    { id: 'log', label: m.detail.log, order: 30, content: <LogTab deviceId={deviceId} /> },
    ...extraTabs,
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <DeviceDetailHeader
        device={device}
        profileHref={hrefs.profile?.(device.deviceProfileId)}
        now={now}
        actions={(
          <>
            <Button variant="ghost" size="sm" onClick={() => void copyId()} iconLeft={<FontAwesomeIcon icon={copied ? faCheck : faCopy} className="h-3 w-3" aria-hidden="true" />}>
              {copied ? m.common.copied : m.device.copyId}
            </Button>
            {caps.canEditDevice && api.update && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} iconLeft={<FontAwesomeIcon icon={faPenToSquare} className="h-3 w-3" aria-hidden="true" />}>
                {m.editDevice.action}
              </Button>
            )}
            {device.status === 'QUARANTINED' && caps.canActivateDevice && api.activate && (
              <Button variant="primary" size="sm" onClick={() => void activate()} iconLeft={<FontAwesomeIcon icon={faPowerOff} className="h-3 w-3" aria-hidden="true" />}>
                {m.device.activate}
              </Button>
            )}
            {actions}
            {caps.canDeleteDevice && api.remove && (
              <Button onClick={() => { void confirmDialog({ title: m.device.deleteConfirm, message: m.device.deleteHint, tone: 'danger', confirmLabel: m.device.delete, cancelLabel: m.common.cancel }).then((ok) => { if (ok) void remove(); }); }} variant="ghost" size="sm" iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}>
                    {m.device.delete}
                  </Button>
            )}
          </>
        )}
      />
      {caps.canEditDevice && api.update && (
        <EditDeviceDrawer open={editing} device={device} onClose={() => setEditing(false)} onSaved={() => { void load(); }} />
      )}
      <TabGroup tabs={tabs} defaultTab={tab ? (TAB_ALIASES[tab] ?? tab) : undefined} onTabChange={onTabChange} label={m.detail.tabs} lazy isolate retryLabel={m.common.retry} errorLabel={m.common.loadFailed} errorDetail={m.common.loadFailedDetail} />
    </div>
  );
}

function Overview({ device }: { device: DeviceRecord }) {
  const { m, locale } = useIotText();
  const at = (v: DeviceRecord['lastActivityAt']) => formatDateTime(v, { locale });
  const rows: Array<[string, React.ReactNode]> = [
    [m.device.label, device.label || '—'],
    [m.device.type, device.type || '—'],
    [m.device.serial, device.serial ? <code className="font-mono">{device.serial}</code> : '—'],
    [m.device.firmware, [device.fwTitle, device.fwVersion].filter(Boolean).join(' ') || '—'],
    [m.device.gateway, device.isGateway ? m.common.yes : m.common.no],
    [m.device.lastActivity, at(device.lastActivityAt)],
    [m.device.lastConnect, at(device.lastConnectAt)],
    [m.device.lastDisconnectAt, device.lastDisconnectAt
      ? `${at(device.lastDisconnectAt)}${device.lastDisconnectReason ? ` · ${fill(m.connection.reason, { reason: device.lastDisconnectReason })}` : ''}`
      : '—'],
    [m.device.created, at(device.createdAt)],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-raised p-4 text-sm sm:grid-cols-2 sm:p-5">
      {rows.map(([term, value]) => (
        <div key={term} className="min-w-0">
          <dt className="text-xs text-text-secondary">{term}</dt>
          <dd className="break-words text-text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AttributesTab({ deviceId, now }: { deviceId: string; now?: number }) {
  const api = useIotAdapter().attributes!;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [entries, setEntries] = useState<Partial<Record<AttributeScope, AttributeEntry[]>>>({});
  const [loading, setLoading] = useState<Partial<Record<AttributeScope, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<AttributeScope, string | null>>>({});

  const read = useCallback(async (scope: AttributeScope) => {
    setLoading((l) => ({ ...l, [scope]: true }));
    try {
      const list = await api.list(deviceId, scope);
      setEntries((e) => ({ ...e, [scope]: list }));
      setErrors((e) => ({ ...e, [scope]: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, [scope]: errorMessage(err, m.detail.loadError) }));
    } finally {
      setLoading((l) => ({ ...l, [scope]: false }));
    }
  }, [api, deviceId, m.detail.loadError]);

  return (
    <DeviceAttributeTable
      entries={entries}
      loading={loading}
      errors={errors}
      canWrite={caps.canWriteAttributes}
      onScopeOpen={(s) => void read(s)}
      onRetry={(s) => void read(s)}
      onSave={async (scope, key, value) => {
        await api.save(deviceId, scope, { [key]: value });
        notify({ tone: 'success', message: m.attribute.saved });
        await read(scope);
      }}
      onDelete={async (scope, key) => {
        try {
          await api.remove(deviceId, scope, [key]);
          notify({ tone: 'success', message: m.attribute.removed });
          await read(scope);
        } catch (e) {
          notify({ tone: 'error', message: errorMessage(e, m.detail.loadError) });
        }
      }}
      now={now}
    />
  );
}

function CredentialsTab({ deviceId }: { deviceId: string }) {
  const api = useIotAdapter().credentials!;
  const notify = useIotNotify();
  const { m } = useIotText();
  const [credential, setCredential] = useState<DeviceCredential | null>(null);
  const [loading, setLoading] = useState(true);
  // the one-time secret: only in this tab's state, dropped when dismissed or when the tab goes away
  const [secret, setSecret] = useState<IssuedSecret | null>(null);
  const [connection, setConnection] = useState<DeviceConnectionInfo | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api.get(deviceId, ctrl.signal)
      .then((c) => { if (!ctrl.signal.aborted) setCredential(c); })
      .catch((e) => { if (!ctrl.signal.aborted) notify({ tone: 'error', message: errorMessage(e, m.detail.loadError) }); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    // the connection card is a help, not the tab's content: without it the tab works as before
    api.connection?.(deviceId, ctrl.signal).then((c) => { if (!ctrl.signal.aborted) setConnection(c); }, () => undefined);
    return () => ctrl.abort();
  }, [api, deviceId, notify, m.detail.loadError]);

  return (
    <DeviceCredentialPanel
      credential={credential}
      loading={loading}
      secret={secret}
      connection={connection}
      onSecretDismiss={() => setSecret(null)}
      onRotate={async () => {
        try {
          const res = await api.rotate(deviceId);
          setCredential(res.credential);
          setSecret(res.secret);
          notify({ tone: 'success', message: m.credential.rotated_ok });
        } catch (e) {
          notify({ tone: 'error', message: errorMessage(e, m.detail.loadError) });
        }
      }}
    />
  );
}

function LogTab({ deviceId }: { deviceId: string }) {
  const api = useIotAdapter().devices!;
  const { m } = useIotText();
  const [filter, setFilter] = useState<DeviceLogFilter>('all');
  const log = useDeviceLog(api, deviceId, { pageSize: LOG_PAGE, filter, errorText: m.detail.loadError });

  return (
    <div className="space-y-3">
      {log.error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-error">
          {log.error}
          <Button variant="outline" size="sm" onClick={log.reload}>{m.common.retry}</Button>
        </div>
      )}
      <DeviceLogTimeline
        entries={log.entries}
        loading={log.loading && !log.error}
        hasMore={log.entries.length < log.total}
        onLoadMore={log.more}
        filter={filter}
        onFilterChange={setFilter}
        sources={log.sources}
      />
    </div>
  );
}
