'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faPenToSquare, faPowerOff, faShieldHalved, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { TabGroup, type Tab } from '@/modules/ui/TabGroup';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { iotTopics } from '../api/live';
import { fill, formatDateTime, plural } from '../format';
import type {
  AttributeEntry, AttributeScope, DeviceConnectionInfo, DeviceCredential, DeviceLogFilter, DeviceRecord, IssuedSecret,
} from '../types/device';
import { DeviceAttributeTable } from './DeviceAttributeTable';
import { DeviceLogTimeline } from './DeviceLogTimeline';
import { DeviceCredentialPanel, useLeaveGuard } from './DeviceCredentialPanel';
import { disconnectReasonText } from './DeviceConnectionBadge';
import { DeviceDetailHeader } from './DeviceDetailHeader';
import { EditDeviceDrawer } from './EditDeviceDrawer';
import { applyStatePatch, LIVE_REREAD_MS } from './DeviceListView';
import { SetCredentialDrawer } from './SetCredentialDrawer';
import { useDeviceLog } from './useDeviceLog';

/**
 * DeviceDetailView — one device (phase 01 §1.2, NB iot_device 05 §5.3), read through the adapter: `DeviceDetailHeader` and the
 * tabs Overview, Attributes (with `canReadAttributes`), Credentials (only with `canViewCredentials`, and not for a device whose record
 * says `deviceCredentials: false`; rotate shows the new secret once) and Log (the connection log and the audited changes in one timeline, `DeviceLogTimeline`; a `connections` link opens
 * it too), plus the host's `extraTabs` (tabs other modules contribute: Alarms, Telemetry, RPC, …, ordered
 * by `order`). The header's actions: copy id, Edit (name, label, type, profile, status and additional info, `canEditDevice` and `devices.update`: `EditDeviceDrawer`), Activate
 * for a quarantined device (`canActivateDevice`, OD-1), delete
 * (`canDeleteDevice`), and the host's `actions`. No factory reset exists (OD-8). The connection follows `deviceState(id)` live;
 * without a live source the device is re-read every 30 s.
 *
 * NB 41-ui-fixes/22: the Credentials tab gives the device a credential, switches its type or revokes it (`SetCredentialDrawer`,
 * `credentials.set` / `revoke`), and leaving the page with a new secret not yet stored asks first. Delete names the device and what goes
 * with it (`devices.deleteImpact`: its reading bindings) and that its history stays, and runs once. A quarantined device links to the
 * host's quarantine page (`hrefs.quarantine`). While live the device is still re-read about every minute (not while the tab is hidden),
 * a failed re-read says the page may be out of date, a connection change refreshes the log, and the attributes are read again when the
 * window regains focus. A failed capabilities read says so with a retry; the log says when the changes could not be read.
 */
export type DeviceDetailViewProps = {
  deviceId: string;
  hrefs?: {
    profile?: (profileId: string) => string;
    /** The host's page of devices waiting in quarantine (where a quarantined device is approved), linked with `canActivateDevice`. */
    quarantine?: (deviceId: string) => string;
    /** The page of the certificate an X.509 credential is bound to. */
    certificate?: (certificateId: string) => string;
  };
  /** Opens a link (the profile, the quarantine page) in the host's router on a plain click. */
  onOpen?: (href: string) => void;
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
/** How long the delete confirm waits for the reading-binding count before it says "if it has any" (41-ui-fixes/22 C10). */
export const DELETE_COUNT_MS = 5_000;
/** Focus and visibility changes within this pause read the attributes once (C3). */
const REREAD_DEBOUNCE_MS = 300;

/** The promise's answer, or a rejection after `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Tab ids an older link may still carry, and the tab they open now. */
const TAB_ALIASES: Record<string, string> = { connections: 'log' };

/** What a plain click opens through the host's router; any other click keeps the link's own behaviour. */
function plainClick(e: React.MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function DeviceDetailView({
  deviceId, hrefs = {}, onOpen, extraTabs = [], tab, onTabChange, actions, onDeleted, now, className,
}: DeviceDetailViewProps) {
  const adapter = useIotAdapter();
  const api = adapter.devices;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale, timeZone } = useIotText();
  const [device, setDevice] = useState<DeviceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  // when the shown record was read, and whether the newest re-read failed (the record may be out of date then)
  const [readAt, setReadAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [counting, setCounting] = useState(false);
  const [activating, setActivating] = useState(false);
  // a live connection change: the log reads its newest page again
  const [stateTick, setStateTick] = useState(0);

  const load = useCallback((signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return api.get(deviceId, signal).then(
      (d) => { if (!signal?.aborted) { setDevice(d); setError(null); setReadAt(Date.now()); } },
      (e) => { if (!signal?.aborted) setError(errorMessage(e, m.detail.loadError)); },
    );
  }, [api, deviceId, m.detail.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  const state = useLiveOrPoll({
    key: deviceId,
    subscribe: api ? (live) => live.subscribe({
      ...iotTopics.deviceState(deviceId),
      onLive: (payload) => {
        const p = api.parseState?.(payload);
        if (p && p.deviceId === deviceId) {
          setDevice((d) => (d ? applyStatePatch(d, p) : d));
          setStateTick((n) => n + 1);
        }
      },
    }) : undefined,
    poll: () => { void load(); },
  });

  // while live, the patches carry the connection only: the rest of the record (an edit elsewhere, a new firmware) is read again slowly
  useEffect(() => {
    if (state !== 'live') return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void load();
    }, LIVE_REREAD_MS);
    return () => clearInterval(id);
  }, [state, load]);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* nothing to copy into */ }
  }

  async function activate() {
    if (!api?.activate || activating) return;
    setActivating(true);
    try {
      await api.activate([deviceId]);
      notify({ tone: 'success', message: m.device.activated });
      await load();
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.device.activateFailed) });
    } finally {
      setActivating(false);
    }
  }

  /** The delete confirm names the device, what goes with it (its reading bindings, when the host counts them) and what stays. */
  const removing = useRef(false);
  async function askRemove() {
    if (!api?.remove || removing.current || !device) return;
    // one delete at a time: a second click while the confirm is open or the request runs does nothing
    removing.current = true;
    try {
      let bindings: number | null | undefined;
      if (api.deleteImpact) {
        // the button is busy while the bindings are counted; a count that takes longer than DELETE_COUNT_MS is not waited for
        setCounting(true);
        try {
          bindings = await withTimeout(api.deleteImpact(deviceId).then((r) => r.readingBindings), DELETE_COUNT_MS);
        } catch {
          bindings = null; // not counted: the confirm says "if it has any"
        } finally {
          setCounting(false);
        }
      }
      const goes = bindings === undefined ? null
        : typeof bindings === 'number' ? (bindings > 0 ? plural(bindings, { one: m.device.deleteBindings_one, other: m.device.deleteBindings_other }, locale) : null)
          : m.device.deleteBindingsUnknown;
      const ok = await confirmDialog({
        title: fill(m.device.deleteConfirm, { name: device.name }),
        message: [m.device.deleteHint, goes].filter(Boolean).join(' '),
        tone: 'danger', confirmLabel: m.device.delete, cancelLabel: m.common.cancel,
      });
      if (!ok) return;
      setDeleting(true);
      try {
        await api.remove(deviceId);
        notify({ tone: 'success', message: m.device.deleted });
        onDeleted?.();
      } catch (e) {
        notify({ tone: 'error', message: errorMessage(e, m.device.deleteFailed) });
      } finally {
        setDeleting(false);
      }
    } finally {
      removing.current = false;
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
    // a device that does not log in itself (its record says `deviceCredentials: false`) has no credential to show or rotate
    ...(caps.canViewCredentials && adapter.credentials && device.deviceCredentials !== false ? [{ id: 'credentials', label: m.detail.credentials, order: 20, content: <CredentialsTab device={device} certificateHref={hrefs.certificate} /> }] : []),
    { id: 'log', label: m.detail.log, order: 30, content: <LogTab deviceId={deviceId} stateTick={stateTick} /> },
    ...extraTabs,
  ];
  // the quarantine page is where a quarantined device is approved: linked for a viewer who may approve it (41-ui-fixes/22 C7)
  const quarantineHref = device.status === 'QUARANTINED' && caps.canActivateDevice ? hrefs.quarantine?.(deviceId) : undefined;

  return (
    <div className={cn('space-y-4', className)}>
      {caps.failed && (
        <Callout variant="warning" title={null}>
          <span className="flex flex-wrap items-center gap-2">
            {m.common.capabilitiesError}
            <Button variant="outline" size="xs" onClick={caps.retry}>{m.common.retry}</Button>
          </span>
        </Callout>
      )}
      {error && (
        <Callout variant="warning" title={null}>
          <span role="status" className="flex flex-wrap items-center gap-2">
            {fill(m.common.staleRead, { time: formatDateTime(readAt, { locale, timeZone }) })}
            <Button variant="outline" size="xs" onClick={() => void load()}>{m.common.retry}</Button>
          </span>
        </Callout>
      )}
      <DeviceDetailHeader
        device={device}
        profileHref={hrefs.profile?.(device.deviceProfileId)}
        onOpen={onOpen}
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
              <Button variant="primary" size="sm" loading={activating} disabled={activating} onClick={() => void activate()} iconLeft={<FontAwesomeIcon icon={faPowerOff} className="h-3 w-3" aria-hidden="true" />}>
                {m.device.activate}
              </Button>
            )}
            {quarantineHref && (
              <Button as="a" href={quarantineHref} variant="outline" size="sm"
                onClick={onOpen ? (e: React.MouseEvent) => { if (plainClick(e)) { e.preventDefault(); onOpen(quarantineHref); } } : undefined}
                iconLeft={<FontAwesomeIcon icon={faShieldHalved} className="h-3 w-3" aria-hidden="true" />}>
                {m.device.quarantineLink}
              </Button>
            )}
            {actions}
            {caps.canDeleteDevice && api.remove && (
              <Button onClick={() => void askRemove()} variant="ghost" size="sm" loading={deleting || counting} disabled={deleting || counting} iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}>
                {m.device.delete}
              </Button>
            )}
          </>
        )}
      />
      {caps.canEditDevice && api.update && (
        <EditDeviceDrawer open={editing} device={device} onClose={() => setEditing(false)} onSaved={(saved) => { setDevice((d) => (d ? { ...d, ...saved } : saved)); void load(); }} />
      )}
      <TabGroup tabs={tabs} defaultTab={tab ? (TAB_ALIASES[tab] ?? tab) : undefined} onTabChange={onTabChange} label={m.detail.tabs} lazy isolate retryLabel={m.common.retry} errorLabel={m.common.loadFailed} errorDetail={m.common.loadFailedDetail} />
    </div>
  );
}

function Overview({ device }: { device: DeviceRecord }) {
  const { m, locale, timeZone } = useIotText();
  const at = (v: DeviceRecord['lastActivityAt']) => formatDateTime(v, { locale, timeZone });
  const rows: Array<[string, React.ReactNode]> = [
    [m.device.label, device.label || '—'],
    [m.device.type, device.type || '—'],
    [m.device.serial, device.serial ? <code className="font-mono">{device.serial}</code> : '—'],
    [m.device.firmware, [device.fwTitle, device.fwVersion].filter(Boolean).join(' ') || '—'],
    [m.device.gateway, device.isGateway ? m.common.yes : m.common.no],
    [m.device.lastActivity, at(device.lastActivityAt)],
    [m.device.lastConnect, at(device.lastConnectAt)],
    [m.device.lastDisconnectAt, device.lastDisconnectAt
      ? `${at(device.lastDisconnectAt)}${device.lastDisconnectReason ? ` · ${fill(m.connection.reason, { reason: disconnectReasonText(m, device.lastDisconnectReason) })}` : ''}`
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
  const { m, locale, timeZone } = useIotText();
  const [entries, setEntries] = useState<Partial<Record<AttributeScope, AttributeEntry[]>>>({});
  const [loading, setLoading] = useState<Partial<Record<AttributeScope, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<AttributeScope, string | null>>>({});
  // a background re-read that failed: the rows read before stay, with a line saying when they were read (41-ui-fixes/22 C3)
  const [stale, setStale] = useState<Partial<Record<AttributeScope, string | null>>>({});
  const readAt = useRef<Partial<Record<AttributeScope, number>>>({});
  // every read of a scope takes a number; only the newest one's answer is kept (a slow focus read never overwrites a save's)
  const seq = useRef<Partial<Record<AttributeScope, number>>>({});
  const shown = useRef<Partial<Record<AttributeScope, boolean>>>({});

  // the scopes opened so far: read again when the window comes back (another tab or a device may have changed them)
  const opened = useRef(new Set<AttributeScope>());
  const read = useCallback(async (scope: AttributeScope, background = false) => {
    opened.current.add(scope);
    const mine = (seq.current[scope] ?? 0) + 1;
    seq.current[scope] = mine;
    const quiet = background && shown.current[scope];
    if (!quiet) setLoading((l) => ({ ...l, [scope]: true }));
    try {
      const list = await api.list(deviceId, scope);
      if (seq.current[scope] !== mine) return;
      shown.current[scope] = true;
      readAt.current[scope] = Date.now();
      setEntries((e) => ({ ...e, [scope]: list }));
      setErrors((e) => ({ ...e, [scope]: null }));
      setStale((x) => ({ ...x, [scope]: null }));
    } catch (err) {
      if (seq.current[scope] !== mine) return;
      if (quiet) setStale((x) => ({ ...x, [scope]: fill(m.common.staleRead, { time: formatDateTime(readAt.current[scope] ?? null, { locale, timeZone }) }) }));
      else setErrors((e) => ({ ...e, [scope]: errorMessage(err, m.detail.loadError) }));
    } finally {
      if (!quiet && seq.current[scope] === mine) setLoading((l) => ({ ...l, [scope]: false }));
    }
  }, [api, deviceId, m.detail.loadError, m.common.staleRead, locale, timeZone]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // focus and visibilitychange come together: one read per scope after a short pause
    let timer: ReturnType<typeof setTimeout> | undefined;
    const again = () => {
      if (document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      timer = setTimeout(() => { for (const scope of opened.current) void read(scope, true); }, REREAD_DEBOUNCE_MS);
    };
    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', again);
    return () => { clearTimeout(timer); window.removeEventListener('focus', again); document.removeEventListener('visibilitychange', again); };
  }, [read]);

  return (
    <DeviceAttributeTable
      entries={entries}
      loading={loading}
      errors={errors}
      stale={stale}
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
          notify({ tone: 'error', message: errorMessage(e, m.attribute.deleteFailed) });
        }
      }}
      now={now}
    />
  );
}

function CredentialsTab({ device, certificateHref }: { device: DeviceRecord; certificateHref?: (certificateId: string) => string }) {
  const api = useIotAdapter().credentials!;
  const notify = useIotNotify();
  const { m } = useIotText();
  const deviceId = device.deviceId;
  const [credential, setCredential] = useState<DeviceCredential | null>(null);
  const [loading, setLoading] = useState(true);
  // a failed read is unknown, never "no active credential" (41-ui-fixes/22 4.1)
  const [readError, setReadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // the one-time secret: only in this tab's state, dropped when dismissed or when the tab goes away
  const [secret, setSecret] = useState<IssuedSecret | null>(null);
  const [connection, setConnection] = useState<DeviceConnectionInfo | null>(null);
  const [setting, setSetting] = useState(false);
  // leaving the page while a new secret is not stored asks first (the tab itself stays mounted when another tab opens)
  useLeaveGuard(!!secret, { message: m.credential.leaveUnstored, leave: m.credential.leave, stay: m.credential.stay });

  useEffect(() => {
    const ctrl = new AbortController();
    api.get(deviceId, ctrl.signal)
      .then((c) => { if (!ctrl.signal.aborted) { setCredential(c); setReadError(null); } })
      .catch((e) => { if (!ctrl.signal.aborted) setReadError(errorMessage(e, m.credential.readFailed)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    // the connection card is a help, not the tab's content: without it the tab works as before
    api.connection?.(deviceId, ctrl.signal).then((c) => { if (!ctrl.signal.aborted) setConnection(c); }, () => undefined);
    return () => ctrl.abort();
  }, [api, deviceId, m.credential.readFailed, attempt]);

  return (
    <>
      <DeviceCredentialPanel
        credential={credential}
        loading={loading}
        error={readError}
        onRetry={() => { setLoading(true); setAttempt((n) => n + 1); }}
        deviceName={device.name}
        secret={secret}
        connection={connection}
        certificateHref={certificateHref}
        onSecretDismiss={() => setSecret(null)}
        onRotate={async () => {
          try {
            const res = await api.rotate(deviceId);
            setCredential(res.credential);
            setSecret(res.secret);
            notify({ tone: 'success', message: m.credential.rotated_ok });
          } catch (e) {
            notify({ tone: 'error', message: errorMessage(e, m.credential.rotateFailed) });
          }
        }}
        onSet={api.set ? () => setSetting(true) : undefined}
        onRevoke={api.revoke ? async () => {
          try {
            await api.revoke!(deviceId);
            setCredential(null);
            notify({ tone: 'success', message: m.credential.revokeOk });
          } catch (e) {
            notify({ tone: 'error', message: errorMessage(e, m.credential.revokeFailed) });
          }
        } : undefined}
      />
      {api.set && (
        <SetCredentialDrawer
          open={setting}
          device={device}
          current={credential}
          onClose={() => setSetting(false)}
          onIssued={(res) => { setCredential(res.credential); setSecret(res.secret); }}
        />
      )}
    </>
  );
}

/** A connection change refreshes the log after this pause (several changes in a burst read once). */
const LOG_REFRESH_MS = 1_000;

function LogTab({ deviceId, stateTick = 0 }: { deviceId: string; stateTick?: number }) {
  const api = useIotAdapter().devices!;
  const { m } = useIotText();
  const [filter, setFilter] = useState<DeviceLogFilter>('all');
  const log = useDeviceLog(api, deviceId, { pageSize: LOG_PAGE, filter, errorText: m.detail.loadError });
  const { refresh } = log;
  useEffect(() => {
    if (!stateTick) return;
    const id = setTimeout(refresh, LOG_REFRESH_MS);
    return () => clearTimeout(id);
  }, [stateTick, refresh]);

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
        hasMore={log.hasMore}
        capped={log.capped}
        onLoadMore={log.more}
        filter={filter}
        onFilterChange={setFilter}
        sources={log.sources}
        auditAvailable={log.auditAvailable}
      />
    </div>
  );
}
