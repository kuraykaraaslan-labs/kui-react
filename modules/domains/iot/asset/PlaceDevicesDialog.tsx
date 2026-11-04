'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Modal } from '@/modules/ui/Modal';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { DEVICE_SORT_KEYS, errorMessage, type DeviceListQuery } from '../api/adapter';
import { LIST_PAGE_SIZES, toIotSort } from '../api/list-table';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { DeviceOnlineDot } from '../device/DeviceOnlineDot';
import { fill } from '../format';
import { onlineStateOf, type DeviceRecord } from '../types/device';

/**
 * PlaceDevicesDialog — "Place devices" on an asset (phase 08 §8.2): search the tenant's devices (the device list of the adapter),
 * tick several, place them in one call (at most 100). A device has one place (NB A-3): placing it here moves it from where it was.
 * Devices already placed here are shown ticked and locked (`isRowSelectionLocked`). The devices are a selectable DataTable (manual mode)
 * whose own search box, sortable columns, connection filter and pages ask the adapter (after the table's pause).
 */
export type PlaceDevicesDialogProps = {
  open: boolean;
  asset: { assetId: string; name: string };
  /** Devices already placed directly on the asset. */
  placedIds?: ReadonlySet<string>;
  onClose: () => void;
  onPlaced?: (deviceIds: string[]) => void;
};

const MAX_PLACE = 100;

export function PlaceDevicesDialog({ open, asset, placedIds, onClose, onPlaced }: PlaceDevicesDialogProps) {
  const adapter = useIotAdapter();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [query, setQuery] = useState<DeviceListQuery>({ page: 1, pageSize: 20 });
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = adapter.devices;
    if (!open || !api) return;
    const ctrl = new AbortController();
    api.list(query, ctrl.signal).then(
      (p) => { if (!ctrl.signal.aborted) { setDevices(p.items); setTotal(p.total); setError(null); } },
      (e) => { if (!ctrl.signal.aborted) setError(errorMessage(e, m.devices.loadError)); },
    );
    return () => ctrl.abort();
  }, [adapter.devices, open, query, m.devices.loadError]);

  // At most MAX_PLACE devices: ticks past the limit are dropped; a device already here never joins the selection.
  function select(ids: (string | number)[]) {
    setSelected(new Set(ids.map(String).filter((id) => !placedIds?.has(id)).slice(0, MAX_PLACE)));
  }

  async function submit() {
    const api = adapter.assets;
    if (!api || !selected.size) return;
    setBusy(true);
    setError(null);
    try {
      const ids = [...selected];
      await api.place(asset.assetId, ids);
      notify({ tone: 'success', message: m.asset.placed });
      onPlaced?.(ids);
      onClose();
    } catch (e) {
      setError(errorMessage(e, m.asset.placeFailed));
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
          <Button variant="primary" size="sm" loading={busy} disabled={!selected.size} onClick={() => void submit()}>
            {fill(m.asset.placeSelected, { n: selected.size })}
          </Button>
        </div>
      )}
    >
      <div className="space-y-3">
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
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
          isRowSelectionLocked={(d) => placedIds?.has(d.deviceId) ?? false}
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
