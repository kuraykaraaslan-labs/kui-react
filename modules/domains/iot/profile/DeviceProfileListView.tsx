'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableFilterValues, DataTableQuery } from '@/modules/ui/Table/types';
import { PageHeader } from '@/modules/ui/PageHeader';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { PROFILE_SORT_KEYS, errorMessage, type ProfileListQuery } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { LIST_PAGE_SIZES, choiceOf, sameSort, toIotSort, toTableSort } from '../api/list-table';
import { fill, formatDateTime, formatRelative } from '../format';
import { ONLINE_RULES, type DeviceProfile, type DeviceProfileUsage, type ProfileTransport } from '../types/profile';
import { NewDeviceProfileDrawer } from './NewDeviceProfileDrawer';

/**
 * DeviceProfileListView — the device profiles of a workspace (phase 01 §1.4; NB iot_device_profile 03 §3.3), read through the adapter,
 * on the DataTable's own toolbar: search, the Filters panel (transport, online rule), sortable columns (name, transport, online rule,
 * updated), rows per page and server paging; without a sort the default first with its star; the device count of each profile from the
 * host's usage answer, refreshed every 30 s. With `canManageProfiles`: "New profile" (the online rule is chosen explicitly, OD-63),
 * "Make default" and delete. A delete names what still uses the profile; the default profile and a profile in use are refused by the
 * host, and its answer is shown as it comes.
 */
export type DeviceProfileListViewProps = {
  hrefs: { profile: (profileId: string) => string };
  initialQuery?: Partial<ProfileListQuery>;
  onQueryChange?: (query: ProfileListQuery) => void;
  /** After a create (the host opens the new profile). */
  onCreated?: (profile: DeviceProfile) => void;
  pageSize?: number;
  now?: number;
  className?: string;
};

export function usageList(u: DeviceProfileUsage | undefined): string {
  return (u?.references ?? []).filter((r) => r.count > 0).map((r) => `${r.count} ${r.label}`).join(', ');
}

export function DeviceProfileListView({ hrefs, initialQuery, onQueryChange, onCreated, pageSize = 20, now, className }: DeviceProfileListViewProps) {
  const api = useIotAdapter().profiles;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale } = useIotText();
  const hostTransports = api?.transports;
  const transports = useMemo(() => hostTransports ?? (['MQTT', 'HTTP', 'ANY'] as ProfileTransport[]), [hostTransports]);

  const [query, setQuery] = useState<ProfileListQuery>(() => ({ ...initialQuery, page: initialQuery?.page ?? 1, pageSize: initialQuery?.pageSize ?? pageSize }));
  const [items, setItems] = useState<DeviceProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, DeviceProfileUsage>>({});
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);

  const readUsage = useCallback((ids: string[], signal?: AbortSignal): Promise<void> => {
    if (!api?.usage || !ids.length) return Promise.resolve();
    return api.usage(ids, signal).then((u) => { if (!signal?.aborted) setUsage(u); }, () => undefined);
  }, [api]);

  const load = useCallback((q: ProfileListQuery, signal?: AbortSignal): Promise<void> => {
    if (!api?.list) return Promise.resolve();
    return api.list(q, signal).then(
      (page) => {
        if (signal?.aborted) return;
        setItems(page.items);
        setTotal(page.total);
        setError(null);
        setLoadedKey(JSON.stringify(q));
        void readUsage(page.items.map((p) => p.profileId), signal);
      },
      (e) => {
        if (signal?.aborted) return;
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
    change({ transportType: choiceOf(v.transportType, transports), onlineRule: choiceOf(v.onlineRule, ONLINE_RULES) });
  }
  const filterFields = useMemo((): DataTableFilterField<DeviceProfile>[] => [
    { id: 'transportType', label: m.profiles.transport, type: 'select', options: transports.map((t) => ({ value: t, label: m.transport[t] })) },
    { id: 'onlineRule', label: m.profiles.onlineRule, type: 'select', options: ONLINE_RULES.map((r) => ({ value: r, label: m.online[r] })) },
  ], [transports, m]);
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
        <a href={hrefs.profile(p.profileId)} className="flex min-w-0 flex-col rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          <span className="flex items-center gap-1.5 truncate font-medium text-text-primary hover:text-primary">
            {p.isDefault && <FontAwesomeIcon icon={faStar} className="h-3 w-3 shrink-0 text-warning" aria-hidden="true" />}
            {p.name}
            {p.isDefault && <Badge variant="primary" size="sm">{m.profiles.defaultBadge}</Badge>}
          </span>
          {p.description && <span className="truncate text-xs text-text-secondary">{p.description}</span>}
        </a>
      ),
    },
    { key: 'transport', header: m.profiles.transport, hideBelow: 'sm', sortable: true, render: (p) => m.transport[p.transportType] },
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
      render: (p) => <span className="text-xs text-text-secondary" title={formatDateTime(p.updatedAt, { locale })}>{formatRelative(p.updatedAt, { locale, now })}</span>,
    },
    ...(canManage ? [{
      key: 'actions',
      header: <span className="sr-only">{m.profiles.actions}</span>,
      align: 'right' as const,
      render: (p: DeviceProfile) => {
        const inUse = usageList(usage[p.profileId]);
        return (
          <span className="inline-flex items-center justify-end gap-1">
            {!p.isDefault && api?.setDefault && (
              <Button variant="ghost" size="xs" loading={busyId === p.profileId} onClick={() => void makeDefault(p)}>{m.profiles.setDefault}</Button>
            )}
            {api?.remove && (p.isDefault ? (
              <span title={m.profiles.deleteDefault}>
                <Button variant="ghost" size="xs" disabled aria-label={`${m.profiles.delete} ${p.name}`} iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}>
                  <span className="sr-only">{m.profiles.deleteDefault}</span>
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
