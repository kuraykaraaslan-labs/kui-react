'use client';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { BrandLogo } from '@/modules/ui/BrandLogo';
import { AuthLayout } from '@/modules/domains/common/auth/AuthLayout';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const [digits, setDigits]     = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [verified, setVerified] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

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
    if (code === '123456') { setVerified(true); }
    else { setError('Invalid code. Try 123456 for this demo.'); }
  }

  async function handleResend() {
    setResending(true);
    await new Promise((r) => setTimeout(r, 800));
    setResending(false);
    setCountdown(60);
    setDigits(Array(CODE_LENGTH).fill(''));
    setError('');
    inputRefs.current[0]?.focus();
  }

  if (verified) {
    return (
      <>
        <DocumentTitle text="Verify Email — Common Theme" />
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center space-y-5">
          <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-success-subtle">
            <FontAwesomeIcon icon={faEnvelope} className="w-8 h-8 text-success" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-text-primary">Email verified!</h1>
            <p className="text-sm text-text-secondary">Your account is now active. Welcome aboard.</p>
          </div>
          <Link href="/theme/common/auth/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover transition-colors">
            Continue to login <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <DocumentTitle text="Verify Email — Common Theme" />
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <AuthLayout
        brand={<BrandLogo>C</BrandLogo>}
        title="Check your email"
        description={<>Sent to <span className="font-medium text-text-primary">john.doe@example.com</span></>}
        footer={<>
          <p className="text-center text-xs text-text-secondary">
            Wrong email?{' '}
            <Link href="/theme/common/auth/register" className="text-primary hover:underline">Go back</Link>
          </p>
        </>}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-3 text-center">
              Enter verification code
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

          <Button type="submit" fullWidth loading={loading}>Verify Email</Button>
        </form>

        <div className="text-center text-sm text-text-secondary">
          {countdown > 0 ? (
            <span>Resend code in <span className="font-mono font-semibold text-text-primary">{countdown}s</span></span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          )}
        </div>
      </AuthLayout>
    </div>
    </>
  );
}
