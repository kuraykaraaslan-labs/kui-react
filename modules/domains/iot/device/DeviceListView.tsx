'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { KeyedTable, type KeyedTableColumn } from '@/modules/ui/KeyedTable';
import { PageHeader } from '@/modules/ui/PageHeader';
import { Pagination } from '@/modules/ui/Pagination';
import { SearchBar } from '@/modules/ui/SearchBar';
import { Select } from '@/modules/ui/Select';
import { errorMessage, type DeviceListQuery, type DeviceOnlineFilter } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { iotTopics } from '../api/live';
import { fill, formatDateTime, formatRelative, toDate } from '../format';
import type { DeviceRecord, DeviceRegistryStatus, DeviceStatePatch } from '../types/device';
import { DeviceConnectionBadge } from './DeviceConnectionBadge';
import { NewDeviceDrawer } from './NewDeviceDrawer';

/**
 * DeviceListView — the device list (phase 01 §1.1, NB iot_device 05 §5.3), read through the adapter: search and filters
 * (profile, connection incl. "last seen only", status, gateway), server paging, the connection badge that follows the
 * profile's online rule, firmware and last seen. A "Quarantined (n)" quick filter (OD-1, counted toward the device limit,
 * OD-75) and, where the host offers activation, bulk "Activate" (at most 100). "New device" opens a drawer that shows the new
 * token once. Rows follow `deviceState('*')` live; without a live source the page re-reads every 30 s.
 */
export type DeviceListViewProps = {
  hrefs: { device: (deviceId: string) => string };
  initialQuery?: Partial<DeviceListQuery>;
  onQueryChange?: (query: DeviceListQuery) => void;
  pageSize?: number;
  now?: number;
  className?: string;
};

const MAX_ACTIVATE = 100;

export function applyStatePatch(d: DeviceRecord, p: DeviceStatePatch): DeviceRecord {
  return {
    ...d,
    online: p.online,
    ...(p.lastActivityAt !== undefined ? { lastActivityAt: toDate(p.lastActivityAt) } : {}),
    ...(p.lastConnectAt !== undefined ? { lastConnectAt: toDate(p.lastConnectAt) } : {}),
    ...(p.lastDisconnectAt !== undefined ? { lastDisconnectAt: toDate(p.lastDisconnectAt) } : {}),
    ...(p.reason && p.online === false ? { lastDisconnectReason: p.reason } : {}),
  };
}

export function DeviceListView({ hrefs, initialQuery, onQueryChange, pageSize = 20, now, className }: DeviceListViewProps) {
  const adapter = useIotAdapter();
  const api = adapter.devices;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale } = useIotText();

  const [query, setQuery] = useState<DeviceListQuery>(() => ({ page: 1, pageSize, ...initialQuery }));
  const [items, setItems] = useState<DeviceRecord[]>([]);
  const [total, setTotal] = useState(0);
  // the query the shown rows answer; while it differs from the current one the table shows "loading"
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [quarantined, setQuarantined] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [searchText, setSearchText] = useState(query.search ?? '');
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);

  const apply = useCallback((q: DeviceListQuery, page: { items: DeviceRecord[]; total: number } | null, e?: unknown) => {
    if (page) {
      setItems(page.items);
      setTotal(page.total);
      setError(null);
    } else {
      setError(errorMessage(e, m.devices.loadError));
    }
    setLoadedKey(JSON.stringify(q));
  }, [m.devices.loadError]);

  /** Reads `q` and shows it (also the poll and the retry); an aborted read changes nothing. */
  const load = useCallback((q: DeviceListQuery, signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return api.list(q, signal).then(
      (page) => { if (!signal?.aborted) apply(q, page); },
      (e) => { if (!signal?.aborted) apply(q, null, e); },
    );
  }, [api, apply]);

  const loadQuarantined = useCallback((): Promise<void> => (api?.quarantinedCount
    ? api.quarantinedCount().then(setQuarantined, () => undefined)
    : Promise.resolve()), [api]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(query, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load, query]);
  useEffect(() => { loadQuarantined().catch(() => undefined); }, [loadQuarantined]);
  useEffect(() => {
    const ctrl = new AbortController();
    adapter.profiles?.options(ctrl.signal).then((p) => { if (!ctrl.signal.aborted) setProfiles(p); }).catch(() => undefined);
    return () => ctrl.abort();
  }, [adapter.profiles]);

  const changeRef = useRef<(patch: Partial<DeviceListQuery>) => void>(() => undefined);
  function change(patch: Partial<DeviceListQuery>) {
    const next = { ...queryRef.current, ...patch, page: patch.page ?? 1 };
    setQuery(next);
    setSelected(new Set());
    onQueryChange?.(next);
  }
  useEffect(() => { changeRef.current = change; });
  useEffect(() => {
    if ((queryRef.current.search ?? '') === searchText) return;
    const t = setTimeout(() => changeRef.current({ search: searchText || undefined }), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const state = useLiveOrPoll({
    key: '*',
    subscribe: api ? (live) => live.subscribe({
      ...iotTopics.deviceState('*'),
      onLive: (payload) => {
        const p = api.parseState?.(payload);
        if (!p) return;
        setItems((cur) => (cur.some((d) => d.deviceId === p.deviceId) ? cur.map((d) => (d.deviceId === p.deviceId ? applyStatePatch(d, p) : d)) : cur));
      },
    }) : undefined,
    poll: () => { void load(queryRef.current); void loadQuarantined(); },
  });

  async function activate() {
    if (!api?.activate) return;
    const ids = [...selected].slice(0, MAX_ACTIVATE);
    setActivating(true);
    try {
      const { activated } = await api.activate(ids);
      notify({ tone: 'success', message: fill(m.devices.activatedMany, { n: activated }) });
      setSelected(new Set());
      await Promise.all([load(queryRef.current), loadQuarantined()]);
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.devices.loadError) });
    } finally {
      setActivating(false);
    }
  }

  const profileName = (id: string, fallback?: string | null) => fallback ?? profiles.find((p) => p.id === id)?.name ?? '—';
  const canActivate = caps.canActivateDevice && !!api?.activate && query.status === 'QUARANTINED';
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  const any = { value: '', label: m.common.any };

  const columns: KeyedTableColumn<DeviceRecord>[] = [
    {
      key: 'name',
      header: m.devices.name,
      render: (d) => (
        <a href={hrefs.device(d.deviceId)} className="flex min-w-0 flex-col rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          <span className="flex items-center gap-1.5 truncate font-medium text-text-primary hover:text-primary">
            {d.name}
            {d.isGateway && <Badge variant="primary" size="sm">{m.device.gateway}</Badge>}
          </span>
          {d.label && <span className="truncate text-xs text-text-secondary">{d.label}</span>}
        </a>
      ),
    },
    {
      key: 'connection',
      header: m.devices.connection,
      render: (d) => (
        <DeviceConnectionBadge online={d.online} status={d.status} lastActivityAt={d.lastActivityAt} lastDisconnectReason={d.lastDisconnectReason} size="sm" now={now} />
      ),
    },
    { key: 'profile', header: m.devices.profile, hideBelow: 'md', render: (d) => profileName(d.deviceProfileId, d.profileName) },
    { key: 'firmware', header: m.devices.firmware, hideBelow: 'lg', render: (d) => [d.fwTitle, d.fwVersion].filter(Boolean).join(' ') || '—' },
    {
      key: 'lastSeen',
      header: m.devices.lastSeen,
      hideBelow: 'sm',
      render: (d) => <span className="text-xs text-text-secondary" title={formatDateTime(d.lastActivityAt, { locale })}>{formatRelative(d.lastActivityAt, { locale, now })}</span>,
    },
  ];

  if (!api) return null;

  return (
    <div className={cn('space-y-4', className)}>
      <PageHeader
        title={m.devices.title}
        subtitle={m.devices.subtitle}
        actions={caps.canCreateDevice && api.create ? [{
          label: <><FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" /> {m.devices.new}</>,
          onClick: () => setCreating(true),
        }] : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        {quarantined !== null && quarantined > 0 && (
          <button
            type="button"
            aria-pressed={query.status === 'QUARANTINED'}
            onClick={() => change({ status: query.status === 'QUARANTINED' ? undefined : 'QUARANTINED' })}
            title={m.device.quarantinedHint}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              query.status === 'QUARANTINED' ? 'border-warning bg-warning-subtle text-warning-fg' : 'border-border text-text-secondary hover:bg-surface-overlay',
            )}
          >
            {fill(m.devices.quarantinedChip, { n: quarantined })}
          </button>
        )}
        <span className="ml-auto text-xs text-text-secondary" aria-live="polite">{state === 'live' ? m.common.live : m.common.polling}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <SearchBar placeholder={m.devices.search} value={searchText} onChange={setSearchText} onClear={() => setSearchText('')} />
        <Select id="device-filter-profile" label={m.devices.profile} value={query.profileId ?? ''} onChange={(e) => change({ profileId: e.target.value || undefined })}
          options={[any, ...profiles.map((p) => ({ value: p.id, label: p.name }))]} />
        <Select id="device-filter-online" label={m.devices.connection} value={query.online ?? ''} onChange={(e) => change({ online: (e.target.value || undefined) as DeviceOnlineFilter | undefined })}
          options={[any, { value: 'online', label: m.device.online }, { value: 'offline', label: m.device.offline }, { value: 'last_seen', label: m.devices.lastSeenOnly }]} />
        <Select id="device-filter-status" label={m.devices.status} value={query.status ?? ''} onChange={(e) => change({ status: (e.target.value || undefined) as DeviceRegistryStatus | undefined })}
          options={[any, { value: 'ACTIVE', label: m.devices.active }, { value: 'QUARANTINED', label: m.device.quarantined }, { value: 'DISABLED', label: m.device.disabled }]} />
        <Select id="device-filter-gateway" label={m.devices.gateway} value={query.gateway === undefined ? '' : String(query.gateway)} onChange={(e) => change({ gateway: e.target.value === '' ? undefined : e.target.value === 'true' })}
          options={[any, { value: 'true', label: m.common.yes }, { value: 'false', label: m.common.no }]} />
      </div>

      {canActivate && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-overlay px-3 py-2">
          <Button variant="primary" size="sm" loading={activating} onClick={() => void activate()} iconLeft={<FontAwesomeIcon icon={faPowerOff} className="h-3 w-3" aria-hidden="true" />}>
            {fill(m.devices.activateSelected, { n: Math.min(selected.size, MAX_ACTIVATE) })}
          </Button>
        </div>
      )}

      <KeyedTable
        caption={m.devices.title}
        columns={columns}
        rows={items}
        getRowKey={(d) => d.deviceId}
        selection={canActivate ? {
          selected,
          onChange: (next) => setSelected(new Set([...next].slice(0, MAX_ACTIVATE))),
          isSelectable: (d) => (d.status === 'QUARANTINED' ? true : m.devices.active),
          rowLabel: (d) => fill(m.common.selectRow, { name: d.name }),
        } : undefined}
        loading={loadedKey !== JSON.stringify(query)}
        error={error}
        onRetry={() => void load(queryRef.current)}
        emptyText={m.devices.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry, selectAll: m.common.selectAll }}
      />

      {pages > 1 && (
        <div className="flex justify-center">
          <Pagination page={query.page} totalPages={pages} onPageChange={(page) => change({ page })} size="sm" />
        </div>
      )}

      {creating && (
        <NewDeviceDrawer
          open={creating}
          profiles={profiles}
          deviceHref={hrefs.device}
          onClose={() => setCreating(false)}
          onCreated={() => { void load(queryRef.current); }}
        />
      )}
    </div>
  );
}
