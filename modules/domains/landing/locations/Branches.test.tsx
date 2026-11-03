import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

const seen: Array<Record<string, unknown>> = [];
vi.mock('@/modules/ui/MapView/MapCanvas', () => ({ MapCanvas: (p: Record<string, unknown>) => { seen.push(p); return <div data-testid="map" />; } }));

import { Branches, directionsHref } from './Branches';

afterEach(() => { cleanup(); seen.length = 0; });

const B = [
  { name: 'Centre', address: 'Main St 1', phone: '+44 (20) 7946 0000', hours: ['Mon–Fri 09:00–18:00'], position: [51.5, -0.12] as [number, number] },
  { name: 'Airport', address: 'Terminal 2', position: [51.47, -0.45] as [number, number] },
  { name: 'Station', address: 'Station Rd' },
];

describe('Branches', () => {
  it('links directions to the pin, else to the address', () => {
    expect(directionsHref(B[0])).toContain('openstreetmap.org/?mlat=51.5');
    expect(directionsHref(B[2])).toContain('google.com/maps/search');
    expect(directionsHref({ name: 'x' })).toBeUndefined();
  });

  it('puts every branch with a position on one map, the chosen one highlighted, and follows the cards', () => {
    render(<Branches title="Branches" branches={B} />);
    expect(screen.getByRole('link', { name: '+44 (20) 7946 0000' })).toHaveAttribute('href', 'tel:+442079460000');
    let last = seen.at(-1)!;
    expect((last.markers as Array<{ id: string; variant: string }>).map((m) => [m.id, m.variant])).toEqual([['0', 'primary'], ['1', 'neutral']]);
    fireEvent.click(screen.getByRole('button', { name: 'Airport' }));
    last = seen.at(-1)!;
    expect(screen.getByRole('button', { name: 'Airport' })).toHaveAttribute('aria-pressed', 'true');
    expect((last.focus as { id: string }).id).toBe('1');
    expect(seen[0].focus).toBeNull();
    act(() => { (last.onMarkerClick as (id: string) => void)('0'); });
    expect(screen.getByRole('button', { name: 'Centre' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('without positions or with the map off, names are headings and there is no map', () => {
    render(<Branches branches={[{ name: 'Only', address: 'x' }]} labels={{ directions: 'Yol tarifi' }} />);
    expect(screen.queryByTestId('map')).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Only' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Yol tarifi/ })).toBeInTheDocument();
  });
});
