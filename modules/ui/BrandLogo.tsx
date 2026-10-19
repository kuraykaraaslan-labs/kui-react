'use client';
import { cn } from '@/libs/utils/cn';

type BrandLogoSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

type BrandLogoProps = {
  /** Shown when there is no logo image: an initial or an icon on the brand color. */
  children?: React.ReactNode;
  size?: BrandLogoSize;
  className?: string;
  /** The logo for the light theme; also used in the dark theme when there is no `logoDark`. */
  logoLight?: string;
  /** The logo for the dark theme; also used in the light theme when there is no `logoLight`. */
  logoDark?: string;
  /** The logo's text alternative (the brand name). */
  alt?: string;
};

const BOX: Record<BrandLogoSize, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-lg',
  lg: 'h-16 w-16 text-2xl',
  xl: 'h-20 w-20 text-3xl',
  '2xl': 'h-24 w-24 text-4xl',
};
const IMAGE_HEIGHT: Record<BrandLogoSize, string> = { sm: 'h-8', md: 'h-12', lg: 'h-16', xl: 'h-20', '2xl': 'h-24' };

/**
 * The brand mark: a logo image (light / dark theme variants) when one is given, otherwise `children` (an initial or
 * an icon) on the brand color. URLs are expected vetted by the caller.
 */
export function BrandLogo({ children, size = 'md', className, logoLight, logoDark, alt = '' }: BrandLogoProps) {
  const light = logoLight || logoDark;
  const dark = logoDark || logoLight;
  if (light && dark) {
    const img = cn('w-auto max-w-[12rem] object-contain', IMAGE_HEIGHT[size]);
    return (
      <span className={cn('flex items-center justify-center', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- an app-supplied URL on any host, not a bundled asset */}
        <img src={light} alt={alt} className={cn(img, light !== dark && 'dark:hidden')} />
        {light !== dark && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dark} alt={alt} className={cn(img, 'hidden dark:block')} />
        )}
      </span>
    );
  }
  return (
    <span className={cn('flex items-center justify-center rounded-2xl bg-primary text-primary-fg font-bold shadow-sm', BOX[size], className)}>
      {children}
    </span>
  );
}
