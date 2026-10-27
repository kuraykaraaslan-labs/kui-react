import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const seen = vi.hoisted(() => ({ props: null as null | Record<string, any> }));
vi.mock('@/modules/ui/MapView', async (orig) => ({
  ...(await orig<typeof import('@/modules/ui/MapView')>()),
  MapCanvas: (p: Record<string, unknown>) => { seen.props = p; return <div role="region" aria-label="map" />; },
}));

import { MapWidgetView } from '../views/MapView';
import { MapTilesProvider } from '@/modules/ui/MapView/MapTilesProvider';
import { MAP } from '../templates/map';
import { effective } from '../settings/engine';
import { DEFAULT_WIDGET_KIT_MESSAGES } from '../messages';
import {
  TILE_PRESETS, buildMarkers, mapImage, mapModel, readTimes, replayAt, replayMarkers, replayModel, replayRoutes,
} from '../views/map-logic';

const table = (rows: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => ({ shape: 'table' as const, rows, ...extra });
const settings = (over: Record<string, unknown> = {}) => effective(MAP, over);
const input = { messages: { map: DEFAULT_WIDGET_KIT_MESSAGES.map, common: DEFAULT_WIDGET_KIT_MESSAGES.common } };

beforeEach(() => { seen.props = null; });

describe('a picture or glyph per status (25.1)', () => {
  const rows = table([
    { lat: 41, lng: 29, status: 'Alarm' }, { lat: 41.1, lng: 29, status: 'Ok' }, { lat: 41.2, lng: 29, status: 'Idle' },
  ]);
  const valueColors = [
    { value: 'Alarm', color: 'var(--error)', image: '/files/alarm.svg' },
    { value: 'Ok', color: 'var(--success)', icon: 'fas fa-check' },
    { value: 'Idle', color: 'var(--warning)', image: 'javascript:alert(1)' },
  ];

  it('draws the status\'s picture, else its glyph, else the marker style; an unsafe address is ignored', () => {
    const { markers } = buildMarkers(rows, settings({ colorBy: 'column', colorColumn: 'status', valueColors, markerStyle: 'dot' }));
    expect(markers.map((m) => m.shape)).toEqual(['image', 'icon', 'dot']);
    expect(markers[0].image).toBe('/files/alarm.svg');
    expect(markers[1].icon).toBe('fas fa-check');
    expect(markers[2].image).toBeUndefined();
    expect(markers.map((m) => m.color)).toEqual(['var(--error)', 'var(--success)', 'var(--warning)']);
  });

  it('takes the picture from the source\'s value map when the placement names none', () => {
    const slot = table([{ lat: 41, lng: 29, status: 'Alarm' }], {
      columns: [{ key: 'status', label: 'Status', type: 'text', valueMap: { Alarm: { label: 'Alarm', color: 'var(--error)', image: '/files/alarm.svg' } } }],
    });
    const { markers } = buildMarkers(slot, settings({ colorBy: 'column', colorColumn: 'status' }));
    expect(markers[0]).toMatchObject({ shape: 'image', image: '/files/alarm.svg' });
  });

  it('rewrites an internal picture address through the host', () => {
    const { markers } = buildMarkers(rows, settings({ colorBy: 'column', colorColumn: 'status', valueColors }), 'en', null, {}, { resolveUrl: (u) => `/t/acme${u}` });
    expect(markers[0].image).toBe('/t/acme/files/alarm.svg');
  });
});

describe('satellite imagery (25.4)', () => {
  it('offers a keyless satellite style with place names, and a host\'s own provider wins', () => {
    expect(TILE_PRESETS.satellite).toMatchObject({ url: expect.stringContaining('World_Imagery'), labels: expect.stringContaining('World_Boundaries_and_Places') });
    const own = { url: 'https://tiles.example.com/{z}/{x}/{y}.jpg', attribution: 'Example' };
    const off = mapModel(settings({ tileStyle: 'satellite' }), { points: table([]) }, 'en', input);
    const on = mapModel(settings({ tileStyle: 'satellite' }), { points: table([]) }, 'en', { ...input, imagery: own });
    expect(off.canvas.tiles).toBe(TILE_PRESETS.satellite);
    expect(on.canvas.tiles).toBe(own);
    // The "theme" style does not use the imagery provider.
    expect(mapModel(settings(), { points: table([]) }, 'en', { ...input, imagery: own }).canvas.tiles).not.toBe(own);
  });
});

describe('the installation\'s tile source', () => {
  const source = { url: 'https://tiles.example.com/{z}/{x}/{y}.png', attribution: 'Example' };

  it('"Follow the theme" draws the MapTilesProvider source (darkened in the dark theme); the host\'s tiles and the other styles win', () => {
    const view = (over: Record<string, unknown> = {}, tiles?: { url: string; attribution: string }) => (
      <MapTilesProvider source={source}>
        <MapWidgetView settings={settings(over)} format={{}} data={{ points: table([]) }} {...(tiles ? { tiles } : {})} />
      </MapTilesProvider>
    );
    const { rerender } = render(view());
    expect(seen.props!.tiles).toEqual({ light: source, dark: { ...source, dim: true } });
    rerender(view({ tileStyle: 'streets' }));
    expect(seen.props!.tiles).toBe(TILE_PRESETS.streets);
    const own = { url: 'https://own.example.com/{z}/{x}/{y}.png', attribution: 'Own' };
    rerender(view({}, own));
    expect(seen.props!.tiles).toBe(own);
  });

  it('without a source "Follow the theme" keeps its quiet basemap', () => {
    render(<MapWidgetView settings={settings()} format={{}} data={{ points: table([]) }} />);
    expect(seen.props!.tiles).toBe(TILE_PRESETS.auto);
  });
});

describe('a floor plan from the source, dragged markers (25.5)', () => {
  const plan = { mapKind: 'image', imageSrc: '/files/typed.png', imageWidth: 1200, imageHeight: 800 };

  it('a bound address wins over the typed one, and only an image map has one', () => {
    expect(mapImage(settings(plan))?.url).toBe('/files/typed.png');
    expect(mapImage(settings(plan), undefined, '/files/from-attribute.png')?.url).toBe('/files/from-attribute.png');
    expect(mapImage(settings(plan), undefined, 'javascript:alert(1)')).toBeNull();
    expect(mapImage(settings({ mapKind: 'geo' }), undefined, '/files/x.png')).toBeNull();
  });

  it('markers can be dragged only on an image map, with the setting on and a host that can write', () => {
    const data = { points: table([{ lat: 100, lng: 200, label: 'A' }]) };
    const moving = (over: Record<string, unknown>, movable: boolean) => mapModel(settings({ ...plan, draggable: true, ...over }), data, 'en', { ...input, movable });
    expect(moving({}, true).markers[0].draggable).toBe(true);
    expect(moving({}, true).movable).toBe(true);
    expect(moving({}, false).markers[0].draggable).toBeUndefined();
    expect(moving({ draggable: false }, true).markers[0].draggable).toBeUndefined();
    expect(moving({ mapKind: 'geo', lat: 1 }, true).markers[0]?.draggable).toBeUndefined();
  });

  it('a drop is sent to the placement\'s command as { id, x, y }; without a command nothing is draggable', async () => {
    const data = { points: table([{ id: 'p1', lat: 100, lng: 200, label: 'A' }]) };
    const onControl = vi.fn().mockResolvedValue(undefined);
    const props = { settings: settings({ ...plan, draggable: true, idColumn: 'id' }), format: {}, data };
    const { rerender } = render(<MapWidgetView {...props} onControl={onControl} />);
    expect(seen.props!.markers[0].draggable).toBe(true);
    await act(async () => { seen.props!.onMarkerMove('p1', [321, 654]); });
    expect(onControl).toHaveBeenCalledWith({ kind: 'set', value: { id: 'p1', x: 654, y: 321 } });
    await act(async () => { seen.props!.onMarkerMove('nope', [1, 2]); });
    expect(onControl).toHaveBeenCalledTimes(1);
    rerender(<MapWidgetView {...props} />);
    expect(seen.props!.markers[0].draggable).toBeUndefined();
    expect(seen.props!.onMarkerMove).toBeUndefined();
    rerender(<MapWidgetView {...props} onControl={onControl} controlDisabledReason="Not allowed" />);
    expect(seen.props!.markers[0].draggable).toBeUndefined();
  });
});

describe('route replay (25.6)', () => {
  const timed = [[41, 29, '2026-10-20T10:00:00Z'], [41, 29.1, '2026-10-20T10:10:00Z'], [41.1, 29.1, '2026-10-20T10:30:00Z']];
  const plain = [[0, 0], [0, 10], [10, 10]];
  const slot = (positions: unknown) => table([{ id: 'r1', name: 'Truck 7', positions }]);

  it('reads a time per point only when every point has one and none goes back', () => {
    expect(readTimes(timed)).toEqual([Date.parse('2026-10-20T10:00:00Z'), Date.parse('2026-10-20T10:10:00Z'), Date.parse('2026-10-20T10:30:00Z')]);
    expect(readTimes(JSON.stringify(timed))).not.toBeNull();
    expect(readTimes(plain)).toBeNull();
    expect(readTimes([[1, 2, 100], [1, 3, 50]])).toBeNull();
    expect(readTimes([[1, 2, 1_700_000_000], [1, 3, 1_700_000_100]])).toEqual([1_700_000_000_000, 1_700_000_100_000]);
  });

  it('replays a route with times along the clock, and one without at an even pace', () => {
    const [t] = replayRoutes(slot(timed), settings());
    expect(replayAt(t, 0).position).toEqual([41, 29]);
    expect(replayAt(t, 1).position).toEqual([41.1, 29.1]);
    // 10 of 30 minutes in: exactly the second point.
    expect(replayAt(t, 1 / 3).position).toEqual([41, 29.1]);
    expect(replayAt(t, 1 / 3).time).toBe(Date.parse('2026-10-20T10:10:00Z'));
    const [p] = replayRoutes(slot(plain), settings({ mapKind: 'image' }), { url: '/x.png', width: 100, height: 100 });
    expect(p.total).toBe(20);
    expect(replayAt(p, 0.5).position).toEqual([0, 10]);
    expect(replayAt(p, 0.75).position).toEqual([5, 10]);
    expect(replayAt(p, 0.5).time).toBeNull();
    // Out of range progress is clamped.
    expect(replayAt(p, 7).position).toEqual([10, 10]);
    expect(replayAt(p, -1).position).toEqual([0, 0]);
  });

  it('adds a start, an end and a moving marker per route, none of them rows', () => {
    const routes = replayRoutes(slot(timed), settings());
    const ms = replayMarkers(routes, 0.5, { start: 'Start', end: 'End' }, (ms) => `t${ms}`);
    expect(ms.map((m) => m.id)).toEqual(['replay:r1:start', 'replay:r1:end', 'replay:r1:now']);
    expect(ms[0].tooltip?.title).toBe('Truck 7 · Start');
    expect(ms[2].tooltip?.title).toMatch(/^t\d+$/);
    expect(replayMarkers(replayRoutes(slot(plain), settings()), 0.5, { start: 'Start', end: 'End' })[2].tooltip).toBeUndefined();
  });

  it('is on only when the setting is, and when a route is valid', () => {
    expect(replayModel(slot(timed), settings(), null).enabled).toBe(false);
    expect(replayModel(slot(timed), settings({ replay: true }), null).enabled).toBe(true);
    expect(replayModel(slot([[1, 2]]), settings({ replay: true }), null).enabled).toBe(false);
    expect(replayModel(slot(timed), settings({ replay: true, replaySpeed: '5' }), null).speed).toBe(5);
    expect(replayModel(slot(timed), settings({ replay: true, replaySpeed: '7' }), null).speed).toBe(1);
    expect(replayModel(slot(timed), settings({ replay: true }), null).timeSpan).toEqual({ from: Date.parse('2026-10-20T10:00:00Z'), to: Date.parse('2026-10-20T10:30:00Z') });
    expect(replayModel(slot(plain), settings({ replay: true }), null).timeSpan).toBeNull();
  });

  describe('the controls', () => {
    beforeEach(() => { vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] }); });
    afterEach(() => { vi.useRealTimers(); });
    const view = () => render(<MapWidgetView settings={settings({ replay: true })} format={{}} data={{ points: table([]), routes: slot(timed) }} />);

    it('plays, pauses and scrubs; the moving marker follows', () => {
      view();
      const group = screen.getByRole('group', { name: 'Route replay' });
      expect(group).toBeInTheDocument();
      const now = () => seen.props!.markers.find((m: { id: string }) => m.id === 'replay:r1:now').position;
      expect(now()).toEqual([41, 29]);
      const slider = screen.getByRole('slider', { name: 'Position on the route' }) as HTMLInputElement;
      fireEvent.change(slider, { target: { value: '1000' } });
      expect(now()).toEqual([41.1, 29.1]);
      fireEvent.change(slider, { target: { value: '0' } });
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(Number(slider.value)).toBeGreaterThan(200);
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      const held = slider.value;
      act(() => { vi.advanceTimersByTime(5_000); });
      expect(slider.value).toBe(held);
    });

    it('speeds up, and shows no controls when the replay is off', () => {
      view();
      expect(screen.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: '10×' }));
      expect(screen.getByRole('button', { name: '10×' })).toHaveAttribute('aria-pressed', 'true');
      render(<MapWidgetView settings={settings()} format={{}} data={{ points: table([]), routes: slot(timed) }} />);
      expect(screen.getAllByRole('group', { name: 'Route replay' })).toHaveLength(1);
    });
  });
});
