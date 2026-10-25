'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { PageHeader } from '@/modules/ui/PageHeader';
import { Pagination } from '@/modules/ui/Pagination';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { SearchBar } from '@/modules/ui/SearchBar';
import { Select } from '@/modules/ui/Select';
import { errorMessage, type ProfileListQuery } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { fill, formatDateTime, formatRelative } from '../format';
import { ONLINE_RULES, type DeviceProfile, type DeviceProfileUsage, type OnlineRule, type ProfileTransport } from '../types/profile';
import { NewDeviceProfileDrawer } from './NewDeviceProfileDrawer';

/**
 * DeviceProfileListView — the device profiles of a workspace (phase 01 §1.4; NB iot_device_profile 03 §3.3), read through the adapter:
 * search, transport and online-rule filters, server paging; the default first with its star; the device count of each profile from the
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
  const transports = api?.transports ?? (['MQTT', 'HTTP', 'ANY'] as ProfileTransport[]);

  const [query, setQuery] = useState<ProfileListQuery>(() => ({ page: 1, pageSize, ...initialQuery }));
  const [items, setItems] = useState<DeviceProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, DeviceProfileUsage>>({});
  const [searchText, setSearchText] = useState(query.search ?? '');
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

  const changeRef = useRef<(patch: Partial<ProfileListQuery>) => void>(() => undefined);
  function change(patch: Partial<ProfileListQuery>) {
    const next = { ...queryRef.current, ...patch, page: patch.page ?? 1 };
    setQuery(next);
    onQueryChange?.(next);
  }
  useEffect(() => { changeRef.current = change; });
  useEffect(() => {
    if ((queryRef.current.search ?? '') === searchText) return;
    const t = setTimeout(() => changeRef.current({ search: searchText || undefined }), 300);
    return () => clearTimeout(t);
  }, [searchText]);

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
    { key: 'transport', header: m.profiles.transport, hideBelow: 'sm', render: (p) => m.transport[p.transportType] },
    { key: 'online', header: m.profiles.onlineRule, hideBelow: 'md', render: (p) => m.online[p.onlineRule] },
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
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  const any = { value: '', label: m.common.any };

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
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
        <SearchBar placeholder={m.profiles.search} value={searchText} onChange={setSearchText} onClear={() => setSearchText('')} />
        <Select id="profile-filter-transport" label={m.profiles.transport} value={query.transportType ?? ''}
          onChange={(e) => change({ transportType: (e.target.value || undefined) as ProfileTransport | undefined })}
          options={[any, ...transports.map((t) => ({ value: t, label: m.transport[t] }))]} />
        <Select id="profile-filter-online" label={m.profiles.onlineRule} value={query.onlineRule ?? ''}
          onChange={(e) => change({ onlineRule: (e.target.value || undefined) as OnlineRule | undefined })}
          options={[any, ...ONLINE_RULES.map((r) => ({ value: r, label: m.online[r] }))]} />
      </div>
      <DataTable<DeviceProfile>
        mode="manual"
        variant="plain"
        caption={m.profiles.title}
        columns={columns}
        rows={items}
        rowId={(p) => p.profileId}
        loading={loadedKey !== JSON.stringify(query)}
        error={error || undefined}
        onRetry={() => void load(queryRef.current)}
        emptyMessage={m.profiles.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
        searchable={false}
        pageSizeOptions={[]}
        keyboardNavigation
      />
      {api.usage && <p className="text-xs text-text-secondary">{m.profiles.countsHint}</p>}
      {pages > 1 && (
        <div className="flex justify-center">
          <Pagination page={query.page} totalPages={pages} onPageChange={(page) => change({ page })} size="sm" />
        </div>
      )}
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
