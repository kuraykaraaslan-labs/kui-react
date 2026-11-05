'use client';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/modules/domains/common/auth/ForgotPasswordForm';
import { BrandLogo } from '@/modules/ui/BrandLogo';
import { AuthLayout } from '@/modules/domains/common/auth/AuthLayout';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';

export default function ForgotPasswordPage() {
  return (
    <>
      <DocumentTitle text="Forgot Password — Common Theme" />
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <AuthLayout
        brand={<BrandLogo>C</BrandLogo>}
        title="Reset your password"
        description={<>We&apos;ll email you a link.</>}
        footer={<>
          <div className="text-center space-y-2">
            <p className="text-sm text-text-secondary">
              Remember your password?{' '}
              <Link href="/theme/common/auth/login" className="text-primary font-medium hover:underline">
                Back to login
              </Link>
            </p>
            <p className="text-sm text-text-secondary">
              No account yet?{' '}
              <Link href="/theme/common/auth/register" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </>}
      >
        <ForgotPasswordForm
          onSubmit={async (_email) => {
            await new Promise((r) => setTimeout(r, 1000));
          }}
        />
      </AuthLayout>
    </div>
    </>
  );
}
