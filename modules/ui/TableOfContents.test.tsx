import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableOfContents, type TocItem } from './TableOfContents';

const items: TocItem[] = [
  { id: 'intro', text: 'Intro', depth: 1 },
  { id: 'install', text: 'Install', depth: 2 },
  { id: 'npm', text: 'npm', depth: 3 },
  { id: 'deep', text: 'Deep', depth: 4 },
];

describe('TableOfContents', () => {
  it('shows only headings inside the depth range, linked by fragment', () => {
    render(<TableOfContents items={items} />);
    expect(screen.getByRole('link', { name: 'Install' })).toHaveAttribute('href', '#install');
    expect(screen.getByRole('link', { name: 'npm' })).toHaveAttribute('href', '#npm');
    expect(screen.queryByRole('link', { name: 'Intro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deep' })).not.toBeInTheDocument();
  });

  it('marks the controlled active heading with aria-current="location"', () => {
    render(<TableOfContents items={items} activeId="npm" />);
    expect(screen.getByRole('link', { name: 'npm' })).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('link', { name: 'Install' })).not.toHaveAttribute('aria-current');
  });

  it('renders nothing when no heading is in range', () => {
    const { container } = render(<TableOfContents items={[{ id: 'a', text: 'A', depth: 1 }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is a navigation landmark with a configurable name', () => {
    render(<TableOfContents items={items} ariaLabel="On this page" />);
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
  });
});
