import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DayBarChart, dayStatus, meanAvailability, statusCounts, fillDays, type DayBar } from './index';

const days: DayBar[] = [
  { date: '2026-10-01', availability: 100 },
  { date: '2026-10-02', availability: 99.95 },
  { date: '2026-10-03', availability: 99.4, incidents: [{ id: 'i1', title: 'Elevated latency', severity: 'minor', href: '/incidents/i1' }] },
  { date: '2026-10-04', availability: 91.2, incidents: [{ id: 'i2', title: 'Database failover', severity: 'critical' }, { id: 'i3', title: 'Retry storm' }] },
  { date: '2026-10-05', availability: null },
];

const dayButtons = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('data-day'));

describe('day model', () => {
  it('classifies availability with default and custom thresholds', () => {
    expect(dayStatus(100)).toBe('operational');
    expect(dayStatus(99.9)).toBe('operational');
    expect(dayStatus(99.5)).toBe('degraded');
    expect(dayStatus(98)).toBe('outage');
    expect(dayStatus(null)).toBe('nodata');
    expect(dayStatus(Number.NaN)).toBe('nodata');
    expect(dayStatus(97, { operational: 99, degraded: 95 })).toBe('degraded');
  });
  it('averages only days with data and counts statuses', () => {
    expect(meanAvailability(days)).toBeCloseTo((100 + 99.95 + 99.4 + 91.2) / 4);
    expect(meanAvailability([{ date: '2026-10-01', availability: null }])).toBeNull();
    expect(statusCounts(days)).toEqual({ operational: 2, degraded: 1, outage: 1, nodata: 1 });
  });
  it('fills gaps with no-data days up to an end date', () => {
    const filled = fillDays([{ date: '2026-10-03', availability: 100 }], '2026-10-05', 5);
    expect(filled.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
    expect(filled[2].availability).toBe(100);
    expect(filled[0].availability).toBeNull();
    expect(fillDays([], '2026-03-01', 2).map((d) => d.date)).toEqual(['2026-02-28', '2026-03-01']);
  });
});

describe('DayBarChart', () => {
  it('renders one focusable button per day with a full accessible name (status as text)', () => {
    render(<DayBarChart days={days} label="API" locale="en-US" />);
    expect(screen.getByRole('group', { name: 'Daily availability for API' })).toBeInTheDocument();
    expect(dayButtons()).toHaveLength(5);
    expect(dayButtons()[0]).toHaveAccessibleName('Oct 1, 2026: 100%, Operational');
    expect(dayButtons()[3]).toHaveAccessibleName('Oct 4, 2026: 91.2%, Outage, 2 incidents');
    expect(dayButtons()[4]).toHaveAccessibleName('Oct 5, 2026: no data, No data');
  });

  it('tells status by height and an incident marker as well as colour', () => {
    const { container } = render(<DayBarChart days={days} />);
    const heights = dayButtons().map((b) => (b.querySelector('span[style*="height"]') as HTMLElement).style.height);
    expect(new Set(heights).size).toBe(4);
    expect(container.querySelectorAll('[data-part="incident-marker"]')).toHaveLength(2);
  });

  it('uses a roving tabindex and arrow, Home and End keys', () => {
    render(<DayBarChart days={days} />);
    const group = screen.getByRole('group');
    expect(dayButtons().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(dayButtons()[4].tabIndex).toBe(0); // starts on the newest day
    fireEvent.keyDown(group, { key: 'Home' });
    expect(dayButtons()[0].tabIndex).toBe(0);
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(dayButtons()[1].tabIndex).toBe(0);
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(dayButtons()[0].tabIndex).toBe(0); // clamped
    fireEvent.keyDown(group, { key: 'End' });
    expect(dayButtons()[4].tabIndex).toBe(0);
  });

  it('shows a tooltip on hover and on focus, described by the day', () => {
    render(<DayBarChart days={days} locale="en-US" />);
    fireEvent.mouseEnter(dayButtons()[3]);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Oct 4, 2026');
    expect(tip).toHaveTextContent('Database failover');
    expect(dayButtons()[3]).toHaveAttribute('aria-describedby', tip.id);
    fireEvent.mouseLeave(tip.parentElement!);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(dayButtons()[2]);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Elevated latency');
  });

  it('pins a details dialog on click with incident links, and closes on Escape', () => {
    const onSelect = vi.fn();
    render(<DayBarChart days={days} onSelect={onSelect} renderDetails={(d) => <p>extra {d.date}</p>} />);
    fireEvent.click(dayButtons()[2]);
    const dialog = screen.getByRole('dialog', { name: 'Day details' });
    expect(within(dialog).getByRole('link', { name: 'Elevated latency' })).toHaveAttribute('href', '/incidents/i1');
    expect(dialog).toHaveTextContent('extra 2026-10-03');
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ date: '2026-10-03' }));
    fireEvent.keyDown(screen.getByRole('group'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('is controllable by selectedDate', () => {
    const { rerender } = render(<DayBarChart days={days} selectedDate="2026-10-04" />);
    expect(screen.getByRole('dialog')).toHaveTextContent('Database failover');
    rerender(<DayBarChart days={days} selectedDate={null} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the heading, the summary figure and the range', () => {
    render(<DayBarChart days={days} label="EU region" locale="en-US" />);
    expect(screen.getByRole('heading', { name: 'EU region' })).toBeInTheDocument();
    expect(screen.getByText('97.64% uptime over 5 days')).toBeInTheDocument();
    expect(screen.getByText('10/1/26')).toBeInTheDocument();
  });

  it('lists a legend with the threshold ranges', () => {
    render(<DayBarChart days={days} thresholds={{ operational: 99.95, degraded: 99.5 }} />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('Operational');
    expect(legend).toHaveTextContent('99.95% or more');
    expect(legend).toHaveTextContent('99.5% to 99.95%');
    expect(legend).toHaveTextContent('below 99.5%');
    expect(legend).toHaveTextContent('Incident');
  });

  it('can hide the legend, summary and range, and handles no days', () => {
    const { container, rerender } = render(<DayBarChart days={days} showLegend={false} showSummary={false} showRange={false} />);
    expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull();
    expect(screen.queryByText(/uptime over/)).toBeNull();
    rerender(<DayBarChart days={[]} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(screen.getByText('No data for this period')).toBeInTheDocument();
  });

  it('takes its text from messages', () => {
    render(<DayBarChart days={days} label="API" messages={{ operational: 'En service', group: 'Disponibilité {label}' }} />);
    expect(screen.getByRole('group', { name: 'Disponibilité API' })).toBeInTheDocument();
    expect(dayButtons()[0].getAttribute('aria-label')).toContain('En service');
  });
});
