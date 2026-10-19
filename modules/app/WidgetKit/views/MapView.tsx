'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { MapCanvas, type MapImage, type MapMarker, type MapRoute, type MapTilesConfig, type MapZone } from '@/modules/ui/MapView';
import { hostImageSrc } from './content-logic';
import { cssColor, rangeFor, type ColorRange, type RangeEdges } from '../settings/style';
import type { Sparse } from '../settings/types';
import type { SlotData, WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import type { CommonMessages } from '../messages';
import { cellText, declaredColumns, expandLinkTemplate, matchValue, num, rawText, statusColor, type ValueColor } from './DataTableView';

type S = {
  latColumn?: string;
  lngColumn?: string;
  labelColumn?: string;
  idColumn?: string;
  tooltipColumns?: string[];
  markerStyle?: 'pin' | 'dot' | 'circle' | 'icon';
  markerIcon?: string;
  markerSize?: number;
  cluster?: boolean;
  clusterRadius?: number;
  colorBy?: 'fixed' | 'column' | 'ranges';
  markerColor?: string;
  colorColumn?: string;
  valueColors?: ValueColor[];
  valueColumn?: string;
  ranges?: unknown;
  rangeEdges?: RangeEdges;
  showLabels?: boolean;
  tooltipTrigger?: 'hover' | 'click' | 'none';
  fitBounds?: boolean;
  fitPadding?: number;
  centerLat?: number | null;
  centerLng?: number | null;
  zoom?: number;
  minZoom?: number | null;
  maxZoom?: number | null;
  scrollZoom?: boolean;
  zoomButtons?: boolean;
  layerToggles?: boolean;
  layerTogglesPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  controlsPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  tileStyle?: 'auto' | 'light' | 'grey' | 'dark' | 'streets';
  legend?: boolean;
  legendPosition?: 'bottomleft' | 'bottomright' | 'topleft' | 'topright';
  linkTemplate?: string;
  linkLabel?: string;
};

type Row = Record<string, unknown>;

/** At most this many markers: a runaway table must not create thousands of DOM markers. */
export const MAX_MARKERS = 500;
/** At most this many fields in a tooltip: a hover card is a glance, not a table. */
export const MAX_TOOLTIP_FIELDS = 6;
/** At most this many legend entries. */
export const MAX_LEGEND = 8;

// Keyless basemaps (CARTO's now need an API key): Esri's Canvas maps, with their place names as an
// overlay, and Esri's street map for a colourful look. A host's own server replaces "Follow the theme".
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const ESRI_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const esri = (service: string, labels?: string): { url: string; attribution: string; labels?: string } => ({
  url: `${ESRI}/${service}/MapServer/tile/{z}/{y}/{x}`,
  attribution: ESRI_ATTRIBUTION,
  ...(labels ? { labels: `${ESRI}/${labels}/MapServer/tile/{z}/{y}/{x}` } : {}),
});
const LIGHT = esri('Canvas/World_Light_Gray_Base', 'Canvas/World_Light_Gray_Reference');
const DARK = esri('Canvas/World_Dark_Gray_Base', 'Canvas/World_Dark_Gray_Reference');
export const TILE_PRESETS: Record<'auto' | 'light' | 'grey' | 'dark' | 'streets', MapTilesConfig> = {
  // Quiet basemaps, so status-coloured markers carry the colour; light or dark with the theme.
  auto: { light: LIGHT, dark: DARK },
  light: LIGHT,
  grey: esri('Canvas/World_Light_Gray_Base'),
  dark: DARK,
  streets: esri('World_Street_Map'),
};

const tooltipKeys = (s: S): string[] =>
  [...new Set((Array.isArray(s.tooltipColumns) ? s.tooltipColumns : []).filter((k) => typeof k === 'string' && k))].slice(0, MAX_TOOLTIP_FIELDS);

export interface BuiltMarkers {
  markers: MapMarker[];
  /** The row behind each marker id. */
  rows: Map<string, Row>;
}

/** A row's marker colour under the colour settings, or undefined (the fixed colour applies). */
function rowColor(row: Row, s: S): string | undefined {
  if ((s.colorBy ?? 'column') === 'column') {
    if (!s.colorColumn) return undefined;
    const raw = row[s.colorColumn];
    return cssColor(matchValue(raw, s.valueColors)?.color) ?? statusColor(raw);
  }
  if (s.colorBy === 'ranges' && s.valueColumn) return cssColor(rangeFor(row[s.valueColumn], s.ranges, s.rangeEdges ?? 'from')?.color);
  return undefined;
}

/**
 * Table rows → markers. Rows without finite, in-range coordinates are skipped, never plotted at
 * 0,0. A link is attached only when the template is an internal path (checked before expansion,
 * values URL-encoded). Capped at `MAX_MARKERS`. `texts` words the tooltip link (a placement's
 * `linkLabel` wins) and boolean values; English by default.
 */
export function buildMarkers(
  slot: SlotData | undefined, settings: Sparse, locale?: string, image: MapImage | null = null,
  texts: { open?: string } & Partial<CommonMessages> = {},
): BuiltMarkers {
  const yesNo = texts.yes || texts.no ? { yes: texts.yes ?? 'Yes', no: texts.no ?? 'No' } : undefined;
  const s = settings as S;
  const valid = onMap(image);
  const declared = declaredColumns(slot);
  const lat = s.latColumn || 'lat';
  const lng = s.lngColumn || 'lng';
  const fieldsOf = tooltipKeys(s);
  const fixed = cssColor(s.markerColor) ?? 'var(--primary)';
  const byColumn = (s.colorBy ?? 'column') === 'column' && !!s.colorColumn;
  const markers: MapMarker[] = [];
  const rows = new Map<string, Row>();
  (slot?.rows ?? []).forEach((row, i) => {
    if (markers.length >= MAX_MARKERS) return;
    const la = num(row[lat]);
    const ln = num(row[lng]);
    if (la === null || ln === null || !valid(la, ln)) return;
    const rawId = s.idColumn && row[s.idColumn] != null && row[s.idColumn] !== '' ? String(row[s.idColumn]) : String(i);
    const id = rows.has(rawId) ? `${rawId}#${i}` : rawId;
    rows.set(id, row);
    const label = s.labelColumn && row[s.labelColumn] != null && row[s.labelColumn] !== '' ? String(row[s.labelColumn]) : undefined;
    const own = rowColor(row, s);
    const color = own ?? fixed;
    // An empty value is left out of the tooltip, never shown as a dash row.
    const fields = fieldsOf.flatMap((key) => {
      const v = row[key];
      if (v === null || v === undefined || v === '') return [];
      const def = declared.find((c) => c.key === key);
      const mapped = key === s.colorColumn ? matchValue(v, s.valueColors)?.label : undefined;
      return [{ label: def?.label || key, value: mapped || cellText(v, def?.type, {}, {}, locale, undefined, yesNo) }];
    });
    // Coloured by a status column: the status names itself under the title (unless it is already a field).
    const statusRaw = byColumn && !fieldsOf.includes(s.colorColumn!) ? row[s.colorColumn!] : undefined;
    const status = statusRaw !== undefined && statusRaw !== null && statusRaw !== '' && !cssColor(statusRaw)
      ? matchValue(statusRaw, s.valueColors)?.label || String(statusRaw)
      : undefined;
    const href = expandLinkTemplate(s.linkTemplate, row) ?? undefined;
    const title = label ?? (s.idColumn ? rawId : `#${i + 1}`);
    markers.push({
      id,
      position: [la, ln],
      label,
      color,
      shape: s.markerStyle ?? 'pin',
      ...(s.markerStyle === 'icon' && s.markerIcon ? { icon: s.markerIcon } : {}),
      size: s.markerSize ?? 24,
      ...(fields.length > 0 || href || status || label
        ? {
          tooltip: {
            title,
            fields,
            ...(own ? { color: own } : {}),
            ...(status ? { description: status } : {}),
            ...(href ? { href, linkLabel: s.linkLabel || texts.open || 'Open' } : {}),
          },
        }
        : {}),
    });
  });
  return { markers, rows };
}

export interface LegendEntry { label: string; color: string; count?: number }

/**
 * What the colours mean: the value colours (or, without any, the values seen in the data) for a
 * colour column, the ranges for ranges. Nothing for one fixed colour.
 */
export function mapLegend(slot: SlotData | undefined, settings: Sparse): LegendEntry[] {
  const s = settings as S;
  const by = s.colorBy ?? 'column';
  if (by === 'ranges') {
    return (Array.isArray(s.ranges) ? (s.ranges as ColorRange[]) : []).flatMap((r) => {
      const color = cssColor(r?.color);
      if (!color) return [];
      const from = typeof r.from === 'number' ? r.from : undefined;
      const to = typeof r.to === 'number' ? r.to : undefined;
      const label = r.label?.trim() || (from !== undefined && to !== undefined ? `${from} – ${to}` : from !== undefined ? `≥ ${from}` : to !== undefined ? `< ${to}` : '');
      return label ? [{ label, color }] : [];
    }).slice(0, MAX_LEGEND);
  }
  if (by !== 'column' || !s.colorColumn) return [];
  const counts = new Map<string, LegendEntry>();
  for (const row of slot?.rows ?? []) {
    const raw = row[s.colorColumn];
    if (raw === null || raw === undefined || raw === '' || cssColor(raw)) continue;
    const mapped = matchValue(raw, s.valueColors);
    const color = cssColor(mapped?.color) ?? statusColor(raw);
    if (!color) continue;
    const label = mapped?.label || String(raw);
    const key = label.toLowerCase();
    const hit = counts.get(key);
    if (hit) hit.count = (hit.count ?? 0) + 1;
    else counts.set(key, { label, color, count: 1 });
  }
  // Configured values come first, in their order (and show even with no rows yet).
  const configured = (Array.isArray(s.valueColors) ? s.valueColors : []).flatMap((v) => {
    const color = cssColor(v?.color);
    if (!color || typeof v.value !== 'string' || !v.value.trim()) return [];
    const label = v.label?.trim() || v.value.trim();
    const seen = counts.get(label.toLowerCase());
    counts.delete(label.toLowerCase());
    return [{ label, color, count: seen?.count ?? 0 }];
  });
  return [...configured, ...counts.values()].slice(0, MAX_LEGEND);
}

const LEGEND_POS: Record<NonNullable<S['legendPosition']>, string> = {
  bottomleft: 'bottom-2 left-2',
  bottomright: 'bottom-6 right-2',
  topleft: 'top-2 left-2',
  topright: 'top-2 right-2',
};

export type MapWidgetViewProps = WidgetViewProps & {
  /** Run the placement's marker-click actions with the marker's row. */
  onMarkerClick?: (row: Row) => void;
  /** Navigate to a marker's (validated, internal) link on click; without it, the link is offered in the tooltip only. */
  onNavigate?: (href: string) => void;
  /** The platform's tile server, used by the "Follow the theme" style. */
  tiles?: MapTilesConfig;
  loadingLabel?: string;
  ariaLabel?: string;
  legendLabel?: string;
  /** The layer switch's texts (its group name and the three layers). */
  layerLabels?: { layers?: string; markers?: string; zones?: string; routes?: string };
};

/** The picture of an image map (internal path or https, rewritten by the host), or null for a geographic map. */
export function mapImage(settings: Sparse, resolveUrl?: (url: string) => string): MapImage | null {
  const s = settings as Record<string, unknown>;
  if (s.mapKind !== 'image') return null;
  const w = s.imageWidth; const h = s.imageHeight;
  if (typeof w !== 'number' || typeof h !== 'number' || !(w > 0) || !(h > 0)) return null;
  const url = hostImageSrc(s.imageSrc, resolveUrl);
  return url ? { url, width: w, height: h } : null;
}

/** Is a position on the map: within the picture on an image map, a valid latitude / longitude otherwise. */
const onMap = (image: MapImage | null) => (y: number, x: number) =>
  image ? y >= 0 && y <= image.height && x >= 0 && x <= image.width : Math.abs(y) <= 90 && Math.abs(x) <= 180;

const VARIANTS = new Set<MapZone['variant']>(['primary', 'info', 'success', 'warning', 'error', 'neutral']);

/** A list of [lat, lng] pairs from a cell: an array, or that array as JSON text; null when it is not one. */
export function readPositions(cell: unknown, valid: (y: number, x: number) => boolean = onMap(null)): [number, number][] | null {
  let v = cell;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  if (!Array.isArray(v)) return null;
  const out: [number, number][] = [];
  for (const p of v) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const lat = Number(p[0]); const lng = Number(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !valid(lat, lng)) return null;
    out.push([lat, lng]);
  }
  return out;
}

/** The zones a slot's rows describe (rows without three valid corners are skipped). */
export function buildZones(slot: SlotData | undefined, settings: Sparse, image: MapImage | null = null): MapZone[] {
  const s = settings as Record<string, unknown>;
  const col = (k: string, d: string) => (typeof s[k] === 'string' && s[k] ? (s[k] as string) : d);
  const fixed = VARIANTS.has(s.zoneVariant as MapZone['variant']) ? (s.zoneVariant as MapZone['variant']) : 'info';
  const opacity = typeof s.zoneOpacity === 'number' ? s.zoneOpacity : 0.2;
  const out: MapZone[] = [];
  (slot?.rows ?? []).forEach((row, n) => {
    const positions = readPositions(row[col('zonePositionsColumn', 'positions')], onMap(image));
    if (!positions || positions.length < 3) return;
    const label = row[col('zoneLabelColumn', 'name')];
    const v = typeof s.zoneVariantColumn === 'string' && s.zoneVariantColumn ? String(row[s.zoneVariantColumn] ?? '') : '';
    out.push({
      id: String(row.id ?? n), positions, fillOpacity: opacity,
      variant: VARIANTS.has(v as MapZone['variant']) ? (v as MapZone['variant']) : fixed,
      ...(label !== undefined && label !== null && label !== '' ? { label: String(label) } : {}),
    });
  });
  return out;
}

/** The routes a slot's rows describe (rows without two valid points are skipped). */
export function buildRoutes(slot: SlotData | undefined, settings: Sparse, image: MapImage | null = null): MapRoute[] {
  const s = settings as Record<string, unknown>;
  const col = (k: string, d: string) => (typeof s[k] === 'string' && s[k] ? (s[k] as string) : d);
  const color = cssColor(s.routeColor) ?? 'var(--primary)';
  const weight = typeof s.routeWeight === 'number' ? s.routeWeight : 3;
  const out: MapRoute[] = [];
  (slot?.rows ?? []).forEach((row, n) => {
    const positions = readPositions(row[col('routePositionsColumn', 'positions')], onMap(image));
    if (!positions || positions.length < 2) return;
    const label = row[col('routeLabelColumn', 'name')];
    out.push({
      id: String(row.id ?? n), positions, color, weight, dashed: s.routeDashed === true,
      ...(label !== undefined && label !== null && label !== '' ? { label: String(label) } : {}),
    });
  });
  return out;
}

/** `map`: bound rows as markers on a card-less map that fills the card, with an optional colour legend. */
export function MapWidgetView({
  settings, data, locale, renderLink, onMarkerClick, onNavigate, tiles, loadingLabel, ariaLabel, legendLabel, layerLabels, resolveUrl,
}: MapWidgetViewProps) {
  const s = settings as S;
  const image = useMemo(() => mapImage(settings, resolveUrl), [settings, resolveUrl]);
  const kit = useKitMessages();
  const m = kit.map;
  const { markers, rows } = useMemo(
    () => buildMarkers(data.points, settings, locale, image, { open: m.open, ...kit.common }),
    [data.points, settings, locale, image, m.open, kit.common],
  );
  const legend = useMemo(() => (s.legend === false ? [] : mapLegend(data.points, settings)), [data.points, settings, s.legend]);
  const zones = useMemo(() => buildZones(data.zones, settings, image), [data.zones, settings, image]);
  const routes = useMemo(() => buildRoutes(data.routes, settings, image), [data.routes, settings, image]);
  // The layer switch (20.3d): which layers are on. Hidden ones still frame the view, so switching never moves the map.
  const [shown, setShown] = useState({ markers: true, zones: true, routes: true });
  const layers = ([['markers', markers.length], ['zones', zones.length], ['routes', routes.length]] as const).filter(([, n]) => n > 0).map(([k]) => k);
  const showSwitch = s.layerToggles !== false && layers.length > 1;
  const layerText = { layers: m.layers, markers: m.markers, zones: m.zones, routes: m.routes, ...layerLabels };
  const fit = s.fitBounds !== false;
  const center: [number, number] | undefined = typeof s.centerLat === 'number' && typeof s.centerLng === 'number'
    ? [s.centerLat, s.centerLng] : undefined;
  const style = s.tileStyle ?? 'auto';
  const tileSet = style === 'auto' ? tiles ?? TILE_PRESETS.auto : TILE_PRESETS[style] ?? TILE_PRESETS.auto;
  const clickable = !!onMarkerClick || (!!onNavigate && !!s.linkTemplate);
  const controls = s.controlsPosition ?? 'topleft';
  // The legend never sits under the zoom buttons.
  const legendAt = s.legendPosition ?? 'bottomleft';
  const legendCorner = legendAt === controls && s.zoomButtons !== false
    ? (legendAt.startsWith('top') ? legendAt.replace('top', 'bottom') : legendAt.replace('bottom', 'top')) as typeof legendAt
    : legendAt;

  // The switch never sits under the zoom buttons or on the legend: it moves to the other top/bottom corner.
  const wantSwitch = (s.layerTogglesPosition ?? 'topright') as typeof legendAt;
  const taken = new Set<string>([...(s.zoomButtons !== false ? [controls] : []), ...(legend.length > 0 ? [legendCorner] : [])]);
  const flip = (c: string) => (c.startsWith('top') ? c.replace('top', 'bottom') : c.replace('bottom', 'top'));
  const switchCorner = (taken.has(wantSwitch) ? flip(wantSwitch) : wantSwitch) as typeof legendAt;

  const handleClick = (id: string) => {
    const row = rows.get(id);
    if (!row) return;
    onMarkerClick?.(row);
    const href = expandLinkTemplate(s.linkTemplate, row);
    if (href && onNavigate) onNavigate(href);
  };

  return (
    <div className="relative h-full min-h-40 w-full">
      <MapCanvas
        markers={markers}
        zones={zones}
        routes={routes}
        showMarkers={shown.markers}
        showZones={shown.zones}
        showRoutes={shown.routes}
        {...(image ? { image } : {})}
        tiles={tileSet}
        fitBounds={fit}
        fitBoundsPadding={typeof s.fitPadding === 'number' ? s.fitPadding : 32}
        {...(center ? { center } : {})}
        {...(typeof s.zoom === 'number' ? { zoom: s.zoom } : {})}
        {...(typeof s.minZoom === 'number' ? { minZoom: s.minZoom } : {})}
        {...(typeof s.maxZoom === 'number' ? { maxZoom: s.maxZoom, fitMaxZoom: Math.min(15, s.maxZoom) } : {})}
        cluster={!!s.cluster}
        clusterRadius={typeof s.clusterRadius === 'number' ? s.clusterRadius : 40}
        showLabels={!!s.showLabels}
        tooltipTrigger={s.tooltipTrigger ?? 'hover'}
        scrollWheelZoom={s.scrollZoom === true}
        zoomControl={s.zoomButtons !== false}
        controlsPosition={controls}
        renderLink={renderLink}
        onMarkerClick={clickable ? handleClick : undefined}
        loadingLabel={loadingLabel ?? m.loading}
        ariaLabel={ariaLabel ?? m.map}
      />
      {showSwitch && (
        <fieldset
          data-part="layers"
          className={cn(
            'absolute z-10 flex flex-col gap-1 rounded-lg border border-border bg-surface-raised/90 px-2.5 py-2 shadow-sm backdrop-blur-sm',
            LEGEND_POS[switchCorner] ?? LEGEND_POS.topright,
          )}
        >
          <legend className="sr-only">{layerText.layers}</legend>
          {layers.map((k) => (
            <label key={k} className="flex items-center gap-2 text-[11px] leading-4 text-text-primary">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-border focus-visible:ring-2 focus-visible:ring-border-focus"
                checked={shown[k]}
                onChange={(e) => setShown((v) => ({ ...v, [k]: e.target.checked }))}
              />
              {layerText[k]}
            </label>
          ))}
        </fieldset>
      )}
      {legend.length > 0 && (
        <ul
          aria-label={legendLabel ?? m.legend}
          data-part="legend"
          className={cn(
            'pointer-events-none absolute z-10 flex max-w-[60%] flex-col gap-1 rounded-lg border border-border bg-surface-raised/90 px-2.5 py-2 shadow-sm backdrop-blur-sm',
            LEGEND_POS[legendCorner] ?? LEGEND_POS.bottomleft,
          )}
        >
          {legend.map((e) => (
            <li key={e.label} className="flex items-center gap-2 text-[11px] leading-4 text-text-primary">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
              <span className="min-w-0 truncate">{e.label}</span>
              {e.count !== undefined && <span className="ml-auto pl-2 tabular-nums text-text-secondary">{e.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const MAP_VIEW: WidgetKindView = {
  View: MapWidgetView,
  // An image map shows its picture with nothing on it; a geographic one with nothing to plot is empty.
  isEmpty: (data, settings) => {
    const image = mapImage(settings);
    return !image && buildMarkers(data.points, settings).markers.length === 0
      && buildZones(data.zones, settings).length === 0 && buildRoutes(data.routes, settings).length === 0;
  },
  toCsv: (data, settings) => {
    const s = settings as S;
    const by = s.colorBy ?? 'column';
    const known = new Set(declaredColumns(data.points).map((c) => c.key));
    const keys = [
      s.latColumn || 'lat', s.lngColumn || 'lng', s.labelColumn, s.idColumn,
      by === 'column' ? s.colorColumn : by === 'ranges' ? s.valueColumn : undefined,
      ...tooltipKeys(s),
    ].filter((k, i, a): k is string => !!k && a.indexOf(k) === i && (i < 2 || known.has(k)));
    const label = (k: string) => declaredColumns(data.points).find((c) => c.key === k)?.label || k;
    const { rows } = buildMarkers(data.points, settings);
    return [keys.map(label), ...[...rows.values()].map((row) => keys.map((k) => rawText(row[k])))];
  },
  emptyShape: true,
};
