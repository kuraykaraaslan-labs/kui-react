import { useEffect, type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { markerIcon, markerText } from './parts/Marker';
import { ClusteredMarkers, clusterColor, clusterMarkers } from './parts/Cluster';
import { Popup, isInternalHref } from './parts/Popup';
import { VARIANT_HEX, safeMarkerColor, safeMarkerIcon, safeMarkerImage } from './types';
import { LEAFLET_TILES, type LeafletBundle } from './providers/leaflet';
import { OSM_ATTRIBUTION, TILE_REFERRER_POLICY, safeAttribution, safeTileSource, tileSourceTiles } from './tiles';
import { MapTilesProvider, useMapTileSource } from './MapTilesProvider';
import { FocusMarker } from './parts/LeafletCanvas';

describe('marker drawing', () => {
  it('accepts plain colours and tokens, refuses anything that could break out of the HTML', () => {
    expect(safeMarkerColor('#ff0000')).toBe('#ff0000');
    expect(safeMarkerColor('var(--primary)')).toBe('var(--primary)');
    expect(safeMarkerColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    expect(safeMarkerColor('red" onload="x')).toBeUndefined();
    expect(safeMarkerColor('url(x)')).toBeUndefined();
    expect(safeMarkerIcon('fas fa-truck')).toBe('fas fa-truck');
    expect(safeMarkerIcon('fas fa-truck"><img')).toBeUndefined();
  });

  it('draws a pin, a dot or an icon at the requested size and colour', () => {
    const pin = markerIcon({ id: '1', position: [0, 0], color: '#ff0000', size: 32 });
    expect(pin.iconSize).toEqual([32, 48]);
    expect(pin.html).toContain('fill:#ff0000');
    const dot = markerIcon({ id: '1', position: [0, 0], shape: 'dot', color: 'var(--success)' });
    expect(dot.iconSize).toEqual([24, 24]);
    expect(dot.html).toContain('background:var(--success)');
    expect(markerIcon({ id: '1', position: [0, 0], shape: 'icon', icon: 'fas fa-truck' }).html).toContain('class="fas fa-truck"');
    // A bad icon falls back to a dot; a bad colour falls back to the variant.
    expect(markerIcon({ id: '1', position: [0, 0], shape: 'icon', icon: '<script>' }).html).not.toContain('script');
    expect(markerIcon({ id: '1', position: [0, 0], color: '"><x', variant: 'error' }).html).toContain('#ef4444');
  });

  it('clusters markers that overlap in pixels', () => {
    const ms = [
      { id: 'a', position: [0, 0] as [number, number] },
      { id: 'b', position: [0, 10] as [number, number] },
      { id: 'c', position: [0, 500] as [number, number] },
    ];
    const groups = clusterMarkers(ms, ([, lng]) => ({ x: lng, y: 0 }), 40);
    expect(groups.map((g) => g.markers.map((m) => m.id))).toEqual([['a', 'b'], ['c']]);
    expect(groups[0].position).toEqual([0, 5]);
  });

  it('tooltip links only internal paths', () => {
    expect(isInternalHref('/devices/1')).toBe(true);
    expect(isInternalHref('//evil')).toBe(false);
    expect(isInternalHref('https://evil')).toBe(false);
    const { rerender } = render(<Popup tooltip={{ title: 'A', href: '/devices/1', linkLabel: 'Details' }} />);
    expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute('href', '/devices/1');
    rerender(<Popup tooltip={{ title: 'A', href: 'javascript:alert(1)' }} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('draws a circle as a tinted ring in the marker colour', () => {
    const circle = markerIcon({ id: '1', position: [0, 0], shape: 'circle', color: 'var(--warning)', size: 20 });
    expect(circle.iconSize).toEqual([20, 20]);
    expect(circle.html).toContain('border:2px solid var(--warning)');
    expect(circle.html).toContain('color-mix(in srgb, var(--warning) 28%, transparent)');
  });

  it('a cluster takes the colour its markers share, else the primary colour', () => {
    const a = { id: 'a', position: [0, 0] as [number, number], color: 'var(--error)' };
    expect(clusterColor([a, { ...a, id: 'b' }])).toBe('var(--error)');
    expect(clusterColor([a, { id: 'c', position: [0, 0] as [number, number], color: 'var(--success)' }])).toMatch(/var\(--primary/);
    expect(clusterColor([{ id: 'x', position: [0, 0] as [number, number], color: '"><x' }])).toBe('#3b82f6');
  });

  it('tooltip body: a status dot, the description and label / value rows', () => {
    render(<Popup tooltip={{ title: 'Konya', color: 'var(--error)', description: 'Offline', fields: [{ label: 'Devices', value: '10' }] }} />);
    expect(screen.getByText('Konya').previousSibling).toHaveStyle({ background: 'var(--error)' });
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Devices').tagName).toBe('DT');
    expect(screen.getByText('10').tagName).toBe('DD');
  });

  it('the default tiles are OpenStreetMap\'s, keyless, with their attribution, and darkened in the dark theme', () => {
    expect(LEAFLET_TILES.light).toEqual({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTRIBUTION, maxZoom: 19 });
    expect(LEAFLET_TILES.dark).toEqual({ ...LEAFLET_TILES.light, dim: true });
    for (const t of [LEAFLET_TILES.light, LEAFLET_TILES.dark]) expect(t.url).not.toMatch(/cartocdn|apikey/);
    expect(OSM_ATTRIBUTION).toContain('OpenStreetMap</a> contributors');
    // tiles send the page's origin, never its path, even on a no-referrer page (a display link with its token)
    expect(TILE_REFERRER_POLICY).toBe('strict-origin');
  });

  it('a dot carries a short escaped text in its middle; other shapes leave it out', () => {
    const dot = markerIcon({ id: '1', position: [0, 0], shape: 'dot', variant: 'error', size: 30, text: '21' });
    expect(dot.html).toMatch(/display:flex;.*font:600 13px.*>21<\/span>$/);
    expect(dot.html).toContain('text-shadow:');
    expect(markerIcon({ id: '1', position: [0, 0], shape: 'circle', color: 'var(--error)', text: '7' }).html).toContain('color:var(--error)">7</span>');
    expect(markerIcon({ id: '1', position: [0, 0], shape: 'dot' }).html).toMatch(/display:block;.*><\/span>$/);
    expect(markerIcon({ id: '1', position: [0, 0], text: '9' }).html).not.toContain('>9<');
    expect(markerText('<img src=x onerror=alert(1)>')).toBe('&lt;img');
    expect(markerText('12345')).toBe('1234');
    expect(markerText(7)).toBe('7');
    expect(markerText({})).toBe('');
  });

  it('a mixed cluster takes the worst status variant among its markers, so it never hides an alarm', () => {
    const at = [0, 0] as [number, number];
    expect(clusterColor([{ id: 'a', position: at, variant: 'success' }, { id: 'b', position: at, variant: 'warning' }, { id: 'c', position: at, variant: 'error' }])).toBe(VARIANT_HEX.error);
    expect(clusterColor([{ id: 'a', position: at, variant: 'success' }, { id: 'b', position: at, variant: 'info' }])).toBe(VARIANT_HEX.info);
    expect(clusterColor([{ id: 'a', position: at, variant: 'success' }, { id: 'b', position: at, variant: 'neutral' }])).toMatch(/var\(--primary/);
    // a marker with its own colour is not ranked by its variant
    expect(clusterColor([{ id: 'a', position: at, variant: 'error', color: 'rgb(1, 2, 3)' }, { id: 'b', position: at, variant: 'success' }])).toMatch(/var\(--primary/);
  });
});

describe('tile source', () => {
  const SOURCE = { url: 'https://{s}.tiles.example.com/{z}/{x}/{y}.png?key=abc', attribution: '&copy; <a href="https://example.com">Example</a>', subdomains: 'abcd', maxZoom: 18 };

  it('a source without a dark URL is darkened in the dark theme; with one, its dark tiles are used', () => {
    const pair = tileSourceTiles(SOURCE);
    expect(pair.light).toEqual({ url: SOURCE.url, attribution: SOURCE.attribution, subdomains: 'abcd', maxZoom: 18 });
    expect(pair.dark).toEqual({ ...pair.light, dim: true });
    const dark = tileSourceTiles({ ...SOURCE, darkUrl: 'https://dark.example.com/{z}/{x}/{y}.png' }).dark;
    expect(dark.url).toBe('https://dark.example.com/{z}/{x}/{y}.png');
    expect(dark.dim).toBeUndefined();
  });

  it('accepts an https template with {z} {x} {y} and drops what is unusable', () => {
    expect(safeTileSource(SOURCE)).toEqual(SOURCE);
    expect(safeTileSource({ ...SOURCE, url: 'http://tiles.example.com/{z}/{x}/{y}.png' })).toBeUndefined();
    expect(safeTileSource({ ...SOURCE, url: 'https://tiles.example.com/{z}/{x}.png' })).toBeUndefined();
    expect(safeTileSource({ ...SOURCE, url: 'https://tiles.example.com/{z}/{x}/{y}.png" onload="x' })).toBeUndefined();
    expect(safeTileSource({ ...SOURCE, attribution: '  ' })).toBeUndefined();
    expect(safeTileSource(null)).toBeUndefined();
    expect(safeTileSource('https://tiles.example.com/{z}/{x}/{y}.png')).toBeUndefined();
    // a bad optional field is dropped, not fatal
    expect(safeTileSource({ ...SOURCE, subdomains: 'a.b', maxZoom: 40, darkUrl: 'javascript:alert(1)' })).toEqual({ url: SOURCE.url, attribution: SOURCE.attribution });
    expect(safeTileSource({ ...SOURCE, subdomains: ['t0', 't1'], maxZoom: 20 })).toMatchObject({ subdomains: ['t0', 't1'], maxZoom: 20 });
  });

  it('keeps plain https links in the attribution and escapes any other markup', () => {
    expect(safeAttribution('&copy; <a href="https://osm.org/copyright">OSM</a> contributors')).toBe('&copy; <a href="https://osm.org/copyright">OSM</a> contributors');
    expect(safeAttribution('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(safeAttribution('<a href="javascript:alert(1)">x</a>')).toBe('&lt;a href=&quot;javascript:alert(1)&quot;&gt;x&lt;/a&gt;');
    expect(safeAttribution('<a href="https://a.test" onclick="x">a</a>')).not.toContain('<a ');
  });

  it('MapTilesProvider hands maps the checked source, and nothing for an unusable one', () => {
    function Probe() { return <span data-testid="source">{JSON.stringify(useMapTileSource())}</span>; }
    const { rerender } = render(<MapTilesProvider source={SOURCE}><Probe /></MapTilesProvider>);
    expect(JSON.parse(screen.getByTestId('source').textContent!)).toEqual(SOURCE);
    rerender(<MapTilesProvider source={{ url: 'ftp://x/{z}/{x}/{y}', attribution: 'x' }}><Probe /></MapTilesProvider>);
    expect(screen.getByTestId('source').textContent).toBe('null');
    rerender(<Probe />);
    expect(screen.getByTestId('source').textContent).toBe('null');
  });
});

describe('picture markers', () => {
  it('accepts an internal path or an https address and refuses anything that could leave the attribute', () => {
    expect(safeMarkerImage('/files/pump.svg')).toBe('/files/pump.svg');
    expect(safeMarkerImage('https://example.com/a.png')).toBe('https://example.com/a.png');
    for (const bad of ['//evil.test/a.png', 'http://example.com/a.png', 'javascript:alert(1)', '/a.png"onerror="x', '/a b.png', '/a<b.png', '/a\\b.png', 'data:image/png;base64,AA==', '']) {
      expect(safeMarkerImage(bad), bad).toBeUndefined();
    }
  });

  it('draws the picture at the requested size, and a dot when the address is not safe', () => {
    const ok = markerIcon({ id: '1', position: [0, 0], shape: 'image', image: '/files/pump.svg', size: 30 });
    expect(ok.html).toContain('<img src="/files/pump.svg"');
    expect(ok.iconSize).toEqual([30, 30]);
    const bad = markerIcon({ id: '1', position: [0, 0], shape: 'image', image: 'javascript:alert(1)', color: '#ff0000' });
    expect(bad.html).not.toContain('<img');
    expect(bad.html).toContain('background:#ff0000');
  });
});

describe('ClusteredMarkers zoom', () => {
  // A stand-in map: one pixel per degree at zoom 0, doubling with each zoom level.
  function fakeMap(zoom: number) {
    const listeners = new Set<() => void>();
    return {
      zoom,
      getZoom() { return this.zoom; },
      project: (p: [number, number], z: number) => ({ x: p[1] * 2 ** z, y: p[0] * 2 ** z }),
      on: (_: string, fn: () => void) => { listeners.add(fn); },
      off: (_: string, fn: () => void) => { listeners.delete(fn); },
      zoomTo(z: number) { this.zoom = z; listeners.forEach((fn) => fn()); },
    };
  }
  const bundleOf = (map: ReturnType<typeof fakeMap>) => ({
    useMap: () => map,
    Marker: ({ alt, icon, children }: { alt?: string; icon?: { html?: string }; children?: ReactNode }) => <div data-testid="marker" data-alt={alt} data-html={icon?.html}>{children}</div>,
    Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Popup: ({ children }: { children?: ReactNode }) => <>{children}</>,
    L: { divIcon: (o: object) => o },
  }) as unknown as LeafletBundle;
  // Seven sites a degree apart: one group at zoom 2 (4 px apart), seven markers at zoom 8 (256 px apart).
  const sites = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, position: [39, 27 + i] as [number, number], label: `Site ${i}` }));

  it('groups at the zoom the first fit left, though that zoomend fired before it listened', () => {
    const map = fakeMap(2);
    // The canvas's fit runs in an effect of an earlier sibling, before the markers subscribe.
    function FitFirst() { useEffect(() => { map.zoomTo(8); }, []); return null; }
    render(<><FitFirst /><ClusteredMarkers bundle={bundleOf(map)} markers={sites} /></>);
    expect(screen.getAllByTestId('marker')).toHaveLength(7);
  });

  it('a bubble says what clusterText makes of its markers (escaped), else how many it holds', () => {
    const map = fakeMap(2);
    const { rerender } = render(<ClusteredMarkers bundle={bundleOf(map)} markers={sites} text={(ms) => String(ms.length * 3)} />);
    expect(screen.getByTestId('marker')).toHaveAttribute('data-html', expect.stringContaining('>21</span>'));
    rerender(<ClusteredMarkers bundle={bundleOf(map)} markers={sites} text={() => '<b>'} />);
    expect(screen.getByTestId('marker').getAttribute('data-html')).toContain('>&lt;b&gt;</span>');
    rerender(<ClusteredMarkers bundle={bundleOf(map)} markers={sites} />);
    expect(screen.getByTestId('marker')).toHaveAttribute('data-html', expect.stringContaining('>7</span>'));
  });

  it('regroups on every zoomend after that', () => {
    const map = fakeMap(8);
    render(<ClusteredMarkers bundle={bundleOf(map)} markers={sites} />);
    expect(screen.getAllByTestId('marker')).toHaveLength(7);
    act(() => map.zoomTo(2));
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    expect(screen.getByTestId('marker')).toHaveAttribute('data-alt', '7 markers, zoom in');
  });
});

describe('FocusMarker', () => {
  const places = [{ id: 'a', position: [40, 30] as [number, number] }, { id: 'b', position: [41, 31] as [number, number] }];
  const mapAt = (zoom: number) => ({ getZoom: () => zoom, getMaxZoom: () => 20, flyTo: vi.fn(), setView: vi.fn() });
  const bundleOf = (map: ReturnType<typeof mapAt>) => ({ useMap: () => map }) as unknown as LeafletBundle;

  it('flies to the asked marker, never zooming out, and only on a new request', () => {
    const map = mapAt(6);
    const { rerender } = render(<FocusMarker bundle={bundleOf(map)} markers={places} focus={null} zoom={13} />);
    expect(map.flyTo).not.toHaveBeenCalled();
    rerender(<FocusMarker bundle={bundleOf(map)} markers={places} focus={{ id: 'b', seq: 1 }} zoom={13} />);
    expect(map.flyTo).toHaveBeenCalledWith([41, 31], 13, { duration: 0.6 });
    // the markers re-render with new positions: the view is not pulled back
    rerender(<FocusMarker bundle={bundleOf(map)} markers={[...places]} focus={{ id: 'b', seq: 1 }} zoom={13} />);
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    // the same marker asked for again
    rerender(<FocusMarker bundle={bundleOf(map)} markers={places} focus={{ id: 'b', seq: 2 }} zoom={13} />);
    expect(map.flyTo).toHaveBeenCalledTimes(2);
  });

  it('keeps a closer zoom the reader chose, ignores an unknown id, and jumps when motion is reduced', () => {
    const close = mapAt(16);
    const { rerender } = render(<FocusMarker bundle={bundleOf(close)} markers={places} focus={{ id: 'a', seq: 1 }} zoom={13} />);
    expect(close.flyTo).toHaveBeenCalledWith([40, 30], 16, { duration: 0.6 });
    rerender(<FocusMarker bundle={bundleOf(close)} markers={places} focus={{ id: 'nope', seq: 2 }} zoom={13} />);
    expect(close.flyTo).toHaveBeenCalledTimes(1);
    const still = mapAt(6);
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q })) as typeof window.matchMedia;
    try {
      render(<FocusMarker bundle={bundleOf(still)} markers={places} focus={{ id: 'a', seq: 1 }} zoom={13} />);
    } finally { window.matchMedia = original; }
    expect(still.setView).toHaveBeenCalledWith([40, 30], 13, { animate: false });
    expect(still.flyTo).not.toHaveBeenCalled();
  });
});
