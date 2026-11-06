'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsUpDownLeftRight, faChartLine, faEllipsis, faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { DropdownMenu } from '@/modules/ui/DropdownMenu';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { errorMessage, IotApiError } from '../api/adapter';
import { ASSET_SORT_KEYS, type AssetSortKey, type IotListSort, type PlacedDeviceQuery } from '../api/adapter';
import { LIST_PAGE_SIZES, toIotSort } from '../api/list-table';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime, plural } from '../format';
import { assetKindChoices, type AssetNode, type AssetRecord, type AssetRelation, type AssetRow, type PlacedDevice } from '../types/asset';
import { AssetBreadcrumb } from './AssetBreadcrumb';
import { AssetFormDrawer } from './AssetFormDrawer';
import { AssetKindBadge } from './AssetKindBadge';
import { assetKindLabel } from './asset-kind';
import { AssetRelationTable, RELATION_SORT_KEYS, relationWords, type RelationSortKey } from './AssetRelationTable';
import { MoveAssetDialog } from './MoveAssetDialog';
import { PlaceDevicesDialog } from './PlaceDevicesDialog';
import { PLACED_DEVICE_SORT_KEYS, PlacedDeviceTable } from './PlacedDeviceTable';

/**
 * AssetDrawer — one site or asset in a right-side drawer over the Sites & assets table (owner 2026-10-27, option B; it replaces the
 * tabbed detail pane of phase 08 §8.2): everything that pane had, as sections one under the other, no tabs. The header holds the name
 * and the actions as the approved mockup has them: add a child, edit, "Move to…", "Open dashboard" (an asset with a board, when the
 * host gives `hrefs.dashboard`) and "⋯" with delete (refused by the host while children remain or another module points at it, and
 * the refusal's reason is shown); on a phone the action labels fold to their icons, each a 40 px touch target. The body: the path
 * (each step opens that asset here), the code and counts, Overview (description, kind, time zone (inherited when empty), location,
 * counts, created), Attributes, Devices (placed here or below, "Place devices", remove a placement), Child assets (paged, each opens
 * here) and Relations.
 *
 * Every action says what it acts on (NB 41-ui-fixes/25): Delete is not offered while child assets remain (the reason is shown) and its
 * confirm names the placements and relations it ends; removing a placement or a relation asks first and names it; an edit is saved
 * against what was read (a stale one keeps the edits and offers a reload). The Devices section is only for a viewer who may read
 * devices. After a write the sections read again in place (their page and filters kept) and an answer that arrives after a newer read
 * is dropped. An asset that no longer exists says so and offers to close. Capabilities that could not be read are said, with a retry.
 *
 * `onChanged` asks the host to read its table again after a write; `onDeleted` hands it the deleted asset's parent; `onNavigate` opens
 * the links (the path without `onOpenAsset`, the devices, the relations' ends) through the host's router.
 */
export type AssetDrawerProps = {
  assetId: string;
  open?: boolean;
  onClose: () => void;
  hrefs?: { asset?: (assetId: string) => string; device?: (deviceId: string) => string; dashboard?: (dashboardId: string) => string };
  onChanged?: () => void;
  onDeleted?: (parentId: string | null) => void;
  /** Open another asset in the drawer (a path step, a child). Without it the `hrefs.asset` links are used. */
  onOpenAsset?: (assetId: string) => void;
  /** The host's own buttons in the header, after "Open dashboard" (e.g. another module's button that opens a drawer of its own). Shown once the asset has loaded. */
  actions?: React.ReactNode;
  /** Open a link in the app (the host's router); without it the links are plain. */
  onNavigate?: (href: string) => void;
  pageSize?: number;
  now?: number;
};

export function AssetDrawer({
  assetId, open = true, onClose, hrefs = {}, onChanged, onDeleted, onOpenAsset, actions, onNavigate, pageSize = 10, now,
}: AssetDrawerProps) {
  const api = useIotAdapter().assets;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale } = useIotText();
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [error, setError] = useState<{ id: string; message: string; gone: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [moving, setMoving] = useState<{ nodes: AssetNode[]; truncated: boolean } | null>(null);
  const [version, setVersion] = useState(0);
  // the edit drawer is mounted afresh only on an explicit reload (its Reload after a stale refusal), never by a re-read under it
  const [formNonce, setFormNonce] = useState(0);
  // a re-read after a write is in flight: Edit waits for it, so the drawer never opens on the updatedAt from before the save
  const [rereading, setRereading] = useState(false);
  // the newest read wins: a save on A, then B opened, never shows A's late answer
  const seq = useRef(0);

  const load = useCallback((signal?: AbortSignal) => {
    if (!api) return Promise.resolve();
    const mine = ++seq.current;
    return api.get(assetId, signal).then(
      (a) => { if (!signal?.aborted && mine === seq.current) { setAsset(a); setError(null); setRereading(false); } },
      (e) => {
        if (signal?.aborted || mine !== seq.current) return;
        setRereading(false);
        const gone = e instanceof IotApiError && e.code === 'not_found';
        setError({ id: assetId, gone, message: gone ? m.asset.notFound : errorMessage(e, m.asset.loadError) });
      },
    );
  }, [api, assetId, m.asset.loadError, m.asset.notFound]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  const changed = useCallback(() => {
    setVersion((v) => v + 1);
    setRereading(true);
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
      const code = e instanceof IotApiError ? e.code : 'unknown';
      if (code === 'not_found') {
        // someone else deleted it: it is gone, not refused
        notify({ tone: 'info', message: m.asset.deleteGone });
        onChanged?.();
        onDeleted?.(a.parentId);
      } else if (code === 'conflict' || code === 'validation' || code === 'forbidden' || code === 'stale') {
        notify({ tone: 'error', message: fill(m.asset.deleteBlocked, { reason: errorMessage(e, m.asset.failed) }) });
      } else {
        notify({ tone: 'error', message: errorMessage(e, m.asset.deleteFailed) || m.asset.deleteFailed });
      }
    }
  }

  function confirmRemove(a: AssetRecord) {
    const what = a.relationCount === undefined ? m.asset.deleteHint
      : a.deviceCount + a.relationCount === 0 ? m.asset.deleteNothing
        : fill(m.asset.deleteEnds, {
          devices: plural(a.deviceCount, { one: m.asset.deviceEnds_one, other: m.asset.deviceEnds }, locale),
          relations: plural(a.relationCount, { one: m.asset.relationEnds_one, other: m.asset.relationEnds }, locale),
        });
    void confirmDialog({ title: fill(m.asset.deleteConfirm, { name: a.name }), message: what, tone: 'danger', confirmLabel: m.asset.delete, cancelLabel: m.common.cancel })
      .then((ok) => { if (ok) void remove(a); });
  }

  /** "Move to…" offers the tree, read when the dialog opens (the table holds pages, not the tree); a cut tree is searched on the host. */
  async function startMove() {
    if (!api) return;
    try {
      const t = await api.tree();
      setMoving({ nodes: t.nodes, truncated: t.truncated });
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.asset.moveFailed) });
    }
  }

  if (!api) return null;
  const a = asset && asset.assetId === assetId ? asset : null;
  const name = a?.name ?? '';
  const open_ = (id: string) => (onOpenAsset ? onOpenAsset(id) : undefined);
  const actionLabel = 'hidden sm:inline';
  const dashboardHref = a?.defaultDashboardId && hrefs.dashboard ? hrefs.dashboard(a.defaultDashboardId) : null;
  const manage = !!a && caps.canManageAssets;

  const header = (
    <div className="flex min-w-0 items-center gap-2" data-testid="asset-drawer-header">
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary" title={name}>{name}</h2>
      {a && <AssetKindBadge kind={a.kind} className="hidden shrink-0 sm:inline-flex" />}
      {a && (manage || dashboardHref || actions) && (
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={m.asset.actions}>
          {manage && (
            <>
              <Button variant="outline" size="sm" className={TOUCH} onClick={() => setAddingChild(true)} aria-label={m.asset.addChild} title={m.asset.addChild}
                iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
                <span className={actionLabel}>{m.asset.addChild}</span>
              </Button>
              <Button variant="ghost" size="sm" className={TOUCH} disabled={rereading} onClick={() => setEditing(true)} aria-label={m.asset.edit} title={m.asset.edit}
                iconLeft={<FontAwesomeIcon icon={faPen} className="h-3 w-3" aria-hidden="true" />}>
                <span className={actionLabel}>{m.asset.edit}</span>
              </Button>
              <Button variant="ghost" size="sm" className={TOUCH} onClick={() => void startMove()} aria-label={m.asset.move} title={m.asset.move}
                iconLeft={<FontAwesomeIcon icon={faArrowsUpDownLeftRight} className="h-3 w-3" aria-hidden="true" />}>
                <span className={actionLabel}>{m.asset.move}</span>
              </Button>
            </>
          )}
          {dashboardHref && (
            <Button as="a" href={dashboardHref} variant="ghost" size="sm" className={TOUCH} aria-label={m.asset.openDashboard} title={m.asset.openDashboard}
              iconLeft={<FontAwesomeIcon icon={faChartLine} className="h-3 w-3" aria-hidden="true" />}>
              <span className={actionLabel}>{m.asset.openDashboard}</span>
            </Button>
          )}
          {actions}
          {manage && <DropdownMenu
            align="right"
            items={[
              {
                // not offered while child assets remain: the reason is under the counts
                id: 'delete', label: m.asset.delete, danger: true, disabled: a.childCount > 0, icon: <FontAwesomeIcon icon={faTrash} aria-hidden="true" />,
                onClick: () => confirmRemove(a),
              },
            ]}
            trigger={(
              <Button variant="ghost" size="sm" iconOnly className={TOUCH} aria-label={m.assets.moreActions} title={m.assets.moreActions}>
                <FontAwesomeIcon icon={faEllipsis} className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          />}
        </div>
      )}
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} title={fill(m.asset.drawerTitle, { name: name || assetId })} closeLabel={m.common.close} className="w-[40rem]" header={header}>
      {caps.failed && (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning bg-warning-subtle px-3 py-2 text-sm text-warning-fg">
          <span className="min-w-0 flex-1">{m.common.capabilitiesError}</span>
          <Button variant="outline" size="xs" onClick={caps.retry}>{m.common.retry}</Button>
        </div>
      )}
      {error && error.id === assetId && !a ? (
        <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center text-sm text-error">
          {error.message}
          {error.gone
            ? <Button variant="outline" size="sm" onClick={onClose}>{m.common.close}</Button>
            : <Button variant="outline" size="sm" onClick={() => void load()}>{m.common.retry}</Button>}
        </div>
      ) : !a ? (
        <SkeletonText lines={6} label={m.common.loading} />
      ) : (
        <div className="min-w-0 space-y-5" data-asset-id={a.assetId}>
          <div className="space-y-1">
            {onOpenAsset ? (
              <PathButtons path={a.ancestors} onOpen={open_} label={m.asset.breadcrumb} />
            ) : (
              <AssetBreadcrumb path={[...a.ancestors, { assetId: a.assetId, code: a.code, name: a.name, kind: a.kind }]} href={hrefs.asset} onNavigate={onNavigate} currentLast />
            )}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
              <span>{m.asset.code}: <code className="font-mono text-text-primary">{a.code}</code></span>
              <span>{plural(a.childCount, { one: m.asset.childCount_one, other: m.asset.childCount }, locale)}</span>
              <span>{plural(a.deviceCount, { one: m.asset.devicesHere_one, other: m.asset.devicesHere }, locale)}</span>
            </p>
            {manage && a.childCount > 0 && (
              <p className="text-xs text-text-secondary">{plural(a.childCount, { one: m.asset.deleteHasChildren_one, other: m.asset.deleteHasChildren }, locale)}</p>
            )}
          </div>
          <Overview asset={a} />
          {/* device rows are device data: only for a viewer who may read devices (NB 41-ui-fixes/25 1.1) */}
          {caps.canReadDevices && (
            <Section title={m.asset.devices}>
              <DevicesSection key={a.assetId} asset={a} hrefs={hrefs} reloadKey={version} pageSize={pageSize} now={now} onChanged={changed} onNavigate={onNavigate} />
            </Section>
          )}
          <Section title={fill(m.asset.childrenSection, { n: a.childCount })}>
            <ChildrenSection key={a.assetId} asset={a} hrefs={hrefs} reloadKey={version} pageSize={pageSize} onOpenAsset={onOpenAsset} onNavigate={onNavigate} />
          </Section>
          {(api.relations || api.relationsPage) && (
            <Section title={m.asset.relations}>
              <RelationsSection key={a.assetId} assetId={a.assetId} hrefs={{ asset: hrefs.asset, device: caps.canReadDevices ? hrefs.device : undefined }}
                reloadKey={version} pageSize={pageSize} onChanged={changed} onNavigate={onNavigate} />
            </Section>
          )}
        </div>
      )}
      {a && editing && (
        <AssetFormDrawer key={formNonce} open asset={a} onClose={() => setEditing(false)} onSaved={changed}
          onReload={() => { void load().then(() => setFormNonce((n) => n + 1)); }} />
      )}
      {a && addingChild && <AssetFormDrawer open parent={{ assetId: a.assetId, name: a.name, kind: a.kind }} onClose={() => setAddingChild(false)} onSaved={changed} />}
      {a && moving && (
        <MoveAssetDialog open asset={{ assetId: a.assetId, name: a.name, parentId: a.parentId, childCount: a.childCount, deviceCount: a.deviceCount, timezone: a.timezone ?? null }}
          nodes={moving.nodes} truncated={moving.truncated} onClose={() => setMoving(null)} onMoved={changed} />
      )}
    </Drawer>
  );
}

/** On a phone a control is at least 40 px each way (a touch target); from `sm` the control's own size. */
const TOUCH = 'max-sm:min-h-10 max-sm:min-w-10';

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
          <button type="button" onClick={() => onOpen(p.assetId)} className={cn('truncate rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', TOUCH)}>
            {p.name}
          </button>
        </span>
      ))}
    </nav>
  );
}

function Overview({ asset }: { asset: AssetRecord }) {
  const { m, locale } = useIotText();
  // the zone is credited to the asset it comes from, when the host names it (never guessed as the parent)
  const inheritedFrom = !asset.timezone && asset.effectiveTimezone ? asset.timezoneFrom?.name ?? null : null;
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
        {/* the asset's own attributes, a full list in the browser: search, sort, rows per page and paging */}
        <DataTable<{ key: string; value: unknown; text: string }>
          mode="paginated"
          variant="plain"
          caption={m.asset.attributes}
          columns={[
            { key: 'key', header: m.attribute.key, sortable: true, render: (r) => <code className="font-mono text-xs text-text-secondary">{r.key}</code> },
            { key: 'text', header: m.attribute.value, sortable: true, render: (r) => <span className="break-words">{r.text}</span> },
          ]}
          rows={attrs.map(([key, value]) => ({ key, value, text: typeof value === 'string' ? value : JSON.stringify(value) }))}
          rowId={(r) => r.key}
          emptyMessage={m.asset.noAttributes}
          messages={{ loading: m.common.loading, retry: m.common.retry }}
          searchPlaceholder={m.attribute.search}
          pageSize={10}
          pageSizeOptions={LIST_PAGE_SIZES}
          density="compact"
        />
      </Section>
    </>
  );
}

function DevicesSection({ asset, hrefs, reloadKey, pageSize: firstPageSize, now, onChanged, onNavigate }: {
  asset: AssetRecord; hrefs: AssetDrawerProps['hrefs'] & object; reloadKey: number; pageSize: number; now?: number; onChanged: () => void;
  onNavigate?: (href: string) => void;
}) {
  const api = useIotAdapter().assets!;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  // the table's query: its page, search, sort and the connection / placed-below filters, served by the host page by page
  const [query, setQuery] = useState<PlacedDeviceQuery>({ page: 1, pageSize: firstPageSize, recursive: true });
  const [rows, setRows] = useState<PlacedDevice[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const key = `${JSON.stringify(query)}:${reloadKey}`;
  const seq = useRef(0);

  // a write elsewhere (reloadKey) reads the same page again: the page, search, sort and filters are kept
  const load = useCallback((signal?: AbortSignal) => {
    const mine = ++seq.current;
    const at = key;
    return api.devices(asset.assetId, query, signal).then(
      (p) => { if (!signal?.aborted && mine === seq.current) { setRows(p.items); setTotal(p.total); setError(null); setLoadedKey(at); } },
      (e) => { if (!signal?.aborted && mine === seq.current) { setError(errorMessage(e, m.asset.loadError)); setLoadedKey(at); } },
    );
  }, [api, asset.assetId, query, key, m.asset.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  async function unplace(deviceId: string, row: PlacedDevice) {
    const ok = await confirmDialog({
      title: fill(m.asset.unplaceConfirm, { device: row.device.name }),
      message: fill(m.asset.unplaceHint, { asset: row.placement.name }),
      tone: 'danger', confirmLabel: m.asset.unplace, cancelLabel: m.common.cancel,
    });
    if (!ok) return;
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
      {caps.canPlaceDevices && caps.canReadDevices && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="primary" size="sm" onClick={() => setPlacing(true)} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>{m.asset.placeDevices}</Button>
        </div>
      )}
      <PlacedDeviceTable
        rows={rows}
        assetId={asset.assetId}
        deviceHref={hrefs.device}
        assetHref={hrefs.asset}
        onNavigate={onNavigate}
        onUnplace={caps.canPlaceDevices ? (id, row) => void unplace(id, row) : undefined}
        busyId={busyId}
        total={total}
        defaultQuery={{ pageSize: firstPageSize }}
        onQueryChange={(q: DataTableQuery) => {
          const sort = toIotSort(q.sort, PLACED_DEVICE_SORT_KEYS);
          const next: PlacedDeviceQuery = {
            page: q.page, pageSize: q.pageSize, recursive: q.filterValues.recursive === true,
            ...(q.search.trim() ? { search: q.search.trim() } : {}),
            ...(sort ? { sort } : {}),
            ...(q.filterValues.online === 'true' || q.filterValues.online === 'false' ? { online: q.filterValues.online === 'true' } : {}),
          };
          setQuery((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        }}
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

/** The direct children, read through the table's list (`parentId`) a page at a time, with their own counts; each opens in the drawer. */
function ChildrenSection({ asset, hrefs, reloadKey, pageSize: firstPageSize, onOpenAsset, onNavigate }: {
  asset: AssetRecord; hrefs: AssetDrawerProps['hrefs'] & object; reloadKey: number; pageSize: number; onOpenAsset?: (id: string) => void;
  onNavigate?: (href: string) => void;
}) {
  const api = useIotAdapter().assets!;
  const { m } = useIotText();
  // the table's query (its search, sort, kind filter and page), served by the host's asset list under this asset
  const [query, setQuery] = useState<{ page: number; pageSize: number; search: string; sort?: IotListSort<AssetSortKey>; kind?: string }>({ page: 1, pageSize: firstPageSize, search: '' });
  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${JSON.stringify(query)}:${reloadKey}`;
  const seq = useRef(0);
  const load = useCallback((signal?: AbortSignal) => {
    const mine = ++seq.current;
    const at = key;
    return api.list({
      page: query.page, pageSize: query.pageSize, parentId: asset.assetId, sort: query.sort ?? { key: 'name', dir: 'asc' },
      search: query.search || undefined, kind: query.kind,
    }, signal).then(
      (p) => { if (!signal?.aborted && mine === seq.current) { setRows(p.items); setTotal(p.total); setError(null); setLoadedKey(at); } },
      (e) => { if (!signal?.aborted && mine === seq.current) { setError(errorMessage(e, m.asset.loadError)); setLoadedKey(at); } },
    );
  }, [api, asset.assetId, query, key, m.asset.loadError]);
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
      sortable: true,
      render: (c) => {
        const body = (
          <>
            <AssetKindBadge kind={c.kind} iconOnly className="text-base" />
            <span className="truncate">{c.name}</span>
          </>
        );
        return onOpenAsset
          ? <button type="button" className={link} onClick={() => onOpenAsset(c.assetId)}>{body}</button>
          : hrefs.asset ? (
            <a href={hrefs.asset(c.assetId)} className={link}
              onClick={onNavigate ? (e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onNavigate(hrefs.asset!(c.assetId)); } } : undefined}>
              {body}
            </a>
          ) : <span className={link}>{body}</span>;
      },
    },
    { key: 'childCount', sortKey: 'children', header: m.asset.children, align: 'right', sortable: true, hideBelow: 'sm', render: (c) => String(c.childCount) },
    { key: 'deviceCount', sortKey: 'devices', header: m.asset.devices, align: 'right', sortable: true, render: (c) => String(c.deviceCount) },
  ];
  const filterFields: DataTableFilterField<AssetRow>[] = [
    { id: 'kind', label: m.asset.kind, type: 'select', options: assetKindChoices([], query.kind).map((k) => ({ value: k, label: assetKindLabel(k, m) })) },
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
        loading={!!asset.childCount && loadedKey !== key}
        error={error || undefined}
        onRetry={() => void load()}
        emptyMessage={m.asset.noChildren}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        // every child is reachable: the host's pages, sort, search and kind filter through the table's own toolbar and pagination
        total={asset.childCount ? total : 0}
        defaultQuery={{ pageSize: firstPageSize }}
        onQueryChange={(q: DataTableQuery) => {
          const next = {
            page: q.page, pageSize: q.pageSize, search: q.search.trim(), sort: toIotSort(q.sort, ASSET_SORT_KEYS),
            kind: typeof q.filterValues.kind === 'string' && q.filterValues.kind ? q.filterValues.kind : undefined,
          };
          setQuery((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        }}
        multiSort={false}
        searchPlaceholder={m.asset.searchChildren}
        filterFields={filterFields}
        pageSize={firstPageSize}
        pageSizeOptions={LIST_PAGE_SIZES}
        density="compact"
      />
    </>
  );
}

function RelationsSection({ assetId, hrefs, reloadKey, pageSize, onChanged, onNavigate }: {
  assetId: string; hrefs: AssetDrawerProps['hrefs'] & object; reloadKey: number; pageSize: number; onChanged: () => void;
  onNavigate?: (href: string) => void;
}) {
  const api = useIotAdapter().assets!;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const paged = !!api.relationsPage;
  // the host's page with its search, sort and type filter (NB-only, 41-ui-fixes/25 1.15)
  const [paging, setPaging] = useState<{ page: number; pageSize: number; search?: string; sort?: IotListSort<RelationSortKey>; type?: string }>({ page: 1, pageSize });
  const [rows, setRows] = useState<AssetRelation[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const seq = useRef(0);
  // a host that pages relations is read a page at a time (none dropped unseen); a write elsewhere (reloadKey) reads the same page again
  const load = useCallback((signal?: AbortSignal) => {
    const mine = ++seq.current;
    const entity = { type: 'ASSET' as const, id: assetId };
    const read = api.relationsPage
      ? api.relationsPage(entity, paging, signal)
      : api.relations!(entity, signal).then((items) => ({ items, total: items.length }));
    return read.then(
      (r) => { if (!signal?.aborted && mine === seq.current) { setRows(r.items); setTotal(r.total); setError(null); } },
      (e) => { if (!signal?.aborted && mine === seq.current) setError(errorMessage(e, m.asset.loadError)); },
    );
  }, [api, assetId, paging, m.asset.loadError]);
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load, reloadKey]);
  async function removeRelation(id: string, r: AssetRelation) {
    const words = relationWords(r, m);
    const placement = r.type === 'CONTAINS' && r.toType === 'DEVICE';
    const ok = await confirmDialog({
      title: m.asset.removeRelationConfirm,
      message: fill(placement ? m.asset.removePlacementHint : m.asset.removeRelationHint, words),
      tone: 'danger', confirmLabel: m.asset.removeRelation, cancelLabel: m.common.cancel,
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.removeRelation!(id);
      notify({ tone: 'success', message: m.asset.relationRemoved });
      // the last row of a later page gone: step back a page instead of reading an empty one
      if (paged && (rows?.length ?? 0) <= 1 && paging.page > 1) setPaging((p) => ({ ...p, page: p.page - 1 }));
      // a placement's end changes the devices and the counts too: everything reads again
      onChanged();
    } catch (e) {
      if (e instanceof IotApiError && e.code === 'not_found') {
        notify({ tone: 'info', message: m.asset.relationGone });
        onChanged();
      } else {
        notify({ tone: 'error', message: errorMessage(e, m.asset.failed) });
      }
    } finally {
      setBusyId(null);
    }
  }
  return (
    <AssetRelationTable
      rows={rows ?? []}
      hrefs={hrefs}
      onNavigate={onNavigate}
      loading={rows === null && !error}
      error={error}
      onRetry={() => void load()}
      busyId={busyId}
      {...(paged ? {
        total,
        query: { page: paging.page, pageSize: paging.pageSize },
        onQueryChange: (q: DataTableQuery) => {
          const sort = toIotSort(q.sort, RELATION_SORT_KEYS);
          const type = typeof q.filterValues.type === 'string' && q.filterValues.type ? q.filterValues.type : undefined;
          const next = {
            page: q.page, pageSize: q.pageSize,
            ...(q.search.trim() ? { search: q.search.trim() } : {}),
            ...(sort ? { sort } : {}),
            ...(type ? { type } : {}),
          };
          setPaging((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        },
      } : {})}
      onRemove={caps.canPlaceDevices && api.removeRelation ? (id, r) => void removeRelation(id, r) : undefined}
    />
  );
}
