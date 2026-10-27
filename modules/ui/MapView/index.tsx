'use client';
import { useCallback, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Card } from '@/modules/ui/Card';
import { LeafletCanvas } from './parts/LeafletCanvas';
import { Toolbar } from './parts/Toolbar';
import { useInViewport } from './hooks/useInViewport';
import { useAutoMarkers } from './hooks/useAutoMarkers';
import type { MapViewProps } from './types';

export type {
  MapVariant,
  MapTooltipField,
  MapTooltipData,
  MapMarker,
  MapZone,
  MapRoute,
  MapImage,
  MapBounds,
  MapProviderId,
  MapViewProps,
  MapTiles,
  MapTilesConfig,
  MapTileSource,
  MapMarkerShape,
  MapDisplayOptions,
} from './types';
export { safeMarkerColor, safeMarkerIcon, safeMarkerImage } from './types';
export { MapCanvas } from './MapCanvas';
export { MapTilesProvider, useMapTileSource } from './MapTilesProvider';
export { OSM_TILES, OSM_ATTRIBUTION, TILE_REFERRER_POLICY, safeAttribution, safeTileSource, tileSourceTiles } from './tiles';
export type { MapCanvasProps } from './MapCanvas';

/**
 * MapView — provider-agnostic interactive map.
 *
 * M1: leaflet provider with theme-aware tiles (OpenStreetMap by default, darkened in the dark theme; an
 * installation's own source through `MapTilesProvider`),
 * fit-to-bounds, and IntersectionObserver-driven lazy loading. mapbox / google
 * adapters are stubbed — switching providers throws until M1+.
 */
export function MapView({
  provider = 'leaflet',
  center = [39.9334, 32.8597],
  zoom = 6,
  markers = [],
  zones = [],
  routes = [],
  fitBoundsPadding,
  onMarkerAdd,
  onMarkerClick,
  height = 480,
  className,
  tiles,
  loadingLabel = 'Loading map…',
  minZoom,
  maxZoom,
  cluster,
  showLabels,
  tooltipTrigger,
  renderLink,
  clusterRadius,
  clusterText,
  scrollWheelZoom,
  zoomControl,
  controlsPosition,
  fitMaxZoom,
  onMarkerMove,
}: MapViewProps) {
  const display = { minZoom, maxZoom, cluster, showLabels, tooltipTrigger, renderLink, clusterRadius, clusterText, scrollWheelZoom, zoomControl, controlsPosition, fitMaxZoom, onMarkerMove };
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const [addMode, setAddMode] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const { extras, handleMapClick } = useAutoMarkers(onMarkerAdd);

  const onMapClick = useCallback((lat: number, lng: number) => {
    handleMapClick(lat, lng);
    setAddMode(false);
  }, [handleMapClick]);

  if (provider !== 'leaflet') {
    // TODO M1+: route to providers/mapbox.ts or providers/google.ts
    throw new Error(`MapView provider "${provider}" is not yet implemented — TODO M1+`);
  }

  const cssHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <Card variant="raised" className={cn('overflow-hidden', className)}>
      {/*
       * Card adds `px-6 py-4`. The -mx-6 -my-4 wrapper cancels that so the
       * toolbar + map render edge-to-edge inside the rounded border.
       * `isolation: isolate` keeps Leaflet's z-indexes (up to 1000) scoped.
       */}
      <div className="-mx-6 -my-4 flex flex-col" ref={ref}>
        <div className="px-4 py-2.5 bg-surface-raised border-b border-border">
          <Toolbar
            addMode={addMode}
            onToggleAddMode={() => setAddMode((v) => !v)}
            hasZones={zones.length > 0}
            showZones={showZones}
            onToggleZones={() => setShowZones((v) => !v)}
            hasRoutes={routes.length > 0}
            showRoutes={showRoutes}
            onToggleRoutes={() => setShowRoutes((v) => !v)}
          />
        </div>
        <div style={{ height: cssHeight, isolation: 'isolate' }}>
          {!visible ? (
            <div className="w-full h-full flex items-center justify-center bg-surface-raised">
              <span className="text-sm text-text-secondary">{loadingLabel}</span>
            </div>
          ) : (
            <LeafletCanvas
              center={center}
              zoom={zoom}
              markers={[...markers, ...extras]}
              zones={zones}
              routes={routes}
              showZones={showZones}
              showRoutes={showRoutes}
              addMode={addMode}
              fitBoundsPadding={fitBoundsPadding}
              onMapClick={onMapClick}
              onMarkerClick={onMarkerClick}
              tiles={tiles}
              loadingLabel={loadingLabel}
              {...display}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
