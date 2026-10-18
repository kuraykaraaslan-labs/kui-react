import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumb } from './Breadcrumb';

const items = [
  { label: 'Home', href: '/' },
  { label: 'Users', href: '/users' },
  { label: 'Settings' },
];

describe('Breadcrumb', () => {
  it('renders plain anchors and the default landmark name', () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home.tagName).toBe('A');
    expect(home).toHaveAttribute('href', '/');
    expect(home).toHaveClass('text-text-secondary', 'focus-visible:ring-2');
    expect(screen.getByText('Settings')).toHaveAttribute('aria-current', 'page');
  });

  it('names the landmark with ariaLabel', () => {
    render(<Breadcrumb items={items} ariaLabel="Page trail" />);
    expect(screen.getByRole('navigation', { name: 'Page trail' })).toBeInTheDocument();
  });

  it('hands each linked item and the link class to renderLink', () => {
    const renderLink = vi.fn((item: { label: string; href: string }, className: string) => (
      <button type="button" data-href={item.href} className={className}>{item.label}</button>
    ));
    render(<Breadcrumb items={items} renderLink={renderLink} />);
    expect(renderLink).toHaveBeenCalledTimes(2);
    expect(renderLink.mock.calls[0][0]).toEqual({ label: 'Home', href: '/' });
    expect(renderLink.mock.calls[0][1]).toContain('text-text-secondary');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Users' })).toHaveAttribute('data-href', '/users');
    // The current page and the ellipsis stay spans.
    expect(screen.getByText('Settings').tagName).toBe('SPAN');
  });

  it('does not pass the ellipsis to renderLink', () => {
    const renderLink = vi.fn((item: { label: string; href: string }) => <a href={item.href}>{item.label}</a>);
    render(
      <Breadcrumb
        items={[
          { label: 'A', href: '/a' },
          { label: 'B', href: '/b' },
          { label: 'C', href: '/c' },
          { label: 'D' },
        ]}
        maxItems={3}
        renderLink={renderLink}
      />
    );
    expect(renderLink.mock.calls.map((c) => c[0].label)).toEqual(['A', 'C']);
  });
});
