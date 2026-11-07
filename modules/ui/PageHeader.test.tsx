import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('draws its actions as Button does: secondary neutral, accent in the brand\'s second colour', () => {
    render(
      <PageHeader
        title="Dashboards"
        actions={[
          { label: 'Back', variant: 'secondary' },
          { label: 'Import', variant: 'accent' },
          { label: 'Docs', href: '/docs', variant: 'accent' },
          { label: 'New' },
        ]}
      />,
    );
    const back = screen.getByRole('button', { name: 'Back' }).className;
    expect(back).toContain('bg-surface-overlay');
    expect(back).not.toMatch(/\b(?:bg|text)-(?:secondary|accent)/);
    expect(screen.getByRole('button', { name: 'Import' }).className).toContain('bg-accent text-accent-fg hover:bg-accent-hover');
    expect(screen.getByRole('link', { name: 'Docs' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'New' }).className).toContain('bg-primary');
  });

  it('renders a guided-tour anchor on an action (dataTour)', () => {
    render(<PageHeader title="Diagrams" actions={[{ label: 'New', onClick: () => {}, dataTour: 'demo.new' }, { label: 'Docs', href: '/docs', dataTour: 'demo.docs' }]} />);
    expect(screen.getByRole('button', { name: 'New' }).getAttribute('data-tour')).toBe('demo.new');
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('data-tour')).toBe('demo.docs');
  });
});
