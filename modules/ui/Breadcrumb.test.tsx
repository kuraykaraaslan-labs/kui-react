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

  it('keeps the markup of a plain item unchanged (text only, no extra classes)', () => {
    render(<Breadcrumb items={items} />);
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home.children).toHaveLength(0);
    expect(home).not.toHaveClass('inline-flex', 'rounded-full');
    expect(screen.getByText('Settings').children).toHaveLength(0);
  });

  it('draws an icon before the label, hidden from assistive tech', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/', icon: <i data-testid="home-icon" /> }, { label: 'Pump room' }]} />);
    const link = screen.getByRole('link', { name: 'Home' });
    const icon = screen.getByTestId('home-icon');
    expect(link).toContainElement(icon);
    expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(link).toHaveClass('inline-flex', 'items-center');
    expect(link.firstElementChild).toBe(icon.parentElement);
  });

  it('chip draws the crumb as a pill, linked or current', () => {
    render(<Breadcrumb items={[{ label: 'Overview', href: '/o', chip: true }, { label: 'Line 1', chip: true }]} />);
    const link = screen.getByRole('link', { name: 'Overview' });
    expect(link).toHaveClass('rounded-full', 'border', 'border-border', 'bg-surface-raised', 'font-semibold');
    const current = screen.getByText('Line 1');
    expect(current).toHaveClass('rounded-full', 'border', 'bg-surface-raised', 'font-semibold', 'text-text-primary');
    expect(current).not.toHaveClass('font-medium');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('tone draws a status dot in the token colour before the label', () => {
    const { container } = render(
      <Breadcrumb items={[{ label: 'Plant', href: '/p', tone: 'success' }, { label: 'Pump', tone: 'error' }, { label: 'Valve', tone: 'neutral' }]} />,
    );
    const dots = container.querySelectorAll('[data-tone]');
    expect(Array.from(dots).map((d) => d.getAttribute('data-tone'))).toEqual(['success', 'error', 'neutral']);
    expect(dots[0]).toHaveClass('rounded-full', 'bg-success');
    expect(dots[1]).toHaveClass('bg-error');
    expect(dots[2]).toHaveClass('bg-text-disabled');
    expect(dots[0]).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('link', { name: 'Plant' })).toContainElement(dots[0] as HTMLElement);
  });

  it('renders leading as the first crumb, followed by the separator', () => {
    render(<Breadcrumb leading={<button type="button">Pages</button>} items={items} separator={<span data-testid="sep">/</span>} />);
    const crumbs = screen.getAllByRole('listitem');
    expect(crumbs).toHaveLength(4);
    expect(crumbs[0]).toContainElement(screen.getByRole('button', { name: 'Pages' }));
    expect(crumbs[0].lastElementChild).toHaveAttribute('data-testid', 'sep');
  });

  it('leading alone gets no separator', () => {
    render(<Breadcrumb leading={<button type="button">Pages</button>} items={[]} separator={<span data-testid="sep">/</span>} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByTestId('sep')).not.toBeInTheDocument();
  });

  it('maxItems collapses the items but never hides leading', () => {
    render(
      <Breadcrumb
        leading={<button type="button">Pages</button>}
        items={[
          { label: 'A', href: '/a' },
          { label: 'B', href: '/b' },
          { label: 'C', href: '/c' },
          { label: 'D', href: '/d' },
          { label: 'E' },
        ]}
        maxItems={3}
      />,
    );
    const crumbs = screen.getAllByRole('listitem');
    expect(crumbs.map((c) => c.textContent)).toEqual(['Pages', 'A', '…', 'D', 'E']);
  });

  it('hands the decorated content to renderLink as a third argument', () => {
    const renderLink = vi.fn((item: { href: string }, className: string, content: React.ReactNode) => (
      <a href={item.href} className={className} data-router="yes">{content}</a>
    ));
    render(<Breadcrumb items={[{ label: 'Plant', href: '/p', icon: <i data-testid="icon" />, chip: true }, { label: 'Pump' }]} renderLink={renderLink} />);
    expect(renderLink.mock.calls[0][1]).toContain('rounded-full');
    const link = screen.getByRole('link', { name: 'Plant' });
    expect(link).toHaveAttribute('data-router', 'yes');
    expect(link).toContainElement(screen.getByTestId('icon'));
  });
});
