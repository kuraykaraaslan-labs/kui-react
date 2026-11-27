import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { Countdown } from './Countdown';
import { countdownLabels, msUntilNextTick, splitRemaining, formatUnit } from './countdownTime';

const END = '2026-12-01T00:00:00.000Z';
const at = (iso: string) => new Date(iso).getTime();
const values = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('[data-unit]')].map((u) => `${u.dataset.unit}:${u.querySelector('[data-part="value"]')!.textContent}${u.hidden ? '(hidden)' : ''}`);

afterEach(() => { vi.useRealTimers(); });

describe('splitRemaining', () => {
  it('splits the time left into floored days, hours, minutes and seconds', () => {
    expect(splitRemaining(END, '2026-11-28T19:47:30.500Z')).toEqual({
      days: 2, hours: 4, minutes: 12, seconds: 29, totalMs: at(END) - at('2026-11-28T19:47:30.500Z'), ended: false,
    });
  });

  it('is over at and after the end date, and for unreadable dates', () => {
    expect(splitRemaining(END, END)).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, ended: true });
    expect(splitRemaining(END, '2027-01-01T00:00:00Z').ended).toBe(true);
    expect(splitRemaining('not a date', END).ended).toBe(true);
  });

  it('counts elapsed time across a daylight-saving change (a day is 24 hours, not a calendar day)', () => {
    // Europe/Berlin springs forward on 2026-03-29: midnight to midnight local time is only 23 hours.
    expect(splitRemaining('2026-03-30T00:00:00+02:00', '2026-03-29T00:00:00+01:00')).toMatchObject({ days: 0, hours: 23, minutes: 0 });
    // and falls back on 2026-10-25: 25 hours.
    expect(splitRemaining('2026-10-26T00:00:00+01:00', '2026-10-25T00:00:00+02:00')).toMatchObject({ days: 1, hours: 1, minutes: 0 });
  });

  it('keeps showing 0 minutes during the last minute rather than ending early', () => {
    expect(splitRemaining(END, '2026-11-30T23:59:30Z')).toMatchObject({ minutes: 0, seconds: 30, ended: false });
  });
});

describe('countdown helpers', () => {
  it('schedules the next tick on the next whole step of the time left', () => {
    expect(msUntilNextTick(END, '2026-11-30T23:58:30Z', 60_000)).toBe(30_000);
    expect(msUntilNextTick(END, '2026-11-30T23:58:00Z', 60_000)).toBe(60_000);
    expect(msUntilNextTick(END, '2026-11-30T23:59:59.250Z', 1000)).toBe(750);
  });

  it('pads boxed hours, minutes and seconds, never days or compact values', () => {
    expect(formatUnit('minutes', 4, 'boxed')).toBe('04');
    expect(formatUnit('days', 4, 'boxed')).toBe('4');
    expect(formatUnit('minutes', 4, 'compact')).toBe('4');
  });

  it('has English and Turkish defaults and takes overrides', () => {
    expect(countdownLabels().ended).toBe('Ended');
    expect(countdownLabels('tr-TR').ended).toBe('Sona erdi');
    expect(countdownLabels('tr', { days: 'G' }).days).toBe('G');
    expect(countdownLabels('de').daysShort).toBe('d');
  });
});

describe('Countdown', () => {
  it('renders compact text, an off live region and the end date in a <time> for screen readers', () => {
    vi.useFakeTimers({ now: at('2026-11-28T19:47:30Z'), toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { container } = render(<Countdown endsAt={END} timeZone="UTC" locale="en-GB" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.state).toBe('running');
    expect(values(root)).toEqual(['days:2', 'hours:4', 'minutes:12']);
    expect(root.querySelector('[data-part="units"]')!.textContent).toBe('2d4h12m');
    const timer = root.querySelector('[role="timer"]')!;
    expect(timer).toHaveAttribute('aria-live', 'off');
    const time = root.querySelector('time')!;
    expect(time).toHaveAttribute('datetime', END);
    expect(time.parentElement).toHaveClass('sr-only');
    expect(time.parentElement!.textContent).toMatch(/^Ends 1 Dec 2026, 00:00$/);
  });

  it('hides zero days in compact but keeps the boxed day box', () => {
    vi.useFakeTimers({ now: at('2026-11-30T20:00:00Z'), toFake: ['Date'] });
    const compact = render(<Countdown endsAt={END} />).container;
    expect(values(compact)).toEqual(['days:0(hidden)', 'hours:4', 'minutes:0']);
    const boxed = render(<Countdown endsAt={END} variant="boxed" showSeconds locale="tr" />).container;
    expect(values(boxed)).toEqual(['days:0', 'hours:04', 'minutes:00', 'seconds:00']);
    expect([...boxed.querySelectorAll('[data-part="label"]')].map((l) => l.textContent)).toEqual(['Gün', 'Saat', 'Dakika', 'Saniye']);
  });

  it('ticks once a minute without seconds and every second with them', () => {
    vi.useFakeTimers({ now: at('2026-11-30T23:57:30Z'), toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { container } = render(<><Countdown endsAt={END} data-testid="m" /><Countdown endsAt={END} showSeconds data-testid="s" /></>);
    const [m, s] = [container.children[0], container.children[1]];
    expect(values(m)).toEqual(['days:0(hidden)', 'hours:0', 'minutes:2']);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(values(s)).toContain('seconds:28');
    expect(values(m)).toContain('minutes:2');
    act(() => { vi.advanceTimersByTime(29_000); });
    expect(values(m)).toContain('minutes:1');
  });

  it('shows the ended label and calls onEnd once when time runs out', () => {
    vi.useFakeTimers({ now: at('2026-11-30T23:59:58Z'), toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const onEnd = vi.fn();
    const { container } = render(<Countdown endsAt={END} showSeconds onEnd={onEnd} endedLabel="Offer over" />);
    const root = container.firstElementChild as HTMLElement;
    expect(onEnd).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(root.dataset.state).toBe('ended');
    expect(root.querySelector('[data-part="units"]')).toHaveAttribute('hidden');
    const ended = root.querySelector('[data-part="ended"]') as HTMLElement;
    expect(ended.hidden).toBe(false);
    expect(ended.textContent).toBe('Offer over');
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('renders "--" on the server without `now`, the server time with it, and hydrates without a mismatch', async () => {
    expect(renderToString(<Countdown endsAt={END} />)).toContain('data-state="pending"');
    const html = renderToString(<Countdown endsAt={END} now="2026-11-28T19:47:30Z" timeZone="UTC" />);
    expect(html).toContain('data-state="running"');
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    vi.useFakeTimers({ now: at('2026-11-29T19:47:30Z'), toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const recoverable = vi.fn();
    await act(async () => { hydrateRoot(el, <Countdown endsAt={END} now="2026-11-28T19:47:30Z" timeZone="UTC" />, { onRecoverableError: recoverable }); });
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(values(el)).toEqual(['days:1', 'hours:4', 'minutes:12']);
    errors.mockRestore();
    el.remove();
  });
});
