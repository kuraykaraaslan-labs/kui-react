// The pure logic of the map widget (no React): the markers, zones, routes and legend its rows describe, the basemap
// presets, and `mapModel`, which decides everything the view draws (the canvas props, the layer switch, the legend's
// corner and classes) as plain data. `MapView.tsx` draws it; kui-ejs and KUInative vendor this file.

import { cn } from '@/libs/utils/cn';
import type { MapImage, MapMarker, MapRoute, MapTilesConfig, MapZone } from '@/modules/ui/MapView';
import type { SlotData } from '../kind';
import type { CommonMessages, MapViewMessages } from '../messages';
import { valueMapList } from '../settings/source-meta';
import { cssColor, rangeFor, type ColorRange, type RangeEdges } from '../settings/style';
import type { Sparse } from '../settings/types';
import { hostImageSrc } from './content-logic';
import { cellText, declaredColumns, expandLinkTemplate, matchValue, num, rawText, statusColor, type ValueColor } from './table-logic';

export type MapSettings = {
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
  tileStyle?: 'auto' | 'light' | 'grey' | 'dark' | 'streets' | 'satellite';
  /** Image maps: the viewer may drag a marker to a new place; a drop is sent as a `set` request `{ id, x, y }`. */
  draggable?: boolean;
  /** Show replay controls for the routes. */
  replay?: boolean;
  replaySpeed?: number | string;
  legend?: boolean;
  legendPosition?: 'bottomleft' | 'bottomright' | 'topleft' | 'topright';
  linkTemplate?: string;
  linkLabel?: string;
};

type S = MapSettings;

type Row = Record<string, unknown>;

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** A marker picture address that is safe to write into marker HTML (the map draws the same check again). */
const SAFE_PICTURE = /^(?:\/(?![\/\\])|https:\/\/)[^\s"'<>\\\u0000-\u001f\u007f]{1,480}$/;
const safePicture = (src: string | null): string | undefined => (src && SAFE_PICTURE.test(src) ? src : undefined);

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
// Imagery from Esri's keyless World Imagery with place names over it; a host with its own imagery provider passes it in.
const SATELLITE = {
  url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
  attribution: 'Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics &mdash; &copy; OpenStreetMap contributors',
  labels: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
};
export const TILE_PRESETS: Record<'auto' | 'light' | 'grey' | 'dark' | 'streets' | 'satellite', MapTilesConfig> = {
  satellite: SATELLITE,
  // Quiet basemaps, so status-coloured markers carry the colour; light or dark with the theme.
  auto: { light: LIGHT, dark: DARK },
  light: LIGHT,
  grey: esri('Canvas/World_Light_Gray_Base'),
  dark: DARK,
  streets: esri('World_Street_Map'),
};

export const tooltipKeys = (s: S): string[] =>
  [...new Set((Array.isArray(s.tooltipColumns) ? s.tooltipColumns : []).filter((k) => typeof k === 'string' && k))].slice(0, MAX_TOOLTIP_FIELDS);

export interface BuiltMarkers {
  markers: MapMarker[];
  /** The row behind each marker id. */
  rows: Map<string, Row>;
}

/** The colour map in force: the placement's own, else what the source says about the colour column. */
export function effectiveValueColors(slot: SlotData | undefined, s: S): ValueColor[] | undefined {
  if (Array.isArray(s.valueColors) && s.valueColors.length > 0) return s.valueColors;
  if (!s.colorColumn) return undefined;
  const list = valueMapList(declaredColumns(slot).find((c) => c.key === s.colorColumn));
  return list.length ? list : undefined;
}

/** A row's marker colour under the colour settings, or undefined (the fixed colour applies). */
function rowColor(row: Row, s: S, valueColors: ValueColor[] | undefined): string | undefined {
  if ((s.colorBy ?? 'column') === 'column') {
    if (!s.colorColumn) return undefined;
    const raw = row[s.colorColumn];
    return cssColor(matchValue(raw, valueColors)?.color) ?? statusColor(raw);
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
  host: { resolveUrl?: (url: string) => string; movable?: boolean } = {},
): BuiltMarkers {
  const yesNo = texts.yes || texts.no ? { yes: texts.yes ?? 'Yes', no: texts.no ?? 'No' } : undefined;
  const s = settings as S;
  const valid = onMap(image);
  const declared = declaredColumns(slot);
  const lat = s.latColumn || 'lat';
  const lng = s.lngColumn || 'lng';
  const fieldsOf = tooltipKeys(s);
  const fixed = cssColor(s.markerColor) ?? 'var(--primary)';
  const valueColors = effectiveValueColors(slot, s);
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
    const own = rowColor(row, s, valueColors);
    const color = own ?? fixed;
    // A status can bring its own picture or glyph: the value's entry (the placement's, else the source's).
    const entry = byColumn ? matchValue(row[s.colorColumn!], valueColors) : undefined;
    const picture = entry?.image ? safePicture(hostImageSrc(entry.image, host.resolveUrl)) : undefined;
    const glyph = !picture && entry?.icon ? entry.icon : undefined;
    // An empty value is left out of the tooltip, never shown as a dash row.
    const fields = fieldsOf.flatMap((key) => {
      const v = row[key];
      if (v === null || v === undefined || v === '') return [];
      const def = declared.find((c) => c.key === key);
      const mapped = key === s.colorColumn ? matchValue(v, valueColors)?.label : undefined;
      return [{ label: def?.label || key, value: mapped || cellText(v, def?.type, {}, {}, locale, undefined, yesNo) }];
    });
    // Coloured by a status column: the status names itself under the title (unless it is already a field).
    const statusRaw = byColumn && !fieldsOf.includes(s.colorColumn!) ? row[s.colorColumn!] : undefined;
    const status = statusRaw !== undefined && statusRaw !== null && statusRaw !== '' && !cssColor(statusRaw)
      ? matchValue(statusRaw, valueColors)?.label || String(statusRaw)
      : undefined;
    const href = expandLinkTemplate(s.linkTemplate, row) ?? undefined;
    const title = label ?? (s.idColumn ? rawId : `#${i + 1}`);
    markers.push({
      id,
      position: [la, ln],
      label,
      color,
      shape: picture ? 'image' : glyph ? 'icon' : s.markerStyle ?? 'pin',
      ...(picture ? { image: picture } : glyph ? { icon: glyph } : s.markerStyle === 'icon' && s.markerIcon ? { icon: s.markerIcon } : {}),
      size: s.markerSize ?? 24,
      ...(s.draggable === true && image && host.movable ? { draggable: true } : {}),
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
  const valueColors = effectiveValueColors(slot, s);
  const counts = new Map<string, LegendEntry>();
  for (const row of slot?.rows ?? []) {
    const raw = row[s.colorColumn];
    if (raw === null || raw === undefined || raw === '' || cssColor(raw)) continue;
    const mapped = matchValue(raw, valueColors);
    const color = cssColor(mapped?.color) ?? statusColor(raw);
    if (!color) continue;
    const label = mapped?.label || String(raw);
    const key = label.toLowerCase();
    const hit = counts.get(key);
    if (hit) hit.count = (hit.count ?? 0) + 1;
    else counts.set(key, { label, color, count: 1 });
  }
  // Configured values come first, in their order (and show even with no rows yet).
  const configured = (valueColors ?? []).flatMap((v) => {
    const color = cssColor(v?.color);
    if (!color || typeof v.value !== 'string' || !v.value.trim()) return [];
    const label = v.label?.trim() || v.value.trim();
    const seen = counts.get(label.toLowerCase());
    counts.delete(label.toLowerCase());
    return [{ label, color, count: seen?.count ?? 0 }];
  });
  return [...configured, ...counts.values()].slice(0, MAX_LEGEND);
}

/** The corner classes of the legend and the layer switch. */
export const LEGEND_POS: Record<NonNullable<S['legendPosition']>, string> = {
  bottomleft: 'bottom-2 left-2',
  bottomright: 'bottom-6 right-2',
  topleft: 'top-2 left-2',
  topright: 'top-2 right-2',
};


/** The picture of an image map (internal path or https, rewritten by the host), or null for a geographic map. */
export function mapImage(settings: Sparse, resolveUrl?: (url: string) => string, fromSource?: unknown): MapImage | null {
  const s = settings as Record<string, unknown>;
  if (s.mapKind !== 'image') return null;
  const w = s.imageWidth; const h = s.imageHeight;
  if (typeof w !== 'number' || typeof h !== 'number' || !(w > 0) || !(h > 0)) return null;
  // A bound address (an attribute that holds the picture) wins over the typed one.
  const bound = typeof fromSource === 'string' && fromSource.trim() ? fromSource : undefined;
  const url = hostImageSrc(bound ?? s.imageSrc, resolveUrl);
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

type Corner = NonNullable<S['legendPosition']>;

const flip = (c: string) => (c.startsWith('top') ? c.replace('top', 'bottom') : c.replace('bottom', 'top'));

/** The classes of the layer switch's frame and of the legend's frame, by corner (`LEGEND_POS` adds the position). */
export const MAP_SWITCH_CLASS = 'absolute z-10 flex flex-col gap-1 rounded-lg border border-border bg-surface-raised/90 px-2.5 py-2 shadow-sm backdrop-blur-sm';
export const MAP_LEGEND_CLASS = 'pointer-events-none absolute z-10 flex max-w-[60%] flex-col gap-1 rounded-lg border border-border bg-surface-raised/90 px-2.5 py-2 shadow-sm backdrop-blur-sm';
export const MAP_LAYER_LABEL_CLASS = 'flex items-center gap-2 text-[11px] leading-4 text-text-primary';
export const MAP_LAYER_BOX_CLASS = 'h-3 w-3 rounded border-border focus-visible:ring-2 focus-visible:ring-border-focus';
export const MAP_LEGEND_ITEM_CLASS = 'flex items-center gap-2 text-[11px] leading-4 text-text-primary';

/** What the platform tells the model: host texts, the tile server, and which click handlers exist. */
export interface MapModelInput {
  messages: { map: MapViewMessages; common: CommonMessages };
  resolveUrl?: (url: string) => string;
  /** The platform's tile server, used by the "Follow the theme" style. */
  tiles?: MapTilesConfig;
  loadingLabel?: string;
  ariaLabel?: string;
  legendLabel?: string;
  /** The layer switch's texts (its group name and the three layers). */
  layerLabels?: { layers?: string; markers?: string; zones?: string; routes?: string };
  /** The host handles marker clicks (`onMarkerClick`) / navigates a marker's link (`onNavigate`). */
  hasMarkerClick?: boolean;
  hasNavigate?: boolean;
  /** The platform's own imagery provider, used by the "Satellite" style. */
  imagery?: MapTilesConfig;
  /** The host can write a dropped marker back (a command is bound and allowed). */
  movable?: boolean;
}

/**
 * Everything the map widget draws, decided once: the layers, the props of the map canvas (`canvas`, with the markers,
 * zones and routes in it as data), the layer switch and the legend with their corners and classes. The row behind
 * each marker is `rows[marker.id]`. The layer toggles are viewer state: the view / host keeps which layers are on.
 */
export function mapModel(settings: Sparse, data: Record<string, SlotData | undefined>, locale: string | undefined, i: MapModelInput) {
  const s = settings as S;
  const m = i.messages.map;
  const image = mapImage(settings, i.resolveUrl, data.image?.value);
  const { markers, rows } = buildMarkers(data.points, settings, locale, image, { open: m.open, ...i.messages.common }, { resolveUrl: i.resolveUrl, movable: i.movable });
  const legend = s.legend === false ? [] : mapLegend(data.points, settings);
  const zones = buildZones(data.zones, settings, image);
  const routes = buildRoutes(data.routes, settings, image);
  const layers = ([['markers', markers.length], ['zones', zones.length], ['routes', routes.length]] as const).filter(([, n]) => n > 0).map(([k]) => k);
  const showSwitch = s.layerToggles !== false && layers.length > 1;
  const layerText = { layers: m.layers, markers: m.markers, zones: m.zones, routes: m.routes, ...i.layerLabels };
  const center: [number, number] | undefined = typeof s.centerLat === 'number' && typeof s.centerLng === 'number' ? [s.centerLat, s.centerLng] : undefined;
  const style = s.tileStyle ?? 'auto';
  const tiles = style === 'auto' ? i.tiles ?? TILE_PRESETS.auto : style === 'satellite' ? i.imagery ?? TILE_PRESETS.satellite : TILE_PRESETS[style] ?? TILE_PRESETS.auto;
  const controls = s.controlsPosition ?? 'topleft';
  const zoomButtons = s.zoomButtons !== false;
  // The legend never sits under the zoom buttons.
  const legendAt: Corner = s.legendPosition ?? 'bottomleft';
  const legendCorner = (legendAt === controls && zoomButtons ? flip(legendAt) : legendAt) as Corner;
  // The switch never sits under the zoom buttons or on the legend: it moves to the other top/bottom corner.
  const wantSwitch = (s.layerTogglesPosition ?? 'topright') as Corner;
  const taken = new Set<string>([...(zoomButtons ? [controls] : []), ...(legend.length > 0 ? [legendCorner] : [])]);
  const switchCorner = (taken.has(wantSwitch) ? flip(wantSwitch) : wantSwitch) as Corner;
  return {
    image,
    markers,
    /** The row behind each marker, by marker id. */
    rows: Object.fromEntries(rows) as Record<string, Row>,
    zones,
    routes,
    legend,
    layers,
    showSwitch,
    layerText,
    clickable: !!i.hasMarkerClick || (!!i.hasNavigate && !!s.linkTemplate),
    /** A drop on an image map is written back (draggable markers and a host that can write). */
    movable: s.draggable === true && !!image && !!i.movable,
    replay: replayModel(data.routes, settings, image),
    switchCorner,
    legendCorner,
    switchClass: cn(MAP_SWITCH_CLASS, LEGEND_POS[switchCorner] ?? LEGEND_POS.topright),
    legendClass: cn(MAP_LEGEND_CLASS, LEGEND_POS[legendCorner] ?? LEGEND_POS.bottomleft),
    legendLabel: i.legendLabel ?? m.legend,
    canvas: {
      ...(image ? { image } : {}),
      tiles,
      fitBounds: s.fitBounds !== false,
      fitBoundsPadding: typeof s.fitPadding === 'number' ? s.fitPadding : 32,
      ...(center ? { center } : {}),
      ...(typeof s.zoom === 'number' ? { zoom: s.zoom } : {}),
      ...(typeof s.minZoom === 'number' ? { minZoom: s.minZoom } : {}),
      ...(typeof s.maxZoom === 'number' ? { maxZoom: s.maxZoom, fitMaxZoom: Math.min(15, s.maxZoom) } : {}),
      cluster: !!s.cluster,
      clusterRadius: typeof s.clusterRadius === 'number' ? s.clusterRadius : 40,
      showLabels: !!s.showLabels,
      tooltipTrigger: s.tooltipTrigger ?? 'hover',
      scrollWheelZoom: s.scrollZoom === true,
      zoomControl: zoomButtons,
      controlsPosition: controls,
      loadingLabel: i.loadingLabel ?? m.loading,
      ariaLabel: i.ariaLabel ?? m.map,
    },
  };
}


// ─── Route replay ────────────────────────────────────────────────────────────

/** A route that can be replayed: its points, optional times, and the distance walked up to each point. */
export interface ReplayRoute {
  id: string;
  label?: string;
  color: string;
  positions: [number, number][];
  /** One time (epoch ms) per point, or null when the route has none (it then replays at an even pace). */
  times: number[] | null;
  /** The distance from the start to each point, and the whole length. */
  cumulative: number[];
  total: number;
}

export const REPLAY_SPEEDS: readonly number[] = [1, 2, 5, 10];
/** A replay at 1x takes this long, whatever the route's length. */
export const REPLAY_SECONDS = 30;

const toMs = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v < 1e11 ? v * 1000 : v;
  if (typeof v === 'string' && v.trim() !== '') { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
};

/** The third element of every point as a time, or null unless every point has one and they never go back. */
export function readTimes(cell: unknown): number[] | null {
  let v = cell;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  if (!Array.isArray(v) || v.length < 2) return null;
  const out: number[] = [];
  for (const p of v) {
    const t = Array.isArray(p) ? toMs(p[2]) : null;
    if (t === null || (out.length && t < out[out.length - 1])) return null;
    out.push(t);
  }
  return out;
}

/** The distance between two positions: degrees with the longitude scaled by latitude, or pixels on an image map. */
const gap = (a: [number, number], b: [number, number], flat: boolean) => {
  const k = flat ? 1 : Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  return Math.hypot(b[0] - a[0], (b[1] - a[1]) * k);
};

/** The routes the settings and rows describe, ready to replay (rows without two valid points are skipped). */
export function replayRoutes(slot: SlotData | undefined, settings: Sparse, image: MapImage | null = null): ReplayRoute[] {
  const s = settings as Record<string, unknown>;
  const col = (k: string, d: string) => (typeof s[k] === 'string' && s[k] ? (s[k] as string) : d);
  const color = cssColor(s.routeColor) ?? 'var(--primary)';
  const out: ReplayRoute[] = [];
  (slot?.rows ?? []).forEach((row, n) => {
    const raw = row[col('routePositionsColumn', 'positions')];
    const positions = readPositions(raw, onMap(image));
    if (!positions || positions.length < 2) return;
    const cumulative = [0];
    for (let i = 1; i < positions.length; i += 1) cumulative.push(cumulative[i - 1] + gap(positions[i - 1], positions[i], !!image));
    const label = row[col('routeLabelColumn', 'name')];
    out.push({
      id: String(row.id ?? n), color, positions, times: readTimes(raw), cumulative, total: cumulative[cumulative.length - 1],
      ...(label !== undefined && label !== null && label !== '' ? { label: String(label) } : {}),
    });
  });
  return out;
}

/** Where a route is at `progress` (0 to 1): by time when the points carry times, else by distance walked. */
export function replayAt(route: ReplayRoute, progress: number): { position: [number, number]; time: number | null; index: number } {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const last = route.positions.length - 1;
  const t = route.times;
  const along = t ? t[0] + p * (t[last] - t[0]) : p * route.total;
  const marks = t ?? route.cumulative;
  let i = 0;
  while (i < last - 1 && marks[i + 1] < along) i += 1;
  const span = marks[i + 1] - marks[i];
  const f = span > 0 ? Math.min(1, Math.max(0, (along - marks[i]) / span)) : 0;
  const a = route.positions[i]; const b = route.positions[i + 1];
  return {
    position: [r2(a[0] + (b[0] - a[0]) * f), r2(a[1] + (b[1] - a[1]) * f)],
    time: t ? Math.round(along) : null,
    index: i,
  };
}

/** The markers a replay adds: the start, the end and the moving point (not clickable rows). */
export function replayMarkers(routes: ReplayRoute[], progress: number, texts: { start: string; end: string }, time?: (ms: number) => string): MapMarker[] {
  return routes.flatMap((r) => {
    const at = replayAt(r, progress);
    const name = r.label ?? '';
    return [
      { id: `replay:${r.id}:start`, position: r.positions[0], shape: 'dot' as const, color: 'var(--success)', size: 12, tooltip: { title: name ? `${name} · ${texts.start}` : texts.start } },
      { id: `replay:${r.id}:end`, position: r.positions[r.positions.length - 1], shape: 'dot' as const, color: 'var(--error)', size: 12, tooltip: { title: name ? `${name} · ${texts.end}` : texts.end } },
      { id: `replay:${r.id}:now`, position: at.position, shape: 'circle' as const, color: r.color, size: 22, ...(at.time !== null && time ? { tooltip: { title: time(at.time) } } : {}) },
    ];
  });
}

/** What the replay controls need: the routes, whether they are on, the speed and its choices. */
export function replayModel(slot: SlotData | undefined, settings: Sparse, image: MapImage | null) {
  const s = settings as S;
  const routes = s.replay === true ? replayRoutes(slot, settings, image) : [];
  const speed = Number(s.replaySpeed);
  return {
    enabled: routes.length > 0,
    routes,
    speeds: REPLAY_SPEEDS,
    speed: REPLAY_SPEEDS.includes(speed) ? speed : 1,
    seconds: REPLAY_SECONDS,
    /** The earliest and latest time of the routes, or null when any route has none. */
    timeSpan: routes.length > 0 && routes.every((r) => r.times) ? { from: Math.min(...routes.map((r) => (r.times as number[])[0])), to: Math.max(...routes.map((r) => (r.times as number[])[r.times!.length - 1])) } : null,
  };
}

/** Has the map nothing to show? An image map shows its picture with nothing on it; a geographic one with nothing to plot is empty. */
export function mapIsEmpty(data: Record<string, SlotData | undefined>, settings: Sparse): boolean {
  const image = mapImage(settings, undefined, data.image?.value);
  return !image && buildMarkers(data.points, settings).markers.length === 0
    && buildZones(data.zones, settings).length === 0 && buildRoutes(data.routes, settings).length === 0;
}

/** The CSV of a map: the marker rows with the columns the settings use (header = the column labels). */
export function mapCsv(data: Record<string, SlotData | undefined>, settings: Sparse): string[][] {
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
}
