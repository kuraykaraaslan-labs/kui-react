'use client';
import Link from 'next/link';
import { useState, useRef } from 'react';
import { Button } from '@/modules/ui/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { BrandLogo } from '@/modules/ui/BrandLogo';
import { AuthLayout } from '@/modules/domains/common/auth/AuthLayout';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';

const CODE_LENGTH = 6;

export default function TwoFactorPage() {
  const [digits, setDigits]   = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleDigitChange(idx: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    setError('');
    if (char && idx < CODE_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    const next = [...digits];
    text.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(text.length, CODE_LENGTH - 1)]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < CODE_LENGTH) { setError('Please enter the full 6-digit code.'); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    if (code === '123456') { setSuccess(true); }
    else { setError('Invalid code. Try 123456 for this demo.'); }
  }

  if (success) {
    return (
      <>
        <DocumentTitle text="Two-Factor Auth — Common Theme" />
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center space-y-5">
          <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-success-subtle text-3xl">🔓</span>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-text-primary">Signed in!</h1>
            <p className="text-sm text-text-secondary">Two-factor authentication passed.</p>
          </div>
          <Link href="/theme/common/account/profile"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover transition-colors">
            Go to account <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <DocumentTitle text="Two-Factor Auth — Common Theme" />
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <AuthLayout
        brand={<BrandLogo>C</BrandLogo>}
        title="Enter your code"
        description="From your authenticator app."
        footer={<>
          <p className="text-center text-sm text-text-secondary">
            <Link href="/theme/common/auth/login" className="text-primary hover:underline">← Back to login</Link>
          </p>
        </>}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-3 text-center">
              Authentication code
            </label>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  aria-label={`Digit ${i + 1}`}
                  className="h-12 w-10 rounded-lg border border-border bg-surface-base text-center text-xl font-bold text-text-primary tabular-nums
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-focus
                    caret-transparent transition-colors"
                />
              ))}
            </div>
            {error && <p className="text-xs text-error text-center mt-2">{error}</p>}
          </div>

          <Button type="submit" fullWidth loading={loading}>Verify</Button>
        </form>

        <div className="rounded-lg bg-surface-overlay border border-border px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-text-primary">Can&apos;t access your authenticator?</p>
          <p className="text-xs text-text-secondary">
            Use a{' '}
            <span className="text-primary cursor-pointer hover:underline">recovery code</span>
            {' '}or contact{' '}
            <span className="text-primary cursor-pointer hover:underline">support</span>.
          </p>
        </div>
      </AuthLayout>
    </div>
    </>
  );
}
