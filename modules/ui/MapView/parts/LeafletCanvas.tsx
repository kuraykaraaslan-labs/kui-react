'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import type { Map as LeafletMap } from 'leaflet';
import { loadLeaflet, LEAFLET_TILES, type LeafletBundle } from '../providers/leaflet';
import { useDarkMode } from '../hooks/useDarkMode';
import { useFitBounds } from '../hooks/useFitBounds';
import { MarkerPart } from './Marker';
import { ClusteredMarkers } from './Cluster';
import { ZoneShape, RouteShape } from './Shapes';
import { CANVAS_CLASS, DIM_TILES_CLASS } from './styles';
import { useMapTileSource } from '../MapTilesProvider';
import { tileSourceTiles } from '../tiles';
import type { MapDisplayOptions, MapImage, MapMarker, MapZone, MapRoute, MapTilesConfig } from '../types';

type LeafletCanvasProps = {
  center: [number, number];
  zoom: number;
  markers: MapMarker[];
  zones: MapZone[];
  routes: MapRoute[];
  showZones: boolean;
  showRoutes: boolean;
  /** Hide the markers (a layer toggle); hidden ones still count for fitting, so toggling never moves the view. */
  showMarkers?: boolean;
  /** A picture instead of tiles: positions are `[y, x]` pixels from its top-left corner (flat coordinates). */
  image?: MapImage;
  addMode: boolean;
  fitBoundsPadding?: number;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick?: (id: string) => void;
  tiles?: MapTilesConfig;
  loadingLabel?: string;
} & MapDisplayOptions;

/**
 * The actual Leaflet renderer. Owns the leaflet bundle lifecycle: imports the
 * package once (cached at module scope by providers/leaflet.ts) and re-mounts
 * the inner `<MapContainer>` only when the bundle resolves.
 *
 * Dark mode is reflected by swapping the tile layer (its dark URL, or the light
 * tiles darkened). The tiles are the `tiles` prop, else the installation's source
 * (`MapTilesProvider`), else OpenStreetMap's.
 */
export function LeafletCanvas(props: LeafletCanvasProps) {
  const [bundle, setBundle] = useState<LeafletBundle | null>(null);

  useEffect(() => {
    let alive = true;
    loadLeaflet().then((b) => { if (alive) setBundle(b); });
    return () => { alive = false; };
  }, []);

  if (!bundle) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-raised">
        <span className="text-sm text-text-secondary">{props.loadingLabel ?? 'Loading map…'}</span>
      </div>
    );
  }

  return <InnerMap {...props} bundle={bundle} />;
}

// Side-effect components that need a live map instance. react-leaflet's hooks
// come from the lazily-loaded bundle.

function ClickHandler({
  bundle,
  addMode,
  onMapClick,
}: {
  bundle: LeafletBundle;
  addMode: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const { useMapEvents } = bundle;
  useMapEvents({
    click(e: { latlng: { lat: number; lng: number } }) {
      if (addMode) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({
  bundle,
  markers,
  padding,
  maxZoom,
}: {
  bundle: LeafletBundle;
  markers: MapMarker[];
  padding?: number;
  maxZoom?: number;
}) {
  const { useMap, L } = bundle;
  const map = useMap() as LeafletMap;
  useFitBounds(map, L, markers, padding, maxZoom);
  return null;
}

/**
 * Keeps the live map in step with options react-leaflet only reads at mount: the view (when not
 * fitting to markers), the zoom limits and wheel zoom. A settings change therefore shows at once.
 */
function ViewSync({
  bundle, center, zoom, fitting, minZoom, maxZoom, scrollWheelZoom,
}: {
  bundle: LeafletBundle;
  center: [number, number];
  zoom: number;
  fitting: boolean;
  minZoom?: number;
  maxZoom?: number;
  scrollWheelZoom: boolean;
}) {
  const map = bundle.useMap() as LeafletMap;
  const [lat, lng] = center;
  useEffect(() => {
    if (!fitting) map.setView([lat, lng], zoom);
  }, [map, fitting, lat, lng, zoom]);
  useEffect(() => { map.setMinZoom(minZoom ?? 0); }, [map, minZoom]);
  useEffect(() => { map.setMaxZoom(maxZoom ?? 20); }, [map, maxZoom]);
  useEffect(() => {
    if (scrollWheelZoom) map.scrollWheelZoom.enable();
    else map.scrollWheelZoom.disable();
  }, [map, scrollWheelZoom]);
  useEffect(() => {
    // The Leaflet credit without its flag: shorter, and the attribution stays one small line.
    map.attributionControl?.setPrefix('<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>');
  }, [map]);
  return null;
}

function InnerMap({
  center,
  zoom,
  markers: rawMarkers,
  zones: rawZones,
  routes: rawRoutes,
  image,
  showZones,
  showRoutes,
  showMarkers,
  addMode,
  fitBoundsPadding,
  onMapClick,
  onMarkerClick,
  tiles: tilesProp,
  minZoom,
  maxZoom,
  cluster = false,
  showLabels = false,
  tooltipTrigger = 'hover',
  renderLink,
  onMarkerMove,
  clusterRadius,
  clusterText,
  scrollWheelZoom = true,
  zoomControl = true,
  controlsPosition = 'topleft',
  fitMaxZoom,
  bundle,
}: LeafletCanvasProps & { bundle: LeafletBundle }) {
  const { MapContainer, TileLayer, ImageOverlay, Marker, Tooltip, Popup, Polygon, Polyline, ZoomControl, L } = bundle;
  // An image map takes `[y, x]` pixels from the picture's top-left; Leaflet's flat coordinates grow upwards.
  const flip = image ? (p: [number, number]): [number, number] => [image.height - p[0], p[1]] : null;
  const markers = flip ? rawMarkers.map((m) => ({ ...m, position: flip(m.position) })) : rawMarkers;
  const zones = flip ? rawZones.map((z) => ({ ...z, positions: z.positions.map(flip) })) : rawZones;
  const routes = flip ? rawRoutes.map((r) => ({ ...r, positions: r.positions.map(flip) })) : rawRoutes;
  // A drop on an image map is told in pixels from the top-left, whole numbers inside the picture.
  const moved = onMarkerMove ? (id: string, p: [number, number]) => {
    if (!image) { onMarkerMove(id, p); return; }
    const y = Math.min(image.height, Math.max(0, Math.round(image.height - p[0])));
    const x = Math.min(image.width, Math.max(0, Math.round(p[1])));
    onMarkerMove(id, [y, x]);
  } : undefined;
  const imageBounds: [[number, number], [number, number]] | null = image ? [[0, 0], [image.height, image.width]] : null;
  const isDark = useDarkMode();
  const source = useMapTileSource();
  const set = tilesProp ? ('url' in tilesProp ? { light: tilesProp, dark: tilesProp } : tilesProp) : source ? tileSourceTiles(source) : LEAFLET_TILES;
  const tiles = isDark ? set.dark : set.light;

  // Fitting frames the zones' and routes' vertices too, not only the markers: a map of zones alone was not framed.
  // An image map is framed as a whole: a floor plan is read in full, not cropped to its markers.
  const fitPoints: MapMarker[] = imageBounds ? imageBounds.map((position, n) => ({ id: `image:${n}`, position })) : [
    ...markers,
    ...zones.flatMap((z) => z.positions.map((position, n) => ({ id: `zone:${z.id}:${n}`, position }))),
    ...routes.flatMap((r) => r.positions.map((position, n) => ({ id: `route:${r.id}:${n}`, position }))),
  ];

  return (
    <MapContainer
      // The coordinate system is fixed when Leaflet creates the map: switching kinds builds a new one.
      key={image ? `image:${image.url}` : 'geo'}
      // A picture fills its card: fractional zoom steps (whole steps halve or double it, leaving it small or cropped).
      {...(image ? { crs: L.CRS.Simple, zoomSnap: 0.1, zoomDelta: 0.5 } : {})}
      center={image ? [image.height / 2, image.width / 2] : center}
      zoom={image ? 0 : zoom}
      {...(minZoom !== undefined ? { minZoom } : image ? { minZoom: -5 } : {})}
      {...(maxZoom !== undefined ? { maxZoom } : {})}
      zoomControl={false}
      scrollWheelZoom={scrollWheelZoom}
      style={{ width: '100%', height: '100%', background: 'var(--surface-sunken)', fontFamily: 'inherit' }}
      className={cn(CANVAS_CLASS, addMode && 'cursor-crosshair')}
    >
      {image && imageBounds ? (
        <ImageOverlay url={image.url} bounds={imageBounds} />
      ) : (
        <>
          <TileLayer
            key={`${isDark ? 'dark' : 'light'}-${tiles.url}-${tiles.dim ? 'dim' : ''}`}
            attribution={tiles.attribution}
            url={tiles.url}
            maxNativeZoom={tiles.maxZoom ?? 16}
            maxZoom={20}
            {...(tiles.subdomains ? { subdomains: tiles.subdomains } : {})}
            {...(tiles.dim ? { className: DIM_TILES_CLASS } : {})}
          />
          {tiles.labels && (
            <TileLayer key={`labels-${tiles.labels}`} url={tiles.labels} maxNativeZoom={tiles.maxZoom ?? 16} maxZoom={20} zIndex={2} />
          )}
        </>
      )}
      {zoomControl && ZoomControl && <ZoomControl key={controlsPosition} position={controlsPosition} />}

      <ClickHandler bundle={bundle} addMode={addMode} onMapClick={onMapClick} />
      <FitBounds bundle={bundle} markers={fitPoints} padding={fitBoundsPadding} maxZoom={fitMaxZoom} />
      <ViewSync
        bundle={bundle}
        center={center}
        zoom={zoom}
        fitting={fitBoundsPadding !== undefined && fitPoints.length > 0}
        minZoom={minZoom}
        maxZoom={maxZoom}
        scrollWheelZoom={scrollWheelZoom}
      />

      {showZones && zones.map((zone) => (
        <ZoneShape key={zone.id} zone={zone} Polygon={Polygon} Tooltip={Tooltip} />
      ))}

      {showRoutes && routes.map((route) => (
        <RouteShape key={route.id} route={route} Polyline={Polyline} Tooltip={Tooltip} />
      ))}

      {showMarkers === false ? null : cluster ? (
        <ClusteredMarkers
          bundle={bundle}
          markers={markers}
          onMarkerClick={onMarkerClick}
          onMarkerMove={moved}
          showLabels={showLabels}
          tooltipTrigger={tooltipTrigger}
          renderLink={renderLink}
          radius={clusterRadius}
          text={clusterText}
        />
      ) : markers.map((marker) => (
        <MarkerPart
          key={marker.id}
          marker={marker}
          L={L}
          RLMarker={Marker}
          RLTooltip={Tooltip}
          RLPopup={Popup}
          onMarkerClick={onMarkerClick}
          onMarkerMove={moved}
          showLabel={showLabels}
          tooltipTrigger={tooltipTrigger}
          renderLink={renderLink}
        />
      ))}
    </MapContainer>
  );
}
