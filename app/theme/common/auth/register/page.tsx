'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BrandLogo } from '@/modules/ui/BrandLogo';
import { RegisterForm } from '@/modules/domains/common/auth/RegisterForm';
import { OAuthButtons } from '@/modules/domains/common/auth/OAuthButtons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { AuthLayout } from '@/modules/domains/common/auth/AuthLayout';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';

export default function RegisterPage() {
  const [successEmail, setSuccessEmail] = useState('');

  async function handleRegister(values: { email: string; password: string }) {
    await new Promise((r) => setTimeout(r, 1000));
    setSuccessEmail(values.email);
  }

  return (
    <>
      <DocumentTitle text="Register — Common Theme" />
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <AuthLayout
        brand={<BrandLogo>C</BrandLogo>}
        title="Create an account"
        description="app.example.com"
        footer={<>
          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/theme/common/auth/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </>}
      >
        {successEmail ? (
          <div className="rounded-lg bg-success-subtle border border-success px-4 py-4 space-y-2 text-center">
            <p className="text-2xl" aria-hidden="true">🎉</p>
            <p className="text-sm font-semibold text-success-fg">Account created!</p>
            <p className="text-sm text-success-fg">
              Welcome aboard. We sent a confirmation to{' '}
              <span className="font-mono">{successEmail}</span>.
            </p>
            <Link
              href="/theme/common/auth/login"
              className="inline-block mt-2 text-sm font-medium text-primary hover:underline"
            >
              Go to login <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            {/* OAuth */}
            <OAuthButtons
              providers={['GOOGLE', 'GITHUB', 'DISCORD']}
              onProvider={async (_p) => { await new Promise((r) => setTimeout(r, 800)); }}
            />

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" aria-hidden="true" />
              <span className="text-xs text-text-secondary">or sign up with email</span>
              <div className="flex-1 h-px bg-border" aria-hidden="true" />
            </div>

            {/* Form */}
            <RegisterForm onSubmit={handleRegister} />

            <p className="text-xs text-text-secondary text-center leading-relaxed">
              By creating an account you agree to our{' '}
              <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
              {' '}and{' '}
              <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
            </p>
          </>
        )}
      </AuthLayout>
    </div>
    </>
  );
}
