import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StaffBadge } from './StaffBadge';
import { ForumUserCard } from './ForumUserCard';

afterEach(cleanup);

describe('StaffBadge', () => {
  it('names the organisation and paints its colour', () => {
    render(<StaffBadge org="Northwind" colour="var(--secondary)" />);
    const badge = screen.getByText('Northwind staff');
    expect(badge).toHaveAttribute('title', 'Northwind staff');
    expect(badge.style.getPropertyValue('--staff')).toBe('var(--secondary)');
    expect(badge).toHaveClass('text-white');
  });

  it('falls back to the dark primary colour and takes another label', () => {
    render(<StaffBadge org="Acme" label="Acme ekibi" />);
    const badge = screen.getByText('Acme ekibi');
    expect(badge.style.getPropertyValue('--staff')).toBe('var(--primary-active)');
  });

  it('shows on ForumUserCard when the user is staff, and not otherwise', () => {
    const { rerender } = render(<ForumUserCard user={{ username: 'jane', staff: { org: 'Northwind' } }} />);
    expect(screen.getByText('Northwind staff')).toBeInTheDocument();
    rerender(<ForumUserCard user={{ username: 'jane' }} />);
    expect(screen.queryByText('Northwind staff')).toBeNull();
  });
});
