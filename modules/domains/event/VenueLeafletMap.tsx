'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useMapTileSource } from '@/modules/ui/MapView/MapTilesProvider';
import { OSM_TILES, TILE_REFERRER_POLICY, tileSourceTiles } from '@/modules/ui/MapView/tiles';
import { useDarkMode } from '@/modules/ui/MapView/hooks/useDarkMode';
import { DIM_TILES_CLASS } from '@/modules/ui/MapView/parts/styles';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

type VenueLeafletMapProps = {
  lat: number;
  lng: number;
  name: string;
  zoom?: number;
  interactive?: boolean;
};

// Consumed via next/dynamic in VenueMapBox.tsx
// (dynamic(() => import('./VenueLeafletMap'))), which requires a default
// export.
// eslint-disable-next-line kui/no-default-export
export default function VenueLeafletMap({
  lat,
  lng,
  name,
  zoom = 15,
  interactive = true,
}: VenueLeafletMapProps) {
  // The installation's tile source (MapTilesProvider), else OpenStreetMap's; darkened in the dark theme without a dark URL.
  const source = useMapTileSource();
  const isDark = useDarkMode();
  const set = tileSourceTiles(source ?? OSM_TILES);
  const tiles = isDark ? set.dark : set.light;
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl={interactive}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      attributionControl={interactive}
    >
      <RecenterMap lat={lat} lng={lng} />
      <TileLayer
        key={`${isDark ? 'dark' : 'light'}-${tiles.url}-${tiles.dim ? 'dim' : ''}`}
        url={tiles.url}
        attribution={tiles.attribution}
        referrerPolicy={TILE_REFERRER_POLICY}
        {...(tiles.maxZoom !== undefined ? { maxNativeZoom: tiles.maxZoom } : {})}
        {...(tiles.subdomains ? { subdomains: tiles.subdomains } : {})}
        {...(tiles.dim ? { className: DIM_TILES_CLASS } : {})}
      />
      <Marker position={[lat, lng]} icon={markerIcon} keyboard={interactive} alt={name}>
        <Popup>{name}</Popup>
      </Marker>
    </MapContainer>
  );
}
