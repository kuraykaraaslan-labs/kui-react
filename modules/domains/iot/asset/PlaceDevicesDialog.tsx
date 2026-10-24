'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Modal } from '@/modules/ui/Modal';
import { SearchBar } from '@/modules/ui/SearchBar';
import { Spinner } from '@/modules/ui/Spinner';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { DeviceOnlineDot } from '../device/DeviceOnlineDot';
import { fill } from '../format';
import { onlineStateOf, type DeviceRecord } from '../types/device';

/**
 * PlaceDevicesDialog — "Place devices" on an asset (phase 08 §8.2): search the tenant's devices (the device list of the adapter),
 * tick several, place them in one call (at most 100). A device has one place (NB A-3): placing it here moves it from where it was.
 * Devices already placed here are shown ticked and locked.
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

  function toggle(id: string, on: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (on && next.size < MAX_PLACE) next.add(id); else next.delete(id);
      return next;
    });
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
        {devices === null ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : devices.length === 0 ? (
          <p className="py-4 text-sm text-text-secondary">{m.devices.empty}</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-auto rounded-lg border border-border" aria-label={m.asset.devices}>
            {devices.map((d) => {
              const here = placedIds?.has(d.deviceId) ?? false;
              return (
                <li key={d.deviceId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <Checkbox
                    id={`place-${d.deviceId}`}
                    label={d.name}
                    hint={d.label ?? undefined}
                    checked={here || selected.has(d.deviceId)}
                    disabled={here}
                    onChange={(e) => toggle(d.deviceId, e.target.checked)}
                  />
                  <DeviceOnlineDot state={onlineStateOf(d.online)} lastSeenAt={d.lastActivityAt} compact />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
