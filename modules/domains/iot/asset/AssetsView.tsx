'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsis, faMapLocationDot, faPlus, faSitemap } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { DropdownMenu, type DropdownItem } from '@/modules/ui/DropdownMenu';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableFilterValues, DataTableQuery } from '@/modules/ui/Table/types';
import { EmptyState } from '@/modules/ui/EmptyState';
import { PageHeader } from '@/modules/ui/PageHeader';
import { ASSET_SORT_KEYS, errorMessage, type AssetListQuery } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotText } from '../api/IotAdapterProvider';
import { LIST_PAGE_SIZES, sameSort, toIotSort, toTableSort } from '../api/list-table';
import { ALARM_SEVERITY_META } from '../alarm/alarm-severity';
import { fill } from '../format';
import { assetKindChoices, type AssetRow, type AssetSummary } from '../types/asset';
import { AssetDrawer } from './AssetDrawer';
import { AssetFormDrawer } from './AssetFormDrawer';
import { AssetKindBadge } from './AssetKindBadge';
import { AssetsMapDrawer } from './AssetsMapDrawer';
import { assetKindLabel } from './asset-kind';

/**
 * AssetsView — the "Sites & assets" page (owner 2026-10-27, option B, like the device list; it replaces phase 08's tree and detail
 * pane): a KPI row (sites, assets, devices, active alarms), then one DataTable of every site and asset with the host's search (name,
 * code or place), the Filters panel (site, kind, only with active alarms), sortable columns (asset, kind, place, child assets,
 * devices, alarms), rows per page and server paging. A row opens the asset in `AssetDrawer` (a right-side drawer); the header's "Map"
 * opens `AssetsMapDrawer`, "⋯" the host's `moreActions`, "New site" the form for a top-level node.
 *
 * The open asset (`query.asset`) and the open map (`query.map`) belong to the host's URL like the filters: `onQueryChange` says
 * `push` when a drawer opens (Back closes it) and `replace` for everything else. The view follows `initialQuery` when the host's URL
 * changes for another reason than its own report (Back, Forward, a pasted link, a link to the same page): the drawers, and the
 * filters, sort, search and page too. After a write in a drawer the table and the KPI row are read again.
 *
 * Without alarm counts from the host (`alarms` false) the alarm KPI, column, filter and sort are left out. On a phone the header's
 * and the drawers' controls are at least 40 px tall.
 */
export type AssetsViewProps = {
  initialQuery?: Partial<AssetListQuery>;
  onQueryChange?: (query: AssetListQuery, how?: 'push' | 'replace') => void;
  hrefs?: {
    asset?: (assetId: string) => string;
    device?: (deviceId: string) => string;
    alarms?: (siteId: string) => string;
    /** An asset's board ("Open dashboard" in its drawer, for an asset that has one). */
    dashboard?: (dashboardId: string) => string;
  };
  /** The header's "⋯" menu (e.g. links to related lists). */
  moreActions?: readonly DropdownItem[];
  /** The host's buttons in an asset drawer's header (e.g. another module's button that opens a drawer of its own), by asset id. */
  drawerActions?: (assetId: string) => React.ReactNode;
  pageSize?: number;
  now?: number;
  className?: string;
};

export function AssetsView({ initialQuery, onQueryChange, hrefs = {}, moreActions = [], drawerActions, pageSize = 20, now, className }: AssetsViewProps) {
  const api = useIotAdapter().assets;
  const caps = useIotCapabilities();
  const { m } = useIotText();

  const [query, setQuery] = useState<AssetListQuery>(() => tableQueryOf(initialQuery, pageSize));
  // the drawers: which asset is open and whether the map is, followed from the URL too
  const urlAsset = initialQuery?.asset ?? null;
  const urlMap = !!initialQuery?.map;
  const urlTable = tableKey(initialQuery, pageSize);
  const [openId, setOpenId] = useState<string | null>(urlAsset);
  const [mapOpen, setMapOpen] = useState(urlMap);
  const [urlSeen, setUrlSeen] = useState({ asset: urlAsset, map: urlMap, table: urlTable });
  // the table queries this view reported that the host's URL has not caught up with yet (its own, never followed back)
  const [reported, setReported] = useState<string[]>([urlTable]);
  if (urlAsset !== urlSeen.asset || urlMap !== urlSeen.map || urlTable !== urlSeen.table) {
    setUrlSeen({ asset: urlAsset, map: urlMap, table: urlTable });
    setOpenId(urlAsset);
    setMapOpen(urlMap);
    if (urlTable !== urlSeen.table) {
      const own = reported.indexOf(urlTable);
      if (own >= 0) {
        setReported(reported.slice(own));
      } else {
        // the host navigated (Back, a link to this page): its filters, sort, search and page, not the ones the view last had
        setReported([urlTable]);
        if (urlTable !== tableKey(query, pageSize)) setQuery(tableQueryOf(initialQuery, pageSize));
      }
    }
  }
  const [items, setItems] = useState<AssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [alarms, setAlarms] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const queryRef = useRef(query);
  // before the table's own effects: a query the URL reset must be the one the table's report is compared with
  useLayoutEffect(() => { queryRef.current = query; }, [query]);
  const drawers = useRef({ asset: openId, map: mapOpen });
  useEffect(() => { drawers.current = { asset: openId, map: mapOpen }; }, [openId, mapOpen]);

  const load = useCallback((q: AssetListQuery, signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return api.list(q, signal).then(
      (page) => { if (!signal?.aborted) { setItems(page.items); setTotal(page.total); setAlarms(page.alarms); setError(null); setLoadedKey(JSON.stringify(q)); } },
      (e) => { if (!signal?.aborted) { setError(errorMessage(e, m.assets.loadError)); setLoadedKey(JSON.stringify(q)); } },
    );
  }, [api, m.assets.loadError]);

  const loadSummary = useCallback((signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return api.summary(signal).then(
      (s) => { if (!signal?.aborted) { setSummary(s); setSummaryError(null); } },
      (e) => { if (!signal?.aborted) setSummaryError(errorMessage(e, m.assets.loadError)); },
    );
  }, [api, m.assets.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(query, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load, query]);
  useEffect(() => {
    const ctrl = new AbortController();
    loadSummary(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [loadSummary]);

  /** The table and the KPI row again (after a write in a drawer or a new site). */
  const reread = useCallback(() => { void load(queryRef.current); void loadSummary(); }, [load, loadSummary]);

  function report(q: AssetListQuery, d: { asset: string | null; map: boolean }, how: 'push' | 'replace') {
    const key = tableKey(q, pageSize);
    setReported((r) => (r[r.length - 1] === key ? r : [...r, key].slice(-20)));
    onQueryChange?.({ ...q, ...(d.asset ? { asset: d.asset } : {}), ...(d.map ? { map: true } : {}) }, how);
  }
  function change(patch: Partial<AssetListQuery>) {
    const next = { ...queryRef.current, ...patch, page: patch.page ?? 1 };
    // at once, not in the effect: the table reports page 1 for a new filter before that effect runs, and must see this query
    queryRef.current = next;
    setQuery(next);
    report(next, drawers.current, 'replace');
  }
  function openAsset(id: string | null, how: 'push' | 'replace') {
    drawers.current = { ...drawers.current, asset: id };
    setOpenId(id);
    report(queryRef.current, drawers.current, how);
  }
  function showMap(on: boolean, how: 'push' | 'replace') {
    drawers.current = { ...drawers.current, map: on };
    setMapOpen(on);
    report(queryRef.current, drawers.current, how);
  }
  /** The table's page, rows per page, sort or search changed (it reports its query on mount too: nothing then). */
  function tableQuery(t: DataTableQuery) {
    const cur = queryRef.current;
    const sort = toIotSort(t.sort, ASSET_SORT_KEYS);
    const search = t.search || undefined;
    if (t.page === cur.page && t.pageSize === cur.pageSize && search === (cur.search || undefined) && sameSort(sort, cur.sort)) return;
    change({ page: t.page, pageSize: t.pageSize, search, sort });
  }
  function filtersChanged(v: DataTableFilterValues) {
    change({
      site: typeof v.site === 'string' && v.site ? v.site : undefined,
      kind: typeof v.kind === 'string' && v.kind ? v.kind : undefined,
      alarmed: v.alarmed === true ? true : undefined,
    });
  }

  const filterFields = useMemo((): DataTableFilterField<AssetRow>[] => [
    { id: 'site', label: m.assets.filterSite, type: 'select', options: (summary?.siteList ?? []).map((s) => ({ value: s.assetId, label: s.name })) },
    // the suggested kinds, then the tenant's own (kind is free text, NB A-4) and the one in the URL
    { id: 'kind', label: m.assets.filterKind, type: 'select', options: assetKindChoices(summary?.kinds, query.kind).map((k) => ({ value: k, label: assetKindLabel(k, m) })) },
    ...(alarms ? [{ id: 'alarmed', label: m.assets.filterAlarmed, type: 'checkbox' as const }] : []),
  ], [summary, alarms, m, query.kind]);
  const filterValues = useMemo((): DataTableFilterValues => ({
    ...(query.site ? { site: query.site } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.alarmed ? { alarmed: true } : {}),
  }), [query.site, query.kind, query.alarmed]);

  const place = (r: AssetRow) => (r.location.length ? r.location.map((l) => l.name).join(' › ') : '—');
  const columns: Column<AssetRow>[] = [
    {
      key: 'name',
      header: m.assets.columnAsset,
      sortable: true,
      hideable: false,
      render: (r) => (
        <span className="flex min-w-0 items-start gap-2">
          <AssetKindBadge kind={r.kind} iconOnly className="mt-0.5 text-base sm:hidden" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-text-primary">{r.name}</span>
            {r.location.length > 0 && <span className="truncate text-xs text-text-secondary md:hidden">{place(r)}</span>}
          </span>
        </span>
      ),
    },
    { key: 'kind', header: m.assets.columnKind, sortable: true, hideBelow: 'sm', render: (r) => <AssetKindBadge kind={r.kind} /> },
    { key: 'location', header: m.assets.columnPlace, sortable: true, hideBelow: 'md', render: (r) => <span className="text-text-secondary">{place(r)}</span> },
    { key: 'children', header: m.assets.columnChildren, sortable: true, align: 'right', hideBelow: 'lg', render: (r) => String(r.childCount) },
    // on a phone the asset and its alarms fit; the devices are in its drawer
    { key: 'devices', header: m.assets.columnDevices, sortable: true, align: 'right', hideBelow: alarms ? 'sm' : undefined, render: (r) => String(r.deviceCount) },
    ...(alarms ? [{
      key: 'alarms',
      header: m.assets.columnAlarms,
      sortable: true,
      render: (r: AssetRow) => <AlarmCell row={r} />,
    }] : []),
  ];

  if (!api) return null;

  const canCreate = caps.canManageAssets;
  const filtered = !!(query.search || query.site || query.kind || query.alarmed);
  const empty = summary !== null && summary.assets === 0 && !filtered;

  return (
    <div className={cn('space-y-4', className)}>
      {/* the actions wrap under the title on a phone, the "⋯" menu with them */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
        <PageHeader className="min-w-0 pb-0" title={m.assets.title} subtitle={m.assets.subtitle} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" className={TOUCH} onClick={() => showMap(true, 'push')} iconLeft={<FontAwesomeIcon icon={faMapLocationDot} className="h-3.5 w-3.5" aria-hidden="true" />}>
            {m.assets.map}
          </Button>
          {moreActions.length > 0 && (
            <DropdownMenu
              align="right"
              items={[...moreActions]}
              trigger={(
                <Button variant="ghost" iconOnly className={TOUCH} aria-label={m.assets.moreActions} title={m.assets.moreActions}>
                  <FontAwesomeIcon icon={faEllipsis} className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            />
          )}
          {canCreate && (
            <Button className={TOUCH} onClick={() => setCreating(true)} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
              {m.assets.newSite}
            </Button>
          )}
        </div>
      </div>

      <Kpis summary={summary} />
      {summary?.alarmsTruncated && (
        <p role="status" className="rounded-lg border border-warning bg-warning-subtle px-3 py-2 text-xs text-text-primary" data-testid="assets-alarms-partial">
          {m.assets.alarmsPartial}
        </p>
      )}

      {empty ? (
        <EmptyState
          icon={<FontAwesomeIcon icon={faSitemap} aria-hidden="true" />}
          title={m.assets.empty}
          description={m.assets.emptyHint}
          action={canCreate ? <Button onClick={() => setCreating(true)}>{m.assets.newSite}</Button> : undefined}
        />
      ) : (
        <DataTable<AssetRow>
          mode="manual"
          caption={m.assets.title}
          columns={columns}
          columnChooser
          tableId="iot.assets"
          rows={items}
          total={total}
          query={{ page: query.page, pageSize: query.pageSize, sort: toTableSort(query.sort), search: query.search ?? '' }}
          onQueryChange={tableQuery}
          multiSort={false}
          searchPlaceholder={m.assets.searchTable}
          filterFields={filterFields}
          filterValues={filterValues}
          onFilterValuesChange={filtersChanged}
          pageSizeOptions={LIST_PAGE_SIZES}
          rowId={(r) => r.assetId}
          onRowClick={(r) => openAsset(r.assetId, drawers.current.asset ? 'replace' : 'push')}
          rowClassName={(r) => (r.assetId === openId ? 'bg-surface-overlay' : undefined)}
          loading={loadedKey !== JSON.stringify(query)}
          error={error || undefined}
          onRetry={() => void load(queryRef.current)}
          emptyMessage={m.assets.noRows}
          messages={{ loading: m.common.loading, retry: m.common.retry }}
          keyboardNavigation
        />
      )}

      {openId && (
        <AssetDrawer
          assetId={openId}
          onClose={() => openAsset(null, 'replace')}
          hrefs={hrefs}
          onChanged={reread}
          onDeleted={(parentId) => openAsset(parentId, 'replace')}
          onOpenAsset={(id) => openAsset(id, 'replace')}
          actions={drawerActions?.(openId)}
          now={now}
        />
      )}

      {mapOpen && (
        <AssetsMapDrawer
          onClose={() => showMap(false, 'replace')}
          summary={summary}
          error={summaryError}
          onRetry={() => void loadSummary()}
          onListAssets={(siteId) => { drawers.current = { ...drawers.current, map: false }; setMapOpen(false); change({ site: siteId }); }}
          onOpenSite={(siteId) => { drawers.current = { asset: siteId, map: false }; setMapOpen(false); setOpenId(siteId); report(queryRef.current, drawers.current, 'replace'); }}
          alarmsHref={hrefs.alarms}
        />
      )}

      {creating && (
        <AssetFormDrawer open onClose={() => setCreating(false)} onSaved={(id) => { reread(); openAsset(id, 'push'); }} />
      )}
    </div>
  );
}

/** On a phone a control is at least 40 px each way (a touch target); from `sm` the control's own size. */
const TOUCH = 'max-sm:min-h-10 max-sm:min-w-10';

/** The table's part of a host query (the drawers are the view's own state), with the defaults filled in. Pure. */
function tableQueryOf(q: Partial<AssetListQuery> | undefined, pageSize: number): AssetListQuery {
  const rest: Partial<AssetListQuery> = { ...q };
  delete rest.asset;
  delete rest.map;
  return { ...rest, page: rest.page ?? 1, pageSize: rest.pageSize ?? pageSize };
}

/** The table's part of a query as one comparable string (page, rows per page, sort, search, kind, site, alarmed). Pure. */
function tableKey(q: Partial<AssetListQuery> | undefined, pageSize: number): string {
  return JSON.stringify([
    q?.page ?? 1, q?.pageSize ?? pageSize, q?.sort ? `${q.sort.key}:${q.sort.dir}` : '', q?.search || '', q?.kind ?? '', q?.site ?? '',
    !!q?.alarmed, q?.parentId ?? '',
  ]);
}

/** The alarm column: "n active" in the worst severity's tone, or "No issues". */
function AlarmCell({ row }: { row: AssetRow }) {
  const { m } = useIotText();
  if (row.alarmCount === null) return null;
  if (!row.alarmCount || !row.worstSeverity) {
    return <span className="inline-flex rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-fg">{m.assets.noIssues}</span>;
  }
  const meta = ALARM_SEVERITY_META[row.worstSeverity];
  return (
    <span data-severity={row.worstSeverity} title={m.severity[row.worstSeverity]} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', meta.badgeClass)}>
      <FontAwesomeIcon icon={meta.icon} className="h-3 w-3" aria-hidden="true" />
      {fill(m.assets.alarmsActive, { n: row.alarmCount })}
    </span>
  );
}

/** The KPI row: sites (with a location), assets, devices (placed), and the tenant's active alarms (critical, unacknowledged) when the host shows them. */
function Kpis({ summary }: { summary: AssetSummary | null }) {
  const { m, locale } = useIotText();
  const cards: Array<{ id: string; label: string; value: number | null; hint: string; tone?: 'error' }> = [
    { id: 'sites', label: m.assets.kpiSites, value: summary?.sites ?? null, hint: fill(m.assets.kpiSitesHint, { n: summary?.sitesLocated ?? 0 }) },
    { id: 'assets', label: m.assets.kpiAssets, value: summary?.assets ?? null, hint: m.assets.kpiAssetsHint },
    { id: 'devices', label: m.assets.kpiDevices, value: summary?.devices ?? null, hint: fill(m.assets.kpiDevicesHint, { n: summary?.placedDevices ?? 0 }) },
    ...(summary === null || summary.alarms ? [{
      id: 'alarms', label: m.assets.kpiAlarms, value: summary?.activeAlarms ?? null,
      hint: fill(m.assets.kpiAlarmsHint, { critical: summary?.criticalAlarms ?? 0, unacknowledged: summary?.unacknowledgedAlarms ?? 0 }),
      tone: (summary?.activeAlarms ?? 0) > 0 ? 'error' as const : undefined,
    }] : []),
  ];
  return (
    <dl aria-label={m.assets.summary} className={cn('grid grid-cols-2 gap-3', cards.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')} data-testid="assets-kpis">
      {cards.map((c) => (
        <div key={c.id} className="min-w-0 rounded-xl border border-border bg-surface-raised px-4 py-3" data-kpi={c.id}>
          <dt className="truncate text-xs text-text-secondary">{c.label}</dt>
          <dd className={cn('mt-1 text-2xl font-bold leading-tight', c.tone === 'error' ? 'text-error' : 'text-text-primary')}>
            {c.value === null ? <span className="text-text-disabled">—</span> : c.value.toLocaleString(locale)}
          </dd>
          {summary && <dd className="truncate text-xs text-text-secondary">{c.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
