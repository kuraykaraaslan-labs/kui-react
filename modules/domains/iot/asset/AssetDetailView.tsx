'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsUpDownLeftRight, faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Pagination } from '@/modules/ui/Pagination';
import { Popconfirm } from '@/modules/ui/Popconfirm';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { TabGroup, type Tab } from '@/modules/ui/TabGroup';
import { Toggle } from '@/modules/ui/Toggle';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime } from '../format';
import type { AssetNode, AssetRecord, AssetRelation, PlacedDevice } from '../types/asset';
import { AssetBreadcrumb } from './AssetBreadcrumb';
import { AssetFormDrawer } from './AssetFormDrawer';
import { AssetKindBadge } from './AssetKindBadge';
import { AssetRelationTable } from './AssetRelationTable';
import { MoveAssetDialog } from './MoveAssetDialog';
import { PlaceDevicesDialog } from './PlaceDevicesDialog';
import { PlacedDeviceTable } from './PlacedDeviceTable';

/**
 * AssetDetailView — one site or asset (phase 08 §8.2; NB iot_asset 03 §3.2), read through the adapter's `assets`: the header with
 * its kind, code and actions (add a child, edit, "Move to…", delete: refused by the host while children remain or another module
 * points at it, and the refusal's reason is shown), the path from the materialised path, and the tabs Overview (description,
 * time zone (inherited when empty), location, counts, attributes), Devices (placed here or below, with the online state and address,
 * "Place devices", remove a placement), Child assets and Relations.
 *
 * `nodes` is the tree the host already holds (the Move dialog offers it, minus the asset's own subtree); `onChanged` asks the host
 * to read the tree again after a write.
 */
export type AssetDetailViewProps = {
  assetId: string;
  nodes?: AssetNode[];
  hrefs?: { asset?: (assetId: string) => string; device?: (deviceId: string) => string };
  /** The open tab and its change (a host keeps it in its URL). */
  tab?: string;
  onTabChange?: (tab: string) => void;
  onChanged?: () => void;
  onDeleted?: (parentId: string | null) => void;
  /** Open a child asset (else its `hrefs.asset` link is used). */
  onOpenAsset?: (assetId: string) => void;
  pageSize?: number;
  now?: number;
  className?: string;
};

export function AssetDetailView({
  assetId, nodes = [], hrefs = {}, tab, onTabChange, onChanged, onDeleted, onOpenAsset, pageSize = 20, now, className,
}: AssetDetailViewProps) {
  const api = useIotAdapter().assets;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback((signal?: AbortSignal) => {
    if (!api) return Promise.resolve();
    return api.get(assetId, signal).then(
      (a) => { if (!signal?.aborted) { setAsset(a); setError(null); } },
      (e) => { if (!signal?.aborted) setError({ id: assetId, message: errorMessage(e, m.asset.loadError) }); },
    );
  }, [api, assetId, m.asset.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  const changed = useCallback(() => {
    setVersion((v) => v + 1);
    void load();
    onChanged?.();
  }, [load, onChanged]);

  async function remove() {
    if (!api || !asset) return;
    setDeleting(true);
    try {
      await api.remove(asset.assetId);
      notify({ tone: 'success', message: m.asset.deleted });
      onChanged?.();
      onDeleted?.(asset.parentId);
    } catch (e) {
      notify({ tone: 'error', message: fill(m.asset.deleteBlocked, { reason: errorMessage(e, m.asset.failed) }) });
    } finally {
      setDeleting(false);
    }
  }

  const children = useMemo(() => findChildren(nodes, assetId), [nodes, assetId]);

  if (!api) return null;
  const shown = asset && asset.assetId === assetId ? asset : null;
  if (error && error.id === assetId && !shown) {
    return (
      <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-8 text-center text-sm text-error', className)}>
        {error.message}
        <Button variant="outline" size="sm" onClick={() => void load()}>{m.common.retry}</Button>
      </div>
    );
  }
  if (!shown) return <SkeletonText lines={6} className={className} />;
  const a = shown;

  const tabs: Tab[] = [
    { id: 'overview', label: m.asset.overview, order: 0, content: <Overview asset={a} /> },
    {
      id: 'devices', label: m.asset.devices, order: 10,
      content: <DevicesTab key={`${a.assetId}:${version}`} asset={a} hrefs={hrefs} pageSize={pageSize} now={now} onChanged={changed} />,
    },
    {
      id: 'children', label: m.asset.children, order: 20,
      content: <ChildrenList rows={children ?? []} known={children !== null} count={a.childCount} hrefs={hrefs} onOpenAsset={onOpenAsset} />,
    },
    ...(api.relations ? [{
      id: 'relations', label: m.asset.relations, order: 30,
      content: <RelationsTab key={`${a.assetId}:${version}`} assetId={a.assetId} hrefs={hrefs} />,
    }] : []),
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <AssetBreadcrumb path={[...a.ancestors, { assetId: a.assetId, code: a.code, name: a.name, kind: a.kind }]} href={hrefs.asset} currentLast />
      <section aria-label={a.name} className="rounded-xl border border-border bg-surface-raised p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-xl font-bold leading-snug text-text-primary">{a.name}</h1>
              <AssetKindBadge kind={a.kind} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
              <span>{m.asset.code}: <code className="font-mono text-text-primary">{a.code}</code></span>
              <span>{fill(m.asset.childCount, { n: a.childCount })}</span>
              <span>{fill(m.assets.devicesBadge, { n: a.deviceCount })}</span>
            </p>
          </div>
          {caps.canManageAssets && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddingChild(true)} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>{m.asset.addChild}</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} iconLeft={<FontAwesomeIcon icon={faPen} className="h-3 w-3" aria-hidden="true" />}>{m.asset.edit}</Button>
              <Button variant="ghost" size="sm" onClick={() => setMoving(true)} iconLeft={<FontAwesomeIcon icon={faArrowsUpDownLeftRight} className="h-3 w-3" aria-hidden="true" />}>{m.asset.move}</Button>
              <Popconfirm
                trigger={(
                  <Button variant="ghost" size="sm" loading={deleting} iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}>{m.asset.delete}</Button>
                )}
                title={fill(m.asset.deleteConfirm, { name: a.name })}
                description={m.asset.deleteHint}
                confirmLabel={m.asset.delete}
                cancelLabel={m.common.cancel}
                danger
                placement="bottom"
                onConfirm={() => void remove()}
              />
            </div>
          )}
        </div>
      </section>

      <TabGroup tabs={tabs} defaultTab={tab} onTabChange={onTabChange} label={a.name} lazy isolate retryLabel={m.common.retry} />

      {editing && <AssetFormDrawer open asset={a} onClose={() => setEditing(false)} onSaved={changed} />}
      {addingChild && <AssetFormDrawer open parent={{ assetId: a.assetId, name: a.name }} onClose={() => setAddingChild(false)} onSaved={changed} />}
      {moving && <MoveAssetDialog open asset={a} nodes={nodes} onClose={() => setMoving(false)} onMoved={changed} />}
    </div>
  );
}

/** The direct children of a node in the host's tree; null when the tree does not hold the node (not loaded). */
function findChildren(nodes: AssetNode[], assetId: string): AssetNode[] | null {
  for (const n of nodes) {
    if (n.assetId === assetId) return n.children;
    const hit = findChildren(n.children, assetId);
    if (hit) return hit;
  }
  return null;
}

function Overview({ asset }: { asset: AssetRecord }) {
  const { m, locale } = useIotText();
  const inheritedFrom = !asset.timezone && asset.effectiveTimezone
    ? [...asset.ancestors].reverse()[0]?.name ?? null : null;
  const zone = asset.timezone ?? (asset.effectiveTimezone
    ? (inheritedFrom ? fill(m.asset.timezoneInherited, { zone: asset.effectiveTimezone, name: inheritedFrom }) : asset.effectiveTimezone) : '—');
  const coords = asset.lat != null && asset.lng != null ? `${asset.lat.toFixed(5)}, ${asset.lng.toFixed(5)}` : '—';
  const rows: Array<[string, React.ReactNode]> = [
    [m.asset.kind, <AssetKindBadge key="k" kind={asset.kind} />],
    [m.asset.code, <code key="c" className="font-mono">{asset.code}</code>],
    [m.asset.timezone, zone],
    [m.asset.coordinates, coords],
    [m.asset.children, String(asset.childCount)],
    [m.asset.devices, String(asset.deviceCount)],
    [m.asset.created, formatDateTime(asset.createdAt, { locale })],
  ];
  const attrs = Object.entries(asset.attributes ?? {});
  return (
    <div className="space-y-4">
      {asset.description && <p className="text-sm text-text-primary">{asset.description}</p>}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-raised p-4 text-sm sm:grid-cols-2 sm:p-5">
        {rows.map(([term, value]) => (
          <div key={term} className="min-w-0">
            <dt className="text-xs text-text-secondary">{term}</dt>
            <dd className="break-words text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-label={m.asset.attributes} className="rounded-xl border border-border bg-surface-raised p-4 sm:p-5">
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{m.asset.attributes}</h2>
        {attrs.length ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {attrs.map(([k, v]) => (
              <div key={k} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border py-1 last:border-b-0">
                <dt className="truncate font-mono text-xs text-text-secondary">{k}</dt>
                <dd className="truncate text-text-primary">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="text-sm text-text-secondary">{m.asset.noAttributes}</p>}
      </section>
    </div>
  );
}

function DevicesTab({ asset, hrefs, pageSize, now, onChanged }: {
  asset: AssetRecord; hrefs: AssetDetailViewProps['hrefs'] & object; pageSize: number; now?: number; onChanged: () => void;
}) {
  const api = useIotAdapter().assets!;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [recursive, setRecursive] = useState(true);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PlacedDevice[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const key = `${recursive}:${page}`;

  const load = useCallback((signal?: AbortSignal) => api.devices(asset.assetId, { page, pageSize, recursive }, signal).then(
    (p) => { if (!signal?.aborted) { setRows(p.items); setTotal(p.total); setError(null); setLoadedKey(`${recursive}:${page}`); } },
    (e) => { if (!signal?.aborted) { setError(errorMessage(e, m.asset.loadError)); setLoadedKey(`${recursive}:${page}`); } },
  ), [api, asset.assetId, page, pageSize, recursive, m.asset.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  async function unplace(deviceId: string) {
    setBusyId(deviceId);
    try {
      await api.setPlacement(deviceId, null);
      notify({ tone: 'success', message: m.asset.unplaced });
      onChanged();
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.placement.failed) });
    } finally {
      setBusyId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const here = new Set(rows.filter((r) => r.placement.assetId === asset.assetId).map((r) => r.device.deviceId));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Toggle id={`asset-devices-recursive-${asset.assetId}`} checked={recursive} onChange={(on: boolean) => { setRecursive(on); setPage(1); }} label={m.asset.recursive} />
        {caps.canPlaceDevices && (
          <Button variant="primary" size="sm" onClick={() => setPlacing(true)} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>{m.asset.placeDevices}</Button>
        )}
      </div>
      <PlacedDeviceTable
        rows={rows}
        assetId={asset.assetId}
        deviceHref={hrefs.device}
        assetHref={hrefs.asset}
        onUnplace={caps.canPlaceDevices ? (id) => void unplace(id) : undefined}
        busyId={busyId}
        loading={loadedKey !== key}
        error={error}
        onRetry={() => void load()}
        now={now}
      />
      {pages > 1 && <div className="flex justify-center"><Pagination page={page} totalPages={pages} onPageChange={setPage} size="sm" /></div>}
      {placing && (
        <PlaceDevicesDialog open asset={{ assetId: asset.assetId, name: asset.name }} placedIds={here} onClose={() => setPlacing(false)} onPlaced={onChanged} />
      )}
    </div>
  );
}

function ChildrenList({ rows, known, count, hrefs, onOpenAsset }: {
  rows: AssetNode[]; known: boolean; count: number; hrefs: AssetDetailViewProps['hrefs'] & object; onOpenAsset?: (id: string) => void;
}) {
  const { m } = useIotText();
  if (!rows.length) return <p className="py-4 text-sm text-text-secondary">{known || count === 0 ? m.asset.noChildren : fill(m.asset.childCount, { n: count })}</p>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={m.asset.children}>
      {rows.map((c) => {
        const body = (
          <>
            <AssetKindBadge kind={c.kind} iconOnly className="text-base" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text-primary">{c.name}</span>
              <span className="block truncate text-xs text-text-secondary">{fill(m.asset.childCount, { n: c.childCount })} · {fill(m.assets.devicesBadge, { n: c.deviceCount })}</span>
            </span>
          </>
        );
        const cls = 'flex w-full items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2 text-left transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
        return (
          <li key={c.assetId}>
            {onOpenAsset
              ? <button type="button" className={cls} onClick={() => onOpenAsset(c.assetId)}>{body}</button>
              : hrefs.asset ? <a href={hrefs.asset(c.assetId)} className={cls}>{body}</a> : <span className={cls}>{body}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function RelationsTab({ assetId, hrefs }: { assetId: string; hrefs: AssetDetailViewProps['hrefs'] & object }) {
  const api = useIotAdapter().assets!;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [rows, setRows] = useState<AssetRelation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback((signal?: AbortSignal) => api.relations!({ type: 'ASSET', id: assetId }, signal).then(
    (r) => { if (!signal?.aborted) { setRows(r); setError(null); } },
    (e) => { if (!signal?.aborted) setError(errorMessage(e, m.asset.loadError)); },
  ), [api, assetId, m.asset.loadError]);
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);
  async function removeRelation(id: string) {
    try {
      await api.removeRelation!(id);
      notify({ tone: 'success', message: m.asset.relationRemoved });
      void load();
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.asset.failed) });
    }
  }
  return (
    <AssetRelationTable
      rows={rows ?? []}
      hrefs={hrefs}
      loading={rows === null && !error}
      error={error}
      onRetry={() => void load()}
      onRemove={caps.canPlaceDevices && api.removeRelation ? (id) => void removeRelation(id) : undefined}
    />
  );
}
