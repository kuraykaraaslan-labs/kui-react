import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MapTilesProvider } from '@/modules/ui/MapView/MapTilesProvider';
import { TILE_REFERRER_POLICY } from '@/modules/ui/MapView/tiles';
import { DIM_TILES_CLASS } from '@/modules/ui/MapView/parts/styles';
import VenueLeafletMap from './VenueLeafletMap';

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet', () => ({ default: { icon: (o: object) => o } }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TileLayer: (p: { url: string; attribution?: string; referrerPolicy?: string; className?: string }) => (
    <span data-testid="tiles" data-url={p.url} data-attribution={p.attribution} data-referrer={p.referrerPolicy} data-class={p.className ?? ''} />
  ),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useMap: () => ({ setView: () => undefined }),
}));

describe('VenueLeafletMap tiles', () => {
  afterEach(() => document.documentElement.classList.remove('dark'));

  it("draws OpenStreetMap by default, the installation's source under MapTilesProvider, with the origin-only referrer", () => {
    const { rerender } = render(<VenueLeafletMap lat={41} lng={29} name="Hall" />);
    expect(screen.getByTestId('tiles')).toHaveAttribute('data-url', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(screen.getByTestId('tiles')).toHaveAttribute('data-referrer', TILE_REFERRER_POLICY);
    const source = { url: 'https://tiles.example.com/{z}/{x}/{y}.png?key=abc', attribution: 'Example' };
    rerender(<MapTilesProvider source={source}><VenueLeafletMap lat={41} lng={29} name="Hall" /></MapTilesProvider>);
    expect(screen.getByTestId('tiles')).toHaveAttribute('data-url', source.url);
    expect(screen.getByTestId('tiles')).toHaveAttribute('data-attribution', 'Example');
    expect(screen.getByTestId('tiles')).toHaveAttribute('data-class', '');
  });

  it('darkens the light tiles in the dark theme, or draws the dark URL when the source has one', async () => {
    document.documentElement.classList.add('dark');
    const source = { url: 'https://tiles.example.com/{z}/{x}/{y}.png', attribution: 'Example' };
    const { rerender } = render(<MapTilesProvider source={source}><VenueLeafletMap lat={41} lng={29} name="Hall" /></MapTilesProvider>);
    await act(async () => undefined);
    expect(screen.getByTestId('tiles')).toHaveAttribute('data-class', DIM_TILES_CLASS);
    rerender(<MapTilesProvider source={{ ...source, darkUrl: 'https://dark.example.com/{z}/{x}/{y}.png' }}><VenueLeafletMap lat={41} lng={29} name="Hall" /></MapTilesProvider>);
    expect(screen.getByTestId('tiles')).toHaveAttribute('data-url', 'https://dark.example.com/{z}/{x}/{y}.png');
    expect(screen.getByTestId('tiles')).toHaveAttribute('data-class', '');
  });
});
