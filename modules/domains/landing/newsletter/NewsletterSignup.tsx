'use client';
import { useId, useState, type FormEvent } from 'react';
import { cn } from '@/libs/utils/cn';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type NewsletterSignupProps = {
  title?: string;
  subtitle?: string;
  /** Called with the address once it is valid and the visitor has agreed; resolve true when the sign-up went through. */
  onSubscribe: (email: string) => Promise<boolean> | boolean;
  privacyHref?: string;
  labels?: Partial<{ email: string; placeholder: string; button: string; consent: string; privacy: string; success: string; invalid: string; failed: string }>;
  className?: string;
};

/**
 * A newsletter sign-up: an e-mail field, a consent box that must be ticked (with a link to the privacy page), and a
 * button; a hidden field quietly drops bots. The host sends the address on (`onSubscribe`); its mailing tool should
 * confirm by e-mail (double opt-in). Mirrors next-boilerplate's dynamic_page Newsletter block, which posts to a webhook.
 */
export function NewsletterSignup({ title, subtitle, onSubscribe, privacyHref, labels, className }: NewsletterSignupProps) {
  const uid = useId();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'invalid' | 'failed'>('idle');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (String(new FormData(e.currentTarget).get('website') ?? '').trim()) { setState('done'); return; }
    if (!EMAIL.test(email.trim()) || !consent) { setState('invalid'); return; }
    setState('sending');
    try { setState((await onSubscribe(email.trim())) ? 'done' : 'failed'); } catch { setState('failed'); }
  }
  return (
    <section className={cn('mx-auto w-full max-w-xl text-center text-text-primary', className)}>
      {title && <h2 className="text-3xl font-bold">{title}</h2>}
      {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
      {state === 'done' ? (
        <p role="status" className="mt-6 rounded-xl bg-primary-subtle p-4 font-medium">{labels?.success ?? 'Thank you! Please check your inbox to confirm.'}</p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 text-left">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`${uid}-email`} className="sr-only">{labels?.email ?? 'E-mail address'}</label>
            <input id={`${uid}-email`} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={labels?.placeholder ?? 'you@example.com'}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-base px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" />
            <button type="submit" disabled={state === 'sending'} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-fg hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
              {labels?.button ?? 'Subscribe'}
            </button>
          </div>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
          <label className="mt-3 flex items-start gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
            <span>
              {labels?.consent ?? 'I agree to receive the newsletter and can unsubscribe at any time.'}
              {privacyHref && <> <a href={privacyHref} className="font-medium text-primary underline">{labels?.privacy ?? 'Privacy policy'}</a></>}
            </span>
          </label>
          {state === 'invalid' && <p role="alert" className="mt-2 text-sm text-error">{labels?.invalid ?? 'Enter a valid e-mail address and tick the box.'}</p>}
          {state === 'failed' && <p role="alert" className="mt-2 text-sm text-error">{labels?.failed ?? 'That did not go through. Please try again later.'}</p>}
        </form>
      )}
    </section>
  );
}
