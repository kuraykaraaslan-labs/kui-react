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

  it('draws an entry without a valid date undated and last, instead of throwing (phase 11.16)', () => {
    const { container } = render(
      <Timeline timeZone="UTC" locale="en-US" undatedLabel="No date"
        items={[
          { id: 'x', at: 'not a date', title: 'Broken' },
          { id: 'n', at: undefined, title: 'Missing' },
          { id: 'a', at: '2026-08-24T10:00:00Z', title: 'Dated' },
        ]} />,
    );
    const events = [...container.querySelectorAll('li.relative')];
    expect(events.map((li) => li.textContent?.replace(/\d.*$/, ''))).toEqual(['Dated', 'Broken', 'Missing']);
    expect(container.querySelectorAll('time')).toHaveLength(1);
    expect(screen.getByText('No date')).toBeInTheDocument();
  });

  it('order="oldest" puts the first event first; status marks current and upcoming steps', () => {
    const { container } = render(
      <Timeline timeZone="UTC" locale="en-US" order="oldest" groupByDay={false}
        items={[
          { id: 'c', at: '2026-08-26T10:00:00Z', title: 'Expires', status: 'upcoming' },
          { id: 'a', at: '2026-08-24T10:00:00Z', title: 'Sent', status: 'done' },
          { id: 'b', at: '2026-08-25T10:00:00Z', title: 'Opened', status: 'current' },
        ]} />,
    );
    const events = [...container.querySelectorAll('li.relative')];
    expect(events.map((li) => li.getAttribute('data-status'))).toEqual(['done', 'current', 'upcoming']);
    expect(events[1]).toHaveAttribute('aria-current', 'step');
    expect(events[2].querySelector('span.border-dashed')).not.toBeNull();
    // the way to an upcoming step is dashed
    expect(events[1].querySelector('span.border-l.border-dashed')).not.toBeNull();
  });
});
