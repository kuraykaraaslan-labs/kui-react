'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Modal } from '@/modules/ui/Modal';
import { SearchBar } from '@/modules/ui/SearchBar';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { DeviceOnlineDot } from '../device/DeviceOnlineDot';
import { fill } from '../format';
import { onlineStateOf, type DeviceRecord } from '../types/device';

/**
 * PlaceDevicesDialog — "Place devices" on an asset (phase 08 §8.2): search the tenant's devices (the device list of the adapter),
 * tick several, place them in one call (at most 100). A device has one place (NB A-3): placing it here moves it from where it was.
 * Devices already placed here are shown ticked and locked (`isRowSelectionLocked`). The devices are a selectable DataTable (manual mode).
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
  const [search, setSearch] = useState('');
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = adapter.devices;
    if (!open || !api) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api.list({ page: 1, pageSize: 50, ...(search.trim() ? { search: search.trim() } : {}) }, ctrl.signal).then(
        (p) => { if (!ctrl.signal.aborted) { setDevices(p.items); setError(null); } },
        (e) => { if (!ctrl.signal.aborted) setError(errorMessage(e, m.devices.loadError)); },
      );
    }, search ? 250 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [adapter.devices, open, search, m.devices.loadError]);

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
      render: (d) => (
        <span className="block min-w-0">
          <span className="block text-sm text-text-primary">{d.name}</span>
          {d.label && <span className="block text-xs text-text-secondary">{d.label}</span>}
        </span>
      ),
    },
    {
      key: 'online',
      header: m.devices.connection,
      align: 'right',
      render: (d) => <DeviceOnlineDot state={onlineStateOf(d.online)} lastSeenAt={d.lastActivityAt} compact />,
    },
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
        <SearchBar placeholder={m.asset.placeSearch} value={search} onChange={setSearch} onClear={() => setSearch('')} />
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <DataTable<DeviceRecord>
          mode="manual"
          variant="plain"
          caption={m.asset.devices}
          columns={columns}
          rows={devices ?? []}
          rowId={(d) => d.deviceId}
          selectable
          selectedRowIds={[...selected]}
          onSelectionChange={select}
          isRowSelectionLocked={(d) => placedIds?.has(d.deviceId) ?? false}
          rowSelectLabel={(d) => d.name}
          loading={devices === null}
          emptyMessage={m.devices.empty}
          messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
          searchable={false}
          pageSizeOptions={[]}
          density="compact"
          stickyHeader
        />
      </div>
    </Modal>
  );
}
