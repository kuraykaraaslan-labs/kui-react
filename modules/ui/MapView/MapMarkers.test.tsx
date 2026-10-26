import { useEffect, type ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { markerIcon } from './parts/Marker';
import { ClusteredMarkers, clusterColor, clusterMarkers } from './parts/Cluster';
import { Popup, isInternalHref } from './parts/Popup';
import { safeMarkerColor, safeMarkerIcon, safeMarkerImage } from './types';
import { LEAFLET_TILES, type LeafletBundle } from './providers/leaflet';

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

  it('the default tiles need no API key and come with a place-name layer', () => {
    for (const t of [LEAFLET_TILES.light, LEAFLET_TILES.dark]) {
      expect(t.url).not.toMatch(/cartocdn/);
      expect(t.labels).toMatch(/Reference/);
    }
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
    Marker: ({ alt, children }: { alt?: string; children?: ReactNode }) => <div data-testid="marker" data-alt={alt}>{children}</div>,
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

  it('regroups on every zoomend after that', () => {
    const map = fakeMap(8);
    render(<ClusteredMarkers bundle={bundleOf(map)} markers={sites} />);
    expect(screen.getAllByTestId('marker')).toHaveLength(7);
    act(() => map.zoomTo(2));
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    expect(screen.getByTestId('marker')).toHaveAttribute('data-alt', '7 markers, zoom in');
  });
});
