import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AcceptedSolutionBadge, MarkSolutionButton, acceptedSolutionClasses } from './AcceptedSolution';

afterEach(cleanup);

describe('AcceptedSolution', () => {
  it('shows the chip with its default or given label', () => {
    const { rerender } = render(<AcceptedSolutionBadge />);
    expect(screen.getByText('Accepted solution')).toHaveClass('bg-success-subtle', 'text-success-fg');
    rerender(<AcceptedSolutionBadge label="Kabul edilen çözüm" />);
    expect(screen.getByText('Kabul edilen çözüm')).toBeInTheDocument();
  });

  it('offers to mark a post, then to unmark the solution, and reports the next state', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<MarkSolutionButton isSolution={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Mark as solution' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenLastCalledWith(true);

    rerender(<MarkSolutionButton isSolution onToggle={onToggle} labels={{ unmark: 'Remove solution' }} />);
    const unmark = screen.getByRole('button', { name: 'Remove solution' });
    expect(unmark).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(unmark);
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it('does not toggle while disabled', () => {
    const onToggle = vi.fn();
    render(<MarkSolutionButton isSolution={false} onToggle={onToggle} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('tints the card, author column and meta row with the success token only', () => {
    for (const cls of Object.values(acceptedSolutionClasses)) {
      expect(cls).toContain('var(--success)');
      expect(cls).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });
});
