// Leaflet provider — runtime-only. Imports leaflet/react-leaflet lazily so the
// 100 kB+ bundle is never shipped to clients that do not render a map.
//
// This module exports a `loadLeaflet()` function. It is intentionally NOT a
// React component — the parts/LeafletCanvas.tsx component owns rendering and
// calls into here for the bundle.

import type * as ReactLeaflet from 'react-leaflet';
import type * as LeafletLib from 'leaflet';
import { OSM_TILES, tileSourceTiles } from '../tiles';

export type LeafletBundle = {
  MapContainer: typeof ReactLeaflet.MapContainer;
  TileLayer:    typeof ReactLeaflet.TileLayer;
  Marker:       typeof ReactLeaflet.Marker;
  Tooltip:      typeof ReactLeaflet.Tooltip;
  Popup:        typeof ReactLeaflet.Popup;
  Polygon:      typeof ReactLeaflet.Polygon;
  Polyline:     typeof ReactLeaflet.Polyline;
  ImageOverlay: typeof ReactLeaflet.ImageOverlay;
  ZoomControl:  typeof ReactLeaflet.ZoomControl;
  useMap:       typeof ReactLeaflet.useMap;
  useMapEvents: typeof ReactLeaflet.useMapEvents;
  L:            typeof LeafletLib;
};

// Esri's keyless Canvas basemaps, kept for hosts that pick them as their `tiles` (the map widget's styles do).
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
export const ESRI_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const esriTiles = (service: string) => `${ESRI}/${service}/MapServer/tile/{z}/{y}/{x}`;

// The default basemap: OpenStreetMap's standard tiles, darkened in the dark theme. (CARTO's basemaps, an earlier
// default, now answer every keyless request with an "API key required" tile.) An installation sets its own tile
// source once with `MapTilesProvider`; a map's `tiles` prop wins over both.
export const LEAFLET_TILES = tileSourceTiles(OSM_TILES);

let _cached: Promise<LeafletBundle> | null = null;

export function loadLeaflet(): Promise<LeafletBundle> {
  if (_cached) return _cached;
  _cached = (async () => {
    // Leaflet's stylesheet is already bundled globally via app/globals.css
    // (`@import "leaflet/dist/leaflet.css"`), so we only need the JS here.
    const [rl, leaflet] = await Promise.all([
      import('react-leaflet'),
      import('leaflet'),
    ]);
    return {
      MapContainer: rl.MapContainer,
      TileLayer:    rl.TileLayer,
      Marker:       rl.Marker,
      Tooltip:      rl.Tooltip,
      Popup:        rl.Popup,
      Polygon:      rl.Polygon,
      Polyline:     rl.Polyline,
      ImageOverlay: rl.ImageOverlay,
      ZoomControl:  rl.ZoomControl,
      useMap:       rl.useMap,
      useMapEvents: rl.useMapEvents,
      L:            leaflet as unknown as typeof LeafletLib,
    };
  })();
  return _cached;
}
