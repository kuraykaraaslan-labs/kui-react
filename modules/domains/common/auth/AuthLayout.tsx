'use client';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Card } from '@/modules/ui/Card';

type AuthLayoutProps = {
  /** The product's mark (`BrandLogo`), shown once, above the card. */
  brand?: ReactNode;
  /** What the page does, in plain words: "Sign in", "Create an account", "Reset your password". Never the product name. */
  title: ReactNode;
  /**
   * One line of information the person can use, or nothing: the workspace they are signing in to (`acme.example.com`), the address a
   * link was sent to. Not a greeting.
   */
  description?: ReactNode;
  /** The card's body: the form, its banners and its links. */
  children: ReactNode;
  /** Below the card: "Don't have an account? Sign up". */
  footer?: ReactNode;
  className?: string;
};

/**
 * The frame of every authentication page (sign in, register, forgot / reset / change password, verify email, two-factor, choose or
 * open an organization), built from the kit's own pieces: `BrandLogo` above a `Card`, the title in `PageHeader`'s type (text-xl
 * semibold) with one secondary line, the form under it. The brand stands once; the card never repeats it.
 */
export function AuthLayout({ brand, title, description, children, footer, className }: AuthLayoutProps) {
  return (
    <div className={cn('w-full max-w-md space-y-6', className)}>
      {brand && <div className="flex justify-center">{brand}</div>}
      <Card>
        <div className="space-y-6 py-2">
          <header>
            <h1 className="text-xl font-semibold leading-tight text-text-primary">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
          </header>
          <div className="space-y-6">{children}</div>
        </div>
      </Card>
      {footer && <div className="text-center text-sm text-text-secondary">{footer}</div>}
    </div>
  );
}
