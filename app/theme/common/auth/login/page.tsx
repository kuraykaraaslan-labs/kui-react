'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BrandLogo } from '@/modules/ui/BrandLogo';
import { LoginForm } from '@/modules/domains/common/auth/LoginForm';
import { OAuthButtons } from '@/modules/domains/common/auth/OAuthButtons';
import { SessionExpiredBanner } from '@/modules/domains/common/auth/SessionExpiredBanner';
import { AuthLayout } from '@/modules/domains/common/auth/AuthLayout';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';

export default function LoginPage() {
  const [showExpiredBanner, setShowExpiredBanner] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  async function handleLogin(values: { email: string; password: string; rememberMe: boolean }) {
    await new Promise((r) => setTimeout(r, 1000));
    setSuccessMsg(`Signed in as ${values.email}`);
  }

  return (
    <>
      <DocumentTitle text="Login — Common Theme" />
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <AuthLayout
        brand={<BrandLogo>C</BrandLogo>}
        title="Sign in"
        description="app.example.com"
        footer={<>
          <p className="text-center text-sm text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/theme/common/auth/register" className="text-primary font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </>}
      >
        {showExpiredBanner && (
          <SessionExpiredBanner
            onSignIn={() => setShowExpiredBanner(false)}
          />
        )}

        {successMsg ? (
          <div className="rounded-lg bg-success-subtle border border-success px-4 py-3 text-center space-y-1">
            <p className="text-sm font-semibold text-success-fg">Success!</p>
            <p className="text-sm text-success-fg">{successMsg}</p>
          </div>
        ) : (
          <>
            {/* OAuth */}
            <OAuthButtons
              providers={['GOOGLE', 'GITHUB']}
              onProvider={async (_p) => { await new Promise((r) => setTimeout(r, 800)); }}
            />

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" aria-hidden="true" />
              <span className="text-xs text-text-secondary">or continue with email</span>
              <div className="flex-1 h-px bg-border" aria-hidden="true" />
            </div>

            {/* Form */}
            <LoginForm onSubmit={handleLogin} />

            <p className="text-center text-xs text-text-secondary">
              <Link href="/theme/common/auth/forgot-password" className="text-primary hover:underline">
                Forgot your password?
              </Link>
            </p>
          </>
        )}
      </AuthLayout>
    </div>
    </>
  );
}
