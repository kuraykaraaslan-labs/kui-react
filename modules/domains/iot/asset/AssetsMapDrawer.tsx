'use client';
import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { MapCanvas } from '@/modules/ui/MapView/MapCanvas';
import type { MapMarker } from '@/modules/ui/MapView/types';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessages } from '../messages';
import { AlarmSeverityBadge } from '../alarm/AlarmSeverityBadge';
import { SEVERITY_ORDER } from '../alarm/alarm-severity';
import { fill } from '../format';
import { locatedSites, siteTone, type AssetSite, type AssetSummary } from '../types/asset';
import { AssetKindBadge } from './AssetKindBadge';

/**
 * AssetsMapDrawer — the Sites & assets page's "Map" (owner 2026-10-27, option B): a wide right-side drawer with the sites (top-level
 * nodes) beside the kit's map. Each located site is a marker coloured by its worst active alarm (red critical or major, amber minor
 * or warning, green none; neutral when the host shows no alarms); the list on the side has every site, most severe and most alarms
 * first, with its devices and active alarms. Choosing a site (in the list or on the map) opens its summary over the map: nodes,
 * devices, active alarms per severity, and "List assets" (the table filtered to the site), "Details" (the site's drawer) and, when the
 * host gives one, "Alarms". "Only with active alarms" narrows both; "Fit all" brings every drawn site back into view (after a zoom or
 * a pan), and sites that overlap at the current zoom are drawn as one cluster that zooms in on a click. On a phone the map sits above
 * the list and every control is a 40 px touch target.
 *
 * The summary is the page's (`AssetsView` reads it once for the KPI row); the drawer reads nothing itself.
 */
export type AssetsMapDrawerProps = {
  open?: boolean;
  onClose: () => void;
  summary: AssetSummary | null;
  error?: string | null;
  onRetry?: () => void;
  /** "List assets": the table filtered to the site. */
  onListAssets: (siteId: string) => void;
  /** "Details": the site's drawer. */
  onOpenSite: (siteId: string) => void;
  /** "Alarms": the host's alarm list for the site; absent: no button. */
  alarmsHref?: (siteId: string) => string;
};

/** A site's one-line counts: devices, and active alarms when the host shows them. Pure. */
export function siteLine(m: IotMessages, s: Pick<AssetSite, 'deviceCount' | 'alarmCount'>): string {
  return s.alarmCount === null
    ? fill(m.assets.mapSiteDevices, { n: s.deviceCount })
    : fill(m.assets.mapSiteLine, { devices: s.deviceCount, alarms: s.alarmCount });
}

/** On a phone a control is at least 40 px each way (a touch target); from `sm` the control's own size. */
const TOUCH = 'max-sm:min-h-10 max-sm:min-w-10';

const TONE_DOT: Record<ReturnType<typeof siteTone>, string> = {
  error: 'bg-error', warning: 'bg-warning', info: 'bg-info', success: 'bg-success', neutral: 'bg-text-disabled',
};

export function AssetsMapDrawer({ open = true, onClose, summary, error, onRetry, onListAssets, onOpenSite, alarmsHref }: AssetsMapDrawerProps) {
  const { m } = useIotText();
  const [onlyAlarmed, setOnlyAlarmed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // "Fit all": a new map, which fits itself to the markers when it mounts
  const [fitRound, setFitRound] = useState(0);
  const alarms = !!summary?.alarms;
  const sites = useMemo(
    () => (summary?.siteList ?? []).filter((s) => !onlyAlarmed || (s.alarmCount ?? 0) > 0),
    [summary, onlyAlarmed],
  );
  const markers = useMemo((): MapMarker[] => locatedSites(sites).map((s) => ({
    id: s.assetId,
    position: [s.lat, s.lng],
    variant: siteTone(s),
    label: s.name,
    tooltip: { title: s.name, description: siteLine(m, s) },
  })), [sites, m]);
  const selected = sites.find((s) => s.assetId === selectedId) ?? null;

  const header = (
    <div className="min-w-0">
      <h2 className="truncate text-base font-semibold text-text-primary">{m.assets.mapTitle}</h2>
      {summary && (
        <p className="truncate text-xs text-text-secondary">{fill(m.assets.mapSubtitle, { n: summary.sites, located: summary.sitesLocated })}</p>
      )}
    </div>
  );

  // The sites beside the map: the kit's table (never a hand-made list), one column, each site a button that opens its summary.
  // The table is fixed to the column's width, so a long site name is cut off with an ellipsis instead of scrolling the list sideways.
  const siteColumns = useMemo((): Column<AssetSite>[] => [{
    key: 'name',
    header: m.assets.mapSites,
    render: (s) => (
      <button
        type="button"
        aria-current={s.assetId === selectedId ? 'true' : undefined}
        onClick={() => setSelectedId(s.assetId)}
        className="flex w-full min-w-0 items-start gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus max-sm:min-h-10"
      >
        <span aria-hidden="true" className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[siteTone(s)])} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text-primary">{s.name}</span>
          <span className="block truncate text-xs text-text-secondary">
            {siteLine(m, s)}{typeof s.lat === 'number' && typeof s.lng === 'number' ? '' : ` · ${m.assets.mapNoLocation}`}
          </span>
        </span>
      </button>
    ),
  }], [m, selectedId]);

  return (
    <Drawer open={open} onClose={onClose} title={m.assets.mapTitle} closeLabel={m.common.close} className="w-[72rem]" header={header}>
      {error && !summary ? (
        <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center text-sm text-error">
          {error}
          {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{m.common.retry}</Button>}
        </div>
      ) : !summary ? (
        <SkeletonText lines={6} label={m.common.loading} />
      ) : (
        <div className="flex min-h-0 flex-col gap-3 lg:h-full">
          {(alarms || markers.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {alarms && (
                <button
                  type="button"
                  aria-pressed={onlyAlarmed}
                  onClick={() => setOnlyAlarmed((v) => !v)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    onlyAlarmed ? 'border-primary bg-primary-subtle text-primary' : 'border-border text-text-secondary hover:bg-surface-overlay',
                    TOUCH,
                  )}
                >
                  {m.assets.filterAlarmed}
                </button>
              )}
              {markers.length > 0 && (
                <Button variant="outline" size="sm" className={cn('ml-auto', TOUCH)} onClick={() => setFitRound((n) => n + 1)}
                  iconLeft={<FontAwesomeIcon icon={faExpand} className="h-3 w-3" aria-hidden="true" />}>
                  {m.assets.mapFitAll}
                </Button>
              )}
            </div>
          )}
          <div className="flex min-h-0 flex-col gap-3 lg:flex-1 lg:flex-row-reverse">
            <div className="relative h-72 shrink-0 overflow-hidden rounded-xl border border-border sm:h-96 lg:h-auto lg:min-h-0 lg:flex-1" data-testid="assets-map">
              {markers.length ? (
                <MapCanvas key={fitRound} markers={markers} onMarkerClick={setSelectedId} loadingLabel={m.common.loading} cluster />
              ) : (
                <p className="flex h-full items-center justify-center p-6 text-center text-sm text-text-secondary">{m.assets.mapNoSites}</p>
              )}
              {selected && (
                <SiteCard
                  site={selected}
                  line={siteLine(m, selected)}
                  onClose={() => setSelectedId(null)}
                  onListAssets={() => onListAssets(selected.assetId)}
                  onOpenSite={() => onOpenSite(selected.assetId)}
                  alarmsHref={alarmsHref && (selected.alarmCount ?? 0) > 0 ? alarmsHref(selected.assetId) : undefined}
                />
              )}
              {alarms && markers.length > 0 && (
                <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-raised/90 px-2.5 py-1.5 text-xs text-text-secondary shadow-sm" aria-label={m.assets.mapLegend}>
                  <Legend dot={TONE_DOT.error} label={m.assets.mapLegendCritical} />
                  <Legend dot={TONE_DOT.warning} label={m.assets.mapLegendMinor} />
                  <Legend dot={TONE_DOT.info} label={m.severity.INFO} />
                  <Legend dot={TONE_DOT.success} label={m.assets.mapLegendNone} />
                </div>
              )}
            </div>
            <div className="min-h-0 overflow-y-auto rounded-xl border border-border lg:w-72 lg:shrink-0" data-testid="assets-map-sites">
              <DataTable<AssetSite>
                mode="static"
                variant="plain"
                bordered={false}
                density="compact"
                tableClassName="table-fixed"
                caption={m.assets.mapSites}
                columns={siteColumns}
                rows={sites}
                rowId={(s) => s.assetId}
                rowClassName={(s) => (s.assetId === selectedId ? 'bg-surface-overlay' : undefined)}
                emptyMessage={m.assets.mapNoSites}
                messages={{ loading: m.common.loading, retry: m.common.retry }}
                searchable={false}
              />
              {summary.sitesTruncated && (
                <p className="border-t border-border px-3 py-2 text-xs text-text-secondary">{fill(m.assets.mapTruncated, { n: summary.siteList.length })}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', dot)} />
      {label}
    </span>
  );
}

function SiteCard({ site, line, onClose, onListAssets, onOpenSite, alarmsHref }: {
  site: AssetSite; line: string; onClose: () => void; onListAssets: () => void; onOpenSite: () => void; alarmsHref?: string;
}) {
  const { m } = useIotText();
  const severities = SEVERITY_ORDER.filter((s) => (site.alarmsBySeverity?.[s] ?? 0) > 0);
  return (
    <section
      aria-label={site.name}
      className="absolute inset-x-2 top-2 z-10 space-y-2 rounded-xl border border-border bg-surface-raised p-3 shadow-lg sm:left-auto sm:right-2 sm:w-80"
      data-testid="assets-map-site"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-text-primary">{site.name}</h3>
          <p className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <AssetKindBadge kind={site.kind} />
            <span>{fill(m.assets.mapSiteAssets, { n: site.assetCount, devices: site.deviceCount })}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={m.assets.closeSite} title={m.assets.closeSite}
          className={cn('inline-flex items-center justify-center rounded p-1 text-text-secondary hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', TOUCH)}>
          <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {site.alarmCount !== null && (
        severities.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={line}>
            {severities.map((s) => (
              <li key={s}><AlarmSeverityBadge severity={s} size="sm" /> <span className="text-xs text-text-primary">{site.alarmsBySeverity?.[s]}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-success-fg">{m.assets.noIssues}</p>
        )
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" className={TOUCH} onClick={onListAssets}>{m.assets.mapListAssets}</Button>
        <Button variant="outline" size="sm" className={TOUCH} onClick={onOpenSite}>{m.assets.mapDetails}</Button>
        {alarmsHref && <Button as="a" href={alarmsHref} variant="outline" size="sm" className={TOUCH}>{m.assets.mapAlarms}</Button>}
      </div>
    </section>
  );
}
