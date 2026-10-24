'use client';
import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkSlash, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { EmptyState } from '@/modules/ui/EmptyState';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import type { DevicePlacement } from '../types/asset';
import { AssetBreadcrumb } from './AssetBreadcrumb';
import { DevicePlacementPicker } from './DevicePlacementPicker';

/**
 * DevicePlacementPanel — where a device is (phase 08 §8.2; NB iot_asset 03 §3.2, the device page's Placement tab): the path of the
 * asset it is placed on, root first, each step a link; "Change placement" opens `DevicePlacementPicker`; "Remove placement" ends it.
 * A device has one place (NB A-3).
 */
export type DevicePlacementPanelProps = {
  deviceId: string;
  hrefs?: { asset?: (assetId: string) => string };
  className?: string;
};

export function DevicePlacementPanel({ deviceId, hrefs = {}, className }: DevicePlacementPanelProps) {
  const api = useIotAdapter().assets;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [placement, setPlacement] = useState<DevicePlacement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    if (!api) return Promise.resolve();
    return api.placement(deviceId, signal).then(
      (p) => { if (!signal?.aborted) { setPlacement(p); setError(null); } },
      (e) => { if (!signal?.aborted) setError(errorMessage(e, m.placement.loadError)); },
    );
  }, [api, deviceId, m.placement.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  async function set(assetId: string | null) {
    if (!api) return;
    setBusy(true);
    try {
      setPlacement(await api.setPlacement(deviceId, assetId));
      notify({ tone: 'success', message: assetId ? m.placement.saved : m.placement.removed });
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.placement.failed) });
    } finally {
      setBusy(false);
    }
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
  if (!placement) return <SkeletonText lines={2} className={className} />;
  const at = placement.path[placement.path.length - 1];

  return (
    <section aria-label={m.placement.title} className={cn('space-y-4 rounded-xl border border-border bg-surface-raised p-4 sm:p-5', className)}>
      {placement.assetId && at ? (
        <div className="space-y-2">
          <p className="text-xs text-text-secondary">{m.placement.at}</p>
          <AssetBreadcrumb path={placement.path} href={hrefs.asset} maxItems={6} />
          {hrefs.asset && (
            <a href={hrefs.asset(at.assetId)} className="inline-flex text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
              {m.placement.open}
            </a>
          )}
        </div>
      ) : (
        <EmptyState icon={<FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />} title={m.placement.title} description={m.placement.none} />
      )}
      {caps.canPlaceDevices && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" loading={busy && picking} onClick={() => setPicking(true)} iconLeft={<FontAwesomeIcon icon={faLocationDot} className="h-3 w-3" aria-hidden="true" />}>
            {placement.assetId ? m.placement.change : m.placement.place}
          </Button>
          {placement.assetId && (
            <Button variant="ghost" size="sm" loading={busy && !picking} onClick={() => void set(null)} iconLeft={<FontAwesomeIcon icon={faLinkSlash} className="h-3 w-3" aria-hidden="true" />}>
              {m.placement.remove}
            </Button>
          )}
        </div>
      )}
      {picking && (
        <DevicePlacementPicker
          open
          value={placement.assetId}
          onClose={() => setPicking(false)}
          onPick={async (id) => { await set(id); setPicking(false); }}
        />
      )}
    </section>
  );
}
