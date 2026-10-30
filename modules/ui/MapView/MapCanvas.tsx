'use client';
import { cn } from '@/libs/utils/cn';
import { LeafletCanvas } from './parts/LeafletCanvas';
import type { MapDisplayOptions, MapFocus, MapImage, MapMarker, MapRoute, MapTilesConfig, MapZone } from './types';

export type MapCanvasProps = {
  markers?: MapMarker[];
  zones?: MapZone[];
  routes?: MapRoute[];
  /** Layer visibility (default all shown). A hidden layer still counts for fitting the view. */
  showMarkers?: boolean;
  showZones?: boolean;
  showRoutes?: boolean;
  /** A picture (a floor plan) instead of map tiles: positions are `[y, x]` pixels from its top-left corner. */
  image?: MapImage;
  center?: [number, number];
  zoom?: number;
  /** One tile layer for both themes, or a light/dark pair. Default: the installation's `MapTileSource`, else OpenStreetMap. */
  tiles?: MapTilesConfig;
  /** Fit the view to the markers with this padding (px). Default = 32. */
  fitBoundsPadding?: number;
  /** Fit the view to the markers (default). `false` keeps `center` and `zoom`. */
  fitBounds?: boolean;
  onMarkerClick?: (id: string) => void;
  /** Move the view to this marker (a list that selects a place): `seq` changes on every request, so the same marker can be asked for again after the reader panned away. */
  focus?: MapFocus | null;
  /** The zoom a focus never goes below (default 13, near enough for a clustered marker to stand alone). */
  focusZoom?: number;
  /** Text shown until the map chunk resolves. Default = "Loading map…". */
  loadingLabel?: string;
  /** Accessible name of the map region. Default = "Map". */
  ariaLabel?: string;
  className?: string;
} & MapDisplayOptions;

const noop = () => {};

/**
 * MapCanvas — a bare, card-less Leaflet map that fills its parent (`h-full w-full`).
 *
 * Use it inside something that already owns the frame (a dashboard cell, a
 * panel). `MapView` is the framed variant with a toolbar. The parent must have
 * a height. Leaflet loads lazily; the stylesheet comes from `app/globals.css`.
 */
export function MapCanvas({
  markers = [],
  zones = [],
  routes = [],
  showMarkers = true,
  showZones = true,
  showRoutes = true,
  image,
  center = [39.9334, 32.8597],
  zoom = 6,
  tiles,
  fitBoundsPadding = 32,
  fitBounds = true,
  onMarkerClick,
  focus,
  focusZoom,
  loadingLabel = 'Loading map…',
  ariaLabel = 'Map',
  className,
  ...display
}: MapCanvasProps) {
  return (
    <div role="region" aria-label={ariaLabel} className={cn('h-full w-full', className)} style={{ isolation: 'isolate' }}>
      <LeafletCanvas
        center={center}
        zoom={zoom}
        markers={markers}
        zones={zones}
        routes={routes}
        showZones={showZones}
        showRoutes={showRoutes}
        showMarkers={showMarkers}
        {...(image ? { image } : {})}
        addMode={false}
        fitBoundsPadding={fitBounds ? fitBoundsPadding : undefined}
        onMapClick={noop}
        onMarkerClick={onMarkerClick}
        focus={focus}
        focusZoom={focusZoom}
        tiles={tiles}
        loadingLabel={loadingLabel}
        {...display}
      />
    </div>
  );
}
