'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableRowId } from '@/modules/ui/Table/types';
import { PageHeader } from '@/modules/ui/PageHeader';
import { Pagination } from '@/modules/ui/Pagination';
import { SearchBar } from '@/modules/ui/SearchBar';
import { Select } from '@/modules/ui/Select';
import { errorMessage, type DeviceListQuery, type DeviceOnlineFilter } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { iotTopics } from '../api/live';
import { fill, formatDateTime, formatRelative, toDate } from '../format';
import type { DeviceRecord, DeviceRegistryStatus, DeviceStatePatch } from '../types/device';
import { DeviceAddress } from './DeviceAddress';
import { DeviceConnectionBadge } from './DeviceConnectionBadge';
import { DeviceQuickView } from './DeviceQuickView';
import { NewDeviceDrawer } from './NewDeviceDrawer';

/**
 * DeviceListView — the device list (phase 01 §1.1, NB iot_device 05 §5.3), read through the adapter: search and filters
 * (profile, connection incl. "last seen only", status, gateway), server paging, the connection badge that follows the
 * profile's online rule, firmware and last seen. A "Quarantined (n)" quick filter (OD-1, counted toward the device limit,
 * OD-75) and, where the host offers activation, bulk "Activate" (at most 100). "New device" opens a drawer that shows the new
 * token once. Rows follow `deviceState('*')` live; without a live source the page re-reads every 30 s.
 *
 * A click on a row (not on its name, which links the device page) opens `DeviceQuickView`, a right-side drawer; ↑ / ↓ move it
 * through the page. The open device is `query.device`: a host keeps it in its URL through `onQueryChange` (`how` is `push` when
 * the drawer opens, so Back closes it; `replace` for everything else) and hands it back in `initialQuery`, whose `device` the view
 * follows when it changes (Back, Forward, a pasted link).
 */
export type DeviceListViewProps = {
  hrefs: { device: (deviceId: string) => string };
  initialQuery?: Partial<DeviceListQuery>;
  onQueryChange?: (query: DeviceListQuery, how?: 'push' | 'replace') => void;
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
    ...(p.remoteIp ? { lastRemoteIp: p.remoteIp } : {}),
    ...(p.transport ? { lastTransport: p.transport } : {}),
  };
}

export function DeviceListView({ hrefs, initialQuery, onQueryChange, pageSize = 20, now, className }: DeviceListViewProps) {
  const adapter = useIotAdapter();
  const api = adapter.devices;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale } = useIotText();

  const [query, setQuery] = useState<DeviceListQuery>(() => {
    const { device: _open, ...rest } = initialQuery ?? {};
    return { page: 1, pageSize, ...rest };
  });
  // the quick view: which device is open (from the URL too), and a device that is not on this page, read on its own
  const urlDevice = initialQuery?.device ?? null;
  const [openId, setOpenId] = useState<string | null>(urlDevice);
  const [urlSeen, setUrlSeen] = useState<string | null>(urlDevice);
  if (urlDevice !== urlSeen) {
    setUrlSeen(urlDevice);
    setOpenId(urlDevice);
  }
  const [loose, setLoose] = useState<{ device: DeviceRecord | null; error: string | null; id: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
  const openRef = useRef(openId);
  useEffect(() => { openRef.current = openId; }, [openId]);

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

  // a device opened from the URL that is not on the shown page: read it alone (no neighbours then)
  const listed = loadedKey === JSON.stringify(query);
  const onPage = openId ? items.some((d) => d.deviceId === openId) : false;
  useEffect(() => {
    if (!api || !openId || !listed || onPage) return;
    const ctrl = new AbortController();
    api.get(openId, ctrl.signal).then(
      (d) => { if (!ctrl.signal.aborted) setLoose({ id: openId, device: d, error: null }); },
      (e) => { if (!ctrl.signal.aborted) setLoose({ id: openId, device: null, error: errorMessage(e, m.detail.loadError) }); },
    );
    return () => ctrl.abort();
  }, [api, openId, listed, onPage, m.detail.loadError]);

  const changeRef = useRef<(patch: Partial<DeviceListQuery>) => void>(() => undefined);
  function change(patch: Partial<DeviceListQuery>) {
    const next = { ...queryRef.current, ...patch, page: patch.page ?? 1 };
    setQuery(next);
    setSelected(new Set());
    onQueryChange?.(openRef.current ? { ...next, device: openRef.current } : next, 'replace');
  }
  function openDevice(id: string | null, how: 'push' | 'replace') {
    openRef.current = id;
    setOpenId(id);
    onQueryChange?.(id ? { ...queryRef.current, device: id } : queryRef.current, how);
  }
  function closeQuickView() {
    const id = openRef.current;
    openDevice(null, 'replace');
    // the drawer gives focus back to what had it when it opened; after moving through the page, the row of the device last shown
    // is the one to land on
    if (id) {
      setTimeout(() => {
        const rows = listRef.current?.querySelectorAll<HTMLElement>('tr[data-row-key]') ?? [];
        Array.from(rows).find((el) => el.dataset.rowKey === id)?.focus();
      }, 0);
    }
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
        setLoose((l) => (l?.device && l.device.deviceId === p.deviceId ? { ...l, device: applyStatePatch(l.device, p) } : l));
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

  const columns: Column<DeviceRecord>[] = [
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
    {
      key: 'address',
      header: m.devices.address,
      hideBelow: 'md',
      render: (d) => <DeviceAddress ip={d.lastRemoteIp} transport={d.lastTransport} />,
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

  const openIndex = openId ? items.findIndex((d) => d.deviceId === openId) : -1;
  const openDeviceRecord = openIndex >= 0 ? items[openIndex] : (loose && loose.id === openId ? loose.device : null);
  const prevId = openIndex > 0 ? items[openIndex - 1].deviceId : null;
  const nextId = openIndex >= 0 && openIndex < items.length - 1 ? items[openIndex + 1].deviceId : null;

  return (
    <div ref={listRef} className={cn('space-y-4', className)}>
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

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
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

      <DataTable<DeviceRecord>
        mode="manual"
        caption={m.devices.title}
        columns={columns}
        rows={items}
        rowId={(d) => d.deviceId}
        onRowClick={(d) => openDevice(d.deviceId, openRef.current ? 'replace' : 'push')}
        rowClassName={(d) => (d.deviceId === openId ? 'bg-surface-overlay' : undefined)}
        selectable={canActivate}
        selectedRowIds={canActivate ? [...selected] : undefined}
        onSelectionChange={canActivate ? (ids: DataTableRowId[]) => { const next = new Set(ids.map(String)); setSelected(new Set([...next].slice(0, MAX_ACTIVATE))); } : undefined}
        isRowSelectable={(d) => (d.status === 'QUARANTINED' ? true : m.devices.active)}
        rowSelectLabel={(d) => fill(m.common.selectRow, { name: d.name })}
        loading={loadedKey !== JSON.stringify(query)}
        error={error || undefined}
        onRetry={() => void load(queryRef.current)}
        emptyMessage={m.devices.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
        searchable={false}
        pageSizeOptions={[]}
        keyboardNavigation
      />

      {pages > 1 && (
        <div className="flex justify-center">
          <Pagination page={query.page} totalPages={pages} onPageChange={(page) => change({ page })} size="sm" />
        </div>
      )}

      {openId && (
        <DeviceQuickView
          open
          deviceId={openId}
          device={openDeviceRecord}
          error={openIndex < 0 && loose && loose.id === openId ? loose.error : null}
          onClose={closeQuickView}
          onPrevious={prevId ? () => openDevice(prevId, 'replace') : undefined}
          onNext={nextId ? () => openDevice(nextId, 'replace') : undefined}
          position={openIndex >= 0 ? { n: (query.page - 1) * query.pageSize + openIndex + 1, total } : undefined}
          href={hrefs.device(openId)}
          profileName={openDeviceRecord ? profileName(openDeviceRecord.deviceProfileId, openDeviceRecord.profileName) : null}
          now={now}
        />
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
