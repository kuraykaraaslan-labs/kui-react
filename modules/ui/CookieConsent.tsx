'use client';
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from './Button';
import { Modal } from './Modal';
import { Toggle } from './Toggle';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_DAYS,
  DEFAULT_CATEGORIES,
  allChoices,
  onConsentOpen,
  parseConsent,
  rawConsentCookie,
  saveConsent,
  subscribeConsent,
  type ConsentCategory,
  type ConsentChoices,
  type ConsentState,
} from './CookieConsent.store';

// Cookie consent (KVKK / GDPR): a banner until the visitor decides, and a settings window with one switch per
// category. "Reject all" is as prominent as "Accept all"; optional categories start off; the choice is kept for
// a policy version and asked again when the version changes. Nothing is loaded here: other code reads the
// choice with hasConsent() or listens for the `kui:consent` event before it loads analytics or marketing tags.

export type CookieConsentLabels = {
  title?: string;
  text?: string;
  policy?: string;
  acceptAll?: string;
  rejectAll?: string;
  settings?: string;
  dialogTitle?: string;
  dialogText?: string;
  save?: string;
  alwaysOn?: string;
};

export type CookieConsentProps = {
  /** Policy version. Change it when the cookie policy changes and every visitor is asked again. */
  version: string;
  categories?: ConsentCategory[];
  /** Address of the cookie policy page. */
  policyUrl?: string;
  /** Cookie name. Default `kui_consent`. */
  cookieName?: string;
  /** How long a choice is kept. Default 180 days. */
  maxAgeDays?: number;
  /** Cookie domain, to share one choice across subdomains (".example.com"). */
  domain?: string;
  labels?: CookieConsentLabels;
  /** Called after every saved choice. */
  onChange?: (state: ConsentState) => void;
  /** Banner position. */
  position?: 'bottom' | 'bottom-start';
  /** Render the banner in the page flow instead of fixed to the window (documentation, previews). */
  inline?: boolean;
  /** Show the banner even when a choice is stored (documentation, previews). */
  forceShow?: boolean;
  className?: string;
};

const L: Required<CookieConsentLabels> = {
  title: 'Cookies on this site',
  text: 'We use necessary cookies to run the site. With your permission we also use analytics and marketing cookies. You can change your choice at any time.',
  policy: 'Cookie policy',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  settings: 'Settings',
  dialogTitle: 'Cookie settings',
  dialogText: 'Choose which cookies we may use. Necessary cookies are always on.',
  save: 'Save choices',
  alwaysOn: 'Always on',
};

export function CookieConsent({
  version,
  categories = DEFAULT_CATEGORIES,
  policyUrl,
  cookieName = CONSENT_COOKIE,
  maxAgeDays = CONSENT_MAX_AGE_DAYS,
  domain,
  labels,
  onChange,
  position = 'bottom',
  inline = false,
  forceShow = false,
  className,
}: CookieConsentProps) {
  const t = { ...L, ...labels };
  const titleId = useId();
  // The raw cookie as an external store: null on the server and during hydration, so nothing renders until the
  // browser knows the choice (no flash for visitors who already decided, no hydration mismatch).
  const raw = useSyncExternalStore(subscribeConsent, () => rawConsentCookie(cookieName), () => null);
  const state = useMemo(() => (raw === null ? undefined : parseConsent(raw, version, categories)), [raw, version, categories]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentChoices>(() => allChoices(categories, false));

  useEffect(
    () =>
      onConsentOpen(() => {
        setDraft(parseConsent(rawConsentCookie(cookieName), version, categories)?.choices ?? allChoices(categories, false));
        setOpen(true);
      }),
    [categories, cookieName, version]
  );

  const decide = (choices: ConsentChoices) => {
    const next: ConsentState = { version, decidedAt: Math.floor(Date.now() / 1000), choices };
    saveConsent(next, { name: cookieName, maxAgeDays, domain });
    setOpen(false);
    onChange?.(next);
  };

  const openSettings = () => {
    setDraft(state?.choices ?? allChoices(categories, false));
    setOpen(true);
  };

  const showBanner = state === null || (forceShow && state !== undefined); // undefined = not known yet (server / hydration)

  return (
    <>
      {showBanner && (
        <section
          role="region"
          aria-labelledby={titleId}
          className={cn(
            'max-w-2xl rounded-2xl border border-border bg-surface-raised p-5 shadow-xl',
            !inline && 'fixed inset-x-4 bottom-4 z-[60] mx-auto',
            !inline && position === 'bottom-start' && 'sm:right-auto sm:mx-0 sm:max-w-md',
            className
          )}
        >
          <h2 id={titleId} className="text-base font-semibold text-text-primary">{t.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            {t.text}{' '}
            {policyUrl && <a href={policyUrl} className="font-medium text-primary underline-offset-2 hover:underline">{t.policy}</a>}
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button variant="ghost" onClick={openSettings} className="sm:mr-auto">{t.settings}</Button>
            {/* Reject and accept carry the same weight: refusing must be as easy as accepting. */}
            <Button variant="primary" onClick={() => decide(allChoices(categories, false))}>{t.rejectAll}</Button>
            <Button variant="primary" onClick={() => decide(allChoices(categories, true))}>{t.acceptAll}</Button>
          </div>
        </section>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.dialogTitle}
        description={t.dialogText}
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => decide(allChoices(categories, false))}>{t.rejectAll}</Button>
            <Button variant="outline" onClick={() => decide({ ...draft, ...Object.fromEntries(categories.filter((c) => c.required).map((c) => [c.id, true])) })}>{t.save}</Button>
            <Button variant="primary" onClick={() => decide(allChoices(categories, true))}>{t.acceptAll}</Button>
          </div>
        }
      >
        <ul className="divide-y divide-border">
          {categories.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{c.label}</p>
                {c.description && <p className="mt-0.5 text-sm text-text-secondary">{c.description}</p>}
              </div>
              {c.required ? (
                <span className="shrink-0 rounded-full bg-surface-overlay px-2.5 py-1 text-xs font-medium text-text-secondary">{t.alwaysOn}</span>
              ) : (
                <Toggle
                  id={`kui-consent-${c.id}`}
                  label=""
                  ariaLabel={c.label}
                  checked={draft[c.id] === true}
                  onChange={(v) => setDraft((d) => ({ ...d, [c.id]: v }))}
                  className="shrink-0"
                />
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
