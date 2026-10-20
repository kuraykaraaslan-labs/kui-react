import { describe, it, expect } from 'vitest';
import { readPositions, buildZones, buildRoutes, MAP_VIEW } from '../views/MapView';
import { MAP, MAP_KIND } from '../templates/map';
import { prepareForSave } from '../settings/engine';

const table = (rows: Array<Record<string, unknown>>) => ({ shape: 'table' as const, rows });
const square = [[41, 29], [41, 29.1], [41.1, 29.1], [41.1, 29]];

describe('map zones and routes (next-boilerplate 20.3d)', () => {
  it('reads [lat, lng] lists from arrays or JSON text, and refuses anything else', () => {
    expect(readPositions(square)).toEqual(square);
    expect(readPositions(JSON.stringify(square))).toEqual(square);
    expect(readPositions('not json')).toBeNull();
    expect(readPositions([[91, 0]])).toBeNull();
    expect(readPositions([[1]])).toBeNull();
    expect(readPositions({})).toBeNull();
  });

  it('builds zones with a name, a colour from a column (or the fixed one) and the opacity; skips rows under three corners', () => {
    const zones = buildZones(table([
      { id: 'z1', name: 'Plant', positions: square, state: 'warning' },
      { id: 'z2', positions: JSON.stringify(square), state: 'purple' },
      { id: 'z3', positions: [[41, 29], [41.1, 29]] },
    ]), { zoneVariant: 'success', zoneVariantColumn: 'state', zoneOpacity: 0.4 });
    expect(zones).toEqual([
      { id: 'z1', positions: square, fillOpacity: 0.4, variant: 'warning', label: 'Plant' },
      { id: 'z2', positions: square, fillOpacity: 0.4, variant: 'success' },
    ]);
  });

  it('builds routes with colour, width and dashes; skips rows under two points', () => {
    const routes = buildRoutes(table([
      { id: 'r1', name: 'Line 1', positions: [[41, 29], [41.05, 29.05]] },
      { id: 'r2', positions: [[41, 29]] },
    ]), { routeColor: '#ff0000', routeWeight: 5, routeDashed: true });
    expect(routes).toEqual([{ id: 'r1', positions: [[41, 29], [41.05, 29.05]], color: '#ff0000', weight: 5, dashed: true, label: 'Line 1' }]);
  });

  it('a map with only zones or only routes is not empty', () => {
    const none = table([]);
    expect(MAP_VIEW.isEmpty!({ points: none }, {})).toBe(true);
    expect(MAP_VIEW.isEmpty!({ points: none, zones: table([{ positions: square }]) }, {})).toBe(false);
    expect(MAP_VIEW.isEmpty!({ points: none, routes: table([{ positions: [[41, 29], [41.1, 29]] }]) }, {})).toBe(false);
  });

  it('the kind offers the two optional slots, and the settings validate', () => {
    expect(MAP_KIND.slots.map((s) => [s.key, s.required])).toEqual([['points', true], ['zones', false], ['routes', false], ['image', false]]);
    const ok = prepareForSave({ zoneVariant: 'error', zoneOpacity: 0.5, routeWeight: 4, routeDashed: true }, { type: MAP });
    expect(ok.issues).toEqual([]);
    expect(prepareForSave({ zoneVariant: 'purple' }, { type: MAP }).issues.length).toBeGreaterThan(0);
    expect(prepareForSave({ zoneOpacity: 2 }, { type: MAP }).issues.length).toBeGreaterThan(0);
  });
});

describe('image (floor-plan) map (next-boilerplate 20.3d)', () => {
  const image = { mapKind: 'image', imageSrc: '/files/floor-1.png', imageWidth: 1200, imageHeight: 800 };

  it('takes an internal or https picture with its size; anything else is no image', async () => {
    const { mapImage } = await import('../views/MapView');
    expect(mapImage(image)).toEqual({ url: '/files/floor-1.png', width: 1200, height: 800 });
    expect(mapImage({ ...image, imageSrc: 'https://cdn.example.com/a.png' })?.url).toBe('https://cdn.example.com/a.png');
    expect(mapImage({ ...image, imageSrc: 'javascript:alert(1)' })).toBeNull();
    expect(mapImage({ ...image, imageSrc: '//evil.example/a.png' })).toBeNull();
    expect(mapImage({ ...image, imageWidth: null })).toBeNull();
    expect(mapImage({ mapKind: 'geo', imageSrc: '/a.png', imageWidth: 1, imageHeight: 1 })).toBeNull();
    expect(mapImage(image, (u) => `/t/abc${u}`)?.url).toBe('/t/abc/files/floor-1.png');
  });

  it('point columns are pixels inside the picture: outside ones are skipped, and a bare picture is not empty', async () => {
    const { buildMarkers, mapImage } = await import('../views/MapView');
    const rows = table([{ lat: 100, lng: 900, label: 'Desk' }, { lat: 900, lng: 100, label: 'Outside' }]);
    expect(buildMarkers(rows, { ...image, latColumn: 'lat', lngColumn: 'lng' }, undefined, mapImage(image)).markers.map((m) => m.position)).toEqual([[100, 900]]);
    expect(buildZones(table([{ positions: [[10, 10], [10, 300], [200, 300]] }]), {}, mapImage(image))).toHaveLength(1);
    expect(MAP_VIEW.isEmpty!({ points: table([]) }, image)).toBe(false);
  });

  it('an image map needs its picture and size', () => {
    expect(prepareForSave({ mapKind: 'image', imageSrc: '/a.png' }, { type: MAP }).issues.map((i) => i.path)).toContain('imageSrc');
    expect(prepareForSave(image, { type: MAP }).issues).toEqual([]);
  });
});
