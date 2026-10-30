// Public types for MapView. Kept framework-agnostic so providers
// (leaflet / mapbox / google) can share a single contract.

import type { ReactNode } from 'react';

export type MapVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

export type MapTooltipField = { label: string; value: string };

export type MapTooltipData = {
  title: string;
  description?: string;
  fields?: MapTooltipField[];
  /** An internal path (`/…`) shown as a link at the bottom of the tooltip. Anything else is ignored. */
  href?: string;
  /** Text of that link. Default = "Open". */
  linkLabel?: string;
  /** A status colour shown as a dot before the title (any CSS colour or `var(--token)`; unsafe values are ignored). */
  color?: string;
};

/** How a marker is drawn: the pin (default), a solid dot, a tinted ring (circle), a Font Awesome icon, or a picture. */
export type MapMarkerShape = 'pin' | 'dot' | 'circle' | 'icon' | 'image';

/** A request to move the view to a marker: `seq` changes on every request, so the same marker can be asked for twice. */
export type MapFocus = { id: string; seq: number };

export type MapMarker = {
  id: string;
  position: [number, number];
  variant?: MapVariant;
  tooltip?: MapTooltipData;
  label?: string;
  /**
   * Any CSS colour (`#hex`, `rgb()`, `hsl()`, `var(--token)`); wins over `variant`. A value that
   * is not a plain colour is ignored (it is written into the marker's HTML).
   */
  color?: string;
  /** Default = 'pin'. */
  shape?: MapMarkerShape;
  /** Font Awesome class (`fas fa-truck`) for `shape: 'icon'`. Anything else falls back to a dot. */
  icon?: string;
  /** Width of the marker in px (a pin is 1.5× as tall). Default = 24; clamped to 8..64. */
  size?: number;
  /** A short text drawn inside a dot or circle marker (a count): at most 4 characters, escaped. Other shapes ignore it. */
  text?: string;
  /** An internal path or https address for `shape: 'image'` (checked by `safeMarkerImage`); anything else falls back to a dot. */
  image?: string;
  /** The viewer may drag the marker; `onMarkerMove` is told where it was dropped. */
  draggable?: boolean;
  /** Whether this marker's label is permanent, when that differs from the map's `showLabels` (a label mode of "alerts" names only the markers in trouble). */
  permanentLabel?: boolean;
  /** The marker is in trouble (a warning or worse): what the "alerts" label mode names. */
  alert?: boolean;
};

export type MapZone = {
  id: string;
  positions: [number, number][];
  label?: string;
  variant?: MapVariant;
  fillOpacity?: number;
};

export type MapRoute = {
  id: string;
  positions: [number, number][];
  label?: string;
  color?: string;
  weight?: number;
  dashed?: boolean;
};

/**
 * A picture used instead of map tiles (a floor plan, a site drawing): positions are then `[y, x]` in the picture's
 * pixels, measured from its top-left corner, and the map uses flat (non-geographic) coordinates.
 */
export type MapImage = {
  url: string;
  width: number;
  height: number;
};

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MapProviderId = 'leaflet' | 'mapbox' | 'google';

/**
 * One raster tile layer. `url` is a Leaflet URL template ({s}/{z}/{x}/{y}/{r}); `attribution` may
 * contain HTML links. `labels` is an optional transparent overlay (place names) drawn above it.
 * `subdomains` fills `{s}` (Leaflet's default `abc`); `maxZoom` is the deepest zoom the server has tiles for
 * (default 16; closer zooms enlarge its tiles); `dim` draws the tiles darkened, a dark rendition of a light map.
 */
export type MapTiles = { url: string; attribution: string; labels?: string; subdomains?: string | string[]; maxZoom?: number; dim?: boolean };

/** One tile layer for both themes, or a light/dark pair. Default: the installation's `MapTileSource`, else OpenStreetMap. */
export type MapTilesConfig = MapTiles | { light: MapTiles; dark: MapTiles };

/**
 * An installation's basemap, set once for every map (`MapTilesProvider`): a tile server's URL template (https, with
 * {z} {x} {y}), its attribution, the `{s}` subdomains, its deepest zoom and, optionally, a dark rendition. Without
 * `darkUrl` the dark theme draws the same tiles darkened. Default: OpenStreetMap's standard tiles (`OSM_TILES`).
 */
export type MapTileSource = {
  url: string;
  attribution: string;
  subdomains?: string | string[];
  maxZoom?: number;
  darkUrl?: string;
};

export type MapViewProps = {
  /** Map provider implementation. Default: 'leaflet'. */
  provider?: MapProviderId;
  /** Provider API key (mapbox/google). Ignored by leaflet. */
  apiKey?: string;
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  zones?: MapZone[];
  routes?: MapRoute[];
  /** When set, the map auto-fits to marker bounds with this padding (px). */
  fitBoundsPadding?: number;
  onMarkerAdd?: (position: [number, number]) => void;
  onMarkerClick?: (id: string) => void;
  height?: string | number;
  className?: string;
  /** Custom tile server (e.g. a self-hosted or keyed provider). Default: the installation's `MapTileSource`, else OpenStreetMap. */
  tiles?: MapTilesConfig;
  /** Text shown while the map chunk / viewport loads. Default = "Loading map…". */
  loadingLabel?: string;
} & MapDisplayOptions;

/** Display options shared by `MapView` and `MapCanvas` (all optional, defaults = the previous behaviour). */
export type MapDisplayOptions = {
  /** Lowest / highest zoom the viewer may reach. */
  minZoom?: number;
  maxZoom?: number;
  /** Group markers that overlap at the current zoom into a count bubble; clicking one zooms in. Default = false. */
  cluster?: boolean;
  /** Show each marker's `label` permanently next to it. Default = false (label on hover). */
  showLabels?: boolean;
  /** Open marker tooltips on hover (default) or on click (they then stay open and links in them can be used); 'none' = no tooltips. */
  tooltipTrigger?: 'hover' | 'click' | 'none';
  /** Pixel distance within which `cluster` groups markers. Default = 40. */
  clusterRadius?: number;
  /**
   * What a cluster's bubble says (escaped, at most 4 characters; '' for none), from the markers it holds, e.g. the sum of
   * their counts when each marker carries one in `text`. Default = how many markers it holds.
   */
  clusterText?: (markers: MapMarker[]) => string;
  /** Zoom with the mouse wheel. Default = true. */
  scrollWheelZoom?: boolean;
  /** Show the + / − zoom buttons. Default = true. */
  zoomControl?: boolean;
  /** Corner of the zoom buttons. Default = 'topleft'. */
  controlsPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  /**
   * A draggable marker was dropped: its id and new position in the map's own coordinates (an image map: `[y, x]` pixels
   * from the picture's top-left corner, whole numbers kept inside the picture).
   */
  onMarkerMove?: (id: string, position: [number, number]) => void;
  /** The closest zoom a fit to the markers may reach (one marker would otherwise zoom all the way in). Default = 15. */
  fitMaxZoom?: number;
  /** Build a link for a tooltip `href` (host routing); default = a plain anchor. */
  renderLink?: (href: string, children: ReactNode, className?: string) => ReactNode;
  // TODO M2: activeMarkerId, mode (markers|cluster|heatmap)
  // TODO M3: search, route, reverse geocode
  // TODO M4: drawTools, locate, layerToggle
  // TODO M5: reducedMotion, messages (i18n), onTelemetry
};

// ─── color tables shared across providers ────────────────────────────────────

export const VARIANT_HEX: Record<MapVariant, string> = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  error:   '#ef4444',
  info:    '#06b6d4',
  neutral: '#6b7280',
};

export const VARIANT_FILL: Record<MapVariant, string> = {
  primary: '#3b82f620',
  success: '#22c55e20',
  warning: '#f59e0b20',
  error:   '#ef444420',
  info:    '#06b6d420',
  neutral: '#6b728020',
};

/**
 * A marker colour that is safe to write into marker HTML: #hex, rgb()/rgba(), hsl()/hsla(),
 * var(--token) or `transparent`. Anything else (quotes, `;`, url()) returns `undefined`.
 */
const SAFE_COLOR_RE = new RegExp(
  '^(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})' +
  '|rgba?\\([0-9.,%\\s/]{5,40}\\)' +
  '|hsla?\\([0-9.,%\\s/deg]{5,40}\\)' +
  '|var\\(--[a-z][a-z0-9-]{0,63}\\)' +
  '|transparent)$',
);
export function safeMarkerColor(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 80 && SAFE_COLOR_RE.test(value.trim()) ? value.trim() : undefined;
}

/** A Font Awesome class list (`fas fa-truck`, `fa-solid fa-truck`) that is safe to write into marker HTML. */
const SAFE_ICON_RE = /^(?:fa[srbldt]?|fa-(?:solid|regular|brands|light|duotone|thin))(?: fa-[a-z0-9-]+){1,3}$/;
export function safeMarkerIcon(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 80 && SAFE_ICON_RE.test(value.trim()) ? value.trim() : undefined;
}

/**
 * A marker picture that is safe to write into marker HTML: an internal path (`/…`, not `//`) or an https address,
 * without quotes, angle brackets, backslashes, spaces or control characters. Anything else returns `undefined`.
 */
const SAFE_IMAGE_RE = /^(?:\/(?![\/\\])|https:\/\/)[^\s"'<>\\\u0000-\u001f\u007f]{1,480}$/;
export function safeMarkerImage(value: unknown): string | undefined {
  return typeof value === 'string' && SAFE_IMAGE_RE.test(value.trim()) ? value.trim() : undefined;
}

/** The pin drawing. `color` must already be safe (a VARIANT_HEX value or `safeMarkerColor`'s result). */
export function markerSvg(color: string, size = 24): string {
  const w = Math.round(size);
  const h = Math.round(size * 1.5);
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${w}" height="${h}" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 3.143 1.204 5.997 3.17 8.126L12 36l8.83-15.874A11.945 11.945 0 0 0 24 12C24 5.373 18.627 0 12 0z" fill="${color}" style="fill:${color}"/>
      <circle cx="12" cy="12" r="4.5" fill="white" opacity="0.9"/>
    </svg>`;
}
