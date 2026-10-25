import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from './Timeline';

describe('Timeline', () => {
  it('draws the connector line on every event but the last', () => {
    const { container } = render(
      <Timeline
        timeZone="UTC"
        locale="en-US"
        items={[
          { id: 'a', at: '2026-08-24T10:00:00Z', title: 'Old' },
          { id: 'b', at: '2026-08-25T14:40:00Z', title: 'New' },
          { id: 'c', at: '2026-08-25T09:12:00Z', title: 'Mid' },
        ]}
      />,
    );
    const events = [...container.querySelectorAll('li.relative')];
    expect(events.map((li) => li.textContent?.slice(0, 3))).toEqual(['New', 'Mid', 'Old']);
    expect(events.map((li) => li.querySelector('span.w-px') !== null)).toEqual([true, true, false]);
    expect(container.innerHTML).not.toContain('last:hidden');
  });

  it('shows Load more while older entries exist and calls onLoadMore (phase 11.14)', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <Timeline timeZone="UTC" items={[{ id: 'a', at: '2026-08-24T10:00:00Z', title: 'A' }]} hasMore onLoadMore={onLoadMore} loadMoreLabel="Daha fazla" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Daha fazla' }));
    expect(onLoadMore).toHaveBeenCalledOnce();
    rerender(<Timeline timeZone="UTC" items={[{ id: 'a', at: '2026-08-24T10:00:00Z', title: 'A' }]} hasMore={false} onLoadMore={onLoadMore} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
