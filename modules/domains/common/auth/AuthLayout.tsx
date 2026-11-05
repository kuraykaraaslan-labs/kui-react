'use client';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';

type AuthLayoutProps = {
  /** The product's mark (a logo image or `BrandLogo`), shown once, above the card. */
  brand?: ReactNode;
  /** One short line under the mark (the product's tagline). */
  tagline?: ReactNode;
  /** The page's own title: "Sign in", "Create account", "Set a new password". Never the product name again. */
  title: ReactNode;
  /** One help line under the title. */
  description?: ReactNode;
  /** The card's body: the form, its banners and its links. */
  children: ReactNode;
  /** Below the card: "Don't have an account? Sign up". */
  footer?: ReactNode;
  className?: string;
};

/**
 * The frame of every authentication page (sign in, register, forgot / reset / change password, verify email, choose or open an
 * organization). The brand stands above the card once; the card starts with the page's own title and one help line, left-aligned and
 * set off from the form by a rule, so the product name is never repeated and every auth page reads the same.
 */
export function AuthLayout({ brand, tagline, title, description, children, footer, className }: AuthLayoutProps) {
  return (
    <div className={cn('w-full max-w-md space-y-6', className)}>
      {(brand || tagline) && (
        <div className="flex flex-col items-center gap-2 text-center">
          {brand && <div className="flex justify-center">{brand}</div>}
          {tagline && <p className="text-sm text-text-secondary">{tagline}</p>}
        </div>
      )}
      <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-sm sm:p-8">
        <header className="mb-6 space-y-1 border-b border-border pb-4">
          <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
          {description && <p className="text-sm text-text-secondary">{description}</p>}
        </header>
        <div className="space-y-6">{children}</div>
      </div>
      {footer && <div className="text-center text-sm text-text-secondary">{footer}</div>}
    </div>
  );
}
