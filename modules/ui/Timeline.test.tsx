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

  it('draws its day headings on its own surface, in line with the events\' text, with a gap above the first marker', () => {
    const items = [
      { id: 'a', at: '2026-08-24T10:00:00Z', title: 'Old' },
      { id: 'b', at: '2026-08-25T14:40:00Z', title: 'New', status: 'current' as const },
      { id: 'c', at: '2026-08-26T09:00:00Z', title: 'Next', status: 'upcoming' as const },
    ];
    const { container, rerender } = render(<Timeline timeZone="UTC" locale="en-US" items={items} />);
    const headings = () => [...container.querySelectorAll('li.sticky')];
    expect(headings()).toHaveLength(3);
    for (const h of headings()) {
      // no page-coloured band with a blur: the surface itself, opaque so it stays readable while it sticks
      expect(h.className).toContain('bg-surface-base');
      expect(h.className).not.toContain('/95');
      expect(h.className).not.toContain('backdrop-blur');
      // the item's pl-1 + the 2.125rem marker + the gap-3
      expect(h.className).toContain('pl-[3.125rem]');
      expect(h.className).toContain('mb-2');
    }
    rerender(<Timeline timeZone="UTC" locale="en-US" items={items} surface="raised" />);
    expect(headings().every((h) => h.className.includes('bg-surface-raised') && !h.className.includes('bg-surface-base'))).toBe(true);
    expect(container.querySelector('[data-status="upcoming"] span.border-dashed.bg-surface-raised')).not.toBeNull();
    expect(container.querySelector('[data-status="current"] span.ring-offset-surface-raised')).not.toBeNull();
  });

  it('leaves no space under the last event; Load more keeps its gap', () => {
    const items = [
      { id: 'a', at: '2026-08-24T10:00:00Z', title: 'Old' },
      { id: 'b', at: '2026-08-25T14:40:00Z', title: 'New' },
    ];
    const { container, rerender } = render(<Timeline timeZone="UTC" items={items} />);
    const events = () => [...container.querySelectorAll('li.relative')];
    expect(events().map((li) => li.classList.contains('pb-5'))).toEqual([true, false]);
    rerender(<Timeline timeZone="UTC" items={items} hasMore onLoadMore={() => undefined} />);
    expect(container.querySelector('[data-part="load-more"]')!.className).toContain('pt-5');
  });

  it('shows seconds and the time zone when asked, minutes alone by default (NB 41-ui-fixes/22 6.4)', () => {
    const items = [{ id: 'a', at: '2026-08-24T10:05:09Z', title: 'A' }];
    const { container, rerender } = render(<Timeline timeZone="UTC" locale="en-GB" groupByDay={false} items={items} />);
    expect(container.querySelector('time')?.textContent).toBe('10:05');
    rerender(<Timeline timeZone="UTC" locale="en-GB" groupByDay={false} items={items} timePrecision="seconds" showTimeZone />);
    expect(container.querySelector('time')?.textContent).toBe('10:05:09 UTC');
    rerender(<Timeline timeZone="Europe/Istanbul" locale="en-GB" groupByDay={false} items={items} timePrecision="seconds" showTimeZone />);
    expect(container.querySelector('time')?.textContent).toMatch(/^13:05:09 (GMT\+3|TRT)$/);
  });
});
