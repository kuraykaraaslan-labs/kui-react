'use client';
import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import type * as LeafletLib from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import type { LeafletBundle } from '../providers/leaflet';
import { MarkerPart } from './Marker';
import { VARIANT_HEX, safeMarkerColor, type MapMarker } from '../types';

export type MarkerGroup = { id: string; markers: MapMarker[]; position: [number, number] };

/**
 * Greedy grid clustering in screen pixels: markers whose projected points fall within `radius` px
 * of a group's first marker join it. Pure; `project` maps a position to pixels at the current zoom.
 */
export function clusterMarkers(
  markers: MapMarker[],
  project: (position: [number, number]) => { x: number; y: number },
  radius = 40,
): MarkerGroup[] {
  const groups: Array<MarkerGroup & { px: { x: number; y: number } }> = [];
  for (const m of markers) {
    const p = project(m.position);
    const hit = groups.find((g) => Math.abs(g.px.x - p.x) <= radius && Math.abs(g.px.y - p.y) <= radius);
    if (hit) hit.markers.push(m);
    else groups.push({ id: m.id, markers: [m], position: m.position, px: p });
  }
  return groups.map(({ id, markers: ms }) => ({
    id,
    markers: ms,
    position: [
      ms.reduce((a, m) => a + m.position[0], 0) / ms.length,
      ms.reduce((a, m) => a + m.position[1], 0) / ms.length,
    ] as [number, number],
  }));
}

/** A group's colour: the one its markers share, else the primary colour. Always a safe colour. */
export function clusterColor(markers: MapMarker[]): string {
  const colors = new Set(markers.map((m) => safeMarkerColor(m.color) ?? VARIANT_HEX[m.variant ?? 'primary']));
  return colors.size === 1 ? [...colors][0] : 'var(--primary, #3b82f6)';
}

function clusterIcon(L: typeof LeafletLib, count: number, color: string) {
  const size = count < 10 ? 30 : count < 100 ? 36 : 42;
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#ffffff;font:600 12px/1 system-ui,sans-serif;font-variant-numeric:tabular-nums;border:2px solid rgba(255,255,255,0.9);box-shadow:0 0 0 4px color-mix(in srgb, ${color} 22%, transparent),0 1px 3px rgba(0,0,0,0.3);box-sizing:border-box">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type ClusteredMarkersProps = {
  bundle: LeafletBundle;
  markers: MapMarker[];
  onMarkerClick?: (id: string) => void;
  onMarkerMove?: (id: string, position: [number, number]) => void;
  showLabels?: boolean;
  tooltipTrigger?: 'hover' | 'click' | 'none';
  renderLink?: (href: string, children: ReactNode, className?: string) => ReactNode;
  /** Pixel distance within which markers group. Default = 40. */
  radius?: number;
};

/** Markers grouped by overlap at the current zoom; a group is a count bubble that zooms in on click. */
export function ClusteredMarkers({ bundle, markers, onMarkerClick, onMarkerMove, showLabels, tooltipTrigger, renderLink, radius = 40 }: ClusteredMarkersProps) {
  const { useMap, Marker, Tooltip, Popup, L } = bundle;
  const map = useMap() as LeafletMap;
  // The zoom is read when the listener is registered as well as on every zoomend: the canvas's first fitBounds runs
  // before this component subscribes, so its zoomend has already fired by then.
  const subscribe = useCallback((onZoom: () => void) => {
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [map]);
  const zoom = useSyncExternalStore(subscribe, () => map.getZoom(), () => map.getZoom());
  const groups = clusterMarkers(markers, (pos) => map.project(pos, zoom), Math.min(200, Math.max(10, radius)));

  return (
    <>
      {groups.map((g) => g.markers.length === 1 ? (
        <MarkerPart
          key={g.id}
          marker={g.markers[0]}
          L={L}
          RLMarker={Marker}
          RLTooltip={Tooltip}
          RLPopup={Popup}
          onMarkerClick={onMarkerClick}
          onMarkerMove={onMarkerMove}
          showLabel={showLabels}
          tooltipTrigger={tooltipTrigger}
          renderLink={renderLink}
        />
      ) : (
        <Marker
          key={`cluster-${g.id}-${g.markers.length}-${clusterColor(g.markers)}`}
          position={g.position}
          icon={clusterIcon(L, g.markers.length, clusterColor(g.markers))}
          alt={`${g.markers.length} markers, zoom in`}
          eventHandlers={{
            click: () => map.fitBounds(L.latLngBounds(g.markers.map((m) => m.position)), { padding: [32, 32] }),
          }}
        />
      ))}
    </>
  );
}
