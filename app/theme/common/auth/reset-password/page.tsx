'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Input } from '@/modules/ui/Input';
import { Button } from '@/modules/ui/Button';
import { Form } from '@/modules/app/Form';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { BrandLogo } from '@/modules/ui/BrandLogo';
import { AuthLayout } from '@/modules/domains/common/auth/AuthLayout';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';

type FormState = 'idle' | 'loading' | 'success' | 'error';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors]                   = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [formState, setFormState]             = useState<FormState>('idle');

  function validate() {
    const next: typeof errors = {};
    if (!newPassword)              next.newPassword     = 'New password is required.';
    else if (newPassword.length < 8) next.newPassword  = 'Password must be at least 8 characters.';
    if (!confirmPassword)          next.confirmPassword = 'Please confirm your password.';
    else if (newPassword !== confirmPassword) next.confirmPassword = "Passwords don't match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setFormState('loading');
    await new Promise((r) => setTimeout(r, 1000));
    setFormState('success');
  }

  if (formState === 'success') {
    return (
      <>
        <DocumentTitle text="Reset Password — Common Theme" />
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center space-y-5">
          <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-success-subtle">
            <FontAwesomeIcon icon={faCheck} className="w-8 h-8 text-success" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-text-primary">Password updated</h1>
            <p className="text-sm text-text-secondary">You can now sign in with your new password.</p>
          </div>
          <Link href="/theme/common/auth/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover transition-colors">
            Go to login <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <DocumentTitle text="Reset Password — Common Theme" />
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <AuthLayout
        brand={<BrandLogo>C</BrandLogo>}
        title="Set a new password"
        footer={<>
          <p className="text-center text-sm text-text-secondary">
            Remembered it?{' '}
            <Link href="/theme/common/auth/login" className="text-primary font-medium hover:underline">Back to login</Link>
          </p>
        </>}
      >
        <Form
          onSubmit={handleSubmit}
          error={formState === 'error' ? 'Something went wrong. Please try again.' : undefined}
        >
          <Input
            id="new-password"
            label="New Password"
            type="password"
            required
            autoComplete="new-password"
            hint="Minimum 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={errors.newPassword}
          />
          <Input
            id="confirm-password"
            label="Confirm Password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
          />
          <Button type="submit" fullWidth loading={formState === 'loading'}>
            Reset Password
          </Button>
        </Form>
      </AuthLayout>
    </div>
    </>
  );
}
