import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookieConsent } from './CookieConsent';
import {
  CONSENT_EVENT,
  DEFAULT_CATEGORIES,
  allChoices,
  consentCookie,
  hasConsent,
  openConsentSettings,
  parseConsent,
  readCookie,
  serializeConsent,
} from './CookieConsent.store';

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

describe('CookieConsent store', () => {
  it('round-trips a choice for the same policy version', () => {
    const state = { version: '2', decidedAt: 1_800_000_000, choices: { necessary: true, analytics: true, marketing: false } };
    expect(parseConsent(serializeConsent(state), '2')).toEqual(state);
  });

  it('treats a choice for another policy version, junk or nothing as no choice', () => {
    const raw = serializeConsent({ version: '1', decidedAt: 1, choices: { necessary: true, analytics: true } });
    expect(parseConsent(raw, '2')).toBeNull();
    expect(parseConsent('%7Bnot-json', '2')).toBeNull();
    expect(parseConsent('', '2')).toBeNull();
    expect(parseConsent(null, '2')).toBeNull();
  });

  it('keeps required categories on, drops unknown keys and starts new categories off', () => {
    const raw = encodeURIComponent(JSON.stringify({ v: '1', t: 5, c: { necessary: false, analytics: 'yes', tracking: true } }));
    expect(parseConsent(raw, '1')?.choices).toEqual({ necessary: true, analytics: false, marketing: false });
  });

  it('builds accept-all and reject-all choices', () => {
    expect(allChoices(DEFAULT_CATEGORIES, true)).toEqual({ necessary: true, analytics: true, marketing: true });
    expect(allChoices(DEFAULT_CATEGORIES, false)).toEqual({ necessary: true, analytics: false, marketing: false });
  });

  it('reads one cookie out of a cookie string', () => {
    expect(readCookie('a=1; kui_consent=xyz; b=2')).toBe('xyz');
    expect(readCookie('a=1')).toBeNull();
  });

  it('writes a first-party, Lax, path-wide cookie with a max age', () => {
    const c = consentCookie({ version: '1', decidedAt: 1, choices: { necessary: true } }, { maxAgeDays: 1, secure: true });
    expect(c).toMatch(/^kui_consent=/);
    expect(c).toContain('Path=/');
    expect(c).toContain('Max-Age=86400');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Secure');
  });
});

describe('CookieConsent', () => {
  beforeEach(() => clearCookies());

  it('shows the banner until the visitor decides, with reject as prominent as accept', () => {
    render(<CookieConsent version="1" policyUrl="/cookie-policy/" />);
    expect(screen.getByRole('region', { name: 'Cookies on this site' })).toBeInTheDocument();
    const reject = screen.getByRole('button', { name: 'Reject all' });
    const accept = screen.getByRole('button', { name: 'Accept all' });
    expect(reject.className).toBe(accept.className);
    expect(screen.getByRole('link', { name: 'Cookie policy' })).toHaveAttribute('href', '/cookie-policy/');
  });

  it('reject all stores only necessary cookies and hides the banner', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CookieConsent version="1" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Reject all' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(hasConsent('analytics', '1')).toBe(false);
    expect(hasConsent('necessary', '1')).toBe(true);
    expect(onChange.mock.calls[0][0].choices).toEqual({ necessary: true, analytics: false, marketing: false });
  });

  it('accept all allows every category and announces it on window', async () => {
    const heard = vi.fn();
    window.addEventListener(CONSENT_EVENT, heard);
    const user = userEvent.setup();
    render(<CookieConsent version="1" />);
    await user.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(hasConsent('analytics', '1')).toBe(true);
    expect(hasConsent('marketing', '1')).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(CONSENT_EVENT, heard);
  });

  it('settings: optional categories start off, one can be switched on and saved', async () => {
    const user = userEvent.setup();
    render(<CookieConsent version="1" />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const analytics = screen.getByRole('switch', { name: 'Analytics' });
    expect(analytics).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Always on')).toBeInTheDocument();
    await user.click(analytics);
    await user.click(screen.getByRole('button', { name: 'Save choices' }));
    expect(hasConsent('analytics', '1')).toBe(true);
    expect(hasConsent('marketing', '1')).toBe(false);
  });

  it('asks again when the policy version changes', () => {
    document.cookie = consentCookie({ version: '1', decidedAt: 1, choices: allChoices(DEFAULT_CATEGORIES, true) });
    const { unmount } = render(<CookieConsent version="1" />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    unmount();
    render(<CookieConsent version="2" />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('openConsentSettings() reopens the window with the stored choice', async () => {
    document.cookie = consentCookie({ version: '1', decidedAt: 1, choices: { necessary: true, analytics: true, marketing: false } });
    render(<CookieConsent version="1" />);
    act(() => openConsentSettings());
    expect(await screen.findByRole('switch', { name: 'Analytics' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Marketing' })).toHaveAttribute('aria-checked', 'false');
  });
});
