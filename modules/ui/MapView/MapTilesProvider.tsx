'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { safeTileSource } from './tiles';
import type { MapTileSource } from './types';

const MapTileSourceContext = createContext<MapTileSource | null>(null);

/**
 * MapTilesProvider — the installation's basemap for every map below it (MapView, MapCanvas and the map widget's
 * "Follow the theme" style), set once near the root. The source is checked with `safeTileSource`: an unusable one
 * (or none) leaves the default, OpenStreetMap's standard tiles. A map's own `tiles` prop still wins.
 */
export function MapTilesProvider({ source, children }: { source?: MapTileSource | null; children: ReactNode }) {
  const key = source ? JSON.stringify(source) : '';
  // Keyed by value: a host that builds the object on every render does not re-render every map.
  const checked = useMemo(() => (key ? safeTileSource(JSON.parse(key)) ?? null : null), [key]);
  return <MapTileSourceContext.Provider value={checked}>{children}</MapTileSourceContext.Provider>;
}

/** The installation's tile source from `MapTilesProvider`, or `null` (the default applies). */
export function useMapTileSource(): MapTileSource | null {
  return useContext(MapTileSourceContext);
}
