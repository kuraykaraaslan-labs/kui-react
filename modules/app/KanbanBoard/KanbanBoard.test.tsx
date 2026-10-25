import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KanbanBoard, type KanbanCard, type KanbanColumn } from './index';

// Phase 11.14: what next-boilerplate's pipeline boards need from the board.

const COLUMNS: KanbanColumn[] = [
  { id: 'lead', title: 'Lead', summary: '$12,000', color: '#2457c5' },
  { id: 'won', title: 'Won', badge: <span>✓</span>, wipLimit: 1 },
  { id: 'lost', title: 'Lost', collapsed: true },
];
const CARDS: KanbanCard[] = [
  { id: 'c1', columnId: 'lead', title: 'Acme renewal' },
  { id: 'c2', columnId: 'lead', title: 'Globex pilot' },
  { id: 'c3', columnId: 'won', title: 'Initech' },
  { id: 'c4', columnId: 'won', title: 'Umbrella' },
];

const column = (name: string) => screen.getByRole('region', { name: `Column ${name}` });

describe('KanbanBoard', () => {
  it('shows summaries, badges, the WIP count over its limit, and folded columns as strips', () => {
    render(<KanbanBoard columns={COLUMNS} cards={CARDS} />);
    expect(within(column('Lead')).getByText('$12,000')).toBeInTheDocument();
    expect(within(column('Won')).getByText('✓')).toBeInTheDocument();
    expect(within(column('Won')).getByText('2/1')).toHaveAttribute('aria-label', '2 of 1: over the limit');
    expect(column('Lost')).toHaveAttribute('data-collapsed', 'true');
    expect(within(column('Lost')).queryByRole('list')).toBeNull();
  });

  it('folds and unfolds a column from its header', async () => {
    const user = userEvent.setup();
    render(<KanbanBoard columns={COLUMNS} cards={CARDS} />);
    await user.click(screen.getByRole('button', { name: 'Fold column: Lead' }));
    expect(column('Lead')).toHaveAttribute('data-collapsed', 'true');
    await user.click(screen.getByRole('button', { name: 'Unfold column: Lead' }));
    expect(within(column('Lead')).getByText('Acme renewal')).toBeInTheDocument();
  });

  it('Alt + Right moves a card to the next unfolded column and announces it', async () => {
    const user = userEvent.setup();
    const onCardMove = vi.fn();
    render(<KanbanBoard columns={COLUMNS} cards={CARDS} onCardMove={onCardMove} />);
    const card = screen.getByText('Acme renewal').closest('[data-card-id]') as HTMLElement;
    card.focus();
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(onCardMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', columnId: 'won' }), 'lead', 'won', 2);
    await waitFor(() => expect(screen.getByText('Acme renewal moved from Lead to Won')).toBeInTheDocument());
    expect(within(column('Won')).getByText('Acme renewal')).toBeInTheDocument();
  });

  it('Alt + Down reorders within the column; a rejected move reverts', async () => {
    const user = userEvent.setup();
    const onCardMove = vi.fn().mockRejectedValueOnce(new Error('no'));
    render(<KanbanBoard columns={COLUMNS} cards={CARDS} onCardMove={onCardMove} />);
    const first = screen.getByText('Acme renewal').closest('[data-card-id]') as HTMLElement;
    first.focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onCardMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), 'lead', 'lead', 1);
    await waitFor(() => {
      const titles = within(column('Lead')).getAllByRole('listitem').map((li) => li.textContent);
      expect(titles[0]).toContain('Acme renewal');
    });
  });

  it('new cards from the host replace the optimistic copy', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<KanbanBoard columns={COLUMNS} cards={CARDS} onCardMove={() => {}} />);
    const card = screen.getByText('Acme renewal').closest('[data-card-id]') as HTMLElement;
    card.focus();
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await waitFor(() => expect(within(column('Won')).getByText('Acme renewal')).toBeInTheDocument());
    // The server said no: the host sends the old cards again.
    rerender(<KanbanBoard columns={COLUMNS} cards={[...CARDS]} onCardMove={() => {}} />);
    expect(within(column('Lead')).getByText('Acme renewal')).toBeInTheDocument();
  });

  it('opens a card on click and on Enter; messages replace every string', async () => {
    const user = userEvent.setup();
    const onCardClick = vi.fn();
    render(
      <KanbanBoard
        columns={[{ id: 'a', title: 'A' }]}
        cards={[{ id: 'x', columnId: 'a', title: 'X' }]}
        onCardClick={onCardClick}
        messages={{ column: 'Sütun {title}', emptyColumn: 'Boş' }}
      />,
    );
    const card = screen.getByText('X').closest('[data-card-id]') as HTMLElement;
    await user.click(card);
    card.focus();
    await user.keyboard('{Enter}');
    expect(onCardClick).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('region', { name: 'Sütun A' })).toBeInTheDocument();
  });
});
