'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Modal } from '@/modules/ui/Modal';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { DEVICE_SORT_KEYS, errorMessage, IotApiError, type DeviceListQuery, type PlaceDevicesResult } from '../api/adapter';
import { LIST_PAGE_SIZES, toIotSort } from '../api/list-table';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { DeviceOnlineDot } from '../device/DeviceOnlineDot';
import { fill, plural } from '../format';
import type { DevicePlacement } from '../types/asset';
import { onlineStateOf, type DeviceRecord } from '../types/device';

/**
 * PlaceDevicesDialog — "Place devices" on an asset (phase 08 §8.2): search the tenant's devices (the device list of the adapter),
 * tick several, place them in one call (at most 100: a tick past that is refused and said). A device has one place (NB A-3): placing
 * it here moves it from where it was, so each row says where the device is now (`assets.placements`), a device already here is shown
 * ticked and locked (`isRowSelectionLocked`) whatever page the asset's own list is on, and a device that would leave another asset is
 * named in a confirm before anything moves. The outcome is the host's: how many were placed, moved, or already here. A device deleted
 * meanwhile is unticked and named. The devices are a selectable DataTable (manual mode) whose own search box, sortable columns,
 * connection filter and pages ask the adapter (after the table's pause).
 */
export type PlaceDevicesDialogProps = {
  open: boolean;
  asset: { assetId: string; name: string };
  /** Devices known to be placed directly on the asset (the host's placements say it for every listed device too). */
  placedIds?: ReadonlySet<string>;
  onClose: () => void;
  onPlaced?: (deviceIds: string[]) => void;
};

const MAX_PLACE = 100;

const pathText = (p: DevicePlacement) => p.path.map((c) => c.name).join(' › ');

export function PlaceDevicesDialog({ open, asset, placedIds, onClose, onPlaced }: PlaceDevicesDialogProps) {
  const adapter = useIotAdapter();
  const notify = useIotNotify();
  const { m, locale } = useIotText();
  const [query, setQuery] = useState<DeviceListQuery>({ page: 1, pageSize: 20 });
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // where each listed device is now (every page seen), its name, and the devices whose placement could not be read
  const [placements, setPlacements] = useState<Record<string, DevicePlacement | null>>({});
  const [unread, setUnread] = useState<ReadonlySet<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const api = adapter.devices;
    if (!open || !api) return;
    const ctrl = new AbortController();
    api.list(query, ctrl.signal).then(
      (p) => {
        if (ctrl.signal.aborted) return;
        setNames((prev) => ({ ...prev, ...Object.fromEntries(p.items.map((d) => [d.deviceId, d.name])) }));
        setDevices(p.items);
        setTotal(p.total);
        setError(null);
        const ask = adapter.assets?.placements;
        if (!ask || !p.items.length) return;
        ask(p.items.map((d) => d.deviceId), ctrl.signal).then(
          (at) => {
            if (ctrl.signal.aborted) return;
            setPlacements((prev) => ({ ...prev, ...Object.fromEntries(p.items.map((d) => [d.deviceId, at[d.deviceId] ?? null])) }));
            setUnread((prev) => (p.items.some((d) => prev.has(d.deviceId)) ? new Set([...prev].filter((id) => !p.items.some((d) => d.deviceId === id))) : prev));
          },
          () => { if (!ctrl.signal.aborted) setUnread((prev) => new Set([...prev, ...p.items.map((d) => d.deviceId)])); },
        );
      },
      (e) => { if (!ctrl.signal.aborted) setError(errorMessage(e, m.devices.loadError)); },
    );
    return () => ctrl.abort();
  }, [adapter.devices, adapter.assets, open, query, m.devices.loadError]);

  const here = (id: string) => placedIds?.has(id) || placements[id]?.assetId === asset.assetId;

  // At most MAX_PLACE devices: a tick past the limit is refused and said; a device already here never joins the selection.
  function select(ids: (string | number)[]) {
    const next = ids.map(String).filter((id) => !here(id));
    if (next.length > MAX_PLACE) {
      setNotice(fill(m.asset.placeMax, { max: MAX_PLACE }));
      return;
    }
    setNotice(null);
    setSelected(new Set(next));
  }

  // a ticked device whose placement is still being read: Place waits, so nothing moves unannounced; one whose read failed is unknown
  const checks = !!adapter.assets?.placements;
  const pending = checks && [...selected].some((id) => placements[id] === undefined && !unread.has(id));
  const unknown = checks ? [...selected].filter((id) => placements[id] === undefined && unread.has(id)) : [];

  /** The selected devices placed on another asset now (known from the placements read), with where they are. */
  const moving = useMemo(() => [...selected].flatMap((id) => {
    const p = placements[id];
    return p && p.assetId && p.assetId !== asset.assetId ? [{ id, name: names[id] ?? id, from: pathText(p) }] : [];
  }), [selected, placements, names, asset.assetId]);

  function told(r: PlaceDevicesResult | void, count: number): string {
    const res = r ?? { placed: count, moved: 0, alreadyHere: 0 };
    if (!res.placed) return m.asset.placedNothing;
    const parts = [plural(res.placed, { one: m.asset.placedCount_one, other: m.asset.placedCount }, locale)];
    if (res.moved) parts.push(fill(m.asset.placedMoved, { n: res.moved }));
    if (res.alreadyHere) parts.push(plural(res.alreadyHere, { one: m.asset.placedAlreadyHere_one, other: m.asset.placedAlreadyHere }, locale));
    return parts.join('; ');
  }

  async function submit() {
    const api = adapter.assets;
    if (!api || !selected.size || pending) return;
    if (moving.length || unknown.length) {
      // the devices known to move are named; those whose place could not be read are said to move if they are placed elsewhere
      const ok = await confirmDialog({
        title: moving.length
          ? plural(moving.length, { one: m.asset.placeMovesTitle_one, other: m.asset.placeMovesTitle }, locale)
          : plural(selected.size, { one: m.asset.placeCheckTitle_one, other: m.asset.placeCheckTitle }, locale),
        message: [moving.length ? m.asset.placeMovesHint : null, unknown.length ? fill(m.asset.placeUnknownHint, { names: unknown.map((id) => names[id] ?? id).join(', ') }) : null]
          .filter(Boolean).join('\n'),
        details: moving.length ? (
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {moving.map((d) => <li key={d.id}>{fill(m.asset.placeMoveLine, { device: d.name, path: d.from })}</li>)}
          </ul>
        ) : undefined,
        confirmLabel: m.asset.placeMove,
        cancelLabel: m.common.cancel,
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const ids = [...selected];
      const result = await api.place(asset.assetId, ids);
      notify({ tone: result && !result.placed ? 'info' : 'success', message: told(result, ids.length) });
      onPlaced?.(ids);
      onClose();
    } catch (e) {
      // devices deleted meanwhile: untick and name them; the rest can be placed again
      const gone = e instanceof IotApiError && Array.isArray(e.details?.deviceIds) ? (e.details!.deviceIds as unknown[]).filter((x): x is string => typeof x === 'string') : [];
      if (gone.length) {
        setSelected((prev) => new Set([...prev].filter((id) => !gone.includes(id))));
        setError(fill(m.asset.placeGone, { names: gone.map((id) => names[id] ?? id).join(', ') }));
      } else {
        setError(errorMessage(e, m.asset.placeFailed));
      }
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<DeviceRecord>[] = [
    {
      key: 'name',
      header: m.devices.name,
      sortable: true,
      render: (d) => (
        <span className="block min-w-0">
          <span className="block text-sm text-text-primary">{d.name}</span>
          {d.label && <span className="block text-xs text-text-secondary">{d.label}</span>}
        </span>
      ),
    },
    {
      key: 'placement',
      header: m.asset.placeNowAt,
      render: (d) => {
        if (here(d.deviceId)) return <span className="text-xs text-text-secondary">{m.asset.placeAlreadyHere}</span>;
        const p = placements[d.deviceId];
        if (p === undefined) return <span className="text-xs text-text-secondary">—</span>;
        return p?.assetId
          ? <span className="block max-w-[16rem] truncate text-xs text-text-primary" title={pathText(p)}>{pathText(p)}</span>
          : <span className="text-xs text-text-secondary">{m.asset.placeNowhere}</span>;
      },
    },
    {
      key: 'online',
      sortKey: 'connection',
      header: m.devices.connection,
      align: 'right',
      sortable: true,
      render: (d) => <DeviceOnlineDot state={onlineStateOf(d.online)} lastSeenAt={d.lastActivityAt} compact />,
    },
  ];

  const filterFields: DataTableFilterField<DeviceRecord>[] = [
    { id: 'online', label: m.devices.connection, type: 'select', options: [{ value: 'online', label: m.device.online }, { value: 'offline', label: m.device.offline }] },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={fill(m.asset.placeTitle, { name: asset.name })}
      description={m.asset.placeHint}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={!selected.size || pending} onClick={() => void submit()}>
            {plural(selected.size, { one: m.asset.placeSelected_one, other: m.asset.placeSelected }, locale)}
          </Button>
        </div>
      )}
    >
      <div className="space-y-3">
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        {notice && <p role="status" className="text-sm text-warning-fg">{notice}</p>}
        {unread.size > 0 && <p role="status" className="text-sm text-warning-fg">{m.asset.placementsFailed}</p>}
        <DataTable<DeviceRecord>
          mode="manual"
          variant="plain"
          caption={m.asset.devices}
          columns={columns}
          rows={devices ?? []}
          total={total}
          defaultQuery={{ pageSize: 20 }}
          onQueryChange={(q: DataTableQuery) => {
            const sort = toIotSort(q.sort, DEVICE_SORT_KEYS);
            const online = q.filterValues.online === 'online' || q.filterValues.online === 'offline' ? q.filterValues.online : undefined;
            const next: DeviceListQuery = { page: q.page, pageSize: q.pageSize, ...(q.search.trim() ? { search: q.search.trim() } : {}), ...(sort ? { sort } : {}), ...(online ? { online } : {}) };
            setQuery((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
          }}
          multiSort={false}
          filterFields={filterFields}
          pageSize={20}
          searchPlaceholder={m.asset.placeSearch}
          rowId={(d) => d.deviceId}
          selectable
          selectedRowIds={[...selected]}
          onSelectionChange={select}
          isRowSelectionLocked={(d) => here(d.deviceId)}
          rowSelectLabel={(d) => d.name}
          loading={devices === null}
          emptyMessage={m.devices.empty}
          messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
          pageSizeOptions={LIST_PAGE_SIZES}
          density="compact"
          stickyHeader
        />
      </div>
    </Modal>
  );
}
