import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { OpeningHours, isOpenAt, type OpeningHoursRow } from './OpeningHours';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const HOURS: OpeningHoursRow[] = [
  { day: 'mo', open: '09:00', close: '12:30' }, { day: 'mo', open: '13:30', close: '18:00' },
  { day: 'fr', open: '22:00', close: '02:00' },
  { day: 'su', closed: true },
];

describe('OpeningHours', () => {
  it('lists the seven days, a split day with both spans, the rest closed', () => {
    render(<OpeningHours hours={HOURS} showStatus={false} />);
    expect(screen.getByText('09:00–12:30, 13:30–18:00')).toBeInTheDocument();
    expect(screen.getAllByText('Closed')).toHaveLength(5);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('works out open / closed in the business time zone, late spans included', () => {
    // 2026-11-02 is a Monday.
    expect(isOpenAt(HOURS, new Date('2026-11-02T07:00:00Z'), 'Europe/Istanbul')).toBe(true);   // 10:00
    expect(isOpenAt(HOURS, new Date('2026-11-02T10:00:00Z'), 'Europe/Istanbul')).toBe(false);  // 13:00 lunch
    expect(isOpenAt(HOURS, new Date('2026-11-07T00:30:00Z'), 'UTC')).toBe(true);               // Sat 00:30 from Fri
    expect(isOpenAt(HOURS, new Date('2026-11-08T10:00:00Z'), 'UTC')).toBe(false);              // Sunday closed
  });

  it('shows "open now" and marks today', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-02T07:00:00Z'));
    render(<OpeningHours hours={HOURS} timeZone="Europe/Istanbul" />);
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByRole('status')).toHaveTextContent('Open now');
    expect(screen.getByText('Monday').closest('[aria-current="date"]')).not.toBeNull();
  });

  it('takes the visible words in another language', () => {
    render(<OpeningHours hours={HOURS} showStatus={false} labels={{ closed: 'Kapalı', mo: 'Pazartesi' }} title="Çalışma saatleri" />);
    expect(screen.getByRole('heading', { name: 'Çalışma saatleri' })).toBeInTheDocument();
    expect(screen.getByText('Pazartesi')).toBeInTheDocument();
    expect(screen.getAllByText('Kapalı')).toHaveLength(5);
  });
});
