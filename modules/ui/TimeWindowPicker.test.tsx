import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeWindowPicker } from './TimeWindowPicker';

describe('TimeWindowPicker', () => {
  it('marks the active preset and emits a relative window keeping interval/aggregation', async () => {
    const onChange = vi.fn();
    render(<TimeWindowPicker value={{ mode: 'relative', last: '1h', interval: '5m' }} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: '1h' })).toHaveAttribute('aria-checked', 'true');
    // In a container narrower than the segments, they scroll inside the control instead of overflowing it.
    expect(screen.getByRole('radiogroup')).toHaveClass('max-w-full', 'overflow-x-auto');
    await userEvent.setup().click(screen.getByRole('radio', { name: '7d' }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'relative', last: '7d', interval: '5m', aggregation: undefined, timezone: undefined });
  });
  it('Custom emits an absolute 24h window and reveals the two date inputs', async () => {
    const onChange = vi.fn();
    render(<TimeWindowPicker value={{ mode: 'relative', last: '1h' }} onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Custom' }));
    const next = onChange.mock.calls[0][0];
    expect(next.mode).toBe('absolute');
    expect(Date.parse(next.to) - Date.parse(next.from)).toBe(24 * 3_600_000);
  });
  it('takes every label from messages', () => {
    render(<TimeWindowPicker value={null} onChange={() => {}} messages={{ label: 'Zeitraum', custom: 'Eigene' }} />);
    expect(screen.getByRole('group', { name: 'Zeitraum' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Eigene' })).toBeInTheDocument();
  });
  it('changing interval emits the new interval', async () => {
    const onChange = vi.fn();
    render(<TimeWindowPicker value={{ mode: 'relative', last: '24h' }} onChange={onChange} />);
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Interval' }), '1h');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ last: '24h', interval: '1h' }));
  });
});

describe('TimeWindowPicker: calendar periods, custom durations, time zone', () => {
  it('offers no Calendar or Last option unless asked (backward compatible)', () => {
    render(<TimeWindowPicker value={null} onChange={() => {}} />);
    expect(screen.queryByRole('radio', { name: 'Calendar' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Last' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Time zone' })).toBeNull();
  });

  it('Calendar emits the first period, then the chosen one; "so far" only for a current period', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<TimeWindowPicker value={{ mode: 'relative', last: '1h', interval: '5m' }} onChange={onChange} calendarPeriods={['current.day', 'previous.month']} />);
    await user.click(screen.getByRole('radio', { name: 'Calendar' }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'calendar', period: 'current.day', interval: '5m', aggregation: undefined, timezone: undefined });
    rerender(<TimeWindowPicker value={{ mode: 'calendar', period: 'current.day' }} onChange={onChange} calendarPeriods={['current.day', 'previous.month']} />);
    expect(screen.getByRole('radio', { name: 'Calendar' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox', { name: 'Calendar period' })).toHaveDisplayValue('Today');
    await user.click(screen.getByRole('checkbox', { name: 'So far' }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'calendar', period: 'current.day', soFar: true });
    rerender(<TimeWindowPicker value={{ mode: 'calendar', period: 'current.day', soFar: true }} onChange={onChange} calendarPeriods={['current.day', 'previous.month']} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Calendar period' }), 'previous.month');
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'calendar', period: 'previous.month', soFar: undefined });
    rerender(<TimeWindowPicker value={{ mode: 'calendar', period: 'previous.month' }} onChange={onChange} calendarPeriods={['current.day', 'previous.month']} />);
    expect(screen.getByRole('checkbox', { name: 'So far' })).toBeDisabled();
  });

  it('opens on the calendar panel for a calendar value, and names periods from messages', () => {
    render(<TimeWindowPicker value={{ mode: 'calendar', period: 'previous.day' }} onChange={() => {}} calendarPeriods={['previous.day']} messages={{ periods: { 'previous.day': 'Gestern' } }} />);
    expect(screen.getByRole('combobox', { name: 'Calendar period' })).toHaveDisplayValue('Gestern');
    expect(screen.queryByRole('radio', { checked: true, name: '1h' })).toBeNull();
  });

  it('Last emits a valid custom duration only', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeWindowPicker value={{ mode: 'relative', last: '1h' }} onChange={onChange} allowDuration />);
    await user.click(screen.getByRole('radio', { name: 'Last' }));
    // It starts from the current window (1h); replacing the amount gives a new duration.
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'relative', last: '1h' }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Amount' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Amount' }), '45');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), 'm');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'relative', last: '45m' }));
    onChange.mockClear();
    await user.clear(screen.getByRole('spinbutton', { name: 'Amount' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Amount' }), '0');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a relative value that is not a preset opens on the custom duration, prefilled', () => {
    render(<TimeWindowPicker value={{ mode: 'relative', last: '3d' }} onChange={() => {}} allowDuration />);
    expect(screen.getByRole('radio', { name: 'Last' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Amount' })).toHaveValue(3);
    expect(screen.getByRole('combobox', { name: 'Unit' })).toHaveDisplayValue('days');
  });

  it('the zone select sets and clears an explicit zone', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeWindowPicker value={{ mode: 'relative', last: '1h', timezone: 'Asia/Tokyo' }} onChange={onChange} showTimezone />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time zone' }), '');
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'relative', last: '1h' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time zone' }), 'UTC');
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'relative', last: '1h', timezone: 'UTC' });
  });
});
