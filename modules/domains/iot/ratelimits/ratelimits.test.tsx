import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDemoRateLimitsAdapter, DEMO_RATE_LIMITS } from './demo-ratelimits';
import { DeviceRateLimitsAction, DeviceRateLimitsPanel, limitText } from './DeviceRateLimitsAction';
import { flattenRateLimitsMessages, RATE_LIMITS_MESSAGES, rateLimitsMessagesFrom } from './messages';

const M = RATE_LIMITS_MESSAGES;

describe('rate limits (NB iot-gateway 06 §6.4, W8G-6)', () => {
  it('words a limit by its windows', () => {
    expect(limitText([{ count: 10, seconds: 1 }, { count: 300, seconds: 60 }], M)).toBe('10 a second, 300 a minute');
    expect(limitText([{ count: 1, seconds: 3600 }], M)).toBe('1 an hour');
    expect(limitText([{ count: 3, seconds: 15 }], M)).toBe('3 per 15 s');
    expect(limitText([], M)).toBe('None');
  });

  it('lists the device\'s kinds with who set them and how they apply, and the workspace\'s plan limits', () => {
    render(<DeviceRateLimitsPanel view={DEMO_RATE_LIMITS} />);
    const row = screen.getByText('Telemetry messages').closest('tr') as HTMLElement;
    expect(within(row).getByText('2 a second, 60 a minute')).toBeTruthy();
    expect(within(row).getByText('Device profile')).toBeTruthy();
    expect(within(row).getByText('Refused over the limit')).toBeTruthy();
    expect(within(screen.getByText('Certificate renewals').closest('tr') as HTMLElement).getByText('Counted only')).toBeTruthy();
    expect(screen.getByText(M.mode.observedHint)).toBeTruthy();
    expect(within(screen.getByText('Telemetry values a minute').closest('tr') as HTMLElement).getByText('9,000')).toBeTruthy();
    expect(within(screen.getByText('Devices connected at once').closest('tr') as HTMLElement).getByText('None')).toBeTruthy();
    expect(screen.getByText(M.gateway.on)).toBeTruthy();
  });

  it('says when the gateway limits nothing, when it is not known, and a plan value of 0 as none allowed', () => {
    const off = { ...DEMO_RATE_LIMITS, gateway: { enforcement: 'off' as const, enforce: [], nodes: 1 }, tenant: [{ key: 'connectsPerMinute' as const, value: 0 }] };
    const { unmount } = render(<DeviceRateLimitsPanel view={off} />);
    expect(screen.getByText(M.gateway.off)).toBeTruthy();
    expect(screen.getByText('None allowed')).toBeTruthy();
    unmount();
    render(<DeviceRateLimitsPanel view={{ ...DEMO_RATE_LIMITS, gateway: { enforcement: 'unknown', enforce: [], nodes: 0 } }} />);
    expect(screen.getByText(M.gateway.unknown)).toBeTruthy();
  });

  it('reads the limits only when the drawer opens, and offers a retry after a failure', async () => {
    const limits = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(DEMO_RATE_LIMITS);
    render(<DeviceRateLimitsAction adapter={{ limits }} deviceId="d1" />);
    expect(limits).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /rate limits/i }));
    expect(await screen.findByText('The limits could not be read: offline')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Telemetry messages')).toBeTruthy();
    expect(limits).toHaveBeenCalledWith('d1', expect.anything());
  });

  it('the demo adapter answers, and a host dictionary translates every text', async () => {
    render(<DeviceRateLimitsAction adapter={createDemoRateLimitsAdapter(DEMO_RATE_LIMITS, 0)} deviceId="d1" defaultOpen />);
    expect(await screen.findByText('Connections')).toBeTruthy();
    const keys = Object.keys(flattenRateLimitsMessages());
    expect(keys).toContain('family.connects');
    const tr = rateLimitsMessagesFrom((key) => `«${key}»`);
    expect(tr.action.open).toBe('«action.open»');
  });
});
