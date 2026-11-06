'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsis, faPenToSquare, faPlus, faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Drawer } from '@/modules/ui/Drawer';
import { DropdownMenu, type DropdownItem } from '@/modules/ui/DropdownMenu';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableFilterValues, DataTableQuery, DataTableRowId } from '@/modules/ui/Table/types';
import { PageHeader } from '@/modules/ui/PageHeader';
import { errorMessage, DEVICE_SORT_KEYS, type DeviceListQuery, type DeviceOnlineFilter } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { LIST_PAGE_SIZES, choiceOf, sameSort, toIotSort, toTableSort } from '../api/list-table';
import { iotTopics } from '../api/live';
import { fill, formatDateTime, formatRelative, toDate } from '../format';
import type { DeviceRecord, DeviceRegistryStatus, DeviceStatePatch } from '../types/device';
import { DeviceAddress } from './DeviceAddress';
import { DeviceConnectionBadge } from './DeviceConnectionBadge';
import { DeviceQuickView } from './DeviceQuickView';
import { EditDeviceDrawer } from './EditDeviceDrawer';
import { NewDeviceDrawer, type DeviceAddChoice } from './NewDeviceDrawer';

/**
 * DeviceListView — the device list (phase 01 §1.1, NB iot_device 05 §5.3), read through the adapter, on the DataTable's own
 * toolbar: search, the Filters panel (profile, connection incl. "last seen only", status, gateway), sortable columns (name,
 * connection, last seen), rows per page and server paging; the connection badge that follows the profile's online rule,
 * firmware and last seen. A "Quarantined (n)" quick filter (OD-1, counted toward the device limit,
 * OD-75) and, where the host offers activation, bulk "Activate" (at most 100). "New device" opens a drawer that shows the new
 * token once. Rows follow `deviceState('*')` live; without a live source the page re-reads every 30 s.
 *
 * A click on a row (not on its name, which links the device page) opens `DeviceQuickView`, a right-side drawer; ↑ / ↓ move it
 * through the page. The open device is `query.device`: a host keeps it in its URL through `onQueryChange` (`how` is `push` when
 * the drawer opens, so Back closes it; `replace` for everything else) and hands it back in `initialQuery`, whose `device` the view
 * follows when it changes (Back, Forward, a pasted link).
 *
 * The header's actions beside "New device", all from the host: `addChoices` (more ways to add a device, offered in the New device
 * drawer before "Other device", the create form; "New device" shows with either), `renderQuarantine` (the host's approval view
 * for the devices waiting in quarantine: an "Awaiting approval (n)" button opens it in a drawer, in place of the "Quarantined (n)"
 * quick filter) and `moreActions` (a "⋯" menu). A row has an Edit button (`canEditDevice` and `devices.update`) that opens the
 * `EditDeviceDrawer` without opening the quick view.
 *
 * Only the answer of the newest read is shown (a late poll or reload of another filter never overwrites the rows, nor leaves the table
 * loading); a page past the end (its last device deleted, a page number from a stale URL) moves to the last page. The host's
 * `initialQuery` is followed by value when it changes (Back, a menu click): the page and the filters always, rows per page and sort only
 * when it names them. While the live source is live the list still re-reads about every minute (not while the tab is hidden), and soon
 * after a live change names a device it does not show or one that left its connection filter, so devices added, removed or changed
 * elsewhere appear (NB 41-ui-fixes/21 1.8–1.10, 1.16, 1.19). `onOpen` opens a device, its page or its log in the host's router (a plain
 * click; a modified click keeps the link's own behaviour). A failed capabilities read or profile read says so, with a retry (1.11, 1.12).
 */
export type DeviceListViewProps = {
  hrefs: { device: (deviceId: string) => string };
  initialQuery?: Partial<DeviceListQuery>;
  onQueryChange?: (query: DeviceListQuery, how?: 'push' | 'replace') => void;
  pageSize?: number;
  now?: number;
  className?: string;
  /** More ways to add a device (e.g. claiming a vendor's device with its code), offered in the New device drawer. */
  addChoices?: readonly DeviceAddChoice[];
  /** The host's approval view of the quarantined devices, drawn in a drawer; `changed` re-reads the list and the count. */
  renderQuarantine?: (ctx: { close: () => void; changed: () => void }) => React.ReactNode;
  /** The header's "⋯" menu (e.g. a link to a related list). */
  moreActions?: readonly DropdownItem[];
  /** Opens a link (a device page, its log) in the host's router on a plain click; without it the links are plain links. */
  onOpen?: (href: string) => void;
  /**
   * Opens the "Awaiting approval" drawer (`renderQuarantine`) on mount: the device page's quarantine link lands here (NB 41-ui-fixes/22
   * C7; the Devices page is where a quarantined device is approved, f23587f01).
   */
  quarantineOpen?: boolean;
};

const MAX_ACTIVATE = 100;
const ONLINE: readonly DeviceOnlineFilter[] = ['online', 'offline', 'last_seen'];
const STATUSES: readonly DeviceRegistryStatus[] = ['ACTIVE', 'QUARANTINED', 'DISABLED'];
/** The longest search the host takes (NB `ListIotDevicesDTO.search`); a longer one is cut, never refused (NB 41-ui-fixes/21 N3). */
export const DEVICE_SEARCH_MAX = 128;
/** While live: the slow re-read beside the patches, and the wait before a re-read a patch asked for (NB 41-ui-fixes/21 1.10). */
export const LIVE_REREAD_MS = 60_000;
export const PATCH_REREAD_MS = 2_000;

/** A list query as a value (the fields one by one; the open device is not part of it). */
function queryKey(q: DeviceListQuery): string {
  return JSON.stringify([q.page, q.pageSize, q.search || null, q.profileId ?? null, q.online ?? null, q.status ?? null, q.gateway ?? null,
    q.sort?.key ?? null, q.sort?.dir ?? null]);
}
const sameQuery = (a: DeviceListQuery, b: DeviceListQuery) => queryKey(a) === queryKey(b);

/** What the host's query names, as a value (an absent or undefined field is not named; the open device is followed on its own). */
function hostKey(q: Partial<DeviceListQuery> | undefined): string {
  return JSON.stringify(Object.entries(q ?? {}).filter(([k, v]) => v !== undefined && k !== 'device').sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The list's query moved to the host's: page and filters as the host has them, rows per page and sort only when it names them. */
function followHost(cur: DeviceListQuery, host: Partial<DeviceListQuery> | undefined): DeviceListQuery {
  const h = host ?? {};
  const next: DeviceListQuery = {
    ...cur, page: h.page ?? 1, search: h.search, profileId: h.profileId, online: h.online, status: h.status, gateway: h.gateway,
  };
  if (h.pageSize !== undefined) next.pageSize = h.pageSize;
  if (h.sort !== undefined) next.sort = h.sort;
  return next;
}

/** Whether a device's live connection still fits the connection filter. */
function fitsOnline(filter: DeviceOnlineFilter | undefined, online: boolean | null): boolean {
  return !filter || (filter === 'online' ? online === true : filter === 'offline' ? online === false : online === null);
}

/** A plain left click (no modifier): the host's router opens the link; any other click keeps the link's own behaviour. */
function plainClick(e: React.MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

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

export function DeviceListView({
  hrefs, initialQuery, onQueryChange, pageSize = 20, now, className, addChoices = [], renderQuarantine, moreActions = [], onOpen, quarantineOpen = false,
}: DeviceListViewProps) {
  const adapter = useIotAdapter();
  const api = adapter.devices;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale } = useIotText();

  const [query, setQuery] = useState<DeviceListQuery>(() => {
    const { device: _open, ...rest } = initialQuery ?? {};
    return { ...rest, page: rest.page ?? 1, pageSize: rest.pageSize ?? pageSize };
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
  const [profilesFailed, setProfilesFailed] = useState(false);
  const [profilesAttempt, setProfilesAttempt] = useState(0);
  const [quarantined, setQuarantined] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<DeviceRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(quarantineOpen);
  const [activating, setActivating] = useState(false);
  const queryRef = useRef(query);
  // a layout effect: the table reports its page for a query the host moved before the passive effects run, and must compare with it
  useLayoutEffect(() => { queryRef.current = query; }, [query]);
  const openRef = useRef(openId);
  useEffect(() => { openRef.current = openId; }, [openId]);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  // the host's query moved under the mounted list (its URL changed): follow it by value (NB 41-ui-fixes/21 1.19)
  const initialKey = hostKey(initialQuery);
  const [seenInitial, setSeenInitial] = useState(initialKey);
  if (initialKey !== seenInitial) {
    setSeenInitial(initialKey);
    const next = followHost(query, initialQuery);
    if (!sameQuery(next, query)) setQuery(next);
  }
  // only the newest read is shown: a late answer of an older one is dropped (NB 41-ui-fixes/21 1.8)
  const seqRef = useRef(0);
  const clampRef = useRef<(q: DeviceListQuery, total: number) => void>(() => undefined);
  // live patches that named a device the list does not show; the ones still not shown after a re-read are not asked about again
  // while the query stays (each device costs one re-read at most, NB 41-ui-fixes/21 1.10)
  const pendingRef = useRef<Set<string>>(new Set());
  const offPageRef = useRef<{ key: string; ids: Set<string> }>({ key: '', ids: new Set() });

  const apply = useCallback((q: DeviceListQuery, page: { items: DeviceRecord[]; total: number } | null, e?: unknown) => {
    if (page) {
      setItems(page.items);
      setTotal(page.total);
      setError(null);
      const key = JSON.stringify(q);
      if (offPageRef.current.key !== key) offPageRef.current = { key, ids: new Set() };
      for (const id of pendingRef.current) if (!page.items.some((d) => d.deviceId === id)) offPageRef.current.ids.add(id);
      pendingRef.current.clear();
    } else {
      setError(errorMessage(e, m.devices.loadError));
    }
    setLoadedKey(JSON.stringify(q));
  }, [m.devices.loadError]);

  /** Reads `q` and shows it (also the poll and the retry); an aborted read, or one a newer read overtook, changes nothing. */
  const load = useCallback((q: DeviceListQuery, signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    const seq = ++seqRef.current;
    return api.list(q, signal).then(
      (page) => {
        if (signal?.aborted || seq !== seqRef.current) return;
        // a page past the end (its last device deleted, a stale URL): the last page instead of an empty list (NB 41-ui-fixes/21 1.9)
        if (!page.items.length && page.total > 0 && q.page > 1) {
          clampRef.current(q, page.total);
          return;
        }
        apply(q, page);
      },
      (e) => { if (!signal?.aborted && seq === seqRef.current) apply(q, null, e); },
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
    adapter.profiles?.options(ctrl.signal).then(
      (p) => { if (!ctrl.signal.aborted) { setProfiles(p); setProfilesFailed(false); } },
      () => { if (!ctrl.signal.aborted) setProfilesFailed(true); },
    );
    return () => ctrl.abort();
  }, [adapter.profiles, profilesAttempt]);

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

  function change(patch: Partial<DeviceListQuery>) {
    const next = { ...queryRef.current, ...patch, page: patch.page ?? 1 };
    if (next.search && next.search.length > DEVICE_SEARCH_MAX) next.search = next.search.slice(0, DEVICE_SEARCH_MAX);
    // at once, not in the effect: the table reports page 1 for a new filter before that effect runs, and must see this query
    queryRef.current = next;
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
  useEffect(() => {
    clampRef.current = (q, all) => {
      if (!sameQuery(q, queryRef.current)) return;
      change({ page: Math.max(1, Math.ceil(all / q.pageSize)) });
    };
  });
  /** The table's page, rows per page, sort or search changed (it reports its query on mount too: nothing then). */
  function tableQuery(t: DataTableQuery) {
    const cur = queryRef.current;
    const sort = toIotSort(t.sort, DEVICE_SORT_KEYS);
    const search = t.search ? t.search.slice(0, DEVICE_SEARCH_MAX) : undefined;
    if (t.page === cur.page && t.pageSize === cur.pageSize && search === (cur.search || undefined) && sameSort(sort, cur.sort)) return;
    change({ page: t.page, pageSize: t.pageSize, search, sort });
  }
  /** The Filters panel was applied (back to page 1). */
  function filtersChanged(v: DataTableFilterValues) {
    change({
      profileId: typeof v.profileId === 'string' && v.profileId ? v.profileId : undefined,
      online: choiceOf(v.online, ONLINE),
      status: choiceOf(v.status, STATUSES),
      gateway: v.gateway === 'true' ? true : v.gateway === 'false' ? false : undefined,
    });
  }

  /** The open device again when it is not on the shown page (it is read alone); a failed re-read keeps what is shown. */
  const rereadLoose = useCallback(() => {
    const id = openRef.current;
    if (!api || !id || itemsRef.current.some((d) => d.deviceId === id)) return;
    api.get(id).then((d) => { if (openRef.current === id) setLoose({ id, device: d, error: null }); }, () => undefined);
  }, [api]);
  /** The list, the quarantined count and a loose open device again (the poll, the slow live re-read, a host change). */
  const reread = useCallback(() => { void load(queryRef.current); void loadQuarantined(); rereadLoose(); }, [load, loadQuarantined, rereadLoose]);
  // a re-read a live patch asked for: at most one per PATCH_REREAD_MS
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askReread = useCallback(() => {
    if (patchTimer.current) return;
    patchTimer.current = setTimeout(() => { patchTimer.current = null; void load(queryRef.current); }, PATCH_REREAD_MS);
  }, [load]);
  useEffect(() => () => { if (patchTimer.current) clearTimeout(patchTimer.current); }, []);

  const state = useLiveOrPoll({
    key: '*',
    subscribe: api ? (live) => live.subscribe({
      ...iotTopics.deviceState('*'),
      onLive: (payload) => {
        const p = api.parseState?.(payload);
        if (!p) return;
        if (itemsRef.current.some((d) => d.deviceId === p.deviceId)) {
          setItems((cur) => cur.map((d) => (d.deviceId === p.deviceId ? applyStatePatch(d, p) : d)));
          // it left the connection filter: the list reads again (it drops out)
          if (!fitsOnline(queryRef.current.online, p.online)) askReread();
        } else if (!(offPageRef.current.key === JSON.stringify(queryRef.current) && offPageRef.current.ids.has(p.deviceId))) {
          // a device the list does not show (added elsewhere, or on another page): read again once to see whether it belongs here
          pendingRef.current.add(p.deviceId);
          askReread();
        }
        setLoose((l) => (l?.device && l.device.deviceId === p.deviceId ? { ...l, device: applyStatePatch(l.device, p) } : l));
      },
    }) : undefined,
    poll: reread,
  });
  // live: patches keep the rows current, and a slow re-read catches what no patch names (a device deleted or edited elsewhere)
  useEffect(() => {
    if (state !== 'live') return;
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      reread();
    }, LIVE_REREAD_MS);
    return () => clearInterval(t);
  }, [state, reread]);

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
  const canCreate = caps.canCreateDevice && !!api?.create;
  const canEdit = caps.canEditDevice && !!api?.update;
  // a profile filter the options do not hold (beyond the first page of profiles, or the read failed) keeps its name from the rows
  const selectedProfile = query.profileId;
  const profileOptions = useMemo(() => {
    const opts = profiles.map((p) => ({ value: p.id, label: p.name }));
    if (selectedProfile && !profiles.some((p) => p.id === selectedProfile)) {
      const named = items.find((d) => d.deviceProfileId === selectedProfile && d.profileName)?.profileName;
      opts.push({ value: selectedProfile, label: named ?? selectedProfile });
    }
    return opts;
  }, [profiles, selectedProfile, items]);
  const filterFields = useMemo((): DataTableFilterField<DeviceRecord>[] => [
    { id: 'profileId', label: m.devices.profile, type: 'select', options: profileOptions },
    {
      id: 'online', label: m.devices.connection, type: 'select',
      options: [{ value: 'online', label: m.device.online }, { value: 'offline', label: m.device.offline }, { value: 'last_seen', label: m.devices.lastSeenOnly }],
    },
    {
      id: 'status', label: m.devices.status, type: 'select',
      options: [{ value: 'ACTIVE', label: m.devices.active }, { value: 'QUARANTINED', label: m.device.quarantined }, { value: 'DISABLED', label: m.device.disabled }],
    },
    { id: 'gateway', label: m.devices.gateway, type: 'select', options: [{ value: 'true', label: m.common.yes }, { value: 'false', label: m.common.no }] },
  ], [profileOptions, m]);
  const filterValues = useMemo((): DataTableFilterValues => ({
    ...(query.profileId ? { profileId: query.profileId } : {}),
    ...(query.online ? { online: query.online } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.gateway !== undefined ? { gateway: String(query.gateway) } : {}),
  }), [query.profileId, query.online, query.status, query.gateway]);

  const columns: Column<DeviceRecord>[] = [
    {
      key: 'name',
      header: m.devices.name,
      sortable: true,
      hideable: false,
      render: (d) => (
        <a href={hrefs.device(d.deviceId)} className="flex min-w-0 flex-col rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          onClick={onOpen ? (e) => { if (plainClick(e)) { e.preventDefault(); onOpen(hrefs.device(d.deviceId)); } } : undefined}>
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
      sortable: true,
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
      sortable: true,
      render: (d) => <span className="text-xs text-text-secondary" title={formatDateTime(d.lastActivityAt, { locale })}>{formatRelative(d.lastActivityAt, { locale, now })}</span>,
    },
    ...(canEdit ? [{
      key: 'actions',
      header: <span className="sr-only">{m.devices.actions}</span>,
      align: 'right' as const,
      hideable: false,
      render: (d: DeviceRecord) => (
        <Button
          variant="ghost"
          size="xs"
          aria-label={fill(m.editDevice.rowAction, { name: d.name })}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setEditing(d); }}
          iconLeft={<FontAwesomeIcon icon={faPenToSquare} className="h-3 w-3" aria-hidden="true" />}
        >
          <span className="sr-only">{m.editDevice.action}</span>
        </Button>
      ),
    }] : []),
  ];

  if (!api) return null;

  const openIndex = openId ? items.findIndex((d) => d.deviceId === openId) : -1;
  const openDeviceRecord = openIndex >= 0 ? items[openIndex] : (loose && loose.id === openId ? loose.device : null);
  const prevId = openIndex > 0 ? items[openIndex - 1].deviceId : null;
  const nextId = openIndex >= 0 && openIndex < items.length - 1 ? items[openIndex + 1].deviceId : null;

  return (
    <div ref={listRef} className={cn('space-y-4', className)}>
      {/* the actions wrap under the title on a phone, the "⋯" menu with them */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
        <PageHeader className="min-w-0 pb-0" title={m.devices.title} subtitle={m.devices.subtitle} />
        {(renderQuarantine || canCreate || addChoices.length > 0 || moreActions.length > 0) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {renderQuarantine && (
              <Button variant="outline" onClick={() => setApproving(true)}>
                {quarantined === null ? m.devices.awaitingApprovalTitle : fill(m.devices.awaitingApproval, { n: quarantined })}
              </Button>
            )}
            {(canCreate || addChoices.length > 0) && (
              <Button onClick={() => setCreating(true)} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
                {m.devices.new}
              </Button>
            )}
            {moreActions.length > 0 && (
              <DropdownMenu
                align="right"
                items={[...moreActions]}
                trigger={(
                  <Button variant="ghost" iconOnly aria-label={m.devices.moreActions} title={m.devices.moreActions}>
                    <FontAwesomeIcon icon={faEllipsis} className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!renderQuarantine && quarantined !== null && quarantined > 0 && (
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

      {caps.failed && (
        <Callout variant="warning" title={null}>
          <span className="flex flex-wrap items-center gap-2">
            {m.common.capabilitiesError}
            <Button variant="outline" size="xs" onClick={caps.retry}>{m.common.retry}</Button>
          </span>
        </Callout>
      )}
      {profilesFailed && (
        <Callout variant="warning" title={null}>
          <span className="flex flex-wrap items-center gap-2">
            {m.devices.profilesError}
            <Button variant="outline" size="xs" onClick={() => setProfilesAttempt((n) => n + 1)}>{m.common.retry}</Button>
          </span>
        </Callout>
      )}

      <DataTable<DeviceRecord>
        mode="manual"
        caption={m.devices.title}
        columns={columns}
        // The viewer's own columns, saved in this browser (the name stays).
        columnChooser
        tableId="iot.devices"
        rows={items}
        total={total}
        query={{ page: query.page, pageSize: query.pageSize, sort: toTableSort(query.sort), search: query.search ?? '' }}
        onQueryChange={tableQuery}
        multiSort={false}
        searchPlaceholder={m.devices.search}
        filterFields={filterFields}
        filterValues={filterValues}
        onFilterValuesChange={filtersChanged}
        pageSizeOptions={LIST_PAGE_SIZES}
        rowId={(d) => d.deviceId}
        onRowClick={(d) => openDevice(d.deviceId, openRef.current ? 'replace' : 'push')}
        rowClassName={(d) => (d.deviceId === openId ? 'bg-surface-overlay' : undefined)}
        selectable={canActivate}
        selectedRowIds={canActivate ? [...selected] : undefined}
        onSelectionChange={canActivate ? (ids: DataTableRowId[]) => { const next = new Set(ids.map(String)); setSelected(new Set([...next].slice(0, MAX_ACTIVATE))); } : undefined}
        isRowSelectable={(d) => (d.status === 'QUARANTINED' ? true : m.devices.active)}
        rowSelectLabel={(d) => fill(m.common.selectRow, { name: d.name })}
        bulkActions={canActivate ? () => (
          <Button variant="primary" size="sm" loading={activating} onClick={() => void activate()} iconLeft={<FontAwesomeIcon icon={faPowerOff} className="h-3 w-3" aria-hidden="true" />}>
            {fill(m.devices.activateSelected, { n: Math.min(selected.size, MAX_ACTIVATE) })}
          </Button>
        ) : undefined}
        loading={loadedKey !== JSON.stringify(query)}
        error={error || undefined}
        onRetry={() => void load(queryRef.current)}
        emptyMessage={m.devices.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
        keyboardNavigation
      />

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
          onOpen={onOpen}
        />
      )}

      {editing && (
        <EditDeviceDrawer
          open
          device={editing}
          profiles={profiles}
          onClose={() => setEditing(null)}
          onSaved={() => { void load(queryRef.current); }}
        />
      )}

      {creating && (
        <NewDeviceDrawer
          open={creating}
          profiles={profiles}
          deviceHref={hrefs.device}
          onClose={() => setCreating(false)}
          onCreated={() => { void load(queryRef.current); }}
          onAdded={reread}
          choices={addChoices}
          canCreate={canCreate}
          onOpen={onOpen}
        />
      )}

      {approving && renderQuarantine && (
        <Drawer open onClose={() => setApproving(false)} title={m.devices.awaitingApprovalTitle} closeLabel={m.common.close} className="w-[40rem]">
          <HostView render={renderQuarantine} close={() => setApproving(false)} changed={reread} />
        </Drawer>
      )}
    </div>
  );
}

/** Draws a host's view (a render prop) as a component of its own. */
function HostView({ render, close, changed }: {
  render: NonNullable<DeviceListViewProps['renderQuarantine']>;
  close: () => void;
  changed: () => void;
}) {
  return <>{render({ close, changed })}</>;
}
