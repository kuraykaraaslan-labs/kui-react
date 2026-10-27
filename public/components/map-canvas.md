# MapCanvas

- **id:** `map-canvas`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/MapView/MapCanvas.tsx`
- **status:** beta
- **since:** 2026-10

The card-less Leaflet canvas behind MapView: it fills its parent (give the parent a height), takes markers, zones and routes, and draws OpenStreetMap's standard tiles by default (darkened in the dark theme). An installation sets its own tile source once with `MapTilesProvider` (URL template, attribution, subdomains, deepest zoom, optional dark URL); one map can still pass its own `tiles` (`tiles.url` + `tiles.attribution`). Use it inside a dashboard tile or panel that already has its own frame; use MapView for a standalone map card.

## Accessibility

- WCAG: AA
- ARIA patterns: application

Leaflet keyboard navigation (arrows, +/-) stays on; the loading label is announced while the map loads.

## Design tokens consumed

- `--border`
- `--surface-raised`
- `--text-secondary`

## Variants

### Default tiles

```tsx
<div className="h-72">
  <MapCanvas center={[40.5, 30.5]} zoom={6} markers={markers} />
</div>
```

### Custom tiles

```tsx
<div className="h-72">
  <MapCanvas markers={markers} tiles={{ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' }} />
</div>
```

## Full source

```tsx
'use client';
import { MapCanvas } from '@/modules/ui/MapView';

<div className="h-72 overflow-hidden rounded-lg border border-border">
  <MapCanvas
    center={[40.5, 30.5]}
    zoom={6}
    markers={[{ id: 'a', position: [41.015, 28.979], variant: 'success', tooltip: { title: 'Gateway 1' } }]}
    tiles={{ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' }}
  />
</div>
```
