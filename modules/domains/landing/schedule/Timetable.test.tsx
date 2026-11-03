import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Timetable, sessionsByDay, type TimetableSession } from './Timetable';

afterEach(cleanup);

const S: TimetableSession[] = [
  { day: 0, start: '19:00', end: '20:00', name: 'Yoga', who: 'Ece', where: 'Studio 2' },
  { day: 0, start: '07:00', end: '08:00', name: 'Spin' },
  { day: 2, start: '18:30', name: 'Spin' },
  { day: 9, start: '10:00', name: 'Out of range' },
];

describe('Timetable', () => {
  it('sorts each day by start and leaves out days that are not shown', () => {
    const cols = sessionsByDay(S, 7);
    expect(cols[0].map((s) => s.name)).toEqual(['Spin', 'Yoga']);
    expect(cols.flat()).toHaveLength(3);
  });

  it('shows a column per day, who and where, and filters by class', () => {
    render(<Timetable title="This week" sessions={S} />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
    expect(screen.getByText('Ece · Studio 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yoga' }));
    expect(screen.getByRole('button', { name: 'Yoga' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Spin', { selector: 'p' })).toBeNull();
  });

  it('hides empty days and takes labels in another language', () => {
    render(<Timetable sessions={S} hideEmptyDays labels={{ all: 'Tümü' }} days={['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Pzt', 'Çar']);
    expect(screen.getByRole('button', { name: 'Tümü' })).toBeInTheDocument();
  });

  it('renders nothing with no sessions and no title', () => {
    const { container } = render(<Timetable sessions={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
