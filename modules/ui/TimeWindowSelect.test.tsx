import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeWindowSelect, toZonedInput, fromZonedInput, windowSpanMs, summarize } from './TimeWindowSelect';

const NOW = Date.parse('2026-10-17T10:07:30.000Z');
const setup = (value: Parameters<typeof TimeWindowSelect>[0]['value'], extra: Partial<Parameters<typeof TimeWindowSelect>[0]> = {}) => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<TimeWindowSelect value={value} onChange={onChange} now={() => NOW} {...extra} />);
  return { onChange, user, open: () => user.click(screen.getByRole('button', { name: /Change time window/ })) };
};

describe('TimeWindowSelect', () => {
  it('a button names the window and opens a panel on the right tab', async () => {
    const { open } = setup({ mode: 'relative', last: '24h', aggregation: 'max', interval: '1h', timezone: 'Asia/Tokyo' });
    expect(screen.getByRole('button', { name: /Change time window/ })).toHaveTextContent('Realtime · Last 24h · max 1h · Asia/Tokyo');
    expect(screen.queryByRole('dialog')).toBeNull();
    await open();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Realtime' })).toHaveAttribute('aria-selected', 'true');
  });

  it('the trigger can shrink to a narrow container: its Popover wrapper is capped at the container width', () => {
    setup({ mode: 'relative', last: '24h' });
    const trigger = screen.getByRole('button', { name: /Change time window/ });
    expect(trigger).toHaveClass('max-w-full');
    expect(trigger.parentElement?.parentElement).toHaveClass('relative', 'inline-block', 'max-w-full');
  });

  it('edits are a draft until Update; Cancel drops them', async () => {
    const { onChange, user, open } = setup({ mode: 'relative', last: '24h' });
    await open();
    await user.click(screen.getByRole('radio', { name: '7d' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    await open();
    await user.click(screen.getByRole('radio', { name: '7d' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'relative', last: '7d' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Realtime: any last N, and the current period with "so far"', async () => {
    const { onChange, user, open } = setup({ mode: 'relative', last: '24h' });
    await open();
    const amount = screen.getAllByRole('spinbutton', { name: 'Amount' })[0];
    await user.clear(amount);
    await user.type(amount, '45');
    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Unit' })[0], 'm');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'relative', last: '45m' });

    await open();
    await user.click(screen.getByRole('radio', { name: 'Current period' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Current period' }), 'current.month');
    await user.click(screen.getByRole('checkbox', { name: 'So far' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'calendar', period: 'current.month', soFar: true });
  });

  it('History: last N is anchored when applied; a past period; settings travel with the window', async () => {
    const { onChange, user, open } = setup({ mode: 'relative', last: '24h', aggregation: 'sum' });
    await open();
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(screen.getByRole('radio', { name: 'Last' }));
    const amount = screen.getByRole('spinbutton', { name: 'Amount' });
    await user.clear(amount);
    await user.type(amount, '2');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), 'd');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'absolute', from: new Date(NOW - 2 * 86_400_000).toISOString(), to: new Date(NOW).toISOString(), aggregation: 'sum', interval: undefined, timezone: undefined });

    await open();
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(screen.getByRole('radio', { name: 'Period' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Period' }), 'previous.month');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'calendar', period: 'previous.month' }));
  });

  it('History: a fixed range is typed in the window\'s zone; an inverted range cannot be applied', async () => {
    const { onChange, user, open } = setup({ mode: 'absolute', from: '2026-10-16T00:00:00.000Z', to: '2026-10-17T00:00:00.000Z', timezone: 'Europe/Istanbul' });
    await open();
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('From (Europe/Istanbul)')).toBeInTheDocument();
    const from = document.getElementById('tws-from') as HTMLInputElement;
    expect(from.value).toBe('2026-10-16T03:00');
    // jsdom cannot type into a datetime-local input key by key; a change event is what a browser sends.
    fireEvent.change(from, { target: { value: '2026-10-16T09:00' } });
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-16T06:00:00.000Z', to: '2026-10-17T00:00:00.000Z', timezone: 'Europe/Istanbul' }));
    await open();
    fireEvent.change(document.getElementById('tws-from') as HTMLInputElement, { target: { value: '2026-10-18T09:00' } });
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
  });

  it('says how many buckets an interval makes, and warns above the cap', async () => {
    const { user, open } = setup({ mode: 'relative', last: '24h', interval: '5m' });
    await open();
    expect(screen.getByRole('status')).toHaveTextContent('≈ 288 buckets');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Interval' }), '1m');
    expect(screen.getByRole('status')).toHaveTextContent('≈ 1440 buckets: the server will use a coarser interval');
  });

  it('arrow keys move between the tabs', async () => {
    const { user, open } = setup({ mode: 'relative', last: '24h' });
    await open();
    screen.getByRole('tab', { name: 'Realtime' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('TimeWindowSelect: what a board lets viewers change', () => {
  it('with one kind of window there is no tab list, only that kind', async () => {
    const { open } = setup({ mode: 'relative', last: '24h' }, { tabs: ['realtime'] });
    await open();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Current period' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Fixed range' })).toBeNull();
  });

  it('a window of a kind the board does not offer opens on the kind it does', async () => {
    const { onChange, user, open } = setup({ mode: 'relative', last: '24h' }, { tabs: ['history'] });
    await open();
    expect(screen.getByRole('radio', { name: 'Fixed range' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Update' }));
    // Exactly an absolute window: the relative value's `last` must not ride along (a strict consumer refuses it).
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'absolute', from: new Date(NOW - (NOW % 60_000) - 86_400_000).toISOString(), to: new Date(NOW - (NOW % 60_000)).toISOString() });
  });

  it('hidden controls and a narrowed aggregation list', async () => {
    const { open } = setup({ mode: 'relative', last: '24h' }, { showInterval: false, showTimezone: false, aggregations: ['avg', 'max'] });
    await open();
    expect(screen.queryByRole('combobox', { name: 'Interval' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Time zone' })).toBeNull();
    expect(screen.getAllByRole('option').filter((o) => (o.textContent ?? '').startsWith('Aggregate')).map((o) => o.textContent)).toEqual(['Aggregate: avg', 'Aggregate: max']);
  });
});

describe('TimeWindowSelect: switching kinds keeps only the settings', () => {
  it('a fixed range on a realtime-only select becomes the default preset, keeping its interval and zone', async () => {
    const { onChange, user, open } = setup({ mode: 'absolute', from: '2026-10-16T00:00:00.000Z', to: '2026-10-17T00:00:00.000Z', interval: '1h', timezone: 'Asia/Tokyo' }, { tabs: ['realtime'] });
    await open();
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'relative', last: '24h', interval: '1h', timezone: 'Asia/Tokyo' });
  });
});

describe('TimeWindowSelect: review 2026-10-17', () => {
  it('back to Realtime from History resets to the "Last" choice, and what is shown is what Update stores', async () => {
    const { onChange, user, open } = setup({ mode: 'calendar', period: 'current.day' });
    await open();
    expect(screen.getByRole('radio', { name: 'Current period' })).toBeChecked();
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(screen.getByRole('tab', { name: 'Realtime' }));
    expect(screen.getByRole('radio', { name: 'Last' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '24h' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('spinbutton', { name: 'Amount' })[0]).toHaveValue(24);
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'relative', last: '24h' });
  });

  it('a board without avg shows and applies an aggregation it offers', async () => {
    const { onChange, user, open } = setup({ mode: 'relative', last: '24h' }, { aggregations: ['max', 'sum'] });
    await open();
    expect(screen.getByRole('combobox', { name: 'Aggregation' })).toHaveValue('max');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'relative', last: '24h', aggregation: 'max' });
  });

  it('a window longer than the consumer accepts cannot be applied, and says why', async () => {
    const { user, open } = setup({ mode: 'relative', last: '24h' });
    await open();
    const amount = screen.getAllByRole('spinbutton', { name: 'Amount' })[0];
    await user.clear(amount);
    await user.type(amount, '400');
    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Unit' })[0], 'd');
    expect(screen.getByRole('alert')).toHaveTextContent('A window can be at most 366 days long');
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(screen.getByRole('radio', { name: 'Last' }));
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
  });

  it('an invalid realtime amount disables Update instead of applying the old window', async () => {
    const { user, open } = setup({ mode: 'relative', last: '24h' });
    await open();
    const amount = screen.getAllByRole('spinbutton', { name: 'Amount' })[0];
    await user.clear(amount);
    await user.type(amount, '0');
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
  });
});

describe('TimeWindowSelect helpers', () => {
  it('zoned datetime-local values round-trip, across a DST change', () => {
    expect(toZonedInput('2026-10-16T00:00:00.000Z', 'Europe/Istanbul')).toBe('2026-10-16T03:00');
    expect(fromZonedInput('2026-10-16T03:00', 'Europe/Istanbul')).toBe('2026-10-16T00:00:00.000Z');
    expect(fromZonedInput('2026-11-01T12:00', 'America/New_York')).toBe('2026-11-01T17:00:00.000Z');
    expect(fromZonedInput('2026-10-31T12:00', 'America/New_York')).toBe('2026-10-31T16:00:00.000Z');
    // A time in a DST gap moves forward in every zone (review 2026-10-17).
    expect(fromZonedInput('2026-03-08T02:30', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z');
    expect(fromZonedInput('2026-03-29T02:30', 'Europe/Berlin')).toBe('2026-03-29T01:30:00.000Z');
  });
  it('spans and the summary', () => {
    expect(windowSpanMs({ mode: 'relative', last: '3d' })).toBe(3 * 86_400_000);
    expect(windowSpanMs({ mode: 'calendar', period: 'previous.day' })).toBe(86_400_000);
    expect(summarize({ mode: 'calendar', period: 'current.day', soFar: true })).toBe('Realtime · Today (so far)');
    expect(summarize({ mode: 'calendar', period: 'previous.month' })).toBe('History · Previous month');
    expect(summarize(null)).toBe('Time window');
  });
});
