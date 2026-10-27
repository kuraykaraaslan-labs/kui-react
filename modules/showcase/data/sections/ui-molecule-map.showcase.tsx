'use client';
import React, { useState } from 'react';
import { MapView, MapCanvas } from '@/modules/ui/MapView';
import type { MapMarker, MapZone, MapRoute } from '@/modules/ui/MapView';
import type { ShowcaseComponent } from '../showcase.types';

// ── sample data ──────────────────────────────────────────────────────────────

const ISTANBUL_CENTER: [number, number] = [41.015, 28.979];

const CITIES: MapMarker[] = [
  {
    id: 'istanbul',
    position: [41.015, 28.979],
    variant: 'primary',
    tooltip: {
      title: 'İstanbul',
      description: 'Türkiye\'nin en kalabalık şehri',
      fields: [
        { label: 'Nüfus', value: '15.8 M' },
        { label: 'Alan',  value: '5.461 km²' },
      ],
    },
  },
  {
    id: 'ankara',
    position: [39.925, 32.836],
    variant: 'success',
    tooltip: {
      title: 'Ankara',
      description: 'Türkiye\'nin başkenti',
      fields: [
        { label: 'Nüfus', value: '5.6 M' },
        { label: 'İl',    value: 'Ankara' },
      ],
    },
  },
  {
    id: 'izmir',
    position: [38.423, 27.143],
    variant: 'info',
    tooltip: {
      title: 'İzmir',
      description: 'Ege\'nin incisi',
      fields: [
        { label: 'Nüfus', value: '4.4 M' },
        { label: 'Liman', value: 'Alsancak' },
      ],
    },
  },
  {
    id: 'bursa',
    position: [40.182, 29.067],
    variant: 'warning',
    tooltip: {
      title: 'Bursa',
      description: 'Yeşil Bursa',
      fields: [
        { label: 'Nüfus', value: '3.1 M' },
      ],
    },
  },
];

const ZONES: MapZone[] = [
  {
    id: 'marmara',
    label: 'Marmara Bölgesi',
    variant: 'primary',
    positions: [
      [41.8, 26.3],
      [41.5, 30.8],
      [40.0, 31.0],
      [39.8, 26.5],
    ],
    fillOpacity: 0.15,
  },
  {
    id: 'ege',
    label: 'Ege Bölgesi',
    variant: 'info',
    positions: [
      [39.8, 26.5],
      [40.0, 31.0],
      [37.5, 30.5],
      [37.2, 26.3],
    ],
    fillOpacity: 0.15,
  },
];

const ROUTES: MapRoute[] = [
  {
    id: 'route-ist-ank',
    label: 'İstanbul → Ankara (TEM)',
    positions: [
      [41.015, 28.979],
      [40.85, 29.9],
      [40.78, 31.2],
      [40.5, 32.0],
      [39.925, 32.836],
    ],
    color: '#3b82f6',
    weight: 3,
  },
  {
    id: 'route-ist-izm',
    label: 'İstanbul → İzmir (E87)',
    positions: [
      [41.015, 28.979],
      [40.5, 27.9],
      [39.9, 27.5],
      [38.9, 27.2],
      [38.423, 27.143],
    ],
    color: '#06b6d4',
    weight: 3,
    dashed: true,
  },
];

// ── demo components ───────────────────────────────────────────────────────────

function FullDemo() {
  const [log, setLog] = useState('—');
  return (
    <div className="w-full space-y-2">
      <MapView
        center={ISTANBUL_CENTER}
        zoom={6}
        markers={CITIES}
        zones={ZONES}
        routes={ROUTES}
        onMarkerClick={(id) => setLog(`Tıklanan: ${id}`)}
        height={420}
      />
      <p className="text-xs text-text-secondary">
        <span className="font-semibold text-text-primary">Son event:</span> {log}
      </p>
    </div>
  );
}

function AddMarkerDemo() {
  const [markers, setMarkers] = useState<MapMarker[]>([
    {
      id: 'default',
      position: [41.015, 28.979],
      variant: 'success',
      tooltip: { title: 'Varsayılan işaretçi', description: '"İşaretçi Ekle" butonuna tıklayın' },
    },
  ]);

  return (
    <div className="w-full space-y-2">
      <MapView
        center={[39.5, 35.0]}
        zoom={5}
        markers={markers}
        height={380}
        onMarkerAdd={(pos) => {
          setMarkers((prev) => [
            ...prev,
            {
              id: `m-${Date.now()}`,
              position: pos,
              variant: 'warning',
              tooltip: {
                title: 'Yeni İşaretçi',
                fields: [
                  { label: 'Enlem',  value: pos[0].toFixed(5) },
                  { label: 'Boylam', value: pos[1].toFixed(5) },
                ],
              },
            },
          ]);
        }}
      />
      <p className="text-xs text-text-secondary">
        Toplam işaretçi: <span className="font-semibold text-text-primary">{markers.length}</span>
      </p>
    </div>
  );
}

function ZonesRoutesDemo() {
  return (
    <MapView
      center={[39.5, 35.0]}
      zoom={5}
      zones={ZONES}
      routes={ROUTES}
      height={380}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const GATEWAYS: MapMarker[] = [
  { id: 'a', position: [41.015, 28.979], variant: 'success', tooltip: { title: 'Gateway 1' } },
  { id: 'b', position: [39.925, 32.836], variant: 'error', tooltip: { title: 'Gateway 2' } },
];

function CanvasDemo({ tiles }: { tiles?: boolean }) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-lg border border-border">
      <MapCanvas
        center={[40.5, 30.5]}
        zoom={6}
        markers={GATEWAYS}
        {...(tiles ? { tiles: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' } } : {})}
        loadingLabel="Loading map…"
      />
    </div>
  );
}

export function buildMapData(): ShowcaseComponent[] {
  return [
    {
      id: 'map-view',
      title: 'MapView',
      category: 'Molecule',
      abbr: 'Mp',
      description:
        'Leaflet-based interactive map. Tooltip-enabled markers, predefined zones (polygon), route lines (polyline), and click-to-add marker mode.',
      filePath: 'modules/ui/MapView/index.tsx',
      sourceCode: `'use client';
import { MapView } from '@/modules/ui/MapView';

<MapView
  center={[39.9, 32.8]}
  zoom={6}
  markers={[
    {
      id: 'ankara',
      position: [39.925, 32.836],
      variant: 'primary',
      tooltip: {
        title: 'Ankara',
        description: 'Türkiye başkenti',
        fields: [{ label: 'Nüfus', value: '5.6 M' }],
      },
    },
  ]}
  zones={[
    {
      id: 'zone-1',
      label: 'İç Anadolu',
      variant: 'success',
      positions: [[40,30],[40,34],[38,34],[38,30]],
    },
  ]}
  routes={[
    {
      id: 'r1',
      label: 'Ankara → İstanbul',
      positions: [[39.9,32.8],[41.0,28.9]],
      color: '#3b82f6',
      weight: 3,
    },
  ]}
  onMarkerAdd={(pos) => console.log(pos)}
  onMarkerClick={(id) => console.log(id)}
  height={480}
/>`,
      variants: [
        {
          title: 'Tam özellik — işaretçi + zone + rota',
          layout: 'stack' as const,
          preview: <FullDemo />,
          code: `<MapView
  center={[41.015, 28.979]}
  zoom={6}
  markers={CITIES}
  zones={ZONES}
  routes={ROUTES}
  onMarkerClick={(id) => console.log(id)}
  height={420}
/>`,
        },
        {
          title: 'Tıkla-ekle işaretçi modu',
          layout: 'stack' as const,
          preview: <AddMarkerDemo />,
          code: `<MapView
  center={[39.5, 35.0]}
  zoom={5}
  markers={markers}
  onMarkerAdd={(pos) => setMarkers(prev => [
    ...prev,
    { id: String(Date.now()), position: pos, variant: 'warning' },
  ])}
  height={380}
/>`,
        },
        {
          title: 'Yalnız zone ve rota',
          layout: 'stack' as const,
          preview: <ZonesRoutesDemo />,
          code: `<MapView
  center={[39.5, 35.0]}
  zoom={5}
  zones={ZONES}
  routes={ROUTES}
  height={380}
/>`,
        },
      ],
    },
    {
      id: 'map-canvas',
      title: 'MapCanvas',
      category: 'Molecule',
      abbr: 'Mc',
      since: '2026-10',
      status: 'beta',
      description:
        'The card-less Leaflet canvas behind MapView: it fills its parent (give the parent a height), takes markers, zones and routes, and draws OpenStreetMap\'s standard tiles by default (darkened in the dark theme). An installation sets its own tile source once with `MapTilesProvider` (URL template, attribution, subdomains, deepest zoom, optional dark URL); one map can still pass its own `tiles` (`tiles.url` + `tiles.attribution`). Use it inside a dashboard tile or panel that already has its own frame; use MapView for a standalone map card.',
      filePath: 'modules/ui/MapView/MapCanvas.tsx',
      relatedTo: ['map-view'],
      designTokens: ['--border', '--surface-raised', '--text-secondary'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['application'], notes: 'Leaflet keyboard navigation (arrows, +/-) stays on; the loading label is announced while the map loads.' },
      sourceCode: `'use client';
import { MapCanvas } from '@/modules/ui/MapView';

<div className="h-72 overflow-hidden rounded-lg border border-border">
  <MapCanvas
    center={[40.5, 30.5]}
    zoom={6}
    markers={[{ id: 'a', position: [41.015, 28.979], variant: 'success', tooltip: { title: 'Gateway 1' } }]}
    tiles={{ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' }}
  />
</div>`,
      variants: [
        {
          title: 'Default tiles',
          layout: 'stack' as const,
          preview: <CanvasDemo />,
          code: `<div className="h-72">\n  <MapCanvas center={[40.5, 30.5]} zoom={6} markers={markers} />\n</div>`,
        },
        {
          title: 'Custom tiles',
          layout: 'stack' as const,
          preview: <CanvasDemo tiles />,
          code: `<div className="h-72">\n  <MapCanvas markers={markers} tiles={{ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' }} />\n</div>`,
        },
      ],
    },
  ];
}
