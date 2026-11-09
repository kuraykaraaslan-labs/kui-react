// Cookie consent state: what the visitor chose, for which policy version, and when.
// Framework-free so the kui-ejs and KUInative ports and server code share the same format.
//
// Stored as one first-party cookie (default name `kui_consent`), readable by the server so it can skip
// analytics tags for visitors who said no:
//   kui_consent = encodeURIComponent(JSON.stringify({ v: "<policy version>", t: <unix seconds>, c: { analytics: true, … } }))
// A stored choice for another policy version counts as no choice: the banner asks again.
// Changes are announced on `window` as the `kui:consent` event (detail: ConsentState | null);
// `kui:consent:open` asks every mounted CookieConsent to open its settings window.

export type ConsentCategory = {
  /** Stable key stored in the cookie (`necessary`, `analytics`, `marketing`, …). */
  id: string;
  label: string;
  description?: string;
  /** Always on, cannot be switched off (strictly necessary cookies). */
  required?: boolean;
};

export type ConsentChoices = Record<string, boolean>;

export type ConsentState = {
  /** Policy version the choice was made for. */
  version: string;
  /** When the choice was made (unix seconds). */
  decidedAt: number;
  choices: ConsentChoices;
};

export const CONSENT_COOKIE = 'kui_consent';
export const CONSENT_EVENT = 'kui:consent';
export const CONSENT_OPEN_EVENT = 'kui:consent:open';
export const CONSENT_MAX_AGE_DAYS = 180;

export const DEFAULT_CATEGORIES: ConsentCategory[] = [
  { id: 'necessary', label: 'Necessary', description: 'Sign-in, security, language and your cookie choice. The site cannot work without them.', required: true },
  { id: 'analytics', label: 'Analytics', description: 'Anonymous statistics about which pages are visited, so we can improve the site.' },
  { id: 'marketing', label: 'Marketing', description: 'Measuring campaigns and showing relevant ads on other sites.' },
];

/** Choices with every optional category set to `value` and required ones always on. */
export function allChoices(categories: ConsentCategory[], value: boolean): ConsentChoices {
  return Object.fromEntries(categories.map((c) => [c.id, c.required ? true : value]));
}

/** Parses a raw cookie value; null when missing, malformed or for another policy version. */
export function parseConsent(raw: string | null | undefined, version: string, categories: ConsentCategory[] = DEFAULT_CATEGORIES): ConsentState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as { v?: unknown; t?: unknown; c?: unknown };
    if (data.v !== version || typeof data.t !== 'number' || typeof data.c !== 'object' || data.c === null) return null;
    const stored = data.c as Record<string, unknown>;
    // Unknown keys are dropped; categories added since the choice default to off; required ones are always on.
    const choices = Object.fromEntries(categories.map((c) => [c.id, c.required ? true : stored[c.id] === true]));
    return { version, decidedAt: data.t, choices };
  } catch {
    return null;
  }
}

export function serializeConsent(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify({ v: state.version, t: state.decidedAt, c: state.choices }));
}

/** The raw value of a cookie from a `document.cookie`-style string. */
export function readCookie(cookieString: string, name: string = CONSENT_COOKIE): string | null {
  for (const part of cookieString.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** The Set-Cookie / document.cookie string that stores a choice. */
export function consentCookie(state: ConsentState, opts: { name?: string; maxAgeDays?: number; secure?: boolean; domain?: string } = {}): string {
  const days = opts.maxAgeDays ?? CONSENT_MAX_AGE_DAYS;
  return [
    `${opts.name ?? CONSENT_COOKIE}=${serializeConsent(state)}`,
    'Path=/',
    `Max-Age=${Math.round(days * 86400)}`,
    'SameSite=Lax',
    opts.domain ? `Domain=${opts.domain}` : '',
    opts.secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

/** Browser helpers (no-ops on the server). */
export function getStoredConsent(version: string, categories?: ConsentCategory[], name?: string): ConsentState | null {
  if (typeof document === 'undefined') return null;
  return parseConsent(readCookie(document.cookie, name), version, categories);
}

export function saveConsent(state: ConsentState, opts: { name?: string; maxAgeDays?: number; domain?: string } = {}): void {
  if (typeof document === 'undefined') return;
  document.cookie = consentCookie(state, { ...opts, secure: window.location.protocol === 'https:' });
  window.dispatchEvent(new CustomEvent<ConsentState | null>(CONSENT_EVENT, { detail: state }));
}

/** Whether a category is allowed right now (false until the visitor chose). */
export function hasConsent(category: string, version: string, categories?: ConsentCategory[], name?: string): boolean {
  return getStoredConsent(version, categories, name)?.choices[category] === true;
}

/** Opens the settings window of every mounted CookieConsent (for a "Cookie settings" footer link). */
export function openConsentSettings(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

/** Subscribes to consent changes (for useSyncExternalStore). */
export function subscribeConsent(cb: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, cb);
  return () => window.removeEventListener(CONSENT_EVENT, cb);
}

/** The raw consent cookie of this browser ('' when none). */
export function rawConsentCookie(name: string = CONSENT_COOKIE): string {
  return readCookie(document.cookie, name) ?? '';
}

/** Calls cb whenever openConsentSettings() runs; returns the unsubscribe function. */
export function onConsentOpen(cb: () => void): () => void {
  window.addEventListener(CONSENT_OPEN_EVENT, cb);
  return () => window.removeEventListener(CONSENT_OPEN_EVENT, cb);
}
