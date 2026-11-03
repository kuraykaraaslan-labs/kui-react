import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { faBed } from '@fortawesome/free-solid-svg-icons';
import { ListingCards, isClosedStatus } from './ListingCards';

afterEach(cleanup);

describe('ListingCards', () => {
  it('knows a closed status in English and Turkish', () => {
    expect(isClosedStatus('Sold')).toBe(true);
    expect(isClosedStatus(' kiralandı ')).toBe(true);
    expect(isClosedStatus('For sale')).toBe(false);
  });

  it('renders each listing with price, period, location, facts, marks and a named link', () => {
    render(
      <ListingCards
        title="Listings"
        listings={[
          { title: 'Sea-view flat', price: '₺4,250,000', location: 'Karşıyaka', status: 'For sale', facts: [{ icon: faBed, text: '3 bedrooms' }], imageUrl: '/a.jpg', imageAlt: 'Living room', marks: ['3D'], href: '/l/1' },
          { title: 'Double room', price: '€89', period: '/ night' },
          { title: 'Garden house', status: 'Sold' },
          { title: '' },
        ]}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Sea-view flat', 'Double room', 'Garden house']);
    expect(screen.getByText('/ night')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Living room' })).toHaveAttribute('src', '/a.jpg');
    expect(screen.getByText('3D')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details: Sea-view flat' })).toHaveAttribute('href', '/l/1');
    expect(screen.getByText('Sold').closest('li')?.className).toContain('opacity-70');
    expect(screen.getByText('3 bedrooms')).toBeInTheDocument();
  });

  it('a listing can be closed whatever its status says', () => {
    render(<ListingCards listings={[{ title: 'Suite', status: 'Full this week', closed: true }]} />);
    expect(screen.getByText('Full this week').closest('li')?.className).toContain('opacity-70');
  });

  it('renders nothing without listings', () => {
    const { container } = render(<ListingCards listings={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
