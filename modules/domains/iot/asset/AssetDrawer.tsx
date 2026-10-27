'use client';
import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsUpDownLeftRight, faEllipsis, faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { DropdownMenu } from '@/modules/ui/DropdownMenu';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { Toggle } from '@/modules/ui/Toggle';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime } from '../format';
import type { AssetNode, AssetRecord, AssetRelation, AssetRow, PlacedDevice } from '../types/asset';
import { AssetBreadcrumb } from './AssetBreadcrumb';
import { AssetFormDrawer } from './AssetFormDrawer';
import { AssetKindBadge } from './AssetKindBadge';
import { AssetRelationTable } from './AssetRelationTable';
import { MoveAssetDialog } from './MoveAssetDialog';
import { PlaceDevicesDialog } from './PlaceDevicesDialog';
import { PlacedDeviceTable } from './PlacedDeviceTable';

/**
 * AssetDrawer — one site or asset in a right-side drawer over the Sites & assets table (owner 2026-10-27, option B; it replaces the
 * tabbed detail pane of phase 08 §8.2): everything that pane had, as sections one under the other, no tabs. The header holds the name
 * and the actions (add a child, edit, "Move to…", delete: refused by the host while children remain or another module points at it,
 * and the refusal's reason is shown); on a phone the action labels fold to their icons. The body: the path (each step opens that asset
 * here), the code and counts, Overview (description, kind, time zone (inherited when empty), location, counts, created), Attributes,
 * Devices (placed here or below, "Place devices", remove a placement), Child assets (each opens here) and Relations.
 *
 * `onChanged` asks the host to read its table again after a write; `onDeleted` hands it the deleted asset's parent.
 */
export type AssetDrawerProps = {
  assetId: string;
  open?: boolean;
  onClose: () => void;
  hrefs?: { asset?: (assetId: string) => string; device?: (deviceId: string) => string };
  onChanged?: () => void;
  onDeleted?: (parentId: string | null) => void;
  /** Open another asset in the drawer (a path step, a child). Without it the `hrefs.asset` links are used. */
  onOpenAsset?: (assetId: string) => void;
  pageSize?: number;
  now?: number;
};

export function AssetDrawer({
  assetId, open = true, onClose, hrefs = {}, onChanged, onDeleted, onOpenAsset, pageSize = 10, now,
}: AssetDrawerProps) {
  const api = useIotAdapter().assets;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [moving, setMoving] = useState<AssetNode[] | null>(null);
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

  async function remove(a: AssetRecord) {
    if (!api) return;
    try {
      await api.remove(a.assetId);
      notify({ tone: 'success', message: m.asset.deleted });
      onChanged?.();
      onDeleted?.(a.parentId);
    } catch (e) {
      notify({ tone: 'error', message: fill(m.asset.deleteBlocked, { reason: errorMessage(e, m.asset.failed) }) });
    }
  }

  /** "Move to…" offers the tree, read when the dialog opens (the table holds pages, not the tree). */
  async function startMove() {
    if (!api) return;
    try {
      setMoving((await api.tree()).nodes);
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.asset.moveFailed) });
    }
  }

  if (!api) return null;
  const a = asset && asset.assetId === assetId ? asset : null;
  const name = a?.name ?? '';
  const open_ = (id: string) => (onOpenAsset ? onOpenAsset(id) : undefined);
  const actionLabel = 'hidden sm:inline';

  const header = (
    <div className="flex min-w-0 items-center gap-2" data-testid="asset-drawer-header">
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary" title={name}>{name}</h2>
      {a && <AssetKindBadge kind={a.kind} className="hidden shrink-0 sm:inline-flex" />}
      {a && caps.canManageAssets && (
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={m.asset.actions}>
          <Button variant="outline" size="sm" onClick={() => setAddingChild(true)} aria-label={m.asset.addChild} title={m.asset.addChild}
            iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
            <span className={actionLabel}>{m.asset.addChild}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={m.asset.edit} title={m.asset.edit}
            iconLeft={<FontAwesomeIcon icon={faPen} className="h-3 w-3" aria-hidden="true" />}>
            <span className={actionLabel}>{m.asset.edit}</span>
          </Button>
          <DropdownMenu
            align="right"
            items={[
              { id: 'move', label: m.asset.move, icon: <FontAwesomeIcon icon={faArrowsUpDownLeftRight} aria-hidden="true" />, onClick: () => void startMove() },
              {
                id: 'delete', label: m.asset.delete, danger: true, icon: <FontAwesomeIcon icon={faTrash} aria-hidden="true" />,
                onClick: () => {
                  void confirmDialog({ title: fill(m.asset.deleteConfirm, { name: a.name }), message: m.asset.deleteHint, tone: 'danger', confirmLabel: m.asset.delete, cancelLabel: m.common.cancel })
                    .then((ok) => { if (ok) void remove(a); });
                },
              },
            ]}
            trigger={(
              <Button variant="ghost" size="sm" iconOnly aria-label={m.assets.moreActions} title={m.assets.moreActions}>
                <FontAwesomeIcon icon={faEllipsis} className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          />
        </div>
      )}
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} title={fill(m.asset.drawerTitle, { name: name || assetId })} closeLabel={m.common.close} className="w-[40rem]" header={header}>
      {error && error.id === assetId && !a ? (
        <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center text-sm text-error">
          {error.message}
          <Button variant="outline" size="sm" onClick={() => void load()}>{m.common.retry}</Button>
        </div>
      ) : !a ? (
        <SkeletonText lines={6} />
      ) : (
        <div className="min-w-0 space-y-5" data-asset-id={a.assetId}>
          <div className="space-y-1">
            {onOpenAsset ? (
              <PathButtons path={a.ancestors} onOpen={open_} label={m.asset.breadcrumb} />
            ) : (
              <AssetBreadcrumb path={[...a.ancestors, { assetId: a.assetId, code: a.code, name: a.name, kind: a.kind }]} href={hrefs.asset} currentLast />
            )}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
              <span>{m.asset.code}: <code className="font-mono text-text-primary">{a.code}</code></span>
              <span>{fill(m.asset.childCount, { n: a.childCount })}</span>
              <span>{fill(m.assets.devicesBadge, { n: a.deviceCount })}</span>
            </p>
          </div>
          <Overview asset={a} />
          <Section title={m.asset.devices}>
            <DevicesSection key={`${a.assetId}:${version}`} asset={a} hrefs={hrefs} pageSize={pageSize} now={now} onChanged={changed} />
          </Section>
          <Section title={fill(m.asset.childrenSection, { n: a.childCount })}>
            <ChildrenSection key={`${a.assetId}:${version}`} asset={a} hrefs={hrefs} onOpenAsset={onOpenAsset} />
          </Section>
          {api.relations && (
            <Section title={m.asset.relations}>
              <RelationsSection key={`${a.assetId}:${version}`} assetId={a.assetId} hrefs={hrefs} />
            </Section>
          )}
        </div>
      )}
      {a && editing && <AssetFormDrawer open asset={a} onClose={() => setEditing(false)} onSaved={changed} />}
      {a && addingChild && <AssetFormDrawer open parent={{ assetId: a.assetId, name: a.name }} onClose={() => setAddingChild(false)} onSaved={changed} />}
      {a && moving && <MoveAssetDialog open asset={a} nodes={moving} onClose={() => setMoving(null)} onMoved={changed} />}
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

/** The ancestors as buttons that open each one in the drawer (root first). */
function PathButtons({ path, onOpen, label }: { path: AssetRecord['ancestors']; onOpen: (id: string) => void; label: string }) {
  if (!path.length) return null;
  return (
    <nav aria-label={label} className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-text-secondary">
      {path.map((p, i) => (
        <span key={p.assetId} className="inline-flex min-w-0 items-center gap-1">
          {i > 0 && <span aria-hidden="true">›</span>}
          <button type="button" onClick={() => onOpen(p.assetId)} className="truncate rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            {p.name}
          </button>
        </span>
      ))}
    </nav>
  );
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
    [m.asset.timezone, zone],
    [m.asset.coordinates, coords],
    [m.asset.created, formatDateTime(asset.createdAt, { locale })],
  ];
  const attrs = Object.entries(asset.attributes ?? {});
  return (
    <>
      <Section title={m.asset.overview}>
        {asset.description && <p className="text-sm text-text-primary">{asset.description}</p>}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border p-4 text-sm sm:grid-cols-2">
          {rows.map(([term, value]) => (
            <div key={term} className="min-w-0">
              <dt className="text-xs text-text-secondary">{term}</dt>
              <dd className="break-words text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title={m.asset.attributes}>
        <DataTable<{ key: string; value: unknown }>
          mode="manual"
          variant="plain"
          caption={m.asset.attributes}
          columns={[
            { key: 'key', header: m.attribute.key, render: (r) => <code className="font-mono text-xs text-text-secondary">{r.key}</code> },
            { key: 'value', header: m.attribute.value, render: (r) => <span className="break-words">{typeof r.value === 'string' ? r.value : JSON.stringify(r.value)}</span> },
          ]}
          rows={attrs.map(([key, value]) => ({ key, value }))}
          rowId={(r) => r.key}
          emptyMessage={m.asset.noAttributes}
          messages={{ loading: m.common.loading, retry: m.common.retry }}
          searchable={false}
          pageSizeOptions={[]}
          density="compact"
        />
      </Section>
    </>
  );
}

function DevicesSection({ asset, hrefs, pageSize: firstPageSize, now, onChanged }: {
  asset: AssetRecord; hrefs: AssetDrawerProps['hrefs'] & object; pageSize: number; now?: number; onChanged: () => void;
}) {
  const api = useIotAdapter().assets!;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [recursive, setRecursive] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(firstPageSize);
  const [rows, setRows] = useState<PlacedDevice[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const key = `${recursive}:${page}:${pageSize}`;

  const load = useCallback((signal?: AbortSignal) => api.devices(asset.assetId, { page, pageSize, recursive }, signal).then(
    (p) => { if (!signal?.aborted) { setRows(p.items); setTotal(p.total); setError(null); setLoadedKey(`${recursive}:${page}:${pageSize}`); } },
    (e) => { if (!signal?.aborted) { setError(errorMessage(e, m.asset.loadError)); setLoadedKey(`${recursive}:${page}:${pageSize}`); } },
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

  const here = new Set(rows.filter((r) => r.placement.assetId === asset.assetId).map((r) => r.device.deviceId));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        paging={{ page, pageSize, total, onChange: (p, size) => { setPage(size === pageSize ? p : 1); setPageSize(size); } }}
        loading={loadedKey !== key}
        error={error}
        onRetry={() => void load()}
        now={now}
      />
      {placing && (
        <PlaceDevicesDialog open asset={{ assetId: asset.assetId, name: asset.name }} placedIds={here} onClose={() => setPlacing(false)} onPlaced={onChanged} />
      )}
    </div>
  );
}

const CHILD_PAGE = 50;

/** The direct children, read through the table's list (`parentId`), with their own counts; each opens in the drawer. */
function ChildrenSection({ asset, hrefs, onOpenAsset }: { asset: AssetRecord; hrefs: AssetDrawerProps['hrefs'] & object; onOpenAsset?: (id: string) => void }) {
  const api = useIotAdapter().assets!;
  const { m } = useIotText();
  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback((signal?: AbortSignal) => api.list({ page: 1, pageSize: CHILD_PAGE, parentId: asset.assetId, sort: { key: 'name', dir: 'asc' } }, signal).then(
    (p) => { if (!signal?.aborted) { setRows(p.items); setTotal(p.total); setError(null); } },
    (e) => { if (!signal?.aborted) setError(errorMessage(e, m.asset.loadError)); },
  ), [api, asset.assetId, m.asset.loadError]);
  useEffect(() => {
    if (!asset.childCount) return;
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load, asset.childCount]);

  const link = 'inline-flex min-w-0 max-w-full items-center gap-2 rounded text-left font-medium text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
  const columns: Column<AssetRow>[] = [
    {
      key: 'name',
      header: m.asset.name,
      render: (c) => {
        const body = (
          <>
            <AssetKindBadge kind={c.kind} iconOnly className="text-base" />
            <span className="truncate">{c.name}</span>
          </>
        );
        return onOpenAsset
          ? <button type="button" className={link} onClick={() => onOpenAsset(c.assetId)}>{body}</button>
          : hrefs.asset ? <a href={hrefs.asset(c.assetId)} className={link}>{body}</a> : <span className={link}>{body}</span>;
      },
    },
    { key: 'childCount', header: m.asset.children, align: 'right', hideBelow: 'sm', render: (c) => String(c.childCount) },
    { key: 'deviceCount', header: m.asset.devices, align: 'right', render: (c) => String(c.deviceCount) },
  ];
  return (
    <>
      <DataTable<AssetRow>
        mode="manual"
        variant="plain"
        caption={m.asset.children}
        columns={columns}
        rows={asset.childCount ? rows ?? [] : []}
        rowId={(c) => c.assetId}
        loading={!!asset.childCount && rows === null && !error}
        error={error || undefined}
        onRetry={() => void load()}
        emptyMessage={m.asset.noChildren}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        searchable={false}
        pageSizeOptions={[]}
        density="compact"
      />
      {total > CHILD_PAGE && <p className="text-xs text-text-secondary">{fill(m.asset.childCount, { n: total })}</p>}
    </>
  );
}

function RelationsSection({ assetId, hrefs }: { assetId: string; hrefs: AssetDrawerProps['hrefs'] & object }) {
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
