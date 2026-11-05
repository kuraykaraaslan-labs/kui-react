import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatDateTime, formatNumber, plural } from './format';
import { formatSeconds } from './profile/OnlineRuleField';
import { IotAdapterProvider, useIotCapabilities, useIotText } from './api/IotAdapterProvider';
import type { IotAdapter } from './api/adapter';

/* NB 41-ui-fixes/20 1.12, 1.15, 1.16: counts, durations and times in the viewer's language and zone; unknown capabilities are not denied. */

describe('counts, durations and times', () => {
  it('a count takes the plural form of its locale', () => {
    const forms = { one: '{n} device', other: '{n} devices' };
    expect(plural(1, forms, 'en')).toBe('1 device');
    expect(plural(3, forms, 'en')).toBe('3 devices');
    expect(plural(1200, forms, 'en')).toBe('1,200 devices');
  });

  it('durations use the host\'s unit texts and the locale\'s decimals', () => {
    expect(formatSeconds(86_400)).toBe('1 d');
    expect(formatSeconds(5_400)).toBe('1.5 h');
    expect(formatSeconds(5_400, { seconds: '{n} sn', minutes: '{n} dk', hours: '{n} sa', days: '{n} g', secondsShort: 'sn', milliseconds: '{n} ms' }, 'tr')).toBe('1,5 sa');
    expect(formatSeconds(90, undefined, 'en')).toBe('1.5 min');
    expect(formatNumber(2.25, 'en', 1)).toBe('2.3');
  });

  it('a date and time names its zone, in the host\'s zone when it passes one', () => {
    const t = new Date('2026-10-24T12:05:00Z');
    expect(formatDateTime(t, { locale: 'en-GB', timeZone: 'UTC' })).toMatch(/24 Oct 2026.*12:05.*UTC/);
    expect(formatDateTime(t, { locale: 'en-GB', timeZone: 'Europe/Istanbul' })).toMatch(/15:05.*GMT\+3/);
    expect(formatDateTime(t, { locale: 'en-GB', timeZone: 'Not/AZone' })).toMatch(/2026/);
    expect(formatDateTime(null)).toBe('—');
  });

  it('the provider hands its time zone to the views', () => {
    function Probe() {
      const { timeZone } = useIotText();
      return <span>{timeZone}</span>;
    }
    render(<IotAdapterProvider adapter={{}} timeZone="Europe/Istanbul"><Probe /></IotAdapterProvider>);
    expect(screen.getByText('Europe/Istanbul')).toBeInTheDocument();
  });
});

describe('capabilities that could not be read (1.12)', () => {
  function Probe() {
    const c = useIotCapabilities();
    return (
      <div>
        <span>{c.ready ? 'ready' : 'waiting'}</span>
        <span>{c.failed ? 'failed' : 'answered'}</span>
        <span>{c.canManageProfiles ? 'may manage' : 'may not manage'}</span>
        <button type="button" onClick={c.retry}>again</button>
      </div>
    );
  }

  it('are off and marked failed, and a retry asks again', async () => {
    const user = userEvent.setup();
    let fail = true;
    const capabilities = vi.fn(async () => { if (fail) throw new Error('down'); return { canManageProfiles: true }; });
    const adapter: IotAdapter = { capabilities };
    render(<IotAdapterProvider adapter={adapter}><Probe /></IotAdapterProvider>);
    expect(await screen.findByText('failed')).toBeInTheDocument();
    expect(screen.getByText('may not manage')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'again' }));
    await waitFor(() => expect(screen.getByText('may manage')).toBeInTheDocument());
    expect(screen.getByText('answered')).toBeInTheDocument();
    expect(capabilities).toHaveBeenCalledTimes(2);
  });

  it('known capabilities are never asked and never fail', () => {
    render(<IotAdapterProvider adapter={{ capabilities: vi.fn() }} capabilities={{ canManageProfiles: true }}><Probe /></IotAdapterProvider>);
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('answered')).toBeInTheDocument();
  });
});
