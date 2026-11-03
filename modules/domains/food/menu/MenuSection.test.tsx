import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MenuSection } from './MenuSection';

afterEach(cleanup);

const items = [
  { name: 'Lentil soup', description: 'Red lentils', price: '₺160', tags: ['vegetarian' as const] },
  { name: 'Halloumi', price: '₺240', tags: ['vegan' as const, 'spicy' as const], imageUrl: 'https://cdn.test/h.jpg', imageAlt: 'Halloumi' },
];

describe('MenuSection', () => {
  it('names the section and lists each item with its price and tags', () => {
    render(<MenuSection title="Starters" items={items} />);
    const section = screen.getByRole('region', { name: 'Starters' });
    expect(within(section).getByRole('heading', { name: 'Starters' })).toBeInTheDocument();
    expect(within(section).getByText('₺160')).toBeInTheDocument();
    expect(within(section).getByText('Vegetarian')).toBeInTheDocument();
    expect(within(section).getAllByRole('list', { name: 'Notes' })).toHaveLength(2);
  });

  it('cards show the photo; the list layout does not', () => {
    render(<MenuSection items={items} layout="cards" />);
    expect(screen.getByRole('img', { name: 'Halloumi' })).toHaveAttribute('src', 'https://cdn.test/h.jpg');
    cleanup();
    render(<MenuSection items={items} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('takes tag names in another language', () => {
    render(<MenuSection items={items} tagLabels={{ vegan: 'Vegan', spicy: 'Acılı' }} tagsLabel="Notlar" />);
    expect(screen.getByText('Acılı')).toBeInTheDocument();
    expect(screen.getAllByRole('list', { name: 'Notlar' })).toHaveLength(2);
  });
});
