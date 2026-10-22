import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Callout } from './Callout';

describe('Callout', () => {
  it('is a labelled complementary landmark, never an alert', () => {
    render(<Callout variant="warning">Mind the gap.</Callout>);
    expect(screen.getByRole('complementary', { name: 'Warning' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('defaults the heading to the variant label and accepts a custom one', () => {
    const { rerender } = render(<Callout variant="tip">x</Callout>);
    expect(screen.getByText('Tip')).toBeInTheDocument();
    rerender(<Callout variant="tip" title="Faster builds">x</Callout>);
    expect(screen.getByText('Faster builds')).toBeInTheDocument();
    expect(screen.queryByText('Tip')).not.toBeInTheDocument();
  });

  it('renders no heading row when title and icon are both null', () => {
    const { container } = render(<Callout title={null} icon={null}>Body only</Callout>);
    expect(container.querySelector('aside > p')).toBeNull();
    expect(screen.getByText('Body only')).toBeInTheDocument();
  });

  it('exposes the variant as data-callout for prose styling', () => {
    const { container } = render(<Callout variant="danger">x</Callout>);
    expect(container.querySelector('aside')).toHaveAttribute('data-callout', 'danger');
  });

  it('keeps the thick left accent (border-l-4 must survive tailwind-merge after `border`)', () => {
    const { container } = render(<Callout>x</Callout>);
    expect(container.querySelector('aside')!.className).toMatch(/\bborder-l-4\b/);
  });
});
