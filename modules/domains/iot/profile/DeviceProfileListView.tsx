'use client';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClone, faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Callout } from '@/modules/ui/Callout';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableFilterValues, DataTableQuery } from '@/modules/ui/Table/types';
import { PageHeader } from '@/modules/ui/PageHeader';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { PROFILE_SORT_KEYS, errorMessage, type ProfileListQuery } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { LIST_PAGE_SIZES, choiceOf, sameSort, toIotSort, toTableSort } from '../api/list-table';
import { fill, formatDateTime, formatRelative } from '../format';
import { ONLINE_RULES, transportLabel, type DeviceProfile, type DeviceProfileUsage, type ProfileTransport } from '../types/profile';
import { useProfileTransports } from './profile-transports';
import { NewDeviceProfileDrawer } from './NewDeviceProfileDrawer';

/**
 * DeviceProfileListView — the device profiles of a workspace (phase 01 §1.4; NB iot_device_profile 03 §3.3), read through the adapter,
 * on the DataTable's own toolbar: search, the Filters panel (transport, online rule), sortable columns (name, transport, online rule,
 * updated), rows per page and server paging; without a sort the default first with its star; the device count of each profile from the
 * host's usage answer, refreshed every 30 s. With `canManageProfiles`: "New profile" (the online rule is chosen explicitly, OD-63),
 * "Make default" and delete. A delete names what still uses the profile; the default profile, a built-in profile (a protocol module's,
 * `builtinKey`: its delete is disabled with the reason) and a profile in use are refused by the host, and its answer is shown as it comes.
 *
 * Only the answer of the newest read is shown (a late poll or reload of another filter never overwrites the rows, nor leaves the table
 * loading); a page past the end (the last row of the last page deleted, a page number from a stale URL) moves to the last page. The
 * host's `initialQuery` is followed when it changes (the URL changed under the mounted list: a menu click, the back button). `onOpen`
 * opens a profile in the host's router (a plain click; a modified click keeps the link's own behaviour). A platform template is tagged
 * and its delete is disabled with the reason, which assistive tech reads too.
 */
export type DeviceProfileListViewProps = {
  hrefs: { profile: (profileId: string) => string };
  initialQuery?: Partial<ProfileListQuery>;
  onQueryChange?: (query: ProfileListQuery) => void;
  /** After a create (the host opens the new profile). */
  onCreated?: (profile: DeviceProfile) => void;
  /** Opens a profile in the host's router (a plain click on its name); without it the name is a plain link. */
  onOpen?: (profileId: string) => void;
  /** After a duplicate (the host opens the copy); without it the list reloads with the copy in it. */
  onDuplicated?: (profile: DeviceProfile) => void;
  pageSize?: number;
  now?: number;
  className?: string;
};

export function usageList(u: DeviceProfileUsage | undefined): string {
  return (u?.references ?? []).filter((r) => r.count > 0).map((r) => `${r.count} ${r.label}`).join(', ');
}

/** A list query as a value (the fields one by one: their key order, or a new object with the same values, does not matter). */
function queryKey(q: ProfileListQuery): string {
  const sort = (q as { sort?: { key: string; dir: string } }).sort;
  return JSON.stringify([q.page, q.pageSize, q.search || null, q.transportType ?? null, q.onlineRule ?? null, sort?.key ?? null, sort?.dir ?? null]);
}
const sameQuery = (a: ProfileListQuery, b: ProfileListQuery) => queryKey(a) === queryKey(b);

/** What the host's query names, as a value (an absent or undefined field is not named). */
function hostKey(q: Partial<ProfileListQuery> | undefined): string {
  return JSON.stringify(Object.entries(q ?? {}).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The list's query moved to the host's: page and filters as the host has them, page size and sort only when it names them. */
function followHost(cur: ProfileListQuery, host: Partial<ProfileListQuery> | undefined): ProfileListQuery {
  const h = (host ?? {}) as Partial<ProfileListQuery> & { sort?: unknown };
  const next: Record<string, unknown> = { ...cur, page: h.page ?? 1, search: h.search, transportType: h.transportType, onlineRule: h.onlineRule };
  if (h.pageSize !== undefined) next.pageSize = h.pageSize;
  if ('sort' in h && h.sort !== undefined) next.sort = h.sort;
  return next as ProfileListQuery;
}

/** A plain left click (no modifier): the host's router opens the link; any other click keeps the link's own behaviour. */
function plainClick(e: React.MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function DeviceProfileListView({ hrefs, initialQuery, onQueryChange, onCreated, onOpen, onDuplicated, pageSize = 20, now, className }: DeviceProfileListViewProps) {
  const api = useIotAdapter().profiles;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale, timeZone } = useIotText();
  const uid = useId();
  const hostTransports = api?.transports;
  const transports = useMemo(() => hostTransports ?? (['MQTT', 'HTTP', 'ANY'] as ProfileTransport[]), [hostTransports]);
  // the built-ins and the host's polled transports, labelled (the filter and the transport column)
  const transportList = useProfileTransports(transports);

  const queryOf = (q: Partial<ProfileListQuery> | undefined): ProfileListQuery => ({ ...q, page: q?.page ?? 1, pageSize: q?.pageSize ?? pageSize });
  const [query, setQuery] = useState<ProfileListQuery>(() => queryOf(initialQuery));
  const [items, setItems] = useState<DeviceProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, DeviceProfileUsage>>({});
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryRef = useRef(query);
  // a layout effect: the table reports its page for a query the host moved before the passive effects run, and must compare with it
  useLayoutEffect(() => { queryRef.current = query; }, [query]);
  // the host's query moved under the mounted list (its URL changed): follow it; the same values in a new object are no move (1.17).
  // Only what the host names is followed: the page and the filters always (absent = the first page, no filter), the page size and the
  // sort only when the host keeps them, so a host URL without them never undoes the reader's own choice.
  const initialKey = hostKey(initialQuery);
  const [seenInitial, setSeenInitial] = useState(initialKey);
  if (initialKey !== seenInitial) {
    setSeenInitial(initialKey);
    const next = followHost(query, initialQuery);
    if (!sameQuery(next, query)) {
      setQuery(next);
      // the table shows the query it is handed
    }
  }
  // only the newest read is shown: a late answer of an older one is dropped (NB 41-ui-fixes/20 1.8)
  const seqRef = useRef(0);
  const clampRef = useRef<(q: ProfileListQuery, total: number) => void>(() => undefined);

  const readUsage = useCallback((ids: string[], signal?: AbortSignal, seq?: number): Promise<void> => {
    if (!api?.usage || !ids.length) return Promise.resolve();
    return api.usage(ids, signal).then((u) => { if (!signal?.aborted && (seq === undefined || seq === seqRef.current)) setUsage(u); }, () => undefined);
  }, [api]);

  const load = useCallback((q: ProfileListQuery, signal?: AbortSignal): Promise<void> => {
    if (!api?.list) return Promise.resolve();
    const seq = ++seqRef.current;
    return api.list(q, signal).then(
      (page) => {
        if (signal?.aborted || seq !== seqRef.current) return;
        // a page past the end (its last row deleted, a stale URL): the last page instead of an empty list (NB 41-ui-fixes/20 1.11)
        if (!page.items.length && page.total > 0 && q.page > 1) {
          clampRef.current(q, page.total);
          return;
        }
        setItems(page.items);
        setTotal(page.total);
        setError(null);
        setLoadedKey(JSON.stringify(q));
        void readUsage(page.items.map((p) => p.profileId), signal, seq);
      },
      (e) => {
        if (signal?.aborted || seq !== seqRef.current) return;
        setError(errorMessage(e, m.profiles.loadError));
        setLoadedKey(JSON.stringify(q));
      },
    );
  }, [api, m.profiles.loadError, readUsage]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(query, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load, query]);

  function change(patch: Partial<ProfileListQuery>) {
    const next = { ...queryRef.current, ...patch, page: patch.page ?? 1 };
    // at once, not in the effect: the table reports page 1 for a new filter before that effect runs, and must see this query
    queryRef.current = next;
    setQuery(next);
    onQueryChange?.(next);
  }
  useEffect(() => {
    clampRef.current = (q, total) => {
      if (!sameQuery(q, queryRef.current)) return;
      change({ page: Math.max(1, Math.ceil(total / q.pageSize)) });
    };
  });
  /** The table's page, rows per page, sort or search changed (it reports its query on mount too: nothing then). */
  function tableQuery(t: DataTableQuery) {
    const cur = queryRef.current;
    const sort = toIotSort(t.sort, PROFILE_SORT_KEYS);
    const search = t.search || undefined;
    if (t.page === cur.page && t.pageSize === cur.pageSize && search === (cur.search || undefined) && sameSort(sort, cur.sort)) return;
    change({ page: t.page, pageSize: t.pageSize, search, sort });
  }
  /** The Filters panel was applied (back to page 1). */
  function filtersChanged(v: DataTableFilterValues) {
    change({ transportType: choiceOf(v.transportType, transportList.map((t) => t.value)), onlineRule: choiceOf(v.onlineRule, ONLINE_RULES) });
  }
  const filterFields = useMemo((): DataTableFilterField<DeviceProfile>[] => [
    { id: 'transportType', label: m.profiles.transport, type: 'select', options: transportList.map((t) => ({ value: t.value, label: t.label })) },
    { id: 'onlineRule', label: m.profiles.onlineRule, type: 'select', options: ONLINE_RULES.map((r) => ({ value: r, label: m.online[r] })) },
  ], [transportList, m]);
  const filterValues = useMemo((): DataTableFilterValues => ({
    ...(query.transportType ? { transportType: query.transportType } : {}),
    ...(query.onlineRule ? { onlineRule: query.onlineRule } : {}),
  }), [query.transportType, query.onlineRule]);

  // the device counts (and the list) follow every 30 s; there is no live topic for them
  useLiveOrPoll({ poll: () => { void load(queryRef.current); } });

  async function makeDefault(p: DeviceProfile) {
    if (!api?.setDefault) return;
    setBusyId(p.profileId);
    try {
      await api.setDefault(p.profileId);
      notify({ tone: 'success', message: fill(m.profiles.madeDefault, { name: p.name }) });
      await load(queryRef.current);
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.profiles.loadError) });
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(p: DeviceProfile) {
    if (!api?.duplicate) return;
    setBusyId(p.profileId);
    try {
      const copy = await api.duplicate(p.profileId);
      notify({ tone: 'success', message: fill(m.profiles.duplicated, { name: copy.name }) });
      if (onDuplicated) onDuplicated(copy); else await load(queryRef.current);
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.profiles.loadError) });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: DeviceProfile) {
    if (!api?.remove) return;
    setBusyId(p.profileId);
    try {
      await api.remove(p.profileId);
      notify({ tone: 'success', message: m.profiles.deleted });
      await load(queryRef.current);
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.profiles.loadError) });
    } finally {
      setBusyId(null);
    }
  }

  const canManage = caps.canManageProfiles;
  const columns: Column<DeviceProfile>[] = [
    {
      key: 'name',
      header: m.profiles.name,
      sortable: true,
      render: (p) => (
        <a href={hrefs.profile(p.profileId)} className="flex min-w-0 flex-col rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          onClick={onOpen ? (e) => { if (plainClick(e)) { e.preventDefault(); onOpen(p.profileId); } } : undefined}>
          <span className="flex items-center gap-1.5 truncate font-medium text-text-primary hover:text-primary">
            {p.isDefault && <FontAwesomeIcon icon={faStar} className="h-3 w-3 shrink-0 text-warning" aria-hidden="true" />}
            {p.name}
            {p.isDefault && <Badge variant="primary" size="sm">{m.profiles.defaultBadge}</Badge>}
            {p.platformTemplate && <Badge variant="warning" size="sm">{m.profiles.templateBadge}</Badge>}
            {p.builtinKey && <Badge variant="neutral" size="sm">{m.profiles.builtinBadge}</Badge>}
          </span>
          {p.description && <span className="truncate text-xs text-text-secondary">{p.description}</span>}
        </a>
      ),
    },
    { key: 'transport', header: m.profiles.transport, hideBelow: 'sm', sortable: true, render: (p) => transportLabel(p.transportType, (t) => m.transport[t], transportList) },
    { key: 'online', header: m.profiles.onlineRule, hideBelow: 'md', sortable: true, render: (p) => m.online[p.onlineRule] },
    {
      key: 'devices',
      header: m.profiles.devices,
      align: 'right',
      render: (p) => {
        const n = usage[p.profileId]?.devices;
        return <span className="tabular-nums" title={usageList(usage[p.profileId]) || undefined}>{n === null || n === undefined ? '—' : n}</span>;
      },
    },
    {
      key: 'updated',
      header: m.profiles.updated,
      hideBelow: 'lg',
      sortable: true,
      render: (p) => <span className="text-xs text-text-secondary" title={formatDateTime(p.updatedAt, { locale, timeZone })}>{formatRelative(p.updatedAt, { locale, now })}</span>,
    },
    ...(canManage ? [{
      key: 'actions',
      header: <span className="sr-only">{m.profiles.actions}</span>,
      align: 'right' as const,
      render: (p: DeviceProfile) => {
        const inUse = usageList(usage[p.profileId]);
        const blocked = p.isDefault ? m.profiles.deleteDefault : p.platformTemplate ? m.profiles.deleteTemplate : p.builtinKey ? m.profiles.deleteBuiltin : null;
        return (
          <span className="inline-flex items-center justify-end gap-1">
            {!p.isDefault && api?.setDefault && !(p.platformTemplate && !caps.canManageTemplates) && (
              <Button variant="ghost" size="xs" loading={busyId === p.profileId} onClick={() => void makeDefault(p)}>{m.profiles.setDefault}</Button>
            )}
            {api?.duplicate && (
              <Button variant="ghost" size="xs" disabled={busyId === p.profileId} onClick={() => void duplicate(p)} aria-label={`${m.profiles.duplicate} ${p.name}`} title={m.profile.duplicateHint}
                iconLeft={<FontAwesomeIcon icon={faClone} className="h-3 w-3" aria-hidden="true" />}>
                <span className="sr-only">{m.profiles.duplicate}</span>
              </Button>
            )}
            {api?.remove && (blocked ? (
              <span title={blocked}>
                {/* the reason is the button's description: its name is "Delete <profile>" (the aria-label hides the text inside from its name) */}
                <Button variant="ghost" size="xs" disabled aria-label={`${m.profiles.delete} ${p.name}`} aria-describedby={`${uid}-${p.profileId}-why`}
                  iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}>
                  <span id={`${uid}-${p.profileId}-why`} className="sr-only">{blocked}</span>
                </Button>
              </span>
            ) : (
              <Button onClick={() => { void confirmDialog({ title: fill(m.profiles.deleteConfirm, { name: p.name }), message: inUse ? fill(m.profiles.deleteInUse, { list: inUse }) : m.profiles.deleteHint, tone: 'danger', confirmLabel: m.profiles.delete, cancelLabel: m.common.cancel }).then((ok) => { if (ok) void remove(p); }); }} variant="ghost" size="xs" aria-label={`${m.profiles.delete} ${p.name}`} iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}>
                    <span className="sr-only">{m.profiles.delete}</span>
                  </Button>
            ))}
          </span>
        );
      },
    }] : []),
  ];

  if (!api?.list) return null;

  return (
    <div className={cn('space-y-4', className)}>
      <PageHeader
        title={m.profiles.title}
        subtitle={m.profiles.subtitle}
        actions={canManage && api.create ? [{
          label: <><FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" /> {m.profiles.new}</>,
          onClick: () => setCreating(true),
        }] : undefined}
      />
      {caps.failed && (
        <Callout variant="warning" title={null}>
          <span className="flex flex-wrap items-center gap-2">
            {m.common.capabilitiesError}
            <Button variant="outline" size="xs" onClick={caps.retry}>{m.common.retry}</Button>
          </span>
        </Callout>
      )}
      <DataTable<DeviceProfile>
        mode="manual"
        caption={m.profiles.title}
        columns={columns}
        rows={items}
        total={total}
        query={{ page: query.page, pageSize: query.pageSize, sort: toTableSort(query.sort), search: query.search ?? '' }}
        onQueryChange={tableQuery}
        multiSort={false}
        searchPlaceholder={m.profiles.search}
        filterFields={filterFields}
        filterValues={filterValues}
        onFilterValuesChange={filtersChanged}
        pageSizeOptions={LIST_PAGE_SIZES}
        rowId={(p) => p.profileId}
        loading={loadedKey !== JSON.stringify(query)}
        error={error || undefined}
        onRetry={() => void load(queryRef.current)}
        emptyMessage={m.profiles.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
        keyboardNavigation
      />
      {api.usage && <p className="text-xs text-text-secondary">{m.profiles.countsHint}</p>}
      {creating && (
        <NewDeviceProfileDrawer
          open={creating}
          transports={transports}
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setCreating(false);
            if (onCreated) onCreated(p); else void load(queryRef.current);
          }}
        />
      )}
    </div>
  );
}
