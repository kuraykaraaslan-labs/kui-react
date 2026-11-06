'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkSlash, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { EmptyState } from '@/modules/ui/EmptyState';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { DevicePlacement } from '../types/asset';
import { AssetBreadcrumb } from './AssetBreadcrumb';
import { DevicePlacementPicker } from './DevicePlacementPicker';
import { RelationsSection } from './RelationsSection';

/**
 * DevicePlacementPanel — where a device is and what it is related to (phase 08 §8.2; NB iot_asset 03 §3.2, the device page's
 * "Placement & relations" tab): the path of the asset it is placed on, root first, each step a link; "Change placement" opens
 * `DevicePlacementPicker`, which says where the device is now; "Remove placement" asks first, naming the device and the asset's path.
 * A device has one place (NB A-3). Both writes send where the device was as read (`expectedAssetId`): a host refuses a stale one
 * (`stale`), the panel says so and shows where the device is now (NB 41-ui-fixes/26 1.11, 1.13).
 *
 * Under it, when the adapter reads relations, the device's relations (`RelationsSection` for `{ type: 'DEVICE', id }`, the host's pages
 * when it serves them): device-to-device and asset relations block a delete and a release, so they are on a screen and can be removed
 * here (1.3). While the capabilities are being read the actions are a skeleton; a failed read says so with a retry instead of hiding
 * them silently (1.12).
 */
export type DevicePlacementPanelProps = {
  deviceId: string;
  /** The device's name for the remove confirm (else the host's `placement.deviceName`, else "This device"). */
  deviceName?: string;
  hrefs?: { asset?: (assetId: string) => string; device?: (deviceId: string) => string };
  /** Opens the relation ends through the host's router. */
  onNavigate?: (href: string) => void;
  className?: string;
};

export function DevicePlacementPanel({ deviceId, deviceName, hrefs = {}, onNavigate, className }: DevicePlacementPanelProps) {
  const api = useIotAdapter().assets;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [placement, setPlacement] = useState<DevicePlacement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [relationsVersion, setRelationsVersion] = useState(0);
  const seq = useRef(0);

  const load = useCallback((signal?: AbortSignal) => {
    if (!api) return Promise.resolve();
    const mine = ++seq.current;
    return api.placement(deviceId, signal).then(
      (p) => { if (!signal?.aborted && mine === seq.current) { setPlacement(p); setError(null); } },
      (e) => { if (!signal?.aborted && mine === seq.current) setError(errorMessage(e, m.placement.loadError)); },
    );
  }, [api, deviceId, m.placement.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  /** Places the device on `assetId` (`null`: removes it), against where it was as read. True when it was written. */
  async function set(assetId: string | null): Promise<boolean> {
    if (!api || !placement) return false;
    setBusy(true);
    try {
      const next = await api.setPlacement(deviceId, assetId, { expectedAssetId: placement.assetId });
      seq.current += 1; // a read still on its way is older than this answer
      setPlacement(next);
      notify({ tone: 'success', message: assetId ? m.placement.saved : m.placement.removed });
      // the placement is a CONTAINS relation: the relations below change with it
      setRelationsVersion((v) => v + 1);
      return true;
    } catch (e) {
      if (e instanceof IotApiError && e.code === 'stale') {
        // someone moved it since: show where it is now, never write over what the viewer did not see
        notify({ tone: 'error', message: errorMessage(e, m.placement.stale) });
        void load();
        setRelationsVersion((v) => v + 1);
        return true;
      }
      notify({ tone: 'error', message: errorMessage(e, m.placement.failed) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(p: DevicePlacement) {
    const device = deviceName ?? p.deviceName ?? m.placement.thisDevice;
    void confirmDialog({
      title: m.placement.removeConfirm,
      message: fill(m.placement.removeHint, { device, path: p.path.map((c) => c.name).join(' › ') }),
      tone: 'danger', confirmLabel: m.placement.remove, cancelLabel: m.common.cancel,
    }).then((ok) => { if (ok) void set(null); });
  }

  if (!api) return null;
  if (error && !placement) {
    return (
      <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-6 text-center text-sm text-error', className)}>
        {error}
        <Button variant="outline" size="sm" onClick={() => void load()}>{m.common.retry}</Button>
      </div>
    );
  }
  if (!placement) return <SkeletonText lines={2} label={m.common.loading} className={className} />;
  const at = placement.path[placement.path.length - 1];
  const withRelations = !!(api.relations || api.relationsPage);

  return (
    <div className={cn('space-y-4', className)}>
      <section aria-label={m.placement.title} className="space-y-4 rounded-xl border border-border bg-surface-raised p-4 sm:p-5">
        {caps.failed && (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-warning bg-warning-subtle px-3 py-2 text-sm text-warning-fg">
            <span className="min-w-0 flex-1">{m.common.capabilitiesError}</span>
            <Button variant="outline" size="xs" onClick={caps.retry}>{m.common.retry}</Button>
          </div>
        )}
        {placement.assetId && at ? (
          <div className="space-y-2">
            <p className="text-xs text-text-secondary">{m.placement.at}</p>
            <AssetBreadcrumb path={placement.path} href={hrefs.asset} onNavigate={onNavigate} maxItems={6} />
            {hrefs.asset && (
              <a href={hrefs.asset(at.assetId)} className="inline-flex text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                {m.placement.open}
              </a>
            )}
          </div>
        ) : (
          <EmptyState icon={<FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />} title={m.placement.title} description={m.placement.none} />
        )}
        {!caps.ready && !caps.failed ? (
          <SkeletonText lines={1} label={m.common.loading} className="max-w-xs" />
        ) : caps.canPlaceDevices && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" loading={busy && picking} disabled={busy} onClick={() => setPicking(true)} iconLeft={<FontAwesomeIcon icon={faLocationDot} className="h-3 w-3" aria-hidden="true" />}>
              {placement.assetId ? m.placement.change : m.placement.place}
            </Button>
            {placement.assetId && (
              <Button variant="ghost" size="sm" loading={busy && !picking} disabled={busy} onClick={() => confirmRemove(placement)} iconLeft={<FontAwesomeIcon icon={faLinkSlash} className="h-3 w-3" aria-hidden="true" />}>
                {m.placement.remove}
              </Button>
            )}
          </div>
        )}
        {picking && (
          <DevicePlacementPicker
            open
            value={placement.assetId}
            current={placement.path}
            onClose={() => setPicking(false)}
            onPick={async (id) => { if (await set(id)) setPicking(false); }}
          />
        )}
      </section>
      {withRelations && (
        <section aria-label={m.placement.relations} className="space-y-2 rounded-xl border border-border bg-surface-raised p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-text-primary">{m.placement.relations}</h3>
          <p className="text-xs text-text-secondary">{m.placement.relationsHint}</p>
          <RelationsSection
            entity={{ type: 'DEVICE', id: deviceId }}
            hrefs={hrefs}
            onNavigate={onNavigate}
            reloadKey={relationsVersion}
            // a removed CONTAINS was the placement: where the device is is read again with the relations
            onChanged={() => { setRelationsVersion((v) => v + 1); void load(); }}
          />
        </section>
      )}
    </div>
  );
}
